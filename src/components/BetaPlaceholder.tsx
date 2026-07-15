/**
 * BETA 占位页 · 新流程尝试 -新 系列页面在 F1 阶段统一占位
 *
 * [v2.0 2026-07-13 F1 基础设施]
 * F2/F3 PR 落地前,5 个 -新 页面都用此组件渲染,避免路由 404 + 让用户感知"新版在路上"。
 * F2 阶段各自替换为真实页面 component。
 */
import React from 'react';

export interface BetaPlaceholderProps {
  title: string;
  description?: string;
  /** 未来 PR 编号,如 "F2" / "F3" */
  comingIn?: 'F2' | 'F3' | 'P1';
}

export const BetaPlaceholder: React.FC<BetaPlaceholderProps> = ({
  title, description, comingIn = 'F2',
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-12 text-slate-500">
      <div className="bg-white border border-slate-200 rounded-2xl p-10 max-w-md text-center shadow-sm">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-semibold tracking-wider uppercase mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          BETA · {comingIn} 即将开放
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">{title}</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          {description || '此页面为「快捷工具箱 / 新流程尝试」分组下的试用版,F1 阶段路由已通,真实页面随后续 PR 上线。'}
        </p>
        <div className="mt-6 pt-6 border-t border-slate-100 text-xs text-slate-400">
          老页面继续可用,不受影响
        </div>
      </div>
    </div>
  );
};
