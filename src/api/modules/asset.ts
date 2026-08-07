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
  assetKind?: 'IMAGE' | 'VIDEO' | 'AUDIO';
  assetType?: string;
  productId?: number;
  categoryId?: number;
  keyword?: string;
  /** 创建时间起点(包含,ISO 字符串) */
  startTime?: string;
  /** 创建时间终点(包含,ISO 字符串) */
  endTime?: string;
}

export interface AssetResourceItem {
  /** 后端 Long → string(雪花 ID,JS number 会丢精度) */
  id: string;
  resourceCode?: string;
  name: string;
  assetKind: 'IMAGE' | 'VIDEO' | 'AUDIO';
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
  /** 是否已经添加到模特资源库 */
  inModelLibrary?: boolean;
  uploadUserId: string;
  productId?: string;
  recognitionId?: string;
  /** 关联 file_resource.id(Spec-B 主路径;长 string 防 JS 精度丢失) */
  fileResourceId?: string;
  sourceType?: 'UPLOAD' | 'GENERATED_IMAGE' | 'GENERATED_VIDEO' | 'ASSISTANT_GENERATED_IMAGE' | 'ASSISTANT_GENERATED_VIDEO';
  sourceId?: string;
  status: 'NORMAL' | 'ARCHIVED';
  visibility?: 'PRIVATE' | 'PUBLIC';
  categoryIds: string[];
  createTime?: string;
}

export interface AssetResourceCreateRequest {
  /** file_resource.id(由 /file/upload-complete 返回);string 防 JS 精度丢失 */
  fileResourceId: string;
  /** 文件内容 MD5；后端按登录用户去重。 */
  fileMd5: string;
  name: string;
  assetKind?: 'IMAGE' | 'VIDEO';
  assetType?: string;
  productId?: string | number;  // accepts snowflake ID as string (precision-safe) OR legacy number
  recognitionId?: string;
  description?: string;
  tags?: string;
  thumbnailUrl?: string;
  categoryIds?: string[];
}

export const assetApi = {
  page: (req: AssetResourceQueryRequest) =>
    http.post<PageInfo<AssetResourceItem>>('/v1/admin/asset/page', req),

  get: (id: string) =>
    http.post<AssetResourceItem>('/v1/admin/asset/get', { id }),

  create: (req: AssetResourceCreateRequest) =>
    http.post<string>('/v1/admin/asset/create', req),

  delete: (id: string) =>
    http.post('/v1/admin/asset/delete', { id }),

  /** 批量删除;若 file_resource 引用归 0,后端会自动物理删除 COS 文件 */
  deleteBatch: (ids: string[]) =>
    http.post<number>('/v1/admin/asset/delete-batch', { ids }),

  updateCategories: (resourceId: string, categoryIds: string[]) =>
    http.post('/v1/admin/asset/update-categories', { resourceId, categoryIds }),

  resolveGenerated: (
    items: Array<{ mediaType: 'IMAGE' | 'VIDEO'; sourceId: string }>,
  ) =>
    http.post<AssetResourceItem[]>('/v1/admin/asset/resolve-generated', { items }),
};
