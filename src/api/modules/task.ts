/**
 * 任务相关 API
 * [2026-07-13] 建任务能力驱动:真实 submit,复用 capability-params/validate
 */
import http from '../client';

export interface SubmitTaskRequest {
  title: string;
  productId: string;
  taskType: string;
  aspectRatio?: string;
  count?: number;
  modelChannelId: string;
  templateId?: string;
  templateVersionId?: string;
  taskPrompt?: string;
  negativePrompt?: string;
  inputImageIds?: string;
  // 能力体系
  channelType: string;
  capability: string;
  taskParamsJson: string;
  modelId?: string;
}

/** 提交任务,返回任务 id(后端 Long → string) */
export async function submitTask(req: SubmitTaskRequest): Promise<string> {
  return http.post<string>('/v1/task/submit', req);
}