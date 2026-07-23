import React from 'react';
import { messages } from '../../../labels/createImageTask';

export type ReadinessStatus = 'selectMain' | 'confirmFacts' | 'confirmPrompts' | 'unsupportedSpec';

export interface ReadinessState {
  selectMain: boolean;
  confirmFacts: boolean;
  confirmPrompts: boolean;
  unsupportedSpec: boolean;
}

interface ReadinessBannerProps {
  readiness: ReadinessState;
}

/** 每项 readiness 的图标 + 文案 */
const READINESS_ITEMS: { key: ReadinessStatus; icon: string; label: string }[] = [
  { key: 'selectMain',      icon: 'photo_library',      label: messages.readiness.selectMain },
  { key: 'confirmFacts',    icon: 'fact_check',         label: messages.readiness.confirmFacts },
  { key: 'confirmPrompts',  icon: 'checklist',          label: messages.readiness.confirmPrompts },
  { key: 'unsupportedSpec', icon: 'warning',            label: messages.readiness.unsupportedSpec },
];

/**
 * ReadinessBanner
 * 显示「生成准备度」4 项检查项的状态；
 * 全部完成时自动隐藏，有未完成项时以 amber 警告风格展示。
 */
export const ReadinessBanner: React.FC<ReadinessBannerProps> = ({ readiness }) => {
  const incomplete = READINESS_ITEMS.filter((item) => !readiness[item.key]);

  if (incomplete.length === 0) return null;

  return (
    <div
      className="animate-[fadeInDown_200ms_ease-out] bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-start gap-3"
      role="alert"
      aria-label="生成准备度检查项"
    >
      {/* Banner 全局图标 */}
      <span className="material-symbols-outlined text-amber-500 text-xl mt-0.5 shrink-0">
        {messages.banner.icon}
      </span>

      {/* 右侧：检查项列表 */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-amber-700 mb-1.5 leading-tight">
          {messages.header.readiness}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {incomplete.map((item) => (
            <div key={item.key} className="flex items-center gap-1.5 text-xs text-amber-600">
              <span className="material-symbols-outlined text-sm leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReadinessBanner;
