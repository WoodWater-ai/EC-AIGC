import type { AssetResourceItem } from '../api/modules/asset';
import type {
  ProductLibraryAsset,
  ProductLibraryInputAsset,
  ProductLibraryProductDetail,
} from '../api/modules/productLibrary';

export type ResourceMediaFilter = 'ALL' | 'IMAGE' | 'VIDEO' | 'AUDIO';

const toGeneratedTransitAsset = (asset: ProductLibraryAsset): AssetResourceItem => ({
  id: asset.id,
  name: [asset.productName, asset.imageType ?? asset.taskType]
    .filter(Boolean)
    .join('-') || `商品素材-${asset.id}`,
  assetKind: asset.mediaType,
  assetType: 'AI_GENERATED',
  width: asset.width,
  height: asset.height,
  durationSec: asset.durationSec,
  thumbnailUrl: asset.thumbnailUrl ?? asset.url,
  originalUrl: asset.url,
  description: asset.taskCode ? `来源任务：${asset.taskCode}` : undefined,
  tags: ['商品素材', asset.style, asset.scene, asset.action].filter(Boolean).join(','),
  uploadUserId: '',
  productId: asset.productId,
  sourceType: asset.mediaType === 'IMAGE' ? 'GENERATED_IMAGE' : 'GENERATED_VIDEO',
  sourceId: asset.id,
  status: 'NORMAL',
  visibility: 'PUBLIC',
  categoryIds: [],
  createTime: asset.createTime,
});

const toInputTransitAsset = (
  asset: ProductLibraryInputAsset,
  productId: string,
): AssetResourceItem => ({
  id: asset.id,
  name: asset.name,
  assetKind: asset.mediaType,
  assetType: asset.assetType ?? 'PRODUCT_ORIGINAL',
  fileSize: asset.fileSize,
  width: asset.width,
  height: asset.height,
  durationSec: asset.durationSec,
  thumbnailUrl: asset.thumbnailUrl ?? asset.url,
  originalUrl: asset.url,
  uploadUserId: '',
  productId,
  sourceType: 'UPLOAD',
  status: 'NORMAL',
  visibility: 'PUBLIC',
  categoryIds: [],
  createTime: asset.createTime,
});

export function buildProductDetailAssets(
  detail: ProductLibraryProductDetail,
  mediaFilter: ResourceMediaFilter,
): AssetResourceItem[] {
  const matchesMedia = (mediaType: 'IMAGE' | 'VIDEO') =>
    mediaFilter === 'ALL' || mediaFilter === mediaType;

  return [
    ...detail.inputAssets
      .filter((asset) => matchesMedia(asset.mediaType))
      .map((asset) => toInputTransitAsset(asset, detail.id)),
    ...detail.generatedImages
      .filter((asset) => matchesMedia(asset.mediaType))
      .map(toGeneratedTransitAsset),
    ...detail.generatedVideos
      .filter((asset) => matchesMedia(asset.mediaType))
      .map(toGeneratedTransitAsset),
  ];
}
