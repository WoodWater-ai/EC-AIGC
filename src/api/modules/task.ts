/**
 * 任务相关 API
 * [2026-07-13] 建任务能力驱动:真实 submit,复用 capability-params/validate
 * [2026-07-16] MVP:加 autoCreateProduct 系列字段,后端在 productId 缺失时自动建产品
 */
import http from '../client';

export interface SubmitTaskRequest {
  title: string;
  productId: string | null;
  taskType: string;
  aspectRatio?: string;
  count?: number;
  modelChannelId: string;
  templateId?: string;
  templateVersionId?: string;
  taskPrompt?: string;
  negativePrompt?: string;
  inputImageIds?: string;
  /** [MVP 2026-07-16] 输入图 URL 列表(逗号分隔),后端解析为 List<String> 喂给 Vidu images:[] */
  inputImageUrls?: string;
  // 能力体系
  channelType: string;
  capability: string;
  taskParamsJson: string;
  modelId?: string;
  // [MVP 2026-07-16] autoCreateProduct —— 产品由任务提交时"涌现"
  // dev:后端 prezzie.task.auto-create-product=true 时,productId=null + autoCreateProduct=true
  //    + productName 非空 → 后端按表单字段自动建产品,任务 productId 回填新建 id
  // prod:开关关闭,productId 必填
  autoCreateProduct?: boolean;
  productName?: string;
  productCategory?: string;
  productColor?: string;
  productFabric?: string;
  productSellingPoints?: string;
}

/** 提交任务,返回任务 id(后端 Long → string) */
export async function submitTask(req: SubmitTaskRequest): Promise<string> {
  return http.post<string>('/v1/task/submit', req);
}