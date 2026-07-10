/**
 * 菜单管理 API —— 对接后端 AdminMenuManagerController
 *
 * 后端路径：/v1/admin/menu/*
 * 鉴权：类级 @SaCheckLogin + list() 加了 @RequestBody（任务 0 已合入）
 */
import http from '../client';
import type {
  MenuResponse,
  MenuAddRequest,
  MenuUpdateRequest,
  MenuQueryRequest,
  PageInfo,
} from '../types';

/** 列表（分页 + 菜单名筛选） */
export async function list(req: MenuQueryRequest): Promise<PageInfo<MenuResponse>> {
  return http.post<PageInfo<MenuResponse>>('/v1/admin/menu/list', req);
}

/** 详情 */
export async function detail(id: number): Promise<MenuResponse> {
  return http.get<MenuResponse>(`/v1/admin/menu/detail?id=${id}`);
}

/** 新增 */
export async function add(req: MenuAddRequest): Promise<void> {
  return http.post<void>('/v1/admin/menu/add', req);
}

/** 编辑 */
export async function update(req: MenuUpdateRequest): Promise<void> {
  return http.post<void>('/v1/admin/menu/update', req);
}

/** 删除 */
export async function remove(id: number): Promise<void> {
  return http.post<void>(`/v1/admin/menu/delete?id=${id}`);
}

/** 全量菜单树（角色授权抽屉 / 菜单管理树视图用） */
export async function tree(): Promise<MenuResponse[]> {
  return http.get<MenuResponse[]>('/v1/admin/menu/tree');
}

export const menuApi = { list, detail, add, update, remove, tree };
