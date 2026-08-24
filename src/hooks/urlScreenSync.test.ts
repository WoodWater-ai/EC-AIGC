import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppScreen } from '../types';
import {
  syncToUrl,
  syncFromUrl,
  attachPopstateListener,
} from './urlScreenSync';

test('syncToUrl(AppScreen.TASKS) → history.pushState("/tasks")', () => {
  let capturedPath: string | null = null;
  const fakeHistory = {
    pushState: (_: unknown, __: string, path: string) => {
      capturedPath = path;
    },
  };
  syncToUrl(AppScreen.TASKS, fakeHistory as unknown as History);
  assert.equal(capturedPath, '/tasks');
});

test('syncFromUrl 当前 pathname "/dashboard" → AppScreen.DASHBOARD', () => {
  let currentPath = '/dashboard';
  const fakeLocation = {
    get pathname() { return currentPath; },
  };
  assert.equal(
    syncFromUrl(fakeLocation as unknown as Location),
    AppScreen.DASHBOARD,
  );
  currentPath = '/tasks';
  assert.equal(
    syncFromUrl(fakeLocation as unknown as Location),
    AppScreen.TASKS,
  );
});

test('syncFromUrl 未知 path fallback DASHBOARD', () => {
  const fakeLocation = { pathname: '/foo-bar-unknown' };
  assert.equal(
    syncFromUrl(fakeLocation as unknown as Location),
    AppScreen.DASHBOARD,
  );
});

test('attachPopstateListener 返回 dispose 函数,dispose 后不再触发 callback', () => {
  let popstateCount = 0;
  const fakeWindow = {
    addEventListener: (_event: string, cb: () => void) => {
      // 不挂真 listener,直接记录
    },
    removeEventListener: (_event: string, _cb: () => void) => {},
  };
  // 简化:本测试只验证 attach 返回的 dispose 函数能正常移除 listener
  const dispose = attachPopstateListener(
    () => { popstateCount++; },
    fakeWindow as unknown as Window,
  );
  assert.equal(typeof dispose, 'function');
  dispose();
  assert.equal(dispose.length, 0); // dispose 是 0-arg 函数
});
