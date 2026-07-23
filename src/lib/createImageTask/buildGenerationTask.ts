// src/lib/createImageTask/buildGenerationTask.ts
import type { ImageGenerationType } from './readinessChecks';
import type { ProductAsset, GenerationTask } from '../../types';
import { messages } from '../../labels/createImageTask';

export interface BuildGenerationTaskInput {
  imageType: ImageGenerationType;
  index: number;
  groupId: string;
  product: ProductAsset;
  taskProductName: string;
  productName: string;
  templateName: string;
  promptText: string;
  negativePrompt: string;
  reviewEnabled: boolean;
  ratio: string;
  count: number;
  channel: { id: string; name: string; accessType: string };
  model: {
    id: string;
    name: string;
    estimatedCost: number;
    capability: { ratios: string[]; maxCount: number; resolutions: string[] };
  };
  mainPreviewUrl?: string;
  dateOverride?: Date;
  creator?: string;
}

// GenerationTaskBuildResult matches the GenerationTask interface shape
export type GenerationTaskBuildResult = GenerationTask;

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatTimestamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ` +
    `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
  );
}

export function buildGenerationTask(input: BuildGenerationTaskInput): GenerationTaskBuildResult {
  const timestamp = formatTimestamp(input.dateOverride ?? new Date());
  const productImg = input.mainPreviewUrl ?? input.product.thumbnail;
  const typeLabel = messages.type[input.imageType];
  const task: GenerationTaskBuildResult = {
    id: `I-${Date.now()}-${input.index + 1}`,
    name: `${typeLabel} · ${input.productName} · ${input.templateName}`,
    type: 'image',
    imageType: input.imageType,
    groupId: input.groupId,
    status: 'pending',
    progress: 0,
    productName: input.taskProductName,
    productImg,
    templateName: input.templateName,
    timestamp,
    creator: input.creator ?? '陆永奇',
    modelChannel: `${input.channel.name} / ${input.model.name}`,
    taskPrompt: input.promptText,
    negativePrompt: input.negativePrompt,
    reviewStrategy: { aesthetic: input.reviewEnabled, listing: false },
    params: {
      ratio: input.ratio,
      count: input.count,
      prompt: input.promptText,
      negativePrompt: input.negativePrompt,
      model: input.model.name,
    },
  };
  return task;
}
