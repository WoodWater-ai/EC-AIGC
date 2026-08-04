// [新增 2026-07-12 P0/M2 前端] 能力参数化 API client
// [v2.0 2026-07-13 F1 补强] +IMAGES_URL 多图 / +DICT 字典引用
import { http } from '../client';
import { useServiceQuery } from '../hooks/useServiceQuery';

export type ParamType =
  | 'INT' | 'DECIMAL' | 'TEXT' | 'TEXTAREA' | 'BOOLEAN'
  | 'SELECT' | 'MULTI_SELECT' | 'JSON'
  | 'IMAGE_URL' | 'IMAGES_URL'
  | 'VIDEO_URL' | 'AUDIO_URL' | 'LIP_REF_URL'
  | 'DICT';

export interface ParamOption {
  value: string;
  label: string;
}

export interface FieldDef {
  key: string;
  type: ParamType;
  label: string;
  required?: boolean;
  defaultValue?: string;
  min?: string;
  max?: string;
  options?: ParamOption[];
  dependsOn?: string;
  targetField?: string;
  placeholder?: string;
  helpText?: string;
  uiGroup?: 'BASIC' | 'ADVANCED' | string;
  uiOrder?: number;
  /** [F1 新] DICT 字段必填,指向字典 category code(如 "scene_style" / "camera_motion") */
  dictCode?: string;
  /** [F1 新] IMAGES_URL 字段:最大张数(Vidu SOLUTION 限制 7) */
  maxCount?: number;
  /** [F1 新] IMAGES_URL 字段:最小张数(Vidu SOLUTION 限制 1) */
  minCount?: number;
}

export interface CapabilityDefinition {
  code: string;
  label: string;
  group: 'TEXT' | 'IMAGE' | 'VIDEO' | 'SOLUTION';
  isAsync: boolean;
  fields: FieldDef[];
}

export interface ChannelCapabilities {
  channelType: string;
  baseUrlPlaceholder: string;
  modelRequiredGroups: string[];
  /** 后端维护的供应商模型目录；通道自己的默认模型仍由 defaultModels 决定。 */
  modelOptions?: Partial<Record<'TEXT' | 'IMAGE' | 'VIDEO' | 'SOLUTION', string[]>>;
  capabilities: CapabilityDefinition[];
}

export interface MatrixResponse {
  channels: ChannelCapabilities[];
}

export interface FieldError {
  field: string;
  code: string;
  message: string;
}

export interface ValidateResponse {
  valid: boolean;
  errors: FieldError[];
  normalized: Record<string, any>;
}

export interface SupportedCapabilitiesResponse {
  channelId: string;
  channelType: string;
  supportedCapabilities: string[];
}

// ===== API 函数 =====

export async function fetchCapabilityMatrix(): Promise<MatrixResponse> {
  return http.post<MatrixResponse>('/v1/admin/capability/list', {});
}

export async function fetchCapabilitySchema(
  channelType: string,
  capability: string,
  context?: {
    modelCode?: string | null;
    taskParams?: Record<string, unknown>;
  },
): Promise<CapabilityDefinition> {
  return http.post<CapabilityDefinition>(
    '/v1/task/capability-schema/detail', {
      channelType,
      capability,
      modelCode: context?.modelCode || undefined,
      taskParamsJson: context?.taskParams
        ? JSON.stringify(context.taskParams)
        : undefined,
    });
}

export async function validateTaskParams(req: {
  channelType: string;
  capability: string;
  taskParamsJson: string;
}): Promise<ValidateResponse> {
  return http.post<ValidateResponse>('/v1/task/capability-params/validate', req);
}

export async function fetchSupportedCapabilities(
  channelId: string
): Promise<SupportedCapabilitiesResponse> {
  return http.post<SupportedCapabilitiesResponse>(
    '/v1/admin/capability/supported-list', { channelId });
}

// React Query:单一能力 schema
export function useCapabilitySchema(
  channelType: string | undefined,
  capability: string | undefined
) {
  return useServiceQuery<CapabilityDefinition | null>(
    () => channelType && capability
      ? fetchCapabilitySchema(channelType, capability)
      : Promise.resolve(null),
    [channelType, capability],
  );
}
