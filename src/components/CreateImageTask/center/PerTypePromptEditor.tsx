// src/components/CreateImageTask/center/PerTypePromptEditor.tsx
import React from 'react';
import type { ImageGenerationType } from '../../../lib/createImageTask/readinessChecks';
import { messages } from '../../../labels/createImageTask';

export interface PerTypePromptEditorProps {
  selectedTypes: ImageGenerationType[];
  defaultPrompts: Record<ImageGenerationType, string>;
  overrides: Partial<Record<ImageGenerationType, string>>;
  templateName: string;
  isProductBound: boolean;
  promptsConfirmed: boolean;
  factsConfirmed: boolean;
  onChangeOverride: (t: ImageGenerationType, v: string) => void;
  onRegenerateAll: () => void;
  onAiOptimizeSelected: () => void;
  onConfirm: () => void;
}

export const PerTypePromptEditor: React.FC<PerTypePromptEditorProps> = ({
  selectedTypes, defaultPrompts, overrides, templateName,
  isProductBound, promptsConfirmed, factsConfirmed,
  onChangeOverride, onRegenerateAll, onAiOptimizeSelected, onConfirm,
}) => {
  const nothingSelected = selectedTypes.length === 0;
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black">每种图片各自编辑</h3>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onRegenerateAll}
            disabled={!isProductBound}
            className="text-[11px] px-2 py-1 rounded bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 disabled:opacity-50"
          >
            {messages.prompt.regen}
          </button>
          <button
            type="button"
            onClick={onAiOptimizeSelected}
            disabled={nothingSelected}
            className="text-[11px] px-2 py-1 rounded bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 disabled:opacity-50"
          >
            {messages.prompt.aiOptimize}
          </button>
        </div>
      </div>
      <div className="mt-2 space-y-3">
        {selectedTypes.map((t) => {
          const value = overrides[t] ?? defaultPrompts[t];
          return (
            <div key={t} className="border border-slate-200 rounded-md overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 flex justify-between">
                <span className="text-xs font-black">{messages.type[t]}</span>
                <span className="text-[10px] text-slate-400">{messages.template.sourceLabel}: {templateName}</span>
              </div>
              <textarea
                disabled={!isProductBound}
                value={value}
                onChange={(e) => onChangeOverride(t, e.target.value)}
                aria-label={`${messages.type[t]} Prompt`}
                className="w-full h-24 resize-none p-3 outline-none disabled:bg-slate-50 disabled:text-slate-400 text-xs leading-5"
              />
            </div>
          );
        })}
        {nothingSelected && (
          <div className="text-center text-xs text-slate-400 py-4">请至少选择 1 种图片类型</div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!factsConfirmed || nothingSelected}
          className={`h-8 shrink-0 rounded-md border px-3 text-xs font-bold ${
            promptsConfirmed
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-primary bg-white text-primary disabled:border-slate-200 disabled:text-slate-300'
          }`}
        >
          {promptsConfirmed ? messages.prompt.confirmed : messages.prompt.confirmPrompts}
        </button>
      </div>
    </div>
  );
};
