import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { ResourceMergeDrawer } from './ResourceMergeDrawer';
import type { AssetResourceItem } from '../../api/modules/asset';

const image: AssetResourceItem = {
  id: 'asset-1',
  name: 'top.png',
  assetKind: 'IMAGE',
  originalUrl: 'https://example.com/top.png',
  uploadUserId: '1',
  categoryIds: [],
  status: 'NORMAL',
};

test('合并抽屉接受产品素材的默认上下方向与创建回调', () => {
  const el = (
    <ResourceMergeDrawer
      items={[image]}
      productIds={['sku-1']}
      defaultDirection="VERTICAL"
      onAssetCreated={async (assetId) => {
        assert.equal(assetId, 'created-asset');
      }}
      onClose={() => {}}
      onUploaded={() => {}}
    />
  );
  assert.ok(el);
});
