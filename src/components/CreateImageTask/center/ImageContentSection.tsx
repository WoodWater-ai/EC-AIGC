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
  executionSettings: React.ReactNode;
}

export const ImageContentSection: React.FC<ImageContentSectionProps> = (props) => {
  const {
    isProductBound, assistantState, onAssistantClick,
    selectedTypes, typeCounts, defaultPrompts, promptOverrides, templateName,
    promptsComplete: _promptsComplete, onChangePromptOverride, onRegenerateAll, onAiOptimizeSelected,
    typeSelector, tagSelector, templateSelector, executionSettings,
  } = props;

  return (
    <div id="image-content-section" className="space-y-3">
      <section className="border border-[#dfe3e8] bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold text-[#df5b43]">输出内容</p>
            <h2 className="mt-0.5 text-xs font-black">选择图片类型</h2>
          </div>
          <span className="bg-slate-100 px-1.5 py-1 text-[9px] font-bold text-slate-500">
            共 {selectedTypes.reduce((sum, type) => sum + typeCounts[type], 0)} 张
          </span>
        </div>
        <div className="mt-3">{typeSelector}</div>
      </section>

      <section className="border border-[#dfe3e8] bg-white p-3">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <p className="text-[9px] font-bold text-[#df5b43]">内容表达</p>
          <h2 className="mt-0.5 text-xs font-black">本次图片 Prompt</h2>
          <p className="mt-1 text-[10px] text-slate-400">像对话输入框一样编辑文字，并在底部直接调整创作标签</p>
        </div>
        {/* AI 助手按钮暂时隐藏，后续按需解除注释。
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
        */}
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
      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold text-slate-600">创作标签</p>
            <p className="mt-0.5 text-[9px] text-slate-400">已引用参考图的标签自动锁定</p>
          </div>
          {templateSelector}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {tagSelector}
          {executionSettings}
        </div>
      </div>
      </section>
    </div>
  );
};
