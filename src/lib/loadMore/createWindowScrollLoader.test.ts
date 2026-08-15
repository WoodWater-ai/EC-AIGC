import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWindowScrollLoader } from './createWindowScrollLoader';

// Polyfill window for Node.js test environment
const listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();
let rafId = 0;

const raf = (cb: (time: number) => void): number => {
  const id = ++rafId;
  // Defer to next event loop tick so ticking throttle works across scroll bursts
  setTimeout(() => { cb(0); }, 0);
  return id;
};

(globalThis as unknown as Record<string, unknown>)['window'] = {
  addEventListener(event: string, handler: (...args: unknown[]) => void) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(handler);
  },
  removeEventListener(event: string, handler: (...args: unknown[]) => void) {
    listeners.get(event)?.delete(handler);
  },
  dispatchEvent(event: Event) {
    listeners.get(event.type)?.forEach((h) => h(event));
    return true;
  },
  requestAnimationFrame: raf,
  cancelAnimationFrame: () => { /* no-op */ },
};

// Polyfill global requestAnimationFrame too (code calls it as global, not window.*)
globalThis.requestAnimationFrame = raf;

test('距底 < 阈值时调用 onTrigger', () => {
  let triggered = 0;
  const loader = createWindowScrollLoader({
    threshold: 200,
    onTrigger: () => { triggered += 1; },
    getMetrics: () => ({ scrollTop: 1800, scrollHeight: 2000, clientHeight: 200 }),
  });
  loader.start();
  // 触发一次内部 scroll
  window.dispatchEvent(new Event('scroll'));
  // rAF 异步,需等下一帧
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      assert.equal(triggered, 1);
      loader.stop();
      resolve();
    }, 50);
  });
});

test('rAF 节流:同一帧多次 scroll 只触发一次', () => {
  let triggered = 0;
  const loader = createWindowScrollLoader({
    threshold: 200,
    onTrigger: () => { triggered += 1; },
    getMetrics: () => ({ scrollTop: 1800, scrollHeight: 2000, clientHeight: 200 }),
  });
  loader.start();
  window.dispatchEvent(new Event('scroll'));
  window.dispatchEvent(new Event('scroll'));
  window.dispatchEvent(new Event('scroll'));
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      assert.equal(triggered, 1, 'rAF 内多次 scroll 应合并');
      loader.stop();
      resolve();
    }, 50);
  });
});

test('stop 后 scroll 不再触发', () => {
  let triggered = 0;
  const loader = createWindowScrollLoader({
    threshold: 200,
    onTrigger: () => { triggered += 1; },
    getMetrics: () => ({ scrollTop: 1800, scrollHeight: 2000, clientHeight: 200 }),
  });
  loader.start();
  loader.stop();
  window.dispatchEvent(new Event('scroll'));
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      assert.equal(triggered, 0);
      resolve();
    }, 50);
  });
});

test('距底 >= 阈值时不触发', () => {
  let triggered = 0;
  const loader = createWindowScrollLoader({
    threshold: 200,
    onTrigger: () => { triggered += 1; },
    getMetrics: () => ({ scrollTop: 0, scrollHeight: 2000, clientHeight: 800 }),
  });
  loader.start();
  window.dispatchEvent(new Event('scroll'));
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      assert.equal(triggered, 0);
      loader.stop();
      resolve();
    }, 50);
  });
});
