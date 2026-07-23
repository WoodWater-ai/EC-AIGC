// src/components/CreateImageTask/center/ImageContentSection.tsx
import React from 'react';
import { ProductFactsEditor } from './ProductFactsEditor';
import { PerTypePromptEditor } from './PerTypePromptEditor';
import { messages } from '../../../labels/createImageTask';
import type { ProductFactsInput } from '../../../lib/createImageTask/extractProductFacts';
import type { ImageGenerationType } from '../../../lib/createImageTask/readinessChecks';

export interface ImageContentSectionProps {
  isProductBound: boolean;
  assistantState: 'idle' | 'processing' | 'complete';
  onAssistantClick: () => void;
  productFacts: ProductFactsInput;
  factsComplete: boolean;
  factsConfirmed: boolean;
  onChangeFact: <K extends keyof ProductFactsInput>(key: K, value: ProductFactsInput[K]) => void;
  onConfirmFacts: () => void;

  promptsConfirmed: boolean;
  selectedTypes: ImageGenerationType[];
  defaultPrompts: Record<ImageGenerationType, string>;
  promptOverrides: Partial<Record<ImageGenerationType, string>>;
  templateName: string;
  promptsComplete: boolean;
  onChangePromptOverride: (t: ImageGenerationType, v: string) => void;
  onRegenerateAll: () => void;
  onAiOptimizeSelected: () => void;
  onConfirmPrompts: () => void;
}

export const ImageContentSection: React.FC<ImageContentSectionProps> = (props) => {
  const {
    isProductBound, assistantState, onAssistantClick,
    productFacts, factsComplete, factsConfirmed, onChangeFact, onConfirmFacts,
    promptsConfirmed, selectedTypes, defaultPrompts, promptOverrides, templateName,
    promptsComplete, onChangePromptOverride, onRegenerateAll, onAiOptimizeSelected, onConfirmPrompts,
  } = props;

  return (
    <div id="image-content-section" className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold text-primary">{messages.header.eyebrow}</p>
          <h2 className="text-base font-black">任务级 Prompt 副本</h2>
        </div>
        <button
          type="button"
          onClick={onAssistantClick}
          disabled={!isProductBound || assistantState === 'processing'}
          className={`h-8 px-3 border rounded-md flex gap-1 items-center text-xs font-bold ${
            assistantState === 'processing'
              ? 'border-primary bg-blue-50 text-primary animate-pulse'
              : 'border-blue-200 bg-blue-50 text-primary hover:bg-blue-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-sm">{assistantState === 'processing' ? 'progress_activity' : 'auto_awesome'}</span>
          {assistantState === 'processing' ? messages.assistant.processing : assistantState === 'complete' ? messages.assistant.retry : messages.assistant.idle}
        </button>
      </div>

      {!isProductBound && (
        <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] font-bold text-amber-700">
          请先在左侧选择已绑定商品的素材,商品事实与 Prompt 才能解析。
        </div>
      )}

      {assistantState === 'complete' && (
        <div role="status" className="mt-3 flex items-center gap-2 bg-emerald-50 rounded-md p-2 text-[11px] font-bold text-emerald-700 border border-emerald-200">
          <span className="material-symbols-outlined text-sm">check_circle</span>
          {messages.assistant.complete}
        </div>
      )}

      <ProductFactsEditor
        value={productFacts}
        isProductBound={isProductBound}
        factsConfirmed={factsConfirmed}
        onChange={onChangeFact}
        onConfirm={onConfirmFacts}
      />

      <PerTypePromptEditor
        selectedTypes={selectedTypes}
        defaultPrompts={defaultPrompts}
        overrides={promptOverrides}
        templateName={templateName}
        isProductBound={isProductBound}
        promptsConfirmed={promptsConfirmed}
        factsConfirmed={factsConfirmed}
        onChangeOverride={onChangePromptOverride}
        onRegenerateAll={onRegenerateAll}
        onAiOptimizeSelected={onAiOptimizeSelected}
        onConfirm={onConfirmPrompts}
      />
    </div>
  );
};
