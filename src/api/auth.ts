/**
 * Token 存储 —— B 模式（Header-only），localStorage
 *
 * 使用方式：
 * - 登录响应：setToken(resp.token)
 * - axios 拦截器：getToken() 注入 Authorization header
 * - 登出 / 登录异常：clearToken()
 *
 * 注意：
 * - 后端 sa-token.token-name = 'Authorization'，这里 TOKEN_KEY 用 'satoken' 是约定俗成
 * - 实际 axios 拦截器注入的是 token 原值（不放 'Bearer '），所以 key 名对前端无影响
 * - 选 'satoken' 是因为跟后端 cookie 名（也是 'Authorization'）概念区分；后续如果切到 cookie-only 也好改
 */

const TOKEN_KEY = 'satoken';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);
