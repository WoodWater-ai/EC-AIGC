import { useEffect, useMemo, useState } from 'react';
import { AppScreen, GenerationTask, ProductAsset, SystemUser, SystemNotification } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { TaskList } from './components/TaskList';
import { CreateImageTask } from './components/CreateImageTask';
import { CreateVideoTask } from './components/CreateVideoTask';
import TemplateCenter from './components/TemplateCenter';
import { ProductAssetLibrary } from './components/ProductAssetLibrary';
import { DataAnalytics } from './components/DataAnalytics';
import { SystemConfig } from './components/SystemConfig';
import { AssetTransitModal } from './components/AssetTransitModal';
import { LoginPage } from './components/LoginPage';
import { ResourceCategoryList } from './components/ResourceCategoryList';
import { ProductCategoryList } from './components/ProductCategoryList';
import { AsyncTaskList } from './components/AsyncTaskList';
import ProductManagePage from './components/ProductManagePage';
import DictCategoryList from './components/DictCategoryList';
import DictItemList from './components/DictItemList';

import { useAuth } from './auth/AuthContext';
import { setLoginRequiredHandler } from './api/error';
import { useServiceQuery } from './api/hooks/useServiceQuery';
import { userApi, type UserDTO } from './api/modules/user';
import { taskApi } from './api/modules/task';
import { toUIGenerationTask } from './components/createTask/taskAdapter';

import {
  mockTasks,
  mockProducts,
  mockNotifications
} from './mockData';

/**
 * 把 AuthContext 的 LoginResponse 适配成 Sidebar/Header 用的 SystemUser
 *
 * 设计取舍：
 * - Header/Sidebar 现有 prop 形状是 SystemUser（mock 类型），不重构这些组件
 * - 适配层放 App.tsx，类型差异收敛在一处
 * - LoginResponse 没有 headUrl（统一登录接口没返回头像），头像先空
 * - 第一个 role 作为 SystemUser.role 展示
 */
function adaptAuthUser(authUser: ReturnType<typeof useAuth>['user']): SystemUser {
  if (!authUser) {
    return {
      id: '0',
      name: '匿名',
      avatar: '',
      role: '管理员',
      email: '',
      status: 'offline',
      joinedDate: '',
    };
  }
  // 把 roles[0] (string) 映到 SystemUser.role 的字面量联合
  const ROLE_MAP: Record<string, SystemUser['role']> = {
    管理员: '管理员',
    高级设计师: '高级设计师',
    运营策划: '运营策划',
    协同客户: '协同客户',
  };
  const firstRole = authUser.roles?.[0];
  const mappedRole = firstRole ? ROLE_MAP[firstRole] : undefined;
  return {
    id: String(authUser.userId ?? authUser.username ?? '0'),
    name: authUser.name || authUser.username || '匿名',
    avatar: '', // LoginResponse 无 headUrl
    role: mappedRole ?? ('管理员' as SystemUser['role']),
    email: authUser.phone || '',
    status: 'online',
    joinedDate: '',
  };
}

export default function App() {
  const { user, isAuthenticated, initializing, logout } = useAuth();

  // 初次加载默认 DASHBOARD —— initializing=true 时显示 spinner 不进 switch；
  // initializing=false 后根据 isAuthenticated 决定 LOGIN 还是 DASHBOARD。
  // 旧版本初始值是 LOGIN（依赖 user 未持久化），现在 AuthProvider 会用 /me 恢复 user。
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.DASHBOARD);
  const [highlightGroupId, setHighlightGroupId] = useState<string | null>(null);

  const setScreen = (screen: AppScreen, payload?: { highlightGroupId?: string }) => {
    setCurrentScreen(screen);
    if (payload?.highlightGroupId) {
      setHighlightGroupId(payload.highlightGroupId);
    }
  };

  // Core local states
  const [products, setProducts] = useState<ProductAsset[]>(mockProducts);
  const [notifications, setNotifications] = useState<SystemNotification[]>(mockNotifications);

  // [2026-07-16 P0] 任务列表 —— 拉真接口 /v1/task/my-page,failure fallback mockTasks
  // 数据用 useServiceQuery 自动重试;失败 toast 警告;fallback 保留以保持首屏可用
  const tasksQuery = useServiceQuery(() => taskApi.myPage({ pageNum: 1, pageSize: 50 }), []);
  const realTasks: GenerationTask[] = useMemo(() => {
    const list = tasksQuery.data?.list ?? [];
    return list.map((r) => toUIGenerationTask(r, products));
  }, [tasksQuery.data, products]);
  const tasks = realTasks.length > 0 ? realTasks : mockTasks;
  useEffect(() => {
    if (tasksQuery.error) {
      console.warn('[App] /v1/task/my-page 失败,使用 mock 数据:', tasksQuery.error);
    }
  }, [tasksQuery.error]);

  // 用户列表(Phase 1.5) —— 从真接口 /v1/admin/user/list 拉,SystemUser 映射供 Sidebar 切换协作账号下拉用
  // 注意:useServiceQuery.data 初始为 null,如果用 `data ?? []` 作为 useEffect 依赖,每次渲染会创建新 [] 引用,触发死循环。
  // 修法:用 `data` 本身做依赖(引用稳定),内部 null 短路退出
  const userListQuery = useServiceQuery<UserDTO[]>(
    () => userApi.listAll(),
    []
  );
  const [users, setUsers] = useState<SystemUser[]>([]);
  useEffect(() => {
    if (!userListQuery.data) return;
    setUsers(userListQuery.data.map(u => ({
      id: u.id,
      name: u.name || u.userName || u.phone || '(未命名)',
      avatar: u.headUrl || '',
      role: u.isAdmin ? '管理员' : '运营策划',  // P1 TODO:从 roleIds 查角色名
      email: u.email || u.phone || '',
      status: u.status === 'DISABLED' ? 'offline' : 'online',
      joinedDate: '',  // UserResponse 无此字段
      deptId: u.deptId || undefined,
    })));
  }, [userListQuery.data]);

  // 适配后的当前用户（喂给 Sidebar / Header）
  const currentUser = adaptAuthUser(user);

  // Chosen contextual states (Shared between views)
  const [selectedProduct, setSelectedProduct] = useState<ProductAsset>(mockProducts[0]);
  const [isProductDrawerOpen, setIsProductDrawerOpen] = useState(false);
  const [isTransitOpen, setIsTransitOpen] = useState(false);

  /**
   * 注册登录态失效回调 —— axios 拦截器抛 A0102xx 时调用
   *
   * 这里用 setScreen(LOGIN)，但 error.ts 是纯模块不能 import React，
   * 通过 setLoginRequiredHandler 解耦
   */
  useEffect(() => {
    setLoginRequiredHandler(() => setCurrentScreen(AppScreen.LOGIN));
    return () => {
      // 卸载时恢复 fallback，避免在 test / hot-reload 场景下泄漏
      setLoginRequiredHandler(() => {
        window.location.href = '/login';
      });
    };
  }, []);

  // State Mutators
  const handleAddTask = (info: { groupId: string; taskIds: string[] }) => {
    setHighlightGroupId(info.groupId);
    setCurrentScreen(AppScreen.TASKS);
  };

  const handleUpdateTask = (_updatedTask: GenerationTask) => {
    // [2026-07-16 P0] tasks 已改为 useServiceQuery 真接口,不再有 setTasks
    // 父列表数据刷新由 onRefresh / refetch 触发;Drawer 内部 setState 暂不联动后端
    // 实际编辑类操作(评分/批注)二期接后端
  };

  const handleUpdateUserRole = (userId: string, newRole: any, newDeptId?: string) => {
    setUsers(prev => prev.map(u => u.id === userId
      ? { ...u, role: newRole, ...(newDeptId !== undefined ? { deptId: newDeptId } : {}) }
      : u
    ));
  };

  const handleMarkAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // Render Core content wrapper switcher
  const renderScreenContent = () => {
    switch (currentScreen) {
      case AppScreen.DASHBOARD:
        return (
          <Dashboard
            tasks={tasks}
            products={products}
            setScreen={setCurrentScreen}
            setSelectedProduct={setSelectedProduct}
            openProductDrawer={() => setIsProductDrawerOpen(true)}
          />
        );
      case AppScreen.TASKS:
        return (
          <TaskList
            tasks={tasks}
            products={products}
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            highlightGroupId={highlightGroupId}
            setScreen={setScreen}
            onRefresh={() => tasksQuery.refetch()}
          />
        );
      case AppScreen.CREATE_IMAGE_TASK:
        return (
          <div className="p-4 text-center text-slate-400">已在独立窗口打开</div>
        );
      case AppScreen.CREATE_VIDEO_TASK:
        return (
          <div className="p-4 text-center text-slate-400">已在独立窗口打开</div>
        );
      case AppScreen.TEMPLATES:
        return (
          <TemplateCenter setScreen={setCurrentScreen} />
        );
      case AppScreen.ASSETS:
        return (
          <ProductAssetLibrary
            products={products}
            selectedProduct={selectedProduct}
            setSelectedProduct={setSelectedProduct}
            isDrawerOpen={isProductDrawerOpen}
            setIsDrawerOpen={setIsProductDrawerOpen}
            setScreen={setCurrentScreen}
          />
        );
      case AppScreen.ANALYTICS:
        return <DataAnalytics />;
      case AppScreen.SYSTEM_CONFIG:
        return (
          <SystemConfig
            onUpdateUserRole={handleUpdateUserRole}
          />
        );
      case AppScreen.ASSET_CATEGORY:
        return (
          <ResourceCategoryList setScreen={setCurrentScreen} />
        );
      case AppScreen.PRODUCT_CATEGORY:
        return (
          <ProductCategoryList setScreen={setCurrentScreen} />
        );
      case AppScreen.ASYNC_TASKS:
        return <AsyncTaskList />;
      case AppScreen.PRODUCT_MANAGE:
        return <ProductManagePage />;
      case AppScreen.DICT_CATEGORY:
        return <DictCategoryList />;
      case AppScreen.DICT_ITEM:
        return <DictItemList />;
      default:
        return (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2">construction</span>
            页面正在施工中
          </div>
        );
    }
  };

  // ===== 路由分支：启动恢复中（AuthProvider 调 /me 期间） =====
  // 显示全屏 spinner，避免"闪一帧 LOGIN → 再进 dashboard"的体验问题
  if (initializing) {
    return (
      <div
        className="h-screen w-screen flex items-center justify-center bg-bg-base"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-5xl text-primary animate-spin">
            progress_activity
          </span>
          <p className="text-sm text-slate-500">加载中...</p>
        </div>
      </div>
    );
  }

  // ===== 路由分支：CREATE_* 任务页 =====
  if (currentScreen === AppScreen.CREATE_IMAGE_TASK) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-white">
        <CreateImageTask
          products={products}
          onAddTask={handleAddTask}
          setScreen={setScreen}
          openTransit={() => setIsTransitOpen(true)}
          selectedProduct={selectedProduct}
          setSelectedProduct={setSelectedProduct}
        />
        {isTransitOpen && (
          <AssetTransitModal
            purpose="OTHER"
            mode="manager"
            onConfirmSelection={(fileResIds) => {
              // App.tsx 全局兜底:无业务上下文,仅打日志
              console.log('[Transit] App 全局选中(未消费):', fileResIds);
              setIsTransitOpen(false);
            }}
            onClose={() => setIsTransitOpen(false)}
          />
        )}
      </div>
    );
  }

  if (currentScreen === AppScreen.CREATE_VIDEO_TASK) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-white">
        <CreateVideoTask
          products={products}
          onAddTask={handleAddTask}
          setScreen={setScreen}
          openTransit={() => setIsTransitOpen(true)}
          selectedProduct={selectedProduct}
          setSelectedProduct={setSelectedProduct}
        />
        {isTransitOpen && (
          <AssetTransitModal
            purpose="OTHER"
            mode="manager"
            onConfirmSelection={(fileResIds) => {
              // App.tsx 全局兜底:无业务上下文,仅打日志
              console.log('[Transit] App 全局选中(未消费):', fileResIds);
              setIsTransitOpen(false);
            }}
            onClose={() => setIsTransitOpen(false)}
          />
        )}
      </div>
    );
  }

  // ===== 路由分支：登录页 =====
  if (currentScreen === AppScreen.LOGIN || !isAuthenticated) {
    return (
      <LoginPage
        onSuccess={(target) => setCurrentScreen(target ?? AppScreen.DASHBOARD)}
      />
    );
  }

  // ===== 主分支：登录后的工作台 =====
  return (
    <div className="flex h-screen overflow-hidden bg-bg-base font-sans antialiased text-text-main" id="app-root-container">

      {/* 1. Sidebar Nav */}
      <Sidebar
        currentScreen={currentScreen}
        setScreen={setCurrentScreen}
        users={users}
        currentUser={currentUser}
        setCurrentUser={() => {
          // 切换协作账号角色 —— 当前实现：登出当前账号 + 跳登录页
          // 后端无"切换账号"专用接口，前端统一走 logout 流程
          // 用户在 LoginPage 用新账号重新登录即可
          void logout();
        }}
        openTransit={() => setIsTransitOpen(true)}
      />

      {/* 2. Main Area (Header + Scrollable Body) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header toolbar */}
        <Header
          currentScreen={currentScreen}
          setScreen={setCurrentScreen}
          currentUser={currentUser}
          notifications={notifications}
          markAllAsRead={handleMarkAllNotificationsAsRead}
        />

        {/* Scrollable Workspace panel */}
        <main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-5 sm:pb-24 lg:p-8 lg:pb-8" id="main-content-scroll">
          {renderScreenContent()}
        </main>
      </div>

      {/* 3. Global Modal Overlay: Asset Transit Station */}
      {isTransitOpen && (
        <AssetTransitModal
          purpose="OTHER"
          mode="manager"
          onConfirmSelection={(fileResIds) => {
            // 全局工具模式 —— 没有明确业务上下文,仅打 console 提示用户
            console.log('[Transit] App 全局选中(未消费):', fileResIds);
            setIsTransitOpen(false);
          }}
          onClose={() => setIsTransitOpen(false)}
        />
      )}

    </div>
  );
}
