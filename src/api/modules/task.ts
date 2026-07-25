/**
 * 任务相关 API
 * [2026-07-13] 建任务能力驱动:真实 submit,复用 capability-params/validate
 * [2026-07-16] MVP:加 autoCreateProduct 系列字段,后端在 productId 缺失时自动建产品
 * [2026-07-16] 加 myPage / detail / cancel / retry 对接老版 TaskList
 */
import http from '../client';
import type { PageInfo } from '../service-result';
import type {
  GeneratedImageVO,
  GenerationTaskResponse,
  ImageTaskSubmitPayload,
  ImageTaskSubmitResponse,
  TaskMyPageQueryRequest,
  VideoTaskSubmitPayload,
  VideoTaskSubmitResponse,
} from '../../types';

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

// ==================== [2026-07-16 老版 TaskList 对接] ====================

export const taskApi = {
  /** 我的任务分页(/v1/task/my-page) */
  myPage(req: TaskMyPageQueryRequest): Promise<PageInfo<GenerationTaskResponse>> {
    return http.post<PageInfo<GenerationTaskResponse>>('/v1/task/my-page', req);
  },

  /** 任务详情(/v1/task/detail?id=) */
  detail(id: string): Promise<GenerationTaskResponse> {
    return http.post<GenerationTaskResponse>('/v1/task/detail', null, { params: { id } });
  },

  /** 取消任务(/v1/task/cancel?id=) —— 本期老版 UI 不接,只封装备用 */
  cancel(id: string): Promise<void> {
    return http.post<void>('/v1/task/cancel', null, { params: { id } });
  },

  /**
   * 重试任务(/v1/admin/task/retry?id=)
   * <p>注意:这是 admin 端点,可能被 @SaCheckPermission 拦截;失败 catch 提示「重试需要管理员权限」
   * <p>本期按 spec 决策:统一调 admin 端点试,失败 toast;二期后端加 /v1/task/retry browser 端点
   */
  retry(id: string): Promise<void> {
    return http.post<void>('/v1/admin/task/retry', null, { params: { id } });
  },

  // ==================== [2026-07-24 图片任务产品化重构 Task 12] 图片任务提交 + 生成图拉取 ====================

  /** 提交图片生成任务(/v1/task/submit) —— 返回 groupId + taskIds[] */
  submitImageTask(
    payload: ImageTaskSubmitPayload
  ): Promise<ImageTaskSubmitResponse> {
    return http.post<ImageTaskSubmitResponse>('/v1/task/submit', payload);
  },

  /** 单任务拉取生成图片列表(/v1/task/generated-images) */
  fetchGeneratedImages(taskId: string): Promise<GeneratedImageVO[]> {
    return http.post<GeneratedImageVO[]>('/v1/task/generated-images', {
      id: taskId,
    });
  },

  /** 批量拉取生成图片(/v1/task/generated-images-batch) */
  fetchGeneratedImagesBatch(taskIds: string[]): Promise<GeneratedImageVO[]> {
    return http.post<GeneratedImageVO[]>('/v1/task/generated-images-batch', {
      taskIds,
    });
  },

  /** 提交视频任务(/v1/video-task/submit) —— 返回 groupId + taskIds[] */
  submitVideoTask(
    payload: VideoTaskSubmitPayload
  ): Promise<VideoTaskSubmitResponse> {
    return http.post<VideoTaskSubmitResponse>('/v1/video-task/submit', payload);
  },
};