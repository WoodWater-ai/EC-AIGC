import React from 'react';
import { Image as ImageIcon, Loader2, X } from 'lucide-react';
import type { CreationTemplate } from '../../../api/modules/creationTemplate';
import {
  toPromptWorkspaceType,
  type PromptWorkspaceType,
} from '../../../lib/createImageTask/promptWorkspace';
import { messages } from '../../../labels/createImageTask';
import { withCosThumbnail } from '../../../utils/cosImage';

export function templatesForWorkspaceType(
  templates: CreationTemplate[],
  activeType: PromptWorkspaceType,
): CreationTemplate[] {
  return templates.filter((template) => toPromptWorkspaceType(template.imageType) === activeType);
}

interface PromptTemplateDrawerProps {
  activeType: PromptWorkspaceType;
  templates: CreationTemplate[];
  loading: boolean;
  error?: string | null;
  applyingId: string | null;
  onSelect: (templateId: string) => void;
  onClose: () => void;
}

export const PromptTemplateDrawer: React.FC<PromptTemplateDrawerProps> = ({
  activeType,
  templates,
  loading,
  error,
  applyingId,
  onSelect,
  onClose,
}) => {
  const visibleTemplates = templatesForWorkspaceType(templates, activeType);

  return (
    <div className="absolute inset-0 z-30" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
        aria-label="关闭模板抽屉"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-template-drawer-title"
        className="absolute inset-y-0 right-0 flex w-[min(88%,380px)] flex-col border-l border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 px-3">
          <h2 id="prompt-template-drawer-title" className="text-xs font-black text-slate-800">
            {messages.type[activeType]}模板
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center text-slate-400 hover:text-slate-700"
            title="关闭"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading && (
            <div className="flex h-36 items-center justify-center text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {!loading && error && (
            <p className="border border-red-200 bg-red-50 px-3 py-2 text-[10px] text-red-700">{error}</p>
          )}
          {!loading && !error && visibleTemplates.length === 0 && (
            <div className="flex h-36 items-center justify-center text-[11px] text-slate-400">暂无该分类模板</div>
          )}
          {!loading && !error && visibleTemplates.map((template) => {
            const summary = [template.style, template.scene, template.pose].filter(Boolean).join(' · ');
            const applying = applyingId === template.id;
            return (
              <button
                key={template.id}
                type="button"
                disabled={applyingId !== null}
                onClick={() => onSelect(template.id)}
                className="mb-2 flex w-full items-center gap-3 border border-slate-200 bg-white p-2 text-left hover:border-primary hover:bg-primary/5 disabled:cursor-wait disabled:opacity-60"
              >
                {template.coverUrl ? (
                  <img
                    src={withCosThumbnail(template.coverUrl, 160) ?? template.coverUrl}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-16 w-16 shrink-0 border border-slate-100 bg-slate-50 object-contain"
                  />
                ) : (
                  <span className="grid h-16 w-16 shrink-0 place-items-center bg-slate-100">
                    <ImageIcon className="h-5 w-5 text-slate-300" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-black text-slate-800">{template.templateName}</span>
                  {summary && (
                    <span className="mt-1 block line-clamp-2 text-[10px] leading-4 text-slate-400">{summary}</span>
                  )}
                  <span className="mt-2 block text-[9px] font-bold text-slate-400">使用 {template.usageCount} 次</span>
                </span>
                {applying && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
};
