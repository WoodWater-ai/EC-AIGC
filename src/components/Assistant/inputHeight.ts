// 创作助手输入框高度相关常量与纯函数(spec §4.3 / §4.6 / §6 引用)

export const STORAGE_KEY = 'assistant.inputHeight.v1';

export const DEFAULT_HEIGHT = 88;        // ≈ 4 行
export const MIN_HEIGHT = 48;            // ≈ 2 行
export const MAX_HEIGHT_DESKTOP = 240;   // ≈ 10 行
export const MAX_HEIGHT_MOBILE = 144;    // ≈ 6 行
export const BREAKPOINT_PX = 768;        // 与 Tailwind md: 对齐

export const STEP_KEY_SMALL = 8;         // ↑ / ↓
export const STEP_KEY_LARGE = 32;        // PgUp / PgDn

/**
 * 把值钳制到 [min, max]。
 */
export function clampHeight(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 把 localStorage 取出的字符串解析为合法的输入框高度。
 * - 非法(null / 空 / 非数字)→ DEFAULT_HEIGHT
 * - 合法但在范围之外 → 钳制到最近边界(spec §6:窗口变窄钳制)
 */
export function parseStoredHeight(
  raw: string | null,
  min: number,
  max: number,
): number {
  if (raw == null || raw === '') return DEFAULT_HEIGHT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_HEIGHT;
  return clampHeight(parsed, min, max);
}

/**
 * 拖拽过程中根据起始高度与位移计算新高度,钳制在 [min, max]。
 */
export function computeNextHeight(
  startHeight: number,
  delta: number,
  min: number,
  max: number,
): number {
  return clampHeight(startHeight + delta, min, max);
}
