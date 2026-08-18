import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  STORAGE_KEY,
  DEFAULT_HEIGHT,
  MIN_HEIGHT,
  MAX_HEIGHT_DESKTOP,
  MAX_HEIGHT_MOBILE,
  clampHeight,
  parseStoredHeight,
  computeNextHeight,
} from './inputHeight';

test('STORAGE_KEY 带 v1 版本号后缀', () => {
  assert.match(STORAGE_KEY, /\.v1$/);
});

test('DEFAULT_HEIGHT 在 MIN 与 MAX_DESKTOP 之间', () => {
  assert.ok(DEFAULT_HEIGHT > MIN_HEIGHT);
  assert.ok(DEFAULT_HEIGHT < MAX_HEIGHT_DESKTOP);
});

test('MAX_HEIGHT_MOBILE < MAX_HEIGHT_DESKTOP', () => {
  assert.ok(MAX_HEIGHT_MOBILE < MAX_HEIGHT_DESKTOP);
});

test('clampHeight 在范围内返回原值', () => {
  assert.equal(clampHeight(100, 48, 240), 100);
});

test('clampHeight 低于 min 时夹到 min', () => {
  assert.equal(clampHeight(10, 48, 240), 48);
});

test('clampHeight 高于 max 时夹到 max', () => {
  assert.equal(clampHeight(999, 48, 240), 240);
});

test('parseStoredHeight:合法字符串返回其值', () => {
  assert.equal(parseStoredHeight('150', 48, 240), 150);
});

test('parseStoredHeight:null 返回 DEFAULT', () => {
  assert.equal(parseStoredHeight(null, 48, 240), DEFAULT_HEIGHT);
});

test('parseStoredHeight:空字符串返回 DEFAULT', () => {
  assert.equal(parseStoredHeight('', 48, 240), DEFAULT_HEIGHT);
});

test('parseStoredHeight:非数字字符串返回 DEFAULT', () => {
  assert.equal(parseStoredHeight('abc', 48, 240), DEFAULT_HEIGHT);
});

test('parseStoredHeight:低于 min 夹到 min,非 DEFAULT', () => {
  assert.equal(parseStoredHeight('10', 48, 144), 48);
});

test('parseStoredHeight:高于 max 夹到 max,非 DEFAULT', () => {
  assert.equal(parseStoredHeight('200', 48, 144), 144);
});

test('parseStoredHeight:合法数字夹在 [min,max] 内返回原值', () => {
  assert.equal(parseStoredHeight('120', 48, 144), 120);
});

test('computeNextHeight:在范围内正确相加', () => {
  assert.equal(computeNextHeight(100, 50, 48, 240), 150);
});

test('computeNextHeight:加过大夹到 max', () => {
  assert.equal(computeNextHeight(200, 999, 48, 240), 240);
});

test('computeNextHeight:减过小夹到 min', () => {
  assert.equal(computeNextHeight(60, -100, 48, 240), 48);
});
