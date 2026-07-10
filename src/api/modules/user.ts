/**
 * 用户管理 API —— 对接后端 AdminUserManagerController + AdminUserController
 *
 * 后端路径：/v1/admin/user/*
 * 鉴权：AdminUserManagerController 类级 @SaCheckLogin，AdminUserController 类级 @SaCheckLogin（任务 0 已合入）
 */
import http from '../client';
import type { UserResponse, UserListRequest, UserAddRequest, UserUpdateRequest, PageInfo } from '../types';

/** 分页列表 */
export async function list(req: UserListRequest): Promise<PageInfo<UserResponse>> {
  return http.post<PageInfo<UserResponse>>('/v1/admin/user/list', req);
}

/** 详情 */
export async function detail(userId: number): Promise<UserResponse> {
  return http.get<UserResponse>(`/v1/admin/user/detail?userId=${userId}`);
}

/** 新建（密码需前端 MD5 大写后传入） */
export async function add(req: UserAddRequest): Promise<void> {
  return http.post<void>('/v1/admin/user/add', req);
}

/** 编辑 */
export async function update(req: UserUpdateRequest): Promise<void> {
  return http.post<void>('/v1/admin/user/update', req);
}

/** 删除 */
export async function remove(userId: number): Promise<void> {
  return http.post<void>(`/v1/admin/user/delete?userId=${userId}`);
}

/** 启停用（status="Y" 启用 / "N" 停用） */
export async function updateStatus(userId: number, status: 'Y' | 'N'): Promise<void> {
  return http.post<void>('/v1/admin/user/status', { userId, status });
}

/** 重置密码（newPassword 需前端 MD5 大写后传入） */
export async function resetPassword(userId: number, newPasswordMd5: string): Promise<void> {
  return http.post<void>('/v1/admin/user/reset-password', {
    userId,
    newPassword: newPasswordMd5,
  });
}

export const userApi = { list, detail, add, update, remove, updateStatus, resetPassword };
