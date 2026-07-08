import http from '../client';
import type { PageInfo } from '../service-result';

/**
 * 素材资源 API 封装
 *
 * 5 个函数对应后端 AdminAssetResourceController:
 *   - page           分页查询(支持 uploadUserId / startTime / endTime / keyword / categoryId 等)
 *   - get            详情
 *   - create         通过 fileResourceId 创建业务资源(Spec-B 主路径,内部自动 confirm)
 *   - delete         删除资源(内部自动 release file_resource)
 *   - updateCategories  更新分类关联
 */

export interface AssetResourceQueryRequest {
  pageNum?: number;
  pageSize?: number;
  assetKind?: 'IMAGE' | 'VIDEO';
  assetType?: string;
  productId?: number;
  categoryId?: number;
  keyword?: string;
  /** 上传人 ID,用于筛'我上传的' */
  uploadUserId?: number;
  /** 创建时间起点(包含,ISO 字符串) */
  startTime?: string;
  /** 创建时间终点(包含,ISO 字符串) */
  endTime?: string;
}

export interface AssetResourceItem {
  id: number;
  resourceCode?: string;
  name: string;
  assetKind: 'IMAGE' | 'VIDEO';
  assetType?: string;
  ossKey?: string;
  fileSize?: number;
  mimeType?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  thumbnailUrl?: string;
  /** 原图 URL(后端 v2 新增,优先级高于 thumbnailUrl) */
  originalUrl?: string;
  description?: string;
  /** 标签(逗号分隔) */
  tags?: string;
  uploadUserId: number;
  productId?: number;
  recognitionId?: number;
  /** 关联 file_resource.id(Spec-B 主路径) */
  fileResourceId?: number;
  status: 'NORMAL' | 'ARCHIVED';
  categoryIds: number[];
  createTime?: string;
}

export interface AssetResourceCreateRequest {
  /** file_resource.id(由 /file/upload-complete 返回) */
  fileResourceId: number;
  name: string;
  assetKind?: 'IMAGE' | 'VIDEO';
  assetType?: string;
  productId?: number;
  recognitionId?: number;
  description?: string;
  tags?: string;
  thumbnailUrl?: string;
  categoryIds?: number[];
}

export const assetApi = {
  page: (req: AssetResourceQueryRequest) =>
    http.post<PageInfo<AssetResourceItem>>('/v1/admin/asset/page', req),

  get: (id: number) =>
    http.post<AssetResourceItem>('/v1/admin/asset/get', { id }),

  create: (req: AssetResourceCreateRequest) =>
    http.post<number>('/v1/admin/asset/create', req),

  delete: (id: number) =>
    http.post('/v1/admin/asset/delete', { id }),

  /** 批量删除;若 file_resource 引用归 0,后端会自动物理删除 COS 文件 */
  deleteBatch: (ids: number[]) =>
    http.post<number>('/v1/admin/asset/delete-batch', { ids }),

  updateCategories: (resourceId: number, categoryIds: number[]) =>
    http.post('/v1/admin/asset/update-categories', { resourceId, categoryIds }),
};