import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProductDTO } from '../../api/modules/productInfo';
import { toProductSpu } from './productManagementModel';

const currentProduct: ProductDTO = {
  id: '100',
  name: '法式方领连衣裙',
  color: '酒红',
  patternMaterial: '醋酸混纺',
  silhouetteStructure: '收腰 A 字裙',
  imageId: '900',
  imageUrl: '/dress.jpg',
  status: 'ON_SHELF',
  statusDesc: '上架',
  categories: [{ id: '8', categoryName: '连衣裙' }],
};

test('maps current ProductDTO to a manual SPU with one SKU', () => {
  const spu = toProductSpu(currentProduct);

  assert.equal(spu.source, 'MANUAL');
  assert.equal(spu.skus.length, 1);
  assert.equal(spu.skus[0].productId, '100');
  assert.equal(spu.skus[0].canCreate, true);
  assert.equal(spu.skus[0].materialCount, 1);
});

test('marks a current product without an image as unavailable for creation', () => {
  const spu = toProductSpu({ ...currentProduct, imageId: undefined, imageUrl: undefined });

  assert.equal(spu.skus[0].canCreate, false);
  assert.equal(spu.skus[0].unavailableReason, '暂无可用素材');
});

test('maps optional future ERP SKU payload without changing ProductDTO API', () => {
  const spu = toProductSpu({
    ...currentProduct,
    sourceType: 'ERP',
    spuCode: 'FS-2026-018',
    brand: 'WOODWATER',
    skuList: [
      {
        id: 'sku-1',
        skuCode: 'FS018-BL-M',
        specName: '雾霾蓝 / M',
        imageUrl: '/blue-m.jpg',
        color: '雾霾蓝',
        status: 'ON_SHELF',
        materialCount: 3,
      },
      {
        id: 'sku-2',
        skuCode: 'FS018-WH-L',
        specName: '米白 / L',
        status: 'OFF_SHELF',
      },
    ],
  });

  assert.equal(spu.source, 'ERP');
  assert.equal(spu.code, 'FS-2026-018');
  assert.equal(spu.brand, 'WOODWATER');
  assert.equal(spu.skus.length, 2);
  assert.equal(spu.skus[0].canCreate, true);
  assert.equal(spu.skus[1].unavailableReason, 'SKU 已停用');
});
