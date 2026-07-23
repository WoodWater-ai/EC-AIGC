// src/components/CreateImageTask/center/ImageTypeSelector.tsx
import React from 'react';
import type { ImageGenerationType } from '../../../lib/createImageTask/readinessChecks';
import { messages } from '../../../labels/createImageTask';

const TYPE_ORDER: ImageGenerationType[] = ['product_main','scene_detail','detail_closeup','on_model'];
const MIN_TYPE_COUNT = 1;
const MAX_TYPE_COUNT = 5;

export interface ImageTypeSelectorProps {
  selectedTypes: ImageGenerationType[];
  typeCounts: Record<ImageGenerationType, number>;
  maxCountPerType: number;  // 当前模型 capability.maxCount 的上限
  onToggle: (t: ImageGenerationType) => void;
  onChangeCount: (t: ImageGenerationType, delta: number) => void;
}

/**
 * 生成图片类型(可多选)— 对齐 demo 主版:
 * - 4 宫格 grid,每张卡片 76px min-height
 * - 选中:border-primary + bg-blue-50 + icon text-primary + 右上角 4×4 圆框带 check icon
 * - 卡片横向布局(icon 左 + label 中 + 选中框右),给张数调节器预留 pr-24
 * - 张数调节器:仅选中时显示,absolute bottom-2 right-2,白底带边框阴影
 */
export const ImageTypeSelector: React.FC<ImageTypeSelectorProps> = ({
  selectedTypes, typeCounts, maxCountPerType, onToggle, onChangeCount,
}) => (
  <div className="bg-white border border-slate-200 rounded-lg p-5">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[11px] font-bold text-primary">图片类型</p>
        <h2 className="text-base font-black">生成图片类型 <span className="text-slate-400 font-normal">{messages.type.labelHelper}</span></h2>
      </div>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-1.5">
      {TYPE_ORDER.map((t) => {
        const isSelected = selectedTypes.includes(t);
        const count = typeCounts[t];
        const canDecrease = isSelected && count > MIN_TYPE_COUNT;
        const canIncrease = isSelected && count < Math.min(MAX_TYPE_COUNT, maxCountPerType);
        return (
          <div
            key={t}
            className={`relative min-h-[76px] border rounded-md transition-colors ${
              isSelected ? 'border-primary bg-blue-50' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <button
              type="button"
              onClick={() => onToggle(t)}
              aria-label={`${isSelected ? '取消选择' : '选择'}${messages.type[t]}`}
              aria-pressed={isSelected}
              className="absolute inset-0 flex items-center gap-2 rounded-md px-3 pr-24 text-left"
              title={`${isSelected ? '取消选择' : '选择'}${messages.type[t]}`}
            >
              <span className={`material-symbols-outlined shrink-0 text-xl ${isSelected ? 'text-primary' : 'text-slate-500'}`}>{messages.typeIcon[t]}</span>
              <span className="min-w-0 text-xs font-bold leading-4 text-slate-800">{messages.type[t]}</span>
              <span
                aria-hidden="true"
                className={`absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded border ${
                  isSelected ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white'
                }`}
              >
                {isSelected && <span className="material-symbols-outlined text-[11px]">check</span>}
              </span>
            </button>
            {isSelected && (
              <div
                role="group"
                aria-label={`${messages.type[t]}张数`}
                className="absolute bottom-2 right-2 z-10 flex h-7 items-center rounded border border-blue-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  disabled={!canDecrease}
                  onClick={() => onChangeCount(t, -1)}
                  aria-label="减少一张"
                  title="减少一张"
                  className="w-7 h-full flex items-center justify-center text-slate-500 disabled:text-slate-300 hover:text-primary"
                >
                  <span className="material-symbols-outlined text-base">remove</span>
                </button>
                <span aria-live="polite" className="w-7 border-x border-blue-100 text-center text-xs font-black leading-7 text-slate-700">
                  {count}
                </span>
                <button
                  type="button"
                  disabled={!canIncrease}
                  onClick={() => onChangeCount(t, 1)}
                  aria-label="增加一张"
                  title={
                    count >= MAX_TYPE_COUNT
                      ? `每个图片类型最多 ${MAX_TYPE_COUNT} 张`
                      : `当前模型最多生成 ${maxCountPerType} 张`
                  }
                  className="w-7 h-full flex items-center justify-center text-slate-500 disabled:text-slate-300 hover:text-primary"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);