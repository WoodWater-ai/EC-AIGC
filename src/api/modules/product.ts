import http from '../client';

/**
 * 商品资产 API 封装
 *
 * 对齐后端 AdminProductController:
 *   - page:     POST /v1/admin/product/page
 *   - detail:   POST /v1/admin/product/detail
 *   - create:   POST /v1/admin/product/add
 *   - update:   POST /v1/admin/product/update
 *   - delete:   POST /v1/admin/product/delete
 */

export interface ProductCreateRequest {
  /** 业务编码(必填,≤64 字符) */
  productCode: string;
  /** 商品名称(必填,≤128 字符) */
  name: string;
  /** 品类(选填,≤32 字符) */
  category?: string;
  /** 主颜色 */
  mainColor?: string;
  /** 面料 */
  fabric?: string;
  /** 核心卖点 */
  sellingPoints?: string;
  /** 禁止改写项 */
  forbidModifyItems?: string;
  /** 归属部门 ID */
  deptId?: number;
}

export const productApi = {
  /**
   * 新建商品
   * @returns 后端返回新商品的 Long id(前端用 string 包装)
   */
  create: (req: ProductCreateRequest): Promise<number> =>
    http.post<number>('/v1/admin/product/add', req),
};
