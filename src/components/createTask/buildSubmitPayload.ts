import type { SubmitTaskRequest } from '../../api/modules/task';
import type { SlotKey, SlotRef } from './slots';

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
  /** 7 个 slot 的资源引用 —— null = 未选 */
  slotRefs: Record<SlotKey, SlotRef | null>;
}

/** 把右列表单状态组装成后端 submit 契约 */
export function buildSubmitPayload(state: TaskFormState): SubmitTaskRequest {
  const { slotRefs } = state;

  // 把非 null slot 折叠成 { main: fileResId, top: ..., ... },供后端解析
  // 后端 SubmitTaskRequest 暂未提供独立 slot 字段,fallback 到 taskParamsJson
  // 全 null 时不写 key,避免无意义空对象
  const slotMap: Partial<Record<SlotKey, number>> = {};
  let hasAnySlot = false;
  (Object.keys(slotRefs) as SlotKey[]).forEach((k) => {
    const r = slotRefs[k];
    if (r !== null) {
      slotMap[k] = r.fileResourceId;
      hasAnySlot = true;
    }
  });

  const baseTaskParams = state.schemaParams ?? {};
  const taskParamsJson = hasAnySlot
    ? JSON.stringify({ ...baseTaskParams, slotRefs: slotMap })
    : JSON.stringify(baseTaskParams);

  return {
    title: state.title,
    productId: state.productId,
    taskType: state.taskType,
    aspectRatio: state.aspectRatio,
    count: state.count,
    modelChannelId: state.channelId ?? state.modelChannelId,
    templateId: state.templateId,
    templateVersionId: state.templateVersionId,
    taskPrompt: state.prompt,
    negativePrompt: state.negativePrompt,
    inputImageIds: state.inputImageIds,
    channelType: state.channelType,
    capability: state.capability,
    modelId: state.modelId,
    taskParamsJson,
  };
}
