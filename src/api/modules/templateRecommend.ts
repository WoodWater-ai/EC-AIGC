/**
 * 模板推荐参数 API 模块
 *
 * [v2.0 2026-07-13 F1 基础设施] 配合后端 F4 PR(2 个新端点)
 * @see docs/superpowers/plans/2026-07-13-frontend-dark-launch.md §5
 */
import http from '../client';
import type { PageInfo } from '../service-result';

// ===== 类型定义(严格镜像后端 TemplateRecommendParamsResponse) =====

export interface RecommendParamDTO {
  /** 后端 @JsonSerialize 已处理,前端用 string 接收 */
  id: string;
  templateId: string;
  templateName?: string;        // 联表补充,按能力查时可能为 null
  templateVersionId: string;
  channelType: string;
  capabilityCode: string;
  model?: string;               // null/undefined = 任意 model 都用这条推荐
  paramsKey: string;
  paramsJson: string;            // 推荐参数值(JSON 字符串),前端按能力 field type 渲染
  sort: number;
  createTime: string;
  updateTime: string;
}

export interface RecommendParamListRequest {
  pageNum?: number;
  pageSize?: number;
  /** 按维度查:byTemplate / byCapability / byModel / blank */
  view?: 'byTemplate' | 'byCapability' | 'byModel' | 'blank';
  channelType?: string;
  group?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'SOLUTION';
  capability?: string;
  model?: string;
  templateId?: string;
  templateVersionId?: string;
}

export interface RecommendParamAddRequest {
  templateId: string;
  /** [v2.0 2026-07-13 F4 修复] 对齐后端 TemplateRecommendParamsAddRequest 字段名(versionId 不是 templateVersionId) */
  versionId: string;
  channelType: string;
  /** 对齐后端字段名(capability 不是 capabilityCode) */
  capability: string;
  model?: string;
  paramsKey: string;
  paramsJson: string;
  sort: number;
}

export interface RecommendParamUpdateRequest {
  /** [v2.0 2026-07-13 F4 修复] 对齐后端 TemplateRecommendParamsUpdateRequest 字段名(recommendId 不是 id) */
  recommendId: string;
  paramsJson: string;
  sort: number;
}

export interface BlankCoverageItem {
  channelType: string;
  capabilityCode: string;
  model: string;
  missingCount: number;
}

export interface BlankCoverageResponse {
  totalCombinations: number;
  coveredCombinations: number;
  blankCombinations: number;
  coverageRate: number;
  blanks: BlankCoverageItem[];
}

export interface RecommendParamCopyRequest {
  sourceId: string;
  /** [v2.0 2026-07-13 F4 修复] 对齐后端 RecommendParamBatchCopyRequest 字段名 */
  targetTemplateIds: string[];
}

// ===== API 函数(类对象风格) =====

export const recommendParamsApi = {
  /** 分页查询(按 4 维度) */
  page: (q: RecommendParamListRequest) =>
    http.post<PageInfo<RecommendParamDTO>>(
      '/v1/admin/prompt-template/recommend-params/page', q),

  /** [F4 新]按能力查推荐(channelType + capability, model 可空) */
  listByCapability: (req: { channelType: string; capability: string; model?: string }) =>
    http.post<{ list: RecommendParamDTO[] }>(
      '/v1/admin/prompt-template/recommend-params/list-by-capability', req),

  /** [F4 新]空白覆盖率统计 */
  blankCoverage: (req: { channelTypes?: string[] }) =>
    http.post<BlankCoverageResponse>(
      '/v1/admin/prompt-template/recommend-params/blank-coverage', req),

  /** 新增 */
  add: (req: RecommendParamAddRequest) =>
    http.post<string>(
      '/v1/admin/prompt-template/recommend-params/add', req),

  /** 更新 */
  update: (req: RecommendParamUpdateRequest) =>
    http.post<void>(
      '/v1/admin/prompt-template/recommend-params/update', req),

  /** 软删除 */
  delete: (id: string) =>
    http.post<void>(
      '/v1/admin/prompt-template/recommend-params/delete', { id }),

  /** 跨模板复制(批量) */
  batchCopy: (req: RecommendParamCopyRequest) =>
    http.post<number>(
      '/v1/admin/prompt-template/recommend-params/batch-copy', req),

  /** 批量导入(CSV,简化:v1 走 JSON 数组) */
  batchImport: (items: RecommendParamAddRequest[]) =>
    http.post<number>(
      '/v1/admin/prompt-template/recommend-params/batch-import', { items }),
};
