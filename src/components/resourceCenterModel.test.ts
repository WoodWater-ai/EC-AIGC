import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProductLibraryProductDetail } from '../api/modules/productLibrary';

test('product detail keeps input images alongside generated images', async () => {
  let model: {
    buildProductDetailAssets?: (
      detail: ProductLibraryProductDetail,
      mediaFilter: 'ALL' | 'IMAGE' | 'VIDEO' | 'AUDIO',
    ) => Array<{ id: string; sourceType?: string; productId?: string }>;
  } | null = null;

  try {
    model = await import('./resourceCenterModel');
  } catch {
    // RED phase: the resource-center mapper does not exist yet.
  }

  assert.equal(typeof model?.buildProductDetailAssets, 'function');

  const detail = {
    id: 'product-1',
    name: '格纹围巾',
    inputAssetCount: 1,
    imageCount: 1,
    videoCount: 1,
    pendingReviewCount: 0,
    passedCount: 0,
    rejectedCount: 0,
    totalCost: 0,
    latestStatus: 'ARCHIVED',
    inputAssets: [{
      id: 'input-1',
      name: '默认白底图',
      mediaType: 'IMAGE',
      assetType: 'PRODUCT_ORIGINAL',
      url: '/input.jpg',
    }],
    generatedImages: [{
      id: 'generated-image-1',
      productId: 'product-1',
      productName: '格纹围巾',
      taskId: 'task-1',
      mediaType: 'IMAGE',
      url: '/generated.jpg',
      status: 'ARCHIVED',
    }],
    generatedVideos: [{
      id: 'generated-video-1',
      productId: 'product-1',
      productName: '格纹围巾',
      taskId: 'task-2',
      mediaType: 'VIDEO',
      url: '/generated.mp4',
      status: 'ARCHIVED',
    }],
    reviews: [],
  } satisfies ProductLibraryProductDetail;

  const assets = model!.buildProductDetailAssets!(detail, 'IMAGE');

  assert.deepEqual(assets.map((asset) => asset.id), ['input-1', 'generated-image-1']);
  assert.equal(assets[0].sourceType, 'UPLOAD');
  assert.equal(assets[0].productId, 'product-1');
});
