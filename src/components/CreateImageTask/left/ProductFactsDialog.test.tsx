import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ProductDTO } from '../../../api/modules/productInfo';
import type { ProductFactsInput } from '../../../lib/createImageTask/extractProductFacts';
import {
  formatProductSyncTime,
  mergeProductFactsWithErp,
  ProductFactsDialog,
} from './ProductFactsDialog';

const facts: ProductFactsInput = {
  name: '分析名称',
  sellingPoints: '分析卖点',
  productCategory: '分析品类',
  colorPattern: '分析颜色',
  fabricTexture: '分析材质',
  fitStructure: '分析版型',
};

const product: ProductDTO = {
  id: '1',
  name: 'ERP 名称',
  sellingPoints: 'ERP 卖点',
  color: '',
  patternMaterial: 'ERP 材质',
  silhouetteStructure: '',
  category: 'ERP 品类',
  status: 'ON_SHELF',
  statusDesc: '上架',
  lastSyncTime: '1786552381000',
};

test('ERP values override analyzed facts while missing ERP fields keep supplements', () => {
  assert.deepEqual(mergeProductFactsWithErp(product, facts), {
    name: 'ERP 名称',
    sellingPoints: 'ERP 卖点',
    productCategory: 'ERP 品类',
    colorPattern: '分析颜色',
    fabricTexture: 'ERP 材质',
    fitStructure: '分析版型',
  });
});

test('millisecond sync timestamp is formatted as readable local time', () => {
  for (const source of ['1786552381000', 1786552381000]) {
    const formatted = formatProductSyncTime(source);
    assert.match(formatted, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.notEqual(formatted, String(source));
  }
});

test('dialog keeps ERP fields read-only and renders inputs for missing prompt fields', () => {
  const html = renderToStaticMarkup(React.createElement(ProductFactsDialog, {
    product,
    facts,
    seoName: 'SEO 名称',
    onFactsChange: () => undefined,
    onSeoNameChange: () => undefined,
    onClose: () => undefined,
  }));

  assert.match(html, /ERP 商品事实/);
  assert.match(html, /ERP 品类/);
  assert.match(html, /value="分析颜色"/);
  assert.match(html, /value="分析版型"/);
  assert.doesNotMatch(html, /value="ERP 材质"/);
  assert.match(html, /value="SEO 名称"/);
  assert.match(html, /复制全文/);
});
