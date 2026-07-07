/**
 * 统一鉴权 API —— 对接后端 AuthController（v1.0）
 *
 * 后端契约：
 *   POST /v1/auth/login    — 登录（统一入口，兼容 admin/browser）
 *   POST /v1/auth/logout   — 登出（@SaCheckLogin）
 *   POST /v1/auth/me       — 当前用户信息（含 roles[]/permissions[]/menuTree）
 *
 * 鉴权约定：
 *   - 登录成功后 token 存 localStorage，axios 拦截器自动注入 Authorization header
 *   - logout 后必须 clearToken + 清 AuthContext.user
 *   - me 用于「刷新页面恢复登录态」（CLAUDE.md TODO 改进项）
 *
 * 调用示例：
 *   const resp = await login('admin', '123456');
 *   setToken(resp.token);
 *   setAuth(resp);  // 存进 AuthContext
 */

import http from '../client';
import { md5UpperCase } from '../../utils/crypto';
import type { LoginRequest, LoginResponse } from '../types';

/**
 * 登录
 *
 * 接收明文 username + password，内部做 MD5 + 大写后传给后端
 * 返回 LoginResponse（含 token / roles / permissions / menuTree）
 *
 * @throws ApiError 业务错误（已在 axios 拦截器 toast）
 *   - A010101: 用户不存在
 *   - A010102: 密码错误
 *   - A0102xx: 登录异常（自动跳登录页）
 */
export async function login(
  username: string,
  passwordPlain: string
): Promise<LoginResponse> {
  const body: LoginRequest = {
    username,
    password: md5UpperCase(passwordPlain),
  };
  return http.post<LoginResponse>('/v1/auth/login', body);
}

/**
 * 登出 —— 后端 Sa-Token 注销当前 token
 *
 * @throws ApiError 业务错误（已在 axios 拦截器 toast）
 *   - A0102xx: token 已失效（自动跳登录页）
 */
export async function logout(): Promise<void> {
  return http.post<void>('/v1/auth/logout');
}

/**
 * 获取当前登录用户信息
 *
 * 用法（刷新页面时）：
 *   const cached = localStorage.getItem('satoken');
 *   if (cached) {
 *     const me = await me();  // 验证 token 有效并恢复 user
 *     setAuth(me);
 *   }
 */
export async function me(): Promise<LoginResponse> {
  return http.post<LoginResponse>('/v1/auth/me');
}