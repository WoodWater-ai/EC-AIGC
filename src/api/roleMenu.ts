import http from './client';
import type { MenuNode, Page } from '../types';

export interface RoleInfo {
  id: string;
  roleName: string;
  roleCode: string;
  description?: string;
  sysRole?: boolean;
  scope?: 'CURRENT_DOMAIN' | 'SUB_DOMAIN';
  status?: 'NORMAL' | 'DISABLED';
}

export async function getMenuTree(): Promise<MenuNode[]> {
  return http.get<MenuNode[]>('/v1/admin/menu/tree');
}

export async function getRoleMenus(roleId: string): Promise<MenuNode[]> {
  return http.get<MenuNode[]>('/v1/admin/role/menus', { params: { roleId } });
}

export async function getRoleMenuIds(roleId: string): Promise<string[]> {
  return http.get<string[]>('/v1/admin/role/menu-ids', { params: { roleId } });
}

export async function assignMenus(roleId: string, menuIds: string[]): Promise<void> {
  return http.post<void>('/v1/admin/role/menus/assign', { roleId, menuIds });
}

export async function getRoleList(q: Partial<RoleInfo> & { pageNum?: number; pageSize?: number } = {}): Promise<Page<RoleInfo>> {
  return http.post<Page<RoleInfo>>('/v1/admin/role/list', q);
}

export async function getUserRoles(userId: string): Promise<RoleInfo[]> {
  return http.post<RoleInfo[]>('/v1/admin/user/roles', null, { params: { userId } });
}

export async function assignUserRoles(userId: string, roleIds: string[]): Promise<void> {
  return http.post<void>('/v1/admin/user/roles', { userId, roleIds });
}

export interface RoleFormPayload {
  roleName: string;
  roleCode: string;
  description?: string;
  sort?: number;
  scope: 'CURRENT_DOMAIN' | 'SUB_DOMAIN';
  status: 'NORMAL' | 'DISABLED';
}

export interface RoleUpdatePayload extends RoleFormPayload {
  id: string;
}

export async function getRoleDetail(id: string): Promise<RoleInfo> {
  return http.get<RoleInfo>('/v1/admin/role/detail', { params: { id } });
}

export async function addRole(payload: RoleFormPayload): Promise<void> {
  return http.post<void>('/v1/admin/role/add', payload);
}

export async function updateRole(payload: RoleUpdatePayload): Promise<void> {
  return http.post<void>('/v1/admin/role/update', payload);
}

export async function deleteRole(id: string): Promise<void> {
  return http.post<void>('/v1/admin/role/delete', null, { params: { id } });
}

export interface MenuAddPayload {
  type: 'CATALOG' | 'MENU' | 'BUTTON';
  menuName: string;
  pid: string;
  permission?: string;
  icon?: string;
  clientType?: 'PC' | 'IPAD';
  applicationScope: 'ALL' | 'CHANNEL' | 'TENANT' | 'ADMIN' | 'EMPTY';
  sort?: number;
  description?: string;
}

export async function addMenu(payload: MenuAddPayload): Promise<void> {
  return http.post<void>('/v1/admin/menu/add', payload);
}

export interface MenuUpdatePayload extends MenuAddPayload {
  id: string;
}

export async function updateMenu(payload: MenuUpdatePayload): Promise<void> {
  return http.post<void>('/v1/admin/menu/update', payload);
}

export async function deleteMenu(id: string): Promise<void> {
  return http.post<void>('/v1/admin/menu/delete', null, { params: { id } });
}
