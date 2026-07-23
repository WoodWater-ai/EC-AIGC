// src/components/CreateImageTask/right/ReviewStrategyPanel.tsx
import React from 'react';
import { messages } from '../../../labels/createImageTask';

export interface ReviewStrategyPanelProps {
  reviewEnabled: boolean;
  onChange: (v: boolean) => void;
}

export const ReviewStrategyPanel: React.FC<ReviewStrategyPanelProps> = ({ reviewEnabled, onChange }) => (
  <div className="bg-white border border-slate-200 rounded-lg p-5">
    <h3 className="text-xs font-black">审核策略</h3>
    <label className="mt-3 flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer">
      {messages.header.reviewLabel}
      <input
        type="checkbox"
        checked={reviewEnabled}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-primary h-4 w-4"
      />
    </label>
  </div>
);
