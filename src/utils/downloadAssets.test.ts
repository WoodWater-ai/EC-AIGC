import assert from 'node:assert/strict';
import { test } from 'node:test';
import { downloadAssetsSequentially } from './downloadAssets';

const sample = [
  { id: '1', name: 'a.jpg', originalUrl: 'https://x.test/a.jpg' },
  { id: '2', name: 'b.jpg', originalUrl: 'https://x.test/b.jpg' },
];

// DOM mocks for node:test environment
const fireEvent = () => {};
globalThis.document = {
  createElement: (tag: string) => {
    if (tag === 'a') return { href: '', download: '', target: '', rel: '', click: fireEvent, remove: fireEvent };
    return {};
  },
  body: { appendChild: fireEvent, remove: fireEvent },
} as unknown as Document;
(globalThis as unknown as { window: {} }).window = {};

test('全成功:success 等于项数,failed 为空', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(new Blob(['x'], { type: 'image/jpeg' }), { status: 200 })) as typeof fetch;
  try {
    const result = await downloadAssetsSequentially(sample, { delayMs: 0 });
    assert.equal(result.success, 2);
    assert.deepEqual(result.failed, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('缺 originalUrl 记 failed(原因=缺少原图地址),批处理继续', async () => {
  const items = [
    { id: '1', name: 'no-url.jpg' },
    { id: '2', name: 'has.jpg', originalUrl: 'https://x.test/has.jpg' },
  ];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(new Blob(['x'], { type: 'image/jpeg' }), { status: 200 })) as typeof fetch;
  try {
    const result = await downloadAssetsSequentially(items, { delayMs: 0 });
    assert.equal(result.success, 1);
    assert.equal(result.failed.length, 1);
    assert.equal(result.failed[0].id, '1');
    assert.equal(result.failed[0].name, 'no-url.jpg');
    assert.equal(result.failed[0].reason, '缺少原图地址');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetch 失败记 failed(原因=err.message),批处理继续', async () => {
  const items = [
    { id: '1', name: 'a.jpg', originalUrl: 'https://x.test/a.jpg' },
    { id: '2', name: 'b.jpg', originalUrl: 'https://x.test/b.jpg' },
  ];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('a.jpg')) throw new Error('HTTP 500');
    return new Response(new Blob(['x']), { status: 200 });
  }) as typeof fetch;
  try {
    const result = await downloadAssetsSequentially(items, { delayMs: 0 });
    assert.equal(result.success, 1);
    assert.equal(result.failed.length, 1);
    assert.equal(result.failed[0].id, '1');
    assert.match(result.failed[0].reason, /HTTP 500/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('onItemComplete 按 idx 升序回调', async () => {
  const calls: number[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(new Blob(['x']), { status: 200 })) as typeof fetch;
  try {
    await downloadAssetsSequentially(sample, {
      delayMs: 0,
      onItemComplete: (idx) => calls.push(idx),
    });
    assert.deepEqual(calls, [0, 1]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('全失败仍返回干净 result,不抛错', async () => {
  const items = [
    { id: '1', name: 'a.jpg' },
    { id: '2', name: 'b.jpg', originalUrl: 'https://x.test/b.jpg' },
  ];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error('boom'); }) as typeof fetch;
  try {
    const result = await downloadAssetsSequentially(items, { delayMs: 0 });
    assert.equal(result.success, 0);
    assert.equal(result.failed.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
