import http from '../client';

export type ExecutionRouteSource =
  | 'TEMPLATE'
  | 'TEMPLATE_MODEL_FALLBACK'
  | 'SYSTEM_DEFAULT'
  | 'FALLBACK'
  | 'USER';

export interface TaskExecutionRoute {
  capabilityCode: string;
  channelInstanceId: string;
  channelName: string;
  channelType: string;
  modelCode: string | null;
  source: ExecutionRouteSource;
  fallbackApplied: boolean;
  fallbackReason: string | null;
}

export interface TaskCapabilityDefaultRoute {
  capabilityCode: string;
  capabilityLabel: string;
  group: 'IMAGE' | 'VIDEO' | 'SOLUTION';
  modelRequired: boolean;
  configured: boolean;
  valid: boolean;
  invalidReason: string | null;
  channelId: string | null;
  channelName: string | null;
  channelType: string | null;
  modelCode: string | null;
}

export interface ResolveExecutionRouteRequest {
  capabilityCode: string;
  preferredChannelInstanceId?: string | null;
  preferredChannelType?: string | null;
  preferredModelCode?: string | null;
}

export const capabilityDefaultRouteApi = {
  list: () => http.post<TaskCapabilityDefaultRoute[]>(
    '/v1/admin/task-capability-default-route/list',
  ),

  update: (request: {
    capabilityCode: string;
    channelId: string;
    modelCode?: string | null;
  }) => http.post<void>('/v1/admin/task-capability-default-route/update', request),

  resolve: (request: ResolveExecutionRouteRequest) =>
    http.post<TaskExecutionRoute>('/v1/task/execution-route/resolve', request),
};
