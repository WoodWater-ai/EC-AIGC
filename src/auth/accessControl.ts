import { AppScreen } from '../types';

export const ADMIN_ROLE_CODE = 'ADMIN';

/**
 * 前端页面与后端菜单/权限标识的映射。
 *
 * 数据库里的 user_rights_menu.permission 是页面访问的单一来源；
 * 历史 permission 表中的细粒度权限仍作为兼容项参与判断。
 */
const SCREEN_PERMISSION_MAP: Readonly<Record<AppScreen, readonly string[]>> = {
  [AppScreen.LOGIN]: [],
  [AppScreen.DASHBOARD]: ['dashboard:view'],
  [AppScreen.ASSISTANT]: ['assistant:view'],
  [AppScreen.TASKS]: ['task:view'],
  [AppScreen.CREATE_IMAGE_TASK]: ['task:create'],
  [AppScreen.CREATE_VIDEO_TASK]: ['task:create'],
  [AppScreen.TEMPLATES]: ['template:view'],
  [AppScreen.ASSETS]: ['asset:view'],
  [AppScreen.MODEL_LIBRARY]: ['model-profile:view'],
  [AppScreen.GARMENT]: ['garment:view'],
  [AppScreen.ANALYTICS]: ['analytics:view'],
  [AppScreen.SYSTEM_CONFIG]: [
    'system-config:view',
    'user:view',
    'role:view',
    'channel:view',
    'menu:view',
    'org:view',
    'admin:user-mgmt',
    'admin:role-mgmt',
    'admin:op-log',
  ],
  [AppScreen.ASSET_CATEGORY]: ['asset-category:view'],
  [AppScreen.PRODUCT_CATEGORY]: ['product-category:view'],
  [AppScreen.ASYNC_TASKS]: ['async-task:view'],
  [AppScreen.PRODUCT_MANAGE]: ['product:view'],
  [AppScreen.DICT_CATEGORY]: ['dict-category:view'],
  [AppScreen.DICT_ITEM]: ['dict:view'],
};

export const ACCESSIBLE_SCREEN_ORDER: readonly AppScreen[] = [
  AppScreen.DASHBOARD,
  AppScreen.ASSISTANT,
  AppScreen.TASKS,
  AppScreen.TEMPLATES,
  AppScreen.ASSETS,
  AppScreen.MODEL_LIBRARY,
  AppScreen.GARMENT,
  AppScreen.ANALYTICS,
  AppScreen.SYSTEM_CONFIG,
  AppScreen.ASYNC_TASKS,
  AppScreen.ASSET_CATEGORY,
  AppScreen.PRODUCT_CATEGORY,
  AppScreen.PRODUCT_MANAGE,
  AppScreen.DICT_CATEGORY,
  AppScreen.DICT_ITEM,
];

export function canAccessScreenByPermissions(
  screen: AppScreen,
  permissionSet: ReadonlySet<string>,
  isAdmin: boolean,
): boolean {
  if (screen === AppScreen.LOGIN || isAdmin) return true;
  const required = SCREEN_PERMISSION_MAP[screen];
  if (required.length === 0) return true;
  return required.some((code) => permissionSet.has(code));
}
