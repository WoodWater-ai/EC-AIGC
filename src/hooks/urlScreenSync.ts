import { AppScreen } from '../types';
import { fromPath, toPath } from '../lib/urlRouting';

/**
 * 把 AppScreen 推入浏览器 history 的纯函数(便于在测试中 mock history)。
 * 真实 window.history 类型用 unknown 转换,避免 SSR / 测试环境类型噪音。
 */
export function syncToUrl(
  screen: AppScreen,
  history: History = window.history,
): void {
  history.pushState({}, '', toPath(screen));
}

/**
 * 从 location.pathname 反推 AppScreen;未匹配 fallback DASHBOARD。
 */
export function syncFromUrl(location: Location = window.location): AppScreen {
  return fromPath(location.pathname);
}

/**
 * 注册 popstate 监听器,返回 dispose 函数。
 * 调用 dispose 后,callback 不再触发。
 */
export function attachPopstateListener(
  onPop: () => void,
  win: Window & typeof globalThis = window,
): () => void {
  win.addEventListener('popstate', onPop);
  return () => win.removeEventListener('popstate', onPop);
}
