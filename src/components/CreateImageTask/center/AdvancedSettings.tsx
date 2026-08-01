// src/components/CreateImageTask/center/AdvancedSettings.tsx
import React from 'react';

export interface AdvancedSettingsProps {
  negativePrompt: string;
  onChange: (v: string) => void;
}

export const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({ negativePrompt, onChange }) => (
  <details>
    <summary className="cursor-pointer text-[11px] font-bold text-slate-600">高级设置 · 负面约束</summary>
    <label className="mt-3 block">
      <span className="text-[10px] font-bold text-slate-500">负面约束</span>
      <input
        type="text"
        value={negativePrompt}
        onChange={(e) => onChange(e.target.value)}
        placeholder="blurry, bad quality, distorted"
        className="mt-1.5 h-9 w-full border border-slate-200 px-2 text-xs"
      />
    </label>
    <p className="mt-1.5 text-[10px] text-slate-400">默认沿用当前模板的约束,可按本次任务覆盖。</p>
  </details>
);
