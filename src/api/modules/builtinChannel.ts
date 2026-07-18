import { http } from '../client';
import type { BuiltinKey, SystemBuiltinChannelItem, ModelChannelDTO } from '../../types';

/** 系统内置通道 API */
export const builtinChannelApi = {
  /** 查询所有内置键 -> 当前配置的 channel(无配置为 null) */
  getAll: () =>
    http.post<Record<BuiltinKey, ModelChannelDTO | null>>(
      '/v1/admin/system-builtin-channel/get-all',
    ),

  /** 批量更新(items 内 channelId=null 表示清空该内置键) */
  update: (items: SystemBuiltinChannelItem[]) =>
    http.post<void>('/v1/admin/system-builtin-channel/update', { items }),

  /** 查询可作为指定 builtinKey 候选的通道列表(后端已按能力过滤) */
  listAvailableChannels: (builtinKey: BuiltinKey) =>
    http.post<ModelChannelDTO[]>(
      '/v1/admin/system-builtin-channel/list-available-channels',
      { builtinKey },
    ),
};
