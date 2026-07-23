// src/components/CreateImageTask/right/ModelSelector.tsx
import React from 'react';

export interface ModelOption { channelId: string; modelId: string; label: string }
export interface ModelSelectorProps {
  options: ModelOption[];
  value: { channelId: string | null; modelId: string | null };
  onChange: (next: { channelId: string; modelId: string }) => void;
  locked?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ options, value, onChange, locked }) => (
  <label className="block">
    <span className="text-xs font-bold text-slate-700">模型{locked ? ' 🔒' : ''}</span>
    <select
      value={value.modelId ?? ''}
      disabled={locked}
      onChange={(e) => {
        const opt = options.find((o) => o.modelId === e.target.value);
        if (opt) onChange({ channelId: opt.channelId, modelId: opt.modelId });
      }}
      className="mt-1.5 w-full h-9 rounded-md border border-slate-200 px-2 text-xs font-medium bg-white"
    >
      {options.length === 0 && <option>未配默认模型 (手填)</option>}
      {options.map((opt) => (
        <option key={opt.modelId} value={opt.modelId}>{opt.label}</option>
      ))}
    </select>
  </label>
);
