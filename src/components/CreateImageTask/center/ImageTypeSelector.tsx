// src/components/CreateImageTask/center/ImageTypeSelector.tsx
import React from 'react';
import type { ImageGenerationType } from '../../../lib/createImageTask/readinessChecks';
import { messages } from '../../../labels/createImageTask';

const TYPE_ORDER: ImageGenerationType[] = ['product_main','scene_detail','detail_closeup','model_triple_view','product_detail'];
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
 * - 5 宫格 grid,每张卡片 76px min-height
 * - 选中:border-primary + bg-blue-50 + icon text-primary + 右上角 4×4 圆框带 check icon
 * - 卡片横向布局(icon 左 + label 中 + 选中框右),给张数调节器预留 pr-24
 * - 张数调节器:仅选中时显示,absolute bottom-2 right-2,白底带边框阴影
 */
export const ImageTypeSelector: React.FC<ImageTypeSelectorProps> = ({
  selectedTypes, typeCounts, maxCountPerType, onToggle, onChangeCount,
}) => (
  <div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {TYPE_ORDER.map((t) => {
        const isSelected = selectedTypes.includes(t);
        const count = typeCounts[t];
        const canDecrease = isSelected && count > MIN_TYPE_COUNT;
        const canIncrease = isSelected && count < Math.min(MAX_TYPE_COUNT, maxCountPerType);
        return (
          <div
            key={t}
            className={`relative flex h-16 min-w-0 items-center border px-2 transition-colors ${
              isSelected ? 'border-[#df5b43] bg-[#fff5f1]' : 'border-slate-200 bg-slate-50 opacity-70 hover:opacity-100'
            }`}
          >
            <button
              type="button"
              onClick={() => onToggle(t)}
              aria-label={`${isSelected ? '取消选择' : '选择'}${messages.type[t]}`}
              aria-pressed={isSelected}
              className="absolute inset-0 flex min-w-0 items-center gap-1.5 px-2 pr-[76px] text-left"
              title={`${isSelected ? '取消选择' : '选择'}${messages.type[t]}`}
            >
              <span className={`material-symbols-outlined shrink-0 text-base ${isSelected ? 'text-primary' : 'text-slate-400'}`}>
                {isSelected ? 'check_circle' : messages.typeIcon[t]}
              </span>
              <span className="min-w-0 truncate text-[11px] font-bold text-slate-700">{messages.type[t]}</span>
            </button>
            {isSelected && (
              <div
                role="group"
                aria-label={`${messages.type[t]}张数`}
                className="absolute right-2 z-10 flex items-center border border-slate-200 bg-white text-[11px]"
              >
                <button
                  type="button"
                  disabled={!canDecrease}
                  onClick={() => onChangeCount(t, -1)}
                  aria-label="减少一张"
                  title="减少一张"
                  className="grid h-6 w-5 place-items-center text-slate-500 disabled:text-slate-300"
                >
                  −
                </button>
                <span aria-live="polite" className="w-4 text-center font-bold">
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
                  className="grid h-6 w-5 place-items-center text-slate-500 disabled:text-slate-300"
                >
                  +
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);
