/**
 * 业务类型定义 —— 从 OpenAPI 生成物 re-export + 手写包装
 *
 * 约定：
 * - types.generated.ts 由 npm run gen:api 生成，禁止手改
 * - 接口变更后必须重新跑 gen:api 并 commit 新 generated 文件
 * - 业务 enum / union / ServiceResult 包装在本文件手写
 *
 * 当前状态：types.generated.ts 是占位（后端未启动），待 dev 环境后端起来后跑：
 *   npm run gen:api
 * 覆盖占位文件
 *
 * 临时手写 DTO（鉴权相关）：
 *   - 这些类型先手写一份对齐后端，等后端起来后跑 gen:api 覆盖，手写版可删
 *   - 后续接入 task / template / asset 等业务模块时也走同样模式
 */

export type { paths, components, operations } from './types.generated';

/**
 * ============================================================
 * 统一鉴权 DTO —— 对齐后端 AuthController（v1.0 统一入口）
 * ============================================================
 * 后端来源：
 *   - Controller:    dafenqi-ai/web/controller/auth/AuthController.java
 *   - Request:       dafenqi-ai/web/model/request/auth/LoginRequest.java
 *   - Response:      dafenqi-ai/web/model/response/auth/LoginResponse.java
 *   - MenuResponse:  dafenqi-ai/web/model/response/menu/MenuResponse.java
 *   - RoleInfoResponse: dafenqi-ai/web/model/response/role/RoleInfoResponse.java
 *
 * 历史：早期 AdminUserLoginController（/v1/admin/user/login）已废弃，统一鉴权走 /v1/auth/*
 *   - 原因：v1.0 收口到 AuthController，Sa-Token token 域统一为 DEFAULT
 *   - 否则 logout 会跨域失败（admin 域 token 调默认域的 @SaCheckLogin → 401）
 */

/** POST /v1/auth/login 请求体 */
export interface LoginRequest {
  /** 用户名（注意是 username 不是 userName） */
  username: string;
  /** 密码（前端 MD5 加密 + 转大写后传，后端再做 SHA-256 + salt） */
  password: string;
}

/** POST /v1/auth/login 响应 data（ServiceResult 已由 axios 拦截器解） */
export interface LoginResponse {
  /** 用户 ID */
  userId?: number;
  /** 用户名 */
  username?: string;
  /** 姓名 */
  name?: string;
  /** 手机号 */
  phone?: string;
  /** Sa-Token token（前端存 localStorage，请求时注入 Authorization header） */
  token?: string;
  /** 角色 code 列表（ADMIN / OPERATOR / DESIGNER 等） */
  roles?: string[];
  /** 权限点 code 列表（task:create / product:manage 等） */
  permissions?: string[];
  /** 用户菜单树（前端 Sidebar 按此渲染，根节点 pid=0） */
  menuTree?: MenuResponse[];
}

/** 菜单树节点 —— 与后端 MenuResponse 对齐 */
export interface MenuResponse {
  id?: number;
  pid?: number;
  menuName?: string;
  menuPath?: string;
  routerName?: string;
  comPath?: string;
  icon?: string;
  sort?: number;
  /** CATALOG / MENU / BUTTON */
  type?: 'CATALOG' | 'MENU' | 'BUTTON' | string;
  permission?: string;
  applicationScope?: string;
  children?: MenuResponse[];
}

/** 角色信息（兼容历史 AdminUserInfoResponse.roleList） */
export interface RoleInfoResponse {
  roleId?: number;
  roleName?: string;
  roleCode?: string;
}

// ========== 系统配置模块 DTO（2026-07-09 新增） ==========

/** POST /v1/admin/user/list 响应项 */
export interface UserResponse {
  id?: number;
  userName?: string;
  name?: string;
  phone?: string;
  code?: string;
  headUrl?: string;
  firstLoginTime?: number;
  lastLoginTime?: number;
  // 2026-07-09 P1 扩展字段(后端 UserDO 暂无对应列,值可能为 null)
  deptId?: number | null;
  status?: string | null;
  isAdmin?: boolean | null;
  email?: string | null;
}

export interface UserListRequest {
  pageNum: number;
  pageSize: number;
  orderBy?: string;
  userName?: string;
  phone?: string;
  name?: string;
  status?: 'Y' | 'N';
  isAdmin?: 'Y' | 'N';
  level?: string;
  isSubOrganization?: boolean;
  deptId?: number;
}

export interface UserAddRequest {
  userName: string;
  phone: string;
  name: string;
  code?: string;
  password: string;
  headUrl?: string;
  isAdmin?: 'Y' | 'N';
  roleIds: number[];
}

export interface UserUpdateRequest {
  id: number;
  userName?: string;
  code?: string;
  name?: string;
  headUrl?: string;
  isAdmin?: 'Y' | 'N';
  roleIds?: number[];
}

/** POST /v1/admin/department/list 响应项 */
export interface DepartmentResponse {
  id?: number;
  pid?: number;
  deptName?: string;
  deptCode?: string;
  sort?: number;
  status?: 'ENABLE' | 'DISABLE' | string;
  description?: string;
  managerName?: string;
  createTime?: string;
  updateTime?: string;
}

/** 部门树节点（GET /v1/admin/department/tree 响应） */
export interface DepartmentTreeNode extends DepartmentResponse {
  children?: DepartmentTreeNode[];
}

export interface DepartmentAddRequest {
  pid: number;
  deptName: string;
  deptCode: string;
  sort?: number;
  status: 'ENABLE' | 'DISABLE';
}

export interface DepartmentUserAssignRequest {
  deptId: number;
  userIdList: number[];
  mainUserId?: number;
}

export interface DepartmentUserResponse {
  id?: number;
  deptId?: number;
  userId?: number;
  userName?: string;
  phone?: string;
  isMain?: 'Y' | 'N' | string;
}

/** 权限码（POST /v1/admin/rights/list 响应） */
export interface RightsResponse {
  id?: number;
  rightsCode?: string;
  rightsName?: string;
  module?: string;
  description?: string;
}

/** POST /v1/admin/notification/my-page 响应项 */
export interface NotificationResponse {
  id?: number;
  title?: string;
  content?: string;
  type?: 'success' | 'warning' | 'error' | 'info';
  time?: string;
  read?: boolean;
}

/** 角色（POST /v1/admin/role/list 响应项） */
export interface RoleResponse {
  id?: number;
  roleName?: string;
  roleCode?: string;
  description?: string;
  sort?: number;
  sysRole?: boolean;
  scope?: 'CURRENT_DOMAIN' | 'SUB_DOMAIN' | 'EMPTY' | string;
  status?: 'ENABLED' | 'DISABLED' | 'NORMAL' | 'EMPTY' | string;
  menuList?: MenuResponse[];
  createTime?: string;
  updateTime?: string;
}

export interface RoleAddRequest {
  roleName: string;
  roleCode: string;
  pid?: number;
  description?: string;
  sort?: number;
  scope: 'CURRENT_DOMAIN' | 'SUB_DOMAIN';
  status: 'ENABLED' | 'DISABLED';
  menuIds: number[];
}

export interface RoleUpdateRequest extends RoleAddRequest {
  id: number;
}

export interface AssignMenusRequest {
  roleId: number;
  menuIds: number[];
}

/** 菜单新增请求 */
export interface MenuAddRequest {
  menuName: string;
  menuPath?: string;
  routerName?: string;
  comPath?: string;
  icon?: string;
  sort?: number;
  pid: number;
  type: 'CATALOG' | 'MENU' | 'BUTTON' | 'PAGE';
  permission?: string;
  applicationScope: 'ALL' | 'ADMIN' | 'CHANNEL' | 'TENANT';
}

export interface MenuUpdateRequest extends MenuAddRequest {
  id: number;
}

export interface MenuQueryRequest {
  pageNum: number;
  pageSize: number;
  orderBy?: string;
  menuName?: string;
}

/** 通用分页结果（PageHelper 风格） */
export interface PageInfo<T> {
  list: T[];
  total: number;
  pageNum: number;
  pageSize: number;
  pages: number;
}