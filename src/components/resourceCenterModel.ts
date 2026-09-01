import type { AssetResourceItem } from '../api/modules/asset';
import type {
  ProductLibraryAsset,
  ProductLibraryInputAsset,
  ProductLibraryProductDetail,
} from '../api/modules/productLibrary';

export type ResourceMediaFilter = 'ALL' | 'IMAGE' | 'VIDEO' | 'AUDIO';

const GENERATED_IMAGE_TYPE_LABELS: Record<string, string> = {
  product_main: '商品主图',
  PRODUCT_MAIN: '商品主图',
  scene_detail: '场景图',
  SCENE_DETAIL: '场景图',
  DETAIL_SCENE: '场景图',
  detail_closeup: '细节图',
  DETAIL_CLOSEUP: '细节图',
  DETAIL: '细节图',
  model_triple_view: '三视图',
  MODEL_TRIPLE_VIEW: '三视图',
  ON_MODEL: '三视图',
  product_detail: '详情图',
  PRODUCT_DETAIL: '详情图',
};

const generatedAssetLabel = (asset: ProductLibraryAsset): string => {
  if (asset.mediaType === 'VIDEO') return '视频素材';
  const imageType = asset.imageType ?? asset.taskType ?? '';
  return GENERATED_IMAGE_TYPE_LABELS[imageType] ?? '生成图片';
};

const isArchivedProductAsset = (asset: ProductLibraryAsset): boolean =>
  asset.status === 'ARCHIVED'
  || asset.rawStatus === 'ARCHIVED'
  || asset.rawStatus === '已归档';

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
  // 生成图片先展示任务图片类型，风格/场景等仍作为后续筛选标签保留。
  tags: [generatedAssetLabel(asset), '商品素材', asset.style, asset.scene, asset.action]
    .filter(Boolean)
    .join(','),
  uploadUserId: '',
  productId: asset.productId,
  sourceType: asset.mediaType === 'IMAGE' ? 'GENERATED_IMAGE' : 'GENERATED_VIDEO',
  sourceId: asset.id,
  // 归档以生成结果原始状态为准；展示状态仅作为兼容旧接口的兜底。
  status: isArchivedProductAsset(asset) ? 'ARCHIVED' : 'NORMAL',
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
  tags: asset.tags,
  isProductMainImage: asset.productMainImage,
  isProductCover: asset.productCover,
  uploadUserId: '',
  productId,
  sourceType: 'UPLOAD',
  // 输入素材走真删除流程,不会出现在 ARCHIVED 状态;硬编码 NORMAL
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

  const sortedInputAssets = detail.inputAssets
    .filter((asset) => matchesMedia(asset.mediaType))
    .sort((left, right) => {
      const leftIsCover = left.productCover ? 1 : 0;
      const rightIsCover = right.productCover ? 1 : 0;
      if (leftIsCover !== rightIsCover) return rightIsCover - leftIsCover;
      const leftIsComposite = left.tags?.includes('合并套图') ? 1 : 0;
      const rightIsComposite = right.tags?.includes('合并套图') ? 1 : 0;
      if (leftIsComposite !== rightIsComposite) return rightIsComposite - leftIsComposite;
      const leftIsMainImage = left.productMainImage ? 1 : 0;
      const rightIsMainImage = right.productMainImage ? 1 : 0;
      if (leftIsMainImage !== rightIsMainImage) return rightIsMainImage - leftIsMainImage;
      return new Date(right.createTime ?? 0).getTime() - new Date(left.createTime ?? 0).getTime();
    });

  return [
    ...sortedInputAssets.map((asset) => toInputTransitAsset(asset, detail.id)),
    ...detail.generatedImages
      .filter((asset) => matchesMedia(asset.mediaType))
      .map(toGeneratedTransitAsset),
    ...detail.generatedVideos
      .filter((asset) => matchesMedia(asset.mediaType))
      .map(toGeneratedTransitAsset),
  ];
}
