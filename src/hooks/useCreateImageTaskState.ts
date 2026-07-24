// src/hooks/useCreateImageTaskState.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { AppScreen } from '../types';
import type {
  ProductAsset,
  ImageTypeEntry, TaskAssetRef, ImageTaskSubmitPayload, ImageTaskType, TaskAssetSlot,
} from '../types';
import type { ImageGenerationType, ReadinessCheck } from '../lib/createImageTask/readinessChecks';
import type { ReferenceSlot } from '../lib/createImageTask/extractReferenceInsights';
import { computeReadinessChecks } from '../lib/createImageTask/readinessChecks';
import { extractProductFacts, type ProductFactsInput } from '../lib/createImageTask/extractProductFacts';
import { buildPromptFromFacts } from '../lib/createImageTask/buildPromptFromFacts';
import { extractReferenceInsights } from '../lib/createImageTask/extractReferenceInsights';
import { applyAiOptimizePerType, type AllTypePrompts } from '../lib/createImageTask/applyAiOptimizePerType';
import { buildGenerationTask } from '../lib/createImageTask/buildGenerationTask';
import { compactReferenceOrder, moveReferenceInOrder, assignNextOrder, REFERENCE_SLOTS } from '../lib/createImageTask/referenceOrder';
import type { ProductAiAnalyzeResponse } from '../api/modules/productInfo';
import { taskApi } from '../api/modules/task';
import { messages } from '../labels/createImageTask';

// 与 referencesConfig 保持同步的 5 个参考图 slot 名。
// 重新声明一份以避免 export-re-export 在 Vite HMR 下偶发的 TDZ
// (ReferenceError: ... is not defined) — 直接定义比 re-export 稳定。
const REFERENCE_SLOTS_INTERNAL: readonly ReferenceSlot[] = REFERENCE_SLOTS;

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
 * 前端 UI 的小写 imageType(product_main / scene_detail / detail_closeup / on_model)
 * → 后端 EnumImageTaskType 大写枚举值。
 */
function mapImageGenerationType(t: string): ImageTaskType {
  switch (t) {
    case 'product_main': return 'PRODUCT_MAIN';
    case 'scene_detail': return 'SCENE_DETAIL';
    case 'detail_closeup': return 'DETAIL_CLOSEUP';
    case 'on_model': return 'ON_MODEL';
    default:
      throw new Error(`unknown image type: ${t}`);
  }
}

/**
 * 解析度映射:Vidu 能力 schema(ViduCapabilities.REF_IMG_EDIT 字段定义)
 * 接受 1080p / 2k / 4k 三种值。前端 UI 的内部表示是像素值(1080px / 1536px / 2048px),
 * 提交到后端前必须转成 Vidu 接受的格式,否则 Vidu 报 invalid field: resolution。
 * 找不到匹配时安全 fallback 到 '1080p'。
 */
function mapResolutionToVidu(r: string): '1080p' | '2k' | '4k' {
  const lower = (r ?? '').toLowerCase().replace(/p$/, '').replace(/x$/, '');
  // 数字像素 → Vidu 等级
  const pxMatch = lower.match(/(\d+)/);
  if (pxMatch) {
    const px = parseInt(pxMatch[1], 10);
    if (px >= 2160) return '4k';
    if (px >= 1440) return '2k';
    return '1080p';
  }
  // 已是 Vidu 格式
  if (lower === '1080' || lower === '1080p') return '1080p';
  if (lower === '2k' || lower === '2kp') return '2k';
  if (lower === '4k' || lower === '4kp') return '4k';
  return '1080p';
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
  model: { id: string; name: string; capability: { ratios: string[]; maxCount: number; resolutions: string[] } };
  ratio: string;
  resolution: string;
  templateName: string;
  toSubmit: () => Promise<string>;
  onAddTask: (info: { groupId: string; taskIds: string[] }) => void;
  /**
   * 切换 AppScreen 的 setter。
   * [2026-07-24 Task 13] 第二个 payload 参数供 Task 14 实现"高亮 groupId"用;
   * App.tsx 暂时忽略,只取第 1 个 screen 字段。少参签名对此处兼容(TS 函数参数双变性)。
   */
  setScreen: (screen: AppScreen, payload?: { highlightGroupId?: string }) => void;
  onRatioChange?: (v: string) => void;
  onResolutionChange?: (v: string) => void;
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
  factsConfirmed: boolean;
  promptsConfirmed: boolean;
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
  ratio: string;
  resolution: string;
  // computed
  readinessChecks: ReadinessCheck[];
  readinessCount: number;
  prompts: Record<ImageGenerationType, string>;
  promptsComplete: boolean;
  factsComplete: boolean;
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
  confirmFacts(): void;
  setFactsConfirmed(v: boolean): void;
  // 顶层灌入"产品事实"路径(被选产品等):同步 hook 内部 formInput 让 prompts 重算
  setFormFactsExternal(facts: ProductFactsInput): void;
  setPromptOverride(t: ImageGenerationType, v: string): void;
  confirmPrompts(): void;
  markPromptsDirty(): void;
  runAssistantAnalysis(): Promise<void>;
  regeneratePrompts(): void;
  applyAiOptimizeToSelected(selected: ImageGenerationType[]): void;
  applyPreset(preset: { name: string; ratio: string; resolution: string }): void;
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
  setRatio(v: string): void;
  setResolution(v: string): void;
  // autosave wiring
  hydrated: boolean;
}

const DRAFT_KEY = 'create-image-task-draft-v2';
const DRAFT_THROTTLE_MS = 800;
const MIN_TYPE_COUNT = 1;
const MAX_TYPE_COUNT = 5;

/** Shape of what is persisted to sessionStorage (subset of state) */
interface PersistedDraft {
  selectedTypes?: ImageGenerationType[];
  typeCounts?: Record<ImageGenerationType, number>;
  template?: string;
  style?: string;
  scene?: string;
  pose?: string;
  negativePrompt?: string;
  reviewEnabled?: boolean;
  formInput?: ProductFactsInput;
}

export function useCreateImageTaskState(
  opts: UseCreateImageTaskStateOpts,
): UseCreateImageTaskStateReturn {
  // ---------- state ----------
  const [selectedTypes, setSelectedTypes] = useState<ImageGenerationType[]>(['product_main']);
  const [typeCounts, setTypeCounts] = useState<Record<ImageGenerationType, number>>({
    product_main: 1, scene_detail: 1, detail_closeup: 1, on_model: 1,
  });
  const [template, setTemplateName] = useState<string>(opts.templateName);
  const [style, setStyle] = useState<string>(messages.styleOptions[0]);
  const [scene, setScene] = useState<string>(messages.sceneOptions[0]);
  const [pose, setPose] = useState<string>(messages.poseOptions[0]);
  const [negativePrompt, setNegativePrompt] = useState<string>('blurry, bad quality, distorted');
  const [promptOverrides, setPromptOverrides] = useState<Partial<Record<ImageGenerationType, string>>>({});
  const [promptHasEdits, setPromptHasEdits] = useState<boolean>(false);
  const [factsConfirmed, setFactsConfirmed] = useState<boolean>(false);
  const [promptsConfirmed, setPromptsConfirmed] = useState<boolean>(false);
  const [assistantState, setAssistantState] = useState<'idle' | 'processing' | 'complete'>('idle');
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
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [productFacts, setProductFacts] = useState<ReturnType<typeof extractProductFacts> | null>(null);
  const [ratio, setRatio] = useState<string>(opts.ratio);
  const [resolution, setResolution] = useState<string>(opts.resolution);

  const [formInput, setFormInput] = useState<ProductFactsInput>({
    name: '', sellingPoints: '', productCategory: '',
    colorPattern: '', fabricTexture: '', fitStructure: '',
  });

  // ---------- hydrate from sessionStorage ----------
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const data = JSON.parse(raw) as PersistedDraft;
        if (data.selectedTypes) setSelectedTypes(data.selectedTypes);
        if (data.typeCounts) setTypeCounts(data.typeCounts as Record<ImageGenerationType, number>);
        if (data.template) setTemplateName(data.template);
        if (data.style) setStyle(data.style);
        if (data.scene) setScene(data.scene);
        if (data.pose) setPose(data.pose);
        if (data.negativePrompt) setNegativePrompt(data.negativePrompt);
        if (typeof data.reviewEnabled === 'boolean') setReviewEnabled(data.reviewEnabled);
        if (data.formInput) setFormInput(data.formInput);
      }
      setHydrated(true);
      if (raw) toast.success('已恢复上次编辑');
    } catch {
      sessionStorage.removeItem(DRAFT_KEY);
      toast.error('已清除无法识别的草稿');
      setHydrated(true);
    }
  }, []);

  // ---------- autosave throttle ----------
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
          selectedTypes, typeCounts, template, style, scene, pose,
          negativePrompt, reviewEnabled, formInput,
        }));
      } catch { /* quota */ }
    }, DRAFT_THROTTLE_MS);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [hydrated, selectedTypes, typeCounts, template, style, scene, pose, negativePrompt, reviewEnabled, formInput, ratio, resolution]);

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

  const prompts = useMemo<AllTypePrompts>(() => {
    const facts = productFacts ?? extractProductFacts(formInput);
    const result: AllTypePrompts = { product_main: '', scene_detail: '', detail_closeup: '', on_model: '' };
    (['product_main', 'scene_detail', 'detail_closeup', 'on_model'] as ImageGenerationType[]).forEach((t) => {
      result[t] = buildPromptFromFacts(t, facts, style, scene, pose, orderedReferenceInsights);
    });
    return result;
  }, [productFacts, formInput, style, scene, pose, orderedReferenceInsights]);

  // prompts 变化 → 视为编辑,reset 确认态
  useEffect(() => {
    setPromptsConfirmed(false);
  }, [prompts]);

  const promptsComplete = useMemo(() => {
    if (selectedTypes.length === 0) return false;
    return selectedTypes.every((t) => (promptOverrides[t] ?? prompts[t]).trim().length > 0);
  }, [selectedTypes, promptOverrides, prompts]);

  const factsComplete = useMemo(
    () => formInput.name.trim().length > 0,
    [formInput],
  );

  const isSupported = useMemo(() => {
    // 之前对照写死的 model.capability.ratios/resolutions 判定,但写死值与真实 Vidu schema
    // 不一致(写死 resolutions=['1024px','1536px','2048px'],Vidu 实际只接受 1080p/2k/4k),
    // 永远 false → readiness 报"不支持"假阳性。本期页面没有 ratio/resolution UI 选择,
    // 直接信任 Vidu 能力 schema 默认值(由 useTaskParams 装载,父组件传 ratio=16:9 + resolution=1080p)。
    // 唯一继续校验:每 imageType 的张数不超过模型 maxCount。
    const cm = opts.model.capability;
    return !selectedTypes.some((t) => typeCounts[t] > Math.min(cm.maxCount, MAX_TYPE_COUNT));
  }, [opts.model.capability, selectedTypes, typeCounts]);

  const totalCount = useMemo(
    () => selectedTypes.reduce((sum, t) => sum + typeCounts[t], 0),
    [selectedTypes, typeCounts],
  );

  const readinessDeps = useMemo(() => ({
    isProductBound: opts.isProductBound,
    factsConfirmed,
    factsComplete,
    promptsConfirmed,
    promptsComplete,
    isSupported,
    channelMaintenance: opts.channel.health === 'maintenance',
  }), [opts.isProductBound, factsConfirmed, factsComplete, promptsConfirmed, promptsComplete, isSupported, opts.channel.health]);

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
    setPromptsConfirmed(false);
  }, []);

  const changeTypeCount = useCallback((t: ImageGenerationType, delta: number) => {
    const cap = opts.model.capability.maxCount;
    setTypeCounts((prev) => {
      const next = Math.min(Math.max(prev[t] + delta, MIN_TYPE_COUNT), Math.min(cap, MAX_TYPE_COUNT));
      return { ...prev, [t]: next };
    });
    setPromptsConfirmed(false);
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
    setPromptsConfirmed(false);
  }, []);

  const updateProductFact: UseCreateImageTaskStateReturn['updateProductFact'] = useCallback((key, value) => {
    setFormInput((prev) => ({ ...prev, [key]: value }));
    setFactsConfirmed(false);
    setProductFacts(null);
  }, []);

  /** 顶层产品卡片/选择产品等渠道:把 6 字段一次灌进来,触发 prompts useMemo 重算 */
  const setFormFactsExternal = useCallback((facts: ProductFactsInput) => {
    setFormInput(facts);
    setProductFacts(extractProductFacts(facts));
    setFactsConfirmed(false);
  }, []);

  const setFactsConfirmedExposed = useCallback((v: boolean) => {
    setFactsConfirmed(v);
  }, []);

  const confirmFacts = useCallback(() => {
    if (!opts.isProductBound) return;
    setFactsConfirmed(true);
    if (!productFacts) setProductFacts(extractProductFacts(formInput));
    setReadinessIssue('');
  }, [opts.isProductBound, productFacts, formInput]);

  const setPromptOverride = useCallback((t: ImageGenerationType, v: string) => {
    setPromptOverrides((prev) => ({ ...prev, [t]: v }));
    setPromptHasEdits(true);
    setPromptsConfirmed(false);
  }, []);

  const confirmPrompts = useCallback(() => {
    if (!factsConfirmed || !promptsComplete) return;
    setPromptsConfirmed(true);
    setReadinessIssue('');
  }, [factsConfirmed, promptsComplete]);

  const markPromptsDirty = useCallback(() => {
    setPromptsConfirmed(false);
  }, []);

  const runAssistantAnalysis = useCallback(async () => {
    if (!opts.isProductBound) return;
    if (!opts.mainAssetId) {
      // 退化:无 asset_id 时(理论上不应发生,因为 isProductBound=true)用当前 formInput 作为 fallback
      const facts = extractProductFacts(formInput);
      setProductFacts(facts);
      const nextOverrides: Partial<Record<ImageGenerationType, string>> = {};
      selectedTypes.forEach((t) => {
        nextOverrides[t] = buildPromptFromFacts(t, facts, style, scene, pose, orderedReferenceInsights);
      });
      setPromptOverrides(nextOverrides);
      setFactsConfirmed(true);
      setPromptHasEdits(true);
      setPromptsConfirmed(false);
      setAssistantState('complete');
      return;
    }
    if (assistantState === 'processing') return;
    setAssistantState('processing');

    // 5 分钟超时兜底(防御真实 AI 接口卡死)
    let timedOut = false;
    const guardTimeout = window.setTimeout(() => {
      timedOut = true;
      setAssistantState('idle');
      toast.error(messages.assistant.timeout);
    }, 300_000);

    try {
      // dynamic import 避免 module-level 加载 http 客户端(测试环境无 jsdom)
      const { productInfoApi } = await import('../api/modules/productInfo');
      const resp: ProductAiAnalyzeResponse = await productInfoApi.aiAnalyze({
        // 后端 ProductServiceImpl.aiAnalyze(imageId) → assetResourceService.getById(imageId),
        // 要求 asset_resource.id,不是 file_resource.id。
        imageId: String(opts.mainAssetId),
      });
      if (timedOut) return;
      window.clearTimeout(guardTimeout);

      // 把后端 6 字段映射回 ProductFactsInput(field name 对齐)
      // 后端 camelCase 与前端 ProductFactsInput 一致(name / sellingPoints / color / patternMaterial / silhouetteStructure / category)
      // 同时也接受旧字段 fabricTexture / keyDetails 的友好兜底
      const nextInput: ProductFactsInput = {
        name: (resp.name ?? formInput.name).trim(),
        sellingPoints: (resp.sellingPoints ?? formInput.sellingPoints).trim(),
        productCategory: (resp.category ?? formInput.productCategory).trim(),
        colorPattern: (resp.color ?? formInput.colorPattern).trim(),
        fabricTexture: (resp.fabricTexture ?? resp.patternMaterial ?? formInput.fabricTexture).trim(),
        fitStructure: (resp.silhouetteStructure ?? resp.keyDetails ?? formInput.fitStructure).trim(),
      };
      setFormInput(nextInput);
      const facts = extractProductFacts(nextInput);
      setProductFacts(facts);
      const nextOverrides: Partial<Record<ImageGenerationType, string>> = {};
      selectedTypes.forEach((t) => {
        nextOverrides[t] = buildPromptFromFacts(t, facts, style, scene, pose, orderedReferenceInsights);
      });
      setPromptOverrides(nextOverrides);
      setFactsConfirmed(true);
      setPromptHasEdits(true);
      setPromptsConfirmed(false);
      setAssistantState('complete');
      // 回写到顶层 UI state(让 ProductFactsEditor 6 字段 input 刷新)
      opts.onAiComplete?.(nextInput);
      toast.success(messages.assistant.complete);
    } catch {
      // 失败:错误 toast 已在 http 拦截器出,这里只回退到 idle 态
      window.clearTimeout(guardTimeout);
      setAssistantState('idle');
    }
  }, [opts.isProductBound, opts.mainAssetId, opts.onAiComplete, assistantState, formInput, selectedTypes, style, scene, pose, orderedReferenceInsights]);

  const applyPreset = useCallback((preset: { name: string; ratio: string; resolution: string }) => {
    setRatio(preset.ratio);
    setResolution(preset.resolution);
    opts.onRatioChange?.(preset.ratio);
    opts.onResolutionChange?.(preset.resolution);
  }, [opts.onRatioChange, opts.onResolutionChange]);

  const regeneratePrompts = useCallback(() => {
    setPromptOverrides({});
    setPromptHasEdits(false);
    setPromptsConfirmed(false);
    if (opts.isProductBound && formInput.name.trim()) {
      setProductFacts(extractProductFacts(formInput));
    }
  }, [opts.isProductBound, formInput]);

  const applyAiOptimizeToSelected = useCallback((selected: ImageGenerationType[]) => {
    const facts = productFacts ?? extractProductFacts(formInput);
    const basePrompts: AllTypePrompts = { product_main: '', scene_detail: '', detail_closeup: '', on_model: '' };
    (['product_main', 'scene_detail', 'detail_closeup', 'on_model'] as ImageGenerationType[]).forEach((t) => {
      basePrompts[t] = buildPromptFromFacts(t, facts, style, scene, pose, orderedReferenceInsights);
    });
    const optimized = applyAiOptimizePerType(basePrompts, selected);
    setPromptOverrides((prev) => {
      const next = { ...prev };
      selected.forEach((t) => { next[t] = optimized[t]; });
      return next;
    });
    setPromptHasEdits(true);
    setPromptsConfirmed(false);
  }, [productFacts, formInput, style, scene, pose, orderedReferenceInsights]);

  const checkAndGenerate = useCallback(() => {
    const issue = readinessChecks.find((c) => !c.complete);
    if (issue) {
      setReadinessIssue(issue.message);
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
        prompt: promptOverrides[t] ?? prompts[t],
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
        channelInstanceId: opts.channel.id,
        capability: 'REF_IMG_EDIT',
        channelType: 'VIDU',
        modelId: opts.model?.id ?? null,
        taskParamsJson: JSON.stringify({ ratio, resolution: mapResolutionToVidu(resolution) }),
        imageTypes,
        assets,
      };

      // 提交到后端
      const resp = await taskApi.submitImageTask(payload);

      // 跳转:通知 App 高亮本次提交的 group,并切到任务列表。
      opts.onAddTask?.({ groupId: resp.groupId, taskIds: resp.taskIds });
      opts.setScreen(AppScreen.TASKS, { highlightGroupId: resp.groupId });

      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* quota */ }
      setExecutionConfirmOpen(false);
    } catch {
      toast.error('提交失败,请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, opts, references, referenceOrder, selectedTypes, promptOverrides, prompts, negativePrompt, formInput, ratio, resolution, setExecutionConfirmOpen]);

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
    setPromptsConfirmed(false);
  }, []);

  const updateReferenceOrder = useCallback((slot: ReferenceSlot, order: number) => {
    setReferenceOrder((prev) => ({ ...prev, [slot]: order }));
    setPromptsConfirmed(false);
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
    setPromptsConfirmed(false);
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
    factsConfirmed,
    promptsConfirmed,
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
    ratio,
    resolution,
    hydrated,
    readinessChecks,
    readinessCount,
    prompts,
    promptsComplete,
    factsComplete,
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
    setFactsConfirmed: setFactsConfirmedExposed,
    confirmFacts,
    setPromptOverride,
    confirmPrompts,
    markPromptsDirty,
    runAssistantAnalysis,
    regeneratePrompts,
    applyAiOptimizeToSelected,
    applyPreset,
    setReviewEnabled,
    selectReference,
    updateReferenceOrder,
    moveReference,
    compactReferenceOrder: compactReferenceOrderFn,
    orderedRefs,
    checkAndGenerate,
    submitTasks,
    setConflictOpen,
    setTemplateOverwriteOpen,
    setExecutionConfirmOpen,
    setRatio,
    setResolution,
  };
}
