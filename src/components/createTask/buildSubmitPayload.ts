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
  /** [MVP 2026-07-16] slot 资源 URL 列表(逗号分隔),由后端解析为 List<String> 给 Vidu images:[] */
  inputImageUrls?: string;
  schemaParams: Record<string, any>;
  templateId?: string;
  templateVersionId?: string;
  /** 7 个 slot 的资源引用 —— null = 未选 */
  slotRefs: Record<SlotKey, SlotRef | null>;
  // ==================== [MVP 2026-07-16] autoCreateProduct 支持 ====================
  /** MVP:产品由任务提交时"涌现"。true 时 productId 留空由后端按表单字段自动建产品 */
  autoCreateProduct?: boolean;
  productName?: string;
  productCategory?: string;
  productColor?: string;
  productFabric?: string;
  productSellingPoints?: string;
}

/**
 * 把右列表单状态组装成后端 submit 契约
 *
 * [MVP 2026-07-16] productId 改可选:
 * - 真产品 id(数字字符串)→ 原样透传
 * - null/占位('p1' 等 mock 字符串)→ 配合 autoCreateProduct=true,后端按表单字段建产品
 *
 * [MVP 2026-07-16] slotRefs 处理:
 * Vidu 等主流通道的"images"字段是 Array[String],不区分 main/detail,只是顺序列表。
 * 所以这里把 7 个 slot 按"主图 → 上下装 → 参考图"顺序折叠成 inputImageUrls(逗号分隔 URL),
 * 不再塞到 taskParamsJson(否则后端 SchemaValidator 严格白名单会拒收未声明字段)。
 */
export function buildSubmitPayload(state: TaskFormState): SubmitTaskRequest {
  const { slotRefs, schemaParams } = state;

  // 把 slotRefs 折叠成 URL 列表(主图优先,其他按固定顺序)
  // 注意:用 originalUrl(COS 原图),不能用 thumbnailUrl(图床缩略图)
  const slotOrder: SlotKey[] = ['main', 'top', 'bottom', 'detail', 'style', 'scene', 'pose'];
  const urls: string[] = [];
  for (const k of slotOrder) {
    const r = slotRefs[k];
    if (r && r.originalUrl) {
      urls.push(r.originalUrl);
    } else if (r && r.thumbnailUrl) {
      // fallback:无 originalUrl 时用 thumbnailUrl(至少能让请求跑通)
      urls.push(r.thumbnailUrl);
    }
  }
  const inputImageUrls = urls.length > 0 ? urls.join(',') : undefined;

  // [MVP 2026-07-16] productId 真假判定:
  // - 是纯数字字符串 → 真 id,后端 Long 字段接收
  // - 是 'p1'/'p2' 等 mock 字符串 / null / undefined → 走 autoCreateProduct 路径,后端自动建
  const productIdRaw = state.productId;
  const isNumericId = typeof productIdRaw === 'string' && /^\d+$/.test(productIdRaw);
  const finalProductId = isNumericId ? productIdRaw : null;
  const finalAutoCreate = !isNumericId ? (state.autoCreateProduct ?? true) : false;

  // [MVP 2026-07-16] taskParamsJson 只放 schema 声明的字段,不再折叠 slotRefs(slot 改走 inputImageUrls)
  // schemaParams 是 useTaskParams 收集的"能力参数"(如 aspect_ratio 等),空时也用 {} 占位
  const taskParamsJson = JSON.stringify(schemaParams ?? {});

  return {
    title: state.title,
    productId: finalProductId,
    taskType: state.taskType,
    aspectRatio: state.aspectRatio,
    count: state.count,
    modelChannelId: state.channelId ?? state.modelChannelId,
    templateId: state.templateId,
    templateVersionId: state.templateVersionId,
    taskPrompt: state.prompt,
    negativePrompt: state.negativePrompt,
    inputImageIds: state.inputImageIds,
    inputImageUrls,  // [MVP 2026-07-16] slot 资源 URL 列表(逗号分隔),对接 Vidu images:[]
    channelType: state.channelType,
    capability: state.capability,
    modelId: state.modelId,
    taskParamsJson,
    // [MVP 2026-07-16] autoCreateProduct 透传
    autoCreateProduct: finalAutoCreate,
    productName: finalAutoCreate ? state.productName : undefined,
    productCategory: finalAutoCreate ? state.productCategory : undefined,
    productColor: finalAutoCreate ? state.productColor : undefined,
    productFabric: finalAutoCreate ? state.productFabric : undefined,
    productSellingPoints: finalAutoCreate ? state.productSellingPoints : undefined,
  };
}
