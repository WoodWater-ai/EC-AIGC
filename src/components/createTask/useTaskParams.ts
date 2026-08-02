import { useEffect, useMemo, useState } from 'react';
import { useServiceQuery } from '../../api/hooks/useServiceQuery';
import {
  fetchCapabilitySchema,
  fetchSupportedCapabilities,
  type CapabilityDefinition,
} from '../../api/modules/capability';
import {
  channelApi,
  fetchChannelGroupModels,
  type ChannelGroupModel,
} from '../../api/modules/channel';
import type { ModelChannelDTO } from '../../types';
import { useTemplateRecommend } from '../../api/hooks/useTemplateRecommend';
import { useCapabilityMatrixStore } from '../../stores/capabilityMatrix';

export interface PrefillState {
  templateId?: string;
  templateVersionId?: string;
  group?: 'IMAGE' | 'VIDEO' | 'SOLUTION';
  channelType: string | null;
  capability: string | null;
  model: string | null;
  schemaParams?: Record<string, unknown>;
  lockExecution?: boolean;
}

export function useTaskParams(
  group: 'IMAGE' | 'VIDEO' | 'SOLUTION',
  prefill?: PrefillState | null,
) {
  const [channelId, setChannelIdRaw] = useState<string | null>(null);
  const [capability, setCapabilityRaw] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [schemaParams, setSchemaParams] = useState<Record<string, any>>({});
  const [lastSchema, setLastSchema] = useState<{
    identity: string;
    value: CapabilityDefinition;
  } | null>(null);

  const locked = !!prefill && prefill.lockExecution !== false;

  // step 1:按 group 拉可用通道实例(group 切时重拉)
  const { data: instancesRaw } = useServiceQuery<ModelChannelDTO[]>(
    () => channelApi.listAvailableByGroup(group),
    [group],
  );

  // 矩阵兜底:用 matrix 给能力补 label/group/isAsync(group 过滤 + 中文显示)
  const matrix = useCapabilityMatrixStore((s) => s.matrix);
  const loadMatrix = useCapabilityMatrixStore((s) => s.loadOnce);
  useEffect(() => { loadMatrix(); }, [loadMatrix]);

  // 按 group 过滤:仅显示该 channelType 在 matrix 中有 ≥1 个 group=group 能力的实例
  // 避免用户在 IMAGE 模式看到 Vidu(无 IMAGE 能力)、或在 SOLUTION 模式看到 QWEN(无 SOLUTION 能力)
  const instances = useMemo(() => {
    const list = instancesRaw ?? [];
    if (!matrix) return list;  // 矩阵未加载,先返全,避免空(loading 态)
    return list.filter((inst) => {
      const channelCaps = matrix.channels.find((c) => c.channelType === inst.channelType)?.capabilities ?? [];
      return channelCaps.some((cap) => cap.group === group);
    });
  }, [instancesRaw, matrix, group]);

  const channelType = useMemo(() => {
    if (!channelId) return null;
    const inst = instances.find((c) => String(c.id) === channelId);
    return inst?.channelType ?? null;
  }, [channelId, instances]);

  useEffect(() => {
    if (prefill?.channelType && !channelId && instances.length > 0) {
      const match = instances.find((c) => c.channelType === prefill.channelType);
      if (match) setChannelIdRaw(String(match.id));
    }
  }, [prefill, instances, channelId]);

  useEffect(() => {
    if (prefill?.capability && !capability) setCapabilityRaw(prefill.capability);
  }, [prefill, capability]);

  useEffect(() => {
    if (prefill?.model && !modelId) setModelId(prefill.model);
  }, [prefill, modelId]);

  useEffect(() => {
    if (!prefill?.schemaParams) return;
    setSchemaParams({ ...prefill.schemaParams });
  }, [prefill]);

  const setChannelId = (id: string | null) => {
    setChannelIdRaw(id);
    setCapabilityRaw(null);
    setModelId(null);
  };

  const setCapability = locked ? () => {} : setCapabilityRaw;

  // step 2
  const { data: supportedRaw } = useServiceQuery<{
    supportedCapabilities: string[];
  }>(
    () => (channelId ? fetchSupportedCapabilities(channelId) : Promise.resolve({ supportedCapabilities: [] })),
    [channelId],
  );
  const supported = supportedRaw ?? { supportedCapabilities: [] };

  // 矩阵兜底:用 matrix 给能力补 label/group/isAsync(group 过滤 + 中文显示)
  // (matrix 已在前面 line 44-46 加载)

  const capabilitiesInChannel = useMemo(() => {
    if (!channelType) return [] as CapabilityDefinition[];
    const channelCaps = matrix?.channels.find((c) => c.channelType === channelType)?.capabilities ?? [];
    // 求交集:matrix 的能力 ∩ supported-list 返的 codes
    return channelCaps
      .filter((cap) => supported.supportedCapabilities.includes(cap.code))
      .filter((cap) => cap.group === group);  // 按 group 过滤(IMAGE/VIDEO/SOLUTION)
  }, [channelType, matrix, supported.supportedCapabilities, group]);

  // step 3
  const { data: models } = useServiceQuery<ChannelGroupModel[]>(
    () => (channelId ? fetchChannelGroupModels(channelId) : Promise.resolve([])),
    [channelId],
  );
  const modelsInGroup = useMemo(
    () => (models ?? []).filter((m) => m.group === group),
    [models, group],
  );
  const effectiveModelCode = modelId ?? modelsInGroup[0]?.model ?? null;
  const paramsFingerprint = useMemo(
    () => JSON.stringify(schemaParams),
    [schemaParams],
  );

  const schemaIdentity = `${channelType ?? ''}|${capability ?? ''}|${effectiveModelCode ?? ''}`;
  const { data: loadedSchema } = useServiceQuery<CapabilityDefinition | null>(
    () => (channelType && capability
      ? fetchCapabilitySchema(channelType, capability, {
          modelCode: effectiveModelCode,
          taskParams: schemaParams,
        })
      : Promise.resolve(null)),
    [channelType, capability, effectiveModelCode, paramsFingerprint],
  );
  useEffect(() => {
    if (loadedSchema) {
      setLastSchema({ identity: schemaIdentity, value: loadedSchema });
    }
  }, [loadedSchema, schemaIdentity]);
  const schema = loadedSchema
    ?? (lastSchema?.identity === schemaIdentity ? lastSchema.value : null);

  const { data: recommendListRaw } = useTemplateRecommend(
    prefill?.templateId, prefill?.templateVersionId, channelType ?? undefined, capability ?? undefined,
  );
  const recommendList = recommendListRaw ?? [];

  useEffect(() => {
    if (!prefill || !recommendList || recommendList.length === 0) return;
    const next: Record<string, any> = {};
    for (const rec of recommendList) {
      try { next[rec.paramsKey] = JSON.parse(rec.paramsJson); }
      catch { next[rec.paramsKey] = rec.paramsJson; }
    }
    setSchemaParams(next);
  }, [recommendList, prefill]);

  useEffect(() => {
    if (!schema) return;
    const next: Record<string, any> = {};
    for (const f of schema.fields ?? []) {
      let value = schemaParams[f.key];
      const hasValue = value !== undefined && value !== null && value !== '';
      if (!hasValue && f.defaultValue !== undefined && f.defaultValue !== null && f.defaultValue !== '') {
        value = f.defaultValue;
      }
      if (value === undefined || value === null || value === '') continue;

      if (f.type === 'BOOLEAN') {
        value = value === true || value === 'true';
      } else if (f.type === 'INT' || f.type === 'DECIMAL') {
        const numericValue = Number(value);
        value = Number.isFinite(numericValue) ? numericValue : f.defaultValue;
      } else if (f.type === 'SELECT' && f.options?.length) {
        const valid = f.options.some((option) => option.value === String(value));
        if (!valid) value = f.defaultValue ?? f.options[0].value;
      }
      next[f.key] = value;
    }
    if (JSON.stringify(next) !== JSON.stringify(schemaParams)) {
      setSchemaParams(next);
    }
  }, [schema, schemaParams]);

  const recommendValues = useMemo(() => {
    const m: Record<string, any> = {};
    for (const r of recommendList ?? []) {
      try { m[r.paramsKey] = JSON.parse(r.paramsJson); } catch { m[r.paramsKey] = r.paramsJson; }
    }
    return m;
  }, [recommendList]);

  // isSupported 占位(简化):只检查 schema 是否存在就返回 true;
  // 真正的兼容性拒绝入口在 UI 层 useCreateImageTaskState.isSupported
  const isSupported = useMemo(() => schema != null, [schema]);

  const setModelWithValidation = (id: string | null) => {
    if (locked) return;
    setModelId(id);
    setSchemaParams({});
  };

  return {
    channelId, channelType, capability, modelId, effectiveModelCode, schema, schemaParams,
    instances,
    capabilitiesInChannel,
    modelsInGroup,
    setChannelId: locked ? () => {} : setChannelId,
    setCapability,
    setModelId: setModelWithValidation, setSchemaParams,
    recommendValues, locked, isSupported, setModelWithValidation,
  };
}
