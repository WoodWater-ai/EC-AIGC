// src/lib/createImageTask/readinessChecks.ts
import { messages } from '../../labels/createImageTask';

export type ImageGenerationType = 'product_main' | 'scene_detail' | 'detail_closeup' | 'model_triple_view' | 'product_detail';

export type ReadinessTargetId = 'image-source-section' | 'image-content-section' | 'image-settings-section';

export interface ReadinessCheck {
  id: 1 | 2 | 3 | 4;
  complete: boolean;
  message: string;
  targetId: ReadinessTargetId;
}

export interface ReadinessDeps {
  isProductBound: boolean;
  promptsComplete: boolean;
  executionParamsReady: boolean;
  isSupported: boolean;
  channelMaintenance: boolean;
}

export function computeReadinessChecks(deps: ReadinessDeps): ReadinessCheck[] {
  return [
    {
      id: 1,
      complete: deps.isProductBound,
      message: messages.readiness.selectMain,
      targetId: 'image-source-section',
    },
    {
      id: 2,
      complete: deps.promptsComplete,
      message: messages.readiness.completePrompts,
      targetId: 'image-content-section',
    },
    {
      id: 3,
      complete: deps.executionParamsReady,
      message: messages.readiness.selectExecutionParams,
      targetId: 'image-settings-section',
    },
    {
      id: 4,
      complete: deps.isSupported && !deps.channelMaintenance,
      message: messages.readiness.unsupportedSpec,
      targetId: 'image-settings-section',
    },
  ];
}
