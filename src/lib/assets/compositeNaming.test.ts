import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCompositeResourceName } from './compositeNaming';

test('套图统一按 A+B+套装命名并移除文件扩展名', () => {
  assert.equal(buildCompositeResourceName(['冲锋衣.png', '工装裤.jpg']), '冲锋衣+工装裤+套装');
});

test('空名称使用合成套装兜底，名称不超过 80 个字符', () => {
  assert.equal(buildCompositeResourceName([]), '合成套装');
  assert.ok(buildCompositeResourceName(['A'.repeat(50), 'B'.repeat(50)]).length <= 80);
});
