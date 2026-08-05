// src/components/CreateImageTask/header/TopHeader.tsx
import React from 'react';

export interface TopHeaderProps {
  /** 返回任务列表 */
  onBack: () => void;
}

/**
 * 顶部导航栏(对齐 demo 主版):
 * - 左:返回按钮 + 面包屑(eyebrow + title)
 * 生成操作与任务摘要位于右栏动态参数卡片底部。
 */
export const TopHeader: React.FC<TopHeaderProps> = ({
  onBack,
}) => (
  <header className="h-16 shrink-0 px-6 bg-white border-b border-slate-200 flex items-center">
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        className="w-8 h-8 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
        title="返回任务列表"
        aria-label="返回任务列表"
      >
        <span className="material-symbols-outlined text-xl">arrow_back</span>
      </button>
      <div>
        <p className="text-[11px] font-bold text-primary">图片任务</p>
        <h1 className="text-base font-black text-slate-800">新建图片任务</h1>
      </div>
    </div>
  </header>
);
