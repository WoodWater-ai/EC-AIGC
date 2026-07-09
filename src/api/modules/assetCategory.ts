import http from '../client';

/**
 * 资源分类 API 封装
 *
 * 对应后端 AdminAssetCategoryController:
 *   - tree         当前用户可见分类树(需登录)
 *   - publicTree   全员公开分类树(无需登录)
 *   - create       创建分类
 *   - update       更新分类(后端不支持改 parentId / categoryKind)
 *   - delete       删除分类(后端要求必须是叶子节点)
 *
 * 字段命名严格对齐后端 DTO:
 *   - AssetCategoryCreateRequest / AssetCategoryUpdateRequest
 *   - AssetCategoryNodeResponse(已存在,扩展 children 嵌套结构)
 */

export interface AssetCategoryNode {
  id: number;
  parentId: number;
  /** 分类名称(对齐后端 AssetCategoryNodeResponse.categoryName) */
  categoryName: string;
  /** 分类编码 */
  categoryCode?: string;
  /** 分类类型 IMAGE/VIDEO/MIXED */
  categoryKind?: 'IMAGE' | 'VIDEO' | 'MIXED';
  /** 分类描述 */
  description?: string;
  /** 排序 */
  sort?: number;
  /** 创建人 ID */
  ownerUserId?: number;
  /** 是否公开(后端用 'Y'/'N' 字符串) */
  isPublic?: string;
  /** 子节点(嵌套结构) */
  children?: AssetCategoryNode[];
}

/** 创建资源分类请求(对齐后端 AssetCategoryCreateRequest) */
export interface AssetCategoryCreateRequest {
  /** 父分类 ID,顶级传 0 或不传 */
  parentId?: number;
  /** 分类名称,必填 */
  categoryName: string;
  /** 分类编码,可选 */
  categoryCode?: string;
  /** 分类类型 IMAGE/VIDEO/MIXED,默认 IMAGE */
  categoryKind?: 'IMAGE' | 'VIDEO' | 'MIXED';
  /** 分类描述 */
  description?: string;
  /** 排序,默认 0 */
  sort?: number;
  /** 是否公开 N=私有 Y=公开,默认 N */
  isPublic?: 'Y' | 'N';
}

/** 更新资源分类请求(对齐后端 AssetCategoryUpdateRequest) */
export interface AssetCategoryUpdateRequest {
  /** 分类 ID,必填 */
  id: number;
  /** 分类名称 */
  categoryName?: string;
  /** 分类编码 */
  categoryCode?: string;
  /** 分类描述 */
  description?: string;
  /** 排序 */
  sort?: number;
  /** 是否公开 N/Y */
  isPublic?: 'Y' | 'N';
  // 注意:后端 update 不支持改 parentId 和 categoryKind,前端不暴露
}

export const assetCategoryApi = {
  tree: () =>
    http.post<AssetCategoryNode[]>('/v1/admin/asset-category/tree'),

  publicTree: () =>
    http.post<AssetCategoryNode[]>(
      '/v1/admin/asset-category/public-tree',
    ),

  /** 创建分类,返回新分类 ID */
  create: (req: AssetCategoryCreateRequest) =>
    http.post<number>('/v1/admin/asset-category/create', req),

  /** 更新分类(后端不支持改 parentId / categoryKind) */
  update: (req: AssetCategoryUpdateRequest) =>
    http.post('/v1/admin/asset-category/update', req),

  /** 删除分类(后端要求必须是叶子节点) */
  delete: (id: number) =>
    http.post('/v1/admin/asset-category/delete', { id }),
};
