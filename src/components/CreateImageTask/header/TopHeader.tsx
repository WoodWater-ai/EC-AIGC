// src/components/CreateImageTask/header/TopHeader.tsx
import React from 'react';
import { messages } from '../../../labels/createImageTask';

export interface TopHeaderProps {
  /** 已选图片类型数量 */
  selectedTypesCount: number;
  /** 本次总张数 */
  totalCount: number;
  /** 生成准备度(0-4,4 项 readinessCheck) */
  readinessCount: number;
  /** 返回任务列表 */
  onBack: () => void;
  /** 检查并生成 —— 由父容器接 readiness 流程 */
  onCheckAndGenerate: () => void;
}

/**
 * 顶部导航栏(对齐 demo 主版):
 * - 左:返回按钮 + 面包屑(eyebrow + title)
 * - 右:生成准备度 N/4 + 任务摘要 + 检查并生成 CTA
 *
 * 注意:评分审核(reviewEnabled)不在顶部,在右栏 ReviewStrategyPanel 独立区域;
 * demo 也只在右栏展示 review toggle。
 */
export const TopHeader: React.FC<TopHeaderProps> = ({
  selectedTypesCount, totalCount, readinessCount,
  onBack, onCheckAndGenerate,
}) => (
  <header className="h-16 shrink-0 px-6 bg-white border-b border-slate-200 flex items-center justify-between">
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
        <p className="text-[11px] font-bold text-primary">{messages.header.eyebrow}</p>
        <h1 className="text-base font-black text-slate-800">{messages.header.title}</h1>
      </div>
    </div>
    <div className="flex items-center gap-3">
      <div className="text-right">
        <span className="block text-[10px] font-bold text-slate-400">
          生成准备度 {readinessCount}/4
        </span>
        <span className="text-xs text-slate-500">
          {selectedTypesCount} 个图片类型 · {totalCount} 张
        </span>
      </div>
      <button
        type="button"
        onClick={onCheckAndGenerate}
        className="h-9 px-4 rounded-md bg-primary text-white text-xs font-bold shadow-sm hover:opacity-90"
      >
        检查并生成
      </button>
    </div>
  </header>
);