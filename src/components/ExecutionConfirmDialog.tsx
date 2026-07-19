import React from 'react';

export interface ExecutionSummaryItem {
  label: string;
  value: string;
}

interface ExecutionConfirmDialogProps {
  title: string;
  description: string;
  summary: ExecutionSummaryItem[];
  requestLines: string[];
  estimatedCost: string;
  estimatedDuration: string;
  healthLabel: string;
  healthDetail: string;
  fallbackPolicy: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ExecutionConfirmDialog: React.FC<ExecutionConfirmDialogProps> = ({
  title,
  description,
  summary,
  requestLines,
  estimatedCost,
  estimatedDuration,
  healthLabel,
  healthDetail,
  fallbackPolicy,
  onCancel,
  onConfirm,
}) => (
  <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="execution-confirm-title">
    <button className="absolute inset-0 bg-slate-950/45" onClick={onCancel} aria-label="关闭执行确认" />
    <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div>
          <p className="text-[11px] font-bold text-amber-600">付费执行确认</p>
          <h2 id="execution-confirm-title" className="mt-1 text-lg font-black text-slate-900">{title}</h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
        </div>
        <button onClick={onCancel} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="关闭">
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      <div className="space-y-5 px-6 py-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-[10px] font-bold text-amber-700">预计费用</p>
            <p className="mt-1 text-xl font-black text-amber-800">{estimatedCost}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-bold text-slate-500">预计耗时</p>
            <p className="mt-1 text-sm font-black text-slate-800">{estimatedDuration}</p>
          </div>
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-[10px] font-bold text-emerald-700">通道健康度</p>
            <p className="mt-1 text-sm font-black text-emerald-800">{healthLabel}</p>
            <p className="mt-1 text-[10px] leading-4 text-emerald-700">{healthDetail}</p>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-black text-slate-800">本次执行摘要</h3>
          <dl className="mt-3 grid grid-cols-1 gap-x-5 gap-y-3 rounded-md border border-slate-200 p-4 sm:grid-cols-2">
            {summary.map((item) => <div key={item.label} className="min-w-0"><dt className="text-[10px] text-slate-400">{item.label}</dt><dd className="mt-1 break-words text-xs font-bold text-slate-700">{item.value}</dd></div>)}
          </dl>
        </div>

        <details className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <summary className="cursor-pointer text-xs font-bold text-slate-700">查看请求摘要</summary>
          <ul className="mt-3 space-y-2 text-[11px] leading-5 text-slate-500">
            {requestLines.map((line) => <li key={line} className="break-words">{line}</li>)}
          </ul>
        </details>

        <div className="flex gap-3 rounded-md border border-slate-200 px-4 py-3">
          <span className="material-symbols-outlined text-lg text-slate-500">shield</span>
          <div><p className="text-xs font-bold text-slate-700">失败与兜底策略</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{fallbackPolicy}</p></div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
        <button onClick={onCancel} className="h-9 rounded-md border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600">返回修改</button>
        <button onClick={onConfirm} className="h-9 rounded-md bg-primary px-5 text-xs font-bold text-white shadow-sm">确认费用并生成</button>
      </div>
    </div>
  </div>
);
