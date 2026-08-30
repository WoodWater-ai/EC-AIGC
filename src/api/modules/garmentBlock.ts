import http from '../client';
import type { PageInfo } from '../service-result';
import type { GarmentStatus } from './garmentCategory';

export type GarmentScopeType = 'PRIVATE' | 'DEPT' | 'PUBLIC';
export type GarmentView = 'FRONT' | 'BACK' | 'SIDE';
export type GarmentRepresentationType = 'RASTER_2D' | 'VECTOR_2D' | 'LAYERED_2D' | 'MESH_3D' | 'CAD_PATTERN';

export interface GarmentCoordinateProfileInput {
  viewCode: GarmentView;
  canvasWidth: number;
  canvasHeight: number;
  anchors: Record<string, unknown>;
}

export interface GarmentBlockVersion {
  id: string;
  versionNo: number;
  representationType: GarmentRepresentationType;
  viewSet: GarmentView[];
  sizeSchema: Record<string, unknown>;
  contentHash: string;
  status: 'DRAFT' | 'PUBLISHED' | 'DISABLED';
  coordinateProfiles: Array<GarmentCoordinateProfileInput & {
    id: string;
    profileHash: string;
    status: string;
  }>;
}

export interface GarmentBlock {
  id: string;
  familyId: string;
  categoryId: string;
  code: string;
  name: string;
  ownerUserId: string;
  scopeType: GarmentScopeType;
  scopeId?: string;
  currentVersionId?: string;
  rightsStatus: string;
  status: GarmentStatus;
  version: number;
  versions?: GarmentBlockVersion[];
}

export interface GarmentBlockPageRequest {
  pageNum: number;
  pageSize: number;
  categoryId?: string;
  familyId?: string;
  keyword?: string;
  status?: GarmentStatus;
}

export const garmentBlockApi = {
  available: (request: GarmentBlockPageRequest) =>
    http.post<PageInfo<GarmentBlock>>('/v1/user/garment-catalog/blocks', request),
  availableDetail: (id: string) =>
    http.post<GarmentBlock>('/v1/user/garment-catalog/block-detail', { id }),
  page: (request: GarmentBlockPageRequest) =>
    http.post<PageInfo<GarmentBlock>>('/v1/admin/garment-block/page', request),
  detail: (id: string) =>
    http.post<GarmentBlock>('/v1/admin/garment-block/detail', { id }),
  addFamily: (request: { categoryId: string; code: string; name: string }) =>
    http.post<string>('/v1/admin/garment-block/add-family', request),
  add: (request: {
    familyId: string;
    categoryId: string;
    code: string;
    name: string;
    scopeType: GarmentScopeType;
    scopeId?: string;
  }) => http.post<string>('/v1/admin/garment-block/add', request),
  createVersion: (request: {
    blockId: string;
    representationType: GarmentRepresentationType;
    viewSet: GarmentView[];
    sizeSchema?: Record<string, unknown>;
    coordinateProfiles: GarmentCoordinateProfileInput[];
  }) => http.post<string>('/v1/admin/garment-block/create-version', request),
  publishVersion: (id: string) =>
    http.post<void>('/v1/admin/garment-block/publish-version', { id }),
  bindRights: (blockId: string, rightsRecordIds: string[]) =>
    http.post<void>('/v1/admin/garment-block/bind-rights', { blockId, rightsRecordIds }),
};
