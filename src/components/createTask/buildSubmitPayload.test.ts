import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSubmitPayload } from './buildSubmitPayload';

test('flattens schemaParams into taskParamsJson', () => {
  const p = buildSubmitPayload({
    title: 't', productId: '5', taskType: 'PRODUCT_MAIN',
    channelType: 'VIDU', capability: 'REF_IMG_EDIT', modelChannelId: '9',
    aspectRatio: '1:1', count: 2, prompt: 'hi',
    schemaParams: { aspect_ratio: '1:1', quality: 'high' },
    slotRefs: { main: null, top: null, bottom: null, detail: null, style: null, scene: null, pose: null },
  });
  assert.equal(p.channelType, 'VIDU');
  assert.equal(p.capability, 'REF_IMG_EDIT');
  assert.equal(p.taskParamsJson, JSON.stringify({ aspect_ratio: '1:1', quality: 'high' }));
  assert.equal(p.taskPrompt, 'hi');
});

test('empty schemaParams -> {}', () => {
  const p = buildSubmitPayload({
    title: 't', productId: '5', taskType: 'X',
    channelType: 'QWEN', capability: 'MAIN_IMAGE', modelChannelId: '1',
    schemaParams: {},
    slotRefs: { main: null, top: null, bottom: null, detail: null, style: null, scene: null, pose: null },
  });
  assert.equal(p.taskParamsJson, '{}');
});

test('uses channelId as modelChannelId (新链路)', () => {
  const p = buildSubmitPayload({
    title: 't', productId: '5', taskType: 'X',
    channelType: 'VIDU', capability: 'IMG2VIDEO',
    channelId: '42',
    schemaParams: {},
    slotRefs: { main: null, top: null, bottom: null, detail: null, style: null, scene: null, pose: null },
  });
  assert.equal(p.modelChannelId, '42');
});

import type { SlotRef } from './slots';

const ref = (id: string, name?: string, originalUrl?: string): SlotRef => ({
  fileResourceId: id,
  thumbnailUrl: `https://example/${id}.jpg`,
  originalUrl: originalUrl ?? `https://example/${id}-orig.jpg`,
  name,
});

test('主图 slot 折叠到 inputImageUrls(只填主图)', () => {
  const p = buildSubmitPayload({
    title: 't', productId: '5', taskType: 'PRODUCT_MAIN',
    channelType: 'VIDU', capability: 'REF_IMG_EDIT', modelChannelId: '9',
    schemaParams: {},
    slotRefs: { main: ref('101', '主图.jpg'), top: null, bottom: null, detail: null, style: null, scene: null, pose: null },
  });
  assert.equal(p.inputImageUrls, 'https://example/101-orig.jpg');
  // taskParamsJson 不再含 slotRefs(否则 schema 校验拒)
  const parsed = JSON.parse(p.taskParamsJson);
  assert.equal(parsed.slotRefs, undefined);
});

test('多 slot 全部填,按 main→top→bottom→detail→style→scene→pose 顺序折叠,逗号分隔', () => {
  const p = buildSubmitPayload({
    title: 't', productId: '5', taskType: 'X',
    channelType: 'QWEN', capability: 'MAIN_IMAGE', modelChannelId: '1',
    schemaParams: {},
    slotRefs: {
      main: ref('1'), top: ref('2'), bottom: ref('3'), detail: ref('4'),
      style: ref('5'), scene: ref('6'), pose: ref('7'),
    },
  });
  assert.equal(p.inputImageUrls,
    'https://example/1-orig.jpg,https://example/2-orig.jpg,https://example/3-orig.jpg,https://example/4-orig.jpg,https://example/5-orig.jpg,https://example/6-orig.jpg,https://example/7-orig.jpg');
});

test('slotRefs 全 null 时 inputImageUrls 不传', () => {
  const p = buildSubmitPayload({
    title: 't', productId: '5', taskType: 'X',
    channelType: 'QWEN', capability: 'MAIN_IMAGE', modelChannelId: '1',
    schemaParams: {},
    slotRefs: { main: null, top: null, bottom: null, detail: null, style: null, scene: null, pose: null },
  });
  assert.equal(p.inputImageUrls, undefined);
});

test('slotRefs 部分填,只输出非 null 字段(按固定顺序)', () => {
  const p = buildSubmitPayload({
    title: 't', productId: '5', taskType: 'X',
    channelType: 'QWEN', capability: 'MAIN_IMAGE', modelChannelId: '1',
    schemaParams: {},
    slotRefs: { main: ref('11'), top: null, bottom: ref('33'), detail: null, style: null, scene: null, pose: null },
  });
  assert.equal(p.inputImageUrls, 'https://example/11-orig.jpg,https://example/33-orig.jpg');
});

// ==================== [MVP 2026-07-16] autoCreateProduct 路径 ====================

test('productId 是真数字字符串时,autoCreateProduct=false,产品字段不传出', () => {
  const p = buildSubmitPayload({
    title: 't', productId: '42', taskType: 'X',
    channelType: 'QWEN', capability: 'MAIN_IMAGE', modelChannelId: '1',
    schemaParams: {},
    slotRefs: { main: null, top: null, bottom: null, detail: null, style: null, scene: null, pose: null },
    autoCreateProduct: true,  // 即使传 true,真 id 优先级更高
    productName: 'should-not-send',
    productCategory: 'should-not-send',
  });
  assert.equal(p.productId, '42');
  assert.equal(p.autoCreateProduct, false);
  assert.equal(p.productName, undefined);
  assert.equal(p.productCategory, undefined);
});

test('productId 是 mock 占位("p1")时,autoCreateProduct=true,产品字段透传', () => {
  const p = buildSubmitPayload({
    title: 't', productId: 'p1', taskType: 'X',
    channelType: 'QWEN', capability: 'MAIN_IMAGE', modelChannelId: '1',
    schemaParams: {},
    slotRefs: { main: null, top: null, bottom: null, detail: null, style: null, scene: null, pose: null },
    productName: '智能运动手表',
    productCategory: '智能硬件',
    productColor: '钛金属黑',
    productFabric: '金属拉丝',
    productSellingPoints: '长续航,健康监测',
  });
  assert.equal(p.productId, null);
  assert.equal(p.autoCreateProduct, true);
  assert.equal(p.productName, '智能运动手表');
  assert.equal(p.productCategory, '智能硬件');
  assert.equal(p.productColor, '钛金属黑');
  assert.equal(p.productFabric, '金属拉丝');
  assert.equal(p.productSellingPoints, '长续航,健康监测');
});

test('productId 是空字符串时,autoCreateProduct 默认 true', () => {
  const p = buildSubmitPayload({
    title: 't', productId: '', taskType: 'X',
    channelType: 'QWEN', capability: 'MAIN_IMAGE', modelChannelId: '1',
    schemaParams: {},
    slotRefs: { main: null, top: null, bottom: null, detail: null, style: null, scene: null, pose: null },
    productName: 'X',
  });
  assert.equal(p.productId, null);
  assert.equal(p.autoCreateProduct, true);
});

test('autoCreateProduct=false 但 productId 是 mock 占位时,产品字段不传出', () => {
  const p = buildSubmitPayload({
    title: 't', productId: 'p1', taskType: 'X',
    channelType: 'QWEN', capability: 'MAIN_IMAGE', modelChannelId: '1',
    schemaParams: {},
    slotRefs: { main: null, top: null, bottom: null, detail: null, style: null, scene: null, pose: null },
    autoCreateProduct: false,  // 显式 false
    productName: 'X',
  });
  assert.equal(p.productId, null);
  assert.equal(p.autoCreateProduct, false);
  assert.equal(p.productName, undefined);
});