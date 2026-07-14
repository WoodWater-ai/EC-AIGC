import type { SubmitTaskRequest } from '../../api/modules/task';

export interface TaskFormState {
  title: string;
  productId: string;
  taskType: string;
  channelType: string;
  capability: string;
  modelId?: string;
  aspectRatio?: string;
  count?: number;
  modelChannelId?: string;
  channelId?: string;
  prompt?: string;
  negativePrompt?: string;
  inputImageIds?: string;
  schemaParams: Record<string, any>;
  templateId?: string;
  templateVersionId?: string;
}

/** 把右列表单状态组装成后端 submit 契约 */
export function buildSubmitPayload(state: TaskFormState): SubmitTaskRequest {
  return {
    title: state.title,
    productId: state.productId,
    taskType: state.taskType,
    aspectRatio: state.aspectRatio,
    count: state.count,
    modelChannelId: state.channelId ?? state.modelChannelId,  // channelId 优先(新链路)
    templateId: state.templateId,
    templateVersionId: state.templateVersionId,
    taskPrompt: state.prompt,
    negativePrompt: state.negativePrompt,
    inputImageIds: state.inputImageIds,
    channelType: state.channelType,
    capability: state.capability,
    modelId: state.modelId,
    taskParamsJson: JSON.stringify(state.schemaParams ?? {}),
  };
}