// src/components/CreateImageTask/CreateImageTask.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AppScreen } from '../../types';
import type { ProductAsset } from '../../types';
import type { TaskResultPreviewResponse, TaskStatus } from '../../types';
import { taskApi } from '../../api/modules/task';
import { productInfoApi, type ProductDTO } from '../../api/modules/productInfo';
import type { AssetResourceItem } from '../../api/modules/asset';
import type { ImageGenerationType } from '../../lib/createImageTask/readinessChecks';
import type { ReferenceSlot } from '../../lib/createImageTask/extractReferenceInsights';
import type { ProductFactsInput } from '../../lib/createImageTask/extractProductFacts';
import { toSlotRef } from '../common/TransitPickerButton';

import { TopHeader } from './header/TopHeader';
import { ThreeColumnLayout } from './layout/ThreeColumnLayout';
import { ImageSourceSection } from './left/ImageSourceSection';
import { ReferenceGrid } from './left/ReferenceGrid';
import { ImageTypeSelector } from './center/ImageTypeSelector';
import { TemplatePicker } from './center/TemplatePicker';
import { StyleScenePoseRow } from './center/StyleScenePoseRow';
import { ImageContentSection } from './center/ImageContentSection';
import { ProductFactsEditor } from './center/ProductFactsEditor';
import { ImageSettingsSection, type TaskParamsSnapshot } from './right/ImageSettingsSection';
import { ImageResultPanel } from './right/ImageResultPanel';
import { ConflictDialog } from './dialogs/ConflictDialog';
import { TemplateOverwriteDialog } from './dialogs/TemplateOverwriteDialog';
import { ExecutionConfirmDialog } from './dialogs/ExecutionConfirmDialog';
import { CreateProductFromAssetDialog } from './dialogs/CreateProductFromAssetDialog';
import { AssetTransitModal } from '../AssetTransitModal';
import { useCreateImageTaskState } from '../../hooks/useCreateImageTaskState';
import { useDictOptions } from '../../api/hooks/useDict';
import { REFERENCE_SLOTS_INTERNAL } from '../../lib/createImageTask/referencesConfig';
import { withCosThumbnail } from '../../utils/cosImage';
import { creationTemplateApi } from '../../api/modules/creationTemplate';
import { useServiceQuery } from '../../api/hooks/useServiceQuery';
import type { PrefillState } from '../createTask/useTaskParams';
import type { AssistantTaskPrefill } from '../../api/modules/assistant';
import type { TaskReusePrefill } from '../../lib/task/taskReuse';
import {
  groupReferenceSlots,
  referenceKey,
  sameReferenceAsset,
  type TaggedReference,
} from '../../lib/createImageTask/imageCreationUi';

interface CreateImageTaskProps {
  products: ProductAsset[];
  onAddTask: (info: { groupId: string; taskIds: string[]; taskKind?: 'IMAGE' | 'VIDEO' }) => void;
  setScreen: (
    screen: AppScreen,
    payload?: { highlightGroupId?: string; creationTemplateId?: string },
  ) => void;
  openTransit: () => void;
  onCreateModel?: () => void;
  selectedProduct: ProductAsset;
  setSelectedProduct: (product: ProductAsset) => void;
  creationTemplateId?: string | null;
  assistantPrefill?: AssistantTaskPrefill | null;
  /** 从任务结果继续创作时带入的、已保存的业务素材。 */
  resultAssetPrefill?: AssetResourceItem | null;
  /** 从任务列表重新制作时带入的原始任务上下文。 */
  taskReusePrefill?: TaskReusePrefill | null;
  /** 返回按钮回调;不传则 fallback 到跳工作台首页(原行为) */
  onBack?: () => void;
}

/**
 * 当前正在等待选资源的"目标位":
 * - 'main'             主图
 * - 其余 5 个         对应 ReferenceSlot(detail/style/scene/pose/model)
 */
type PendingSlot = 'main' | ReferenceSlot | null;

const IMAGE_TYPE_PREFILL_MAP: Record<string, ImageGenerationType> = {
  PRODUCT_MAIN: 'product_main',
  SCENE_DETAIL: 'scene_detail',
  DETAIL_SCENE: 'scene_detail',
  DETAIL_CLOSEUP: 'detail_closeup',
  DETAIL: 'detail_closeup',
  MODEL_TRIPLE_VIEW: 'model_triple_view',
  ON_MODEL: 'model_triple_view',
};

const EMPTY_PRODUCT_FACTS: ProductFactsInput = {
  name: '',
  sellingPoints: '',
  productCategory: '',
  colorPattern: '',
  fabricTexture: '',
  fitStructure: '',
};

const parseTaskParams = (value?: string | null): Record<string, unknown> => {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
};

// 模板选择入口暂时隐藏；后续需要时改为 true 即可恢复。
const SHOW_TEMPLATE_PICKER = false;

const renderReusablePrompt = (prompt: string, facts: ProductFactsInput) => {
  const values: Record<string, string> = {
    name: facts.name,
    productName: facts.name,
    sellingPoints: facts.sellingPoints ?? '',
    productCategory: facts.productCategory ?? '',
    category: facts.productCategory ?? '',
    color: facts.colorPattern,
    colorPattern: facts.colorPattern,
    fabricTexture: facts.fabricTexture ?? '',
    fitStructure: facts.fitStructure ?? '',
  };
  return prompt.replace(/\{\{([^}]+)}}/g, (match, key: string) =>
    values[key] || match);
};

export const CreateImageTask: React.FC<CreateImageTaskProps> = (props) => {
  const {
    setScreen,
    onAddTask,
    creationTemplateId,
    assistantPrefill,
    resultAssetPrefill,
    taskReusePrefill,
    onBack,
  } = props;
  const creationPrefillQuery = useServiceQuery(
    () => creationTemplateId
      ? creationTemplateApi.reuseContext(creationTemplateId)
      : Promise.resolve(null),
    [creationTemplateId],
  );
  const creationPrefill = creationPrefillQuery.data;
  const imageParamsPrefill = useMemo<PrefillState | null>(() => {
    if (taskReusePrefill?.task.taskKind === 'IMAGE') {
      return {
        channelInstanceId: taskReusePrefill.task.modelChannelId ?? null,
        channelType: null,
        capability: taskReusePrefill.task.capability ?? 'REF_IMG_EDIT',
        model: taskReusePrefill.task.modelCode ?? null,
        schemaParams: parseTaskParams(taskReusePrefill.task.taskParamsJson),
        lockExecution: false,
      };
    }
    if (assistantPrefill && assistantPrefill.targetScreen === 'CREATE_IMAGE_TASK') {
      return {
        channelInstanceId: assistantPrefill.execution.channelInstanceId,
        channelType: assistantPrefill.execution.channelType,
        capability: assistantPrefill.capability,
        model: assistantPrefill.execution.modelCode ?? null,
        schemaParams: assistantPrefill.schemaParams,
        lockExecution: false,
        resolved: true,
        source: assistantPrefill.execution.source,
        fallbackApplied: false,
      };
    }
    if (!creationPrefill || creationPrefill.mediaType !== 'IMAGE') return null;
    const snapshot = creationPrefill.snapshot;
    const route = creationPrefill.effectiveExecution;
    return {
      templateId: creationPrefill.templateId,
      templateVersionId: creationPrefill.versionId,
      channelInstanceId: route?.channelInstanceId ?? null,
      channelType: route?.channelType ?? snapshot.channelType ?? null,
      capability: route?.capabilityCode ?? snapshot.capability ?? 'REF_IMG_EDIT',
      model: route?.modelCode ?? null,
      schemaParams: snapshot.schemaParams,
      lockExecution: false,
      resolved: true,
      source: route?.source,
      fallbackApplied: route?.fallbackApplied ?? false,
      fallbackReason: route?.fallbackReason ?? null,
      unavailableReason: creationPrefill.executionUnavailableReason ?? null,
    };
  }, [assistantPrefill, creationPrefill, taskReusePrefill]);

  // ---- local form state ----
  const [productFacts, setProductFacts] = useState<ProductFactsInput>(EMPTY_PRODUCT_FACTS);
  const [seoName, setSeoName] = useState('');
  const [mainValue, setMainValue] = useState<{
    /** asset_resource.id(后端 aiAnalyze + 提交 assetId 用)—— 雪花 ID 必须 string 避免 JS 精度丢失 */
    id?: string;
    /** 兼容字段:历史命名,实际存的是 asset_resource.id(不是 file_resource.id) */
    fileResourceId?: string;
    originalUrl?: string;
    thumbnailUrl?: string;
    name?: string;
  } | null>(null);

  // 商品不再单独选择，由主体素材上的 productId 自动匹配。
  const [selectedFromLibrary, setSelectedFromLibrary] = useState<ProductDTO | null>(null);
  const [unboundMainAsset, setUnboundMainAsset] = useState<AssetResourceItem | null>(null);
  const [matchingProduct, setMatchingProduct] = useState(false);
  const selectedMainResourceIdRef = useRef<string | null>(null);
  const appliedResultAssetRef = useRef<string | null>(null);

  // ---- 本页自己的资源中心 picker(替代 App.tsx 全局 manager modal)----
  // 由 pendingSlot 路由:点击主图 → 'main';点击参考图 slot → 该 slot id
  const [pendingSlot, setPendingSlot] = useState<PendingSlot>(null);
  const isTransitOpen = pendingSlot !== null;

  // 新图入场联动:picker 选完图后,把 ref 的 key 写入这里,ReferenceGrid 匹配后
  // 强制打开该图 RolePicker 让用户选 slot;RolePicker 关闭后清掉
  const [forceOpenRoleKey, setForceOpenRoleKey] = useState<string | null>(null);

  // ---- hook ----
  // 通道/能力/模型 真实值由 ImageSettingsSection 内部 useTaskParams 装载(从
  // /v1/admin/capability/supported-list 等接口拉取);子组件通过 onParamsChange
  // 回调把选中状态冒泡到此处：channelId 是通道雪花 ID，modelId 历史命名实际存供应商 modelCode。
  // 之前写死 channel-1 / gpt-image-1 已被替换,父组件不再自己调 useTaskParams(避免两份独立 state)。

  // 风格 / 场景 / 姿势 字典(从后端 dict 实时拉取,后端 categoryCode 由 dafenqi-ai 字典管理配置)
  const { options: styleDictOptions, loading: loadingStyle } = useDictOptions('STYLE');
  const { options: sceneDictOptions, loading: loadingScene } = useDictOptions('SCENE');
  const { options: poseDictOptions,  loading: loadingPose  } = useDictOptions('POSTURE');

  const [paramsSnapshot, setParamsSnapshot] = useState<TaskParamsSnapshot>({
    channelId: null,
    channelType: null,
    capability: null,
    modelId: null,
    executionParamsReady: false,
    selectionSource: 'NONE',
    fallbackReason: null,
    // [2026-07-25 P0 修复] 加 schemaParams 字段,接收 ImageSettingsSection.onParamsChange
    // 冒泡上来的能力参数(包含 aspect_ratio / resolution 等),透传给 useCreateImageTaskState。
    schemaParams: {},
  });
  const state = useCreateImageTaskState({
    isProductBound: !!mainValue && !!selectedFromLibrary,
    mainAssetId: mainValue?.id ?? null,
    mainImage: mainValue,
    // productId 由主体素材关联的商品提供，雪花 ID 全程保持 string。
    productId: selectedFromLibrary?.id ?? null,
    // AI 助手成功后,把后端 6 字段一次回写到顶层 productFacts state,
    // 让 ProductFactsEditor 的 input 实时刷新。
    onAiComplete: setProductFacts,
    channel: {
      id: paramsSnapshot.channelId ?? '',
      name: paramsSnapshot.channelId ?? '',
      accessType: 'cloud',
      health: 'NORMAL',
    },
    model: {
      id: paramsSnapshot.modelId ?? '',
      name: paramsSnapshot.modelId ?? '',
      // [2026-07-25 P0 修复] 删 capability.ratios / resolutions 写死假数据 ——
      // 这俩字段在 isSupported 旧判定里用过,但写死值与 Vidu 真实 schema 不一致
      // (写死 resolutions=['1024px','1536px','2048px'],Vidu 实际只接受 1080p/2K/4K),
      // 导致 readiness 永远报"不支持"假阳性。只保留 maxCount(由 useTaskParams 装载)。
      capability: { maxCount: 5 },
    },
    // [2026-07-25 P0 修复] ratio / resolution 不再作为独立字段传入(前端不做供应商映射)。
    // ParamSchemaForm 收集的能力参数整体透传给 hook,直接作为 taskParamsJson 提交;
    // 后端 ChannelParamBinder 按 ViduCapabilities schema 字段名映射到 Vidu body。
    schemaParams: paramsSnapshot.schemaParams,
    channelType: paramsSnapshot.channelType,
    capability: paramsSnapshot.capability,
    executionSelectionSource: paramsSnapshot.selectionSource,
    sourceCreationTemplateId: creationPrefill?.templateId ?? null,
    sourceCreationTemplateVersionId: creationPrefill?.versionId ?? null,
    executionParamsReady: paramsSnapshot.executionParamsReady,
    promptProductName: seoName,
    templateName: creationPrefill?.templateName ?? '默认模板',
    toSubmit: async () => '',
    onAddTask,
    setScreen,
  });

  const {
    selectedTypes, typeCounts, template,
    style, scene, pose, negativePrompt,
    promptOverrides,
    assistantState, references,
    conflictOpen, templatePickerOpen, pendingTemplate,
    templateOverwriteOpen, executionConfirmOpen,
    isSubmitting,
    setConflictOpen, setTemplateOverwriteOpen, setExecutionConfirmOpen,
    prompts, promptsComplete,
    isSupported, totalCount,
    toggleType, changeTypeCount, requestTemplateChange, applyTemplate,
    setTemplate,
    setStyle, setScene, setPose, setNegativePrompt,
    updateProductFact, setFormFactsExternal,
    setPromptOverride, runAssistantAnalysis,
    regeneratePrompts, applyAiOptimizeToSelected,
    selectReference, updateReferenceOrder, checkAndGenerate, submitTasks,
  } = state;
  const appliedCreationTemplateRef = useRef<string | null>(null);
  const appliedAssistantPrefillRef = useRef<string | null>(null);
  const appliedTaskReuseRef = useRef<string | null>(null);

  // ---- [2026-08-15] 仅提交模式:右侧「本次生成结果」轮询展示 ----
  // submitStatus: idle=未提交 / loading=提交后轮询中 / done=全部任务结束
  const [submittedGroup, setSubmittedGroup] = useState<{ groupId: string } | null>(null);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'done'>('idle');

  // [2026-08-19] 图片任务预检状态:在确认弹窗打开时拉取预估消耗
  const [preflightResult, setPreflightResult] = useState<{ estimatedCost?: number | null } | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);

  // [2026-08-19] 确认弹窗打开 → 触发 preflight
  useEffect(() => {
    if (!executionConfirmOpen) {
      // 关闭时清理,避免下次打开残留
      setPreflightResult(null);
      setPreflightLoading(false);
      return;
    }
    setPreflightLoading(true);
    setPreflightResult(null);
    const taskParamsJson = JSON.stringify(paramsSnapshot.schemaParams ?? {});
    taskApi.preflightImageTask({
      capability: 'REF_IMG_EDIT',
      channelType: 'VIDU',
      channelInstanceId: paramsSnapshot.channelId ?? '',
      modelCode: paramsSnapshot.modelId ?? undefined,
      taskParamsJson,
    }).then((resp) => {
      setPreflightResult({ estimatedCost: resp.estimatedCost });
    }).catch(() => {
      // 失败时降级:不展示预估消耗
      setPreflightResult({ estimatedCost: null });
    }).finally(() => {
      setPreflightLoading(false);
    });
  }, [executionConfirmOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  // [2026-08-15] 结果按图片类型分组:每个任务一行(imageType + taskStatus + 该任务的产物)
  const [submitGroups, setSubmitGroups] = useState<Array<{
    imageType: string;
    taskStatus: TaskStatus;
    count: number;
    previews: TaskResultPreviewResponse[];
  }>>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const ACTIVE_TASK_STATUSES: TaskStatus[] = ['DRAFT', 'PENDING', 'GENERATING'];

  useEffect(() => {
    if (!submittedGroup) return;
    let cancelled = false;
    let timer = 0;
    // [2026-08-15] 轮询兜底:最长 15 分钟,超时按当前结果展示,避免异常场景无限轮询
    const startedAt = Date.now();
    const MAX_POLL_MS = 15 * 60 * 1000;
    const tick = async () => {
      if (Date.now() - startedAt > MAX_POLL_MS) {
        setSubmitStatus('done');
        setSubmitError(null);
        window.clearInterval(timer);
        return;
      }
      try {
        const group = await taskApi.groupDetail(submittedGroup.groupId);
        if (cancelled) return;
        const tasks = group.tasks ?? [];
        const groups = tasks.map((task) => ({
          imageType: task.imageType ?? 'UNKNOWN',
          taskStatus: task.status,
          count: task.count ?? 1,
          previews: task.resultPreviews ?? [],
        }));
        setSubmitGroups(groups);
        const allDone = tasks.length > 0
          && tasks.every((task) => !ACTIVE_TASK_STATUSES.includes(task.status));
        if (allDone) {
          setSubmitStatus('done');
          setSubmitError(null);
          window.clearInterval(timer);
        } else {
          setSubmitStatus('loading');
        }
      } catch (err) {
        if (!cancelled) setSubmitError((err as Error).message);
      }
    };
    void tick();
    timer = window.setInterval(() => void tick(), 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [submittedGroup]);

  /** 仅提交:提交后不跳转,右侧结果面板进入轮询 */
  const handleSubmitOnly = async () => {
    const resp = await submitTasks('stay');
    if (resp) {
      setSubmittedGroup({ groupId: resp.groupId });
      setSubmitStatus('loading');
      setSubmitGroups([]);
      setSubmitError(null);
    }
  };

  // [2026-08-15] 风格/场景/姿势完全以字典为准、三者独立:
  // 去掉 CANONICAL_STYLES 硬编码清单,也不再按风格联动收窄场景/姿势选项;
  // 选项(名称/描述/图片/id)全部来自后端字典,选择互不影响。
  const styleOptions = styleDictOptions;
  const sceneOptions = sceneDictOptions;
  const poseOptions = poseDictOptions;
  const groupedReferences = useMemo(
    () => groupReferenceSlots(state.orderedRefs),
    [state.orderedRefs],
  );
  const lockedByReference = useMemo(() => {
    const result: Partial<Record<'style' | 'scene' | 'pose', string>> = {};
    (['style', 'scene', 'pose'] as const).forEach((role) => {
      const index = groupedReferences.findIndex((reference) => reference.roles.includes(role));
      if (index >= 0) result[role] = `图 ${index + 2}`;
    });
    return result;
  }, [groupedReferences]);

  // [2026-08-15] 风格选择不再联动场景/姿势 —— 三者独立,各自以字典为准。
  const handleStyleChange = useCallback((value: string) => {
    setStyle(value);
  }, [setStyle]);

  useEffect(() => {
    if (!assistantPrefill || assistantPrefill.targetScreen !== 'CREATE_IMAGE_TASK') return;
    if (appliedAssistantPrefillRef.current === assistantPrefill.sourceResultId) return;
    const reference = assistantPrefill.references.find((item) => item.type === 'IMAGE');
    if (!reference?.assetResourceId || !reference.url) return;
    appliedAssistantPrefillRef.current = assistantPrefill.sourceResultId;
    setMainValue({
      id: reference.assetResourceId,
      fileResourceId: reference.assetResourceId,
      originalUrl: reference.url,
      thumbnailUrl: reference.url,
      name: '助手生成图片',
    });
    selectedMainResourceIdRef.current = reference.assetResourceId;
    setUnboundMainAsset({
      id: reference.assetResourceId,
      name: '助手生成图片',
      assetKind: 'IMAGE',
      originalUrl: reference.url,
      thumbnailUrl: reference.url,
      fileResourceId: reference.fileResourceId,
      uploadUserId: '',
      status: 'NORMAL',
      visibility: 'PUBLIC',
      categoryIds: [],
    });
    if (assistantPrefill.negativePrompt) setNegativePrompt(assistantPrefill.negativePrompt);
    const targetType = selectedTypes[0] ?? 'product_main';
    if (assistantPrefill.prompt) setPromptOverride(targetType, assistantPrefill.prompt);
    toast.success('已一次性带入助手生成图片与 Prompt；离开本页后不会恢复');
  }, [
    assistantPrefill,
    selectedTypes,
    setNegativePrompt,
    setPromptOverride,
  ]);

  useEffect(() => {
    if (!creationPrefill || creationPrefill.mediaType !== 'IMAGE') return;
    if (appliedCreationTemplateRef.current === creationPrefill.templateId) return;
    const snapshot = creationPrefill.snapshot;
    appliedCreationTemplateRef.current = creationPrefill.templateId;

    // 做同款只恢复可复用创作信息，明确清空商品、商品事实和主体素材。
    setSelectedFromLibrary(null);
    setMainValue(null);
    setUnboundMainAsset(null);
    selectedMainResourceIdRef.current = null;
    setTemplate(creationPrefill.templateName);
    setProductFacts(EMPTY_PRODUCT_FACTS);
    setSeoName('');
    setFormFactsExternal(EMPTY_PRODUCT_FACTS);
    if (snapshot.style) setStyle(snapshot.style);
    if (snapshot.scene) setScene(snapshot.scene);
    if (snapshot.pose) setPose(snapshot.pose);
    if (snapshot.negativePrompt) setNegativePrompt(snapshot.negativePrompt);

    const targetType = snapshot.imageType
      ? IMAGE_TYPE_PREFILL_MAP[snapshot.imageType]
      : undefined;
    if (targetType) {
      // toggleType 不允许取消最后一个已选类型。先加入做同款的目标类型，
      // 再移除其余类型，避免非商品主图模板与默认“商品主图”同时被选中。
      if (!selectedTypes.includes(targetType)) toggleType(targetType);
      selectedTypes.filter((type) => type !== targetType).forEach(toggleType);
      const currentCount = typeCounts[targetType] ?? 1;
      const targetCount = Math.max(1, Math.min(5, snapshot.count ?? 1));
      for (let index = currentCount; index < targetCount; index += 1) {
        changeTypeCount(targetType, 1);
      }
      for (let index = currentCount; index > targetCount; index -= 1) {
        changeTypeCount(targetType, -1);
      }
      if (snapshot.prompt) setPromptOverride(targetType, snapshot.prompt);
    }

    const referenceSlotMap: Record<string, ReferenceSlot> = {
      REFERENCE_DETAIL: 'detail',
      REFERENCE_STYLE: 'style',
      REFERENCE_SCENE: 'scene',
      REFERENCE_POSE: 'pose',
      REFERENCE_MODEL: 'model',
      DETAIL_REF: 'detail',
      STYLE_REF: 'style',
      SCENE_REF: 'scene',
      POSE_REF: 'pose',
      MODEL_REF: 'model',
    };
    snapshot.references?.forEach((reference) => {
      const slot = referenceSlotMap[reference.role];
      if (!slot || !reference.assetId || !reference.url) return;
      selectReference(slot, {
        slot,
        id: reference.assetId,
        fileResourceId: reference.assetId,
        originalUrl: reference.url,
        thumbnailUrl: reference.thumbnailUrl,
        name: reference.name,
      });
    });
    toast.success(`已应用模板：${creationPrefill.templateName}，请重新选择主体素材`);
  }, [
    changeTypeCount,
    creationPrefill,
    selectedTypes,
    selectReference,
    setFormFactsExternal,
    setNegativePrompt,
    setPose,
    setPromptOverride,
    setScene,
    setStyle,
    setTemplate,
    toggleType,
    typeCounts,
  ]);

  const handleReferenceRolesChange = useCallback((
    reference: TaggedReference,
    roles: ReferenceSlot[],
  ) => {
    REFERENCE_SLOTS_INTERNAL.forEach((slot) => {
      const current = references[slot];
      if (sameReferenceAsset(current, reference.ref) && !roles.includes(slot)) {
        selectReference(slot, undefined);
      }
    });
    roles.forEach((slot) => {
      selectReference(slot, { ...reference.ref, slot });
    });
    if (roles.includes('style')) setStyle('');
    if (roles.includes('scene')) setScene('');
    if (roles.includes('pose')) setPose('');
  }, [references, selectReference, setPose, setScene, setStyle]);

  const handleRemoveReference = useCallback((reference: TaggedReference) => {
    REFERENCE_SLOTS_INTERNAL.forEach((slot) => {
      if (sameReferenceAsset(references[slot], reference.ref)) selectReference(slot, undefined);
    });
    // 防御:被移除的图正是 forceOpen 指向的图 → 清 key 避免悬挂
    if (reference.key === forceOpenRoleKey) setForceOpenRoleKey(null);
  }, [forceOpenRoleKey, references, selectReference]);

  const handleProductFactChange = <K extends keyof ProductFactsInput,>(
    key: K,
    value: ProductFactsInput[K],
  ) => {
    setProductFacts((current) => ({ ...current, [key]: value }));
    updateProductFact(key, value);
  };

  // ---- AI assistant ----
  const handleAssistantClick = useCallback(() => {
    runAssistantAnalysis();
  }, [runAssistantAnalysis]);

  // ---- regenerate: clear overrides to fall back to computed prompts ----
  const handleRegenerateAll = useCallback(() => {
    regeneratePrompts();
  }, [regeneratePrompts]);

  // ---- AI optimize selected types ----
  const handleAiOptimizeSelected = useCallback(() => {
    applyAiOptimizeToSelected(selectedTypes);
  }, [applyAiOptimizeToSelected, selectedTypes]);

  // 主体素材匹配到商品后，把商品字段同步到商品事实和可复用模板 Prompt。
  const applyMatchedProduct = useCallback(
    (product: ProductDTO) => {
      setSelectedFromLibrary(product);
      const nextFacts: ProductFactsInput = {
        name: (product.name ?? '').trim(),
        sellingPoints: (product.sellingPoints ?? '').trim(),
        productCategory: (product.category ?? '').trim(),
        colorPattern: (product.color ?? '').trim(),
        fabricTexture: (product.patternMaterial ?? '').trim(),
        fitStructure: (product.silhouetteStructure ?? '').trim(),
      };
      setProductFacts(nextFacts);
      setSeoName([
        product.name,
        product.color,
        product.patternMaterial,
      ].map((value) => value?.trim()).filter(Boolean).join(' '));
      // 关键:也回写到 hook 的 formInput,触发 `prompts` useMemo 重算 → 4 类型 Prompt 自动重写
      setFormFactsExternal(nextFacts);
      const reusablePrompt = creationPrefill?.snapshot.prompt;
      const sourceImageType = creationPrefill?.snapshot.imageType;
      const targetType = sourceImageType
        ? IMAGE_TYPE_PREFILL_MAP[sourceImageType]
        : undefined;
      if (reusablePrompt && targetType) {
        setPromptOverride(targetType, renderReusablePrompt(reusablePrompt, nextFacts));
      }
    },
    [creationPrefill, setFormFactsExternal, setPromptOverride],
  );

  const resetProductContext = useCallback(() => {
    setSelectedFromLibrary(null);
    setProductFacts(EMPTY_PRODUCT_FACTS);
    setSeoName('');
    setFormFactsExternal(EMPTY_PRODUCT_FACTS);
  }, [setFormFactsExternal]);

  const clearMainSelection = useCallback((showToast = true) => {
    selectedMainResourceIdRef.current = null;
    setMainValue(null);
    setUnboundMainAsset(null);
    setMatchingProduct(false);
    resetProductContext();
    if (showToast) toast.info('已取消主体素材选择');
  }, [resetProductContext]);

  useEffect(() => {
    if (!taskReusePrefill || taskReusePrefill.task.taskKind !== 'IMAGE') return;
    const { group, imageAssets, task } = taskReusePrefill;
    if (appliedTaskReuseRef.current === task.taskId || imageAssets.length === 0) return;
    const orderedAssets = [...imageAssets].sort((left, right) =>
      (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
    const mainAsset = orderedAssets.find((asset) => asset.slotRoles.includes('MAIN'));
    if (!mainAsset) {
      toast.error('该历史图片任务缺少主体素材，无法完整还原');
      return;
    }
    appliedTaskReuseRef.current = task.taskId;

    selectedMainResourceIdRef.current = mainAsset.assetId;
    setSelectedFromLibrary(null);
    setUnboundMainAsset(null);
    setMatchingProduct(false);
    setMainValue({
      id: mainAsset.assetId,
      fileResourceId: mainAsset.assetId,
      originalUrl: mainAsset.originalUrl,
      thumbnailUrl: mainAsset.thumbnailUrl ?? mainAsset.originalUrl,
      name: mainAsset.name,
    });
    setProductFacts(EMPTY_PRODUCT_FACTS);
    setSeoName('');
    setFormFactsExternal(EMPTY_PRODUCT_FACTS);
    setStyle(task.style ?? '');
    setScene(task.scene ?? '');
    setPose(task.action ?? '');
    REFERENCE_SLOTS_INTERNAL.forEach((slot) => selectReference(slot, undefined));
    const referenceSlotMap: Record<string, ReferenceSlot> = {
      REFERENCE_DETAIL: 'detail',
      REFERENCE_STYLE: 'style',
      REFERENCE_SCENE: 'scene',
      REFERENCE_POSE: 'pose',
      REFERENCE_MODEL: 'model',
    };
    orderedAssets.forEach((asset) => {
      asset.slotRoles.forEach((role) => {
        const slot = referenceSlotMap[role];
        if (!slot) return;
        selectReference(slot, {
          slot,
          id: asset.assetId,
          fileResourceId: asset.assetId,
          originalUrl: asset.originalUrl,
          thumbnailUrl: asset.thumbnailUrl ?? asset.originalUrl,
          name: asset.name,
        });
      });
    });

    const targetType = task.imageType
      ? IMAGE_TYPE_PREFILL_MAP[task.imageType]
      : undefined;
    if (targetType) {
      if (!selectedTypes.includes(targetType)) toggleType(targetType);
      selectedTypes.filter((type) => type !== targetType).forEach(toggleType);
      const currentCount = typeCounts[targetType] ?? 1;
      const targetCount = Math.max(1, Math.min(5, task.count ?? 1));
      for (let index = currentCount; index < targetCount; index += 1) {
        changeTypeCount(targetType, 1);
      }
      for (let index = currentCount; index > targetCount; index -= 1) {
        changeTypeCount(targetType, -1);
      }
      if (task.taskPrompt) setPromptOverride(targetType, task.taskPrompt);
    }
    setNegativePrompt(task.negativePrompt ?? '');

    const productId = group.productId;
    if (!productId) {
      setUnboundMainAsset({
        id: mainAsset.assetId,
        name: mainAsset.name,
        assetKind: mainAsset.assetKind,
        originalUrl: mainAsset.originalUrl,
        thumbnailUrl: mainAsset.thumbnailUrl ?? undefined,
        uploadUserId: '',
        status: 'NORMAL',
        categoryIds: [],
      });
      toast.warning('已恢复任务素材与 Prompt，请补充关联商品后再生成');
      return;
    }
    void productInfoApi.detail({ id: productId })
      .then((product) => {
        if (selectedMainResourceIdRef.current === mainAsset.assetId) {
          applyMatchedProduct(product);
          toast.success(`已恢复任务：${task.taskCode}`);
        }
      })
      .catch(() => {
        if (selectedMainResourceIdRef.current === mainAsset.assetId) {
          setUnboundMainAsset({
            id: mainAsset.assetId,
            name: mainAsset.name,
            assetKind: mainAsset.assetKind,
            originalUrl: mainAsset.originalUrl,
            thumbnailUrl: mainAsset.thumbnailUrl ?? undefined,
            uploadUserId: '',
            status: 'NORMAL',
            categoryIds: [],
          });
          toast.warning('已恢复任务素材与 Prompt，但商品信息读取失败，请重新关联商品');
        }
      });
  }, [
    applyMatchedProduct,
    changeTypeCount,
    selectReference,
    selectedTypes,
    setFormFactsExternal,
    setNegativePrompt,
    setPose,
    setPromptOverride,
    setScene,
    setStyle,
    taskReusePrefill,
    toggleType,
    typeCounts,
  ]);

  const handleProductCreated = useCallback((product: ProductDTO) => {
    if (!unboundMainAsset || selectedMainResourceIdRef.current !== unboundMainAsset.id) return;
    applyMatchedProduct(product);
    setUnboundMainAsset(null);
  }, [applyMatchedProduct, unboundMainAsset]);

  // ---- 主图点击 → 打开 picker,target='main' ----
  const openMainPicker = useCallback(() => {
    setPendingSlot('main');
  }, []);

  // ---- 参考图 5 slot 点击 → 打开 picker,target=对应 slot ----
  const openSlotPicker = useCallback((slot: ReferenceSlot) => {
    // 5 slot 满防御:slot 为空 / 未被计算 → 提示并返回, 不打开 modal
    if (!slot) {
      toast.info('5 个参考槽位已全部使用');
      return;
    }
    setPendingSlot(slot);
  }, []);

  // ---- picker 确认:按 pendingSlot 路由写值 ----
  const handleTransitConfirm = useCallback(
    async (items: AssetResourceItem[]) => {
      if (items.length === 0) return;
      const item = items[0];
      // CI 缩略图参数拼接(与 OutfitComposePanel.tsx:142 同款)
      // - 主图容器 w-full h-44(max 256px):用 256,与 OutfitComposePanel 一致
      // - 参考图容器 w-10 h-10(40px):用 64,与 ProductManagePage.tsx:271 一致(避免浪费带宽)
      const slotRef = toSlotRef(item);
      if (pendingSlot === 'main') {
        selectedMainResourceIdRef.current = item.id;
        resetProductContext();
        setUnboundMainAsset(null);
        const compressedThumb = withCosThumbnail(slotRef.thumbnailUrl, 256) ?? slotRef.thumbnailUrl ?? slotRef.originalUrl;
        // 主图要保留 item.id(asset_resource.id,string),给后端 aiAnalyze + 提交 assetId 用;
        // toSlotRef 不带 id 字段,所以这里手写。
        setMainValue({
          id: item.id,
          fileResourceId: slotRef.fileResourceId,
          thumbnailUrl: compressedThumb,
          originalUrl: slotRef.originalUrl,
          name: slotRef.name,
        });
        setPendingSlot(null);

        if (!item.productId) {
          setMatchingProduct(false);
          setUnboundMainAsset(item);
          return;
        }

        setMatchingProduct(true);
        try {
          const product = await productInfoApi.detail({ id: item.productId });
          if (selectedMainResourceIdRef.current !== item.id) return;
          applyMatchedProduct(product);
          toast.success(`已匹配商品：${product.name}`);
        } catch {
          if (selectedMainResourceIdRef.current === item.id) clearMainSelection(false);
        } finally {
          if (selectedMainResourceIdRef.current === item.id) setMatchingProduct(false);
        }
      } else if (pendingSlot !== null) {
        // 5 个参考图 slot 之一
        // 关键:必须携带 fileResourceId(实际是 asset_resource.id)和 id,否则后端
        //      收到的 assetId 是空串。
        const compressedThumb = withCosThumbnail(slotRef.thumbnailUrl, 64) ?? slotRef.thumbnailUrl ?? slotRef.originalUrl;
        // [2026-08-15] 第一张参考图不自动弹槽位选择(已在资源中心点选具体槽位,再弹冗余)
        const isFirstReference = !Object.values(references).some(Boolean);
        selectReference(pendingSlot, {
          slot: pendingSlot,
          id: item.id,
          fileResourceId: slotRef.fileResourceId,
          thumbnailUrl: compressedThumb,
          originalUrl: slotRef.originalUrl,
          name: slotRef.name,
        });
        if (pendingSlot === 'style') setStyle('');
        if (pendingSlot === 'scene') setScene('');
        if (pendingSlot === 'pose') setPose('');
        // 新图入场联动:非首张时把刚写入的 ref 的 key 写入,触发该图 RolePicker 自动打开
        if (!isFirstReference) setForceOpenRoleKey(referenceKey(slotRef));
      }
      setPendingSlot(null);
    },
    [
      applyMatchedProduct,
      clearMainSelection,
      pendingSlot,
      references,
      resetProductContext,
      selectReference,
      setPose,
      setScene,
      setStyle,
    ],
  );

  const handleTransitClose = useCallback(() => {
    setPendingSlot(null);
  }, []);

  useEffect(() => {
    if (!resultAssetPrefill || appliedResultAssetRef.current === resultAssetPrefill.id) return;
    appliedResultAssetRef.current = resultAssetPrefill.id;
    selectedMainResourceIdRef.current = resultAssetPrefill.id;
    resetProductContext();
    setUnboundMainAsset(null);
    setMainValue({
      id: resultAssetPrefill.id,
      fileResourceId: resultAssetPrefill.id,
      originalUrl: resultAssetPrefill.originalUrl ?? resultAssetPrefill.thumbnailUrl,
      thumbnailUrl: withCosThumbnail(
        resultAssetPrefill.thumbnailUrl ?? resultAssetPrefill.originalUrl,
        256,
      ) ?? resultAssetPrefill.thumbnailUrl ?? resultAssetPrefill.originalUrl,
      name: resultAssetPrefill.name,
    });

    if (!resultAssetPrefill.productId) {
      setUnboundMainAsset(resultAssetPrefill);
      toast.warning('该结果未关联产品，请先选择或新建产品');
      return;
    }

    setMatchingProduct(true);
    void productInfoApi.detail({ id: resultAssetPrefill.productId })
      .then((product) => {
        if (selectedMainResourceIdRef.current === resultAssetPrefill.id) {
          applyMatchedProduct(product);
          toast.success(`已带入产品与生成结果：${product.name}`);
        }
      })
      .catch(() => {
        if (selectedMainResourceIdRef.current === resultAssetPrefill.id) {
          setUnboundMainAsset(resultAssetPrefill);
          toast.warning('已带入结果，但产品信息读取失败');
        }
      })
      .finally(() => {
        if (selectedMainResourceIdRef.current === resultAssetPrefill.id) setMatchingProduct(false);
      });
  }, [applyMatchedProduct, resetProductContext, resultAssetPrefill]);

  const isProductBound = !!mainValue && !!selectedFromLibrary && !matchingProduct;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f5f7fb] text-slate-800">
      {/* Header */}
      <TopHeader
        onBack={onBack ?? (() => setScreen(AppScreen.DASHBOARD))}
        productName={selectedFromLibrary?.name}
        productCategory={selectedFromLibrary?.categoryName ?? productFacts.productCategory}
        imageUrl={mainValue?.thumbnailUrl ?? mainValue?.originalUrl}
        isMatched={isProductBound}
      />

      {/* 3-column layout */}
      <ThreeColumnLayout
        left={
          <>
            <ImageSourceSection
              mainValue={mainValue}
              productName={selectedFromLibrary?.name}
              matchingProduct={matchingProduct}
              onPickMain={openMainPicker}
            />
            <ReferenceGrid
              orderedRefs={state.orderedRefs}
              openSlotPicker={openSlotPicker}
              onRolesChange={handleReferenceRolesChange}
              onRemove={handleRemoveReference}
              forceOpenRoleKey={forceOpenRoleKey}
              onForceOpenConsumed={() => setForceOpenRoleKey(null)}
            />
            <ProductFactsEditor
              value={productFacts}
              isProductBound={isProductBound}
              seoName={seoName}
              onSeoNameChange={setSeoName}
              onChange={handleProductFactChange}
            />
          </>
        }
        center={
          <>
            <ImageContentSection
              isProductBound={isProductBound}
              assistantState={assistantState}
              onAssistantClick={handleAssistantClick}
              selectedTypes={selectedTypes}
              typeCounts={typeCounts}
              defaultPrompts={prompts}
              promptOverrides={promptOverrides}
              templateName={template}
              promptsComplete={promptsComplete}
              onChangePromptOverride={setPromptOverride}
              onRegenerateAll={handleRegenerateAll}
              onAiOptimizeSelected={handleAiOptimizeSelected}
              typeSelector={
                <ImageTypeSelector
                  selectedTypes={selectedTypes}
                  typeCounts={typeCounts}
                  maxCountPerType={5}
                  onToggle={toggleType}
                  onChangeCount={changeTypeCount}
                />
              }
              tagSelector={
                <StyleScenePoseRow
                  styleOptions={styleOptions}
                  sceneOptions={sceneOptions}
                  poseOptions={poseOptions}
                  loadingStyle={loadingStyle}
                  loadingScene={loadingScene}
                  loadingPose={loadingPose}
                  style={style}
                  scene={scene}
                  pose={pose}
                  lockedByReference={lockedByReference}
                  onStyleChange={handleStyleChange} // 已简化为仅 setStyle,不联动场景/姿势
                  onSceneChange={setScene}
                  onPoseChange={setPose}
                />
              }
              templateSelector={
                SHOW_TEMPLATE_PICKER ? (
                  <TemplatePicker
                    value={template}
                    options={[{ id: 'default', name: '默认模板' }]}
                    onPickRequest={requestTemplateChange}
                  />
                ) : null
              }
              executionSettings={
                <ImageSettingsSection
                  prefill={imageParamsPrefill}
                  prefillPending={Boolean(creationTemplateId) && creationPrefillQuery.loading}
                  onParamsChange={setParamsSnapshot}
                />
              }
            />
          </>
        }
        right={
          <ImageResultPanel
            selectedTypes={selectedTypes}
            typeCounts={typeCounts}
            totalCount={totalCount}
            params={paramsSnapshot}
            onGenerate={checkAndGenerate}
            submitStatus={submitStatus}
            submitGroups={submitGroups}
            submitError={submitError}
          />
        }
      />

      {/* 本页自己的 picker modal:由 pendingSlot state 决定路由到主图/参考图 slot。
          mode='picker' 让确认按钮可用;onConfirmSelection 直接拿 AssetResourceItem[]。 */}
      {isTransitOpen && (
        <AssetTransitModal
          mode="picker"
          targetSlot={pendingSlot === 'model' ? 'reference-model' : pendingSlot ?? 'main'}
          purpose="OTHER"
          assetKind="IMAGE"
          initialSource={pendingSlot === 'model' ? 'MODEL' : 'PRODUCT'}
          onCreateModel={pendingSlot === 'model'
            ? () => {
                setPendingSlot(null);
                props.onCreateModel?.();
              }
            : undefined}
          onClose={handleTransitClose}
          onConfirmSelection={handleTransitConfirm}
        />
      )}

      {/* Dialogs (from hook state) */}
      <TemplateOverwriteDialog
        open={templateOverwriteOpen}
        onCancel={() => setTemplateOverwriteOpen(false)}
        onConfirm={() => {
          if (pendingTemplate) applyTemplate(pendingTemplate);
          setTemplateOverwriteOpen(false);
        }}
      />
      <ExecutionConfirmDialog
        open={executionConfirmOpen}
        isSubmitting={isSubmitting}
        // [2026-08-19] 预估消耗(后端 preflight 接口返回)
        estimatedCost={preflightResult?.estimatedCost}
        isPreflighting={preflightLoading}
        onSubmit={() => void submitTasks('navigate')}
        onSubmitOnly={() => void handleSubmitOnly()}
        onCancel={() => setExecutionConfirmOpen(false)}
        summary={{
          productName: productFacts.name,
          templateName: template,
          selectedTypes,
          typeCounts,
          totalCount,
          // [2026-07-25 P0 修复] ratio / resolution 直接从 paramsSnapshot.schemaParams 读
          // (ParamSchemaForm 收集,ViduCapabilities schema 字段名),不经过 hook 内部 state。
          ratio: paramsSnapshot.schemaParams?.aspect_ratio ?? '',
          resolution: paramsSnapshot.schemaParams?.resolution ?? '',
        }}
      />
      <ConflictDialog
        open={conflictOpen}
        fields={[]}
        onCancel={() => setConflictOpen(false)}
        onConfirm={() => setConflictOpen(false)}
      />

      <CreateProductFromAssetDialog
        asset={unboundMainAsset}
        onCancel={clearMainSelection}
        onCreated={handleProductCreated}
      />
    </div>
  );
};
