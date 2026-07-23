import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { extractProductFacts } from '../extractProductFacts';

test('full input → facts exactly mirror', () => {
  const f = extractProductFacts({
    name: '法式针织衫', sellingPoints: '柔软透气', productCategory: '户外服饰',
    colorPattern: '米白', fabricTexture: '羊毛', fitStructure: '修身',
  });
  assert.equal(f.name, '法式针织衫');
  assert.equal(f.sellingPoints, '柔软透气');
  assert.equal(f.category, '户外服饰');
  assert.equal(f.color, '米白');
  assert.equal(f.patternAndMaterial, '羊毛');
  assert.equal(f.structure, '修身');
});

test('empty fields → facts empty strings (no undefined)', () => {
  const f = extractProductFacts({
    name: '', sellingPoints: '', productCategory: '', colorPattern: '', fabricTexture: '', fitStructure: '',
  });
  assert.deepEqual(f, {
    name: '', sellingPoints: '', category: '', color: '', patternAndMaterial: '', structure: '',
  });
});

test('trims whitespace on each field', () => {
  const f = extractProductFacts({
    name: '  商品名  ', sellingPoints: ' 卖点 ',
    productCategory: ' 户外服饰 ', colorPattern: ' 米白 ',
    fabricTexture: ' 羊毛 ', fitStructure: ' 修身 ',
  });
  assert.equal(f.name, '商品名');
  assert.equal(f.sellingPoints, '卖点');
  assert.equal(f.category, '户外服饰');
  assert.equal(f.color, '米白');
  assert.equal(f.patternAndMaterial, '羊毛');
  assert.equal(f.structure, '修身');
});
