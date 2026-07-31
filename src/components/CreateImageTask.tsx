import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  AppScreen,
  GenerationTask,
  ImageGenerationType,
  IMAGE_GENERATION_TYPE_LABELS,
  ProductAsset,
  ResultTemplate,
  VisualPromptTagOption,
} from '../types';
import { mockImagePromptVisualTags, mockModelChannels, mockReferenceAnalysisByFileId } from '../mockData';
import type { AssetResourceItem } from '../api/modules/asset';
import { ExecutionConfirmDialog } from './ExecutionConfirmDialog';
import { TemplatePickerDrawer } from './TemplatePickerDrawer';

interface CreateImageTaskProps {
  products: ProductAsset[];
  onAddTask: (task: GenerationTask) => void;
  setScreen: (screen: AppScreen) => void;
  openTransit: (onConfirmSelection: (assets: AssetResourceItem[]) => void, targetSlot?: string) => void;
  selectedProduct: ProductAsset;
  setSelectedProduct: (product: ProductAsset) => void;
  templates: ResultTemplate[];
  selectedTemplate: ResultTemplate | null;
  onTemplateApplied: () => void;
}

type ReferenceSlot = 'detail' | 'style' | 'scene' | 'pose' | 'model';
type AssistantState = 'idle' | 'processing' | 'ready' | 'failed';

interface TaskReference {
  id: string;
  role: string;
  name: string;
  thumbnailUrl?: string;
  productAssetId?: string;
}

interface ProductFacts {
  name: string;
  sellingPoints: string;
  category: string;
  color: string;
  materialAndPattern: string;
  structure: string;
}

interface AiPromptSuggestion {
  prompt: string;
  reason: string;
}

interface VisualTagPickerProps {
  label: string;
  value: string;
  options: VisualPromptTagOption[];
  onChange: (value: string) => void;
}

const TYPE_ORDER: ImageGenerationType[] = ['product_main', 'scene_detail', 'detail_closeup', 'on_model'];
const MIN_TYPE_COUNT = 1;
const MAX_TYPE_COUNT = 5;

const REFERENCE_SLOTS: Array<{ id: ReferenceSlot; label: string; role: string; transitSlot: string; icon: string }> = [
  { id: 'model', label: '模特', role: '模特参考', transitSlot: 'reference-model', icon: 'face_3' },
  { id: 'scene', label: '场景', role: '场景参考', transitSlot: 'reference-scene', icon: 'landscape' },
  { id: 'style', label: '风格', role: '风格参考', transitSlot: 'reference-style', icon: 'palette' },
  { id: 'pose', label: '姿势', role: '姿势参考', transitSlot: 'reference-pose', icon: 'accessibility_new' },
  { id: 'detail', label: '细节', role: '细节参考', transitSlot: 'reference-detail', icon: 'zoom_in' },
];

const typeIcon: Record<ImageGenerationType, string> = {
  product_main: 'inventory_2',
  scene_detail: 'landscape',
  detail_closeup: 'zoom_in',
  on_model: 'accessibility_new',
};

const typeCompactLabel: Record<ImageGenerationType, string> = {
  product_main: '主图',
  scene_detail: '场景图',
  detail_closeup: '细节图',
  on_model: '三视图',
};

const taskProfileByType: Record<ImageGenerationType, string> = {
  product_main: 'main_image',
  scene_detail: 'scene_image',
  detail_closeup: 'detail_image',
  on_model: 'tryon_three_view',
};

const EMPTY_PRODUCT_FACTS: ProductFacts = {
  name: '',
  sellingPoints: '',
  category: '',
  color: '',
  materialAndPattern: '',
  structure: '',
};

const createProductFacts = (asset: AssetResourceItem, product: ProductAsset | null): ProductFacts => ({
  name: product?.name ?? asset.name.replace(/\.[^.]+$/, ''),
  sellingPoints: product?.specs.sellingPoints.join('、') ?? asset.tags ?? '待补充',
  category: product?.category ?? '待 AI 识别',
  color: product?.specs.color.join('、') ?? '待 AI 识别',
  materialAndPattern: product?.fabric ?? product?.specs.material ?? '待 AI 识别',
  structure: product?.category === '户外服饰' || product?.category === '服饰家居'
    ? '以主体素材可见版型和剪裁为准'
    : '以主体素材可见结构为准',
});

const buildPrompt = (
  type: ImageGenerationType,
  facts: ProductFacts,
  style: string,
  scene: string,
  pose: string,
  references: Array<TaskReference & { position: number }>,
) => {
  const referenceLine = references.length
    ? `参考图按顺序使用：${references.map((reference) => `${reference.position}.${reference.role}`).join('、')}。`
    : '仅以主体素材为商品依据。';
  const directions: Record<ImageGenerationType, string> = {
    product_main: `为「${facts.name}」生成干净的电商主图。商品完整居中，轮廓和可见材质清晰，${scene}环境保持低干扰；${style}，柔和商业光线与克制阴影。`,
    scene_detail: `为「${facts.name}」生成有使用感的场景图。商品始终是画面中心，${scene}只承担氛围和尺度参照；${style}，自然层次与真实景深。`,
    detail_closeup: `为「${facts.name}」生成可核验的细节图。微距聚焦主体素材可见的材质、纹理或工艺，单一焦点锐利，背景干净虚化；${style}。`,
    on_model: `为「${facts.name}」生成三视图。相同人物、相同光线和机位依次呈现正面、侧面与背面，采用${pose}，不得遮挡商品关键结构；${style}。`,
  };
  const factLine = [facts.category, facts.color, facts.materialAndPattern, facts.structure, facts.sellingPoints]
    .filter((value) => value && value !== '待 AI 识别' && value !== '待补充')
    .join('；');
  return `${directions[type]}\n\n商品事实：${factLine || '以主体素材可见信息为准。'}\n\n${referenceLine}\n\n保持主体素材中可见的颜色、图案、结构和品牌信息，不新增未提供的商品、文字或配饰。避免模糊、商品漂移、错误文字和材质失真。`;
};

const VisualTagPicker: React.FC<VisualTagPickerProps> = ({ label, value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.id === value) ?? options[0];

  useEffect(() => {
    const closeOnOutsidePress = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  if (!selected) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex h-9 items-center gap-2 rounded-full border bg-white py-1 pl-1 pr-2 text-left transition-colors ${open ? 'border-primary ring-2 ring-primary/10' : 'border-slate-200 hover:border-slate-300'}`}
      >
        <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-slate-100">
          <img src={selected.previewImage} alt="" className="h-full w-full object-cover" />
        </span>
        <span className="min-w-0">
          <span className="mr-1 text-[10px] font-bold text-slate-400">{label}</span>
          <span className="text-[11px] font-bold text-slate-700">{selected.label}</span>
        </span>
        <ChevronDown size={14} strokeWidth={2.2} className={`shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-2 max-h-80 w-[280px] overflow-y-auto rounded-md border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10" role="listbox" aria-label={`${label}选项`}>
          {options.map((option) => {
            const active = option.id === value;
            return (
              <button
                type="button"
                key={option.id}
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded p-1.5 text-left transition-colors ${active ? 'bg-primary-light' : 'hover:bg-slate-50'}`}
              >
                <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-slate-100">
                  <img src={option.previewImage} alt="" className="h-full w-full object-cover" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold text-slate-700">{option.label}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-slate-400">{option.description}</span>
                </span>
                {active && <Check size={15} strokeWidth={2.5} className="shrink-0 text-primary" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const CreateImageTask: React.FC<CreateImageTaskProps> = ({
  products,
  onAddTask,
  setScreen,
  openTransit,
  selectedProduct,
  setSelectedProduct,
  templates,
  selectedTemplate,
  onTemplateApplied,
}) => {
  const [selectedTypes, setSelectedTypes] = useState<ImageGenerationType[]>(['product_main']);
  const [typeCounts, setTypeCounts] = useState<Record<ImageGenerationType, number>>({
    product_main: 1,
    scene_detail: 1,
    detail_closeup: 1,
    on_model: 1,
  });
  const [mainAsset, setMainAsset] = useState<TaskReference | null>(null);
  const [references, setReferences] = useState<Partial<Record<ReferenceSlot, TaskReference>>>({});
  const [referenceOrder, setReferenceOrder] = useState<Partial<Record<ReferenceSlot, number>>>({});
  const [productFacts, setProductFacts] = useState<ProductFacts>(EMPTY_PRODUCT_FACTS);
  const [style, setStyle] = useState(mockImagePromptVisualTags.styles[0].id);
  const [scene, setScene] = useState(mockImagePromptVisualTags.styles[0].defaultSceneId);
  const [pose, setPose] = useState(mockImagePromptVisualTags.styles[0].defaultPoseId);
  const [promptOverrides, setPromptOverrides] = useState<Partial<Record<ImageGenerationType, string>>>({});
  const [manualPromptTypes, setManualPromptTypes] = useState<Partial<Record<ImageGenerationType, boolean>>>({});
  const [aiSuggestions, setAiSuggestions] = useState<Partial<Record<ImageGenerationType, AiPromptSuggestion>>>({});
  const [openSuggestions, setOpenSuggestions] = useState<Partial<Record<ImageGenerationType, boolean>>>({});
  const [assistantState, setAssistantState] = useState<AssistantState>('idle');
  const [channelId, setChannelId] = useState('cloud-vision');
  const [modelId, setModelId] = useState('gpt-image-2');
  const [ratio, setRatio] = useState('1:1');
  const [resolution, setResolution] = useState('2048px');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [executionConfirmOpen, setExecutionConfirmOpen] = useState(false);
  const [readinessIssue, setReadinessIssue] = useState('');
  const [factsCopyState, setFactsCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [appliedTemplateName, setAppliedTemplateName] = useState<string | null>(null);

  const channel = mockModelChannels.find((item) => item.id === channelId) ?? mockModelChannels[0];
  const model = channel.models.find((item) => item.id === modelId) ?? channel.models[0];
  const selectedMainProduct = mainAsset?.productAssetId
    ? products.find((product) => product.id === mainAsset.productAssetId) ?? null
    : null;
  const selectedStyle = mockImagePromptVisualTags.styles.find((item) => item.id === style) ?? mockImagePromptVisualTags.styles[0];
  const availableScenes = mockImagePromptVisualTags.scenes.filter((item) => selectedStyle.sceneIds.includes(item.id));
  const availablePoses = mockImagePromptVisualTags.poses.filter((item) => selectedStyle.poseIds.includes(item.id));
  const selectedScene = availableScenes.find((item) => item.id === scene) ?? availableScenes[0];
  const selectedPose = availablePoses.find((item) => item.id === pose) ?? availablePoses[0];
  const subjectName = selectedMainProduct?.name ?? mainAsset?.name ?? '待选择主体素材';
  const totalCount = selectedTypes.reduce((total, type) => total + typeCounts[type], 0);
  const availableModels = useMemo(() => mockModelChannels
    .filter((item) => item.health !== 'maintenance')
    .flatMap((item) => item.models
      .filter((itemModel) => itemModel.mediaTypes.includes('image'))
      .map((itemModel) => ({ channel: item, model: itemModel }))), []);
  const orderedReferences = useMemo(() => Object.entries(references)
    .filter((entry): entry is [ReferenceSlot, TaskReference] => Boolean(entry[1]))
    .sort(([left], [right]) => (referenceOrder[left] ?? 99) - (referenceOrder[right] ?? 99))
    .map(([, reference], index) => ({ ...reference, position: index + 1 })), [referenceOrder, references]);
  const generatedPrompts = useMemo(() => Object.fromEntries(TYPE_ORDER.map((type) => [
    type,
    buildPrompt(type, productFacts, selectedStyle.label, selectedScene.label, selectedPose.label, orderedReferences),
  ])) as Record<ImageGenerationType, string>, [orderedReferences, productFacts, selectedPose.label, selectedScene.label, selectedStyle.label]);
  const promptsComplete = selectedTypes.every((type) => (promptOverrides[type] ?? (assistantState === 'ready' ? generatedPrompts[type] : '')).trim().length > 0);
  const isSupported = model.capability.ratios.includes(ratio)
    && model.capability.resolutions.includes(resolution)
    && selectedTypes.every((type) => typeCounts[type] <= model.capability.maxCount);

  const clearPromptState = () => {
    setPromptOverrides({});
    setManualPromptTypes({});
    setAiSuggestions({});
    setOpenSuggestions({});
    setAssistantState('idle');
    setReadinessIssue('');
  };

  const toTaskReference = (asset: AssetResourceItem, role: string): TaskReference => ({
    id: `asset-${asset.id}`,
    role,
    name: asset.name,
    thumbnailUrl: asset.thumbnailUrl ?? asset.originalUrl,
    productAssetId: asset.productAssetId,
  });

  const selectMainAsset = (assets: AssetResourceItem[]) => {
    const asset = assets[0];
    if (!asset) return;
    const reference = toTaskReference(asset, '主体素材');
    const linkedProduct = reference.productAssetId
      ? products.find((item) => item.id === reference.productAssetId) ?? null
      : null;
    setMainAsset(reference);
    if (linkedProduct) setSelectedProduct(linkedProduct);
    setProductFacts(createProductFacts(asset, linkedProduct));
    clearPromptState();
  };

  const applyTemplate = (template: ResultTemplate) => {
    const snapshot = template.snapshot;
    const imageType = snapshot.imageType ?? 'product_main';
    const allowedReferences = snapshot.references.filter((reference): reference is typeof reference & { role: ReferenceSlot } => REFERENCE_SLOTS.some((slot) => slot.id === reference.role));
    const nextReferences = Object.fromEntries(allowedReferences.map((reference) => [reference.role, {
      id: reference.id, role: REFERENCE_SLOTS.find((slot) => slot.id === reference.role)?.role ?? '参考图', name: reference.name, thumbnailUrl: reference.url,
    }])) as Partial<Record<ReferenceSlot, TaskReference>>;
    const nextOrder = Object.fromEntries(allowedReferences.map((reference, index) => [reference.role, index + 1])) as Partial<Record<ReferenceSlot, number>>;
    setSelectedTypes([imageType]);
    setTypeCounts((current) => ({ ...current, [imageType]: Math.max(MIN_TYPE_COUNT, Math.min(MAX_TYPE_COUNT, snapshot.count ?? 1)) }));
    setRatio(snapshot.ratio);
    setResolution(snapshot.resolution);
    setReferences(nextReferences);
    setReferenceOrder(nextOrder);
    setPromptOverrides({ [imageType]: snapshot.prompt });
    setManualPromptTypes({ [imageType]: false });
    setAiSuggestions({});
    setOpenSuggestions({});
    setAssistantState('ready');
    setAppliedTemplateName(template.name);
    setTemplatePickerOpen(false);
    setReadinessIssue('');
  };

  useEffect(() => {
    if (!selectedTemplate || selectedTemplate.mediaType !== 'image') return;
    applyTemplate(selectedTemplate);
    onTemplateApplied();
  }, [selectedTemplate?.id]);

  const toOrderedReferences = (
    nextReferences: Partial<Record<ReferenceSlot, TaskReference>>,
    nextOrder: Partial<Record<ReferenceSlot, number>>,
  ) => Object.entries(nextReferences)
    .filter((entry): entry is [ReferenceSlot, TaskReference] => Boolean(entry[1]))
    .sort(([left], [right]) => (nextOrder[left] ?? 99) - (nextOrder[right] ?? 99))
    .map(([, reference], index) => ({ ...reference, position: index + 1 }));

  const applyAiPromptUpdate = (candidates: Record<ImageGenerationType, string>, reason: string) => {
    setPromptOverrides((current) => {
      const next = { ...current };
      selectedTypes.forEach((type) => {
        if (!manualPromptTypes[type]) next[type] = candidates[type];
      });
      return next;
    });
    setAiSuggestions((current) => {
      const next = { ...current };
      selectedTypes.forEach((type) => {
        if (manualPromptTypes[type]) next[type] = { prompt: candidates[type], reason };
        else delete next[type];
      });
      return next;
    });
    setAssistantState('ready');
  };

  const normalizeTagSelection = (styleId: string, sceneId: string, poseId: string) => {
    const nextStyle = mockImagePromptVisualTags.styles.find((item) => item.id === styleId) ?? mockImagePromptVisualTags.styles[0];
    return {
      styleId: nextStyle.id,
      sceneId: nextStyle.sceneIds.includes(sceneId) ? sceneId : nextStyle.defaultSceneId,
      poseId: nextStyle.poseIds.includes(poseId) ? poseId : nextStyle.defaultPoseId,
    };
  };

  const getPromptCandidates = (
    facts: ProductFacts,
    nextStyle: string,
    nextScene: string,
    nextPose: string,
    nextReferences: Array<TaskReference & { position: number }>,
  ) => {
    const tags = normalizeTagSelection(nextStyle, nextScene, nextPose);
    const styleOption = mockImagePromptVisualTags.styles.find((item) => item.id === tags.styleId) ?? mockImagePromptVisualTags.styles[0];
    const sceneOption = mockImagePromptVisualTags.scenes.find((item) => item.id === tags.sceneId) ?? mockImagePromptVisualTags.scenes[0];
    const poseOption = mockImagePromptVisualTags.poses.find((item) => item.id === tags.poseId) ?? mockImagePromptVisualTags.poses[0];
    return Object.fromEntries(TYPE_ORDER.map((type) => [
      type,
      buildPrompt(type, facts, styleOption.label, sceneOption.label, poseOption.label, nextReferences),
    ])) as Record<ImageGenerationType, string>;
  };

  const refreshPrompts = () => {
    if (!mainAsset) {
      setReadinessIssue('请先选择主体素材，再生成提示词。');
      return;
    }
    setAssistantState('processing');
    window.setTimeout(() => {
      applyAiPromptUpdate(getPromptCandidates(productFacts, style, scene, pose, orderedReferences), 'AI 助手重新生成');
    }, 500);
  };

  const selectReferenceAsset = (slot: ReferenceSlot) => (assets: AssetResourceItem[]) => {
    const asset = assets[0];
    if (!asset) return;
    const definition = REFERENCE_SLOTS.find((item) => item.id === slot);
    const nextReference = toTaskReference(asset, definition?.role ?? '参考图');
    const analysis = asset.fileResourceId ? mockReferenceAnalysisByFileId[asset.fileResourceId] : undefined;
    const nextReferences = { ...references, [slot]: nextReference };
    const nextOrder = { ...referenceOrder, [slot]: referenceOrder[slot] ?? Object.keys(referenceOrder).length + 1 };
    const nextTags = normalizeTagSelection(analysis?.style ?? style, analysis?.scene ?? scene, analysis?.pose ?? pose);
    setReferences(nextReferences);
    setReferenceOrder(nextOrder);
    setStyle(nextTags.styleId);
    setScene(nextTags.sceneId);
    setPose(nextTags.poseId);
    if (mainAsset) {
      applyAiPromptUpdate(getPromptCandidates(productFacts, nextTags.styleId, nextTags.sceneId, nextTags.poseId, toOrderedReferences(nextReferences, nextOrder)), `${definition?.label ?? '参考'}参考图`);
    }
  };

  const updateTag = (kind: 'style' | 'scene' | 'pose', value: string) => {
    const nextTags = normalizeTagSelection(kind === 'style' ? value : style, kind === 'scene' ? value : scene, kind === 'pose' ? value : pose);
    setStyle(nextTags.styleId);
    setScene(nextTags.sceneId);
    setPose(nextTags.poseId);
    if (!mainAsset) return;
    applyAiPromptUpdate(getPromptCandidates(productFacts, nextTags.styleId, nextTags.sceneId, nextTags.poseId, orderedReferences), `${kind === 'style' ? '风格' : kind === 'scene' ? '场景' : '姿势'}标签`);
  };

  const removeReference = (slot: ReferenceSlot) => {
    const nextReferences = { ...references };
    delete nextReferences[slot];
    const nextOrder = Object.fromEntries(Object.entries(referenceOrder)
      .filter(([key]) => key !== slot)
      .map(([key], index) => [key, index + 1])) as Partial<Record<ReferenceSlot, number>>;
    setReferences(nextReferences);
    setReferenceOrder(nextOrder);
    if (mainAsset) {
      applyAiPromptUpdate(getPromptCandidates(productFacts, style, scene, pose, toOrderedReferences(nextReferences, nextOrder)), `${slot === 'model' ? '模特' : REFERENCE_SLOTS.find((item) => item.id === slot)?.label ?? '参考'}参考图`);
    }
  };

  const toggleType = (type: ImageGenerationType) => {
    if (selectedTypes.includes(type)) {
      if (selectedTypes.length === 1) return;
      const nextTypes = selectedTypes.filter((item) => item !== type);
      setSelectedTypes(nextTypes);
      setPromptOverrides((current) => {
        const next = { ...current };
        delete next[type];
        return next;
      });
      setManualPromptTypes((current) => {
        const next = { ...current };
        delete next[type];
        return next;
      });
      setAiSuggestions((current) => {
        const next = { ...current };
        delete next[type];
        return next;
      });
      return;
    }
    const nextTypes = [...selectedTypes, type];
    setSelectedTypes(nextTypes);
    if (mainAsset && assistantState === 'ready') setPromptOverrides((current) => ({ ...current, [type]: generatedPrompts[type] }));
  };

  const updateProductFact = (key: keyof ProductFacts, value: string) => {
    const nextFacts = { ...productFacts, [key]: value };
    setProductFacts(nextFacts);
    if (mainAsset) applyAiPromptUpdate(getPromptCandidates(nextFacts, style, scene, pose, orderedReferences), '商品事实');
  };

  const updatePrompt = (type: ImageGenerationType, value: string) => {
    setPromptOverrides((current) => ({ ...current, [type]: value }));
    setManualPromptTypes((current) => ({ ...current, [type]: true }));
  };

  const applySuggestion = (type: ImageGenerationType) => {
    const suggestion = aiSuggestions[type];
    if (!suggestion) return;
    setPromptOverrides((current) => ({ ...current, [type]: suggestion.prompt }));
    setManualPromptTypes((current) => ({ ...current, [type]: false }));
    setAiSuggestions((current) => {
      const next = { ...current };
      delete next[type];
      return next;
    });
  };

  const dismissSuggestion = (type: ImageGenerationType) => {
    setAiSuggestions((current) => {
      const next = { ...current };
      delete next[type];
      return next;
    });
  };

  const copyProductFacts = async () => {
    const text = `商品名称：${productFacts.name}\n品类：${productFacts.category}\n颜色：${productFacts.color}\n图案/材质：${productFacts.materialAndPattern}\n版型/结构：${productFacts.structure}\n核心卖点：${productFacts.sellingPoints}`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API is unavailable');
      await navigator.clipboard.writeText(text);
      setFactsCopyState('copied');
    } catch {
      setFactsCopyState('failed');
    }
    window.setTimeout(() => setFactsCopyState('idle'), 1200);
  };

  const changeTypeCount = (type: ImageGenerationType, delta: number) => {
    const max = Math.min(MAX_TYPE_COUNT, model.capability.maxCount);
    setTypeCounts((current) => ({ ...current, [type]: Math.max(MIN_TYPE_COUNT, Math.min(max, current[type] + delta)) }));
  };

  const chooseModel = (value: string) => {
    const choice = availableModels.find((item) => `${item.channel.id}:${item.model.id}` === value);
    if (!choice) return;
    setChannelId(choice.channel.id);
    setModelId(choice.model.id);
    setRatio(choice.model.capability.ratios.includes(ratio) ? ratio : choice.model.capability.ratios[0]);
    setResolution(choice.model.capability.resolutions.includes(resolution) ? resolution : choice.model.capability.resolutions[0]);
    setTypeCounts((current) => Object.fromEntries(TYPE_ORDER.map((type) => [
      type,
      Math.min(current[type], choice.model.capability.maxCount, MAX_TYPE_COUNT),
    ])) as Record<ImageGenerationType, number>);
  };

  const checkAndGenerate = () => {
    if (!mainAsset) {
      setReadinessIssue('请选择主体素材后再生成。商品关联可稍后在资源中心完成。');
      document.getElementById('image-source-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!promptsComplete) {
      setReadinessIssue('请先为全部已选图片类型生成或补充 Prompt。');
      document.getElementById('image-prompt-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!isSupported) {
      setReadinessIssue('当前模型不支持所选输出规格或张数，请在高级设置中调整。');
      document.getElementById('image-settings-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setReadinessIssue('');
    setExecutionConfirmOpen(true);
  };

  const submitTasks = () => {
    if (!mainAsset) return;
    setExecutionConfirmOpen(false);
    const groupId = `G-${Date.now()}`;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    selectedTypes.forEach((imageType, index) => {
      const prompt = promptOverrides[imageType] ?? generatedPrompts[imageType];
      onAddTask({
        id: `I-${Date.now()}-${index + 1}`,
        groupId,
        groupOrder: index + 1,
        submittedAt: now,
        name: `${IMAGE_GENERATION_TYPE_LABELS[imageType]} · ${subjectName}`,
        type: 'image',
        imageType,
        status: 'pending',
        progress: 0,
        productName: subjectName,
        productImg: mainAsset.thumbnailUrl ?? selectedMainProduct?.thumbnail ?? selectedProduct.thumbnail,
        templateName: appliedTemplateName ?? 'AI 商品图片工作流',
        timestamp: now,
        creator: '陆永奇',
        modelChannel: `${channel.name} / ${model.name}`,
        taskPrompt: prompt,
        negativePrompt: '模糊、商品漂移、错误文字、材质失真',
        modelSnapshot: {
          accessType: channel.accessType,
          channelId: channel.id,
          channelName: channel.name,
          modelId: model.id,
          modelName: model.name,
          supportedRatios: model.capability.ratios,
          maxCount: model.capability.maxCount,
          supportedResolutions: model.capability.resolutions,
          estimatedCost: model.cost * typeCounts[imageType],
        },
        params: { ratio, resolution, count: typeCounts[imageType], prompt, negativePrompt: '模糊、商品漂移、错误文字、材质失真' },
      });
    });
    setScreen(AppScreen.TASKS);
  };

  const assistantLabel = assistantState === 'processing'
    ? '生成中'
    : assistantState === 'ready'
      ? '重新生成'
      : assistantState === 'failed'
        ? '重试'
        : '生成提示词';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f5f7fb] text-slate-800">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setScreen(AppScreen.TASKS)} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" title="返回任务列表"><span className="material-symbols-outlined">arrow_back</span></button>
          <div><p className="text-[11px] font-bold text-primary">图片任务</p><h1 className="text-base font-black">新建图片任务</h1></div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500">{selectedTypes.length} 个类型 · 共 {totalCount} 张</span>
          <button onClick={() => setTemplatePickerOpen(true)} className="h-9 rounded-md border border-primary px-3 text-xs font-bold text-primary">模板</button>
          <button onClick={checkAndGenerate} className="h-9 rounded-md bg-primary px-4 text-xs font-bold text-white shadow-sm">生成</button>
        </div>
      </header>

      {readinessIssue && <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-6 py-2 text-[11px] font-bold text-amber-700"><span className="material-symbols-outlined mr-1 align-middle text-sm">error</span>{readinessIssue}</div>}
      {appliedTemplateName && <div className="shrink-0 border-b border-blue-100 bg-blue-50 px-6 py-2 text-[11px] font-bold text-primary">已应用模板「{appliedTemplateName}」，请替换主体素材后生成。</div>}

      <main className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[260px_minmax(480px,1fr)_300px]">
        <section id="image-source-section" className="min-w-0 space-y-3">
          <div className="border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between"><h2 className="text-xs font-black">主体素材</h2><button onClick={() => openTransit(selectMainAsset, 'main')} className="text-[11px] font-bold text-primary">资源中心</button></div>
            {mainAsset?.thumbnailUrl ? (
              <button onClick={() => openTransit(selectMainAsset, 'main')} className="mt-3 block w-full text-left"><img src={mainAsset.thumbnailUrl} alt={mainAsset.name} className="h-36 w-full object-cover" referrerPolicy="no-referrer" /><p className="mt-2 truncate text-xs font-bold text-slate-700">{mainAsset.name}</p></button>
            ) : (
              <button onClick={() => openTransit(selectMainAsset, 'main')} className="mt-3 flex h-36 w-full flex-col items-center justify-center gap-2 border border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-primary hover:bg-blue-50 hover:text-primary"><span className="material-symbols-outlined text-3xl">add_photo_alternate</span><span className="text-xs font-bold">选择主体素材</span></button>
            )}
            {mainAsset && <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500"><span className="material-symbols-outlined text-sm">inventory_2</span>{selectedMainProduct ? <span className="truncate">{selectedMainProduct.name} · {selectedMainProduct.sku}</span> : <span>未关联商品，可后续归档</span>}</div>}
          </div>

          <div className="border border-slate-200 bg-white p-3">
            <div className="flex items-baseline justify-between"><h2 className="text-xs font-black">参考图</h2><span className="text-[10px] text-slate-400">自动识别标签</span></div>
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {REFERENCE_SLOTS.map((slot) => {
                const reference = references[slot.id];
                return <div key={slot.id} className="group relative min-w-0">
                  <button onClick={() => openTransit(selectReferenceAsset(slot.id), slot.transitSlot)} className={`flex aspect-square w-full flex-col items-center justify-center overflow-hidden border text-slate-400 transition-colors ${reference ? 'border-slate-200 bg-white' : 'border-dashed border-slate-300 bg-slate-50 hover:border-primary hover:text-primary'}`} title={`添加${slot.label}参考图`}>
                    {reference?.thumbnailUrl ? <img src={reference.thumbnailUrl} alt={slot.label} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <span className="material-symbols-outlined text-lg">{slot.icon}</span>}
                  </button>
                  {reference && <button onClick={() => removeReference(slot.id)} className="absolute -right-1 -top-1 hidden h-4 w-4 place-items-center rounded-full bg-slate-800 text-[10px] text-white group-hover:grid" title={`移除${slot.label}参考图`}>×</button>}
                  <p className="mt-1 truncate text-center text-[10px] font-bold text-slate-500">{slot.label}</p>
                </div>;
              })}
            </div>
          </div>

          {mainAsset && <div className="border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2"><div><h2 className="text-xs font-black">商品事实</h2><p className="mt-0.5 text-[10px] text-slate-400">AI 基于主体素材识别，可直接修改</p></div><button onClick={copyProductFacts} className={`grid h-6 w-6 place-items-center rounded border ${factsCopyState === 'failed' ? 'border-red-200 text-red-600' : 'border-slate-200 text-slate-500 hover:border-primary hover:text-primary'}`} title={factsCopyState === 'failed' ? '复制失败，请检查浏览器权限' : '复制商品信息'} aria-label={factsCopyState === 'failed' ? '复制失败' : '复制商品信息'}><span className="material-symbols-outlined text-sm">{factsCopyState === 'copied' ? 'check' : factsCopyState === 'failed' ? 'error' : 'content_copy'}</span></button></div>
            <div className="mt-3 space-y-2"><label className="block"><span className="text-[10px] text-slate-400">商品名称</span><input value={productFacts.name} onChange={(event) => updateProductFact('name', event.target.value)} className="mt-0.5 h-7 w-full border-b border-slate-200 bg-transparent text-[11px] font-bold outline-none focus:border-primary" /></label><div className="grid grid-cols-2 gap-x-2 gap-y-2">{([['category', '品类'], ['color', '颜色'], ['materialAndPattern', '图案/材质'], ['structure', '版型/结构']] as Array<[keyof ProductFacts, string]>).map(([key, label]) => <label key={key} className="min-w-0"><span className="block text-[10px] text-slate-400">{label}</span><input value={productFacts[key]} onChange={(event) => updateProductFact(key, event.target.value)} className="mt-0.5 h-7 w-full truncate border-b border-slate-200 bg-transparent text-[11px] outline-none focus:border-primary" /></label>)}</div><label className="block"><span className="text-[10px] text-slate-400">核心卖点</span><textarea value={productFacts.sellingPoints} onChange={(event) => updateProductFact('sellingPoints', event.target.value)} className="mt-0.5 h-12 w-full resize-none border-b border-slate-200 bg-transparent text-[11px] leading-4 outline-none focus:border-primary" /></label></div>
          </div>}
        </section>

        <section id="image-prompt-section" className="min-w-0 border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div><p className="text-[11px] font-bold text-primary">内容</p><h2 className="mt-0.5 text-sm font-black">最终 Prompt</h2></div>
            <button onClick={refreshPrompts} disabled={assistantState === 'processing'} className="flex h-8 items-center gap-1.5 rounded-md border border-primary bg-white px-3 text-[11px] font-bold text-primary disabled:border-slate-200 disabled:text-slate-400"><span className={`material-symbols-outlined text-base ${assistantState === 'processing' ? 'animate-spin' : ''}`}>{assistantState === 'ready' ? 'auto_awesome' : 'auto_fix_high'}</span>{assistantLabel}</button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TYPE_ORDER.map((type) => {
              const active = selectedTypes.includes(type);
              return <div key={type} className={`flex h-16 min-w-0 items-center gap-2 border px-2 ${active ? 'border-primary bg-blue-50' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                <button onClick={() => toggleType(type)} aria-pressed={active} className="flex min-w-0 flex-1 items-center gap-1.5 text-left"><span className={`material-symbols-outlined text-base ${active ? 'text-primary' : 'text-slate-400'}`}>{active ? 'check_circle' : typeIcon[type]}</span><span className="truncate text-[11px] font-bold text-slate-700">{typeCompactLabel[type]}</span></button>
                {active ? <div className="flex items-center border border-slate-200 bg-white text-[11px]"><button onClick={() => changeTypeCount(type, -1)} disabled={typeCounts[type] <= MIN_TYPE_COUNT} className="grid h-6 w-5 place-items-center text-slate-500 disabled:text-slate-300" title="减少张数">−</button><span className="w-4 text-center font-bold">{typeCounts[type]}</span><button onClick={() => changeTypeCount(type, 1)} disabled={typeCounts[type] >= Math.min(MAX_TYPE_COUNT, model.capability.maxCount)} className="grid h-6 w-5 place-items-center text-slate-500 disabled:text-slate-300" title="增加张数">+</button></div> : <button onClick={() => toggleType(type)} className="grid h-6 w-6 place-items-center text-slate-400 hover:text-primary" title={`添加${typeCompactLabel[type]}`}><span className="material-symbols-outlined text-base">add</span></button>}
              </div>;
            })}
          </div>

          <div className="mt-3 border-y border-slate-100 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <VisualTagPicker label="风格" value={style} options={mockImagePromptVisualTags.styles} onChange={(value) => updateTag('style', value)} />
              <VisualTagPicker label="场景" value={scene} options={availableScenes} onChange={(value) => updateTag('scene', value)} />
              <VisualTagPicker label="姿势" value={pose} options={availablePoses} onChange={(value) => updateTag('pose', value)} />
            </div>
            <p className="mt-2 text-[10px] text-slate-400">切换风格会自动保留兼容的场景与姿势；不兼容时回到该风格的推荐组合。</p>
          </div>

          <div className="mt-4 space-y-3">
            {selectedTypes.map((type) => {
              const prompt = promptOverrides[type] ?? (assistantState === 'ready' ? generatedPrompts[type] : '');
              const suggestion = aiSuggestions[type];
              const suggestionOpen = openSuggestions[type];
              return <div key={type} className="overflow-hidden border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2"><div className="flex items-center gap-2"><span className="material-symbols-outlined text-base text-primary">{typeIcon[type]}</span><span className="text-xs font-black">{IMAGE_GENERATION_TYPE_LABELS[type]}</span><span className="text-[10px] text-slate-400">{taskProfileByType[type]} · {typeCounts[type]} 张</span></div><span className={`text-[10px] font-bold ${manualPromptTypes[type] ? 'text-amber-700' : 'text-emerald-700'}`}>{manualPromptTypes[type] ? '已手动编辑' : 'AI 生成'}</span></div>
                {suggestion && <div className="border-y border-amber-200 bg-amber-50 px-3 py-2"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-bold text-amber-800">AI 有新的建议，来自：{suggestion.reason}</p><div className="flex gap-2"><button onClick={() => setOpenSuggestions((current) => ({ ...current, [type]: !suggestionOpen }))} className="text-[10px] font-bold text-primary">{suggestionOpen ? '收起建议' : '查看差异'}</button><button onClick={() => applySuggestion(type)} className="text-[10px] font-bold text-primary">覆盖为 AI 建议</button><button onClick={() => dismissSuggestion(type)} className="text-[10px] font-bold text-slate-500">保留当前</button></div></div>{suggestionOpen && <div className="mt-2 grid gap-2 border-t border-amber-200 pt-2 md:grid-cols-2"><div><p className="text-[10px] text-slate-500">当前人工版本</p><p className="mt-1 whitespace-pre-wrap text-[10px] leading-4 text-slate-700">{prompt}</p></div><div><p className="text-[10px] text-slate-500">AI 新建议</p><p className="mt-1 whitespace-pre-wrap text-[10px] leading-4 text-slate-700">{suggestion.prompt}</p></div></div>}</div>}
                <textarea value={prompt} disabled={!mainAsset} onChange={(event) => updatePrompt(type, event.target.value)} placeholder="选择主体素材后，点击 AI 助手生成 Prompt" className="h-48 w-full resize-y p-3 text-xs leading-6 text-slate-700 outline-none placeholder:text-slate-300 disabled:bg-slate-50" />
              </div>;
            })}
          </div>
          <p className="mt-2 text-[10px] leading-4 text-slate-400">图片类型支持多选，所有已选类型的 Prompt 会依次显示。点击“生成”即接受当前 Prompt，并进入预检与费用确认。</p>
        </section>

        <section id="image-settings-section" className="min-w-0 space-y-3">
          <div className="border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-bold text-primary">执行</p><h2 className="mt-0.5 text-sm font-black">模型与输出</h2>
            <label className="mt-4 block text-[11px] font-bold text-slate-600">模型<select value={`${channel.id}:${model.id}`} onChange={(event) => chooseModel(event.target.value)} className="mt-1.5 h-9 w-full border border-slate-200 bg-white px-2 text-xs text-slate-700">{availableModels.map((item) => <option key={`${item.channel.id}:${item.model.id}`} value={`${item.channel.id}:${item.model.id}`}>{item.model.name}</option>)}</select></label><p className="mt-1 text-[10px] leading-4 text-slate-400">{model.description}</p>
            <div className="mt-4 border-y border-slate-100 py-3"><p className="text-[10px] font-bold text-slate-400">本次任务总生成图片数</p><p className="mt-1 text-2xl font-black text-slate-800">{totalCount}<span className="ml-1 text-xs font-bold text-slate-400">张</span></p><p className="mt-1 text-[10px] text-slate-400">按图片类型分别生成</p></div>
            <button onClick={() => setAdvancedOpen((current) => !current)} className="mt-3 flex w-full items-center justify-between text-left text-[11px] font-bold text-slate-600"><span>高级设置</span><span className="text-[10px] font-normal text-slate-400">{ratio} · {resolution}</span><span className="material-symbols-outlined text-base">{advancedOpen ? 'expand_less' : 'expand_more'}</span></button>
            {advancedOpen && <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3"><label className="text-[11px] font-bold text-slate-600">比例<select value={ratio} onChange={(event) => setRatio(event.target.value)} className="mt-1 h-8 w-full border border-slate-200 bg-white px-2 text-xs">{model.capability.ratios.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-[11px] font-bold text-slate-600">分辨率<select value={resolution} onChange={(event) => setResolution(event.target.value)} className="mt-1 h-8 w-full border border-slate-200 bg-white px-2 text-xs">{model.capability.resolutions.map((item) => <option key={item}>{item}</option>)}</select></label></div>}
            {!isSupported && <p className="mt-3 bg-red-50 px-2 py-2 text-[10px] leading-4 text-red-700">当前张数或输出规格不受所选模型支持，请调整设置。</p>}
          </div>
          <p className="px-1 text-[10px] leading-4 text-slate-400">费用、耗时、通道健康度和失败兜底策略将在预检通过后的费用确认中展示。</p>
        </section>
      </main>

      {executionConfirmOpen && <ExecutionConfirmDialog title={`确认生成 ${selectedTypes.length} 个图片类型`} description="已按当前 Prompt、模型能力与结构化输出参数完成预检。确认费用后，任务将进入排队。" estimatedCost={`¥ ${(model.cost * totalCount).toFixed(2)}`} estimatedDuration={`${Math.max(1, Math.ceil(totalCount / 2))}–${Math.max(2, Math.ceil(totalCount * 0.8))} 分钟`} healthLabel={channel.health === 'healthy' ? '服务健康' : '额度偏低'} healthDetail={channel.quotaText} fallbackPolicy="同配置最多自动重试 1 次；仍失败则停止并通知，不自动切换其他付费通道。" summary={[{ label: '图片类型', value: selectedTypes.map((type) => IMAGE_GENERATION_TYPE_LABELS[type]).join('、') }, { label: '主体素材', value: subjectName }, { label: '模型', value: model.name }, { label: '输出规格', value: `${ratio} · ${resolution} · ${totalCount} 张` }]} requestLines={[`参考图：${orderedReferences.length ? orderedReferences.map((item) => `${item.position}.${item.role}`).join('、') : '未使用参考图'}`, `参数：ratio=${ratio}，resolution=${resolution}，count=${totalCount}`]} onCancel={() => setExecutionConfirmOpen(false)} onConfirm={submitTasks} />}
      <TemplatePickerDrawer open={templatePickerOpen} templates={templates} mediaType="image" onClose={() => setTemplatePickerOpen(false)} onSelect={applyTemplate} />
    </div>
  );
};
