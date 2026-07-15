// [新增 2026-07-13 F1 补强] 多图 URL 字段
// Vidu SOLUTION 4 端点必填 1~7 张图(ImageComposition 场景)
// [v2.0 修订] 移除 antd,改用 Tailwind + lucide-react + sonner(项目 UI 库)
import React from 'react';
import { Plus, X, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { FieldDef } from '../../../../api/modules/capability';

export interface ImagesPickerFieldProps {
  field: FieldDef;
  value: any;
  onChange: (v: any) => void;
  error?: string;
  readOnly?: boolean;
  isRecommended?: boolean;
}

export function ImagesPickerField({
  field, value, onChange, error, readOnly, isRecommended,
}: ImagesPickerFieldProps) {
  const list: string[] = Array.isArray(value) ? value : [];
  const min = field.minCount ?? 0;
  const max = field.maxCount ?? 7;

  const add = () => {
    if (list.length >= max) {
      toast.warning(`最多 ${max} 张图`);
      return;
    }
    onChange([...list, '']);
  };
  const remove = (idx: number) => {
    onChange(list.filter((_, i) => i !== idx));
  };
  const update = (idx: number, url: string) => {
    onChange(list.map((u, i) => (i === idx ? url : u)));
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-slate-700">
          {field.label}
          {field.required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
        {isRecommended && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">模板推荐</span>
        )}
        <span className={`text-[10px] px-1.5 py-0.5 rounded ml-auto ${
          list.length < min ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
        }`}>
          {list.length} / {min}~{max} 张
        </span>
      </div>
      <div className="space-y-2">
        {list.map((url, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={url}
              placeholder={`图片 #${idx + 1} URL`}
              disabled={readOnly}
              onChange={(e) => update(idx, e.target.value)}
              className={`flex-1 px-3 py-1.5 text-sm border rounded-md ${
                error ? 'border-rose-400' : 'border-slate-200'
              } ${isRecommended ? 'bg-blue-50' : 'bg-white'} ${
                readOnly ? 'bg-slate-50 cursor-not-allowed' : ''
              }`}
            />
            {!readOnly && (
              <>
                <button
                  type="button"
                  onClick={() => console.warn('[ImagesPickerField] 需接入素材库选择 modal')}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50"
                >
                  选择素材
                </button>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        ))}
        {!readOnly && list.length < max && (
          <button
            type="button"
            onClick={add}
            className="w-full px-3 py-2 text-sm border border-dashed border-slate-300 rounded-md text-slate-500 hover:border-emerald-500 hover:text-emerald-600 flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            添加图片(还剩 {max - list.length} 张额度)
          </button>
        )}
      </div>
      {field.helpText && <div className="text-[11px] text-slate-500">{field.helpText}</div>}
      {error && <div className="text-[11px] text-rose-500">{error}</div>}
    </div>
  );
}
