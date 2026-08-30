import http from '../client';
import type { PageInfo } from '../service-result';

export interface GarmentAvailablePart {
  templateId: string;
  templateVersionId: string;
  bindingId: string;
  categoryId: string;
  name: string;
  code: string;
  partType: string;
  slotCode: string;
  scopeType: string;
  previewAssetId: string;
  layerOrder: number;
  bindingScope: 'EXACT_BLOCK' | 'BLOCK_FAMILY';
  viewCode: 'FRONT' | 'BACK' | 'SIDE';
  partAnchorSchema: Record<string, unknown>;
  bindingAnchorMapping: Record<string, unknown>;
  bindingTransform: Record<string, unknown>;
  bindingDeformationMesh: Record<string, unknown>;
}

export interface GarmentDesignPartInstance {
  id: string;
  slotDefinitionId: string;
  partTemplateVersionId: string;
  partBindingId: string;
  instanceIndex: number;
  transform: Record<string, unknown>;
  overrideMaskAssetId?: string;
  layerOrder: number;
  status: string;
}

export interface GarmentDesignVersion {
  id: string;
  versionNo: number;
  blockVersionId: string;
  baseVersionId?: string;
  materialId?: string;
  color: Record<string, unknown>;
  previewAssetId?: string;
  contentHash: string;
  status: 'LOCKED' | 'DISABLED';
  partsSnapshotSchemaVersion?: number;
  partsSnapshot?: Array<Record<string, unknown>>;
  parts?: GarmentDesignPartInstance[];
}

export interface GarmentDesign {
  id: string;
  designCode: string;
  name: string;
  categoryId: string;
  ownerUserId: string;
  scopeType: string;
  scopeId?: string;
  currentVersionId?: string;
  approvedGarmentId?: string;
  status: string;
  version: number;
  versions?: GarmentDesignVersion[];
  currentVersion?: GarmentDesignVersion;
}

export interface GarmentDesignPartInput {
  slotDefinitionId: string;
  partTemplateVersionId: string;
  partBindingId: string;
  instanceIndex: number;
  transform?: Record<string, unknown>;
  overrideMaskAssetId?: string;
  layerOrder?: number;
}

const base = '/v1/user/garment-design';

export const garmentDesignApi = {
  page: (request: { pageNum: number; pageSize: number; categoryId?: string; keyword?: string; status?: string }) =>
    http.post<PageInfo<GarmentDesign>>(`${base}/page`, request),
  add: (request: { categoryId: string; designCode: string; name: string }) =>
    http.post<string>(`${base}/add`, request),
  detail: (id: string) => http.post<GarmentDesign>(`${base}/detail`, { id }),
  versionDetail: (id: string) => http.post<GarmentDesign>(`${base}/version-detail`, { id }),
  availableParts: (request: { categoryId: string; blockVersionId: string; slotDefinitionId?: string; viewCode?: 'FRONT' | 'BACK' | 'SIDE' }) =>
    http.post<GarmentAvailablePart[]>(`${base}/available-parts`, request),
  compatibilityCheck: (request: { blockVersionId: string; slotDefinitionId: string; partTemplateVersionId: string }) =>
    http.post<{ compatible: boolean; level: string; score: number; reasons: string[]; bindingId: string; effectiveTransform: Record<string, unknown> }>(`${base}/compatibility-check`, request),
  saveVersion: (request: {
    designId: string;
    blockVersionId: string;
    baseVersionId?: string;
    parts: GarmentDesignPartInput[];
    materialId?: string;
    color?: Record<string, unknown>;
    previewAssetId?: string;
  }) => http.post<string>(`${base}/save-version`, request),
  archive: (id: string) => http.post<void>(`${base}/archive`, { id }),
};
