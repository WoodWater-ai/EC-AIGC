import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppScreen } from '../types';
import {
  SCREEN_TO_PATH,
  PATH_TO_SCREEN,
  toPath,
  fromPath,
} from './urlRouting';

test('SCREEN_TO_PATH 覆盖全部非 LOGIN 屏幕', () => {
  // 全部非 LOGIN 的 AppScreen 都在 map 里
  for (const screen of Object.values(AppScreen)) {
    if (screen === AppScreen.LOGIN) continue;
    assert.ok(SCREEN_TO_PATH[screen], `${screen} 缺少 path 映射`);
  }
});

test('toPath(DASHBOARD) === "/dashboard"', () => {
  assert.equal(toPath(AppScreen.DASHBOARD), '/dashboard');
});

test('toPath(MODEL_LIBRARY) === "/model-library"', () => {
  assert.equal(toPath(AppScreen.MODEL_LIBRARY), '/model-library');
});

test('fromPath("/tasks") === AppScreen.TASKS', () => {
  assert.equal(fromPath('/tasks'), AppScreen.TASKS);
});

test('fromPath 未知路径 fallback 到 DASHBOARD', () => {
  assert.equal(fromPath('/unknown-foo'), AppScreen.DASHBOARD);
  assert.equal(fromPath(''), AppScreen.DASHBOARD);
  assert.equal(fromPath('/'), AppScreen.DASHBOARD);
});

test('SCREEN_TO_PATH 与 PATH_TO_SCREEN 互逆', () => {
  for (const [screen, path] of Object.entries(SCREEN_TO_PATH)) {
    assert.equal(PATH_TO_SCREEN[path], screen, `反查不一致: ${path}`);
  }
});
