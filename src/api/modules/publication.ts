import http from '../client';
import type { PageInfo } from '../service-result';

export type PublicationTargetType = 'APPROVED_GARMENT' | 'TRYON_CANDIDATE';
export type PublicationDecision = 'PASS' | 'WARN' | 'BLOCK';
export type PublicationStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPORTED' | 'RESTRICTED';

export interface PublicationRuleItem {
  ruleCode: string;
  ruleGroup: string;
  decision: PublicationDecision;
  message: string;
  manuallyAccepted: boolean;
  overrideReason?: string;
}

export interface PublicationPreflight {
  ready: boolean;
  machineDecision: PublicationDecision;
  policyVersion: string;
  targetType: PublicationTargetType;
  targetId: string;
  sourceFileResourceId?: string;
  sourcePreviewUrl?: string;
  channelCode: 'PUBLIC_DOWNLOAD';
  regionCode: 'CN';
  items: PublicationRuleItem[];
}

export interface PublicationRecord {
  id: string;
  reviewId: string;
  exportFileResourceId: string;
  exportImageUrl?: string;
  manifestFileResourceId: string;
  manifestUrl?: string;
  channelCode: string;
  regionCode: string;
  labelPolicyVersion: string;
  visibleLabelText: string;
  exportContentSha256: string;
  manifestSha256: string;
  provenanceHash: string;
  exportedTime?: string;
  status: 'ACTIVE' | 'RESTRICTED';
}

export interface PublicationReview {
  id: string;
  submitterUserId: string;
  targetType: PublicationTargetType;
  targetId: string;
  sourceFileResourceId: string;
  sourcePreviewUrl?: string;
  channelCode: string;
  regionCode: string;
  policyVersion: string;
  machineDecision: PublicationDecision;
  humanDecision: 'PENDING' | 'APPROVED' | 'REJECTED';
  status: PublicationStatus;
  sourceSnapshotHash: string;
  reviewerUserId?: string;
  reviewReason?: string;
  submittedTime?: string;
  reviewedTime?: string;
  items: PublicationRuleItem[];
  publicationRecord?: PublicationRecord;
}

export interface ComplianceReadiness {
  productionReady: boolean;
  evidenceAccessAuditTableReady: boolean;
  evidenceScanTableReady: boolean;
  budgetReservationTableReady: boolean;
  garmentBudgetAdministrationReady: boolean;
  controlledObjectAccessReady: boolean;
  scannerEnabled: boolean;
  scannerConfigurationReady: boolean;
  scannerCode?: string;
  scannerPolicyVersion?: string;
  publicationFontReady: boolean;
  publicationFontSha256?: string;
  publicationFontLicenseId?: string;
  publicationFontLicenseSha256?: string;
  publicationFontVersion?: string;
  activeChannelBudgetRequired: boolean;
  garmentRenderRouteReady: boolean;
  garmentRenderProviderProfileReady: boolean;
  garmentRenderCostEstimateReady: boolean;
  garmentRenderBudgetReady: boolean;
  virtualTryonRouteReady: boolean;
  virtualTryonProviderProfileReady: boolean;
  virtualTryonCostEstimateReady: boolean;
  virtualTryonBudgetReady: boolean;
  blockers: string[];
}

const userBase = '/v1/user/publication';
const adminBase = '/v1/admin/publication-review';
const target = (targetType: PublicationTargetType, targetId: string) => ({
  targetType, targetId, channelCode: 'PUBLIC_DOWNLOAD' as const, regionCode: 'CN' as const,
});

export const publicationApi = {
  preflight: (targetType: PublicationTargetType, targetId: string) =>
    http.post<PublicationPreflight>(`${userBase}/preflight`, target(targetType, targetId)),
  submit: (targetType: PublicationTargetType, targetId: string, idempotencyKey: string) =>
    http.post<string>(`${userBase}/submit-review`, { ...target(targetType, targetId), idempotencyKey }),
  page: (request: { pageNum: number; pageSize: number; status?: PublicationStatus; targetType?: PublicationTargetType }) =>
    http.post<PageInfo<PublicationReview>>(`${userBase}/page`, request),
  status: (id: string) => http.post<PublicationReview>(`${userBase}/status`, { id }),
  export: (id: string) => http.post<PublicationRecord>(`${userBase}/export`, { id }),
  adminPage: (request: { pageNum: number; pageSize: number; status?: PublicationStatus; targetType?: PublicationTargetType }) =>
    http.post<PageInfo<PublicationReview>>(`${adminBase}/page`, request),
  adminDetail: (id: string) => http.post<PublicationReview>(`${adminBase}/detail`, { id }),
  complianceReadiness: () => http.get<ComplianceReadiness>('/v1/admin/compliance-readiness'),
  review: (request: {
    id: string;
    decision: 'APPROVE' | 'REJECT';
    reason?: string;
    rightsAndConsentConfirmed: boolean;
    contentSafetyConfirmed: boolean;
    visualFidelityConfirmed: boolean;
    aiLabelConfirmed: boolean;
  }) => http.post<void>(`${adminBase}/review`, request),
};
