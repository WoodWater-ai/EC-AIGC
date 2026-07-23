// src/components/CreateImageTask/left/CompositeSection.tsx
import React from 'react';
import { OutfitComposePanel } from '../../common/OutfitComposePanel';
import type { AppliedCompositeAsset } from '../../common/OutfitComposePanel';

export interface CompositeSectionProps {
  productId: string | number | undefined;
  onApplied: (asset: AppliedCompositeAsset) => void;
}

/**
 * 左栏-上下装合成区
 * 仅在户外服饰品类显示;用于生成商品合成套图(复用已有 OutfitComposePanel)
 */
export const CompositeSection: React.FC<CompositeSectionProps> = ({ productId, onApplied }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <h2 className="text-sm font-black">上下装合成</h2>
      <p className="text-[10px] text-slate-400 mt-1">仅在户外服饰品类显示;用于生成商品合成套图(原 OutfitComposePanel)</p>
      <div className="mt-3">
        <OutfitComposePanel
          productId={productId}
          defaultCollapsed={false}
          onApplied={onApplied}
        />
      </div>
    </div>
  );
};
