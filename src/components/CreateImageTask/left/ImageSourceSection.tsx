// src/components/CreateImageTask/left/ImageSourceSection.tsx
import React from 'react';
import { Info } from 'lucide-react';

export interface ImageSourceSectionProps {
  mainValue: import('../../createTask/slots').SlotRef | null;
  productName?: string;
  matchingProduct?: boolean;
  onPickMain: () => void;
  onShowProductFacts?: () => void;
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
  onShowProductFacts,
}) => {
  return (
    <section id="image-source-section" className="border border-[#dfe3e8] bg-white p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-bold text-[#df5b43]">创作商品</p>
          <h2 className="mt-0.5 text-xs font-black">主体素材</h2>
        </div>
        <button
          type="button"
          onClick={onPickMain}
          className="h-7 border border-slate-200 px-2 text-[10px] font-bold text-slate-600 hover:border-primary hover:text-primary"
        >
          资源中心
        </button>
      </div>

      <div className="mt-3">
        {mainValue ? (
          <button
            type="button"
            onClick={onPickMain}
            className="w-full overflow-hidden border border-slate-200 bg-slate-50 text-left"
          >
            {/* 容器固定 aspect-[4/3] + max-h-[256px]:长图/宽图按比例 contain,
                不会撑出父容器,也不会被裁。 */}
            <div className="flex aspect-[4/3] w-full max-h-[220px] items-center justify-center">
              <img
                src={mainValue.thumbnailUrl ?? mainValue.originalUrl}
                alt={mainValue.name ?? ''}
                className="max-w-full max-h-full object-contain"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-2 py-1.5">
              <span className="truncate text-[10px] font-bold text-slate-700">{mainValue.name || 'ERP 首图'}</span>
              <span className="shrink-0 text-[9px] font-bold text-[#df5b43]">更换</span>
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={onPickMain}
            aria-label="添加主体素材"
            className="flex h-40 w-full flex-col items-center justify-center gap-2 border border-dashed border-slate-300 bg-slate-50 text-slate-400 transition-colors hover:border-primary hover:bg-[#fff5f1] hover:text-primary"
          >
            <span className="material-symbols-outlined text-4xl">add</span>
            <span className="text-xs font-bold">添加主体素材</span>
          </button>
        )}
      </div>
      {mainValue && (
        <div className="mt-2 flex items-center justify-between gap-3 border border-[#dfe3e8] bg-[#fbfcfd] px-2 py-2">
          <span className="shrink-0 text-[11px] font-bold text-slate-500">关联商品</span>
          <span className="flex min-w-0 items-center justify-end gap-1.5">
            <span className="min-w-0 truncate text-xs font-black text-primary">
              {matchingProduct ? '正在匹配商品…' : productName || '待创建商品'}
            </span>
            {productName && !matchingProduct && onShowProductFacts && (
              <button
                type="button"
                onClick={onShowProductFacts}
                className="grid h-5 w-5 shrink-0 place-items-center text-slate-400 transition-colors hover:text-primary"
                title="查看 ERP 商品事实"
                aria-label="查看 ERP 商品事实"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        </div>
      )}
    </section>
  );
};
