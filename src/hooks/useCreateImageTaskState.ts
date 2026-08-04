// src/hooks/useCreateImageTaskState.ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { AppScreen } from '../types';
import type {
  ProductAsset, ProductFactsInput as ApiProductFactsInput,
  ImageTypeEntry, TaskAssetRef, ImageTaskSubmitPayload, ImageTaskType, TaskAssetSlot,
} from '../types';
import type { ImageGenerationType, ReadinessCheck } from '../lib/createImageTask/readinessChecks';
import type { ReferenceSlot } from '../lib/createImageTask/extractReferenceInsights';
import { computeReadinessChecks } from '../lib/createImageTask/readinessChecks';
import {
  extractProductFacts,
  type ProductFacts,
  type ProductFactsInput,
} from '../lib/createImageTask/extractProductFacts';
import { buildPromptFromFacts } from '../lib/createImageTask/buildPromptFromFacts';
import { extractReferenceInsights } from '../lib/createImageTask/extractReferenceInsights';
import { applyAiOptimizePerType, type AllTypePrompts } from '../lib/createImageTask/applyAiOptimizePerType';
import { buildGenerationTask } from '../lib/createImageTask/buildGenerationTask';
import { compactReferenceOrder, moveReferenceInOrder, assignNextOrder, REFERENCE_SLOTS } from '../lib/createImageTask/referenceOrder';
import { taskApi } from '../api/modules/task';
import { messages } from '../labels/createImageTask';

// 与 referencesConfig 保持同步的 5 个参考图 slot 名。
// 重新声明一份以避免 export-re-export 在 Vite HMR 下偶发的 TDZ
// (ReferenceError: ... is not defined) — 直接定义比 re-export 稳定。
const REFERENCE_SLOTS_INTERNAL: readonly ReferenceSlot[] = REFERENCE_SLOTS;

function normalizeAnalyzedProductFacts(
  input: Partial<ApiProductFactsInput> | null | undefined,
): ProductFactsInput {
  return {
    name: input?.name ?? '',
    sellingPoints: input?.sellingPoints ?? '',
    productCategory: input?.productCategory ?? '',
    colorPattern: input?.color ?? '',
    fabricTexture: input?.fabricTexture ?? '',
    fitStructure: input?.fitStructure ?? '',
  };
}

// ==================== [2026-07-24 Task 13] 图片任务提交辅助 ====================

/**
 * 5 个参考图 slot → 后端 TaskAssetSlot 枚举的映射。
 * 用于拼 submitImageTask payload 的 assets[] 数组。
 */
const REFERENCE_SLOT_MAP: Record<ReferenceSlot, TaskAssetSlot> = {
  detail: 'REFERENCE_DETAIL',
  style: 'REFERENCE_STYLE',
  scene: 'REFERENCE_SCENE',
  pose: 'REFERENCE_POSE',
  model: 'REFERENCE_MODEL',
};

/**
 * 前端 UI 的小写 imageType(product_main / scene_detail / detail_closeup / model_triple_view)
 * → 后端 EnumImageTaskType 大写枚举值。
 */
function mapImageGenerationType(t: string): ImageTaskType {
  switch (t) {
    case 'product_main': return 'PRODUCT_MAIN';
    case 'scene_detail': return 'SCENE_DETAIL';
    case 'detail_closeup': return 'DETAIL_CLOSEUP';
    case 'model_triple_view': return 'MODEL_TRIPLE_VIEW';
    default:
      throw new Error(`unknown image type: ${t}`);
  }
}

export { REFERENCE_SLOTS_INTERNAL };
export type { ReferenceSlot } from '../lib/createImageTask/extractReferenceInsights';
export type { ImageGenerationType } from '../lib/createImageTask/readinessChecks';

export interface UseCreateImageTaskStateOpts {
  isProductBound: boolean;
  /** 主图 asset_resource.id —— AI 助手调 productInfoApi.aiAnalyze(imageId) 用 */
  mainAssetId?: string | number | null;
  /**
   * [2026-07-24 Task 13] 主图素材的 file_resource + asset_resource 信息。
   * 由调用方(CreateImageTask.tsx)从 mainValue 注入;未传时 MAIN 槽位 asset 省略。
   * 本期 CreateImageTask.tsx 暂未注入,后续 task 补 push。
   */
  mainImage?: {
    /** 雪花 ID 字符串,实际是 asset_resource.id(后端业务主键),命名沿用历史 */
    fileResourceId?: string;
    /** asset_resource.id(后端 aiAnalyze 用) */
    id?: string;
    originalUrl?: string;
    thumbnailUrl?: string;
    name?: string;
  } | null;
  // productId 可空:空/null 则 ProductService.upsert 创建新产品
  // string 类型(雪花 ID 字符串,后端 @JsonSerialize(ToStringSerializer) 输出形式)
  productId?: string | null;
  /** AI 助手拿到后端返回的 6 字段后回写到顶层 UI state */
  onAiComplete?: (facts: ProductFactsInput) => void;
  /** 顶层手动(选择产品时)把 6 字段灌进 hook 内部 formInput,触发 prompts 重算 */
  onPickedFacts?: (facts: ProductFactsInput) => void;
  channel: { id: string; name: string; accessType: string; health: string };
  model: { id: string; name: string; capability: { maxCount: number } };
  templateName: string;
  toSubmit: () => Promise<string>;
  onAddTask: (info: { groupId: string; taskIds: string[]; taskKind?: 'IMAGE' | 'VIDEO' }) => void;
  /**
   * 切换 AppScreen 的 setter。
   * [2026-07-24 Task 13] 第二个 payload 参数供 Task 14 实现"高亮 groupId"用;
   * App.tsx 暂时忽略,只取第 1 个 screen 字段。少参签名对此处兼容(TS 函数参数双变性)。
   */
  setScreen: (screen: AppScreen, payload?: { highlightGroupId?: string }) => void;
  /**
   * [2026-07-25 P0 修复] 右栏 ParamSchemaForm 收集的能力参数。
   * 直接作为 taskParamsJson 提交,字段名对齐后端 ViduCapabilities schema(aspect_ratio / resolution 等)。
   * 之前前端写死 ratio: '16:9' + mapResolutionToVidu 单位转换是把"供应商映射"提前做了,
   * 现在让后端 ChannelParamBinder 按 schema 自动映射(单源真相)。
   */
  schemaParams?: Record<string, any>;
  channelType?: string | null;
  capability?: string | null;
  executionSelectionSource?: string;
  sourceCreationTemplateId?: string | null;
  sourceCreationTemplateVersionId?: string | null;
  /** 通道、能力、模型以及能力 Schema 必填参数是否已完成选择。 */
  executionParamsReady: boolean;
}

export interface UseCreateImageTaskStateReturn {
  // state
  selectedTypes: ImageGenerationType[];
  typeCounts: Record<ImageGenerationType, number>;
  template: string;
  style: string;
  scene: string;
  pose: string;
  negativePrompt: string;
  promptOverrides: Partial<Record<ImageGenerationType, string>>;
  promptHasEdits: boolean;
  /**
   * [2026-07-26] AI 助手是否降级到本地拼 prompt(后端 imagePlanApi.analyze 失败时为 true)。
   * UI 可据此显示"已使用本地建议"提示。
   */
  assistantFallback: boolean;
  assistantState: 'idle' | 'processing' | 'complete';
  reviewEnabled: boolean;
  references: Record<ReferenceSlot, any | undefined>;
  orderedReferenceInsights: string[];
  referenceOrder: Record<ReferenceSlot, number | undefined>;
  compositeState: 'empty' | 'partial' | 'ready';
  readinessIssue: string;
  pendingChoice: { channelId: string; modelId: string } | null;
  conflictOpen: boolean;
  templatePickerOpen: boolean;
  pendingTemplate: string | null;
  templateOverwriteOpen: boolean;
  executionConfirmOpen: boolean;
  isSubmitting: boolean;
  // computed
  readinessChecks: ReadinessCheck[];
  readinessCount: number;
  prompts: Record<ImageGenerationType, string>;
  promptsComplete: boolean;
  isSupported: boolean;
  totalCount: number;
  // actions
  toggleType(t: ImageGenerationType): void;
  changeTypeCount(t: ImageGenerationType, delta: number): void;
  setTemplate(name: string): void;
  requestTemplateChange(name: string): void;
  applyTemplate(name: string): void;
  setStyle(v: string): void;
  setScene(v: string): void;
  setPose(v: string): void;
  setNegativePrompt(v: string): void;
  updateProductFact<K extends keyof ProductFactsInput>(key: K, value: ProductFactsInput[K]): void;
  // 顶层灌入"产品事实"路径(被选产品等):同步 hook 内部 formInput 让 prompts 重算
  setFormFactsExternal(facts: ProductFactsInput): void;
  setPromptOverride(t: ImageGenerationType, v: string): void;
  runAssistantAnalysis(): Promise<void>;
  regeneratePrompts(): void;
  applyAiOptimizeToSelected(selected: ImageGenerationType[]): void;
  setReviewEnabled(v: boolean): void;
  selectReference(slot: ReferenceSlot, ref: any | undefined): void;
  updateReferenceOrder(slot: ReferenceSlot, order: number): void;
  /** 拖拽移动 — reorder references into position `toIndex`(0-based) */
  moveReference(fromSlot: ReferenceSlot, toIndex: number): void;
  compactReferenceOrder(): void;
  /** 当前已选参考图的有序列表(按 referenceOrder 排序) */
  orderedRefs: { slot: ReferenceSlot; ref: any }[];
  checkAndGenerate(): void;
  submitTasks(): Promise<void>;
  // dialog setters
  setConflictOpen(v: boolean): void;
  setTemplateOverwriteOpen(v: boolean): void;
  setExecutionConfirmOpen(v: boolean): void;
}

const LEGACY_DRAFT_KEY = 'create-image-task-draft-v3';
const MIN_TYPE_COUNT = 1;
const MAX_TYPE_COUNT = 5;

export function useCreateImageTaskState(
  opts: UseCreateImageTaskStateOpts,
): UseCreateImageTaskStateReturn {
  // ---------- state ----------
  const [selectedTypes, setSelectedTypes] = useState<ImageGenerationType[]>(['product_main']);
  const [typeCounts, setTypeCounts] = useState<Record<ImageGenerationType, number>>({
    product_main: 1, scene_detail: 1, detail_closeup: 1, model_triple_view: 1,
  });
  const [template, setTemplateName] = useState<string>(opts.templateName);
  const [style, setStyle] = useState<string>('');
  const [scene, setScene] = useState<string>('');
  const [pose, setPose] = useState<string>('');
  const [negativePrompt, setNegativePrompt] = useState<string>('blurry, bad quality, distorted');
  const [promptOverrides, setPromptOverrides] = useState<Partial<Record<ImageGenerationType, string>>>({});
  const [promptHasEdits, setPromptHasEdits] = useState<boolean>(false);
  const [assistantState, setAssistantState] = useState<'idle' | 'processing' | 'complete'>('idle');
  /**
   * [2026-07-26] AI 助手是否降级(后端 imagePlanApi.analyze 失败时为 true)。
   * UI 可据此展示"已使用本地建议"提示。
   */
  const [assistantFallback, setAssistantFallback] = useState<boolean>(false);
  const [reviewEnabled, setReviewEnabled] = useState<boolean>(false);
  const [references, setReferences] = useState<Record<ReferenceSlot, { fileResourceId?: string | number; id?: string | number; originalUrl?: string; thumbnailUrl?: string; name?: string } | undefined>>({
    detail: undefined, style: undefined, scene: undefined, pose: undefined, model: undefined,
  });
  const [referenceOrder, setReferenceOrder] = useState<Record<ReferenceSlot, number | undefined>>({
    detail: undefined, style: undefined, scene: undefined, pose: undefined, model: undefined,
  });
  const [compositeState, setCompositeState] = useState<'empty' | 'partial' | 'ready'>('empty');
  const [readinessIssue, setReadinessIssue] = useState<string>('');
  const [pendingChoice, setPendingChoice] = useState<{ channelId: string; modelId: string } | null>(null);
  const [conflictOpen, setConflictOpen] = useState<boolean>(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState<boolean>(false);
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);
  const [templateOverwriteOpen, setTemplateOverwriteOpen] = useState<boolean>(false);
  const [executionConfirmOpen, setExecutionConfirmOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [productFacts, setProductFacts] = useState<ReturnType<typeof extractProductFacts> | null>(null);

  const [formInput, setFormInput] = useState<ProductFactsInput>({
    name: '', sellingPoints: '', productCategory: '',
    colorPattern: '', fabricTexture: '', fitStructure: '',
  });

  // 创建页不保留编辑草稿；挂载时顺便清理旧版本遗留的 sessionStorage 数据。
  useEffect(() => {
    try {
      sessionStorage.removeItem(LEGACY_DRAFT_KEY);
    } catch {
      // 浏览器禁用 storage 时无需处理，页面状态仍只存在于当前组件生命周期。
    }
  }, []);

  // ---------- computed ----------
  const orderedReferenceInsights = useMemo(
    () => extractReferenceInsights(references as Parameters<typeof extractReferenceInsights>[0]),
    [references],
  );

  /**
   * 已选参考图的有序数组(按 referenceOrder 升序;同 order 用 slot 名字典序稳定排序)。
   * UI 渲染顺序直接用这个数组,不渲染未选 slot → 列表紧凑、顺序稳定。
   */
  const orderedRefs = useMemo<{ slot: ReferenceSlot; ref: any }[]>(() => {
    // 用模块级快照避免 Vite HMR 下 export-re-export 偶发的 TDZ 报错。
    const SLOTS: readonly ReferenceSlot[] = REFERENCE_SLOTS_INTERNAL;
    const filled = SLOTS
      .filter((s) => references[s] !== undefined)
      .map((slot) => ({
        slot,
        ref: references[slot],
        order: referenceOrder[slot] ?? Number.MAX_SAFE_INTEGER,
      }))
      .sort((a, b) => a.order - b.order || SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
    return filled.map(({ slot, ref }) => ({ slot, ref }));
  }, [references, referenceOrder]);

  const orderedReferenceSlots = useMemo<ReferenceSlot[]>(
    () => orderedRefs.map(({ slot }) => slot),
    [orderedRefs],
  );

  const prompts = useMemo<AllTypePrompts>(() => {
    const facts = productFacts ?? extractProductFacts(formInput);
    const result: AllTypePrompts = { product_main: '', scene_detail: '', detail_closeup: '', model_triple_view: '' };
    (['product_main', 'scene_detail', 'detail_closeup', 'model_triple_view'] as ImageGenerationType[]).forEach((t) => {
      result[t] = buildPromptFromFacts(t, facts, style, scene, pose, orderedReferenceSlots);
    });
    return result;
  }, [productFacts, formInput, style, scene, pose, orderedReferenceSlots]);

  const promptsComplete = useMemo(() => {
    if (selectedTypes.length === 0) return false;
    return selectedTypes.every((t) => {
      // promptOverrides 是 Partial<Record, string>>(可选编辑覆盖),
      // 兜底 prompts[t](由 buildPromptFromFacts 生成,保证 string);再兜底空串。
      const prompt = promptOverrides[t] ?? prompts[t] ?? '';
      return typeof prompt === 'string' && prompt.trim().length > 0;
    });
  }, [selectedTypes, promptOverrides, prompts]);

  const isSupported = useMemo(() => {
    // [2026-07-25 P0 修复] 删 model.capability.ratios/resolutions 写死字段(Phase 2 清理);
    // 现在 model.capability 只剩 maxCount 字段(由 useTaskParams 装载 Vidu 能力 schema 的 groupDefault)。
    // ratio/resolution 由 ParamSchemaForm 收集的 schemaParams 管控,后端 SchemaValidator
    // 严格白名单校验合法性(走 /v1/task/capability-params/validate)。
    // 本 hook 只校验:每 imageType 的张数不超过模型 maxCount。
    const cm = opts.model.capability;
    return !selectedTypes.some((t) => typeCounts[t] > Math.min(cm.maxCount, MAX_TYPE_COUNT));
  }, [opts.model.capability, selectedTypes, typeCounts]);

  const totalCount = useMemo(
    () => selectedTypes.reduce((sum, t) => sum + typeCounts[t], 0),
    [selectedTypes, typeCounts],
  );

  const readinessDeps = useMemo(() => ({
    isProductBound: opts.isProductBound,
    promptsComplete,
    executionParamsReady: opts.executionParamsReady,
    isSupported,
    channelMaintenance: opts.channel.health === 'maintenance',
  }), [opts.isProductBound, promptsComplete, opts.executionParamsReady, isSupported, opts.channel.health]);

  const readinessChecks = useMemo(() => computeReadinessChecks(readinessDeps), [readinessDeps]);
  const readinessCount = readinessChecks.filter((c) => c.complete).length;

// ---------- actions ----------
  const toggleType = useCallback((t: ImageGenerationType) => {
    setSelectedTypes((prev) => {
      if (prev.includes(t)) {
        return prev.length > 1 ? prev.filter((x) => x !== t) : prev;
      }
      return [...prev, t];
    });
  }, []);

  const changeTypeCount = useCallback((t: ImageGenerationType, delta: number) => {
    const cap = opts.model.capability.maxCount;
    setTypeCounts((prev) => {
      const next = Math.min(Math.max(prev[t] + delta, MIN_TYPE_COUNT), Math.min(cap, MAX_TYPE_COUNT));
      return { ...prev, [t]: next };
    });
  }, [opts.model.capability.maxCount]);

  const requestTemplateChange = useCallback((name: string) => {
    if (name === template) { setTemplatePickerOpen(false); return; }
    if (promptHasEdits) {
      setPendingTemplate(name);
      setTemplateOverwriteOpen(true);
      return;
    }
    setTemplateName(name);
    setTemplatePickerOpen(false);
  }, [template, promptHasEdits]);

  const applyTemplate = useCallback((name: string) => {
    setTemplateName(name);
    setPromptOverrides({});
    setPromptHasEdits(false);
    setTemplatePickerOpen(false);
    setTemplateOverwriteOpen(false);
    setPendingTemplate(null);
  }, []);

  const updateProductFact: UseCreateImageTaskStateReturn['updateProductFact'] = useCallback((key, value) => {
    setFormInput((prev) => ({ ...prev, [key]: value }));
    setProductFacts(null);
  }, []);

  /** 顶层产品卡片/选择产品等渠道:把 6 字段一次灌进来,触发 prompts useMemo 重算 */
  const setFormFactsExternal = useCallback((facts: ProductFactsInput) => {
    setFormInput(facts);
    setProductFacts(extractProductFacts(facts));
  }, []);

  const setPromptOverride = useCallback((t: ImageGenerationType, v: string) => {
    setPromptOverrides((prev) => ({ ...prev, [t]: v }));
    setPromptHasEdits(true);
  }, []);

  /**
   * [2026-07-26] 前端 ReferenceSlot -> 后端 ImagePlanReferenceSlot 映射。
   * 前端 5 个 slot(detail/style/scene/pose/model) -> 后端 5 个槽位(全大写 + _REF 后缀)。
   */
  const mapSlotToBackend = (slot: ReferenceSlot): 'STYLE_REF' | 'SCENE_REF' | 'POSE_REF' | 'MODEL_REF' | 'DETAIL_REF' => {
    switch (slot) {
      case 'style':  return 'STYLE_REF';
      case 'scene':  return 'SCENE_REF';
      case 'pose':   return 'POSE_REF';
      case 'model':  return 'MODEL_REF';
      case 'detail': return 'DETAIL_REF';
      default:       return 'STYLE_REF';
    }
  };

  /**
   * [2026-07-26] 后端 AI 助手失败时的本地降级:
   * 用 buildPromptFromFacts 拼 4 类 prompt,语义跟 imagePlanServiceImpl.buildFallbackPrompt 一致。
   */
  const fallbackToLocalPrompts = (facts: ProductFacts) => {
    const nextOverrides: Partial<Record<ImageGenerationType, string>> = {};
    selectedTypes.forEach((t) => {
      nextOverrides[t] = buildPromptFromFacts(t, facts, style, scene, pose, orderedReferenceSlots);
    });
    setPromptOverrides(nextOverrides);
    setPromptHasEdits(true);
    setAssistantState('complete');
  };

  const runAssistantAnalysis = useCallback(async () => {
    if (!opts.isProductBound) return;

    // 主图 URL 兜底:opts.mainImage 暴露 originalUrl,无 URL 时退回本地拼
    const mainImageUrl = opts.mainImage?.originalUrl ?? '';
    if (!opts.mainAssetId || !mainImageUrl) {
      setAssistantFallback(true);
      const facts = extractProductFacts(formInput);
      setProductFacts(facts);
      fallbackToLocalPrompts(facts);
      opts.onAiComplete?.(formInput);
      toast.warning('后端 AI 助手暂不可用,已使用本地建议');
      return;
    }
    if (assistantState === 'processing') return;
    setAssistantState('processing');
    setAssistantFallback(false);

    // 5 分钟超时兜底(防御真实 AI 接口卡死)
    let timedOut = false;
    const guardTimeout = window.setTimeout(() => {
      timedOut = true;
      setAssistantState('idle');
      toast.error(messages.assistant.timeout);
    }, 300_000);

    // 优先调后端 imagePlanApi.analyze(2026-07-26 新增)
    let remoteSuccess = false;
    try {
      // dynamic import 避免 module-level 加载 http 客户端(测试环境无 jsdom)
      const { imagePlanApi } = await import('../api/modules/imagePlan');
      const resp = await imagePlanApi.analyze({
        mainImageUrl,
        referenceAssets: orderedRefs
          .map((r) => r.ref)
          .filter((ref): ref is { id?: string; fileResourceId?: string; originalUrl?: string } => !!ref)
          .filter((ref) => !!ref.originalUrl)
          .map((ref) => ({
            assetId: String(ref.id ?? ref.fileResourceId ?? ''),
            url: ref.originalUrl!,
            slotRole: mapSlotToBackend(
              // 通过 orderedRefs 找到对应 slot
              orderedRefs.find((r) => r.ref === ref)!.slot,
            ),
          })),
        style,
        scene,
        pose,
      });
      if (timedOut) return;
      window.clearTimeout(guardTimeout);

      // 回填
      const analyzedFacts = normalizeAnalyzedProductFacts(resp.productFacts);
      const extractedFacts = extractProductFacts(analyzedFacts);
      setFormInput(analyzedFacts);
      setProductFacts(extractedFacts);
      // 后端负责识别商品事实；最终 Prompt 统一由前端 Profile 编译器生成，
      // 避免模型自由输出改变区块结构、参考图编号或保真约束。
      const nextOverrides: Partial<Record<ImageGenerationType, string>> = {};
      (['product_main', 'scene_detail', 'detail_closeup', 'model_triple_view'] as ImageGenerationType[])
        .forEach((t) => {
          nextOverrides[t] = buildPromptFromFacts(
            t, extractedFacts, style, scene, pose, orderedReferenceSlots,
          );
        });
      setPromptOverrides(nextOverrides);
      setNegativePrompt(resp.negativePrompt);
      setPromptHasEdits(true);
      setAssistantState('complete');
      opts.onAiComplete?.(analyzedFacts);
      toast.success(messages.assistant.complete);
      remoteSuccess = true;
    } catch (err) {
      // 降级到本地拼 prompt
      if (timedOut) return;
      window.clearTimeout(guardTimeout);
      console.warn('[imagePlan] analyze failed, fallback to buildPromptFromFacts', err);
      setAssistantFallback(true);
      const facts = extractProductFacts(formInput);
      setProductFacts(facts);
      fallbackToLocalPrompts(facts);
      opts.onAiComplete?.(formInput);
      toast.warning('后端 AI 助手暂不可用,已使用本地建议');
    }
  }, [
    opts.isProductBound, opts.mainAssetId, opts.mainImage, opts.onAiComplete,
    assistantState, formInput, selectedTypes, style, scene, pose, orderedReferenceSlots,
  ]);

  const regeneratePrompts = useCallback(() => {
    setPromptOverrides({});
    setPromptHasEdits(false);
    if (opts.isProductBound && formInput.name.trim()) {
      setProductFacts(extractProductFacts(formInput));
    }
  }, [opts.isProductBound, formInput]);

  const applyAiOptimizeToSelected = useCallback((selected: ImageGenerationType[]) => {
    const facts = productFacts ?? extractProductFacts(formInput);
    const basePrompts: AllTypePrompts = { product_main: '', scene_detail: '', detail_closeup: '', model_triple_view: '' };
    (['product_main', 'scene_detail', 'detail_closeup', 'model_triple_view'] as ImageGenerationType[]).forEach((t) => {
      basePrompts[t] = buildPromptFromFacts(t, facts, style, scene, pose, orderedReferenceSlots);
    });
    const optimized = applyAiOptimizePerType(basePrompts, selected);
    setPromptOverrides((prev) => {
      const next = { ...prev };
      selected.forEach((t) => { next[t] = optimized[t]; });
      return next;
    });
    setPromptHasEdits(true);
  }, [productFacts, formInput, style, scene, pose, orderedReferenceSlots]);

  const checkAndGenerate = useCallback(() => {
    const issue = readinessChecks.find((c) => !c.complete);
    if (issue) {
      setReadinessIssue(issue.message);
      toast.error(issue.message);
      window.requestAnimationFrame(() => {
        document.getElementById(issue.targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }
    setReadinessIssue('');
    setExecutionConfirmOpen(true);
  }, [readinessChecks]);

  const submitTasks = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // ==================== [2026-07-24 Task 13] 真实后端提交 ====================
      // 拼 assets[]:MAIN(主图,从 opts.mainImage 取)
      //              + 5 个参考图 slot(没选的不发,避免后端收到空 assetId 报错)
      const assets: TaskAssetRef[] = [];

      // 工具:从 ref 对象中提取有效 assetId(后端要的是 asset_resource.id,不是 file_resource.id)
      // - 优先 id:AssetResourceItem.id 即 asset_resource.id(后端任务-资源关联表的 asset_id)
      // - 兜底 fileResourceId:仅在 id 缺失时用
      // - 必须 String() 兜底:历史遗留 ref 可能是 number(雪花 ID 19 位超 number 安全范围)
      const extractAssetId = (ref: { id?: string | number; fileResourceId?: string | number } | undefined | null): string => {
        if (!ref) return '';
        const raw = ref.id ?? ref.fileResourceId;
        if (raw == null || raw === '') return '';
        return String(raw);
      };

      const mainAssetId = extractAssetId(opts.mainImage);
      if (mainAssetId) {
        assets.push({
          assetId: mainAssetId,
          slotRole: 'MAIN',
          sortOrder: 0,
          originalUrl: opts.mainImage?.originalUrl ?? '',
          thumbnailUrl: opts.mainImage?.thumbnailUrl,
          name: opts.mainImage?.name,
        });
      }

      (['detail', 'style', 'scene', 'pose', 'model'] as ReferenceSlot[]).forEach((slot) => {
        const ref = references[slot] as
          | { fileResourceId?: string | number; id?: string | number; originalUrl?: string; thumbnailUrl?: string; name?: string }
          | undefined;
        const refAssetId = extractAssetId(ref);
        if (refAssetId) {
          assets.push({
            assetId: refAssetId,
            slotRole: REFERENCE_SLOT_MAP[slot],
            sortOrder: referenceOrder[slot] ?? 0,
            originalUrl: ref?.originalUrl ?? '',
            thumbnailUrl: ref?.thumbnailUrl,
            name: ref?.name,
          });
        }
      });

      // 拼 imageTypes[]:每种 imageType 配 prompt/negativePrompt/count
      const imageTypes: ImageTypeEntry[] = selectedTypes.map((t) => ({
        imageType: mapImageGenerationType(t),
        prompt: promptOverrides[t] ?? prompts[t] ?? '',
        negativePrompt,
        count: typeCounts[t] ?? 1,
      }));

      // 拼 payload
      // 注:本地 state productFacts 是 ProductFacts(extractProductFacts 输出),
      //     而 payload.productFacts 要求 ProductFactsInput(含 colorPattern)。
      //     这里用 formInput(ProductFactsInput,始终含 colorPattern 6 字段)传入。
      // productId 处理:仅当是合法数字字符串(雪花 ID 形式)时发送,否则 null(后端走新建路径)
      // opts.productId 是从 ProductPickerModal 选中的 ProductDTO.id(后端雪花 ID 字符串)
      const productIdRaw = opts.productId;
      const productIdValid = typeof productIdRaw === 'string'
          && /^\d+$/.test(productIdRaw);
      const payload: ImageTaskSubmitPayload = {
        groupId: crypto.randomUUID(),
        productId: productIdValid ? productIdRaw : null,
        productFacts: formInput,
        style: style || undefined,
        scene: scene || undefined,
        action: pose || undefined,
        channelInstanceId: opts.channel.id,
        capability: (opts.capability ?? 'REF_IMG_EDIT') as 'REF_IMG_EDIT',
        channelType: (opts.channelType ?? 'VIDU') as 'VIDU',
        modelCode: opts.model?.id ?? null,
        executionSelectionSource: opts.executionSelectionSource ?? 'USER',
        // [2026-07-25 P0 修复] taskParamsJson 直接透传 ParamSchemaForm 收集的 schemaParams
        // (字段名 aspect_ratio / resolution 对齐 ViduCapabilities schema),后端 GenerationTaskServiceImpl
        // 用 schema 字段名解析、ChannelParamBinder 按 targetField 映射到 Vidu body。
        // 之前前端做 mapResolutionToVidu 单位转换 + ratio: '16:9' 写死是把供应商映射提前做,链路断裂。
        taskParamsJson: JSON.stringify(opts.schemaParams ?? {}),
        sourceCreationTemplateId: opts.sourceCreationTemplateId ?? undefined,
        sourceCreationTemplateVersionId: opts.sourceCreationTemplateVersionId ?? undefined,
        imageTypes,
        assets,
      };

      // 提交到后端
      const resp = await taskApi.submitImageTask(payload);

      // 跳转:通知 App 高亮本次提交的 group,并切到任务列表。
      opts.onAddTask?.({ groupId: resp.groupId, taskIds: resp.taskIds, taskKind: 'IMAGE' });
      opts.setScreen(AppScreen.TASKS, { highlightGroupId: resp.groupId });

      setExecutionConfirmOpen(false);
    } catch {
      // 请求层已经直接展示服务端返回的 errMessage，这里只终止提交流程，避免重复提示。
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isSubmitting, opts, references, referenceOrder, selectedTypes, promptOverrides,
    prompts, negativePrompt, formInput, style, scene, pose, setExecutionConfirmOpen,
  ]);

  const selectReference = useCallback((slot: ReferenceSlot, ref: any | undefined) => {
    setReferences((prev) => ({ ...prev, [slot]: ref }));
    setReferenceOrder((prev) => {
      // 计算新的"已选"集合:把当前 slot 替换后加上/去掉
      const nextSelected: Set<ReferenceSlot> = new Set(
        Object.entries(prev).filter(([_, v]) => v !== undefined).map(([k]) => k as ReferenceSlot),
      );
      if (ref === undefined) nextSelected.delete(slot);
      else nextSelected.add(slot);
      // 已有 order 的 slot 保留;新选 slot 用 assignNextOrder 补齐
      return assignNextOrder(prev, nextSelected);
    });
  }, []);

  const updateReferenceOrder = useCallback((slot: ReferenceSlot, order: number) => {
    setReferenceOrder((prev) => ({ ...prev, [slot]: order }));
  }, []);

  /**
   * 把已选参考图从位置 fromIndex 移到 toIndex,触发后顺序自动重新连续编号 1..N,
   * 且已选 slot 永远紧凑排在前面(用纯函数 referenceOrder.ts 实现)。
   */
  const moveReference = useCallback((fromSlot: ReferenceSlot, toIndex: number) => {
    setReferenceOrder((prev) => {
      const selected: Set<ReferenceSlot> = new Set(
        Object.entries(prev).filter(([_, v]) => v !== undefined).map(([k]) => k as ReferenceSlot),
      );
      return moveReferenceInOrder(prev, selected, fromSlot, toIndex);
    });
  }, []);

  /**
   * 把所有已选 slot 的顺序重排为连续 1..N(用于外部数据清理或兜底)。
   */
  const compactReferenceOrderFn = useCallback(() => {
    setReferenceOrder((prev) => {
      const selected: Set<ReferenceSlot> = new Set(
        Object.entries(prev).filter(([_, v]) => v !== undefined).map(([k]) => k as ReferenceSlot),
      );
      return compactReferenceOrder(prev, selected);
    });
  }, []);

  return {
    selectedTypes,
    typeCounts,
    template,
    style,
    scene,
    pose,
    negativePrompt,
    promptOverrides,
    promptHasEdits,
    assistantState,
    reviewEnabled,
    references,
    orderedReferenceInsights,
    referenceOrder,
    compositeState,
    readinessIssue,
    pendingChoice,
    conflictOpen,
    templatePickerOpen,
    pendingTemplate,
    templateOverwriteOpen,
    executionConfirmOpen,
    isSubmitting,
    readinessChecks,
    readinessCount,
    prompts,
    promptsComplete,
    isSupported,
    totalCount,
    toggleType,
    changeTypeCount,
    setTemplate: setTemplateName,
    requestTemplateChange,
    applyTemplate,
    setStyle,
    setScene,
    setPose,
    setNegativePrompt,
    updateProductFact,
    setFormFactsExternal,
    setPromptOverride,
    runAssistantAnalysis,
    regeneratePrompts,
    applyAiOptimizeToSelected,
    setReviewEnabled,
    selectReference,
    updateReferenceOrder,
    moveReference,
    compactReferenceOrder: compactReferenceOrderFn,
    orderedRefs,
    assistantFallback,
    checkAndGenerate,
    submitTasks,
    setConflictOpen,
    setTemplateOverwriteOpen,
    setExecutionConfirmOpen,
  };
}
