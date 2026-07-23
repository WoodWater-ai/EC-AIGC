// src/lib/createImageTask/referenceOrder.ts
// 纯函数 — 参考图 slot 顺序重排(供 hook 与测试复用)

import type { ReferenceSlot } from './extractReferenceInsights';

export const REFERENCE_SLOTS: ReferenceSlot[] = ['detail', 'style', 'scene', 'pose', 'model'];

/**
 * 给一个 referenceOrder Map + selected-slots 集合,返回新的 Map,把已选 slot 的顺序
 * 重新连续编号 1..N。
 *
 * - 未选 slot 保留 undefined(不影响其他 slot)
 * - 同 order 时按 REFERENCE_SLOTS 顺序稳定排序
 *
 * @param prev        旧 order Map
 * @param selected    当前已选 slot 集合(以决定哪些参与重排)
 */
export function compactReferenceOrder(
  prev: Record<ReferenceSlot, number | undefined>,
  selected: Set<ReferenceSlot>,
): Record<ReferenceSlot, number | undefined> {
  const filled = REFERENCE_SLOTS
    .filter((s) => selected.has(s) && prev[s] !== undefined)
    .map((slot) => ({ slot, order: prev[slot]! }))
    .sort((a, b) => a.order - b.order);
  const out: Record<ReferenceSlot, number | undefined> = {
    detail: undefined, style: undefined, scene: undefined, pose: undefined, model: undefined,
  };
  filled.forEach((f, i) => { out[f.slot] = i + 1; });
  return out;
}

/**
 * 在当前已选列表中把 fromSlot 移到位置 toIndex(0-based, 0 = 最前),
 * 然后重新连续编号 1..N。
 */
export function moveReferenceInOrder(
  prev: Record<ReferenceSlot, number | undefined>,
  selected: Set<ReferenceSlot>,
  fromSlot: ReferenceSlot,
  toIndex: number,
): Record<ReferenceSlot, number | undefined> {
  if (!selected.has(fromSlot)) return prev;
  const filled = REFERENCE_SLOTS
    .filter((s) => selected.has(s) && prev[s] !== undefined)
    .map((slot) => ({ slot, order: prev[slot]! }))
    .sort((a, b) => a.order - b.order);
  const fromIdx = filled.findIndex((f) => f.slot === fromSlot);
  if (fromIdx === -1) return prev;
  const target = Math.max(0, Math.min(toIndex, filled.length - 1));
  if (target === fromIdx) return prev;
  const next = filled.filter((f) => f.slot !== fromSlot);
  next.splice(target, 0, { slot: fromSlot, order: filled[fromIdx].order });
  return renumber(next);
}

/**
 * 给一个递增分配:已选 slot 中已有 order 的保留,新选 slot 落入"第一个空位"。
 * 数字按 REFERENCE_SLOTS 顺序紧凑连续:detail→1, style→2, ...
 * 与 UI 徽标 + 2(主图固定 1)对齐:detail 徽 3,style 徽 4,...
 */
export function assignNextOrder(
  prev: Record<ReferenceSlot, number | undefined>,
  selected: Set<ReferenceSlot>,
): Record<ReferenceSlot, number | undefined> {
  const out = { ...prev };
  let changed = false;
  // 第一轮:扫 REFERENCE_SLOTS 顺序,给"已选但 order 未定义"的 slot 找最小未占用号
  const used = new Set(
    Object.values(out).filter((v): v is number => typeof v === 'number'),
  );
  for (const s of REFERENCE_SLOTS) {
    if (selected.has(s) && out[s] === undefined) {
      let next = 1;
      while (used.has(next)) next += 1;
      out[s] = next;
      used.add(next);
      changed = true;
    }
  }
  return changed ? out : prev;
}

function renumber(filled: { slot: ReferenceSlot; order: number }[]): Record<ReferenceSlot, number | undefined> {
  const out: Record<ReferenceSlot, number | undefined> = {
    detail: undefined, style: undefined, scene: undefined, pose: undefined, model: undefined,
  };
  filled.forEach((f, i) => { out[f.slot] = i + 1; });
  return out;
}