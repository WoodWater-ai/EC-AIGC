// src/components/CreateImageTask/center/PerTypePromptEditor.tsx
import React from 'react';
import type { ImageGenerationType } from '../../../lib/createImageTask/readinessChecks';
import { messages } from '../../../labels/createImageTask';

export interface PerTypePromptEditorProps {
  selectedTypes: ImageGenerationType[];
  typeCounts: Record<ImageGenerationType, number>;
  defaultPrompts: Record<ImageGenerationType, string>;
  overrides: Partial<Record<ImageGenerationType, string>>;
  templateName: string;
  isProductBound: boolean;
  onChangeOverride: (t: ImageGenerationType, v: string) => void;
  onRegenerateAll: () => void;
  onAiOptimizeSelected: () => void;
}

export const PerTypePromptEditor: React.FC<PerTypePromptEditorProps> = ({
  selectedTypes, typeCounts, defaultPrompts, overrides, templateName,
  isProductBound,
  onChangeOverride, onRegenerateAll, onAiOptimizeSelected,
}) => {
  const nothingSelected = selectedTypes.length === 0;

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-slate-400">
          {nothingSelected ? '请选择至少一种图片类型' : `已选 ${selectedTypes.length} 个图片类型 · 共 ${selectedTypes.reduce((sum, type) => sum + typeCounts[type], 0)} 张`}
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onRegenerateAll}
            disabled={!isProductBound}
            className="h-7 border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-600 hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {messages.prompt.regen}
          </button>
          {/* AI 建议按钮暂时隐藏，后续按需解除注释。
          <button
            type="button"
            onClick={onAiOptimizeSelected}
            disabled={nothingSelected}
            className="text-[11px] px-2 py-1 rounded bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 disabled:opacity-50"
          >
            {messages.prompt.aiOptimize}
          </button>
          */}
        </div>
      </div>
      <div className="mt-3 space-y-3">
        {selectedTypes.map((type) => {
          const value = overrides[type] ?? defaultPrompts[type];

          return (
            <div key={type} className="overflow-hidden border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="material-symbols-outlined shrink-0 text-base text-primary">{messages.typeIcon[type]}</span>
                  <span className="shrink-0 text-xs font-black">{messages.type[type]}</span>
                  <span className="truncate text-[10px] text-slate-400">{templateName} · {typeCounts[type]} 张</span>
                </div>
                {overrides[type] != null && (
                  <span className="shrink-0 text-[10px] font-bold text-amber-700">已手动编辑</span>
                )}
              </div>
              <textarea
                disabled={!isProductBound}
                value={value}
                onChange={(event) => onChangeOverride(type, event.target.value)}
                aria-label={`${messages.type[type]} Prompt`}
                placeholder="选择主体素材后，可编辑最终 Prompt"
                className="min-h-32 w-full resize-y p-3 text-xs leading-6 text-slate-700 outline-none placeholder:text-slate-300 focus:bg-slate-50/40 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
          );
        })}
        {nothingSelected && (
          <div className="py-4 text-center text-xs text-slate-400">请至少选择 1 种图片类型</div>
        )}
      </div>
    </div>
  );
};
