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
  <div className="bg-white border border-slate-200 rounded-lg p-4">
    <p className="text-[11px] font-bold text-primary">模板</p>
    <h2 className="text-base font-black mt-1">选择模板</h2>
    <div className="mt-2">
      <label className="block">
        <span className="sr-only">{messages.template.select}</span>
        <select
          value={value}
          onChange={(e) => onPickRequest(e.target.value)}
          className="w-full h-9 px-2 rounded-md border border-slate-200 text-xs font-bold bg-white"
        >
          {options.map((t) => (
            <option key={t.id} value={t.name}>{t.name}</option>
          ))}
        </select>
      </label>
    </div>
    {options.length === 0 && (
      <p className="mt-2 text-[10px] text-slate-400">{messages.template.emptyHint}</p>
    )}
  </div>
);
