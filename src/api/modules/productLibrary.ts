import http from '../client';
import type { PageInfo } from '../service-result';

export type ProductLibraryDisplayStatus =
  | 'GENERATING'
  | 'FAILED'
  | 'PENDING_REVIEW_SCORE'
  | 'ARCHIVED'
  | 'REJECTED';

export interface ProductLibraryStatistics {
  productCount: number;
  imageCount: number;
  videoCount: number;
  pendingReviewCount: number;
  passedCount: number;
  highScoreCount: number;
  archivedCount: number;
  totalCost: number;
}

export interface ProductLibraryProduct {
  id: string;
  name: string;
  category?: string;
  color?: string;
  material?: string;
  sellingPoints?: string;
  silhouetteStructure?: string;
  imageUrl?: string;
  productStatus?: 'ON_SHELF' | 'OFF_SHELF';
  inputAssetCount: number;
  imageCount: number;
  videoCount: number;
  pendingReviewCount: number;
  passedCount: number;
  rejectedCount: number;
  highestScore?: number;
  totalCost: number;
  latestStatus: ProductLibraryDisplayStatus;
  latestGeneratedTime?: string;
  createTime?: string;
}

export interface ProductLibraryAsset {
  id: string;
  mediaType: 'IMAGE' | 'VIDEO';
  productId?: string;
  productName: string;
  productCategory?: string;
  taskId: string;
  groupId?: string;
  taskCode?: string;
  taskType?: string;
  imageType?: string;
  style?: string;
  scene?: string;
  action?: string;
  aspectRatio?: string;
  durationSec?: number;
  width?: number;
  height?: number;
  channelType?: string;
  modelChannelId?: string;
  modelChannelName?: string;
  url: string;
  thumbnailUrl?: string;
  cost?: number;
  score?: number;
  status: ProductLibraryDisplayStatus;
  rawStatus?: string;
  rejectReason?: string;
  optimizationNote?: string;
  promptVersion?: string;
  createTime?: string;
}

export interface ProductLibraryInputAsset {
  id: string;
  name: string;
  mediaType: 'IMAGE' | 'VIDEO';
  assetType?: string;
  url: string;
  thumbnailUrl?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  durationSec?: number;
  createTime?: string;
}

export interface ProductLibraryProductDetail extends ProductLibraryProduct {
  inputAssets: ProductLibraryInputAsset[];
  generatedImages: ProductLibraryAsset[];
  generatedVideos: ProductLibraryAsset[];
  reviews: ProductLibraryReview[];
}

export interface ProductLibraryReview {
  id: string;
  taskId: string;
  assetId: string;
  mediaType: 'IMAGE' | 'VIDEO';
  overallScore: number;
  dimSubject?: number;
  dimStyle?: number;
  dimComposition?: number;
  dimDetail?: number;
  dimCommercial?: number;
  defectTags?: string;
  advantageTags?: string;
  optimizationNote?: string;
  scorerUserId: string;
  scoreTime?: string;
}

export interface ProductLibraryProductQuery {
  pageNum: number;
  pageSize: number;
  keyword?: string;
  category?: string;
  status?: string;
  sortBy?: 'latest' | 'score' | 'cost';
}

export interface ProductLibraryAssetQuery {
  pageNum: number;
  pageSize: number;
  productId?: string;
  keyword?: string;
  category?: string;
  mediaType?: 'IMAGE' | 'VIDEO';
  taskType?: string;
  style?: string;
  scene?: string;
  channelType?: string;
  status?: ProductLibraryDisplayStatus;
  archivedOnly?: boolean;
  startTime?: string;
  endTime?: string;
  sortBy?: 'latest' | 'score' | 'cost';
}

export const productLibraryApi = {
  statistics: () =>
    http.post<ProductLibraryStatistics>('/v1/admin/product-library/statistics', {}),

  productPage: (req: ProductLibraryProductQuery) =>
    http.post<PageInfo<ProductLibraryProduct>>('/v1/admin/product-library/product/page', req),

  assetPage: (req: ProductLibraryAssetQuery) =>
    http.post<PageInfo<ProductLibraryAsset>>('/v1/admin/product-library/asset/page', req),

  productDetail: (productId: string) =>
    http.post<ProductLibraryProductDetail>(
      '/v1/admin/product-library/product/detail',
      {},
      { params: { productId } },
    ),

  assetDetail: (mediaType: 'IMAGE' | 'VIDEO', assetId: string) =>
    http.post<ProductLibraryAsset>(
      '/v1/admin/product-library/asset/detail',
      {},
      { params: { mediaType, assetId } },
    ),

  archiveBatch: (assets: Array<{ id: string; mediaType: 'IMAGE' | 'VIDEO' }>) =>
    http.post<number>('/v1/admin/product-library/asset/archive-batch', { assets }),
};
