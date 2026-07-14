// [新增 2026-07-13 F1 补强] 字典引用字段
// 从 useDictOptions 拉字典项,渲染为单选 Select
// 要求 FieldDef.dictCode 非空(后端契约)
// [v2.0 修订] 移除 antd,改用 Tailwind + lucide-react(项目 UI 库)
import React from 'react';
import { ChevronDown, BookText } from 'lucide-react';
import { useDictOptions } from '../../../../api/hooks/useDict';
import type { FieldDef } from '../../../../api/modules/capability';

export interface DictFieldProps {
  field: FieldDef;
  value: any;
  onChange: (v: any) => void;
  error?: string;
  readOnly?: boolean;
  isRecommended?: boolean;
}

export function DictField({
  field, value, onChange, error, readOnly, isRecommended,
}: DictFieldProps) {
  const { options, loading } = useDictOptions(field.dictCode);
  const dictLabel = field.dictCode ?? '?';

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
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 flex items-center gap-1">
          <BookText className="w-3 h-3" />
          字典: {dictLabel}
        </span>
      </div>
      <div className="relative">
        <select
          value={value ?? ''}
          disabled={readOnly || loading}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={`w-full px-3 py-1.5 text-sm border rounded-md appearance-none pr-8 ${
            error ? 'border-rose-400' : 'border-slate-200'
          } ${isRecommended ? 'bg-blue-50' : 'bg-white'} ${
            readOnly || loading ? 'bg-slate-50 cursor-not-allowed' : ''
          }`}
        >
          <option value="">{loading ? '加载中…' : `请选择 ${field.label}`}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
      {field.helpText && <div className="text-[11px] text-slate-500">{field.helpText}</div>}
      {error && <div className="text-[11px] text-rose-500">{error}</div>}
    </div>
  );
}
