/**
 * 用户管理 API 封装
 *
 * 严格镜像后端 AdminUserManagerController 7 端点 + AdminUserController 2 端点
 *   POST /list           列表(分页,BaseQueryPageRequest.pageSize 上限 200)
 *   GET  /detail         详情(?userId=Long)  ← 注意 GET 不是 POST
 *   POST /add            新增
 *   POST /update         更新
 *   POST /delete         删除(?userId=Long)
 *   POST /status         启停用
 *   POST /reset-password 重置密码 body {userId, newPassword}  ← 注意 userId 不是 id
 *
 * @see dafenqi-ai/.../web/controller/admin/user/AdminUserManagerController.java
 * @see dafenqi-ai/.../web/controller/admin/user/AdminUserController.java
 *
 * 关键约束:
 * - BaseQueryPageRequest.pageSize @Max(200) → 用户数 > 200 时必须分多页拉
 * - Long 字段(后端 @JsonSerialize ToStringSerializer)→ 前端用 string
 * - add/update/resetPassword 密码传明文,后端 PasswordUtil.encrypt 内部处理
 *   (只有登录 /v1/auth/login 走 MD5+大写)
 *
 * 字段语义(2026-07-11 对齐):
 * - userName → user.username 列(登录账号),必填
 * - phone → 联系方式(非登录账号),可选
 * - name → 真实姓名,必填
 * - password → 密码(明文),add 必填 / update 不支持(走 resetPassword)
 * - roleIds → List<Long> 后端转 string[],@NotEmpty
 */
import http from '../client';
import type { PageInfo } from '../service-result';

export type UserStatus = 'NORMAL' | 'DISABLED';

export interface UserDTO {
  id: string;
  userName?: string;
  name?: string;
  phone?: string;
  headUrl?: string;
  code?: string;
  firstLoginTime?: string;
  lastLoginTime?: string;
  deptId?: string | null;
  status?: UserStatus;
  isAdmin?: boolean;
  email?: string;
  roleIds?: string[];
}

export interface UserListQuery {
  pageNum?: number;
  pageSize?: number;
  userName?: string;
  phone?: string;
  name?: string;
  status?: UserStatus;
  isAdmin?: 'Y' | 'N';
  level?: string;
  isSubOrganization?: boolean;
  deptId?: string;
}

export interface UserAddRequest {
  userName: string;          // 必填,登录账号
  phone?: string;            // 可选
  name: string;              // 必填
  code?: string;
  password: string;          // 必填,明文
  headUrl?: string;
  isAdmin?: 'Y' | 'N';
  roleIds: number[];         // 必填,非空
}

export interface UserUpdateRequest {
  id: string;
  userName?: string;         // 可选(编辑可不改)
  phone?: string;            // 可选,空字符串表示清空
  name?: string;
  code?: string;
  headUrl?: string;
  isAdmin?: 'Y' | 'N';
  roleIds?: number[];        // 可选;不传则不动角色
  // ★ password 不随编辑接口提交,改走 resetPassword 端点
  // password 改走 resetPassword 端点
}

export interface UserStatusRequest {
  id: string;
  status: UserStatus;
}

export const userApi = {
  list: (q: UserListQuery = {}) =>
    http.post<PageInfo<UserDTO>>('/v1/admin/user/list', q),

  listAll: async (extraQuery: Omit<UserListQuery, 'pageNum' | 'pageSize'> = {}): Promise<UserDTO[]> => {
    const PAGE_SIZE = 200;
    const firstPage = await userApi.list({ ...extraQuery, pageNum: 1, pageSize: PAGE_SIZE });
    const totalPages = firstPage.pages ?? 1;
    if (totalPages <= 1) return firstPage.list ?? [];

    const restPages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        userApi.list({ ...extraQuery, pageNum: i + 2, pageSize: PAGE_SIZE })
      )
    );
    return [
      ...(firstPage.list ?? []),
      ...restPages.flatMap(p => p.list ?? []),
    ];
  },

  /** 详情 — GET 不是 POST */
  detail: (userId: string) =>
    http.get<UserDTO>('/v1/admin/user/detail', { params: { userId } }),

  add: (req: UserAddRequest) =>
    http.post<void>('/v1/admin/user/add', req),

  update: (req: UserUpdateRequest) =>
    http.post<void>('/v1/admin/user/update', req),

  remove: (userId: string) =>
    http.post<void>('/v1/admin/user/delete', null, { params: { userId } }),

  status: (req: UserStatusRequest) =>
    http.post<void>('/v1/admin/user/status', req),

  /** 重置密码 — body 字段是 userId 不是 id */
  resetPassword: (userId: string, newPassword: string) =>
    http.post<void>('/v1/admin/user/reset-password', { userId, newPassword }),
};
