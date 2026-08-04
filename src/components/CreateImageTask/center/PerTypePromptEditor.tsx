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
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-black">各类型 Prompt</h3>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onRegenerateAll}
            disabled={!isProductBound}
            className="text-[11px] px-2 py-1 rounded bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 disabled:opacity-50"
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
      <div className="mt-2 space-y-3">
        {selectedTypes.map((t) => {
          const value = overrides[t] ?? defaultPrompts[t];
          return (
            <div key={t} className="overflow-hidden border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-primary">{messages.typeIcon[t]}</span>
                  <span className="text-xs font-black">{messages.type[t]}</span>
                  <span className="text-[10px] text-slate-400">{templateName} · {typeCounts[t]} 张</span>
                </div>
                {overrides[t] != null && (
                  <span className="text-[10px] font-bold text-amber-700">
                    已手动编辑
                  </span>
                )}
                {/* 默认 Prompt 的“AI 生成”状态文案暂时隐藏，后续按需恢复。 */}
              </div>
              <textarea
                disabled={!isProductBound}
                value={value}
                onChange={(e) => onChangeOverride(t, e.target.value)}
                aria-label={`${messages.type[t]} Prompt`}
                placeholder="选择主体素材后，可编辑最终 Prompt"
                className="h-48 w-full resize-y p-3 text-xs leading-6 text-slate-700 outline-none placeholder:text-slate-300 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
          );
        })}
        {nothingSelected && (
          <div className="text-center text-xs text-slate-400 py-4">请至少选择 1 种图片类型</div>
        )}
      </div>
    </div>
  );
};
