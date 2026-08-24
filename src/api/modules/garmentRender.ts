import http from '../client';
import type { PageInfo } from '../service-result';

export interface GarmentRenderPreflight {
  ready: boolean;
  blockers: string[];
  designId?: string;
  designVersionId: string;
  designContentHash?: string;
  previewAssetId?: string;
  channelId?: string;
  channelName?: string;
  channelType?: string;
  modelCode?: string;
  providerProfileId?: string;
  providerProfileCode?: string;
  agreementVersion?: string;
  estimatedCost?: string;
}

export interface GarmentRenderCandidate {
  id: string;
  outputIndex: number;
  fileResourceId: string;
  imageUrl?: string;
  contentSha256: string;
  width?: number;
  height?: number;
  safetyStatus: 'UNREVIEWED' | 'PASSED' | 'REJECTED';
  status: 'READY' | 'SELECTED' | 'DISCARDED';
}

export interface GarmentRenderTask {
  id: string;
  designId: string;
  designVersionId: string;
  idempotencyKey: string;
  channelType: string;
  modelCode: string;
  providerProfileId: string;
  requestHash: string;
  requestedCandidateCount: number;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'PARTIAL_FAILED' | 'FAILED' | 'BLOCKED';
  failureType?: string;
  providerErrorCode?: string;
  failureMessage?: string;
  providerCost?: string;
  estimatedCost?: string;
  accountedCost?: string;
  costBasis?: 'PROVIDER_ACTUAL' | 'CONFIGURED_ESTIMATE_FALLBACK' | 'NOT_INVOKED' | 'RECONCILIATION_REQUIRED';
  durationMs?: string;
  createTime?: string;
  completedAt?: string;
  candidates: GarmentRenderCandidate[];
}

export interface ApprovedGarment {
  id: string;
  designId: string;
  designVersionId: string;
  sourceCandidateId: string;
  fileResourceId: string;
  imageUrl?: string;
  provenanceHash: string;
  status: 'INTERNAL_READY' | 'PUBLISH_READY' | 'PUBLISHED' | 'REVOKED';
  approvedAt: string;
}

const base = '/v1/user/garment-render';

export const garmentRenderApi = {
  preflight: (designVersionId: string, candidateCount: number) =>
    http.post<GarmentRenderPreflight>(`${base}/preflight`, { designVersionId, candidateCount }),
  submit: (request: { designVersionId: string; idempotencyKey: string; candidateCount: number; artDirectionCode: 'NEUTRAL_STUDIO' | 'SOFT_NATURAL_LIGHT' | 'TEXTURE_DETAIL' | 'ECOMMERCE_CATALOG' }) =>
    http.post<string>(`${base}/submit`, request),
  page: (request: { pageNum: number; pageSize: number; designId?: string; status?: GarmentRenderTask['status'] }) =>
    http.post<PageInfo<GarmentRenderTask>>(`${base}/page`, request),
  detail: (id: string) => http.post<GarmentRenderTask>(`${base}/detail`, { id }),
  lockCandidate: (candidateId: string) =>
    http.post<ApprovedGarment>(`${base}/lock-candidate`, { candidateId, confirmInternalUse: true }),
  currentApproved: (designId: string) =>
    http.post<ApprovedGarment | null>(`${base}/current-approved`, { id: designId }),
};
