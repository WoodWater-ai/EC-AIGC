// src/lib/createImageTask/__tests__/buildGenerationTask.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildGenerationTask } from '../buildGenerationTask';

const baseInput = {
  imageType: 'product_main' as const,
  index: 0,
  groupId: 'G-2026-07-21',
  product: {
    id: 'p1', name: '法式针织衫', sku: 'SKU-1', category: '户外服饰' as const,
    imageCount: 0, videoCount: 0, thumbnail: 'thumb.png', addedTime: '2026-01-01',
    specs: { brand: 'B', color: ['米白'], material: '羊毛', weight: '200g', sellingPoints: ['柔软透气'] },
    files: [],
  },
  taskProductName: '法式针织衫',
  productName: '法式针织衫',
  templateName: '默认模板',
  promptText: '商品基础',
  negativePrompt: 'blurry',
  reviewEnabled: true,
  ratio: '3:4',
  count: 2,
  channel: { id: 'C1', name: '云端 API', accessType: 'cloud' },
  model: {
    id: 'M1', name: 'gpt-image', estimatedCost: 0,
    capability: { ratios: ['1:1','3:4'], maxCount: 5, resolutions: ['1024px','2048px'] },
  },
  mainPreviewUrl: 'preview.png',
  dateOverride: new Date('2026-07-21T12:00:00Z'),
  creator: '陆永奇',
};

test('id starts with I- and ends with -1 for index 0', () => {
  const t = buildGenerationTask(baseInput);
  assert.ok(t.id.startsWith('I-'));
  assert.ok(t.id.endsWith('-1'));
});

test('id ends with -2 for index 1', () => {
  const t = buildGenerationTask({ ...baseInput, index: 1 });
  assert.ok(t.id.endsWith('-2'));
});

test('groupId preserved', () => {
  const t = buildGenerationTask(baseInput);
  assert.equal(t.groupId, 'G-2026-07-21');
});

test('type=image, status=pending, progress=0', () => {
  const t = buildGenerationTask(baseInput);
  assert.equal(t.type, 'image');
  assert.equal(t.status, 'pending');
  assert.equal(t.progress, 0);
});

test('imageType mirrors input', () => {
  const t = buildGenerationTask({ ...baseInput, imageType: 'scene_detail', index: 1 });
  assert.equal(t.imageType, 'scene_detail');
});

test('productName = taskProductName', () => {
  const t = buildGenerationTask(baseInput);
  assert.equal(t.productName, '法式针织衫');
});

test('name contains templateName', () => {
  const t = buildGenerationTask({ ...baseInput, templateName: '时尚大片' });
  assert.ok(t.name.includes('时尚大片'));
});

test('reviewStrategy.aesthetic mirrors reviewEnabled=true, listing always false', () => {
  const a = buildGenerationTask({ ...baseInput, reviewEnabled: true });
  const b = buildGenerationTask({ ...baseInput, reviewEnabled: false });
  assert.equal(a.reviewStrategy.aesthetic, true);
  assert.equal(b.reviewStrategy.aesthetic, false);
  assert.equal(a.reviewStrategy.listing, false);
  assert.equal(b.reviewStrategy.listing, false);
});

test('params.prompt == promptText, negativePrompt, ratio, count', () => {
  const t = buildGenerationTask(baseInput);
  assert.equal(t.params.prompt, '商品基础');
  assert.equal(t.params.negativePrompt, 'blurry');
  assert.equal(t.params.ratio, '3:4');
  assert.equal(t.params.count, 2);
});

test('modelChannel is "channel.name / model.name"', () => {
  const t = buildGenerationTask(baseInput);
  assert.equal(t.modelChannel, '云端 API / gpt-image');
});

test('productImg = mainPreviewUrl when provided', () => {
  const t = buildGenerationTask(baseInput);
  assert.equal(t.productImg, 'preview.png');
});

test('productImg falls back to product.thumbnail when mainPreviewUrl undefined', () => {
  const t = buildGenerationTask({ ...baseInput, mainPreviewUrl: undefined });
  assert.equal(t.productImg, 'thumb.png');
});

test('timestamp uses dateOverride when provided', () => {
  const t = buildGenerationTask(baseInput);
  assert.equal(t.timestamp, '2026-07-21 12:00');
});

test('creator defaults to 陆永奇 when not provided', () => {
  const t = buildGenerationTask({ ...baseInput, creator: undefined });
  assert.equal(t.creator, '陆永奇');
});

test('returns a result shaped like GenerationTask', () => {
  const t = buildGenerationTask(baseInput);
  assert.equal(typeof t.id, 'string');
  assert.equal(typeof t.name, 'string');
  assert.equal(t.type, 'image');
  assert.equal(typeof t.imageType, 'string');
  assert.equal(t.status, 'pending');
  assert.equal(t.progress, 0);
  assert.equal(typeof t.productName, 'string');
  assert.equal(typeof t.productImg, 'string');
  assert.equal(typeof t.templateName, 'string');
  assert.equal(typeof t.timestamp, 'string');
  assert.equal(typeof t.creator, 'string');
  assert.equal(typeof t.modelChannel, 'string');
  assert.equal(typeof t.taskPrompt, 'string');
  assert.equal(typeof t.negativePrompt, 'string');
  assert.equal(typeof t.reviewStrategy, 'object');
});
