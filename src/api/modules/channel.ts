/**
 * 模型通道 API —— 对齐后端 /v1/admin/model-channel/*
 *
 * @see com.dafenqi.ai.web.controller.admin.channel.AdminModelChannelController
 */

import http from '../client';
import type { PageInfo } from '../service-result';
import type {
  ModelChannelDTO,
  ModelChannelAddRequest,
  ModelChannelUpdateRequest,
  ModelChannelQueryRequest,
  CapabilityMatrix,
} from '../../types';

/** 本地模型测试连接响应(对齐后端 TestConnectionResponse) */
export interface TestConnectionResponse {
  success: boolean;
  latencyMs: string;            // 后端 Long + @JsonSerialize → 前端 string
  errorMessage: string | null;
}

export const channelApi = {
  /** 分页查询(对齐 POST /v1/admin/model-channel/page) */
  page(req: ModelChannelQueryRequest) {
    return http.post<PageInfo<ModelChannelDTO>>('/v1/admin/model-channel/page', req);
  },

  /** 详情(对齐 POST /v1/admin/model-channel/detail) */
  detail(id: string) {
    return http.post<ModelChannelDTO>('/v1/admin/model-channel/detail', null, { params: { id } });
  },

  /** 新增(对齐 POST /v1/admin/model-channel/add) */
  add(req: ModelChannelAddRequest) {
    return http.post<string>('/v1/admin/model-channel/add', req);
  },

  /** 更新(对齐 POST /v1/admin/model-channel/update) */
  update(req: ModelChannelUpdateRequest) {
    return http.post<void>('/v1/admin/model-channel/update', req);
  },

  /** 删除(对齐 POST /v1/admin/model-channel/delete) */
  delete(id: string) {
    return http.post<void>('/v1/admin/model-channel/delete', null, { params: { id } });
  },

  /** 按能力列出可用(对齐 POST /v1/admin/model-channel/list-available) */
  listAvailable(capabilityCode?: string) {
    return http.post<ModelChannelDTO[]>('/v1/admin/model-channel/list-available', null, {
      params: { capabilityCode },
    });
  },

  /** 手动触发健康检查(对齐 POST /v1/admin/model-channel/health-check) */
  healthCheck() {
    return http.post<void>('/v1/admin/model-channel/health-check');
  },

  /** 本地模型测试连接(对齐 POST /v1/admin/model-channel/test-connection) */
  testConnection(channelId: string) {
    return http.post<TestConnectionResponse>('/v1/admin/model-channel/test-connection', { channelId });
  },

  /** 通道能力矩阵(对齐 POST /v1/admin/model-channel/capability-matrix) — 前端 chip 过滤 + baseUrl placeholder */
  getCapabilityMatrix() {
    return http.post<CapabilityMatrix>('/v1/admin/model-channel/capability-matrix');
  },

  /** 局部更新通道状态(对齐 POST /v1/admin/model-channel/status) — 启用/禁用专用,不触发 baseUrl/capabilities 校验 */
  updateStatus(id: string, status: 'NORMAL' | 'DISABLED') {
    return http.post<void>('/v1/admin/model-channel/status', null, { params: { id, status } });
  },
};
