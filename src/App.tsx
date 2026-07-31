import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { templatePublishBlockReason } from './templateUtils';
import { AppScreen, GenerationTask, ModelProfile, PendingItem, ProductAsset, ResultTemplate, SystemUser, TaskDetailNavigation, VideoTaskEntryContext } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { TaskList } from './components/TaskList';
import { CreateImageTask } from './components/CreateImageTask';
import { CreateVideoTaskV2 } from './components/CreateVideoTaskV2';
import TemplateCenter from './components/TemplateCenter';
import { ProductAssetLibrary } from './components/ProductAssetLibrary';
import { DataAnalytics } from './components/DataAnalytics';
import { SystemConfig } from './components/SystemConfig';
import { AssetTransitModal } from './components/AssetTransitModal';
import { LoginPage } from './components/LoginPage';
import { ResourceCategoryList } from './components/ResourceCategoryList';
import { AsyncTaskList } from './components/AsyncTaskList';
import { BetaPlaceholder } from './components/BetaPlaceholder';
import { TemplateCenterNew } from './components/beta/TemplateCenterNew';
import { CreateTaskNew } from './components/beta/CreateTaskNew';
import { TaskListNew } from './components/beta/TaskListNew';
import { PromptAssistNew } from './components/beta/PromptAssistNew';
import { RecommendParamsManageNew } from './components/beta/RecommendParamsManageNew';
import { ModelLibrary } from './components/ModelLibrary';
import { ModelProfileCreator, type ModelCreatorAssetTarget } from './components/ModelProfileCreator';

import { useAuth } from './auth/AuthContext';
import { setLoginRequiredHandler } from './api/error';
import { useServiceQuery } from './api/hooks/useServiceQuery';
import { userApi, type UserDTO } from './api/modules/user';
import { isMockRuntime } from './config/runtime';
import type { AssetResourceItem } from './api/modules/asset';

import {
  mockTasks,
  mockProducts,
  mockPendingItems,
  mockResultTemplates,
  mockAssetResources,
  mockModelProfiles,
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
  const { user, isAuthenticated, initializing, logout, hasPermission } = useAuth();

  // 初次加载默认 DASHBOARD —— initializing=true 时显示 spinner 不进 switch；
  // initializing=false 后根据 isAuthenticated 决定 LOGIN 还是 DASHBOARD。
  // 旧版本初始值是 LOGIN（依赖 user 未持久化），现在 AuthProvider 会用 /me 恢复 user。
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.DASHBOARD);

  // Core local states
  const [tasks, setTasks] = useState<GenerationTask[]>(mockTasks);
  const [products, setProducts] = useState<ProductAsset[]>(mockProducts);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>(mockPendingItems);
  const [resultTemplates, setResultTemplates] = useState<ResultTemplate[]>(mockResultTemplates);
  const [favoriteTemplateIds, setFavoriteTemplateIds] = useState<ReadonlySet<string>>(() => new Set());
  const [publishedTemplateTaskIds, setPublishedTemplateTaskIds] = useState<ReadonlySet<string>>(() => new Set());
  const [pendingTemplate, setPendingTemplate] = useState<ResultTemplate | null>(null);
  const [taskDetailNavigation, setTaskDetailNavigation] = useState<TaskDetailNavigation | null>(null);
  const [pendingPanelOpen, setPendingPanelOpen] = useState(false);
  const [modelProfiles, setModelProfiles] = useState<ModelProfile[]>(mockModelProfiles);
  const [runtimeAssets, setRuntimeAssets] = useState<AssetResourceItem[]>(mockAssetResources);
  const [isModelCreatorOpen, setIsModelCreatorOpen] = useState(false);
  const [modelCreatorOrigin, setModelCreatorOrigin] = useState<'library' | 'picker'>('library');

  // 用户列表(Phase 1.5) —— 从真接口 /v1/admin/user/list 拉,SystemUser 映射供 Sidebar 切换协作账号下拉用
  // 注意:useServiceQuery.data 初始为 null,如果用 `data ?? []` 作为 useEffect 依赖,每次渲染会创建新 [] 引用,触发死循环。
  // 修法:用 `data` 本身做依赖(引用稳定),内部 null 短路退出
  const userListQuery = useServiceQuery<UserDTO[]>(
    () => isMockRuntime ? Promise.resolve([]) : userApi.listAll(),
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
  const [transitSelectionHandler, setTransitSelectionHandler] = useState<((assets: AssetResourceItem[]) => void) | null>(null);
  const [transitTargetSlot, setTransitTargetSlot] = useState('main');
  const [transitMultiSelect, setTransitMultiSelect] = useState(false);
  const [videoEntryContext, setVideoEntryContext] = useState<VideoTaskEntryContext>({ kind: 'blank' });

  const navigateToScreen = (screen: AppScreen) => {
    if (screen === AppScreen.CREATE_VIDEO_TASK) setVideoEntryContext({ kind: 'blank' });
    setCurrentScreen(screen);
  };

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

  const handleUpdateUserRole = (userId: string, newRole: any, newDeptId?: string) => {
    setUsers(prev => prev.map(u => u.id === userId
      ? { ...u, role: newRole, ...(newDeptId !== undefined ? { deptId: newDeptId } : {}) }
      : u
    ));
  };

  const handleMarkAllPendingAsRead = () => {
    setPendingItems((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  const openTaskDetail = (target: TaskDetailNavigation) => {
    setTaskDetailNavigation(target);
    setCurrentScreen(AppScreen.TASKS);
  };

  const handlePendingItem = (item: PendingItem) => {
    setPendingItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry));
    setPendingPanelOpen(false);
    if (item.taskId && item.mediaType) {
      openTaskDetail({ taskId: item.taskId, groupId: item.groupId, mediaType: item.mediaType });
      return;
    }
    if (item.targetScreen) setCurrentScreen(item.targetScreen);
  };

  const useResultTemplate = (template: ResultTemplate) => {
    setPendingTemplate(template);
    setCurrentScreen(template.mediaType === 'image' ? AppScreen.CREATE_IMAGE_TASK : AppScreen.CREATE_VIDEO_TASK);
  };

  const toggleTemplateFavorite = (templateId: string) => {
    const isFavorite = favoriteTemplateIds.has(templateId);
    setFavoriteTemplateIds((current) => {
      const next = new Set(current);
      if (next.has(templateId)) next.delete(templateId);
      else next.add(templateId);
      return next;
    });
    setResultTemplates((current) => current.map((template) => template.id === templateId
      ? { ...template, favoriteCount: Math.max(0, template.favoriteCount + (isFavorite ? -1 : 1)) }
      : template));
  };

  const recordTemplateView = (templateId: string) => {
    setResultTemplates((current) => current.map((template) => template.id === templateId
      ? { ...template, viewCount: template.viewCount + 1 }
      : template));
  };

  const publishResultAsTemplate = (task: GenerationTask) => {
    if (publishedTemplateTaskIds.has(task.id)) {
      toast.info('该作品已设为模板');
      return;
    }
    const publishBlockReason = templatePublishBlockReason(task);
    if (publishBlockReason) {
      toast.error(publishBlockReason);
      return;
    }
    const prompt = task.taskPrompt ?? task.params?.prompt;
    if (!prompt) return;
    const result = task.results?.at(-1);
    const template: ResultTemplate = {
      id: `result-template-${Date.now()}`,
      name: `${task.productName} · ${task.type === 'image' ? '图片' : '视频'}模板`,
      mediaType: task.type,
      status: 'active',
      version: 1,
      coverUrl: result?.url ?? task.resultUrl ?? task.productImg,
      previewUrls: [result?.url ?? task.resultUrl ?? task.productImg],
      description: '由已完成作品一键固化，可替换主体商品素材后再次创作。',
      category: '我的作品',
      usage: task.type === 'image' ? '图片 / 结果复用' : '视频 / 结果复用',
      style: '已验证结果',
      creator: currentUser.name,
      usageCount: 0,
      viewCount: 0,
      favoriteCount: 0,
      sourceTaskId: task.id,
      sourceResultId: result?.id,
      sourceProductName: task.productName,
      createdAt: new Date().toISOString(),
      snapshot: {
        prompt,
        negativePrompt: task.negativePrompt ?? task.params?.negativePrompt,
        references: [],
        ratio: task.params?.ratio ?? (task.type === 'image' ? '4:5' : '9:16'),
        resolution: task.params?.resolution ?? (task.type === 'image' ? '2048px' : '1080p'),
        count: task.type === 'image' ? task.params?.count ?? 1 : undefined,
        imageType: task.type === 'image' ? task.imageType ?? 'product_main' : undefined,
        videoMode: task.type === 'video' ? task.params?.mode ?? 'img2video' : undefined,
        duration: task.type === 'video' ? task.params?.duration ?? 8 : undefined,
        motion: task.type === 'video' ? task.params?.motion ?? '适中' : undefined,
        modelName: task.modelSnapshot?.modelName ?? task.modelChannel,
      },
    };
    setResultTemplates((current) => [template, ...current]);
    setPublishedTemplateTaskIds((current) => new Set(current).add(task.id));
    toast.success('已加入模板营地');
  };

  const canPublishTemplate = hasPermission('*') || hasPermission('template:publish');
  const canManageTemplate = hasPermission('*') || hasPermission('template:manage');
  const getTemplateStatusForTask = (taskId: string): ResultTemplate['status'] | undefined => publishedTemplateTaskIds.has(taskId)
    ? resultTemplates.find((template) => template.sourceTaskId === taskId)?.status
    : undefined;
  const toggleTemplateStatus = (taskId: string) => {
    const template = resultTemplates.find((item) => item.sourceTaskId === taskId);
    if (!template) return;
    const nextStatus: ResultTemplate['status'] = template.status === 'active' ? 'disabled' : 'active';
    setResultTemplates((current) => current.map((item) => item.id === template.id ? { ...item, status: nextStatus } : item));
    toast.success(nextStatus === 'active' ? '模板已重新上架' : '模板已下架，不再允许新任务使用');
  };

  const openModelCreator = (origin: 'library' | 'picker') => {
    setModelCreatorOrigin(origin);
    setIsModelCreatorOpen(true);
  };

  const openModelCreatorAssetPicker = (
    target: ModelCreatorAssetTarget,
    onSelected: (asset: { id: string; name: string; url: string }) => void,
  ) => {
    setTransitSelectionHandler(() => (assets) => {
      const asset = assets[0];
      if (!asset) return;
      onSelected({
        id: String(asset.id),
        name: asset.name,
        url: asset.originalUrl ?? asset.thumbnailUrl,
      });
    });
    setTransitTargetSlot(`model-profile-${target}`);
    setTransitMultiSelect(false);
    setIsTransitOpen(true);
  };

  const handleModelProfilePublished = (profile: ModelProfile) => {
    const assetId = Date.now();
    const asset: AssetResourceItem = {
      id: assetId,
      fileResourceId: assetId + 1,
      name: `${profile.name} 模特参考图`,
      assetKind: 'IMAGE',
      originalUrl: profile.image,
      thumbnailUrl: profile.image,
      tags: `模特,${profile.source},${profile.tags.join(',')}`,
      uploadUserId: 1,
      status: 'NORMAL',
      categoryIds: [30],
      createTime: new Date().toISOString(),
    };
    setModelProfiles((current) => [profile, ...current]);
    setRuntimeAssets((current) => [asset, ...current]);
    setIsModelCreatorOpen(false);
    if (modelCreatorOrigin === 'picker') {
      transitSelectionHandler?.([asset]);
      setTransitSelectionHandler(null);
      setIsTransitOpen(false);
    }
  };

  // Render Core content wrapper switcher
  const renderScreenContent = () => {
    switch (currentScreen) {
      case AppScreen.DASHBOARD:
        return (
          <Dashboard
            tasks={tasks}
            templates={resultTemplates}
            pendingItems={pendingItems}
            currentUser={currentUser}
            canPublishTemplate={canPublishTemplate}
            canManageTemplate={canManageTemplate}
            publishedTemplateTaskIds={publishedTemplateTaskIds}
            setScreen={setCurrentScreen}
            onUseTemplate={useResultTemplate}
            favoriteTemplateIds={favoriteTemplateIds}
            onToggleTemplateFavorite={toggleTemplateFavorite}
            onViewTemplate={recordTemplateView}
            onPublishTemplate={publishResultAsTemplate}
            getTemplateStatusForTask={getTemplateStatusForTask}
            onToggleTemplateStatus={toggleTemplateStatus}
            onViewTask={openTaskDetail}
            onOpenPending={() => setPendingPanelOpen(true)}
          />
        );
      case AppScreen.TASKS:
        return (
          <TaskList
            tasks={tasks}
            products={products}
            onUpdateTask={handleUpdateTask}
            setScreen={navigateToScreen}
            detailNavigation={taskDetailNavigation}
            onDetailNavigationHandled={() => setTaskDetailNavigation(null)}
            canPublishTemplate={canPublishTemplate}
            canManageTemplate={canManageTemplate}
            publishedTemplateTaskIds={publishedTemplateTaskIds}
            onPublishTemplate={publishResultAsTemplate}
            getTemplateStatusForTask={getTemplateStatusForTask}
            onToggleTemplateStatus={toggleTemplateStatus}
            onCreateVideo={(source) => {
              const context: VideoTaskEntryContext = 'kind' in source ? source : {
                kind: 'approved-image',
                sourceTask: source,
                sourceResult: source.results?.[0] ?? { id: `${source.id}-result-1`, url: source.resultUrl ?? source.productImg, version: 1, reviewStage: 'approved' },
              };
              setVideoEntryContext(context);
              if (context.kind === 'approved-image') {
                setSelectedProduct(products.find((product) => product.name === context.sourceTask.productName) ?? selectedProduct);
              }
              setCurrentScreen(AppScreen.CREATE_VIDEO_TASK);
            }}
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
          <TemplateCenter setScreen={navigateToScreen} />
        );
      case AppScreen.ASSETS:
        return (
          <ProductAssetLibrary
            products={products}
            selectedProduct={selectedProduct}
            setSelectedProduct={setSelectedProduct}
            isDrawerOpen={isProductDrawerOpen}
            setIsDrawerOpen={setIsProductDrawerOpen}
            setScreen={navigateToScreen}
          />
        );
      case AppScreen.MODEL_LIBRARY:
        return <ModelLibrary profiles={modelProfiles} onCreateProfile={() => openModelCreator('library')} />;
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
          <ResourceCategoryList setScreen={navigateToScreen} />
        );
      case AppScreen.ASYNC_TASKS:
        return <AsyncTaskList />;
      // ===== [v2.0 2026-07-13 F2 落地] 智能模版中心-新 真实页面 =====
      // D3 模版绑 channelType+capability+model,D5 推荐参数 Tab,D7 用此模版按钮
      case AppScreen.TEMPLATE_CENTER_NEW:
        return <TemplateCenterNew setScreen={setCurrentScreen} />;
      case AppScreen.TASK_LIST_NEW:
        return <TaskListNew />;
      case AppScreen.RECOMMEND_PARAMS_MANAGE_NEW:
        return <RecommendParamsManageNew />;
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
          setScreen={navigateToScreen}
          openTransit={(onConfirmSelection, targetSlot = 'main') => {
            setTransitSelectionHandler(() => onConfirmSelection);
            setTransitTargetSlot(targetSlot);
            setTransitMultiSelect(false);
            setIsTransitOpen(true);
          }}
          selectedProduct={selectedProduct}
          setSelectedProduct={setSelectedProduct}
          templates={resultTemplates}
          selectedTemplate={pendingTemplate?.mediaType === 'image' ? pendingTemplate : null}
          onTemplateApplied={() => setPendingTemplate(null)}
        />
        {isTransitOpen && (
          <AssetTransitModal
            purpose="OTHER"
            targetSlot={transitTargetSlot}
            multiSelect={transitMultiSelect}
            mockAssets={runtimeAssets}
            onCreateModel={transitTargetSlot === 'reference-model' ? () => openModelCreator('picker') : undefined}
            onConfirmSelection={(assets) => {
              transitSelectionHandler?.(assets);
              setTransitSelectionHandler(null);
              setIsTransitOpen(false);
            }}
            onClose={() => setIsTransitOpen(false)}
          />
        )}
        <ModelProfileCreator
          open={isModelCreatorOpen}
          onClose={() => setIsModelCreatorOpen(false)}
          onPublished={handleModelProfilePublished}
          onRequestAsset={openModelCreatorAssetPicker}
        />
      </div>
    );
  }

  if (currentScreen === AppScreen.CREATE_VIDEO_TASK) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-white">
        <CreateVideoTaskV2
          products={products}
          onAddTask={handleAddTask}
          setScreen={navigateToScreen}
          openTransit={(onConfirmSelection, targetSlot = 'main', multiSelect = false) => {
            setTransitSelectionHandler(() => onConfirmSelection);
            setTransitTargetSlot(targetSlot);
            setTransitMultiSelect(multiSelect);
            setIsTransitOpen(true);
          }}
          selectedProduct={selectedProduct}
          setSelectedProduct={setSelectedProduct}
          entryContext={videoEntryContext}
          templates={resultTemplates}
          selectedTemplate={pendingTemplate?.mediaType === 'video' ? pendingTemplate : null}
          onTemplateApplied={() => setPendingTemplate(null)}
        />
        {isTransitOpen && (
          <AssetTransitModal
            purpose="OTHER"
            targetSlot={transitTargetSlot}
            multiSelect={transitMultiSelect}
            mockAssets={runtimeAssets}
            onConfirmSelection={(assets) => {
              transitSelectionHandler?.(assets);
              setTransitSelectionHandler(null);
              setIsTransitOpen(false);
            }}
            onClose={() => setIsTransitOpen(false)}
          />
        )}
      </div>
    );
  }

  // ===== [v2.0 2026-07-13 F2 落地] 新建任务-新 真实页面 =====
  // D1 B v2 方案:统一 CreateTask · 3 group(去 TEXT)· 5 步能力驱动流程
  // [F3 集成] 传 setScreen 给 AI 帮我写 prompt-新 跳转
  if (currentScreen === AppScreen.CREATE_TASK_NEW) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-white">
        <CreateTaskNew setScreen={setCurrentScreen} />
      </div>
    );
  }

  // ===== [v2.0 2026-07-13 F3 落地] AI 帮我写 prompt-新 全屏独立页 =====
  // D6 TEXT 能力独立功能
  if (currentScreen === AppScreen.PROMPT_ASSIST_NEW) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-white">
        <PromptAssistNew onBack={() => setCurrentScreen(AppScreen.CREATE_TASK_NEW)} />
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
        setScreen={navigateToScreen}
        users={users}
        currentUser={currentUser}
        setCurrentUser={() => {
          // 切换协作账号角色 —— 当前实现：登出当前账号 + 跳登录页
          // 后端无"切换账号"专用接口，前端统一走 logout 流程
          // 用户在 LoginPage 用新账号重新登录即可
          void logout();
        }}
        openTransit={(targetSlot = 'main') => {
          setTransitSelectionHandler(null);
          setTransitTargetSlot(targetSlot);
          setIsTransitOpen(true);
        }}
      />

      {/* 2. Main Area (Header + Scrollable Body) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header toolbar */}
        <Header
          currentScreen={currentScreen}
          setScreen={navigateToScreen}
          currentUser={currentUser}
          pendingItems={pendingItems}
          pendingPanelOpen={pendingPanelOpen}
          setPendingPanelOpen={setPendingPanelOpen}
          markAllAsRead={handleMarkAllPendingAsRead}
          onPendingItemClick={handlePendingItem}
        />

        {/* Scrollable Workspace panel */}
        <main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-5 sm:pb-24 lg:p-8" id="main-content-scroll">
          {renderScreenContent()}
        </main>
      </div>

      {/* 3. Global Modal Overlay: Asset Transit Station */}
      {isTransitOpen && (
        <AssetTransitModal
          purpose="OTHER"
          mode={transitSelectionHandler ? 'picker' : 'manager'}
          targetSlot={transitTargetSlot}
          multiSelect={transitMultiSelect}
          mockAssets={runtimeAssets}
          onConfirmSelection={(assets) => {
            transitSelectionHandler?.(assets);
            setTransitSelectionHandler(null);
            setIsTransitOpen(false);
          }}
          onClose={() => setIsTransitOpen(false)}
        />
      )}

      <ModelProfileCreator
        open={isModelCreatorOpen}
        onClose={() => setIsModelCreatorOpen(false)}
        onPublished={handleModelProfilePublished}
        onRequestAsset={openModelCreatorAssetPicker}
      />

    </div>
  );
}
