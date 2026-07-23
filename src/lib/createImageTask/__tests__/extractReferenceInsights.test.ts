import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { extractReferenceInsights } from '../extractReferenceInsights';

test('no references → empty array', () => {
  const r = extractReferenceInsights({
    detail: undefined, style: undefined, scene: undefined, pose: undefined, model: undefined,
  });
  assert.deepEqual(r, []);
});

test('only detail has promptHint → array of one', () => {
  const r = extractReferenceInsights({
    detail:  { slot: 'detail',  analysis: { promptHint: 'A' } },
    style:   undefined, scene: undefined, pose: undefined, model: undefined,
  });
  assert.deepEqual(r, ['A']);
});

test('order is detail → style → scene → pose → model', () => {
  const r = extractReferenceInsights({
    detail:  { slot: 'detail',  analysis: { promptHint: 'D' } },
    style:   { slot: 'style',   analysis: { promptHint: 'S' } },
    scene:   { slot: 'scene',   analysis: { promptHint: 'C' } },
    pose:    { slot: 'pose',    analysis: { promptHint: 'P' } },
    model:   { slot: 'model',   analysis: { promptHint: 'M' } },
  });
  assert.deepEqual(r, ['D', 'S', 'C', 'P', 'M']);
});

test('reference without analysis or without promptHint → skipped', () => {
  const r = extractReferenceInsights({
    detail:  { slot: 'detail', analysis: {} },
    style:   { slot: 'style',  analysis: { promptHint: '   ' } },
    scene:   { slot: 'scene' },
    pose:    undefined, model: undefined,
  });
  // 空白与没有 promptHint 一律不进入(避免 prompt 出现空行)
  assert.deepEqual(r, []);
});

test('whitespace-only promptHint is trimmed-and-skipped', () => {
  const r = extractReferenceInsights({
    detail:  { slot: 'detail', analysis: { promptHint: '   ' } },
    style:   { slot: 'style',  analysis: { promptHint: 'real' } },
    scene:   undefined, pose: undefined, model: undefined,
  });
  assert.deepEqual(r, ['real']);
});
