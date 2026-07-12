/**
 * 通道异步任务 API —— 对齐后端 /v1/admin/channel/async-task/*
 *
 * @see com.dafenqi.ai.web.controller.admin.channel.AdminChannelAsyncTaskController
 *
 * [v1.2 2026-07-11] Vidu 接入
 */

import http from '../client';
import type { PageInfo } from '../service-result';
import type { ChannelAsyncTask, ChannelAsyncTaskQueryRequest } from '../../types';

export const asyncTaskApi = {
  /** 分页查询(对齐 POST /v1/admin/channel/async-task/page) */
  page(req: ChannelAsyncTaskQueryRequest): Promise<PageInfo<ChannelAsyncTask>> {
    return http.post<PageInfo<ChannelAsyncTask>>('/v1/admin/channel/async-task/page', req);
  },

  /** 重试死信任务(对齐 POST /v1/admin/channel/async-task/retry) */
  retry(id: string): Promise<void> {
    return http.post<void>('/v1/admin/channel/async-task/retry', null, { params: { id } });
  },

  /** 取消任务(对齐 POST /v1/admin/channel/async-task/cancel) */
  cancel(id: string): Promise<void> {
    return http.post<void>('/v1/admin/channel/async-task/cancel', null, { params: { id } });
  },
};
