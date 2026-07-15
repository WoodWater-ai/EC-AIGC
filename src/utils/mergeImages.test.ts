import assert from 'node:assert/strict';
import { test } from 'node:test';

// 注:Canvas API 仅在浏览器 / happy-dom / jsdom 下可用
// node:test 跑这个文件会因 document.createElement('canvas') 不可用而失败
// 这里只在 happy-dom / jsdom 环境下能跑通 —— 留给 vite / 浏览器集成测试
// 本测试仅做"模块存在性"与"签名类型"的轻量校验
import { mergeImagesHorizontal } from './mergeImages';

test('mergeImagesHorizontal 是函数(签名校验)', () => {
  assert.equal(typeof mergeImagesHorizontal, 'function');
});
