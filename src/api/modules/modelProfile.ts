import http from '../client';
import type { PageInfo } from '../service-result';

export type ModelGenerationMode = 'text' | 'reference' | 'face_swap';
export type ModelProfileSourceMode = ModelGenerationMode | 'upload';

export interface ModelProfileDTO {
  id: string;
  assetResourceId: string;
  name: string;
  image: string;
  source: string;
  sourceMode: ModelProfileSourceMode;
  modelType: string;
  licenseStatus: string;
  tags: string[];
  ageFeel?: string;
  facialRatioScore?: number;
  bodyRatio?: string;
  categories: string[];
  suitableFor: string[];
  reason?: string;
  status: 'draft' | 'active' | 'disabled';
  usageCount: number;
  averageAestheticScore: number;
  passRate: number;
  createTime?: string;
}

export interface ModelProfilePageRequest {
  pageNum: number;
  pageSize: number;
  keyword?: string;
  styleTag?: string;
  sourceMode?: ModelProfileSourceMode;
  licenseStatus?: string;
  status?: string;
}

export interface ModelCandidateGenerateRequest {
  mode: ModelGenerationMode;
  prompt?: string;
  referenceAssetId?: string;
  faceSourceAssetId?: string;
  targetAppearanceAssetId?: string;
  candidateCount: number;
  aspectRatio: string;
  resolution: string;
  sourceDescription?: string;
  rightsAccepted: boolean;
}

export interface ModelGenerationPreflight {
  ready: boolean;
  channelId: string;
  channelName: string;
  channelType: string;
  capability: string;
  model: string;
  candidateCount: number;
  estimatedCost?: number | null;
  currency: string;
  billingNote: string;
}

export interface ModelCandidateSubmitResponse {
  taskId: string;
  groupId: string;
  status: string;
}

export interface ModelCandidate {
  generationResultId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  batchIdx: number;
  status: string;
}

export interface ModelCandidateListResponse {
  taskId: string;
  taskStatus: string;
  progressPercent?: number;
  failReason?: string;
  candidates: ModelCandidate[];
}

export interface ModelProfilePublishRequest {
  generationResultId?: string;
  generationResultIds?: string[];
  name: string;
  tags: string[];
  suitableFor?: string[];
  categories?: string[];
  ageFeel?: string;
  bodyRatio?: string;
  reason?: string;
}

/**
 * 将已经上传到资源中心的图片直接保存为模特档案。
 * 多张图片共用基础名称，服务端按顺序追加编号，与候选图发布流程一致。
 */
export interface ModelProfileImportRequest {
  assetResourceIds: string[];
  name: string;
  tags: string[];
  suitableFor?: string[];
  categories?: string[];
  ageFeel?: string;
  bodyRatio?: string;
  reason?: string;
}

export const modelProfileApi = {
  page: (request: ModelProfilePageRequest) =>
    http.post<PageInfo<ModelProfileDTO>>('/v1/admin/model-profile/page', request),

  preflight: (request: ModelCandidateGenerateRequest) =>
    http.post<ModelGenerationPreflight>('/v1/admin/model-profile/preflight', request),

  generate: (request: ModelCandidateGenerateRequest) =>
    http.post<ModelCandidateSubmitResponse>('/v1/admin/model-profile/generate', request),

  candidates: (taskId: string) =>
    http.post<ModelCandidateListResponse>('/v1/admin/model-profile/candidates', { taskId }),

  publish: (request: ModelProfilePublishRequest) =>
    http.post<string[]>('/v1/admin/model-profile/publish', request),

  importExisting: (request: ModelProfileImportRequest) =>
    http.post<string[]>('/v1/admin/model-profile/import', request),
};
