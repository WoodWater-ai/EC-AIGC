import React, { useMemo, useState } from 'react';
import type { ResultTemplate, TemplateMediaType } from '../types';

interface TemplatePickerDrawerProps {
  open: boolean;
  templates: ResultTemplate[];
  mediaType: TemplateMediaType;
  onClose: () => void;
  onSelect: (template: ResultTemplate) => void;
}

/** 新建任务内的轻量模板入口。选择模板只填充当前草稿，不会创建任务。 */
export const TemplatePickerDrawer: React.FC<TemplatePickerDrawerProps> = ({ open, templates, mediaType, onClose, onSelect }) => {
  const [category, setCategory] = useState('全部');
  const [style, setStyle] = useState('全部');
  const visibleTemplates = useMemo(() => templates.filter((template) => template.mediaType === mediaType
    && (category === '全部' || template.category === category)
    && (style === '全部' || template.style === style)), [category, mediaType, style, templates]);
  const categories = ['全部', ...new Set(templates.filter((item) => item.mediaType === mediaType).map((item) => item.category))];
  const styles = ['全部', ...new Set(templates.filter((item) => item.mediaType === mediaType).map((item) => item.style))];

  if (!open) return null;

  return <div className="fixed inset-0 z-[80] flex justify-end">
    <button className="absolute inset-0 bg-slate-950/35" onClick={onClose} aria-label="关闭模板选择" />
    <aside className="relative flex h-full w-full max-w-2xl flex-col bg-[#f6f8fc] shadow-2xl">
      <header className="flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
        <div><p className="text-[11px] font-bold text-primary">模板营地</p><h2 className="mt-1 text-lg font-black text-slate-900">选择{mediaType === 'image' ? '图片' : '视频'}模板</h2><p className="mt-1 text-xs text-slate-500">选择后自动带入已验证配置，你只需要替换商品素材。</p></div>
        <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100" aria-label="关闭"><span className="material-symbols-outlined">close</span></button>
      </header>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-white px-6 py-3">
        <FilterSelect label="品类" value={category} values={categories} onChange={setCategory} />
        <FilterSelect label="风格" value={style} values={styles} onChange={setStyle} />
      </div>
      <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 sm:grid-cols-2">
        {visibleTemplates.map((template) => <article key={template.id} className="overflow-hidden border border-slate-200 bg-white">
          <img src={template.coverUrl} alt={template.name} className="aspect-[4/3] w-full object-cover" referrerPolicy="no-referrer" />
          <div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-black text-slate-900">{template.name}</h3><p className="mt-1 text-[11px] text-slate-500">{template.usage}</p></div><span className="shrink-0 border border-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">V{template.version}</span></div>
            <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-600">{template.description}</p>
            <div className="mt-4 flex items-center justify-between"><span className="text-[10px] text-slate-400">已使用 {template.usageCount} 次</span><button disabled={template.status !== 'active'} onClick={() => onSelect(template)} className="h-8 rounded-md bg-primary px-3 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-400">使用此模板</button></div>
          </div>
        </article>)}
        {visibleTemplates.length === 0 && <div className="col-span-full flex min-h-56 flex-col items-center justify-center text-center text-slate-400"><span className="material-symbols-outlined text-3xl">filter_alt_off</span><p className="mt-3 text-sm font-bold">没有匹配的模板</p><button onClick={() => { setCategory('全部'); setStyle('全部'); }} className="mt-2 text-xs font-bold text-primary">清除筛选</button></div>}
      </div>
    </aside>
  </div>;
};

const FilterSelect: React.FC<{ label: string; value: string; values: string[]; onChange: (value: string) => void }> = ({ label, value, values, onChange }) => <label className="flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2 text-[11px] font-bold text-slate-500">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="bg-transparent text-[11px] font-bold text-slate-700 outline-none">{values.map((item) => <option key={item}>{item}</option>)}</select></label>;
