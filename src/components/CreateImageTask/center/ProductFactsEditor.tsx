// src/components/CreateImageTask/center/ProductFactsEditor.tsx
import React from 'react';
import { messages } from '../../../labels/createImageTask';
import type { ProductFactsInput } from '../../../lib/createImageTask/extractProductFacts';

export interface ProductFactsEditorProps {
  value: ProductFactsInput;
  isProductBound: boolean;
  factsConfirmed: boolean;
  onChange: <K extends keyof ProductFactsInput>(key: K, value: ProductFactsInput[K]) => void;
  onConfirm: () => void;
}

const fieldClass = 'w-full h-9 px-2 rounded border border-slate-200 bg-white text-xs font-bold disabled:bg-slate-50 disabled:text-slate-400';

export const ProductFactsEditor: React.FC<ProductFactsEditorProps> = ({
  value, isProductBound, factsConfirmed, onChange, onConfirm,
}) => {
  const completed = value.name.trim().length > 0;
  return (
    <div className="border-y border-slate-100 py-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black">商品事实</h3>
        <p className="text-[10px] text-slate-400">{messages.facts.factPlaceholder}</p>
        <span className={`text-[10px] font-bold ${factsConfirmed ? 'text-emerald-700' : 'text-amber-600'}`}>
          {factsConfirmed ? '已确认' : '待确认'}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
        <label className="block">
          <span className="text-[11px] font-bold text-slate-700">{messages.facts.name}</span>
          <input className={fieldClass} disabled={!isProductBound} value={value.name} onChange={(e) => onChange('name', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold text-slate-700">{messages.facts.sellingPoints}</span>
          <input className={fieldClass} disabled={!isProductBound} value={value.sellingPoints} onChange={(e) => onChange('sellingPoints', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold text-slate-700">{messages.facts.category}</span>
          <input className={fieldClass} disabled={!isProductBound} value={value.productCategory} onChange={(e) => onChange('productCategory', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold text-slate-700">{messages.facts.color}</span>
          <input className={fieldClass} disabled={!isProductBound} value={value.colorPattern} onChange={(e) => onChange('colorPattern', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold text-slate-700">{messages.facts.patternAndMaterial}</span>
          <input className={fieldClass} disabled={!isProductBound} value={value.fabricTexture} onChange={(e) => onChange('fabricTexture', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold text-slate-700">{messages.facts.structure}</span>
          <input className={fieldClass} disabled={!isProductBound} value={value.fitStructure} onChange={(e) => onChange('fitStructure', e.target.value)} />
        </label>
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!isProductBound || !completed}
          className="shrink-0 h-7 px-2.5 rounded border border-slate-200 bg-white disabled:bg-slate-100 disabled:text-slate-400 text-[11px] font-bold text-slate-600 hover:border-primary hover:text-primary"
        >
          {messages.facts.confirm}
        </button>
      </div>
    </div>
  );
};
