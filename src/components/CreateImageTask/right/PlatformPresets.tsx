// src/components/CreateImageTask/right/PlatformPresets.tsx
import React from 'react';
import { messages } from '../../../labels/createImageTask';

export interface PlatformPresetsProps {
  currentRatio: string;
  currentResolution: string;
  onApply: (preset: typeof messages.presetPlatforms[number]) => void;
}

export const PlatformPresets: React.FC<PlatformPresetsProps> = ({ onApply }) => (
  <div className="mt-4">
    <span className="text-xs font-bold text-slate-700">平台规格推荐</span>
    <div className="flex flex-wrap gap-2 mt-2">
      {messages.presetPlatforms.map((preset) => (
        <button
          key={preset.name}
          type="button"
          onClick={() => onApply(preset)}
          className="px-2 py-1.5 text-[11px] font-bold rounded border border-slate-200 hover:border-primary hover:bg-blue-50"
        >
          {preset.name}
        </button>
      ))}
    </div>
  </div>
);
