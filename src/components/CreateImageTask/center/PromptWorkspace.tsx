import React from 'react';
import { Files, Undo2 } from 'lucide-react';
import type { ImageGenerationType } from '../../../lib/createImageTask/readinessChecks';
import type { ReferenceSlot } from '../../../lib/createImageTask/extractReferenceInsights';
import {
  REFERENCE_ROLE_LABELS,
} from '../../../lib/createImageTask/buildPromptFromFacts';
import {
  getEffectiveNegativePrompt,
  getEffectivePrompt,
  PROMPT_WORKSPACE_TYPES,
  type PromptWorkspaceType,
} from '../../../lib/createImageTask/promptWorkspace';
import { messages } from '../../../labels/createImageTask';

export interface PromptWorkspaceProps {
  activeType: PromptWorkspaceType;
  defaultPrompts: Record<ImageGenerationType, string>;
  promptOverrides: Partial<Record<ImageGenerationType, string>>;
  negativePromptOverrides: Partial<Record<ImageGenerationType, string>>;
  referenceGroups: ReferenceSlot[][];
  isProductBound: boolean;
  onActiveTypeChange: (type: PromptWorkspaceType) => void;
  onChangePromptOverride: (type: PromptWorkspaceType, value: string) => void;
  onRestorePrompt: (type: PromptWorkspaceType) => void;
  onChangeNegativePrompt: (type: PromptWorkspaceType, value: string) => void;
  onRestoreNegativePrompt: (type: PromptWorkspaceType) => void;
  onOpenTemplates: () => void;
  tagSelector: React.ReactNode;
  executionSettings: React.ReactNode;
}

export const PromptWorkspace: React.FC<PromptWorkspaceProps> = ({
  activeType,
  defaultPrompts,
  promptOverrides,
  negativePromptOverrides,
  referenceGroups,
  isProductBound,
  onActiveTypeChange,
  onChangePromptOverride,
  onRestorePrompt,
  onChangeNegativePrompt,
  onRestoreNegativePrompt,
  onOpenTemplates,
  tagSelector,
  executionSettings,
}) => {
  const activeLabel = messages.type[activeType];
  const activeEdited = promptOverrides[activeType] != null;
  const prompt = getEffectivePrompt(activeType, defaultPrompts, promptOverrides);
  const negativePromptEdited = negativePromptOverrides[activeType] != null;
  const negativePrompt = getEffectiveNegativePrompt(activeType, negativePromptOverrides);

  const chipStyles: Record<'main' | ReferenceSlot, { shell: string; number: string }> = {
    main: { shell: 'border-rose-200 bg-rose-50 text-rose-700', number: 'bg-rose-500' },
    model: { shell: 'border-blue-200 bg-blue-50 text-blue-700', number: 'bg-blue-500' },
    scene: { shell: 'border-emerald-200 bg-emerald-50 text-emerald-700', number: 'bg-emerald-500' },
    detail: { shell: 'border-amber-200 bg-amber-50 text-amber-700', number: 'bg-amber-500' },
    pose: { shell: 'border-indigo-200 bg-indigo-50 text-indigo-700', number: 'bg-indigo-500' },
    style: { shell: 'border-cyan-200 bg-cyan-50 text-cyan-700', number: 'bg-cyan-500' },
  };

  const referenceChips = [
    { key: 'main-1', label: '主图参考', imageNo: 1, role: 'main' as const },
    ...referenceGroups.flatMap((roles, index) => roles.map((role) => ({
      key: `${role}-${index + 2}`,
      label: REFERENCE_ROLE_LABELS[role],
      imageNo: index + 2,
      role,
    }))),
  ];

  return (
    <section id="image-content-section" className="border border-[#dfe3e8] bg-white">
      <div className="flex min-h-12 items-stretch justify-between gap-3 border-b border-slate-200 px-3">
        <div className="grid min-w-0 flex-1 grid-cols-4" role="tablist" aria-label="提示词分类">
          {PROMPT_WORKSPACE_TYPES.map((type) => {
            const active = activeType === type;
            const label = messages.type[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => onActiveTypeChange(type)}
                className={`relative min-w-0 px-2 text-[11px] font-black ${active ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                aria-selected={active}
                role="tab"
              >
                <span className="block truncate">{label}</span>
                {active && <span className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-primary" />}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onOpenTemplates}
          className="my-2 flex h-8 shrink-0 items-center gap-1.5 border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-600 hover:border-primary hover:text-primary"
        >
          <Files className="h-3.5 w-3.5" />
          模板
        </button>
      </div>

      <div className="space-y-4 p-3">
        <div className="border-l-2 border-primary bg-primary/5 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor={`prompt-${activeType}`} className="text-xs font-black text-slate-800">
              正面提示词
            </label>
            {activeEdited && (
              <button
                type="button"
                onClick={() => onRestorePrompt(activeType)}
                title="恢复默认正面提示词"
                aria-label="恢复默认正面提示词"
                className="grid h-7 w-7 place-items-center text-slate-400 hover:bg-white hover:text-primary"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="border border-slate-200 bg-white focus-within:border-primary">
            <textarea
              id={`prompt-${activeType}`}
              disabled={!isProductBound}
              value={prompt}
              onChange={(event) => onChangePromptOverride(activeType, event.target.value)}
              aria-label={`${activeLabel}正面提示词`}
              placeholder={!isProductBound ? '选择主体素材后可编辑' : ''}
              className="block min-h-[270px] w-full resize-y border-0 bg-transparent p-3 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-300 disabled:bg-slate-50 disabled:text-slate-400"
            />
            <div className="flex flex-wrap gap-2 border-t border-slate-100 px-3 py-2">
              {referenceChips.map((chip) => {
                const colors = chipStyles[chip.role];
                return (
                  <span
                    key={chip.key}
                    className={`inline-flex h-7 items-center overflow-hidden border text-[10px] font-bold ${colors.shell}`}
                  >
                    <span className="px-2">{chip.label}</span>
                    <span className={`grid h-full place-items-center px-2 text-white ${colors.number}`}>
                      图{chip.imageNo}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor={`negative-prompt-${activeType}`} className="text-[10px] font-bold text-slate-600">
              负面提示词
            </label>
            <button
              type="button"
              onClick={() => onRestoreNegativePrompt(activeType)}
              disabled={!negativePromptEdited}
              title="恢复默认负面提示词"
              aria-label="恢复默认负面提示词"
              className="grid h-7 w-7 place-items-center text-slate-400 hover:bg-slate-50 hover:text-primary disabled:cursor-default disabled:opacity-35"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <textarea
            id={`negative-prompt-${activeType}`}
            disabled={!isProductBound}
            value={negativePrompt}
            onChange={(event) => onChangeNegativePrompt(activeType, event.target.value)}
            aria-label={`${activeLabel}负面提示词`}
            className="min-h-[52px] w-full resize-y border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700 outline-none focus:border-primary focus:bg-white disabled:text-slate-400"
          />
        </div>

        <div className="border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-2">{tagSelector}</div>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-2">{executionSettings}</div>
        </div>
      </div>
    </section>
  );
};
