import http from '../client';
import type { BaseIdResponse, PageInfo } from '../service-result';

export type DictItemStatus = 'NORMAL' | 'DISABLED';

export interface DictItem {
  id: string;
  categoryId: string;
  itemCode: string;
  itemName: string;
  describe?: string;
  sort?: number;
  status: DictItemStatus;
  extra?: string;
  createTime?: string;
  updateTime?: string;
}

export interface DictItemExtra {
  imageUrl?: string;
  fileResourceId?: string;
  fileKey?: string;
  [key: string]: unknown;
}

export interface DictOption {
  value: string;
  label: string;
  id: string;
  description?: string;
  imageUrl?: string;
  fileResourceId?: string;
  fileKey?: string;
}

export interface DictCategory {
  id: string;
  categoryCode: string;
  categoryName: string;
  sort?: number;
}

export interface DictCategoryCreateRequest {
  categoryCode: string;
  categoryName: string;
  sort?: number;
}

export interface DictCategoryUpdateRequest {
  id: string;
  categoryName?: string;
  sort?: number;
}

export interface DictCategoryQueryRequest {
  pageNum: number;
  pageSize: number;
  keyword?: string;
}

export interface DictCategoryDeleteRequest {
  id: string;
}

export interface DictItemCreateRequest {
  categoryId: string;
  itemCode: string;
  itemName: string;
  describe?: string;
  sort?: number;
  extra?: string;
}

export interface DictItemUpdateRequest {
  id: string;
  itemName?: string;
  describe?: string;
  sort?: number;
  extra?: string;
}

export interface DictItemQueryRequest {
  pageNum: number;
  pageSize: number;
  categoryId?: string;
  keyword?: string;
  status?: DictItemStatus;
}

export interface DictItemChangeStatusRequest {
  id: string;
  status: DictItemStatus;
}

export const dictApi = {
  listItemsByCode: (categoryCode: string) =>
    http.post<DictItem[]>('/v1/admin/dict/item/list-by-code', null, {
      params: { categoryCode },
    }),

  listCategories: () =>
    http.post<DictCategory[]>('/v1/admin/dict/category/list'),

  mapAll: () =>
    http.post<Record<string, DictItem[]>>('/v1/admin/dict/map-all'),

  pageCategories: (req: DictCategoryQueryRequest) =>
    http.post<PageInfo<DictCategory>>('/v1/admin/dict/category/page', req),
  createCategory: (req: DictCategoryCreateRequest) =>
    http.post<BaseIdResponse>('/v1/admin/dict/category/create', req),
  updateCategory: (req: DictCategoryUpdateRequest) =>
    http.post('/v1/admin/dict/category/update', req),
  deleteCategory: (id: string) =>
    http.post('/v1/admin/dict/category/delete', { id } as DictCategoryDeleteRequest),

  pageItems: (req: DictItemQueryRequest) =>
    http.post<PageInfo<DictItem>>('/v1/admin/dict/item/page', req),
  createItem: (req: DictItemCreateRequest) =>
    http.post<BaseIdResponse>('/v1/admin/dict/item/create', req),
  updateItem: (req: DictItemUpdateRequest) =>
    http.post('/v1/admin/dict/item/update', req),
  changeItemStatus: (req: DictItemChangeStatusRequest) =>
    http.post('/v1/admin/dict/item/change-status', req),
};

/** 安全解析字典项扩展字段，兼容历史空值或非 JSON 数据。 */
export function parseDictItemExtra(extra?: string): DictItemExtra {
  if (!extra) return {};
  try {
    const parsed: unknown = JSON.parse(extra);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as DictItemExtra)
      : {};
  } catch {
    return {};
  }
}

/** 只暴露启用的字典项，并将图片扩展信息转换成表单选项。 */
export function toDictOptions(items: DictItem[] | undefined | null): DictOption[] {
  if (!items) return [];
  return items
    .filter((item) => item.status === 'NORMAL')
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((item) => {
      const extra = parseDictItemExtra(item.extra);
      return {
        value: item.itemCode,
        label: item.itemName,
        id: item.id,
        description: item.describe,
        imageUrl: typeof extra.imageUrl === 'string' ? extra.imageUrl : undefined,
        fileResourceId: typeof extra.fileResourceId === 'string' ? extra.fileResourceId : undefined,
        fileKey: typeof extra.fileKey === 'string' ? extra.fileKey : undefined,
      };
    });
}
