import React, { useState } from 'react';
import { AppScreen, SystemUser } from '../types';

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
    { screen: AppScreen.ANALYTICS, label: '数据效能复盘', icon: 'insights' },
    { screen: AppScreen.SYSTEM_CONFIG, label: '系统配置模块', icon: 'settings_applications' },
  ];

  return (
    <aside className="w-68 bg-[#0B1C30] text-slate-300 flex flex-col justify-between select-none shrink-0 h-screen overflow-y-auto border-r border-slate-800">
      {/* Top Brand Section */}
      <div>
        <div className="p-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0256FF] to-[#3B82F6] flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="material-symbols-outward font-bold text-white text-xl">blur_on</span>
            </div>
            <div>
              <h1 className="text-white font-bold font-display text-base tracking-wide leading-none">达芬奇密码 AI</h1>
              <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">DaVinci Code v2.0</span>
            </div>
          </div>
        </div>

        {/* Global Action Button with dropdown */}
        <div className="p-4 relative">
          <button
            onClick={() => setShowCreateDropdown(!showCreateDropdown)}
            className="w-full h-11 bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-600 active:scale-98 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/10 cursor-pointer transition-all duration-150"
            id="sidebar-create-btn"
          >
            <span className="material-symbols-outlined text-lg">add_circle</span>
            开始智能创作
            <span className="material-symbols-outlined text-xs transition-transform duration-200" style={{ transform: showCreateDropdown ? 'rotate(180deg)' : 'rotate(0)' }}>keyboard_arrow_down</span>
          </button>

          {showCreateDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowCreateDropdown(false)} />
              <div className="absolute top-16 left-4 right-4 bg-[#112239] border border-slate-800/80 rounded-xl p-1.5 shadow-2xl z-50 text-xs text-slate-300 animate-fadeIn">
                <button
                  onClick={() => {
                    setScreen(AppScreen.CREATE_IMAGE_TASK);
                    setShowCreateDropdown(false);
                  }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left hover:bg-[#182a42] transition-all group cursor-pointer"
                >
                  <span className="material-symbols-outlined text-primary text-lg group-hover:scale-110 transition-transform">image</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-[11px]">新建图片生成任务</p>
                    <p className="text-[9px] text-slate-500 truncate mt-0.5">多维智能模板背景融合合成</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setScreen(AppScreen.CREATE_VIDEO_TASK);
                    setShowCreateDropdown(false);
                  }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left hover:bg-[#182a42] transition-all group mt-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-success text-lg group-hover:scale-110 transition-transform">video_library</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-[11px]">新建视频生成任务</p>
                    <p className="text-[9px] text-slate-500 truncate mt-0.5">分镜脚本多层轨道动感视频</p>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Menu Items List */}
        <nav className="px-3 space-y-1">
          <span className="text-[10px] font-semibold text-slate-500 tracking-wider px-3 block mb-2 uppercase">主模块导航</span>
          {menuItems.map((item) => {
            const isActive = currentScreen === item.screen;
            return (
              <button
                key={item.screen}
                onClick={() => setScreen(item.screen)}
                className={`w-full h-10 px-3 rounded-lg flex items-center justify-between font-medium text-sm cursor-pointer transition-all duration-150 group ${
                  isActive
                    ? 'bg-[#1e2d45] text-white'
                    : 'text-slate-400 hover:bg-[#142337] hover:text-slate-200'
                }`}
                id={`menu-item-${item.screen.toLowerCase()}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`material-symbols-outlined text-lg transition-colors ${
                    isActive ? 'text-primary' : 'text-slate-500 group-hover:text-slate-400'
                  }`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Shortcuts / Utilities */}
        <div className="mt-6 px-3">
          <span className="text-[10px] font-semibold text-slate-500 tracking-wider px-3 block mb-2 uppercase">快捷工具箱</span>
          <button
            onClick={openTransit}
            className="w-full h-9 px-3 rounded-lg flex items-center gap-3 font-medium text-sm text-slate-400 hover:bg-[#142337] hover:text-slate-200 cursor-pointer transition-all duration-150"
          >
            <span className="material-symbols-outlined text-lg text-slate-500">grid_view</span>
            资源中转存档站
          </button>
        </div>
      </div>

      {/* User Session Swapper Section */}
      <div className="p-4 border-t border-slate-800/80 bg-[#081525]">
        <div className="relative">
          {showUserDropdown && (
            <div className="absolute bottom-14 left-0 w-full bg-[#112239] border border-slate-800 rounded-xl p-2 shadow-xl z-50">
              <span className="text-[10px] text-slate-500 block px-2 pb-1.5 border-b border-slate-800 mb-1">切换协作账号角色</span>
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setCurrentUser(u);
                    setShowUserDropdown(false);
                  }}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-all ${
                    currentUser.id === u.id ? 'bg-[#1e2d45] text-white' : 'hover:bg-[#182a42] text-slate-300'
                  }`}
                >
                  <img src={u.avatar} alt={u.name} className="w-7 h-7 rounded-full object-cover" referrerPolicy="no-referrer" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{u.name}</p>
                    <p className="text-[10px] text-slate-500">{u.role}</p>
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
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#142337] cursor-pointer transition-all duration-150"
          >
            <div className="relative">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-9 h-9 rounded-full object-cover border border-slate-700"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-success border-2 border-[#0B1C30]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white truncate leading-none mb-1">{currentUser.name}</p>
                <span className="material-symbols-outlined text-slate-500 text-xs">unfold_more</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-none truncate">{currentUser.role}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
