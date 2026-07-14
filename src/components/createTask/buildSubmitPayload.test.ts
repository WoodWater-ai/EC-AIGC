import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSubmitPayload } from './buildSubmitPayload';

test('flattens schemaParams into taskParamsJson', () => {
  const p = buildSubmitPayload({
    title: 't', productId: '5', taskType: 'PRODUCT_MAIN',
    channelType: 'VIDU', capability: 'REF_IMG_EDIT', modelChannelId: '9',
    aspectRatio: '1:1', count: 2, prompt: 'hi',
    schemaParams: { aspect_ratio: '1:1', quality: 'high' },
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
  });
  assert.equal(p.taskParamsJson, '{}');
});

test('uses channelId as modelChannelId (新链路)', () => {
  const p = buildSubmitPayload({
    title: 't', productId: '5', taskType: 'X',
    channelType: 'VIDU', capability: 'IMG2VIDEO',
    channelId: '42',
    schemaParams: {},
  });
  assert.equal(p.modelChannelId, '42');
});