import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useServiceQuery } from '../../api/hooks/useServiceQuery';
import {
  capabilityDefaultRouteApi,
  type ExecutionRouteSource,
  type TaskExecutionRoute,
} from '../../api/modules/capabilityDefaultRoute';
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

export const MULTIFRAME_ALLOWED_MODELS = ['viduq2-turbo', 'viduq2-pro'] as const;

export type TaskParamSelectionSource = ExecutionRouteSource | 'NONE';

export interface PrefillState {
  templateId?: string;
  templateVersionId?: string;
  group?: 'IMAGE' | 'VIDEO' | 'SOLUTION';
  channelInstanceId?: string | null;
  channelType: string | null;
  capability: string | null;
  model: string | null;
  schemaParams?: Record<string, unknown>;
  lockExecution?: boolean;
  resolved?: boolean;
  source?: ExecutionRouteSource;
  fallbackApplied?: boolean;
  fallbackReason?: string | null;
  unavailableReason?: string | null;
}

export function useTaskParams(
  group: 'IMAGE' | 'VIDEO' | 'SOLUTION',
  prefill?: PrefillState | null,
  requiredCapability?: string,
  prefillPending = false,
) {
  const [channelId, setChannelIdRaw] = useState<string | null>(null);
  const [capability, setCapabilityRaw] = useState<string | null>(null);
  const [modelId, setModelIdRaw] = useState<string | null>(null);
  const [schemaParams, setSchemaParamsRaw] = useState<Record<string, any>>({});
  const [selectionSource, setSelectionSource] = useState<TaskParamSelectionSource>('NONE');
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [lastSchema, setLastSchema] = useState<{
    identity: string;
    value: CapabilityDefinition;
  } | null>(null);

  const manualRevisionRef = useRef(0);
  const initKeyRef = useRef<string | null>(null);
  const recommendAppliedKeyRef = useRef<string | null>(null);
  const locked = !!prefill && prefill.lockExecution !== false;

  const { data: instancesRaw } = useServiceQuery<ModelChannelDTO[]>(
    () => channelApi.listAvailableByGroup(group),
    [group],
  );

  const matrix = useCapabilityMatrixStore((state) => state.matrix);
  const loadMatrix = useCapabilityMatrixStore((state) => state.loadOnce);
  useEffect(() => { loadMatrix(); }, [loadMatrix]);

  const instances = useMemo(() => {
    const list = instancesRaw ?? [];
    if (!matrix) return list;
    return list.filter((instance) => {
      const channelCapabilities = matrix.channels
        .find((item) => item.channelType === instance.channelType)?.capabilities ?? [];
      return channelCapabilities.some((item) => item.group === group);
    });
  }, [instancesRaw, matrix, group]);

  const channelType = useMemo(() => {
    if (!channelId) return null;
    return instances.find((item) => String(item.id) === channelId)?.channelType ?? null;
  }, [channelId, instances]);

  const applyInitialRoute = useCallback((
    route: TaskExecutionRoute,
    initialSchemaParams?: Record<string, unknown>,
  ) => {
    setChannelIdRaw(route.channelInstanceId);
    setCapabilityRaw(route.capabilityCode);
    setModelIdRaw(route.modelCode);
    setSchemaParamsRaw({ ...(initialSchemaParams ?? {}) });
    setSelectionSource(route.source);
    setFallbackReason(route.fallbackApplied ? route.fallbackReason : null);
    setUnavailableReason(null);
    setInitializing(false);
  }, []);

  useEffect(() => {
    const targetCapability = prefill?.capability ?? requiredCapability;
    if (prefillPending || !targetCapability) return;
    const initKey = [
      group,
      targetCapability,
      prefill?.templateId ?? '',
      prefill?.templateVersionId ?? '',
      prefill?.channelInstanceId ?? '',
      prefill?.model ?? '',
    ].join('|');
    // 这里只记录“已完成”的 key。React StrictMode 会执行 setup -> cleanup -> setup，
    // 如果在请求开始前就记录，第一次请求被取消后第二次会被误判为已初始化。
    if (initKeyRef.current === initKey) return;
    recommendAppliedKeyRef.current = null;
    const revision = manualRevisionRef.current;
    let cancelled = false;
    setInitializing(true);
    setUnavailableReason(null);

    if (prefill?.resolved) {
      if (prefill.unavailableReason || !prefill.channelInstanceId || !prefill.source) {
        initKeyRef.current = initKey;
        setChannelIdRaw(null);
        setCapabilityRaw(targetCapability);
        setModelIdRaw(null);
        setSchemaParamsRaw({ ...(prefill.schemaParams ?? {}) });
        setSelectionSource('NONE');
        setFallbackReason(null);
        setUnavailableReason(prefill.unavailableReason ?? '没有可用的默认执行路由');
        setInitializing(false);
        return;
      }
      initKeyRef.current = initKey;
      applyInitialRoute({
        capabilityCode: targetCapability,
        channelInstanceId: prefill.channelInstanceId,
        channelName: '',
        channelType: prefill.channelType ?? '',
        modelCode: prefill.model,
        source: prefill.source,
        fallbackApplied: prefill.fallbackApplied ?? false,
        fallbackReason: prefill.fallbackReason ?? null,
      }, prefill.schemaParams);
      return;
    }

    capabilityDefaultRouteApi.resolve({
      capabilityCode: targetCapability,
      preferredChannelInstanceId: prefill?.channelInstanceId,
      preferredChannelType: prefill?.channelType,
      preferredModelCode: prefill?.model,
    }).then((route) => {
      if (cancelled || manualRevisionRef.current !== revision) return;
      initKeyRef.current = initKey;
      applyInitialRoute(route, prefill?.schemaParams);
    }).catch((error: unknown) => {
      if (cancelled || manualRevisionRef.current !== revision) return;
      initKeyRef.current = initKey;
      const message = error instanceof Error ? error.message : '没有可用的默认执行路由';
      setChannelIdRaw(null);
      setCapabilityRaw(targetCapability);
      setModelIdRaw(null);
      setSelectionSource('NONE');
      setUnavailableReason(message);
      setInitializing(false);
    });
    return () => { cancelled = true; };
  }, [
    applyInitialRoute,
    group,
    prefill,
    prefillPending,
    requiredCapability,
  ]);

  const markUserSelection = useCallback(() => {
    manualRevisionRef.current += 1;
    setSelectionSource('USER');
    setFallbackReason(null);
    setUnavailableReason(null);
    setInitializing(false);
  }, []);

  const setChannelId = useCallback((id: string | null) => {
    markUserSelection();
    setChannelIdRaw(id);
    setCapabilityRaw(requiredCapability ?? null);
    setModelIdRaw(null);
    setSchemaParamsRaw({});
  }, [markUserSelection, requiredCapability]);

  const setCapability = useCallback((code: string | null) => {
    if (locked) return;
    markUserSelection();
    setCapabilityRaw(code);
    setModelIdRaw(null);
    setSchemaParamsRaw({});
  }, [locked, markUserSelection]);

  const { data: supportedRaw } = useServiceQuery<{
    supportedCapabilities: string[];
  }>(
    () => channelId
      ? fetchSupportedCapabilities(channelId)
      : Promise.resolve({ supportedCapabilities: [] }),
    [channelId],
  );
  const supported = supportedRaw ?? { supportedCapabilities: [] };

  const capabilitiesInChannel = useMemo(() => {
    if (!channelType) return [] as CapabilityDefinition[];
    const channelCapabilities = matrix?.channels
      .find((item) => item.channelType === channelType)?.capabilities ?? [];
    return channelCapabilities
      .filter((item) => supported.supportedCapabilities.includes(item.code))
      .filter((item) => item.group === group);
  }, [channelType, matrix, supported.supportedCapabilities, group]);

  const { data: models } = useServiceQuery<ChannelGroupModel[]>(
    () => channelId ? fetchChannelGroupModels(channelId) : Promise.resolve([]),
    [channelId],
  );
  const modelsInGroup = useMemo(
    () => (models ?? []).filter((item) => item.group === group),
    [models, group],
  );
  const defaultModelCode = modelsInGroup[0]?.model?.trim() || null;
  const isMultiframeCapability = capability === 'MULTIFRAME';
  const modelOptionsInGroup = useMemo(() => {
    const catalog = matrix?.channels.find((item) => item.channelType === channelType)
      ?.modelOptions?.[group] ?? [];
    const deduped = [...new Set(catalog.map((value) => value.trim()).filter(Boolean))]
      .filter((value) => value !== defaultModelCode);
    return isMultiframeCapability
      ? deduped.filter((value) =>
        (MULTIFRAME_ALLOWED_MODELS as readonly string[]).includes(value))
      : deduped;
  }, [channelType, defaultModelCode, group, matrix, isMultiframeCapability, MULTIFRAME_ALLOWED_MODELS]);
  const effectiveModelCode = modelId ?? defaultModelCode;

  const paramsFingerprint = useMemo(
    () => JSON.stringify(schemaParams),
    [schemaParams],
  );
  const schemaIdentity = `${channelType ?? ''}|${capability ?? ''}|${effectiveModelCode ?? ''}`;
  const { data: loadedSchema } = useServiceQuery<CapabilityDefinition | null>(
    () => channelType && capability
      ? fetchCapabilitySchema(channelType, capability, {
          modelCode: effectiveModelCode,
          taskParams: schemaParams,
        })
      : Promise.resolve(null),
    [channelType, capability, effectiveModelCode, paramsFingerprint],
  );
  useEffect(() => {
    if (loadedSchema) setLastSchema({ identity: schemaIdentity, value: loadedSchema });
  }, [loadedSchema, schemaIdentity]);
  const schema = loadedSchema
    ?? (lastSchema?.identity === schemaIdentity ? lastSchema.value : null);

  const { data: recommendListRaw } = useTemplateRecommend(
    prefill?.templateId,
    prefill?.templateVersionId,
    channelType ?? undefined,
    capability ?? undefined,
  );
  const recommendList = recommendListRaw ?? [];
  useEffect(() => {
    if (!prefill || recommendList.length === 0 || selectionSource === 'USER') return;
    const recommendKey = `${initKeyRef.current ?? ''}|${channelType ?? ''}|${capability ?? ''}`;
    if (recommendAppliedKeyRef.current === recommendKey) return;
    recommendAppliedKeyRef.current = recommendKey;
    const recommended: Record<string, any> = {};
    for (const item of recommendList) {
      try { recommended[item.paramsKey] = JSON.parse(item.paramsJson); }
      catch { recommended[item.paramsKey] = item.paramsJson; }
    }
    setSchemaParamsRaw((current) => ({ ...recommended, ...current }));
  }, [capability, channelType, prefill, recommendList, selectionSource]);

  useEffect(() => {
    if (!schema) return;
    const next: Record<string, any> = {};
    for (const field of schema.fields ?? []) {
      let value = schemaParams[field.key];
      const hasValue = value !== undefined && value !== null && value !== '';
      if (!hasValue && field.defaultValue !== undefined
          && field.defaultValue !== null && field.defaultValue !== '') {
        value = field.defaultValue;
      }
      if (value === undefined || value === null || value === '') continue;
      if (field.type === 'BOOLEAN') {
        value = value === true || value === 'true';
      } else if (field.type === 'INT' || field.type === 'DECIMAL') {
        const numericValue = Number(value);
        value = Number.isFinite(numericValue) ? numericValue : field.defaultValue;
      } else if (field.type === 'SELECT' && field.options?.length) {
        const valid = field.options.some((option) => option.value === String(value));
        if (!valid) value = field.defaultValue ?? field.options[0].value;
      }
      next[field.key] = value;
    }
    if (JSON.stringify(next) !== JSON.stringify(schemaParams)) {
      setSchemaParamsRaw(next);
    }
  }, [schema, schemaParams]);

  const recommendValues = useMemo(() => {
    const values: Record<string, any> = {};
    for (const item of recommendList) {
      try { values[item.paramsKey] = JSON.parse(item.paramsJson); }
      catch { values[item.paramsKey] = item.paramsJson; }
    }
    return values;
  }, [recommendList]);

  const setModelWithValidation = useCallback((id: string | null) => {
    if (locked) return;
    markUserSelection();
    setModelIdRaw(id);
    setSchemaParamsRaw({});
  }, [locked, markUserSelection]);

  const setSchemaParams = useCallback((params: Record<string, any>) => {
    if (locked) return;
    setSchemaParamsRaw(params);
  }, [locked]);

  const isSupported = useMemo(
    () => !initializing && !unavailableReason && schema != null,
    [initializing, unavailableReason, schema],
  );

  return {
    channelId,
    channelType,
    capability,
    modelId,
    effectiveModelCode,
    schema,
    schemaParams,
    instances,
    capabilitiesInChannel,
    modelsInGroup,
    defaultModelCode,
    modelOptionsInGroup,
    setChannelId: locked ? () => {} : setChannelId,
    setCapability,
    setModelId: setModelWithValidation,
    setSchemaParams,
    recommendValues,
    locked,
    isSupported,
    setModelWithValidation,
    selectionSource,
    fallbackReason,
    unavailableReason,
    initializing,
  };
}
