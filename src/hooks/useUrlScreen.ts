import { useCallback, useEffect, useRef, useState } from 'react';
import { AppScreen } from '../types';
import { toPath } from '../lib/urlRouting';
import {
  syncToUrl,
  syncFromUrl,
  attachPopstateListener,
} from './urlScreenSync';

/**
 * [v1 2026-08-24 spec:URL 直链] 把 AppScreen 双向绑定到 window.location.pathname。
 *
 * 行为契约:
 * - mount:从 location.pathname 初始化 state(未匹配 → DASHBOARD)
 * - setter:更新 state + pushState 写入 URL
 * - popstate(浏览器前进/后退):重读 pathname → setState(不再 pushState,避免循环)
 *
 * 内部 lastWriteRef 记录上次 pushState 写入的 path,
 * 防止 popstate 回调里再次触发 pushState 导致 pushState/popstate 死循环。
 */
export function useUrlScreen(
  initial: AppScreen,
): [AppScreen, (screen: AppScreen) => void] {
  const [screen, setScreenInternal] = useState<AppScreen>(() => {
    const fromUrl = syncFromUrl();
    return fromUrl; // fallback 在 syncFromUrl 内部处理
  });

  const lastWriteRef = useRef<string>('');
  const isInternalWriteRef = useRef<boolean>(false);

  const setScreen = useCallback((next: AppScreen) => {
    isInternalWriteRef.current = true;
    setScreenInternal(next);
    syncToUrl(next);
    lastWriteRef.current = toPath(next);
    // microtask 重置 flag(让 popstate 知道这次是内部写入触发的)
    queueMicrotask(() => {
      isInternalWriteRef.current = false;
    });
  }, []);

  useEffect(() => {
    const dispose = attachPopstateListener(() => {
      if (isInternalWriteRef.current) return;
      const fromUrl = syncFromUrl();
      if (toPath(fromUrl) === lastWriteRef.current) return;
      setScreenInternal(fromUrl);
      lastWriteRef.current = toPath(fromUrl);
    });
    return dispose;
  }, []);

  // 首次 mount 后,把 lastWriteRef 同步到当前 path,
  // 防止初次 popstate 与 lastWriteRef 不一致触发额外 setState。
  useEffect(() => {
    lastWriteRef.current = toPath(screen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [screen, setScreen];
}
