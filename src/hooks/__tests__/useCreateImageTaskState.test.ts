// src/hooks/__tests__/useCreateImageTaskState.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';

// 注:React 19 hook 测试需要 react-dom/test-utils 或 React 18 的 act()
// 本项目使用 Node test runner + tsx --test,无 jsdom,故测试只覆盖纯函数部分
// (computeReadinessChecks 等已由 readinessChecks.test.ts 覆盖)

import {
  REFERENCE_SLOTS_INTERNAL,
  type ImageGenerationType,
} from '../useCreateImageTaskState';

test('REFERENCE_SLOTS_INTERNAL exports the 5 slots in canonical order', () => {
  assert.deepEqual(REFERENCE_SLOTS_INTERNAL, ['detail', 'style', 'scene', 'pose', 'model']);
});

test('ImageGenerationType re-exported from types module', () => {
  const t: ImageGenerationType = 'product_main';
  assert.equal(t, 'product_main');
});
