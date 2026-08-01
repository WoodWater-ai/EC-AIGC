// src/components/CreateImageTask/center/TemplatePicker.tsx
import React from 'react';
import { messages } from '../../../labels/createImageTask';

export interface TemplateOption { id: string; name: string }

export interface TemplatePickerProps {
  value: string;
  options: TemplateOption[];
  onPickRequest: (name: string) => void;  // 走 requestTemplateChange(父级 useCreateImageTaskState)
}

export const TemplatePicker: React.FC<TemplatePickerProps> = ({ value, options, onPickRequest }) => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] font-bold text-slate-400">模板</span>
    <div>
      <label className="block">
        <span className="sr-only">{messages.template.select}</span>
        <select
          value={value}
          onChange={(e) => onPickRequest(e.target.value)}
          className="h-9 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700"
        >
          {options.map((t) => (
            <option key={t.id} value={t.name}>{t.name}</option>
          ))}
        </select>
      </label>
    </div>
    {options.length === 0 && (
      <p className="text-[10px] text-slate-400">{messages.template.emptyHint}</p>
    )}
  </div>
);
