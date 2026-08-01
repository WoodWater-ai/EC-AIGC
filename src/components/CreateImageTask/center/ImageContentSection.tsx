// src/components/CreateImageTask/center/ImageContentSection.tsx
import React from 'react';
import { PerTypePromptEditor } from './PerTypePromptEditor';
import { messages } from '../../../labels/createImageTask';
import type { ImageGenerationType } from '../../../lib/createImageTask/readinessChecks';

export interface ImageContentSectionProps {
  isProductBound: boolean;
  assistantState: 'idle' | 'processing' | 'complete';
  onAssistantClick: () => void;
  selectedTypes: ImageGenerationType[];
  typeCounts: Record<ImageGenerationType, number>;
  defaultPrompts: Record<ImageGenerationType, string>;
  promptOverrides: Partial<Record<ImageGenerationType, string>>;
  templateName: string;
  promptsComplete: boolean;
  onChangePromptOverride: (t: ImageGenerationType, v: string) => void;
  onRegenerateAll: () => void;
  onAiOptimizeSelected: () => void;
  typeSelector: React.ReactNode;
  tagSelector: React.ReactNode;
  templateSelector: React.ReactNode;
  advancedSettings: React.ReactNode;
}

export const ImageContentSection: React.FC<ImageContentSectionProps> = (props) => {
  const {
    isProductBound, assistantState, onAssistantClick,
    selectedTypes, typeCounts, defaultPrompts, promptOverrides, templateName,
    promptsComplete: _promptsComplete, onChangePromptOverride, onRegenerateAll, onAiOptimizeSelected,
    typeSelector, tagSelector, templateSelector, advancedSettings,
  } = props;

  return (
    <div id="image-content-section" className="border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <p className="text-[11px] font-bold text-primary">内容</p>
          <h2 className="mt-0.5 text-sm font-black">最终 Prompt</h2>
        </div>
        <button
          type="button"
          onClick={onAssistantClick}
          disabled={!isProductBound || assistantState === 'processing'}
          className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-[11px] font-bold ${
            assistantState === 'processing'
              ? 'border-primary bg-blue-50 text-primary animate-pulse'
              : 'border-blue-200 bg-blue-50 text-primary hover:bg-blue-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-base">{assistantState === 'processing' ? 'progress_activity' : 'auto_fix_high'}</span>
          {assistantState === 'processing' ? messages.assistant.processing : assistantState === 'complete' ? messages.assistant.retry : messages.assistant.idle}
        </button>
      </div>

      {!isProductBound && (
        <div className="mt-3 border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700">
          请先在左侧选择已绑定商品的素材,商品事实与 Prompt 才能解析。
        </div>
      )}

      {assistantState === 'complete' && (
        <div role="status" className="mt-3 flex items-center gap-2 border border-emerald-200 bg-emerald-50 p-2 text-[11px] font-bold text-emerald-700">
          <span className="material-symbols-outlined text-sm">check_circle</span>
          {messages.assistant.complete}
        </div>
      )}

      <div className="mt-3">{typeSelector}</div>

      <div className="mt-3 border-y border-slate-100 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {tagSelector}
          {templateSelector}
        </div>
        <p className="mt-2 text-[10px] text-slate-400">
          风格、场景与姿势来自系统字典，调整后会参与各类型 Prompt 生成。
        </p>
      </div>

      <PerTypePromptEditor
        selectedTypes={selectedTypes}
        typeCounts={typeCounts}
        defaultPrompts={defaultPrompts}
        overrides={promptOverrides}
        templateName={templateName}
        isProductBound={isProductBound}
        onChangeOverride={onChangePromptOverride}
        onRegenerateAll={onRegenerateAll}
        onAiOptimizeSelected={onAiOptimizeSelected}
      />
      <p className="mt-2 text-[10px] leading-4 text-slate-400">
        图片类型支持多选，所有已选类型的 Prompt 会依次显示；点击生成时统一校验 Prompt 与执行参数。
      </p>
      <div className="mt-3 border-t border-slate-100 pt-3">{advancedSettings}</div>
    </div>
  );
};
