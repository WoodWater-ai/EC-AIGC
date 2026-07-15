/**
 * 智能模板中心 API 模块
 *
 * PR-2:完全对齐后端 /v1/admin/prompt-template/* 8 个端点 + 1 个批量状态端点.
 * 所有 DTO 严格镜像后端 PromptTemplateResponse(以后端为权威源).
 *
 * @see docs/superpowers/specs/2026-07-10-template-mock-to-real-design.md §7
 */
import http from '../client';
import type { PageInfo } from '../service-result';

// ===== 类型定义(严格镜像后端 PromptTemplateResponse) =====

export type TemplateKind =
  | 'IMAGE_TASK'
  | 'STYLE_SCENE'
  | 'VIDEO_PROMPT'
  | 'PLATFORM_SPEC'
  | 'NEGATIVE_CONSTRAINT';

export type TemplateStatus = 'NORMAL' | 'DISABLED';

export interface TemplateDTO {
  /** id 由基类 BaseIdResponse 提供,后端 @JsonSerialize(ToStringSerializer) 已处理,前端用 string 接收 */
  id: string;
  templateName: string;
  templateKind: TemplateKind;
  code?: string;
  applicableTaskTypes?: string;
  promptBody: string;
  negativePrompt?: string;
  /** 变量定义 JSON 字符串,前端 JSON.parse 后渲染 */
  variables?: string;
  defaultAspectRatio?: string;
  defaultRatio?: string;
  defaultCount?: number;
  /** 后端 @JsonSerialize 已处理,前端 string */
  defaultModelChannelId?: string;
  status: TemplateStatus;
  usageCount: number;
  passRate: number;
  avgCost: number;
  avgScore: number;
  currentVersion?: string;
  sort?: number;
  createTime: string;
  updateTime: string;

  // IMAGE_TASK / STYLE_SCENE
  imageTaskType?: string;
  applicableCategories?: string;
  defaultStyle?: string;
  defaultScene?: string;
  defaultPose?: string;
  applicableImageTypes?: string;

  // VIDEO_PROMPT
  videoDefaultDurationSec?: number;
  videoDefaultResolution?: string;
  videoDefaultMotion?: string;
  videoThreePartStructure?: string;

  // PLATFORM_SPEC
  platformUsage?: string;
  platformFormat?: string;
  platformRecommendedRatio?: string;
  platformWidth?: number;
  platformHeight?: number;
  /** 后端 @JsonSerialize 已处理,前端 string */
  platformMaxFileSize?: string;
  platformIsDefaultRecommended?: string;

  // NEGATIVE_CONSTRAINT
  ncAssetKindScope?: string;
  ncSeverity?: string;
  ncDefaultEnabled?: string;
  ncConflictRules?: string;
}

export interface TemplateQueryRequest {
  pageNum?: number;
  pageSize?: number;
  templateKind?: TemplateKind;
  status?: TemplateStatus;
  keyword?: string;
  /** legacy 4 类字段,后端 QueryRequest 保留 */
  templateType?: string;
}

export interface TemplateCreateRequest {
  templateName: string;
  templateKind: TemplateKind;
  code?: string;
  applicableTaskTypes?: string;
  promptBody: string;
  negativePrompt?: string;
  variables?: string;
  defaultCount?: number;
  defaultModelChannelId?: string;
  defaultAspectRatio?: string; // legacy(V3)
  defaultRatio?: string; // V11 业务主字段

  // IMAGE_TASK / STYLE_SCENE
  defaultStyle?: string;
  defaultScene?: string;
  defaultPose?: string;
  applicableCategories?: string;
  applicableImageTypes?: string;
  imageTaskType?: string;

  // VIDEO_PROMPT
  videoDefaultDurationSec?: number;
  videoDefaultResolution?: string;
  videoDefaultMotion?: string;
  videoThreePartStructure?: string;

  // PLATFORM_SPEC
  platformUsage?: string;
  platformFormat?: string;
  platformRecommendedRatio?: string;
  platformWidth?: number;
  platformHeight?: number;
  platformMaxFileSize?: string;
  platformIsDefaultRecommended?: string;

  // NEGATIVE_CONSTRAINT
  ncAssetKindScope?: string;
  ncSeverity?: string;
  ncDefaultEnabled?: string;
  ncConflictRules?: string;

  /** legacy 4 类字段,后端 AddRequest 保留 */
  templateType?: string;
}

export interface TemplateUpdateRequest extends TemplateCreateRequest {
  /** 后端 UpdateRequest @NotNull 必填 */
  id: string;
  /** 后端 UpdateRequest 允许覆盖 status */
  status?: TemplateStatus;
}

export interface PromptTemplateVersionResponse {
  id: string;
  templateId: string;
  version: string;
  changeSummary: string;
  changeUserId: string;
  usedByTaskCount: number;
  createTime: string;
}

// ===== API 函数(类对象风格,对照 asset.ts) =====

export const templateApi = {
  /** 分页查询(5 类均可,templateKind 必传用于 tab 过滤) */
  page: (q: TemplateQueryRequest) =>
    http.post<PageInfo<TemplateDTO>>('/v1/admin/prompt-template/page', q),

  /** 详情(列表已含全字段,一般无需调) */
  get: (id: string) =>
    http.post<TemplateDTO>('/v1/admin/prompt-template/detail', null, { params: { id } }),

  /** 创建,返回新模板 ID(string) */
  create: (req: TemplateCreateRequest) =>
    http.post<string>('/v1/admin/prompt-template/add', req),

  /** 更新(完整字段覆盖,系统字段由后端保护) */
  update: (req: TemplateUpdateRequest) =>
    http.post<void>('/v1/admin/prompt-template/update', req),

  /** 软删除 */
  delete: (id: string) =>
    http.post<void>('/v1/admin/prompt-template/delete', null, { params: { id } }),

  /** 批量更新状态(NORMAL / DISABLED),单次请求避免循环 */
  batchUpdateStatus: (ids: string[], status: TemplateStatus) =>
    http.post<void>('/v1/admin/prompt-template/batch-update-status', { ids, status }),

  /** 创建版本快照 */
  createVersion: (templateId: string, version: string, changeSummary: string) =>
    http.post<PromptTemplateVersionResponse>(
      '/v1/admin/prompt-template/version/create',
      null,
      { params: { templateId, version, changeSummary } },
    ),

  /** 列出版本快照 */
  listVersions: (templateId: string) =>
    http.post<PromptTemplateVersionResponse[]>(
      '/v1/admin/prompt-template/version/list',
      null,
      { params: { templateId } },
    ),
};
