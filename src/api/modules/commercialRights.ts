import http from '../client';
import type { PageInfo } from '../service-result';

export type CommercialRightsStatus = 'DRAFT' | 'VALID' | 'EXPIRED' | 'REVOKED' | 'DISPUTED';

export interface CommercialRightsRecord {
  id: string;
  rightsCode: string;
  rightsType: 'ASSET' | 'LICENSE' | 'CONTRACT';
  licensorName: string;
  licenseeName: string;
  licenseType: 'OWNED' | 'PURCHASED' | 'CUSTOM' | 'OTHER';
  commercialUse: boolean;
  derivativeUse: boolean;
  aiProcessing: boolean;
  thirdPartyTransfer: boolean;
  crossBorder: boolean;
  territoryText?: string;
  territoryScope: string[];
  channelScope: string[];
  validFrom?: string;
  validTo?: string;
  evidenceAssetId?: string;
  evidenceFileId: string;
  evidenceHash: string;
  status: CommercialRightsStatus;
  latestReview?: {
    id: string;
    decision: 'PENDING' | 'APPROVE' | 'REJECT';
    reason?: string;
    reviewerUserId?: string;
    reviewTime?: string;
  };
}

export interface CommercialRightsRecordAddRequest {
  rightsCode: string;
  rightsType: CommercialRightsRecord['rightsType'];
  licensorName: string;
  licenseeName: string;
  licenseType: CommercialRightsRecord['licenseType'];
  commercialUse: boolean;
  derivativeUse: boolean;
  aiProcessing: boolean;
  thirdPartyTransfer: boolean;
  crossBorder: boolean;
  territoryText?: string;
  territoryScope?: string[];
  channelScope?: string[];
  validFrom?: string;
  validTo?: string;
  evidenceFileId: string;
  evidenceHash: string;
}

const base = '/v1/admin/rights-record';

export const commercialRightsApi = {
  page: (request: { pageNum: number; pageSize: number; keyword?: string; status?: CommercialRightsStatus }) =>
    http.post<PageInfo<CommercialRightsRecord>>(`${base}/page`, request),
  detail: (id: string) => http.post<CommercialRightsRecord>(`${base}/detail`, { id }),
  add: (request: CommercialRightsRecordAddRequest) => http.post<string>(`${base}/add`, request),
  review: (request: { id: string; decision: 'APPROVE' | 'REJECT'; reason?: string }) =>
    http.post<void>(`${base}/review`, request),
  evidence: (id: string) => http.getBlob(`/v1/admin/compliance-evidence/rights-record/${id}`),
};
