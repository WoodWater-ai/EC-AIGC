// [新增 2026-08-15] videoDemo 风格 schema 字段渲染器
// SELECT/NUMBER/TEXT 走 CompactParamPicker 视觉(对齐视频任务模型配置卡片);
// 其他复杂字段(JSON/IMAGE/AUDIO/DICT/MULTI_SELECT/TEXTAREA/BOOLEAN)回退到原始 field 组件。
import React from 'react';
import { Cpu, Layers, Route } from 'lucide-react';
import { CompactParamPicker, type CompactParamOption } from '../CompactParamPicker';
import { NumberField } from './fields/NumberField';
import { TextField } from './fields/TextField';
import { TextAreaField } from './fields/TextAreaField';
import { SelectField } from './fields/SelectField';
import { MultiSelectField } from './fields/MultiSelectField';
import { JsonField } from './fields/JsonField';
import { ImagePickerField } from './fields/ImagePickerField';
import { ImagesPickerField } from './fields/ImagesPickerField';
import { DictField } from './fields/DictField';
import VideoPickerField from './fields/VideoPickerField';
import AudioPickerField from './fields/AudioPickerField';
import LipRefPickerField from './fields/LipRefPickerField';
import type { FieldDef } from '../../../api/modules/capability';

export interface VideoDemoFieldProps {
  field: FieldDef;
  value: any;
  onChange: (v: any) => void;
  error?: string;
  readOnly?: boolean;
  isRecommended?: boolean;
}

/**
 * 视频任务模型配置卡片专用 schema 字段渲染。
 * 与 model/通道/能力 picker 同一视觉族(图标 + label + 值 + 箭头 / 内嵌 input)。
 */
export function VideoDemoField({
  field, value, onChange, error, readOnly, isRecommended,
}: VideoDemoFieldProps) {
  switch (field.type) {
    case 'SELECT': {
      const options: CompactParamOption[] = (field.options ?? []).map((o) => ({
        value: o.value,
        label: o.label,
      }));
      if (!field.required && field.defaultValue === undefined) {
        options.unshift({ value: '', label: '未设置' });
      }
      return (
        <CompactParamPicker
          label={field.label}
          icon={iconForKey(field.key)}
          value={String(value ?? '')}
          options={options}
          disabled={readOnly}
          placeholder={field.placeholder ?? '请选择'}
          widthClassName="w-full"
          onChange={(next) => onChange(next)}
        />
      );
    }
    case 'INT':
    case 'DECIMAL': {
      const numericValue = value === undefined || value === null ? '' : String(value);
      return (
        <div className="w-full">
          <div className="flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white py-1 pl-1 pr-2 text-xs transition focus-within:border-primary">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-100 bg-slate-50 text-slate-500">
              {iconForKey(field.key)}
            </span>
            <span className="shrink-0 whitespace-normal break-words text-[10px] font-bold leading-tight text-slate-400">{field.label}</span>
            <input
              type="number"
              value={numericValue}
              min={field.min}
              max={field.max}
              placeholder={field.placeholder ?? '自动'}
              disabled={readOnly}
              onChange={(event) => {
                const raw = event.target.value;
                if (raw === '') {
                  onChange(undefined);
                  return;
                }
                onChange(Number(raw));
              }}
              className="min-w-0 flex-1 bg-transparent text-right text-[11px] font-bold text-slate-700 outline-none placeholder:text-slate-300 disabled:cursor-not-allowed"
            />
          </div>
          {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
        </div>
      );
    }
    case 'TEXT': {
      return (
        <div className="w-full">
          <div className="flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white py-1 pl-1 pr-2 text-xs transition focus-within:border-primary">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-100 bg-slate-50 text-slate-500">
              {iconForKey(field.key)}
            </span>
            <span className="shrink-0 whitespace-normal break-words text-[10px] font-bold leading-tight text-slate-400">{field.label}</span>
            <input
              type="text"
              value={value ?? ''}
              placeholder={field.placeholder ?? ''}
              disabled={readOnly}
              onChange={(event) => onChange(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[11px] font-bold text-slate-700 outline-none placeholder:text-slate-300 disabled:cursor-not-allowed"
            />
          </div>
          {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
        </div>
      );
    }
    // 复杂字段回退到 default 渲染(antd Input/Select 等)
    case 'TEXTAREA':
      return <TextAreaField field={field} value={value} onChange={onChange} error={error} readOnly={readOnly} isRecommended={isRecommended} />;
    case 'BOOLEAN': {
      const checked = value === true || value === 'true';
      return (
        <div className="w-full">
          <div className="flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white py-1 pl-1 pr-2 text-xs transition focus-within:border-primary">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-100 bg-slate-50 text-slate-500">
              {iconForKey(field.key)}
            </span>
            <span className="shrink-0 whitespace-normal break-words text-[10px] font-bold leading-tight text-slate-400">{field.label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={checked}
              disabled={readOnly}
              onClick={() => onChange(!checked)}
              className={`relative ml-auto inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
                checked ? 'bg-primary' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                  checked ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
            <span className={`shrink-0 text-[11px] font-bold ${checked ? 'text-primary' : 'text-slate-400'}`}>
              {checked ? '开启' : '关闭'}
            </span>
          </div>
          {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
        </div>
      );
    }
    case 'MULTI_SELECT':
      return <MultiSelectField field={field} value={value} onChange={onChange} error={error} readOnly={readOnly} isRecommended={isRecommended} />;
    case 'JSON':
      return <JsonField field={field} value={value} onChange={onChange} error={error} readOnly={readOnly} isRecommended={isRecommended} />;
    case 'IMAGE_URL':
      return <ImagePickerField field={field} value={value} onChange={onChange} error={error} readOnly={readOnly} isRecommended={isRecommended} />;
    case 'IMAGES_URL':
      return <ImagesPickerField field={field} value={value} onChange={onChange} error={error} readOnly={readOnly} isRecommended={isRecommended} />;
    case 'DICT':
      return <DictField field={field} value={value} onChange={onChange} error={error} readOnly={readOnly} isRecommended={isRecommended} />;
    case 'VIDEO_URL':
      return <VideoPickerField field={field} value={value} onChange={onChange} />;
    case 'AUDIO_URL':
      return <AudioPickerField field={field} value={value} onChange={onChange} />;
    case 'LIP_REF_URL':
      return <LipRefPickerField field={field} value={value} onChange={onChange} />;
    default:
      // 兜底:回退到默认渲染
      return <SelectField field={field} value={value} onChange={onChange} error={error} readOnly={readOnly} isRecommended={isRecommended} />;
  }
}

/**
 * 根据 field.key 选择 lucide 图标;fallback 用 Cpu。
 */
function iconForKey(key: string) {
  if (key === 'aspect_ratio') return <Route className="h-4 w-4" />;
  if (key === 'duration') return <Layers className="h-4 w-4" />;
  return <Cpu className="h-4 w-4" />;
}