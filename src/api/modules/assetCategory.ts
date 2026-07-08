import http from '../client';

/**
 * 资源分类 API 封装
 *
 * 对应后端 AdminAssetCategoryController:
 *   - tree         当前用户可见分类树(需登录)
 *   - publicTree   全员公开分类树(无需登录)
 *
 * 仅暴露前端需要的 2 个查询接口,CRUD 后端已有但本期不暴露前端调用。
 */

export interface AssetCategoryNode {
  id: number;
  parentId: number;
  /** 分类名称(对齐后端 AssetCategoryNodeResponse.categoryName) */
  categoryName: string;
  /** 分类编码 */
  categoryCode?: string;
  /** 分类类型 IMAGE/VIDEO/MIXED */
  categoryKind?: string;
  /** 排序 */
  sort?: number;
  /** 是否公开(后端用 'Y'/'N' 字符串) */
  isPublic?: string;
  /** 创建人 ID */
  ownerUserId?: number;
  /** 子节点(嵌套结构) */
  children?: AssetCategoryNode[];
}

export const assetCategoryApi = {
  tree: () =>
    http.post<AssetCategoryNode[]>('/v1/admin/asset-category/tree'),

  publicTree: () =>
    http.post<AssetCategoryNode[]>(
      '/v1/admin/asset-category/public-tree',
    ),
};