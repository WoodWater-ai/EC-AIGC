import { AppScreen } from '../types';

/**
 * AppScreen ↔ URL path 双向映射。
 * [v1 2026-08-24 spec:URL 直链] 单一来源,所有 path 转换走这里。
 * LOGIN 不映射到 path(LOGIN 是 React state,不参与 URL 路由)。
 */
export const SCREEN_TO_PATH: Readonly<Record<AppScreen, string>> = {
  [AppScreen.DASHBOARD]: '/dashboard',
  [AppScreen.ASSISTANT]: '/assistant',
  [AppScreen.TASKS]: '/tasks',
  [AppScreen.CREATE_IMAGE_TASK]: '/create-image-task',
  [AppScreen.CREATE_VIDEO_TASK]: '/create-video-task',
  [AppScreen.TEMPLATES]: '/templates',
  [AppScreen.ASSETS]: '/assets',
  [AppScreen.MODEL_LIBRARY]: '/model-library',
  [AppScreen.GARMENT]: '/garment',
  [AppScreen.ANALYTICS]: '/analytics',
  [AppScreen.SYSTEM_CONFIG]: '/system-config',
  [AppScreen.ASSET_CATEGORY]: '/asset-category',
  [AppScreen.PRODUCT_CATEGORY]: '/product-category',
  [AppScreen.ASYNC_TASKS]: '/async-tasks',
  [AppScreen.PRODUCT_MANAGE]: '/product-manage',
  [AppScreen.DICT_CATEGORY]: '/dict-category',
  [AppScreen.DICT_ITEM]: '/dict-item',
  // LOGIN 不参与 URL 路由;此处 key 必须存在以满足类型约束
  [AppScreen.LOGIN]: '/login-internal',
};

export const PATH_TO_SCREEN: Readonly<Record<string, AppScreen>> =
  Object.fromEntries(
    Object.entries(SCREEN_TO_PATH).map(([screen, path]) => [path, screen as AppScreen]),
  );

export function toPath(screen: AppScreen): string {
  return SCREEN_TO_PATH[screen] ?? '/dashboard';
}

export function fromPath(path: string): AppScreen {
  // 去掉 trailing slash(兼容 '/dashboard/' 和 '/dashboard')
  const normalized = path.replace(/\/+$/, '') || '/';
  return PATH_TO_SCREEN[normalized] ?? AppScreen.DASHBOARD;
}
