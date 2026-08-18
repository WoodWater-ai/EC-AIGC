import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppScreen,
  GenerationTask,
  ProductAsset,
  SystemUser,
  SystemNotification,
  type TaskGroupItemResponse,
  type TaskGroupResponse,
  type TaskResultPreviewResponse,
} from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { TaskList } from './components/TaskList';
import { CreateImageTask } from './components/CreateImageTask';
import { CreateVideoTask } from './components/CreateVideoTask';
import TemplateCenter from './components/TemplateCenter';
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
import { ModelLibrary } from './components/ModelLibrary';
import { AssistantPage } from './components/Assistant/AssistantPage';
import type { AssistantTaskPrefill } from './api/modules/assistant';
import {
  ModelProfileCreator,
  type ModelCreatorAsset,
  type ModelCreatorAssetTarget,
} from './components/ModelProfileCreator';

import { useAuth } from './auth/AuthContext';
import { setLoginRequiredHandler } from './api/error';
import { useServiceQuery } from './api/hooks/useServiceQuery';
import { userApi, type UserDTO } from './api/modules/user';
import { taskApi } from './api/modules/task';
import { modelProfileApi, type ModelProfileDTO } from './api/modules/modelProfile';
import { assetApi, type AssetResourceItem } from './api/modules/asset';
import type { ProductSkuView } from './components/productManagement/productManagementModel';
import { toUIGenerationTask } from './components/createTask/taskAdapter';
import { type TaskReusePrefill } from './lib/task/taskReuse';
import { toast } from 'sonner';

import {
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
      userName: '',
      phone: '',
      avatar: '',
      role: '管理员',
      status: 'offline',
      joinedDate: '',
    };
  }
  // 把 roles[0] (string) 映到 SystemUser.role 的字面量联合
  const ROLE_MAP: Record<string, SystemUser['role']> = {
    ADMIN: '管理员',
    OPERATOR: '运营策划',
    DESIGNER: '高级设计师',
    AUDITOR: '协同客户',
    MANAGER: '管理员',
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
    userName: authUser.username || '',
    phone: authUser.phone || '',
    avatar: '', // LoginResponse 无 headUrl
    role: mappedRole ?? ('管理员' as SystemUser['role']),
    status: 'online',
    joinedDate: '',
  };
}

/** 模特资源库分页 pageSize:5 列 × 10 行,与 AssetTransitModal 产品 tab 一致 */
const profilePageSize = 50;

export default function App() {
  const {
    user,
    isAuthenticated,
    initializing,
    logout,
    canAccessScreen,
    firstAccessibleScreen,
  } = useAuth();

  // 初次加载默认 DASHBOARD —— initializing=true 时显示 spinner 不进 switch；
  // initializing=false 后根据 isAuthenticated 决定 LOGIN 还是 DASHBOARD。
  // 旧版本初始值是 LOGIN（依赖 user 未持久化），现在 AuthProvider 会用 /me 恢复 user。
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.DASHBOARD);
  const [highlightGroupId, setHighlightGroupId] = useState<string | null>(null);
  const [highlightTaskKind, setHighlightTaskKind] = useState<'IMAGE' | 'VIDEO'>('IMAGE');
  const [creationTemplateId, setCreationTemplateId] = useState<string | null>(null);
  // 仅在“助手 → 创建任务”的这次跳转中使用；离开创建页即清空，不做草稿恢复。
  const [assistantTaskPrefill, setAssistantTaskPrefill] = useState<AssistantTaskPrefill | null>(null);
  // 从任务结果或产品 SKU 进入创作时，只保留本次临时上下文，不写入草稿。
  const [creationAssetPrefill, setCreationAssetPrefill] = useState<AssetResourceItem | null>(null);
  const [taskReusePrefill, setTaskReusePrefill] = useState<TaskReusePrefill | null>(null);

  const setScreen = (
    screen: AppScreen,
    payload?: { highlightGroupId?: string; creationTemplateId?: string },
  ) => {
    if (!canAccessScreen(screen)) return;
    // 兼容旧资源中心导航调用，统一落到新的素材中心弹窗。
    if (screen === AppScreen.ASSETS) {
      setIsTransitOpen(true);
      return;
    }
    setAssistantTaskPrefill(null);
    setCreationAssetPrefill(null);
    setTaskReusePrefill(null);
    setCurrentScreen(screen);
    if (payload?.highlightGroupId) {
      setHighlightGroupId(payload.highlightGroupId);
    }
    setCreationTemplateId(
      screen === AppScreen.CREATE_IMAGE_TASK || screen === AppScreen.CREATE_VIDEO_TASK
        ? payload?.creationTemplateId ?? null
        : null,
    );
  };

  // 记录"进入创建任务页之前的菜单",onBack 时回到那里。
  // - lastScreenRef 跟踪上一次的 currentScreen(在 useEffect 里维护)
  // - previousScreenRef 只在进入 CREATE_* 时刷新,记录"进入那一刻的上一个菜单"
  const lastScreenRef = useRef<AppScreen>(AppScreen.DASHBOARD);
  const previousScreenRef = useRef<AppScreen>(AppScreen.DASHBOARD);

  useEffect(() => {
    if (
      currentScreen === AppScreen.CREATE_IMAGE_TASK ||
      currentScreen === AppScreen.CREATE_VIDEO_TASK
    ) {
      previousScreenRef.current = lastScreenRef.current;
    }
    lastScreenRef.current = currentScreen;
  }, [currentScreen]);

  const handleBack = () => {
    setAssistantTaskPrefill(null);
    setCreationAssetPrefill(null);
    setTaskReusePrefill(null);
    setCurrentScreen(previousScreenRef.current);
  };

  const continueWithResult = (asset: AssetResourceItem) => {
    const screen = asset.assetKind === 'VIDEO'
      ? AppScreen.CREATE_VIDEO_TASK
      : AppScreen.CREATE_IMAGE_TASK;
    if (!canAccessScreen(screen)) return;
    setAssistantTaskPrefill(null);
    setCreationTemplateId(null);
    setCreationAssetPrefill(asset);
    setTaskReusePrefill(null);
    setCurrentScreen(screen);
  };

  const reuseTask = async (group: TaskGroupResponse, task: TaskGroupItemResponse) => {
    const context = await taskApi.reuseContext(task.id);
    if (context.assets.length === 0) {
      toast.error('该历史任务未记录可复用的原始素材');
      return;
    }

    setAssistantTaskPrefill(null);
    setCreationAssetPrefill(null);
    setCreationTemplateId(null);
    setTaskReusePrefill({
      group: {
        groupId: group.groupId,
        productId: context.productId ?? group.productId,
        productName: group.productName,
      },
      task: context,
      imageAssets: context.assets.filter((asset) => asset.assetKind === 'IMAGE'),
      videoAssets: context.assets.filter((asset) => asset.assetKind === 'VIDEO'),
    });
    setCurrentScreen(context.taskKind === 'VIDEO'
      ? AppScreen.CREATE_VIDEO_TASK
      : AppScreen.CREATE_IMAGE_TASK);
  };

  const createVideoFromTaskResult = async (result: TaskResultPreviewResponse) => {
    const [asset] = await assetApi.resolveGenerated([{
      mediaType: result.mediaType,
      sourceId: result.id,
    }]);
    if (!asset) {
      toast.error('未能将该图片成果转换为视频首帧素材');
      return;
    }
    if (!canAccessScreen(AppScreen.CREATE_VIDEO_TASK)) return;
    setAssistantTaskPrefill(null);
    setCreationTemplateId(null);
    setTaskReusePrefill(null);
    setCreationAssetPrefill(asset);
    setCurrentScreen(AppScreen.CREATE_VIDEO_TASK);
  };

  const createFromProductSku = async (sku: ProductSkuView) => {
    if (!canAccessScreen(AppScreen.CREATE_IMAGE_TASK)) return;
    setAssistantTaskPrefill(null);
    setCreationTemplateId(null);
    setCreationAssetPrefill(null);
    if (sku.imageId) {
      try {
        setCreationAssetPrefill(await assetApi.get(sku.imageId));
      } catch {
        // 商品主图仍会在创建页显示为待选择状态，避免因历史主图无业务资源记录阻断创作。
      }
    }
    setCurrentScreen(AppScreen.CREATE_IMAGE_TASK);
  };

  // Core local states
  const [products, setProducts] = useState<ProductAsset[]>(mockProducts);
  const [notifications, setNotifications] = useState<SystemNotification[]>(mockNotifications);

  // 工作台摘要仍使用 /v1/task/my-page；任务列表页内部使用批次分页接口。
  const tasksQuery = useServiceQuery(
    () => taskApi.myPage({ pageNum: 1, pageSize: 50 }),
    [],
    isAuthenticated,
  );
  const realTasks: GenerationTask[] = useMemo(() => {
    const list = tasksQuery.data?.list ?? [];
    return list.map((r) => toUIGenerationTask(r, products));
  }, [tasksQuery.data, products]);
  const tasks = realTasks;
  useEffect(() => {
    if (tasksQuery.error) {
      console.warn('[App] /v1/task/my-page 加载失败:', tasksQuery.error);
    }
  }, [tasksQuery.error]);

  // 用户列表(Phase 1.5) —— 从真接口 /v1/admin/user/list 拉,SystemUser 映射供 Sidebar 切换协作账号下拉用
  // 注意:useServiceQuery.data 初始为 null,如果用 `data ?? []` 作为 useEffect 依赖,每次渲染会创建新 [] 引用,触发死循环。
  // 修法:用 `data` 本身做依赖(引用稳定),内部 null 短路退出
  const userListQuery = useServiceQuery<UserDTO[]>(
    () => userApi.listAll(),
    [],
    isAuthenticated,
  );
  const [users, setUsers] = useState<SystemUser[]>([]);
  useEffect(() => {
    if (!userListQuery.data) return;
    setUsers(userListQuery.data.map(u => ({
      id: u.id,
      name: u.name || u.userName || u.phone || '(未命名)',
      userName: u.userName || '',
      phone: u.phone || '',
      avatar: u.headUrl || '',
      role: u.isAdmin ? '管理员' : '运营策划',  // P1 TODO:从 roleIds 查角色名
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
  const [modelCreatorOpen, setModelCreatorOpen] = useState(false);
  const [modelAssetTarget, setModelAssetTarget] = useState<ModelCreatorAssetTarget>();
  const [modelAssetConsumer, setModelAssetConsumer] = useState<((assets: ModelCreatorAsset[]) => void)>();
  // ========== 模特资源库分页 state ==========
  const [profileList, setProfileList] = useState<ModelProfileDTO[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [profileTotal, setProfileTotal] = useState(0);
  const [profileAppendError, setProfileAppendError] = useState<Error | null>(null);
  const profileNextPageRef = useRef(2);
  const profileLoadingVersionRef = useRef<number | null>(null);
  const profileQueryVersionRef = useRef(0);
  const profileHasMoreRef = useRef(true);
  const [selectedStyleTag, setSelectedStyleTag] = useState<string | null>(null);

  const modelProfilesQuery = useServiceQuery(
    () => modelProfileApi.page({
      pageNum: 1,
      pageSize: profilePageSize,
      status: 'active',
      styleTag: selectedStyleTag ?? undefined,
    }),
    [selectedStyleTag],
    isAuthenticated,
  );

  // 首屏 useServiceQuery 完成 → 同步到本地 list
  useEffect(() => {
    const data = modelProfilesQuery.data;
    if (!data) return;
    setProfileList(data.list);
    setProfileTotal(data.total);
    const nextHasMore = 1 < data.pages;
    setHasMore(nextHasMore);
    profileHasMoreRef.current = nextHasMore;
    profileNextPageRef.current = 2;
  }, [modelProfilesQuery.data]);

  // 追加下一页
  const loadNextProfilePage = useCallback(async () => {
    if (profileLoadingVersionRef.current !== null || !profileHasMoreRef.current) return;
    const version = profileQueryVersionRef.current;
    profileLoadingVersionRef.current = version;
    setLoadingMore(true);
    setProfileAppendError(null);
    const pageNum = profileNextPageRef.current;
    try {
      const page = await modelProfileApi.page({
        pageNum,
        pageSize: profilePageSize,
        status: 'active',
        styleTag: selectedStyleTag ?? undefined,
      });
      if (version !== profileQueryVersionRef.current) return;
      setProfileList((current) => [
        ...current,
        ...page.list.filter((next) => !current.some((existing) => existing.id === next.id)),
      ]);
      const nextHasMore = pageNum < page.pages;
      profileHasMoreRef.current = nextHasMore;
      profileNextPageRef.current = pageNum + 1;
      setHasMore(nextHasMore);
      setProfileTotal(page.total);
    } catch (error) {
      if (version !== profileQueryVersionRef.current) return;
      setProfileAppendError(error as Error);
    } finally {
      if (version === profileQueryVersionRef.current) {
        profileLoadingVersionRef.current = null;
        setLoadingMore(false);
      }
    }
  }, [selectedStyleTag]);

  const handleProfileFilterChange = useCallback((tag: string) => {
    // 把 FILTERS 文案映射到后端 styleTag:目前 tag 与后端一致,直接传;
    // 后续若不一致在此处加映射表
    const next = tag === '全部' ? null : tag;
    profileQueryVersionRef.current += 1;
    profileLoadingVersionRef.current = null;
    profileNextPageRef.current = 2;
    profileHasMoreRef.current = true;
    setProfileAppendError(null);
    setLoadingMore(false);
    setSelectedStyleTag(next);
    // selectedStyleTag 变化触发 useServiceQuery 重跑
  }, []);

  // 模特导入/发布后:重置分页 state + 触发首屏重拉
  const refetchProfileList = useCallback(() => {
    profileQueryVersionRef.current += 1;
    profileLoadingVersionRef.current = null;
    profileNextPageRef.current = 2;
    profileHasMoreRef.current = true;
    setProfileList([]);
    setProfileAppendError(null);
    setLoadingMore(false);
    setHasMore(true);
    setProfileTotal(0);
    modelProfilesQuery.refetch();
  }, [modelProfilesQuery]);

  const requestModelAsset = (
    target: ModelCreatorAssetTarget,
    onSelected: (assets: ModelCreatorAsset[]) => void,
  ) => {
    setModelAssetTarget(target);
    setModelAssetConsumer(() => onSelected);
    setIsTransitOpen(true);
  };

  useEffect(() => {
    if (isAuthenticated && !canAccessScreen(currentScreen)) {
      setCurrentScreen(firstAccessibleScreen);
    }
  }, [isAuthenticated, currentScreen, canAccessScreen, firstAccessibleScreen]);

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
  const handleAddTask = (info: { groupId: string; taskIds: string[]; taskKind?: 'IMAGE' | 'VIDEO' }) => {
    setHighlightGroupId(info.groupId);
    if (info.taskKind) setHighlightTaskKind(info.taskKind);
    setScreen(AppScreen.TASKS);
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
            currentUser={currentUser}
            setScreen={setScreen}
          />
        );
      case AppScreen.ASSISTANT:
        return (
          <AssistantPage
            onCreateTask={(screen, prefill) => {
              if (!canAccessScreen(screen)) return;
              setAssistantTaskPrefill(prefill);
              setCreationTemplateId(null);
              setCurrentScreen(screen);
            }}
          />
        );
      case AppScreen.TASKS:
        return (
          <TaskList
            highlightGroupId={highlightGroupId}
            highlightTaskKind={highlightTaskKind}
            setScreen={setScreen}
            onContinueWithResult={continueWithResult}
            onRecreateTask={reuseTask}
            onCreateVideoFromResult={createVideoFromTaskResult}
          />
        );
      case AppScreen.CREATE_IMAGE_TASK:
        return null;
      case AppScreen.CREATE_VIDEO_TASK:
        return (
          <div className="p-4 text-center text-slate-400">已在独立窗口打开</div>
        );
      case AppScreen.TEMPLATES:
        return (
          <TemplateCenter setScreen={setScreen} />
        );
      case AppScreen.MODEL_LIBRARY:
        return (
          <ModelLibrary
            profiles={profileList}
            loading={modelProfilesQuery.loading}
            error={modelProfilesQuery.error?.message}
            loadingMore={loadingMore}
            hasMore={hasMore}
            total={profileTotal}
            appendError={profileAppendError}
            onLoadMore={loadNextProfilePage}
            onFilterChange={handleProfileFilterChange}
            onCreateProfile={() => setModelCreatorOpen(true)}
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
          <ResourceCategoryList setScreen={setScreen} />
        );
      case AppScreen.PRODUCT_CATEGORY:
        return (
          <ProductCategoryList setScreen={setScreen} />
        );
      case AppScreen.ASYNC_TASKS:
        return <AsyncTaskList />;
      case AppScreen.PRODUCT_MANAGE:
        return <ProductManagePage onCreateSku={createFromProductSku} />;
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
          onCreateModel={() => setModelCreatorOpen(true)}
          selectedProduct={selectedProduct}
          setSelectedProduct={setSelectedProduct}
          creationTemplateId={creationTemplateId}
          assistantPrefill={assistantTaskPrefill}
          resultAssetPrefill={creationAssetPrefill}
          taskReusePrefill={taskReusePrefill}
          onBack={handleBack}
        />
        {isTransitOpen && (
          <AssetTransitModal
            purpose="OTHER"
            mode={modelAssetConsumer ? 'picker' : 'manager'}
            multiSelect={modelAssetTarget === 'face_merge'}
            onModelImported={refetchProfileList}
            targetSlot={modelAssetTarget ? `model-profile-${modelAssetTarget}` : 'main'}
            onConfirmSelection={(items) => {
              if (modelAssetConsumer && items.length > 0) {
                modelAssetConsumer(items.map((item) => ({
                  id: item.id,
                  name: item.name,
                  url: item.originalUrl ?? item.thumbnailUrl ?? '',
                })));
              }
              setModelAssetConsumer(undefined);
              setModelAssetTarget(undefined);
              setIsTransitOpen(false);
            }}
            onClose={() => {
              setModelAssetConsumer(undefined);
              setModelAssetTarget(undefined);
              setIsTransitOpen(false);
            }}
          />
        )}
        <ModelProfileCreator
          open={modelCreatorOpen}
          onClose={() => setModelCreatorOpen(false)}
          onPublished={refetchProfileList}
          onRequestAsset={requestModelAsset}
        />
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
          creationTemplateId={creationTemplateId}
          assistantPrefill={assistantTaskPrefill}
          resultAssetPrefill={creationAssetPrefill}
          taskReusePrefill={taskReusePrefill}
          goBack={handleBack}
        />
        {isTransitOpen && (
          <AssetTransitModal
            purpose="OTHER"
            mode="manager"
            onModelImported={refetchProfileList}
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
        onSuccess={(target) => setScreen(target ?? firstAccessibleScreen)}
      />
    );
  }

  // ===== 主分支：登录后的工作台 =====
  return (
    <div className="flex h-screen overflow-hidden bg-bg-base font-sans antialiased text-text-main" id="app-root-container">

      {/* 1. Sidebar Nav */}
      <Sidebar
        currentScreen={currentScreen}
        setScreen={setScreen}
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
          setScreen={setScreen}
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
          mode={modelAssetConsumer ? 'picker' : 'manager'}
          multiSelect={modelAssetTarget === 'face_merge'}
          onModelImported={refetchProfileList}
          targetSlot={modelAssetTarget ? `model-profile-${modelAssetTarget}` : 'main'}
          onConfirmSelection={(items) => {
            if (modelAssetConsumer && items.length > 0) {
              modelAssetConsumer(items.map((item) => ({
                id: item.id,
                name: item.name,
                url: item.originalUrl ?? item.thumbnailUrl ?? '',
              })));
            } else {
              console.log('[Transit] App 全局选中(未消费):', items);
            }
            setModelAssetConsumer(undefined);
            setModelAssetTarget(undefined);
            setIsTransitOpen(false);
          }}
          onClose={() => {
            setModelAssetConsumer(undefined);
            setModelAssetTarget(undefined);
            setIsTransitOpen(false);
          }}
        />
      )}

      <ModelProfileCreator
        open={modelCreatorOpen}
        onClose={() => setModelCreatorOpen(false)}
        onPublished={refetchProfileList}
        onRequestAsset={requestModelAsset}
      />

    </div>
  );
}
