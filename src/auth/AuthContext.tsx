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
import { AppScreen } from '../types';
import {
  ACCESSIBLE_SCREEN_ORDER,
  ADMIN_ROLE_CODE,
  canAccessScreenByPermissions,
} from './accessControl';

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
  /** 是否管理员。管理员不依赖菜单配置，始终拥有全部前端页面和操作权限。 */
  isAdmin: boolean;
  /**
   * 是否正在恢复登录态 —— AuthProvider 挂载后调 /v1/auth/me 的过程中为 true
   * App 层用它在挂载瞬间展示全屏 spinner，避免"闪过 LOGIN → 再进 dashboard"
   */
  initializing: boolean;
  /** [v1 2026-08-24 spec:iframe 嵌入] 是否处于嵌入模式(URL 首屏消费 token 后为 true) */
  embedMode: boolean;
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

  /** 任一权限命中 */
  hasAnyPermission: (codes: readonly string[]) => boolean;

  /**
   * 角色检查
   *
   * 用法：{hasRole('ADMIN') && <AdminPanel />}
   */
  hasRole: (code: string) => boolean;

  /** 页面访问检查（路由守卫与菜单过滤共用） */
  canAccessScreen: (screen: AppScreen) => boolean;

  /** 当前账号登录后的第一个可访问页面 */
  firstAccessibleScreen: AppScreen;
}

/**
 * [v1 2026-08-24 spec:iframe 嵌入] 把 bootstrap 阶段的 URL/storage 解析拆成纯函数,
 * 便于独立单测。返回 urlToken / tokenToUse / shouldEnterEmbedMode / otherSearchEntries。
 */
export interface BootstrapInputs {
  urlToken: string | null;
  tokenToUse: string | null;
  shouldEnterEmbedMode: boolean;
  /** URL 里除 token 外的其他 search entries(供 replaceState 时保留) */
  otherSearchEntries: Array<[string, string]>;
}

export function extractBootstrapInputs(
  location: Location,
  storedToken: string | null,
): BootstrapInputs {
  const params = new URLSearchParams(location.search);
  const urlToken = params.get('token');
  const otherSearchEntries: Array<[string, string]> = [];
  params.forEach((value, key) => {
    if (key !== 'token') otherSearchEntries.push([key, value]);
  });
  return {
    urlToken,
    tokenToUse: urlToken ?? storedToken,
    shouldEnterEmbedMode: urlToken != null && urlToken.length > 0,
    otherSearchEntries,
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoginResponse | null>(null);
  const [embedMode, setEmbedMode] = useState<boolean>(false);
  // initializing 启动时为 true；mount 后调 me()，无论成功失败都置 false
  const [initializing, setInitializing] = useState<boolean>(true);

  const roles = useMemo<readonly string[]>(() => user?.roles ?? [], [user]);
  const menuTree = useMemo<MenuResponse[]>(() => user?.menuTree ?? [], [user]);
  const menuPermissions = useMemo(() => {
    const result = new Set<string>();
    const walk = (nodes: MenuResponse[]) => {
      nodes.forEach((node) => {
        if (node.permission) result.add(node.permission);
        if (node.children?.length) walk(node.children);
      });
    };
    walk(menuTree);
    return result;
  }, [menuTree]);
  const permissions = useMemo<readonly string[]>(
    () => Array.from(new Set([...(user?.permissions ?? []), ...menuPermissions])),
    [user, menuPermissions]
  );
  const permissionSet = useMemo(() => new Set(permissions), [permissions]);
  const isAuthenticated = user != null;
  const isAdmin = useMemo(
    () => roles.some((code) => code.toUpperCase() === ADMIN_ROLE_CODE),
    [roles]
  );

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
    const storedToken = getToken();
    const inputs = extractBootstrapInputs(window.location, storedToken);
    const { tokenToUse, shouldEnterEmbedMode, otherSearchEntries } = inputs;

    if (!tokenToUse) {
      if (!cancelled) setInitializing(false);
      return;
    }

    // URL 带 token 时,先把 token 落 localStorage,让 axios 拦截器立即可用
    if (inputs.urlToken) {
      setTokenToStorage(inputs.urlToken);
    }

    (async () => {
      try {
        const resp = await authApi.me();
        if (cancelled) return;
        setUser(resp);
        setEmbedMode(shouldEnterEmbedMode);
        if (shouldEnterEmbedMode) {
          // 摘掉 URL 中的 token,保留其他 query 参数
          const params = new URLSearchParams();
          for (const [k, v] of otherSearchEntries) params.set(k, v);
          const restSearch = params.toString();
          const cleanPath =
            window.location.pathname + (restSearch ? `?${restSearch}` : '');
          window.history.replaceState({}, '', cleanPath);
        }
      } catch {
        if (cancelled) return;
        clearToken();
        setUser(null);
        setEmbedMode(false);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

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
    setEmbedMode(false); // ★ 新增
  }, []);

  const hasPermission = useCallback(
    (code: string) => isAdmin || permissionSet.has(code),
    [isAdmin, permissionSet]
  );

  const hasAnyPermission = useCallback(
    (codes: readonly string[]) => isAdmin || codes.some((code) => permissionSet.has(code)),
    [isAdmin, permissionSet]
  );

  const hasRole = useCallback(
    (code: string) => roles.some((role) => role.toUpperCase() === code.toUpperCase()),
    [roles]
  );

  const canAccessScreen = useCallback(
    (screen: AppScreen) => canAccessScreenByPermissions(screen, permissionSet, isAdmin),
    [permissionSet, isAdmin]
  );

  const firstAccessibleScreen = useMemo(
    () => ACCESSIBLE_SCREEN_ORDER.find((screen) => canAccessScreen(screen)) ?? AppScreen.DASHBOARD,
    [canAccessScreen]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      roles,
      permissions,
      menuTree,
      isAuthenticated,
      isAdmin,
      initializing,
      embedMode, // ★ 新增
      login,
      logout,
      hasPermission,
      hasAnyPermission,
      hasRole,
      canAccessScreen,
      firstAccessibleScreen,
    }),
    [user, roles, permissions, menuTree, isAuthenticated, isAdmin, initializing, embedMode, login, logout, hasPermission, hasAnyPermission, hasRole, canAccessScreen, firstAccessibleScreen]
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
