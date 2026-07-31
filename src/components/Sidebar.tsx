import React, { useState } from 'react';
import { AppScreen, SystemUser } from '../types';

interface SidebarProps {
  currentScreen: AppScreen;
  setScreen: (screen: AppScreen) => void;
  users: SystemUser[];
  currentUser: SystemUser;
  setCurrentUser: (user: SystemUser) => void;
  openTransit: (targetSlot?: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentScreen,
  setScreen,
  users,
  currentUser,
  setCurrentUser,
  openTransit
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);

  const menuItems = [
    { screen: AppScreen.DASHBOARD, label: '工作台首页', icon: 'dashboard' },
    { screen: AppScreen.TASKS, label: '任务列表', icon: 'auto_schedule' },
    { screen: AppScreen.TEMPLATES, label: '智能模板中心', icon: 'dashboard_customize' },
    { screen: AppScreen.ASSETS, label: '商品素材库', icon: 'inventory_2' },
    { screen: AppScreen.MODEL_LIBRARY, label: '模特资源库', icon: 'face_3' },
    { screen: AppScreen.ANALYTICS, label: '数据效能复盘', icon: 'insights' },
    { screen: AppScreen.SYSTEM_CONFIG, label: '系统配置模块', icon: 'settings_applications' },
    ...(currentUser.role === '管理员' ? [
      { screen: AppScreen.ASYNC_TASKS, label: '通道异步任务', icon: 'sync_alt' },
      { screen: AppScreen.ASSET_CATEGORY, label: '资源分类', icon: 'account_tree' },
    ] : []),
  ];

  // ===== [v2.0 2026-07-13 F1 基础设施] 新流程尝试 · 5 个 BETA 页面 =====
  // 与老菜单并存,老 URL/老 setScreen 行为 0 改动。
  // 后端 API 复用(后端 2 个新 API 由 F4 PR 同步推进)。
  const betaMenuItems = [
    { screen: AppScreen.TEMPLATE_CENTER_NEW, label: '智能模版中心-新', icon: 'dashboard_customize' },
    { screen: AppScreen.CREATE_TASK_NEW, label: '新建任务-新', icon: 'add_circle' },
    { screen: AppScreen.TASK_LIST_NEW, label: '任务列表-新', icon: 'auto_schedule' },
    { screen: AppScreen.PROMPT_ASSIST_NEW, label: 'AI 帮我写 prompt-新', icon: 'auto_awesome' },
    { screen: AppScreen.RECOMMEND_PARAMS_MANAGE_NEW, label: '推荐参数管理-新', icon: 'tune' },
  ];

  const mobileMenuItems = menuItems.filter((item) => [AppScreen.DASHBOARD, AppScreen.TASKS, AppScreen.TEMPLATES, AppScreen.ASSETS].includes(item.screen));

  return <>
    <aside className="hidden h-screen w-56 shrink-0 flex-col justify-between overflow-y-auto border-r border-[#302d29] bg-[#201f1d] text-stone-300 select-none lg:flex">
      {/* Top Brand Section */}
      <div>
        <div className="border-b border-[#302d29] p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary shadow-[3px_3px_0_rgba(59,130,246,0.22)]">
              <span className="material-symbols-outlined text-lg font-bold text-white">blur_on</span>
            </div>
            <div>
              <h1 className="font-display text-[13px] font-bold leading-none tracking-wide text-white">达芬奇密码 AI</h1>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-stone-500">WORKBENCH</span>
            </div>
          </div>
        </div>

        {/* Global Action Button with dropdown */}
        <div className="relative p-3">
          <button
            onClick={() => setShowCreateDropdown(!showCreateDropdown)}
            className="flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary text-xs font-bold text-white shadow-[0_6px_16px_rgba(2,86,255,0.18)] transition-all duration-150 hover:bg-primary/90 active:scale-[0.98]"
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
        </div>

        {/* Menu Items List */}
        <nav className="space-y-0.5 px-2">
          <span className="mb-1.5 block px-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-stone-500">主模块</span>
          {menuItems.map((item) => {
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
          <button
            onClick={() => openTransit()}
            className="flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-xs font-medium text-stone-400 transition-all duration-150 hover:bg-[#2a2724] hover:text-stone-100"
          >
            <span className="material-symbols-outlined text-lg text-stone-500">grid_view</span>
            资源中心
          </button>
          <button
            onClick={() => setScreen(AppScreen.MODEL_LIBRARY)}
            className="mt-0.5 flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-xs font-medium text-stone-400 transition-all duration-150 hover:bg-[#2a2724] hover:text-stone-100"
          >
            <span className="material-symbols-outlined text-lg text-stone-500">face_3</span>
            模特资源库
          </button>
        </div>

        {/* [v2.0 2026-07-13 F1 基础设施] 新流程尝试 · 5 个 BETA 菜单 */}
        <div className="mt-5 px-2">
          <div className="mb-1.5 flex items-center justify-between px-2.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-stone-500">新流程</span>
            <span className="rounded bg-rose-400/10 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-rose-400">BETA</span>
          </div>
          {betaMenuItems.map((item) => {
            const isActive = currentScreen === item.screen;
            return (
              <button
                key={item.screen}
                onClick={() => setScreen(item.screen)}
                className={`group flex h-8 w-full cursor-pointer items-center justify-between rounded-md px-2.5 text-left text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-rose-500/10 text-rose-300'
                    : 'text-stone-400 hover:bg-[#2a2724] hover:text-stone-100'
                }`}
                id={`beta-menu-${item.screen.toLowerCase()}`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`material-symbols-outlined text-[17px] transition-colors ${
                    isActive ? 'text-rose-400' : 'text-stone-500 group-hover:text-stone-300'
                  }`}>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </div>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* User Session Swapper Section */}
      <div className="border-t border-[#302d29] bg-[#191816] p-3">
        <div className="relative">
          {showUserDropdown && (
            <div className="absolute bottom-12 left-0 z-50 w-full rounded-md border border-[#48423d] bg-[#302d29] p-2 shadow-xl">
              <span className="mb-1 block border-b border-[#48423d] px-2 pb-1.5 text-[10px] text-stone-500">切换协作账号角色</span>
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setCurrentUser(u);
                    setShowUserDropdown(false);
                  }}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-all ${
                    currentUser.id === u.id ? 'bg-[#403a35] text-white' : 'text-stone-300 hover:bg-[#403a35]'
                  }`}
                >
                  <img src={u.avatar} alt={u.name} className="w-7 h-7 rounded-full object-cover" referrerPolicy="no-referrer" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{u.name}</p>
                    <p className="text-[10px] text-stone-500">{u.role}</p>
                  </div>
                  {currentUser.id === u.id && (
                    <span className="material-symbols-outlined text-success text-sm font-bold">check</span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex cursor-pointer items-center gap-2.5 rounded-md p-2 transition-all duration-150 hover:bg-[#2a2724]"
          >
            <div className="relative">
              <img
                src={currentUser.avatar || undefined}
                alt={currentUser.name}
                className="h-8 w-8 rounded-full border border-[#48423d] object-cover"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#201f1d] bg-success" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="mb-1 truncate text-xs font-bold leading-none text-white">{currentUser.name}</p>
                <span className="material-symbols-outlined text-xs text-stone-500">unfold_more</span>
              </div>
              <p className="truncate text-[10px] leading-none text-stone-400">{currentUser.role}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[68px] items-center justify-around border-t border-[#e8e4df] bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0px)] shadow-[0_-8px_24px_rgba(53,44,37,0.08)] backdrop-blur lg:hidden" aria-label="移动端主导航">
      {mobileMenuItems.map((item) => {
        const isActive = currentScreen === item.screen;
        return <button key={item.screen} onClick={() => setScreen(item.screen)} className={`flex min-w-14 flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-[10px] font-bold transition-colors ${isActive ? 'text-primary' : 'text-slate-400'}`}><span className={`material-symbols-outlined text-[21px] ${isActive ? 'text-primary' : 'text-slate-500'}`}>{item.icon}</span>{item.label.replace('工作台首页', '首页').replace('智能模板中心', '模板')}</button>;
      })}
    </nav>
  </>;
};
