import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { ModelLibrary } from './ModelLibrary';
import type { ModelProfileDTO } from '../api/modules/modelProfile';

const sampleProfile: ModelProfileDTO = {
  id: 'p1',
  assetResourceId: 'a1',
  name: '样例模特',
  image: 'https://example.com/a.png',
  source: 'text',
  sourceMode: 'text',
  modelType: 'human',
  licenseStatus: 'cleared',
  tags: ['甜美'],
  categories: [],
  suitableFor: ['product_main'],
  status: 'active',
  usageCount: 0,
  averageAestheticScore: 0,
  passRate: 0,
};

test('ModelLibrary 接受新的无限滚动 props(类型层校验)', () => {
  const el = (
    <ModelLibrary
      profiles={[sampleProfile]}
      onCreateProfile={() => {}}
      loadingMore={false}
      hasMore={true}
      total={1}
      onLoadMore={() => {}}
      onFilterChange={() => {}}
    />
  );
  assert.ok(el);
});

test('ModelLibrary 不传新 props 时 TS 不报错(向后兼容)', () => {
  const el = <ModelLibrary profiles={[sampleProfile]} onCreateProfile={() => {}} />;
  assert.ok(el);
});
