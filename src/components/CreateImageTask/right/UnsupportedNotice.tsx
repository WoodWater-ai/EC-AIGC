// src/components/CreateImageTask/right/UnsupportedNotice.tsx
import React from 'react';

export interface UnsupportedNoticeProps {
  show: boolean;
}

export const UnsupportedNotice: React.FC<UnsupportedNoticeProps> = ({ show }) => {
  if (!show) return null;
  return (
    <p role="alert" className="mt-3 text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
      当前模型不支持该比例/尺寸/张数,请调整比例、尺寸或选择其他模型。
    </p>
  );
};
