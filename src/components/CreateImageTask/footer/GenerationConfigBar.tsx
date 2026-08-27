import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';

export interface GenerationConfigBarProps {
  model: string | null;
  aspectRatio?: string;
  resolution?: string;
  totalCount: number;
  costLabel: string;
  costLoading?: boolean;
  disabled?: boolean;
  submitting?: boolean;
  onGenerate: () => void;
}

const valueOrPending = (value?: string) => value?.trim() || '待选择';

/** 编辑态唯一的全局提交入口，配置与费用都在提交前可见。 */
export const GenerationConfigBar: React.FC<GenerationConfigBarProps> = ({
  model,
  aspectRatio,
  resolution,
  totalCount,
  costLabel,
  costLoading = false,
  disabled = false,
  submitting = false,
  onGenerate,
}) => (
  <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#dfe3e8] bg-white px-4 py-3 lg:px-6">
    <div className="min-w-0 text-[11px] text-slate-500">
      <span className="mr-2 font-bold text-slate-700">本次配置</span>
      <span className="font-medium text-slate-700">{valueOrPending(model ?? undefined)}</span>
      <span className="px-1.5 text-slate-300">|</span>
      <span>{valueOrPending(aspectRatio)}</span>
      <span className="px-1.5 text-slate-300">|</span>
      <span>{valueOrPending(resolution)}</span>
      <span className="px-1.5 text-slate-300">|</span>
      <span>{totalCount} 张</span>
      <span className="mx-2 inline-block h-3.5 w-px align-middle bg-slate-200" />
      <span className="font-bold text-slate-700">{costLoading ? '费用计算中' : costLabel}</span>
    </div>
    <button
      type="button"
      onClick={onGenerate}
      disabled={disabled || submitting}
      className="flex h-9 shrink-0 items-center gap-1.5 bg-[#df5b43] px-3 text-[11px] font-bold text-white transition hover:bg-[#cb4d37] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {submitting ? '提交中' : '检查并生成'}
    </button>
  </footer>
);
