import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { LoginResponse, MenuResponse } from '../api/types';
import {
  getToken,
  setToken as setTokenToStorage,
  clearToken,
} from '../api/auth';
import * as authApi from '../api/modules/auth';
import { isMockRuntime } from '../config/runtime';

/**
 * 鉴权 Context —— 跨组件共享 user / roles / permissions / menuTree
 *
 * 设计目标：
 * - 登录页调 useAuth().login() 一步完成「mock/API 登录 + 存 token + 设 user」
 * - Header 登出按钮调 useAuth().logout() 一步完成「mock/API 登出 + 清 token + 清 user」
 * - Sidebar 用户卡片下拉点击 → useAuth().logout() 跳登录页（伪「切换协作账号」）
 * - 业务按钮用 useAuth().hasPermission(code) 控制可见性
 * - 后续 Sidebar 用 useAuth().menuTree 渲染真实菜单（CLAUDE.md TODO）
 *
 * 启动恢复机制（解决"刷新页面跳回登录页"问题）：
 * - AuthProvider 挂载时如 localStorage 有 token → 调 /v1/auth/me 恢复 user
 * - 期间 initializing=true，App 层展示 spinner 避免闪 LOGIN
 * - me() 成功 → setUser(resp)；失败（A0102xx 或 网络错误）→ clearToken() + setUser(null)
 * - 网络错误不会触发 A0102xx toast（axios 拦截器对非 ApiError 走 generic toast），
 *   业务仅清 token + 跳 LOGIN，不打扰用户
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
  /**
   * 是否正在恢复登录态 —— AuthProvider 挂载后调 /v1/auth/me 的过程中为 true
   * App 层用它在挂载瞬间展示全屏 spinner，避免"闪过 LOGIN → 再进 dashboard"
   */
  initializing: boolean;
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

const DEV_DEMO_TOKEN = 'dev-demo-token';
const DEV_DEMO_USER: LoginResponse = {
  userId: 1,
  username: 'admin',
  name: '陆永奇',
  token: DEV_DEMO_TOKEN,
  roles: ['管理员'],
  permissions: ['*'],
  menuTree: [],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoginResponse | null>(null);
  // initializing 启动时为 true；mount 后调 me()，无论成功失败都置 false
  const [initializing, setInitializing] = useState<boolean>(true);

  const roles = useMemo<readonly string[]>(() => user?.roles ?? [], [user]);
  const permissions = useMemo<readonly string[]>(() => user?.permissions ?? [], [user]);
  const menuTree = useMemo<MenuResponse[]>(() => user?.menuTree ?? [], [user]);
  const isAuthenticated = user != null;

  /**
   * 启动恢复 —— 挂载时如有 token 则调 me() 恢复 user
   *
   * 时序：
   * 1. App 渲染第一帧（initializing=true → 全屏 spinner）
   * 2. useEffect 跑 → 调 me()
   * 3. me() 成功 → setUser + setInitializing(false) → 渲染 dashboard
   * 4. me() 失败 → clearToken + setUser(null) + setInitializing(false) → 渲染 LOGIN
   *
   * 注意：
   * - axios 拦截器对 A0102xx 会 toast + setLoginRequiredHandler；网络错误不会
   * - 这里 catch 不区分错误类型，统一清 token，让 App 层根据 isAuthenticated 跳 LOGIN
   * - 不阻塞 UI：即使后端慢，用户看到的是 spinner，不会闪 LOGIN
   */
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const token = getToken();
      if (!token) {
        // 没 token → 直接结束初始化，跳 LOGIN
        if (!cancelled) setInitializing(false);
        return;
      }
      if (isMockRuntime && token) {
        if (!cancelled) setUser(DEV_DEMO_USER);
        if (!cancelled) setInitializing(false);
        return;
      }
      try {
        const resp = await authApi.me();
        if (!cancelled) {
          setUser(resp);
        }
      } catch (err) {
    // 真实 API 模式下 me() 失败 —— 大概率 token 已过期
        // axios 拦截器已 toast（业务错误）或 console（网络错误）
        // 这里仅清前端状态，让 App 渲染 LOGIN
        if (!cancelled) {
          clearToken();
          setUser(null);
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, passwordPlain: string) => {
    let resp: LoginResponse;
    if (isMockRuntime) {
      if (username !== 'admin' || passwordPlain !== '123456') {
        throw new Error('当前为演示环境，请使用 admin / 123456 登录');
      }
      resp = DEV_DEMO_USER;
    } else {
      resp = await authApi.login(username, passwordPlain);
    }
    if (!resp.token) {
      throw new Error('登录响应缺少 token，请联系管理员');
    }
    setTokenToStorage(resp.token);
    setUser(resp);
    return resp;
  }, []);

  const logout = useCallback(async () => {
    if (isMockRuntime) {
      clearToken();
      setUser(null);
      return;
    }
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
      initializing,
      login,
      logout,
      hasPermission,
      hasRole,
    }),
    [user, roles, permissions, menuTree, isAuthenticated, initializing, login, logout, hasPermission, hasRole]
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
