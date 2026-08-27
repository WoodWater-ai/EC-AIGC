// src/components/CreateImageTask/header/TopHeader.tsx
import React from 'react';

export interface TopHeaderProps {
  /** 返回任务列表 */
  onBack: () => void;
}

/**
 * 顶部导航栏只保留页面定位；商品信息已在素材区和任务队列展示。
 */
export const TopHeader: React.FC<TopHeaderProps> = ({
  onBack,
}) => (
  <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-[#dfe3e8] bg-white px-4 lg:px-6">
    <div className="flex min-w-0 items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100"
        title="返回任务列表"
        aria-label="返回任务列表"
      >
        <span className="material-symbols-outlined text-xl">arrow_back</span>
      </button>
      <div>
        <h1 className="text-base font-black text-slate-800">新建图片任务</h1>
        <p className="mt-0.5 text-[10px] text-slate-400">配置、生成与结果在同一页面完成</p>
      </div>
    </div>
  </header>
);
