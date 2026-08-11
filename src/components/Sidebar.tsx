import React, { useState } from 'react';
import { AppScreen, SystemUser } from '../types';
import { useAuth } from '../auth/AuthContext';

interface SidebarProps {
  currentScreen: AppScreen;
  setScreen: (screen: AppScreen) => void;
  users: SystemUser[];
  currentUser: SystemUser;
  setCurrentUser: (user: SystemUser) => void;
  openTransit: () => void;
}

type SidebarGroup = '主控' | '创作' | '业务' | '管理';

interface SidebarItem {
  screen: AppScreen;
  label: string;
  icon: string;
  group: SidebarGroup;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentScreen,
  setScreen,
  currentUser,
  openTransit
}) => {
  const { canAccessScreen, hasPermission } = useAuth();
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);

  // 日常创作只保留主链路；基础数据与运维能力收进管理员“管理”分组。
  const menuItems: SidebarItem[] = [
    { screen: AppScreen.DASHBOARD, label: '首页', icon: 'dashboard', group: '主控' },
    { screen: AppScreen.ASSISTANT, label: '创作', icon: 'auto_awesome', group: '创作' },
    { screen: AppScreen.TASKS, label: '任务', icon: 'auto_schedule', group: '创作' },
    { screen: AppScreen.TEMPLATES, label: '模板', icon: 'dashboard_customize', group: '创作' },
    { screen: AppScreen.PRODUCT_MANAGE, label: '产品', icon: 'inventory_2', group: '业务' },
    { screen: AppScreen.ANALYTICS, label: '复盘', icon: 'insights', group: '业务' },
    { screen: AppScreen.DICT_ITEM, label: '字典', icon: 'menu_book', group: '管理' },
    { screen: AppScreen.DICT_CATEGORY, label: '字典类', icon: 'dataset', group: '管理' },
    { screen: AppScreen.ASSET_CATEGORY, label: '素材类', icon: 'account_tree', group: '管理' },
    { screen: AppScreen.PRODUCT_CATEGORY, label: '商品类', icon: 'category', group: '管理' },
    { screen: AppScreen.ASYNC_TASKS, label: '异步', icon: 'sync_alt', group: '管理' },
    { screen: AppScreen.SYSTEM_CONFIG, label: '系统', icon: 'settings_applications', group: '管理' },
  ];

  const visibleMenuItems = menuItems.filter((item) => canAccessScreen(item.screen));
  const mobileMenuItems = visibleMenuItems.filter((item) =>
    [AppScreen.DASHBOARD, AppScreen.ASSISTANT, AppScreen.TASKS].includes(item.screen)
  );
  const canCreateTask = hasPermission('task:create');
  // 新旧权限并存期间，具备旧“资源页”权限的账号也应能打开统一素材中心。
  const canOpenResourceCenter = hasPermission('asset-center:view') || canAccessScreen(AppScreen.ASSETS);

  const renderMenuItem = (item: SidebarItem) => {
    const isActive = currentScreen === item.screen;
    return (
      <button
        key={item.screen}
        type="button"
        onClick={() => setScreen(item.screen)}
        className={`group flex h-9 w-full cursor-pointer items-center justify-between rounded-md px-2.5 text-left text-xs font-medium transition-all duration-150 ${
          isActive
            ? 'bg-[#37322e] text-white'
            : 'text-stone-400 hover:bg-[#2a2724] hover:text-stone-100'
        }`}
        id={`menu-item-${item.screen.toLowerCase()}`}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className={`material-symbols-outlined text-[17px] transition-colors ${
            isActive ? 'text-primary' : 'text-stone-500 group-hover:text-stone-300'
          }`}>{item.icon}</span>
          <span className="truncate">{item.label}</span>
        </span>
        {isActive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
      </button>
    );
  };

  return (
    <>
    <aside className="hidden h-screen w-56 shrink-0 flex-col justify-between overflow-y-auto border-r border-[#302d29] bg-bg-dark text-stone-300 select-none lg:flex">
      {/* Top Brand Section */}
      <div>
        <div className="border-b border-[#302d29] p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary shadow-[3px_3px_0_rgba(216,92,66,0.22)]">
              <span className="material-symbols-outlined text-lg font-bold text-white">blur_on</span>
            </div>
            <div>
              <h1 className="font-display text-[13px] font-bold leading-none tracking-wide text-white">达芬奇密码 AI</h1>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-stone-500">WORKBENCH</span>
            </div>
          </div>
        </div>

        {/* Global Action Button with dropdown */}
        {canCreateTask && <div className="relative p-3">
          <button
            onClick={() => setShowCreateDropdown(!showCreateDropdown)}
            className="flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary text-xs font-bold text-white shadow-[0_6px_16px_rgba(216,92,66,0.18)] transition-all duration-150 hover:bg-primary-hover active:scale-[0.98]"
            id="sidebar-create-btn"
          >
            <span className="material-symbols-outlined text-lg">add_circle</span>
            新建创作
            <span className="material-symbols-outlined text-[15px] transition-transform duration-200" style={{ transform: showCreateDropdown ? 'rotate(180deg)' : 'rotate(0)' }}>keyboard_arrow_down</span>
          </button>

          {showCreateDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowCreateDropdown(false)} />
              <div className="absolute left-3 right-3 top-14 z-50 animate-fadeIn rounded-md border border-[#48423d] bg-[#302d29] p-1.5 text-xs text-stone-300 shadow-2xl">
                <button
                  onClick={() => {
                    setScreen(AppScreen.CREATE_IMAGE_TASK);
                    setShowCreateDropdown(false);
                  }}
                  className="group flex w-full cursor-pointer gap-2.5 rounded-md p-2.5 text-left transition-all hover:bg-[#403a35]"
                >
                  <span className="material-symbols-outlined text-primary text-lg group-hover:scale-110 transition-transform">image</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-[11px]">新建图片生成任务</p>
                    <p className="mt-0.5 truncate text-[9px] text-stone-500">多维智能模板背景融合合成</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setScreen(AppScreen.CREATE_VIDEO_TASK);
                    setShowCreateDropdown(false);
                  }}
                  className="group mt-1 flex w-full cursor-pointer gap-2.5 rounded-md p-2.5 text-left transition-all hover:bg-[#403a35]"
                >
                  <span className="material-symbols-outlined text-success text-lg group-hover:scale-110 transition-transform">video_library</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-[11px]">新建视频生成任务</p>
                    <p className="mt-0.5 truncate text-[9px] text-stone-500">分镜脚本多层轨道动感视频</p>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>}

        {/* 侧栏按创作主线分组；素材仅保留统一资源中心入口。 */}
        <nav className="space-y-4 px-2">
          {(['主控', '创作', '业务', '管理'] as SidebarGroup[]).map((group) => {
            const items = visibleMenuItems.filter((item) => item.group === group);
            if (group === '创作' && canOpenResourceCenter) {
              return (
                <div key={group}>
                  <span className="mb-1.5 block px-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-stone-500">{group}</span>
                  {items.map((item) => renderMenuItem(item))}
                  <button
                    type="button"
                    onClick={openTransit}
                    className="group flex h-9 w-full cursor-pointer items-center justify-between rounded-md px-2.5 text-left text-xs font-medium text-stone-400 transition-all duration-150 hover:bg-[#2a2724] hover:text-stone-100"
                    id="menu-item-assets"
                  >
                    <span className="flex min-w-0 items-center gap-2.5"><span className="material-symbols-outlined text-[17px] text-stone-500 transition-colors group-hover:text-stone-300">inventory_2</span><span>素材</span></span>
                  </button>
                  {canAccessScreen(AppScreen.MODEL_LIBRARY) && renderMenuItem({ screen: AppScreen.MODEL_LIBRARY, label: '模特', icon: 'face_3', group: '创作' })}
                </div>
              );
            }
            return items.length > 0 ? (
              <div key={group}>
                <span className="mb-1.5 block px-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-stone-500">{group}</span>
                {items.map((item) => renderMenuItem(item))}
              </div>
            ) : null;
          })}
        </nav>

      </div>

      {/* 当前登录账号只读展示；真实 RBAC 不允许在前端切换成其他账号。 */}
      <div className="border-t border-[#302d29] bg-[#191816] p-3">
        <div className="flex items-center gap-2.5 rounded-md p-2">
            <div className="relative">
              <img
                src={currentUser.avatar || undefined}
                alt={currentUser.name}
                className="h-8 w-8 rounded-full border border-[#48423d] object-cover"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-bg-dark bg-success" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="mb-1 truncate text-xs font-bold leading-none text-white">{currentUser.name}</p>
              <p className="truncate text-[10px] leading-none text-stone-400">{currentUser.role}</p>
            </div>
        </div>
      </div>
    </aside>
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[68px] items-center justify-around border-t border-border-main bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0px)] shadow-[0_-8px_24px_rgba(53,44,37,0.08)] backdrop-blur lg:hidden" aria-label="移动端主导航">
      {mobileMenuItems.map((item) => {
        const isActive = currentScreen === item.screen;
        return (
          <button
            key={item.screen}
            onClick={() => setScreen(item.screen)}
            className={`flex min-w-14 flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-[10px] font-bold transition-colors ${
              isActive ? 'text-primary' : 'text-stone-400'
            }`}
          >
            <span className={`material-symbols-outlined text-[21px] ${isActive ? 'text-primary' : 'text-stone-500'}`}>
              {item.icon}
            </span>
            {item.label}
          </button>
        );
      })}
      {canOpenResourceCenter && (
        <button
          type="button"
          onClick={openTransit}
          className="flex min-w-14 flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-[10px] font-bold text-stone-400 transition-colors"
        >
          <span className="material-symbols-outlined text-[21px] text-stone-500">inventory_2</span>
          素材
        </button>
      )}
    </nav>
    </>
  );
};
