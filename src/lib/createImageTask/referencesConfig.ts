// src/lib/createImageTask/referencesConfig.ts
import type { ReferenceSlot } from './extractReferenceInsights';

/** 5 参考图 slot 的规范顺序(与 demo 主版一致) */
export const REFERENCE_SLOTS_INTERNAL: ReferenceSlot[] = ['detail', 'style', 'scene', 'pose', 'model'];

/** 单 slot 元数据(对 UI 渲染与 icon 映射) */
export interface ReferenceSlotMeta {
  slot: ReferenceSlot;
  label: string;
  icon: string;     // Material Symbols
  transitSlot: string;  // TransitPickerButton 的 slot key
}

export const REFERENCE_SLOT_META: Record<ReferenceSlot, ReferenceSlotMeta> = {
  detail: { slot: 'detail', label: '细节', icon: 'zoom_in',          transitSlot: 'reference-detail' },
  style:  { slot: 'style',  label: '风格', icon: 'palette',           transitSlot: 'reference-style'  },
  scene:  { slot: 'scene',  label: '场景', icon: 'landscape',         transitSlot: 'reference-scene'  },
  pose:   { slot: 'pose',   label: '姿势', icon: 'accessibility_new', transitSlot: 'reference-pose'   },
  model:  { slot: 'model',  label: '模特', icon: 'face_3',            transitSlot: 'reference-model'  },
};
