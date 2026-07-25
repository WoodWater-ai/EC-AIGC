// src/lib/createImageTask/readinessChecks.ts
import { messages } from '../../labels/createImageTask';

export type ImageGenerationType = 'product_main' | 'scene_detail' | 'detail_closeup' | 'model_front';

export type ReadinessTargetId = 'image-source-section' | 'image-content-section' | 'image-settings-section';

export interface ReadinessCheck {
  id: 1 | 2 | 3 | 4;
  complete: boolean;
  message: string;
  targetId: ReadinessTargetId;
}

export interface ReadinessDeps {
  isProductBound: boolean;
  factsConfirmed: boolean;
  factsComplete: boolean;
  promptsConfirmed: boolean;
  promptsComplete: boolean;
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
      complete: deps.factsConfirmed && deps.factsComplete,
      message: messages.readiness.confirmFacts,
      targetId: 'image-content-section',
    },
    {
      id: 3,
      complete: deps.promptsConfirmed && deps.promptsComplete,
      message: messages.readiness.confirmPrompts,
      targetId: 'image-content-section',
    },
    {
      id: 4,
      complete: deps.isSupported && !deps.channelMaintenance,
      message: messages.readiness.unsupportedSpec,
      targetId: 'image-settings-section',
    },
  ];
}
