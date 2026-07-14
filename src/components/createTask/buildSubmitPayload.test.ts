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

const ref = (id: number, name?: string): SlotRef => ({
  fileResourceId: id,
  thumbnailUrl: `https://example/${id}.jpg`,
  name,
});

test('slotRefs 主图写到 taskParamsJson.slotRefs.main', () => {
  const p = buildSubmitPayload({
    title: 't', productId: '5', taskType: 'PRODUCT_MAIN',
    channelType: 'VIDU', capability: 'REF_IMG_EDIT', modelChannelId: '9',
    schemaParams: {},
    slotRefs: { main: ref(101, '主图.jpg'), top: null, bottom: null, detail: null, style: null, scene: null, pose: null },
  });
  const parsed = JSON.parse(p.taskParamsJson);
  assert.equal(parsed.slotRefs.main, 101);
});

test('slotRefs 全部填,字段名一一对应', () => {
  const p = buildSubmitPayload({
    title: 't', productId: '5', taskType: 'X',
    channelType: 'QWEN', capability: 'MAIN_IMAGE', modelChannelId: '1',
    schemaParams: {},
    slotRefs: {
      main: ref(1), top: ref(2), bottom: ref(3), detail: ref(4),
      style: ref(5), scene: ref(6), pose: ref(7),
    },
  });
  const parsed = JSON.parse(p.taskParamsJson);
  assert.deepEqual(parsed.slotRefs, { main: 1, top: 2, bottom: 3, detail: 4, style: 5, scene: 6, pose: 7 });
});

test('slotRefs 全 null 时不写 slotRefs key(避免无意义空对象)', () => {
  const p = buildSubmitPayload({
    title: 't', productId: '5', taskType: 'X',
    channelType: 'QWEN', capability: 'MAIN_IMAGE', modelChannelId: '1',
    schemaParams: {},
    slotRefs: { main: null, top: null, bottom: null, detail: null, style: null, scene: null, pose: null },
  });
  const parsed = JSON.parse(p.taskParamsJson);
  assert.equal(parsed.slotRefs, undefined);
});

test('slotRefs 部分填,只输出非 null 字段', () => {
  const p = buildSubmitPayload({
    title: 't', productId: '5', taskType: 'X',
    channelType: 'QWEN', capability: 'MAIN_IMAGE', modelChannelId: '1',
    schemaParams: {},
    slotRefs: { main: ref(11), top: null, bottom: ref(33), detail: null, style: null, scene: null, pose: null },
  });
  const parsed = JSON.parse(p.taskParamsJson);
  assert.deepEqual(parsed.slotRefs, { main: 11, bottom: 33 });
});