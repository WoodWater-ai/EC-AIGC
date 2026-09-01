import { http } from '../client';
import type {
  ImagePlanAnalyzeRequest,
  ImagePlanAnalyzeResponse,
} from '../../types';

/**
 * 图片任务规划 - 分析 API。
 *
 * <p>对齐后端 {@code POST /v1/admin/image-task/analyze}。
 * <p>调用方式参考 {@link ./builtinChannel.ts}。
 *
 * @author system
 * @date 2026-07-26
 */
export const imagePlanApi = {
  /**
   * 调用后端图片任务规划接口,产出商品事实 + 5 类 prompt + 负面约束。
   *
   * <p>失败时抛 Error(message 包含后端 errMessage),前端降级到本地拼 prompt。
   */
  analyze: (req: ImagePlanAnalyzeRequest) =>
    http.post<ImagePlanAnalyzeResponse>('/v1/admin/image-task/analyze', req),
};
