// src/components/CreateImageTask/center/ProductFactsEditor.tsx
import React, { useState } from 'react';
import { messages } from '../../../labels/createImageTask';
import type { ProductFactsInput } from '../../../lib/createImageTask/extractProductFacts';

export interface ProductFactsEditorProps {
  value: ProductFactsInput;
  isProductBound: boolean;
  onChange: <K extends keyof ProductFactsInput>(key: K, value: ProductFactsInput[K]) => void;
}

const fieldClass = 'mt-0.5 h-7 w-full border-b border-slate-200 bg-transparent text-[11px] outline-none focus:border-primary disabled:text-slate-400';

export const ProductFactsEditor: React.FC<ProductFactsEditorProps> = ({
  value, isProductBound, onChange,
}) => {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const hasFacts = Object.values(value).some((item) => String(item ?? '').trim().length > 0);

  const copyFacts = async () => {
    const text = [
      `商品名称：${value.name}`,
      `品类：${value.productCategory}`,
      `颜色：${value.colorPattern}`,
      `图案/材质：${value.fabricTexture}`,
      `版型/结构：${value.fitStructure}`,
      `核心卖点：${value.sellingPoints}`,
    ].join('\n');

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!copied) throw new Error('Copy command failed');
      }
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    window.setTimeout(() => setCopyState('idle'), 1200);
  };

  return (
    <div className="border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-black">商品事实</h3>
          <p className="mt-0.5 text-[10px] text-slate-400">AI 基于主体素材识别，可直接修改</p>
        </div>
        <button
          type="button"
          onClick={copyFacts}
          disabled={!hasFacts}
          className={`grid h-7 w-7 shrink-0 place-items-center rounded border transition-colors ${
            copyState === 'failed'
              ? 'border-red-200 text-red-600'
              : 'border-slate-200 text-slate-500 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40'
          }`}
          title={copyState === 'failed' ? '复制失败，请检查浏览器权限' : copyState === 'copied' ? '复制成功' : '复制商品事实'}
          aria-label={copyState === 'failed' ? '复制失败' : copyState === 'copied' ? '复制成功' : '复制商品事实'}
        >
          <span className="material-symbols-outlined text-sm">
            {copyState === 'copied' ? 'check' : copyState === 'failed' ? 'error' : 'content_copy'}
          </span>
        </button>
      </div>
      <div className="mt-3 space-y-2">
        <label className="block">
          <span className="text-[10px] text-slate-400">{messages.facts.name}</span>
          <input className={fieldClass} disabled={!isProductBound} value={value.name} onChange={(e) => onChange('name', e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-x-2 gap-y-2">
          <label className="min-w-0"><span className="block text-[10px] text-slate-400">{messages.facts.category}</span><input className={fieldClass} disabled={!isProductBound} value={value.productCategory} onChange={(e) => onChange('productCategory', e.target.value)} /></label>
          <label className="min-w-0"><span className="block text-[10px] text-slate-400">{messages.facts.color}</span><input className={fieldClass} disabled={!isProductBound} value={value.colorPattern} onChange={(e) => onChange('colorPattern', e.target.value)} /></label>
          <label className="min-w-0"><span className="block text-[10px] text-slate-400">{messages.facts.patternAndMaterial}</span><input className={fieldClass} disabled={!isProductBound} value={value.fabricTexture} onChange={(e) => onChange('fabricTexture', e.target.value)} /></label>
          <label className="min-w-0"><span className="block text-[10px] text-slate-400">{messages.facts.structure}</span><input className={fieldClass} disabled={!isProductBound} value={value.fitStructure} onChange={(e) => onChange('fitStructure', e.target.value)} /></label>
        </div>
        <label className="block">
          <span className="text-[10px] text-slate-400">{messages.facts.sellingPoints}</span>
          <textarea className={`${fieldClass} h-12 resize-none leading-4`} disabled={!isProductBound} value={value.sellingPoints} onChange={(e) => onChange('sellingPoints', e.target.value)} />
        </label>
      </div>
    </div>
  );
};
