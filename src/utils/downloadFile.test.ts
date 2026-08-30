import assert from 'node:assert/strict';
import { test } from 'node:test';

// 注:triggerBrowserDownload 依赖浏览器 DOM API (document.createElement 等)
// node:test 跑这个文件会因 document 不可用而失败
// 这里只在 happy-dom / jsdom 环境下能跑通 —— 留给 vite / 浏览器集成测试
// 本测试仅做"模块存在性"与"签名类型"的轻量校验
import {
  inferExtensionFromMime,
  triggerBrowserDownload,
  fetchAsBlob,
} from './downloadFile';

test('inferExtensionFromMime: image/jpeg -> jpg', () => {
  assert.equal(inferExtensionFromMime('image/jpeg'), 'jpg');
});

test('inferExtensionFromMime: video/mp4 -> mp4', () => {
  assert.equal(inferExtensionFromMime('video/mp4'), 'mp4');
});

test('inferExtensionFromMime: 未知 mime 返回 fallback', () => {
  assert.equal(inferExtensionFromMime('application/octet-stream', 'bin'), 'bin');
  assert.equal(inferExtensionFromMime('application/octet-stream', undefined), 'unknown');
});

test('triggerBrowserDownload 是函数(签名校验)', () => {
  assert.equal(typeof triggerBrowserDownload, 'function');
});

test('fetchAsBlob: 网络成功返回 Blob', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(new Blob(['hello'], { type: 'text/plain' }), {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })) as typeof fetch;
  try {
    const blob = await fetchAsBlob('https://example.com/test');
    assert.equal(blob.type, 'text/plain');
    assert.equal(blob.size, 5);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchAsBlob: HTTP 404 抛错', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response('not found', { status: 404, statusText: 'Not Found' })) as typeof fetch;
  try {
    await assert.rejects(
      () => fetchAsBlob('https://example.com/missing'),
      /HTTP 404/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
