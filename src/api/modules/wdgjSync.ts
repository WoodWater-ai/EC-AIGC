import http from '../client';
import type { PageInfo } from '../service-result';

export type WdgjSyncTaskType =
  | 'CATEGORY'
  | 'PRODUCT'
  | 'PRODUCT_CATEGORY_MIGRATION'
  | 'PRODUCT_SNAPSHOT_MIGRATION';
export type WdgjSyncMode = 'FULL' | 'INCREMENTAL' | 'LOCAL';
export type WdgjSyncTriggerTaskType = 'CATEGORY' | 'PRODUCT';
export type WdgjSyncTriggerMode = 'FULL' | 'INCREMENTAL';
export type WdgjSyncStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export interface WdgjSyncTaskDTO {
  id: string;
  sourceChannel: 'WDGJ';
  taskType: WdgjSyncTaskType;
  syncMode: WdgjSyncMode;
  status: WdgjSyncStatus;
  cursorPage: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  retryCount: number;
  startedTime?: string;
  finishedTime?: string;
  failReason?: string;
  taskContextText?: string;
  createTime?: string;
}

export interface WdgjSyncStatusRequest {
  pageNum: number;
  pageSize: number;
  taskType?: WdgjSyncTaskType;
  status?: WdgjSyncStatus;
}

export type WdgjImageTransferStatus = 'PENDING' | 'PROCESSING' | 'FAILED' | 'SUCCESS' | 'DEAD_LETTER';

export interface WdgjImageTransferTaskDTO {
  id: string;
  productId: string;
  externalSpuId?: string;
  externalSpecId?: string;
  sourceImageUrl: string;
  assetRole: 'MAIN' | 'DETAIL';
  sort: number;
  status: WdgjImageTransferStatus;
  assetResourceId?: string;
  fileMd5?: string;
  retryCount: number;
  startedTime?: string;
  finishedTime?: string;
  failReason?: string;
  createTime?: string;
}

export const wdgjSyncApi = {
  trigger: (taskType: WdgjSyncTriggerTaskType, syncMode?: WdgjSyncTriggerMode) =>
    http.post<string>('/v1/admin/wdgj/sync/trigger', { taskType, syncMode }),
  migrateProductCategories: () =>
    http.post<string>('/v1/admin/wdgj/sync/product-category-migrate'),
  migrateProductSnapshots: () =>
    http.post<string>('/v1/admin/wdgj/sync/product-snapshot-migrate'),
  status: (request: WdgjSyncStatusRequest) =>
    http.post<PageInfo<WdgjSyncTaskDTO>>('/v1/admin/wdgj/sync/status', request),
  detail: (id: string) =>
    http.post<WdgjSyncTaskDTO>('/v1/admin/wdgj/sync/detail', { id }),
  imageStatus: (request: {
    pageNum: number;
    pageSize: number;
    status?: WdgjImageTransferStatus;
    productId?: string;
  }) => http.post<PageInfo<WdgjImageTransferTaskDTO>>('/v1/admin/wdgj/sync/image-status', request),
  retryImage: (id: string) =>
    http.post<void>('/v1/admin/wdgj/sync/image-retry', { id }),
};
