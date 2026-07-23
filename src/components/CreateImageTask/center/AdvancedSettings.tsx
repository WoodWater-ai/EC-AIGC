// src/components/CreateImageTask/center/AdvancedSettings.tsx
import React from 'react';

export interface AdvancedSettingsProps {
  negativePrompt: string;
  onChange: (v: string) => void;
}

export const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({ negativePrompt, onChange }) => (
  <details className="bg-white border border-slate-200 rounded-lg p-4">
    <summary className="cursor-pointer text-xs font-bold text-slate-700">高级设置</summary>
    <label className="mt-3 block">
      <span className="text-xs font-bold text-slate-700">负面约束</span>
      <input
        type="text"
        value={negativePrompt}
        onChange={(e) => onChange(e.target.value)}
        placeholder="blurry, bad quality, distorted"
        className="mt-1.5 w-full h-9 px-2 rounded border border-slate-200 text-xs font-bold"
      />
    </label>
    <p className="mt-1.5 text-[10px] text-slate-400">默认沿用当前模板的约束,可按本次任务覆盖。</p>
  </details>
);
