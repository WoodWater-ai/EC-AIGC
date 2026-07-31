import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildPromptFromFacts } from '../buildPromptFromFacts';

const facts = {
  name: '法式针织衫',
  sellingPoints: '柔软透气',
  category: '户外服饰',
  color: '米白',
  patternAndMaterial: '羊毛',
  structure: '修身',
};

test('product_main + full inputs → contains all parts in correct order', () => {
  const out = buildPromptFromFacts('product_main', facts, '甜美网红风', '自然影棚', '自然站姿', ['insight-1']);
  const idx = (substr: string) => out.indexOf(substr);
  assert.ok(idx('法式针织衫') >= 0);
  assert.ok(idx('甜美网红风') >= 0);
  assert.ok(idx('自然影棚') >= 0);
  assert.ok(idx('自然站姿') >= 0);
  assert.ok(idx('柔软透气') >= 0);
  assert.ok(idx('insight-1') >= 0);
  assert.ok(idx('法式针织衫') < idx('甜美网红风'));
  assert.ok(idx('甜美网红风') < idx('自然影棚'));
});

test('empty style+scene+pose → still contains name and selling points', () => {
  const out = buildPromptFromFacts('scene_detail', facts, '', '', '', []);
  assert.ok(out.includes('法式针织衫'));
  assert.ok(out.includes('柔软透气'));
});

test('referenceInsights array empty → no trailing empty line', () => {
  const out = buildPromptFromFacts('detail_closeup', facts, '甜美网红风', '自然影棚', '自然站姿', []);
  assert.ok(!out.endsWith('\n'));
});

test('multiple reference insights each rendered on new line', () => {
  const out = buildPromptFromFacts('model_triple_view', facts, '甜美网红风', '自然影棚', '自然站姿', ['a', 'b', 'c']);
  assert.ok(out.includes('a\nb\nc'));
});

test('all input empty → returns empty string (no "undefined")', () => {
  const empty = { name: '', sellingPoints: '', category: '', color: '', patternAndMaterial: '', structure: '' };
  const out = buildPromptFromFacts('product_main', empty, '', '', '', []);
  assert.equal(out, '');
  assert.ok(!out.includes('undefined'));
});
