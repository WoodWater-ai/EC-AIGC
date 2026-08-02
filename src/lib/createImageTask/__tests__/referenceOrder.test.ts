// src/lib/createImageTask/__tests__/referenceOrder.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  compactReferenceOrder,
  moveReferenceInOrder,
  assignNextOrder,
  REFERENCE_SLOTS,
} from '../referenceOrder';

const empty = (): Record<typeof REFERENCE_SLOTS[number], number | undefined> => ({
  detail: undefined, style: undefined, scene: undefined, pose: undefined, model: undefined,
});

test('assignNextOrder 给首个空位补最小号', () => {
  const prev = empty();
  const selected = new Set<typeof REFERENCE_SLOTS[number]>(['detail', 'scene']);
  const out = assignNextOrder(prev, selected);
  // 按 REFERENCE_SLOTS 顺序:detail → 1,style(空),scene(已选但 order 未定) → 2
  assert.equal(out.detail, 1, 'detail 已选 → 序号 1');
  assert.equal(out.scene, 2, 'scene 已选 → 序号 2(紧凑连续)');
  assert.equal(out.style, undefined);
});

test('assignNextOrder 跳过已被占用的最小号,分配下一可用号', () => {
  // detail 已分配序号 1,style 才被选 — 应该分配 2(不能给 1,因为已被 detail 占)
  const prev = { ...empty(), detail: 1 };
  const selected = new Set<typeof REFERENCE_SLOTS[number]>(['detail', 'style']);
  const out = assignNextOrder(prev, selected);
  assert.equal(out.detail, 1, 'detail 保留 序号 1');
  assert.equal(out.style, 2, 'style → 2');
});

test('moveReferenceInOrder 拖动到目标位置后顺序重新连续', () => {
  // 已选顺序 1=detail, 2=scene, 3=pose
  const prev = { ...empty(), detail: 1, scene: 2, pose: 3 };
  const selected = new Set<typeof REFERENCE_SLOTS[number]>(['detail', 'scene', 'pose']);
  // 把 detail 移到末尾(toIndex=2= pose 之后)
  const out = moveReferenceInOrder(prev, selected, 'detail', 2);
  assert.equal(out.scene, 1, 'scene 应该排第 1');
  assert.equal(out.pose, 2, 'pose 应该排第 2');
  assert.equal(out.detail, 3, 'detail 应该排第 3');
});

test('moveReferenceInOrder 边界:toIndex 超出范围被夹到末尾(等价 target=最后一个填充位)', () => {
  // detail 是已选序列的第 0 位,要把 detail 挪到末尾 = scene 之后,
  // 但 toIndex 是按 [filled.length-1] 夹紧,filled.length=2 → target=1
  // 0 != 1,所以仍然发生移动(注意:目标 index 与 filled length 不直接挂钩 — 它就是已选序列的索引)
  const prev = { ...empty(), detail: 1, scene: 2 };
  const selected = new Set<typeof REFERENCE_SLOTS[number]>(['detail', 'scene']);
  const out = moveReferenceInOrder(prev, selected, 'detail', 100);
  // target=1,splice 把 detail 放到 scene 之后 → scene:1, detail:2
  assert.deepEqual({ detail: out.detail, scene: out.scene }, { detail: 2, scene: 1 });
});

test('compactReferenceOrder 把残留 undefined 清掉后按当前已选顺序重新编号', () => {
  // detail 编号 5、scene 编号 1(脏数据)
  const prev = { ...empty(), detail: 5, scene: 1 };
  const selected = new Set<typeof REFERENCE_SLOTS[number]>(['detail', 'scene']);
  const out = compactReferenceOrder(prev, selected);
  assert.equal(out.scene, 1, 'scene 应该变成 1');
  assert.equal(out.detail, 2, 'detail 应该变成 2');
});

test('all slots 引用正确顺序', () => {
  assert.deepEqual(REFERENCE_SLOTS, ['detail', 'style', 'scene', 'pose', 'model']);
});
