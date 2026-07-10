/**
 * 权限码管理 API —— 对接后端 AdminRightsController
 *
 * 后端路径：/v1/admin/rights/*
 * 鉴权：类级 @SaCheckLogin
 */
import http from '../client';
import type { RightsResponse } from '../types';

/** 全量列表（无入参） */
export async function list(): Promise<RightsResponse[]> {
  return http.post<RightsResponse[]>('/v1/admin/rights/list', {});
}

/** 详情 */
export async function detail(id: number): Promise<RightsResponse> {
  return http.post<RightsResponse>('/v1/admin/rights/detail', { id });
}

/** 新增 */
export async function add(req: {
  rightsName: string;
  rightsCode: string;
  module?: string;
  description?: string;
}): Promise<number> {
  return http.post<number>('/v1/admin/rights/add', req);
}

/** 编辑 */
export async function update(req: {
  id: number;
  rightsName: string;
  rightsCode: string;
  module?: string;
  description?: string;
}): Promise<void> {
  return http.post<void>('/v1/admin/rights/update', req);
}

/** 删除（软删） */
export async function remove(id: number): Promise<void> {
  return http.post<void>('/v1/admin/rights/delete', { id });
}

export const rightsApi = { list, detail, add, update, remove };
