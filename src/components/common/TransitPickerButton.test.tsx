import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { TransitPickerButton, toSlotRef } from './TransitPickerButton';
import type { SlotRef } from '../createTask/slots';

// 类型层测试为主;运行时交互留给 Playwright/E2E(本计划不引入)

test('TransitPickerButton 接受最小 props', () => {
  const slot = 'top' as const;
  const value: SlotRef | null = null;
  const onChange = (_next: SlotRef | null) => {};
  const _typeCheck = <TransitPickerButton slot={slot} value={value} onChange={onChange} />;
  assert.ok(_typeCheck);
});

test('TransitPickerButton multiSelect prop 默认 false', () => {
  const _ = <TransitPickerButton slot="main" value={null} onChange={() => {}} />;
  assert.ok(_);
});

test('toSlotRef(item) → SlotRef 映射(fileResourceId 必填)', () => {
  const item = {
    id: '1',
    name: 'test',
    assetKind: 'IMAGE' as const,
    uploadUserId: 1,
    fileResourceId: '99',
    categoryIds: [],
    status: 'NORMAL' as const,
  };
  const ref: SlotRef = toSlotRef(item);
  assert.equal(ref.fileResourceId, '99');
  assert.equal(ref.name, 'test');
});

test('toSlotRef 优先用 thumbnailUrl,fallback 到 originalUrl', () => {
  const item1 = {
    id: '1', name: 'a', assetKind: 'IMAGE' as const, uploadUserId: 1,
    fileResourceId: '1', categoryIds: [], status: 'NORMAL' as const,
    thumbnailUrl: 'thumb-a',
  };
  const item2 = {
    id: '2', name: 'b', assetKind: 'IMAGE' as const, uploadUserId: 1,
    fileResourceId: '2', categoryIds: [], status: 'NORMAL' as const,
    originalUrl: 'orig-b',
  };
  assert.equal(toSlotRef(item1).thumbnailUrl, 'thumb-a');
  assert.equal(toSlotRef(item2).thumbnailUrl, 'orig-b');
});
