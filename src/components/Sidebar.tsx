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

export const Sidebar: React.FC<SidebarProps> = ({
  currentScreen,
  setScreen,
  currentUser,
  openTransit
}) => {
  const { canAccessScreen, hasPermission } = useAuth();
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);

  const menuItems = [
    { screen: AppScreen.DASHBOARD, label: '工作台首页', icon: 'dashboard' },
    { screen: AppScreen.ASSISTANT, label: '创作助手', icon: 'auto_awesome' },
    { screen: AppScreen.TASKS, label: '任务列表', icon: 'auto_schedule' },
    { screen: AppScreen.TEMPLATES, label: '智能模板中心', icon: 'dashboard_customize' },
    { screen: AppScreen.ASSETS, label: '商品素材库', icon: 'inventory_2' },
    { screen: AppScreen.ANALYTICS, label: '数据效能复盘', icon: 'insights' },
    { screen: AppScreen.SYSTEM_CONFIG, label: '系统配置模块', icon: 'settings_applications' },
    { screen: AppScreen.ASYNC_TASKS, label: '通道异步任务', icon: 'sync_alt' },
    { screen: AppScreen.ASSET_CATEGORY, label: '资源分类', icon: 'account_tree' },
    { screen: AppScreen.PRODUCT_CATEGORY, label: '商品分类', icon: 'category' },
    { screen: AppScreen.PRODUCT_MANAGE, label: '产品管理', icon: 'inventory_2' },
    { screen: AppScreen.DICT_CATEGORY, label: '字典分类管理', icon: 'dataset' },
    { screen: AppScreen.DICT_ITEM, label: '字典管理', icon: 'menu_book' },
  ];

  const visibleMenuItems = menuItems.filter((item) => canAccessScreen(item.screen));
  const mobileMenuItems = visibleMenuItems.filter((item) =>
    [AppScreen.DASHBOARD, AppScreen.ASSISTANT, AppScreen.TASKS, AppScreen.ASSETS].includes(item.screen)
  );
  const canCreateTask = hasPermission('task:create');
  const canOpenResourceCenter = hasPermission('asset-center:view');

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

        {/* Menu Items List */}
        <nav className="space-y-0.5 px-2">
          <span className="mb-1.5 block px-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-stone-500">主模块</span>
          {visibleMenuItems.map((item) => {
            const isActive = currentScreen === item.screen;
            return (
              <button
                key={item.screen}
                onClick={() => setScreen(item.screen)}
                className={`group flex h-9 w-full cursor-pointer items-center justify-between rounded-md px-2.5 text-left text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[#37322e] text-white'
                    : 'text-stone-400 hover:bg-[#2a2724] hover:text-stone-100'
                }`}
                id={`menu-item-${item.screen.toLowerCase()}`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`material-symbols-outlined text-[17px] transition-colors ${
                    isActive ? 'text-primary' : 'text-stone-500 group-hover:text-stone-300'
                  }`}>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </div>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Shortcuts / Utilities */}
        <div className="mt-5 px-2">
          <span className="mb-1.5 block px-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-stone-500">快捷工具</span>
          {canOpenResourceCenter && <button
            onClick={openTransit}
            className="flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-xs font-medium text-stone-400 transition-all duration-150 hover:bg-[#2a2724] hover:text-stone-100"
          >
            <span className="material-symbols-outlined text-lg text-stone-500">grid_view</span>
            资源中心
          </button>}
          {canAccessScreen(AppScreen.MODEL_LIBRARY) && <button
            onClick={() => setScreen(AppScreen.MODEL_LIBRARY)}
            className={`group flex h-8 w-full cursor-pointer items-center justify-between rounded-md px-2.5 text-xs font-medium transition-all duration-150 ${
              currentScreen === AppScreen.MODEL_LIBRARY
                ? 'bg-[#37322e] text-white'
                : 'text-stone-400 hover:bg-[#2a2724] hover:text-stone-100'
            }`}
            id={`menu-item-${AppScreen.MODEL_LIBRARY.toLowerCase()}`}
          >
            <div className="flex items-center gap-2.5">
              <span className={`material-symbols-outlined text-lg ${
                currentScreen === AppScreen.MODEL_LIBRARY
                  ? 'text-primary'
                  : 'text-stone-500 group-hover:text-stone-300'
              }`}>
                face_3
              </span>
              模特资源库
            </div>
            {currentScreen === AppScreen.MODEL_LIBRARY && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            )}
          </button>}
        </div>
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
            {item.label.replace('工作台首页', '首页').replace('智能模板中心', '模板').replace('商品素材库', '素材')}
          </button>
        );
      })}
    </nav>
    </>
  );
};
