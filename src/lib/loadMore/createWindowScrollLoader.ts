import { shouldTriggerLoadMore } from './shouldTriggerLoadMore';

interface CreateWindowScrollLoaderOptions {
  /** 距底阈值(px),默认 200,与 AssetTransitModal 产品 tab 一致 */
  threshold?: number;
  /** 触发时调用(由调用方保证幂等,如检查 loadingVersionRef) */
  onTrigger: () => void;
  /** 实时读取 scroll 几何信息(避免闭包 stale) */
  getMetrics: () => { scrollTop: number; scrollHeight: number; clientHeight: number };
}

/**
 * 创建 window scroll + rAF 节流的滚动加载器。
 *
 * 设计要点:
 * - passive: true,不阻塞滚动
 * - requestAnimationFrame 节流,每帧最多一次触发
 * - start()/stop() 显式控制生命周期,适配 React useEffect
 * - 通过 getMetrics 闭包读最新几何,避免重渲染不同步
 */
export function createWindowScrollLoader(opts: CreateWindowScrollLoaderOptions) {
  const { onTrigger, getMetrics } = opts;
  const threshold = opts.threshold ?? 200;
  let ticking = false;
  let active = false;

  const handleScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const { scrollTop, scrollHeight, clientHeight } = getMetrics();
      if (!shouldTriggerLoadMore(scrollTop, scrollHeight, clientHeight, threshold)) return;
      onTrigger();
    });
  };

  return {
    start() {
      if (active) return;
      active = true;
      window.addEventListener('scroll', handleScroll, { passive: true });
    },
    stop() {
      if (!active) return;
      active = false;
      window.removeEventListener('scroll', handleScroll);
    },
  };
}
