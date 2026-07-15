import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assembleTaskPrompt, applyAiOptimize } from './assembleTaskPrompt';

test('merges unified fields and schema params into prompt', () => {
  const p = assembleTaskPrompt({
    productName: 'SmartWatch',
    sellingPoints: '防水,长续航',
    keyDetails: '法式复古',
    aspectRatio: '3:4',
    schemaParams: { style: '甜美网红风', scene: '室内影棚', pose: '站姿正面' },
    constraints: ['颜色', 'Logo'],
  });
  assert.match(p, /SmartWatch/);
  assert.match(p, /甜美网红风/);
  assert.match(p, /室内影棚/);
  assert.match(p, /3:4/);
  assert.match(p, /颜色、Logo/);
});

test('omits constraint clause when none', () => {
  const p = assembleTaskPrompt({ productName: 'X', schemaParams: {} });
  assert.doesNotMatch(p, /保护特征/);
});

test('applyAiOptimize wraps prompt', () => {
  const out = applyAiOptimize('base prompt');
  assert.match(out, /base prompt/);
  assert.notEqual(out, 'base prompt');
});