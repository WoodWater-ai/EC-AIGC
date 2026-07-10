/**
 * 角色管理 API —— 对接后端 AdminRoleManagerController
 *
 * 后端路径：/v1/admin/role/*
 * 鉴权：类级 @SaCheckLogin（任务 0 已合入）
 */
import http from '../client';
import type {
  RoleResponse,
  RoleAddRequest,
  RoleUpdateRequest,
  MenuResponse,
  AssignMenusRequest,
  PageInfo,
} from '../types';

/** 分页列表 */
export async function list(req: {
  pageNum: number;
  pageSize: number;
  roleName?: string;
  roleCode?: string;
  scope?: string;
  status?: string;
}): Promise<PageInfo<RoleResponse>> {
  return http.post<PageInfo<RoleResponse>>('/v1/admin/role/list', req);
}

/** 详情 */
export async function detail(id: number): Promise<RoleResponse> {
  return http.get<RoleResponse>(`/v1/admin/role/detail?id=${id}`);
}

/** 新建 */
export async function add(req: RoleAddRequest): Promise<void> {
  return http.post<void>('/v1/admin/role/add', req);
}

/** 编辑 */
export async function update(req: RoleUpdateRequest): Promise<void> {
  return http.post<void>('/v1/admin/role/update', req);
}

/** 删除 */
export async function remove(id: number): Promise<void> {
  return http.post<void>(`/v1/admin/role/delete?id=${id}`);
}

/** 角色已绑菜单（用于授权抽屉预勾选） */
export async function getMenus(roleId: number): Promise<MenuResponse[]> {
  return http.get<MenuResponse[]>(`/v1/admin/role/menus?roleId=${roleId}`);
}

/** 给角色分配菜单 */
export async function assignMenus(req: AssignMenusRequest): Promise<void> {
  return http.post<void>('/v1/admin/role/menus/assign', req);
}

export const roleApi = { list, detail, add, update, remove, getMenus, assignMenus };
