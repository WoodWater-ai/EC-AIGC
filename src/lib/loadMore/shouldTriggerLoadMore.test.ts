import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldTriggerLoadMore } from './shouldTriggerLoadMore';

test('距离底部小于阈值时返回 true', () => {
  // scrollHeight=2000, scrollTop=1800, clientHeight=200 → 距底 0px
  assert.equal(shouldTriggerLoadMore(1800, 2000, 200, 200), true);
});

test('距离底部等于阈值时返回 false(严格小于)', () => {
  // scrollHeight=2000, scrollTop=1700, clientHeight=200 → 距底 100px, 阈值 100
  assert.equal(shouldTriggerLoadMore(1700, 2000, 200, 100), false);
});

test('距离底部大于阈值时返回 false', () => {
  assert.equal(shouldTriggerLoadMore(0, 2000, 800, 200), false);
});

test('任意参数为负数时返回 false(滚动尚未发生)', () => {
  assert.equal(shouldTriggerLoadMore(-1, 2000, 800, 200), false);
});
