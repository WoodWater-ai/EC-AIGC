import http from '../client';
import type { PageInfo } from '../service-result';

export type WdgjSyncTaskType = 'CATEGORY' | 'PRODUCT';
export type WdgjSyncMode = 'FULL' | 'INCREMENTAL';
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
  trigger: (taskType: WdgjSyncTaskType, syncMode?: WdgjSyncMode) =>
    http.post<string>('/v1/admin/wdgj/sync/trigger', { taskType, syncMode }),
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
