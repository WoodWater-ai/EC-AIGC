// src/components/CreateImageTask/left/ProductPickerCard.tsx
// 左栏-选择产品卡片:位于"输入素材"上方
// 未选:虚线占位 + icon + "选择产品"
// 已选:缩略图 + 产品名 + "更换"
import React from 'react';
import { withCosThumbnail } from '../../../utils/cosImage';
import { AssetImage } from '../../AssetImage';
import type { ProductDTO } from '../../../api/modules/productInfo';

export interface ProductPickerCardProps {
  /** 当前已选产品(null = 未选) */
  selectedProduct: ProductDTO | null;
  onPick: () => void;
  onClear?: () => void;
}

/**
 * 卡片宽度与"输入素材"卡片一致 — 通过外层 section 统一管(同 gap / 同 padding)
 * 这里只管自身内容。
 */
export const ProductPickerCard: React.FC<ProductPickerCardProps> = ({
  selectedProduct, onPick, onClear,
}) => (
  <div
    id="product-picker-card"
    className="bg-white border border-slate-200 rounded-lg p-4"
  >
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-black">选择产品</h2>
      {selectedProduct ? (
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-slate-400 hover:text-red-500 font-bold"
          title="清除选择"
          aria-label="清除选择"
        >
          清除
        </button>
      ) : (
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">必填</span>
      )}
    </div>

    {selectedProduct ? (
      <button
        type="button"
        onClick={onPick}
        aria-label="更换产品"
        className="w-full flex items-center gap-3 p-2 rounded-md border border-primary bg-blue-50 hover:bg-blue-100 transition-colors text-left"
      >
        <div className="w-12 h-12 shrink-0 rounded overflow-hidden bg-slate-100 relative">
          {selectedProduct.imageUrl ? (
            <AssetImage
              urls={[withCosThumbnail(selectedProduct.imageUrl, 128) ?? selectedProduct.imageUrl]}
              alt={selectedProduct.name}
              className="w-full h-full"
              aspectRatio="auto"
            />
          ) : (
            <span className="material-symbols-outlined text-2xl text-slate-400 w-full h-full flex items-center justify-center">image</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-primary truncate" title={selectedProduct.name}>
            {selectedProduct.name}
          </p>
          <p className="text-[10px] text-slate-500 truncate mt-0.5">
            {selectedProduct.category ?? '未分类'} · {selectedProduct.statusDesc}
          </p>
        </div>
        <span className="material-symbols-outlined text-base text-primary shrink-0">edit</span>
      </button>
    ) : (
      <button
        type="button"
        onClick={onPick}
        aria-label="选择产品"
        className="w-full h-20 rounded-md border-2 border-dashed border-slate-300 bg-slate-50 hover:border-primary hover:bg-blue-50 transition-colors flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-primary"
      >
        <span className="material-symbols-outlined text-2xl">inventory_2</span>
        <span className="text-[11px] font-bold">从产品库选择</span>
      </button>
    )}
  </div>
);