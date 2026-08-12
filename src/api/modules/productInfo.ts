import http from '../client';
import type { PageInfo } from '../service-result';

/**
 * 产品基础信息 API 封装
 *
 * 对应后端 AdminProductInfoController(注意路径前缀是 /v1/admin/product-info,
 * 不是 /v1/admin/product —— 后者被现有的 AdminProductController(产品素材资产)占用):
 *   - list      分页查询(keyword/status)
 *   - add       新增
 *   - update    更新
 *   - delete    删除(逻辑删除)
 *   - detail    详情
 *
 * 图片字段说明:
 *   - 请求: imageId:string(后端 Long 序列化为字符串)—— 来自资源库选择
 *   - 响应: imageId:string + imageUrl:string(ossKey 相对路径;前端用 utils/cosImage.withCosThumbnail 拼 COS thumbnail)
 *
 * 与 product.ts(产品素材资产)的区别:
 *   - product.ts      → /v1/admin/product/*        (product_asset 表,已有)
 *   - productInfo.ts  → /v1/admin/product-info/*  (product 表,本次新增)
 */

export type ProductStatus = 'ON_SHELF' | 'OFF_SHELF';

/** 产品响应中携带的产品分类简要 */
export interface ProductCategoryRef {
  id: string;            // 后端 Long → string
  categoryName: string;
}

export interface ProductDTO {
  id: string;
  name: string;
  sellingPoints?: string;
  color?: string;
  patternMaterial?: string;
  silhouetteStructure?: string;
  /** 品类(纯字符串,与 product_category 表无关联) */
  category?: string;
  /** 图片资源 ID(后端 Long → string) */
  imageId?: string;
  /** 图片 ossKey(相对路径)—— 前端用 utils/cosImage.withCosThumbnail 拼 COS thumbnail 参数 */
  imageUrl?: string;
  status: ProductStatus;
  statusDesc: string;
  /** 关联的产品分类(含 id + categoryName) */
  categories?: ProductCategoryRef[];
  createTime?: string;
  updateTime?: string;
  skuCode?: string;
  specName?: string;
  barcode?: string;
  sourceType?: 'MANUAL' | 'ERP' | 'COMBINATION';
  sourceChannel?: string;
  externalSkuId?: string;
  spuCode?: string;
  brand?: string;
  lastSyncTime?: string;
  canCreate?: boolean;
  unavailableReason?: string;
  skuList?: ProductSkuDTO[];
}

export interface ProductSkuDTO {
  id: string;
  skuCode?: string;
  specName?: string;
  barcode?: string;
  imageId?: string;
  imageUrl?: string;
  color?: string;
  patternMaterial?: string;
  silhouetteStructure?: string;
  status?: ProductStatus;
  canCreate?: boolean;
  unavailableReason?: string;
}

export interface ProductQueryReq {
  pageNum: number;
  pageSize: number;
  keyword?: string;
  status?: ProductStatus;
  /** 产品分类 ID 筛选(雪花 ID 字符串;后端 EXISTS 子查询生效) */
  categoryId?: string;
  sourceType?: 'MANUAL' | 'ERP';
}

export interface ProductAddReq {
  name: string;
  sellingPoints?: string;
  color?: string;
  patternMaterial?: string;
  silhouetteStructure?: string;
  /** 品类(纯字符串) */
  category?: string;
  /** 图片资源 ID(选填,来自资源库;后端校验存在且为图片后转换 URL 存储) */
  imageId?: string;
  /** 关联的产品分类 ID 列表(雪花 ID,字符串数组避免精度丢失) */
  categoryIds?: string[];
  status?: ProductStatus;
}

export interface ProductUpdateReq {
  id: string;
  name: string;
  sellingPoints?: string;
  color?: string;
  patternMaterial?: string;
  silhouetteStructure?: string;
  /** 品类(纯字符串) */
  category?: string;
  /** 图片资源 ID(选填;不传则后端清空现有 image) */
  imageId?: string;
  /** 关联的产品分类 ID 列表(雪花 ID,字符串数组避免精度丢失) */
  categoryIds?: string[];
  status?: ProductStatus;
}

export interface ProductAiAnalyzeRequest {
  imageId: string;
}

/**
 * 产品图片 AI 分析响应(9 个字段全部可选,AI 可能漏判)
 * 本版本前端只消费 6 个(name/sellingPoints/color/patternMaterial/silhouetteStructure/category),
 * 后 3 个保留字段(fabricTexture/keyDetails/unchangeable)等待未来前端表单字段扩展时启用。
 */
export interface ProductAiAnalyzeResponse {
  name?: string;
  sellingPoints?: string;
  color?: string;
  patternMaterial?: string;
  silhouetteStructure?: string;
  category?: string;
  fabricTexture?: string;
  keyDetails?: string;
  unchangeable?: string;
}

export interface ProductIdReq {
  id: string;
}

export const productInfoApi = {
  list: (req: ProductQueryReq) =>
    http.post<PageInfo<ProductDTO>>('/v1/admin/product-info/list', req),

  managementList: (req: ProductQueryReq) =>
    http.post<PageInfo<ProductDTO>>('/v1/admin/product-info/management-list', req),

  add: (req: ProductAddReq) =>
    http.post<string>('/v1/admin/product-info/add', req),

  update: (req: ProductUpdateReq) =>
    http.post<void>('/v1/admin/product-info/update', req),

  delete: (req: ProductIdReq) =>
    http.post<void>('/v1/admin/product-info/delete', req),

  detail: (req: ProductIdReq) =>
    http.post<ProductDTO>('/v1/admin/product-info/detail', req),

  /** 产品图片 AI 分析(POST /v1/admin/product-info/ai-analyze) */
  aiAnalyze: (req: ProductAiAnalyzeRequest) =>
    http.post<ProductAiAnalyzeResponse>('/v1/admin/product-info/ai-analyze', req),
};
