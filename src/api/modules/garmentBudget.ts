import http from '../client';
import type { PageInfo } from '../service-result';

export type GarmentBudgetStatus = 'NORMAL' | 'DISABLED';

export interface GarmentChannelBudget {
  configured: boolean;
  id?: string | null;
  channelId: string;
  channelName?: string | null;
  channelType?: string | null;
  channelStatus?: string | null;
  period: 'TOTAL';
  amountLimit?: string | null;
  usedAmount?: string | null;
  reservedAmount?: string | null;
  availableAmount?: string | null;
  alertThreshold?: string | null;
  status?: GarmentBudgetStatus | null;
  updateTime?: string | null;
}

export interface GarmentChannelBudgetHistory {
  id: string;
  budgetId: string;
  channelId: string;
  action: 'CREATE' | 'UPDATE';
  beforeAmountLimit?: string | null;
  afterAmountLimit: string;
  beforeAlertThreshold?: string | null;
  afterAlertThreshold: string;
  beforeStatus?: GarmentBudgetStatus | null;
  afterStatus: GarmentBudgetStatus;
  reason: string;
  operatorId?: string | null;
  createTime?: string | null;
}

export interface GarmentChannelBudgetUpsertRequest {
  channelId: string;
  amountLimit: string;
  alertThreshold: string;
  status: GarmentBudgetStatus;
  reason: string;
}

export const garmentBudgetApi = {
  list() {
    return http.post<GarmentChannelBudget[]>('/v1/admin/garment-channel-budget/list');
  },
  upsert(request: GarmentChannelBudgetUpsertRequest) {
    return http.post<string>('/v1/admin/garment-channel-budget/upsert', request);
  },
  history(channelId?: string) {
    return http.post<PageInfo<GarmentChannelBudgetHistory>>(
      '/v1/admin/garment-channel-budget/history',
      { pageNum: 1, pageSize: 100, channelId },
    );
  },
};
