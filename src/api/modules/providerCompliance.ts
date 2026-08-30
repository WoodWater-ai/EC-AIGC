import http from '../client';
import type { PageInfo } from '../service-result';

export type ProviderComplianceStatus = 'DRAFT' | 'VALID' | 'REJECTED' | 'SUSPENDED' | 'EXPIRED';

export interface ProviderComplianceProfile {
  id: string;
  profileCode: string;
  channelId: string;
  channelType: string;
  providerName: string;
  capabilityCode: 'GARMENT_RENDER' | 'VIRTUAL_TRY_ON';
  modelCode: string;
  agreementName: string;
  agreementVersion: string;
  agreementFileId: string;
  agreementSha256: string;
  commercialOutput: boolean;
  providerTrainingUse: boolean;
  ipTermsReviewed: boolean;
  portraitProcessing: boolean;
  subprocessorDisclosed: boolean;
  crossBorderTransfer: boolean;
  crossBorderApproved: boolean;
  dataRegion?: string;
  destinationRegions: string[];
  legalBasisText?: string;
  inputRetentionDays: number;
  deletionSlaHours?: number;
  validFrom?: string;
  validTo?: string;
  riskNotes?: string;
  status: ProviderComplianceStatus;
  executionBlockers: string[];
  latestReview?: {
    id: string;
    decision: 'PENDING' | 'APPROVE' | 'REJECT' | 'SUSPEND';
    reason?: string;
    reviewerUserId?: string;
    reviewTime?: string;
  };
}

export interface ProviderComplianceProfileCreate {
  profileCode: string;
  channelId: string;
  providerName: string;
  capabilityCode: 'GARMENT_RENDER' | 'VIRTUAL_TRY_ON';
  modelCode: string;
  agreementName: string;
  agreementVersion: string;
  agreementFileId: string;
  agreementSha256: string;
  commercialOutput: boolean;
  providerTrainingUse: boolean;
  ipTermsReviewed: boolean;
  portraitProcessing: boolean;
  subprocessorDisclosed: boolean;
  crossBorderTransfer: boolean;
  crossBorderApproved: boolean;
  dataRegion?: string;
  destinationRegions?: string[];
  legalBasisText?: string;
  inputRetentionDays: number;
  deletionSlaHours?: number;
  validFrom?: string;
  validTo?: string;
  riskNotes?: string;
}

const base = '/v1/admin/provider-compliance-profile';

export const providerComplianceApi = {
  page: (request: { pageNum: number; pageSize: number; keyword?: string; status?: ProviderComplianceStatus; capabilityCode?: string }) =>
    http.post<PageInfo<ProviderComplianceProfile>>(`${base}/page`, request),
  add: (request: ProviderComplianceProfileCreate) => http.post<string>(`${base}/add`, request),
  detail: (id: string) => http.post<ProviderComplianceProfile>(`${base}/detail`, { id }),
  review: (request: { id: string; decision: 'APPROVE' | 'REJECT'; reason?: string }) =>
    http.post<void>(`${base}/review`, request),
  suspend: (id: string, reason: string) => http.post<void>(`${base}/suspend`, { id, reason }),
  evidence: (id: string) => http.getBlob(`/v1/admin/compliance-evidence/provider-profile/${id}`),
};
