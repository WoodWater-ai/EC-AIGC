// src/components/CreateImageTask/left/CompositeSection.tsx
import React from 'react';
import { OutfitComposePanel } from '../../common/OutfitComposePanel';
import type { AppliedCompositeAsset } from '../../common/OutfitComposePanel';

export interface CompositeSectionProps {
  onApplied: (asset: AppliedCompositeAsset) => void;
}

/** 左栏主体素材下方的上下装合成入口。 */
export const CompositeSection: React.FC<CompositeSectionProps> = ({ onApplied }) => {
  return (
    <OutfitComposePanel
      defaultCollapsed
      onApplied={onApplied}
    />
  );
};
