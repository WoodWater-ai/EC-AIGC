import http from '../client';

/**
 * 商品分类 API 封装
 *
 * 对应后端 AdminProductCategoryController:
 *   - tree    全员可见分类树(需登录)
 *   - create  创建分类
 *   - update  更新分类(后端不支持改 parentId)
 *   - delete  删除分类(后端要求必须是叶子节点)
 *
 * 字段命名严格对齐后端 DTO:
 *   - ProductCategoryCreateRequest / ProductCategoryUpdateRequest
 *   - ProductCategoryNodeResponse(已存在,扩展 children 嵌套结构)
 *
 * 与资源分类(assetCategoryApi)的差异:
 *   - 无 categoryCode / categoryKind / isPublic / ownerUserId
 *   - 全员共享,无 publicTree 端点
 */

export interface ProductCategoryNode {
  /** 雪花 ID —— 后端序列化为字符串以保精度,前端必须保持 string */
  id: string;
  /** 父分类 ID(同样为字符串) */
  parentId: string;
  /** 分类名称(对齐后端 ProductCategoryNodeResponse.categoryName) */
  categoryName: string;
  /** 分类描述 */
  description?: string;
  /** 排序 */
  sort?: number;
  /** 子节点(嵌套结构) */
  children?: ProductCategoryNode[];
}

/** 创建商品分类请求(对齐后端 ProductCategoryCreateRequest) */
export interface ProductCategoryCreateRequest {
  /** 父分类 ID,顶级传 0 或不传(雪花 ID,字符串传输) */
  parentId?: string;
  /** 分类名称,必填 */
  categoryName: string;
  /** 分类描述(可选) */
  description?: string;
  /** 排序,默认 0 */
  sort?: number;
}

/** 更新商品分类请求(对齐后端 ProductCategoryUpdateRequest) */
export interface ProductCategoryUpdateRequest {
  /** 分类 ID,必填(字符串) */
  id: string;
  /** 分类名称 */
  categoryName?: string;
  /** 分类描述 */
  description?: string;
  /** 排序 */
  sort?: number;
  // 注意:后端 update 不支持改 parentId,前端不暴露
}

export const productCategoryApi = {
  /** 全员可见商品分类树 */
  tree: () =>
    http.post<ProductCategoryNode[]>('/v1/admin/product-category/tree'),

  /** 创建商品分类,返回新分类 ID(雪花 ID,序列化为字符串) */
  create: (req: ProductCategoryCreateRequest) =>
    http.post<string>('/v1/admin/product-category/create', req),

  /** 更新商品分类(后端不支持改 parentId) */
  update: (req: ProductCategoryUpdateRequest) =>
    http.post('/v1/admin/product-category/update', req),

  /** 删除商品分类(后端要求必须是叶子节点) */
  delete: (id: string) =>
    http.post('/v1/admin/product-category/delete', { id }),
};
