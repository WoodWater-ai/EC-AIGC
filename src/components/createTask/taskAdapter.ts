/**
 * 父任务响应 → 前端 GenerationTask 适配器
 *
 * [2026-07-16 P0] 老版 TaskList.tsx 改造:后端 GenerationTaskResponse 字段与前端
 * GenerationTask 差异较大,中间加 adapter 统一处理:
 *   1. 后端 6 状态 → 前端 5 状态 映射
 *   2. 关联 product 查询(由 productId 反查 ProductAsset.name/thumbnail)
 *   3. ISO 8601 时间戳 → 友好格式
 *   4. 字段名差异(title → name / modelChannelId → modelChannel 等)
 *
 * 不放 buildSubmitPayload 那种"组装请求"的文件,这里专做"展示适配"。
 */
import type { GenerationTaskResponse, TaskStatus } from '../../types';
import type { GenerationTask, ProductAsset } from '../../types';

/** 后端 6 态 → 前端 5 态(按 spec 决策) */
function mapTaskStatus(s: TaskStatus): GenerationTask['status'] {
  switch (s) {
    case 'DRAFT':
    case 'PENDING':
    case 'GENERATING':
      return 'running';
    case 'PENDING_REVIEW_SCORE':
    case 'PENDING_REVIEW_PUBLISH':
    case 'ARCHIVED':
      return 'completed';
    case 'FAILED':
      return 'failed';
    case 'REJECTED':
    case 'CANCELED':
      return 'rejected';
    default:
      return 'running';
  }
}

/** ISO 8601 → 友好格式 "2026-07-16 14:30",解析失败回退原值 */
function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '';
  // Jackson LocalDateTime 默认输出 "2026-07-16T14:30:00" 形式
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return iso;
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
}

/** 后端 taskType → 前端 type(本期只接图片任务) */
function mapTaskType(taskType: string | null | undefined): 'image' | 'video' {
  if (!taskType) return 'image';
  return taskType.includes('VIDEO') ? 'video' : 'image';
}

/**
 * 后端 GenerationTaskResponse → 前端 GenerationTask
 * @param resp  后端响应
 * @param products  当前用户的 ProductAsset 列表(用于反查 productName / productImg)
 */
export function toUIGenerationTask(
  resp: GenerationTaskResponse,
  products: ProductAsset[],
): GenerationTask {
  const product = resp.productId
    ? products.find((p) => p.id === resp.productId)
    : undefined;

  return {
    id: resp.id,
    name: resp.title,
    type: mapTaskType(resp.taskType),
    status: mapTaskStatus(resp.status),
    progress: resp.progressPercent,
    productName: product?.name ?? '未知商品',
    productImg: product?.thumbnail ?? '',
    templateName: '—',  // 后端 TaskResponse 没带 templateName,本期占位
    timestamp: formatTimestamp(resp.createTime),
    creator: '我',  // MVP 没接用户列表,占位
    resultUrl: undefined,  // 本期不接 generated_image 列表
    errorMsg: resp.failReason ?? undefined,
    feedback: undefined,  // 本期不接 review 列表
    modelChannel: resp.modelChannelId,  // MVP 用 modelChannelId 占位
    params: {
      ratio: resp.aspectRatio ?? undefined,
      model: undefined,
      steps: undefined,
      guidance: undefined,
      prompt: undefined,
      negativePrompt: undefined,
    },
    rating: undefined,
    reviews: undefined,
    generatedImages: undefined,
    costBreakdown: undefined,
  };
}
