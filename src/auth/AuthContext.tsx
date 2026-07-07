import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { LoginResponse, MenuResponse } from '../api/types';
import { setToken as setTokenToStorage, clearToken } from '../api/auth';
import * as authApi from '../api/modules/auth';

/**
 * 鉴权 Context —— 跨组件共享 user / roles / permissions / menuTree
 *
 * 设计目标：
 * - 登录页调 useAuth().login() 一步完成「调 API + 存 token + 设 user」
 * - Header 登出按钮调 useAuth().logout() 一步完成「调 API + 清 token + 清 user」
 * - Sidebar 用户卡片下拉点击 → useAuth().logout() 跳登录页（伪「切换协作账号」）
 * - 业务按钮用 useAuth().hasPermission(code) 控制可见性
 * - 后续 Sidebar 用 useAuth().menuTree 渲染真实菜单（CLAUDE.md TODO）
 *
 * 已知限制：
 * - 当前不持久化 user（刷新页面会丢 user → 跳登录页）
 *   待后续接 me() 改造为"refresh → load user"，详见 authApi.me()
 */

interface AuthState {
  /** 当前登录用户信息（含 token / roles / permissions / menuTree） */
  user: LoginResponse | null;
  /** 当前用户角色 code 列表（来自后端 roles[]） */
  roles: readonly string[];
  /** 当前用户权限点 code 列表（来自后端 permissions[]） */
  permissions: readonly string[];
  /** 当前用户菜单树（来自后端 menuTree，用于 Sidebar 渲染） */
  menuTree: MenuResponse[];
  /** 是否已登录 */
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  /**
   * 登录
   *
   * @param username 用户名（明文）
   * @param passwordPlain 密码（明文，内部 MD5 加密）
   * @returns 完整 user info（供 LoginPage 决定下一步跳转）
   * @throws ApiError 业务错误（已在 axios 拦截器 toast）
   */
  login: (username: string, passwordPlain: string) => Promise<LoginResponse>;

  /**
   * 登出 —— 调 /v1/auth/logout + 清 token + 清 user
   */
  logout: () => Promise<void>;

  /**
   * 权限点检查
   *
   * 用法：{hasPermission('task:create') && <CreateButton />}
   */
  hasPermission: (code: string) => boolean;

  /**
   * 角色检查
   *
   * 用法：{hasRole('ADMIN') && <AdminPanel />}
   */
  hasRole: (code: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoginResponse | null>(null);

  const roles = useMemo<readonly string[]>(() => user?.roles ?? [], [user]);
  const permissions = useMemo<readonly string[]>(() => user?.permissions ?? [], [user]);
  const menuTree = useMemo<MenuResponse[]>(() => user?.menuTree ?? [], [user]);
  const isAuthenticated = user != null;

  const login = useCallback(async (username: string, passwordPlain: string) => {
    const resp = await authApi.login(username, passwordPlain);
    if (!resp.token) {
      throw new Error('登录响应缺少 token，请联系管理员');
    }
    setTokenToStorage(resp.token);
    setUser(resp);
    return resp;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      // logout 失败也继续清前端（不阻塞 UI）
      // 常见原因：token 已过期 / 后端 Sa-Token 注销失败
      // 此时 axios 拦截器已 toast 错误，无需额外处理
      console.warn('[auth] logout API 调用失败，继续清前端状态:', err);
    }
    clearToken();
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (code: string) => permissions.includes(code),
    [permissions]
  );

  const hasRole = useCallback(
    (code: string) => roles.includes(code),
    [roles]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      roles,
      permissions,
      menuTree,
      isAuthenticated,
      login,
      logout,
      hasPermission,
      hasRole,
    }),
    [user, roles, permissions, menuTree, isAuthenticated, login, logout, hasPermission, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * 业务组件拿 auth 状态
 *
 * @throws 在 AuthProvider 外使用时 throw（防呆）
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}