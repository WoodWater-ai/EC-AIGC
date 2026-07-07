import { useEffect, useState } from 'react';
import { AppScreen, GenerationTask, AdTemplate, ProductAsset, SystemUser, SystemNotification, ModelChannel } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { TaskList } from './components/TaskList';
import { CreateImageTask } from './components/CreateImageTask';
import { CreateVideoTask } from './components/CreateVideoTask';
import { TemplateCenter } from './components/TemplateCenter';
import { ProductAssetLibrary } from './components/ProductAssetLibrary';
import { DataAnalytics } from './components/DataAnalytics';
import { SystemConfig } from './components/SystemConfig';
import { AssetTransitModal } from './components/AssetTransitModal';
import { LoginPage } from './components/LoginPage';

import { useAuth } from './auth/AuthContext';
import { setLoginRequiredHandler } from './api/error';

import {
  mockTasks,
  mockProducts,
  mockTemplates,
  mockModelChannels,
  mockUsers,
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
  const { user, isAuthenticated, logout } = useAuth();

  // 初次加载直接 LOGIN（user 暂未持久化，刷新需重新登录 — 待 /me 接口接入后改造）
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.LOGIN);

  // Core local states
  const [tasks, setTasks] = useState<GenerationTask[]>(mockTasks);
  const [products, setProducts] = useState<ProductAsset[]>(mockProducts);
  const [templates, setTemplates] = useState<AdTemplate[]>(mockTemplates);
  const [channels, setChannels] = useState<ModelChannel[]>(mockModelChannels);
  const [users, setUsers] = useState<SystemUser[]>(mockUsers);
  const [notifications, setNotifications] = useState<SystemNotification[]>(mockNotifications);

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

  /**
   * 未登录自动跳 LOGIN
   *
   * 触发场景：
   * - 初始加载（currentScreen 初始 LOGIN，不会触发）
   * - 主动登出后
   * - token 被 clear（虽然 A0102xx 已经会 setScreen(LOGIN)，这里是双保险）
   */
  useEffect(() => {
    if (!isAuthenticated && currentScreen !== AppScreen.LOGIN) {
      setCurrentScreen(AppScreen.LOGIN);
    }
  }, [isAuthenticated, currentScreen]);

  // State Mutators
  const handleAddTask = (newTask: GenerationTask) => {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === newTask.id);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx] = newTask;
        return updated;
      }
      return [newTask, ...prev];
    });
  };

  const handleUpdateTask = (updatedTask: GenerationTask) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
  };

  const handleAddTemplate = (newTemp: AdTemplate) => {
    setTemplates(prev => [newTemp, ...prev]);
  };

  const handleUpdateTemplate = (updatedTemp: AdTemplate) => {
    setTemplates(prev => prev.map(t => t.id === updatedTemp.id ? updatedTemp : t));
  };

  const handleToggleChannel = (id: string) => {
    setChannels(prev => prev.map(ch => {
      if (ch.id !== id) return ch;
      return { ...ch, status: ch.status === 'active' ? 'inactive' : 'active' };
    }));
  };

  const handleUpdateUserRole = (userId: string, newRole: any) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
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
            setScreen={setCurrentScreen}
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
          <TemplateCenter
            templates={templates}
            onAddTemplate={handleAddTemplate}
            onUpdateTemplate={handleUpdateTemplate}
            setScreen={setCurrentScreen}
          />
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
            channels={channels}
            users={users}
            onToggleChannel={handleToggleChannel}
            onUpdateUserRole={handleUpdateUserRole}
          />
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2">construction</span>
            页面正在施工中
          </div>
        );
    }
  };

  // ===== 路由分支：CREATE_* 任务页 =====
  if (currentScreen === AppScreen.CREATE_IMAGE_TASK) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-white">
        <CreateImageTask
          products={products}
          templates={templates}
          onAddTask={handleAddTask}
          setScreen={setCurrentScreen}
          openTransit={() => setIsTransitOpen(true)}
          selectedProduct={selectedProduct}
          setSelectedProduct={setSelectedProduct}
        />
        {isTransitOpen && (
          <AssetTransitModal
            products={products}
            selectedProduct={selectedProduct}
            onSelectProduct={setSelectedProduct}
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
          templates={templates}
          onAddTask={handleAddTask}
          setScreen={setCurrentScreen}
          openTransit={() => setIsTransitOpen(true)}
          selectedProduct={selectedProduct}
          setSelectedProduct={setSelectedProduct}
        />
        {isTransitOpen && (
          <AssetTransitModal
            products={products}
            selectedProduct={selectedProduct}
            onSelectProduct={setSelectedProduct}
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
    <div className="flex h-screen overflow-hidden bg-bg-base font-sans antialiased text-[#0B1C30]" id="app-root-container">

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
        <main className="flex-1 overflow-y-auto p-6 md:p-8" id="main-content-scroll">
          {renderScreenContent()}
        </main>
      </div>

      {/* 3. Global Modal Overlay: Asset Transit Station */}
      {isTransitOpen && (
        <AssetTransitModal
          products={products}
          selectedProduct={selectedProduct}
          onSelectProduct={setSelectedProduct}
          onClose={() => setIsTransitOpen(false)}
        />
      )}

    </div>
  );
}