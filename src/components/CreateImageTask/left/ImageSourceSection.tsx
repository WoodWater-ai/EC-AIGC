// src/components/CreateImageTask/left/ImageSourceSection.tsx
import React from 'react';
import { TransitPickerButton } from '../../common/TransitPickerButton';

export interface ImageSourceSectionProps {
  mainValue: import('../../createTask/slots').SlotRef | null;
  productName?: string;
  matchingProduct?: boolean;
  onPickMain: () => void;
}

/**
 * 左栏-素材区:主体素材选择入口
 * - 已选:显示缩略图,点击重新选择
 * - 未选:虚线占位引导添加
 * 内部复用 TransitPickerButton(main slot),点击统一由 onPickMain 回调父容器打开 picker
 */
export const ImageSourceSection: React.FC<ImageSourceSectionProps> = ({
  mainValue,
  productName,
  matchingProduct,
  onPickMain,
}) => {
  return (
    <div id="image-source-section" className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black">输入素材</h2>
        <button
          type="button"
          onClick={onPickMain}
          className="text-xs text-primary font-bold hover:underline"
        >
          资源中心
        </button>
      </div>

      <div className="mt-3">
        {mainValue ? (
          <button
            type="button"
            onClick={onPickMain}
            className="w-full rounded-md border border-slate-100 overflow-hidden bg-slate-100"
          >
            {/* 容器固定 aspect-[4/3] + max-h-[256px]:长图/宽图按比例 contain,
                不会撑出父容器,也不会被裁。 */}
            <div className="w-full aspect-[4/3] max-h-[256px] flex items-center justify-center">
              <img
                src={mainValue.thumbnailUrl ?? mainValue.originalUrl}
                alt={mainValue.name ?? ''}
                className="max-w-full max-h-full object-contain"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="px-2 py-1 text-xs font-bold truncate">{mainValue.name}</div>
          </button>
        ) : (
          <button
            type="button"
            onClick={onPickMain}
            aria-label="添加主体素材"
            className="w-full h-44 rounded-md border-2 border-dashed border-slate-300 bg-slate-50 hover:border-primary hover:bg-blue-50 transition-colors flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-primary"
          >
            <span className="material-symbols-outlined text-4xl">add</span>
            <span className="text-xs font-bold">添加主体素材</span>
          </button>
        )}
      </div>
      {mainValue && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
          <span className="shrink-0 text-[11px] font-bold text-slate-500">关联商品</span>
          <span className="min-w-0 truncate text-xs font-black text-primary">
            {matchingProduct ? '正在匹配商品…' : productName || '待创建商品'}
          </span>
        </div>
      )}
    </div>
  );
};
