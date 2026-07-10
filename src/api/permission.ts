import http from './client';
import type { PermissionPoint, Page } from '../types';

export interface PermissionQuery {
  code?: string;
  module?: string;
  pageNum?: number;
  pageSize?: number;
}

export interface PermissionAddPayload {
  code: string;
  name: string;
  pid: string;
  sort?: number;
  description?: string;
  clientType?: string;
}

export interface PermissionUpdatePayload extends PermissionAddPayload {
  id: string;
}

export async function listPermissions(q: PermissionQuery = {}): Promise<Page<PermissionPoint>> {
  return http.post<Page<PermissionPoint>>('/v1/admin/permission/list', q);
}

export async function getPermission(id: string): Promise<PermissionPoint> {
  return http.post<PermissionPoint>('/v1/admin/permission/detail', null, { params: { id } });
}

export async function addPermission(req: PermissionAddPayload): Promise<string> {
  return http.post<string>('/v1/admin/permission/add', req);
}

export async function updatePermission(req: PermissionUpdatePayload): Promise<void> {
  return http.post<void>('/v1/admin/permission/update', req);
}

export async function deletePermission(id: string): Promise<void> {
  return http.post<void>('/v1/admin/permission/delete', null, { params: { id } });
}
