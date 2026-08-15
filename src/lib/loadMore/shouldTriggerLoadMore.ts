/**
 * 判断是否应触发下一页加载。
 *
 * 触发条件:`scrollHeight - scrollTop - clientHeight` < threshold
 * - 严格小于:距底刚好等于阈值不算,留出视觉缓冲
 * - 任一参数为负:页面尚未滚动或容器未挂载,返回 false
 */
export function shouldTriggerLoadMore(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  threshold: number,
): boolean {
  if (scrollTop < 0 || scrollHeight < 0 || clientHeight < 0 || threshold < 0) {
    return false;
  }
  return scrollHeight - scrollTop - clientHeight < threshold;
}
