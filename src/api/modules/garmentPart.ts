import http from '../client';
import type { PageInfo } from '../service-result';
import type { GarmentRepresentationType, GarmentScopeType, GarmentView } from './garmentBlock';

export type GarmentPartSourceMode = 'UPLOAD' | 'CUTOUT' | 'AI_EXTRACT' | 'INTERNAL';
export type GarmentPartReuseLevel = 'PROJECT' | 'BLOCK_FAMILY' | 'CATEGORY';
export type GarmentPartProcessStatus =
  | 'DRAFT'
  | 'PROCESSING'
  | 'NEEDS_ADJUSTMENT'
  | 'READY_FOR_REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'FAILED'
  | 'DISABLED';

export interface GarmentPartSource {
  id: string;
  sourceMode: GarmentPartSourceMode;
  sourceAssetId: string;
  cutoutAssetId?: string;
  sourceDescription?: string;
  ownerUserId: string;
  scopeType: GarmentScopeType;
  scopeId?: string;
  detectedPartType?: string;
  detectedViewCode?: GarmentView;
  processStatus: GarmentPartProcessStatus;
  processSnapshot: Record<string, unknown>;
  status: string;
}

export interface GarmentPartVersion {
  id: string;
  versionNo: number;
  viewCode: GarmentView;
  representationType: GarmentRepresentationType;
  geometryAssetId: string;
  maskAssetId?: string;
  previewAssetId: string;
  anchorSchema: Record<string, unknown>;
  deformationRule: Record<string, unknown>;
  layerRule: Record<string, unknown>;
  contentHash: string;
  engineCode?: string;
  engineVersion?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'DISABLED';
}

export interface GarmentPartBinding {
  id: string;
  partTemplateVersionId: string;
  bindingScope: 'EXACT_BLOCK' | 'BLOCK_FAMILY';
  blockVersionId?: string;
  blockFamilyId?: string;
  viewCode: GarmentView;
  anchorMapping: Record<string, unknown>;
  transform: Record<string, unknown>;
  deformationMesh: Record<string, unknown>;
  coverageMaskAssetId?: string;
  layerOrder: number;
  confidenceScore?: number;
  status: 'DRAFT' | 'VERIFIED' | 'REJECTED' | 'DISABLED';
}

export interface GarmentPartReview {
  id: string;
  templateVersionId: string;
  requestedScopeType: Exclude<GarmentScopeType, 'PRIVATE'>;
  requestedScopeId?: string;
  decision: 'PENDING' | 'APPROVE' | 'REJECT';
  reason?: string;
  reviewerUserId?: string;
  reviewTime?: string;
}

export interface GarmentPart {
  id: string;
  sourceId: string;
  categoryId?: string;
  code: string;
  name: string;
  partType: string;
  slotCode: string;
  reuseLevel: GarmentPartReuseLevel;
  ownerUserId: string;
  scopeType: GarmentScopeType;
  scopeId?: string;
  currentVersionId?: string;
  previewAssetId?: string;
  rightsStatus: string;
  processStatus: GarmentPartProcessStatus;
  status: string;
  version: number;
  versions?: GarmentPartVersion[];
  bindings?: GarmentPartBinding[];
  latestReview?: GarmentPartReview;
}

export interface GarmentPartPageRequest {
  pageNum: number;
  pageSize: number;
  categoryId?: string;
  partType?: string;
  slotCode?: string;
  keyword?: string;
  processStatus?: GarmentPartProcessStatus;
  scopeType?: GarmentScopeType;
  mineOnly?: boolean;
}

export interface GarmentPartImportRequest {
  sourceAssetId: string;
  cutoutAssetId?: string;
  sourceMode: GarmentPartSourceMode;
  sourceDescription?: string;
  scopeType: GarmentScopeType;
  scopeId?: string;
  rightsRecordIds?: string[];
}

export interface GarmentPartCreateVersionRequest {
  sourceId: string;
  templateId?: string;
  categoryId?: string;
  code: string;
  name: string;
  partType: string;
  slotCode: string;
  reuseLevel: GarmentPartReuseLevel;
  viewCode: GarmentView;
  representationType: GarmentRepresentationType;
  geometryAssetId: string;
  maskAssetId?: string;
  previewAssetId: string;
  anchorSchema: Record<string, unknown>;
  deformationRule?: Record<string, unknown>;
  layerRule?: Record<string, unknown>;
  engineCode?: string;
  engineVersion?: string;
}

export interface GarmentPartSaveBindingRequest {
  partTemplateVersionId: string;
  bindingScope: 'EXACT_BLOCK' | 'BLOCK_FAMILY';
  blockVersionId?: string;
  blockFamilyId?: string;
  viewCode: GarmentView;
  anchorMapping: Record<string, unknown>;
  transform?: Record<string, unknown>;
  deformationMesh?: Record<string, unknown>;
  coverageMaskAssetId?: string;
  layerOrder?: number;
  confidenceScore?: number;
  engineCode?: string;
  engineVersion?: string;
}

const adminBase = '/v1/admin/garment-part';
const userBase = '/v1/user/garment-part';

export const garmentPartApi = {
  myPage: (request: GarmentPartPageRequest) =>
    http.post<PageInfo<GarmentPart>>(`${userBase}/my-page`, request),
  adminPage: (request: GarmentPartPageRequest) =>
    http.post<PageInfo<GarmentPart>>(`${adminBase}/page`, request),
  sourcePage: (request: { pageNum: number; pageSize: number; processStatus?: string; sourceMode?: string }) =>
    http.post<PageInfo<GarmentPartSource>>(`${userBase}/source-page`, request),
  detail: (id: string, admin = false) =>
    http.post<GarmentPart>(`${admin ? adminBase : userBase}/detail`, { id }),
  importSource: (request: GarmentPartImportRequest, admin = false) =>
    http.post<string>(`${admin ? adminBase : userBase}/import`, request),
  saveAdjustment: (request: {
    sourceId: string;
    cutoutAssetId: string;
    partType: string;
    viewCode: GarmentView;
    processSnapshot?: Record<string, unknown>;
  }, admin = false) => http.post<void>(`${admin ? adminBase : userBase}/save-adjustment`, request),
  createVersion: (request: GarmentPartCreateVersionRequest, admin = false) =>
    http.post<string>(`${admin ? adminBase : userBase}/create-version`, request),
  saveProjectBinding: (request: GarmentPartSaveBindingRequest) =>
    http.post<string>(`${userBase}/save-project-binding`, request),
  saveAdminBinding: (request: GarmentPartSaveBindingRequest) =>
    http.post<string>(`${adminBase}/save-binding`, request),
  verifyBinding: (id: string) =>
    http.post<void>(`${adminBase}/verify-binding`, { id }),
  submitLibraryReview: (request: {
    templateId: string;
    targetScopeType: Exclude<GarmentScopeType, 'PRIVATE'>;
    targetScopeId?: string;
    reason?: string;
  }) => http.post<string>(`${userBase}/submit-library-review`, request),
  review: (request: { id: string; decision: 'APPROVE' | 'REJECT'; reason?: string }) =>
    http.post<void>(`${adminBase}/review`, request),
  publish: (id: string) => http.post<void>(`${adminBase}/publish`, { id }),
  bindRights: (request: { templateId: string; rightsRecordIds: string[] }) =>
    http.post<void>(`${adminBase}/bind-rights`, request),
};
