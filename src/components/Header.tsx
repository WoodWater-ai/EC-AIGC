import React, { useState } from 'react';
import { AppScreen, SystemNotification, SystemUser } from '../types';

interface HeaderProps {
  currentScreen: AppScreen;
  setScreen: (screen: AppScreen) => void;
  currentUser: SystemUser;
  notifications: SystemNotification[];
  markAllAsRead: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  setScreen,
  currentUser,
  notifications,
  markAllAsRead
}) => {
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const getBreadcrumb = () => {
    switch (currentScreen) {
      case AppScreen.DASHBOARD:
        return { parent: '达芬奇密码 AI', child: '工作台首页' };
      case AppScreen.TASKS:
        return { parent: '批次素材生产', child: '任务列表' };
      case AppScreen.CREATE_IMAGE_TASK:
        return { parent: '创意引擎', child: '新建图片任务' };
      case AppScreen.CREATE_VIDEO_TASK:
        return { parent: '创意引擎', child: '新建视频任务' };
      case AppScreen.TEMPLATES:
        return { parent: '模板中心', child: '智能排版模板库' };
      case AppScreen.ASSETS:
        return { parent: '资产仓库', child: '商品素材库' };
      case AppScreen.ANALYTICS:
        return { parent: '成效数据复盘', child: 'AI 生成效能分析' };
      case AppScreen.SYSTEM_CONFIG:
        return { parent: '运维与渠道', child: '系统通道配置' };
      default:
        return { parent: '达芬奇密码 AI', child: '控制台' };
    }
  };

  const breadcrumb = getBreadcrumb();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between select-none relative z-40">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="font-medium hover:text-slate-600 transition-colors cursor-pointer">{breadcrumb.parent}</span>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <span className="text-[#0B1C30] font-bold text-sm tracking-tight">{breadcrumb.child}</span>
      </div>

      {/* Center & Right Area */}
      <div className="flex items-center gap-6">

        {/* Action icons */}
        <div className="flex items-center gap-1">
          {/* Quick Creator Button (Header context) with dropdown */}
          {currentScreen !== AppScreen.CREATE_IMAGE_TASK && currentScreen !== AppScreen.CREATE_VIDEO_TASK && (
            <div className="relative">
              <button
                onClick={() => setShowCreateDropdown(!showCreateDropdown)}
                className="px-3.5 py-1.5 rounded-lg bg-primary-light text-primary hover:bg-primary/15 active:scale-97 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all duration-150"
              >
                <span className="material-symbols-outlined text-sm font-bold">add</span>
                <span>新建任务</span>
                <span className="material-symbols-outlined text-xs">keyboard_arrow_down</span>
              </button>

              {showCreateDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowCreateDropdown(false)} />
                  <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl p-1 shadow-xl z-50 text-xs">
                    <button
                      onClick={() => {
                        setScreen(AppScreen.CREATE_IMAGE_TASK);
                        setShowCreateDropdown(false);
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-lg text-left hover:bg-slate-50 transition-all group cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-primary text-base">image</span>
                      <div>
                        <p className="font-bold text-slate-800">新建图片任务</p>
                        <p className="text-[9px] text-slate-400">商品智能模板背景合成</p>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setScreen(AppScreen.CREATE_VIDEO_TASK);
                        setShowCreateDropdown(false);
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-lg text-left hover:bg-slate-50 transition-all group mt-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-success text-base">video_library</span>
                      <div>
                        <p className="font-bold text-slate-800">新建视频任务</p>
                        <p className="text-[9px] text-slate-400">分镜脚本多轨视频渲染</p>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Separation line */}
          <span className="w-px h-5 bg-slate-200 mx-2" />

          {/* Notification Button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotificationPanel(!showNotificationPanel);
                if (!showNotificationPanel && unreadCount > 0) {
                  // Open
                }
              }}
              className={`w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                showNotificationPanel ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <span className="material-symbols-outlined text-xl">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-danger text-white rounded-full text-[9px] font-bold flex items-center justify-center animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {showNotificationPanel && (
              <div className="absolute right-0 mt-2 w-96 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <span className="text-sm font-bold text-[#0B1C30]">系统消息通知 ({unreadCount})</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-primary font-semibold hover:underline cursor-pointer"
                    >
                      全部标为已读
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs">目前暂无任何消息</div>
                  ) : (
                    notifications.map((notif) => (
                      <div key={notif.id} className={`p-3.5 transition-colors hover:bg-slate-50 ${!notif.read ? 'bg-blue-50/30' : ''}`}>
                        <div className="flex gap-2.5">
                          <span className={`material-symbols-outlined text-lg shrink-0 mt-0.5 ${
                            notif.type === 'success' ? 'text-success' :
                            notif.type === 'error' ? 'text-danger' :
                            notif.type === 'warning' ? 'text-warning' : 'text-info'
                          }`}>
                            {notif.type === 'success' ? 'check_circle' :
                             notif.type === 'error' ? 'error' :
                             notif.type === 'warning' ? 'warning' : 'info'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 leading-tight mb-1">{notif.title}</p>
                            <p className="text-xs text-slate-500 leading-normal">{notif.content}</p>
                            <span className="text-[10px] text-slate-400 block mt-1.5 font-mono">{notif.time}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2.5 border-t border-slate-100 text-center bg-slate-50/20">
                  <button
                    onClick={() => {
                      setScreen(AppScreen.TASKS);
                      setShowNotificationPanel(false);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors cursor-pointer"
                  >
                    查看全部生产任务历史
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Help Guide Button */}
          <button className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-700 cursor-pointer">
            <span className="material-symbols-outlined text-xl">help</span>
          </button>
        </div>
      </div>
    </header>
  );
};
