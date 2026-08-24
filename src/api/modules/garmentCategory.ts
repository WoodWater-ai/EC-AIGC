import http from '../client';
import type { PageInfo } from '../service-result';

export type GarmentStatus = 'DRAFT' | 'NORMAL' | 'ENABLED' | 'DISABLED' | 'ARCHIVED';

export interface GarmentSlotInput {
  slotCode: string;
  name: string;
  partType: string;
  required: boolean;
  maxCount: number;
  dependencyRule?: Record<string, unknown>;
  compatibilityRule?: Record<string, unknown>;
  sort?: number;
}

export interface GarmentSlot extends GarmentSlotInput {
  id: string;
  status: GarmentStatus;
}

export interface GarmentCategory {
  id: string;
  code: string;
  name: string;
  status: GarmentStatus;
  sort: number;
  slots?: GarmentSlot[];
}

export interface GarmentCategoryPageRequest {
  pageNum: number;
  pageSize: number;
  keyword?: string;
  status?: GarmentStatus;
}

export const garmentCategoryApi = {
  available: () => http.post<GarmentCategory[]>('/v1/user/garment-catalog/categories'),
  page: (request: GarmentCategoryPageRequest) =>
    http.post<PageInfo<GarmentCategory>>('/v1/admin/garment-category/page', request),
  detail: (id: string) =>
    http.post<GarmentCategory>('/v1/admin/garment-category/detail', { id }),
  add: (request: { code: string; name: string; sort?: number; slots: GarmentSlotInput[] }) =>
    http.post<string>('/v1/admin/garment-category/add', request),
  update: (request: { id: string; name: string; status?: GarmentStatus; sort?: number }) =>
    http.post<void>('/v1/admin/garment-category/update', request),
  updateSlots: (request: { categoryId: string; slots: GarmentSlotInput[] }) =>
    http.post<void>('/v1/admin/garment-category/update-slots', request),
};
