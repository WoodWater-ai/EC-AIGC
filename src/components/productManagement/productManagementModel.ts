import type {
  ProductCategoryRef,
  ProductDTO,
  ProductStatus,
} from '../../api/modules/productInfo';

export type ProductSource = 'MANUAL' | 'ERP';

export interface ProductSkuInput {
  id: string;
  skuCode?: string;
  specName?: string;
  imageId?: string;
  imageUrl?: string;
  color?: string;
  patternMaterial?: string;
  silhouetteStructure?: string;
  keyDetails?: string;
  status?: ProductStatus;
  materialCount?: number;
}

export type ProductManagementRecord = ProductDTO & {
  sourceType?: ProductSource | 'ERP_SYNC';
  spuCode?: string;
  brand?: string;
  skuList?: ProductSkuInput[];
  lastSyncAt?: string;
};

export interface ProductSkuView {
  id: string;
  productId: string;
  name: string;
  code: string;
  imageId?: string;
  imageUrl?: string;
  color?: string;
  patternMaterial?: string;
  silhouetteStructure?: string;
  keyDetails?: string;
  status: ProductStatus;
  materialCount: number;
  canCreate: boolean;
  unavailableReason?: string;
}

export interface ProductSpuView {
  id: string;
  source: ProductSource;
  name: string;
  code: string;
  brand?: string;
  imageUrl?: string;
  categories: ProductCategoryRef[];
  category?: string;
  sellingPoints?: string;
  color?: string;
  patternMaterial?: string;
  silhouetteStructure?: string;
  status: ProductStatus;
  statusDesc: string;
  createTime?: string;
  lastSyncAt?: string;
  skus: ProductSkuView[];
  raw: ProductDTO;
}

const sourceFromRecord = (product: ProductManagementRecord): ProductSource =>
  product.sourceType === 'ERP' || product.sourceType === 'ERP_SYNC' ? 'ERP' : 'MANUAL';

const skuAvailability = (
  status: ProductStatus,
  imageUrl?: string,
): Pick<ProductSkuView, 'canCreate' | 'unavailableReason'> => {
  if (status !== 'ON_SHELF') {
    return { canCreate: false, unavailableReason: 'SKU 已停用' };
  }
  if (!imageUrl) {
    return { canCreate: false, unavailableReason: '暂无可用素材' };
  }
  return { canCreate: true };
};

const toSkuView = (
  product: ProductManagementRecord,
  sku: ProductSkuInput,
  index: number,
): ProductSkuView => {
  const status = sku.status ?? product.status;
  const imageUrl = sku.imageUrl ?? product.imageUrl;
  const name = sku.specName?.trim() || sku.color?.trim() || `默认规格 ${index + 1}`;
  return {
    id: sku.id,
    productId: product.id,
    name,
    code: sku.skuCode?.trim() || `SKU-${sku.id}`,
    imageId: sku.imageId ?? product.imageId,
    imageUrl,
    color: sku.color ?? product.color,
    patternMaterial: sku.patternMaterial ?? product.patternMaterial,
    silhouetteStructure: sku.silhouetteStructure ?? product.silhouetteStructure,
    keyDetails: sku.keyDetails,
    status,
    materialCount: sku.materialCount ?? (imageUrl ? 1 : 0),
    ...skuAvailability(status, imageUrl),
  };
};

export function toProductSpu(product: ProductManagementRecord): ProductSpuView {
  const skuInputs = product.skuList?.length
    ? product.skuList
    : [{
        id: product.id,
        skuCode: `SKU-${product.id}`,
        specName: product.color || '默认规格',
        imageId: product.imageId,
        imageUrl: product.imageUrl,
        color: product.color,
        patternMaterial: product.patternMaterial,
        silhouetteStructure: product.silhouetteStructure,
        status: product.status,
      }];
  const skus = skuInputs.map((sku, index) => toSkuView(product, sku, index));

  return {
    id: product.id,
    source: sourceFromRecord(product),
    name: product.name,
    code: product.spuCode?.trim() || `SPU-${product.id}`,
    brand: product.brand,
    imageUrl: product.imageUrl ?? skus.find((sku) => sku.imageUrl)?.imageUrl,
    categories: product.categories ?? [],
    category: product.category,
    sellingPoints: product.sellingPoints,
    color: product.color,
    patternMaterial: product.patternMaterial,
    silhouetteStructure: product.silhouetteStructure,
    status: product.status,
    statusDesc: product.statusDesc,
    createTime: product.createTime,
    lastSyncAt: product.lastSyncAt,
    skus,
    raw: product,
  };
}

export const productSourceLabel = (source: ProductSource) =>
  source === 'ERP' ? 'ERP 同步' : '手动创建';

export const productParameterSummary = (product: ProductSpuView) =>
  [product.brand, product.patternMaterial, product.silhouetteStructure]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' · ') || '待补充创作参数';

export const formatProductTime = (value?: string) => {
  if (!value) return '—';
  const numericValue = Number(value);
  const date = Number.isFinite(numericValue) && numericValue > 0
    ? new Date(numericValue)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};
