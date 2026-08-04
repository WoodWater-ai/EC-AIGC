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
  userId?: string;
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
  id?: string;
  pid?: string;
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
