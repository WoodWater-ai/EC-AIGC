import http from '../client';
import type { PageInfo } from '../service-result';

export type PersonConsentStatus = 'DRAFT' | 'VALID' | 'REJECTED' | 'EXPIRED' | 'REVOKED' | 'DISPUTED';

export interface PersonConsent {
  id: string;
  consentCode: string;
  modelProfileId: string;
  modelName?: string;
  grantorName: string;
  purposeScopes: string[];
  operationScopes: string[];
  channelScopes: string[];
  territoryScopes: string[];
  territoryText?: string;
  crossBorder: boolean;
  validFrom?: string;
  validTo?: string;
  evidenceFileId: string;
  evidenceHash: string;
  revokedTime?: string;
  revokeReason?: string;
  status: PersonConsentStatus;
  executionBlockers: string[];
  latestReview?: {
    id: string;
    decision: 'PENDING' | 'APPROVE' | 'REJECT' | 'REVOKE';
    reason?: string;
    reviewerUserId?: string;
    reviewTime?: string;
  };
}

export interface PersonConsentAddRequest {
  consentCode: string;
  modelProfileId: string;
  grantorName: string;
  purposeScopes: string[];
  operationScopes: string[];
  channelScopes: string[];
  territoryScopes: string[];
  territoryText?: string;
  crossBorder: boolean;
  validFrom?: string;
  validTo?: string;
  evidenceFileId: string;
  evidenceHash: string;
}

const base = '/v1/admin/person-consent';

export const personConsentApi = {
  page: (request: { pageNum: number; pageSize: number; keyword?: string; status?: PersonConsentStatus; modelProfileId?: string }) =>
    http.post<PageInfo<PersonConsent>>(`${base}/page`, request),
  add: (request: PersonConsentAddRequest) => http.post<string>(`${base}/add`, request),
  review: (request: { reviewId: string; decision: 'APPROVE' | 'REJECT'; reason?: string }) =>
    http.post<void>(`${base}/review`, request),
  revoke: (id: string, reason: string) => http.post<void>(`${base}/revoke`, { id, reason }),
  evidence: (id: string) => http.getBlob(`/v1/admin/compliance-evidence/person-consent/${id}`),
};

export const modelRightsApi = {
  bind: (modelProfileId: string, rightsRecordIds: string[]) =>
    http.post<void>('/v1/admin/model-rights/bind', { modelProfileId, rightsRecordIds }),
};
