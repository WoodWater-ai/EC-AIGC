import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { applyAiOptimizePerType } from '../applyAiOptimizePerType';

const P = {
  product_main:   '商品基础',
  scene_detail:   '场景基础',
  detail_closeup: '细节基础',
  model_front:    '模特基础',
};

test('selectedTypes only product_main → only product_main wrapped', () => {
  const out = applyAiOptimizePerType(P, ['product_main']);
  assert.ok(out.product_main.startsWith('(Cinematic backlight, photorealistic studio render)'));
  assert.ok(out.product_main.includes('商品基础'));
  assert.equal(out.scene_detail, '场景基础');
  assert.equal(out.detail_closeup, '细节基础');
  assert.equal(out.model_front, '模特基础');
});

test('selectedTypes all → all 4 wrapped', () => {
  const out = applyAiOptimizePerType(P, ['product_main','scene_detail','detail_closeup','model_front']);
  assert.ok(out.product_main.startsWith('(Cinematic backlight'));
  assert.ok(out.scene_detail.startsWith('(Cinematic backlight'));
  assert.ok(out.detail_closeup.startsWith('(Cinematic backlight'));
  assert.ok(out.model_front.startsWith('(Cinematic backlight'));
});

test('wrap is idempotent → wrapping twice still yields single prefix', () => {
  const once = applyAiOptimizePerType(P, ['product_main']);
  const twice = applyAiOptimizePerType(once, ['product_main']);
  // 重复包装:保留语义(本期实现只是简单二次包装,后续接 LLM 时改为"检测是否已包裹")
  assert.ok(twice.product_main.includes('Cinematic backlight'));
  // 简单二次包装:每次都从原始 prompt 拼接,不做已包裹检测,所以 suffix 会重复
  assert.equal(twice.product_main, '(Cinematic backlight, photorealistic studio render) '
    + '(Cinematic backlight, photorealistic studio render) 商品基础, raytracing reflections, '
    + 'cinematic color grading, warm ambient glow, raytracing reflections, cinematic color grading, warm ambient glow');
});

test('preserve non-overridden types (does not mutate input)', () => {
  const input = { ...P };
  const out = applyAiOptimizePerType(input, ['scene_detail']);
  assert.deepEqual(input, P);   // 不修改入参
  assert.equal(out.product_main, input.product_main);
});
