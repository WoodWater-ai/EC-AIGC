// src/components/CreateImageTask/header/TopHeader.tsx
import React from 'react';

export interface TopHeaderProps {
  /** 返回任务列表 */
  onBack: () => void;
  productName?: string;
  productCategory?: string;
  imageUrl?: string;
  isMatched?: boolean;
}

/**
 * 顶部导航栏(对齐 demo 主版):
 * - 左:返回按钮 + 面包屑(eyebrow + title)
 * 生成操作与任务摘要位于右栏动态参数卡片底部。
 */
export const TopHeader: React.FC<TopHeaderProps> = ({
  onBack,
  productName,
  productCategory,
  imageUrl,
  isMatched = false,
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
    {productName && (
      <div className="ml-4 hidden max-w-[420px] items-center gap-2.5 rounded-md border border-[#dfe3e8] bg-[#fbfcfd] p-1.5 lg:flex">
        {imageUrl ? <img src={imageUrl} alt="" className="h-8 w-8 rounded object-cover" /> : <span className="grid h-8 w-8 place-items-center rounded bg-slate-100 text-slate-400 material-symbols-outlined text-base">inventory_2</span>}
        <div className="min-w-0 leading-tight">
          <strong className="block truncate text-[10px] text-slate-700">{productName}</strong>
          <small className="mt-1 block truncate text-[9px] text-slate-400">{productCategory || 'ERP 商品事实待匹配'}</small>
        </div>
        <span className={`shrink-0 px-1.5 py-1 text-[9px] font-bold ${isMatched ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {isMatched ? '已匹配' : '待匹配'}
        </span>
      </div>
    )}
  </header>
);
