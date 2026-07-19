/**
 * 字典管理 API 模块.
 *
 * 模板中心 (TemplateCenter) 5 个 tab 涉及 10 类下拉字典:
 *   IMAGE_TASK_TYPE / STYLE_DIMENSION / VIDEO_MODE / VIDEO_DURATION /
 *   VIDEO_MOTION / PLATFORM_FORMAT / NC_ASSET_SCOPE / NC_SEVERITY /
 *   NC_CATEGORY / TEMPLATE_TASK_TYPE
 *
 * 现有 7 个 category 中 TASK_TYPE 可复用为 PLATFORM_USAGE 候选项.
 *
 * 后端端点:
 *   POST /v1/admin/dict/item/list-by-code?categoryCode=xxx
 *   POST /v1/admin/dict/category/list
 *   POST /v1/admin/dict/map-all
 *   POST /v1/admin/dict/category/page
 *   POST /v1/admin/dict/category/create
 *   POST /v1/admin/dict/category/update
 *   POST /v1/admin/dict/category/delete
 *   POST /v1/admin/dict/item/page
 *   POST /v1/admin/dict/item/create
 *   POST /v1/admin/dict/item/update
 *   POST /v1/admin/dict/item/change-status
 */
import http from '../client';
import type { BaseIdResponse, PageInfo } from '../service-result';
import type { PageInfo } from '../service-result';

/** 字典项 DTO(后端 DictItemResponse 的前端镜像) */
export interface DictItem {
  id: string;
  categoryId: string;
  itemCode: string;
  itemName: string;
  describe?: string;
  sort?: number;
  status: 'NORMAL' | 'DISABLED';
  extra?: string;
  createTime?: string;
  updateTime?: string;
}

/** 字典项便捷形态(给前端 <option> 用) */
export interface DictOption {
  value: string; // itemCode
  label: string; // itemName
  id: string; // 后端 id(用户特别要求携带)
}

// ==================== [2026-07-19] 字典管理新增类型 ====================

/** 字典项状态(后端 EnumDictItemStatus 镜像) */
export type DictItemStatus = 'NORMAL' | 'DISABLED';

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
}

export interface DictItemUpdateRequest {
  id: string;
  itemName?: string;
  describe?: string;
  sort?: number;
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
  /** 按 categoryCode 拉字典项列表 */
  listItemsByCode: (categoryCode: string) =>
    http.post<DictItem[]>(
      '/v1/admin/dict/item/list-by-code',
      null,
      { params: { categoryCode } },
    ),

  /** 列所有字典分类(本任务暂不用) */
  listCategories: () =>
    http.post<DictCategory[]>('/v1/admin/dict/category/list'),

  /** 一次取全量(categoryCode → items)(本任务暂不用) */
  mapAll: () =>
    http.post<Record<string, DictItem[]>>('/v1/admin/dict/map-all'),

  // === [2026-07-19] 分类 CRUD ===
  pageCategories: (req: DictCategoryQueryRequest) =>
    http.post<PageInfo<DictCategory>>('/v1/admin/dict/category/page', req),
  createCategory: (req: DictCategoryCreateRequest) =>
    http.post<BaseIdResponse>('/v1/admin/dict/category/create', req),
  updateCategory: (req: DictCategoryUpdateRequest) =>
    http.post('/v1/admin/dict/category/update', req),
  deleteCategory: (id: string) =>
    http.post('/v1/admin/dict/category/delete', { id } as DictCategoryDeleteRequest),

  // === [2026-07-19] 字典项 CRUD ===
  pageItems: (req: DictItemQueryRequest) =>
    http.post<PageInfo<DictItem>>('/v1/admin/dict/item/page', req),
  createItem: (req: DictItemCreateRequest) =>
    http.post<BaseIdResponse>('/v1/admin/dict/item/create', req),
  updateItem: (req: DictItemUpdateRequest) =>
    http.post('/v1/admin/dict/item/update', req),
  changeItemStatus: (req: DictItemChangeStatusRequest) =>
    http.post('/v1/admin/dict/item/change-status', req),
};

export interface DictCategory {
  id: string;
  categoryCode: string;
  categoryName: string;
  sort?: number;
}

/** DictItem[] → DictOption[] 转换工具(给前端 <option> 用) */
export function toDictOptions(items: DictItem[] | undefined | null): DictOption[] {
  if (!items) return [];
  return items
    .filter((it) => it.status === 'NORMAL')
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((it) => ({
      value: it.itemCode,
      label: it.itemName,
      id: it.id,
    }));
}
