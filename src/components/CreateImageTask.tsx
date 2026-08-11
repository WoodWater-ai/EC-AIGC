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
import { mockImagePromptVisualTags, mockModelChannels } from '../mockData';
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

type ReferenceRole = 'model' | 'style' | 'scene' | 'pose' | 'detail';
type AssistantState = 'idle' | 'processing' | 'ready' | 'failed';

interface TaskReference {
  id: string;
  name: string;
  thumbnailUrl?: string;
  productAssetId?: string;
  roles: ReferenceRole[];
}

interface ProductFacts {
  name: string;
  seoName: string;
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
  disabled?: boolean;
  disabledLabel?: string;
}

interface ReferenceRolePickerProps {
  referenceNumber: number;
  value: ReferenceRole[];
  onChange: (roles: ReferenceRole[]) => void;
}

const TYPE_ORDER: ImageGenerationType[] = ['product_main', 'scene_detail', 'detail_closeup', 'on_model'];
const MIN_TYPE_COUNT = 1;
const MAX_TYPE_COUNT = 5;

const REFERENCE_ROLES: Array<{ id: ReferenceRole; label: string; icon: string }> = [
  { id: 'model', label: '模特', icon: 'face_3' },
  { id: 'style', label: '风格', icon: 'palette' },
  { id: 'scene', label: '场景', icon: 'landscape' },
  { id: 'pose', label: '姿势', icon: 'accessibility_new' },
  { id: 'detail', label: '细节', icon: 'zoom_in' },
];

const REFERENCE_ROLE_LABELS: Record<ReferenceRole, string> = {
  model: '模特',
  style: '风格',
  scene: '场景',
  pose: '姿势',
  detail: '细节',
};

const orderReferenceRoles = (roles: ReferenceRole[]) => REFERENCE_ROLES
  .map((role) => role.id)
  .filter((role) => roles.includes(role));

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
  seoName: '',
  sellingPoints: '',
  category: '',
  color: '',
  materialAndPattern: '',
  structure: '',
};

const createProductFacts = (asset: AssetResourceItem, product: ProductAsset | null): ProductFacts => ({
  name: product?.name ?? asset.name.replace(/\.[^.]+$/, ''),
  seoName: product ? `${product.name} ${product.specs.color.join(' ')} ${product.fabric}`.trim() : asset.name.replace(/\.[^.]+$/, ''),
  sellingPoints: product?.specs.sellingPoints.join('、') ?? asset.tags ?? '待补充',
  category: product?.category ?? '待 AI 识别',
  color: product?.specs.color.join('、') ?? '待 AI 识别',
  materialAndPattern: product?.fabric ?? product?.specs.material ?? '待 AI 识别',
  structure: product?.category === '户外服饰' || product?.category === '服饰家居'
    ? '以主体素材可见版型和剪裁为准'
    : '以主体素材可见结构为准',
});

const joinChineseList = (items: string[]) => {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join('、')}与${items.at(-1)}`;
};

const getReferenceSources = (references: Array<TaskReference & { position: number }>) => Object.fromEntries(
  REFERENCE_ROLES.map(({ id }) => [
    id,
    references.filter((reference) => reference.roles.includes(id)).map((reference) => `参考图 ${reference.position}`),
  ]),
) as Record<ReferenceRole, string[]>;

const getReferencePromptLine = (references: Array<TaskReference & { position: number }>) => {
  if (!references.length) return '仅以主体素材为商品依据。';
  const assignedReferences = references
    .filter((reference) => reference.roles.length > 0)
    .map((reference) => `${joinChineseList(orderReferenceRoles(reference.roles).map((role) => REFERENCE_ROLE_LABELS[role]))}参考图 ${reference.position}`)
    .join('；');
  return assignedReferences ? `${assignedReferences}。` : '已添加参考图，尚未指定参考标签。';
};

const buildPrompt = (
  type: ImageGenerationType,
  facts: ProductFacts,
  style: string,
  scene: string,
  pose: string,
  references: Array<TaskReference & { position: number }>,
) => {
  const referenceSources = getReferenceSources(references);
  const styleDirection = referenceSources.style.length ? '风格按指定参考图保持一致' : style;
  const sceneDirection = referenceSources.scene.length ? '场景按指定参考图保持一致' : scene;
  const poseDirection = referenceSources.pose.length ? '姿势按指定参考图保持一致' : pose;
  const directions: Record<ImageGenerationType, string> = {
    product_main: `为「${facts.seoName || facts.name}」生成干净的电商主图。商品完整居中，轮廓和可见材质清晰，${sceneDirection}且保持低干扰；${styleDirection}，柔和商业光线与克制阴影。`,
    scene_detail: `为「${facts.seoName || facts.name}」生成有使用感的场景图。商品始终是画面中心，${sceneDirection}只承担氛围和尺度参照；${styleDirection}，自然层次与真实景深。`,
    detail_closeup: `为「${facts.seoName || facts.name}」生成可核验的细节图。微距聚焦主体素材可见的材质、纹理或工艺，单一焦点锐利，背景干净虚化；${styleDirection}。`,
    on_model: `为「${facts.seoName || facts.name}」生成三视图。相同人物、相同光线和机位依次呈现正面、侧面与背面，${poseDirection}，不得遮挡商品关键结构；${styleDirection}。`,
  };
  const factLine = [facts.category, facts.color, facts.materialAndPattern, facts.structure, facts.sellingPoints]
    .filter((value) => value && value !== '待 AI 识别' && value !== '待补充')
    .join('；');
  return `${getReferencePromptLine(references)}\n\n${directions[type]}\n\n商品事实：${factLine || '以主体素材可见信息为准。'}\n\n保持主体素材中可见的颜色、图案、结构和品牌信息，不新增未提供的商品、文字或配饰。避免模糊、商品漂移、错误文字和材质失真。`;
};

const VisualTagPicker: React.FC<VisualTagPickerProps> = ({ label, value, options, onChange, disabled = false, disabledLabel }) => {
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
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        title={disabled ? `${label}已由${disabledLabel}接管` : undefined}
        className={`flex h-9 items-center gap-2 rounded-md border py-1 pl-1 pr-2 text-left transition-colors ${disabled ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400' : open ? 'border-primary bg-white ring-2 ring-primary/10' : 'border-slate-200 bg-white hover:border-slate-300'}`}
      >
        <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-slate-100">
          <img src={selected.previewImage} alt="" className="h-full w-full object-cover" />
        </span>
        <span className="min-w-0">
          <span className="mr-1 text-[10px] font-bold text-slate-400">{label}</span>
          <span className={`text-[11px] font-bold ${disabled ? 'text-slate-400' : 'text-slate-700'}`}>{disabled ? disabledLabel : selected.label}</span>
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

const ReferenceRolePicker: React.FC<ReferenceRolePickerProps> = ({ referenceNumber, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const toggleRole = (role: ReferenceRole) => {
    const nextValue = value.includes(role) ? value.filter((item) => item !== role) : [...value, role];
    onChange(orderReferenceRoles(nextValue));
  };

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} className={`flex h-7 w-full items-center justify-between gap-1 rounded border px-1.5 text-[10px] font-bold ${open ? 'border-primary bg-blue-50 text-primary' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
        <span className="truncate">{value.length ? orderReferenceRoles(value).map((role) => REFERENCE_ROLE_LABELS[role]).join('、') : '选择标签'}</span>
        <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 z-40 mt-1 w-36 rounded-md border border-slate-200 bg-white p-1 shadow-xl" role="listbox" aria-label={`参考图 ${referenceNumber} 标签`}>
          {REFERENCE_ROLES.map((role) => {
            const active = value.includes(role.id);
            return <button type="button" key={role.id} onClick={() => toggleRole(role.id)} className={`flex h-8 w-full items-center gap-2 rounded px-2 text-left text-[11px] ${active ? 'bg-orange-50 font-bold text-[#df5b43]' : 'text-slate-600 hover:bg-slate-50'}`}>
              <span className={`grid h-4 w-4 place-items-center rounded border ${active ? 'border-[#df5b43] bg-[#df5b43] text-white' : 'border-slate-300'}`}>{active && <Check size={11} strokeWidth={3} />}</span>
              <span className="material-symbols-outlined text-sm">{role.icon}</span>
              {role.label}
            </button>;
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
  const [references, setReferences] = useState<TaskReference[]>([]);
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
  const orderedReferences = useMemo(() => references.map((reference, index) => ({ ...reference, position: index + 1 })), [references]);
  const referenceSources = useMemo(() => getReferenceSources(orderedReferences), [orderedReferences]);
  const generatedPrompts = useMemo(() => Object.fromEntries(TYPE_ORDER.map((type) => [
    type,
    buildPrompt(type, productFacts, selectedStyle.label, selectedScene.label, selectedPose.label, orderedReferences),
  ])) as Record<ImageGenerationType, string>, [orderedReferences, productFacts, selectedPose.label, selectedScene.label, selectedStyle.label]);
  const promptsComplete = selectedTypes.every((type) => (promptOverrides[type] ?? (assistantState === 'ready' ? generatedPrompts[type] : '')).trim().length > 0);
  const isSupported = model.capability.ratios.includes(ratio)
    && model.capability.resolutions.includes(resolution)
    && references.length <= model.capability.maxReferenceImages
    && selectedTypes.every((type) => typeCounts[type] <= model.capability.maxCount);

  const clearPromptState = () => {
    setPromptOverrides({});
    setManualPromptTypes({});
    setAiSuggestions({});
    setOpenSuggestions({});
    setAssistantState('idle');
    setReadinessIssue('');
  };

  const toTaskReference = (asset: AssetResourceItem, roles: ReferenceRole[] = []): TaskReference => ({
    id: `asset-${asset.id}`,
    name: asset.name,
    thumbnailUrl: asset.thumbnailUrl ?? asset.originalUrl,
    productAssetId: asset.productAssetId,
    roles,
  });

  const selectMainAsset = (assets: AssetResourceItem[]) => {
    const asset = assets[0];
    if (!asset) return;
    const reference = toTaskReference(asset);
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
    const nextReferences: TaskReference[] = [];
    snapshot.references.forEach((reference) => {
      if (!REFERENCE_ROLES.some((role) => role.id === reference.role)) return;
      const role = reference.role as ReferenceRole;
      const existing = nextReferences.find((item) => item.thumbnailUrl === reference.url);
      if (existing) {
        if (!existing.roles.includes(role)) existing.roles.push(role);
        return;
      }
      nextReferences.push({ id: reference.id, name: reference.name, thumbnailUrl: reference.url, roles: [role] });
    });
    setSelectedTypes([imageType]);
    setTypeCounts((current) => ({ ...current, [imageType]: Math.max(MIN_TYPE_COUNT, Math.min(MAX_TYPE_COUNT, snapshot.count ?? 1)) }));
    setRatio(snapshot.ratio);
    setResolution(snapshot.resolution);
    setReferences(nextReferences);
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

  const toOrderedReferences = (nextReferences: TaskReference[]) => nextReferences
    .map((reference, index) => ({ ...reference, position: index + 1 }));

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

  const selectReferenceAsset = (assets: AssetResourceItem[]) => {
    const asset = assets[0];
    if (!asset) return;
    if (references.some((reference) => reference.id === `asset-${asset.id}`)) return;
    if (references.length >= model.capability.maxReferenceImages) {
      setReadinessIssue(`当前模型最多支持 ${model.capability.maxReferenceImages} 张参考图。`);
      return;
    }
    const defaultRoles: ReferenceRole[] = references.length === 0 ? ['model'] : references.length === 1 ? ['detail'] : [];
    const nextReferences = [...references, toTaskReference(asset, defaultRoles)];
    setReferences(nextReferences);
    setReadinessIssue('');
    if (mainAsset) {
      applyAiPromptUpdate(getPromptCandidates(productFacts, style, scene, pose, toOrderedReferences(nextReferences)), '参考图');
    }
  };

  const updateReferenceRoles = (referenceId: string, roles: ReferenceRole[]) => {
    const nextReferences = references.map((reference) => reference.id === referenceId ? { ...reference, roles } : reference);
    setReferences(nextReferences);
    if (mainAsset) {
      applyAiPromptUpdate(getPromptCandidates(productFacts, style, scene, pose, toOrderedReferences(nextReferences)), '参考图标签');
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

  const removeReference = (referenceId: string) => {
    const nextReferences = references.filter((reference) => reference.id !== referenceId);
    setReferences(nextReferences);
    if (mainAsset) {
      applyAiPromptUpdate(getPromptCandidates(productFacts, style, scene, pose, toOrderedReferences(nextReferences)), '参考图');
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
    const text = `ERP 商品名称：${productFacts.name}\nERP 分类：${productFacts.category}\nSEO 优化商品名称：${productFacts.seoName}\n颜色：${productFacts.color}\n图案/材质：${productFacts.materialAndPattern}\n版型/结构：${productFacts.structure}\n核心卖点：${productFacts.sellingPoints}`;
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
      setReadinessIssue('当前模型不支持所选输出规格或张数，请调整 Prompt 下方的模型、比例或分辨率。');
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
    <div className="flex h-screen flex-col overflow-hidden bg-[#f4f6f9] text-slate-800">
      <header className="flex h-[58px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={() => setScreen(AppScreen.TASKS)} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50" title="返回任务列表"><span className="material-symbols-outlined text-lg">arrow_back</span></button>
          <div className="min-w-0"><h1 className="truncate text-base font-black">新建图片任务</h1><p className="mt-0.5 text-[10px] text-slate-400">配置、生成与结果在同一页面完成</p></div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {selectedMainProduct && <div className="hidden max-w-64 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 lg:flex"><img src={selectedMainProduct.thumbnail} alt="" className="h-7 w-7 rounded object-cover" /><div className="min-w-0"><p className="truncate text-[10px] font-bold text-emerald-800">{selectedMainProduct.name}</p><p className="truncate text-[9px] text-emerald-600">ERP 商品 · {selectedMainProduct.sku}</p></div></div>}
          <button onClick={() => setTemplatePickerOpen(true)} className="h-8 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 hover:border-primary hover:text-primary">模板</button>
          <button onClick={checkAndGenerate} className="h-8 rounded-md bg-[#df5b43] px-4 text-[11px] font-bold text-white shadow-sm hover:bg-[#cb4d37]">生成 {totalCount} 张</button>
        </div>
      </header>

      {readinessIssue && <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11px] font-bold text-amber-700"><span className="material-symbols-outlined mr-1 align-middle text-sm">error</span>{readinessIssue}</div>}
      {appliedTemplateName && <div className="shrink-0 border-b border-blue-100 bg-blue-50 px-4 py-2 text-[11px] font-bold text-primary">已应用模板「{appliedTemplateName}」，请确认主体素材与参考图标签。</div>}

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[288px_minmax(0,1fr)_310px] lg:overflow-hidden">
        <section id="image-source-section" className="min-w-0 space-y-3 lg:overflow-y-auto lg:pr-1">
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between"><div><p className="text-[9px] font-bold text-[#df5b43]">创作商品</p><h2 className="mt-0.5 text-xs font-black">主体素材</h2></div><button onClick={() => openTransit(selectMainAsset, 'main')} className="h-7 rounded border border-slate-200 px-2 text-[10px] font-bold text-slate-600 hover:border-primary hover:text-primary">资源中心</button></div>
            {mainAsset?.thumbnailUrl ? (
              <button onClick={() => openTransit(selectMainAsset, 'main')} className="relative mt-3 block w-full overflow-hidden rounded border border-slate-200 bg-slate-50 text-left"><img src={mainAsset.thumbnailUrl} alt={mainAsset.name} className="h-40 w-full object-cover" referrerPolicy="no-referrer" /><span className="absolute bottom-2 right-2 rounded bg-slate-900/75 px-2 py-1 text-[9px] font-bold text-white">更换</span></button>
            ) : (
              <button onClick={() => openTransit(selectMainAsset, 'main')} className="mt-3 flex h-40 w-full flex-col items-center justify-center gap-2 rounded border border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-primary hover:bg-blue-50 hover:text-primary"><span className="material-symbols-outlined text-3xl">add_photo_alternate</span><span className="text-xs font-bold">选择主体素材</span></button>
            )}
            {mainAsset && <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500"><span className="material-symbols-outlined text-sm text-emerald-600">verified</span>{selectedMainProduct ? <span className="truncate">已匹配 ERP · {selectedMainProduct.sku}</span> : <span>未匹配 ERP 商品</span>}</div>}
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between"><div><p className="text-[9px] font-bold text-[#df5b43]">补充依据</p><h2 className="mt-0.5 text-xs font-black">参考图</h2></div><span className="rounded bg-slate-100 px-1.5 py-1 text-[9px] font-bold text-slate-500">{references.length} / {model.capability.maxReferenceImages}</span></div>
            <p className="mt-1 text-[9px] leading-4 text-slate-400">每张图可同时选择模特、风格、场景、姿势、细节。</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {references.map((reference, index) => <div key={reference.id} className="group relative min-w-0">
                <div className="relative aspect-[4/5] overflow-hidden rounded border border-slate-200 bg-slate-50"><img src={reference.thumbnailUrl} alt={reference.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" /><button onClick={() => removeReference(reference.id)} className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded bg-slate-900/75 text-white opacity-0 transition-opacity group-hover:opacity-100" title={`移除参考图 ${index + 1}`}><span className="material-symbols-outlined text-xs">close</span></button></div>
                <p className="my-1 truncate text-[9px] font-bold text-slate-500">参考图 {index + 1}</p>
                <ReferenceRolePicker referenceNumber={index + 1} value={reference.roles} onChange={(roles) => updateReferenceRoles(reference.id, roles)} />
              </div>)}
              {references.length < model.capability.maxReferenceImages && <button onClick={() => openTransit(selectReferenceAsset, 'reference')} className="flex aspect-[4/5] min-w-0 flex-col items-center justify-center gap-1 rounded border border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-primary hover:text-primary"><span className="material-symbols-outlined text-xl">add</span><span className="text-[9px] font-bold">添加参考</span></button>}
            </div>
          </div>

          {mainAsset && <div className="rounded-md border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[9px] font-bold text-[#df5b43]">ERP 商品事实</p><h2 className="mt-1 truncate text-sm font-black" title={productFacts.name}>{productFacts.name}</h2><p className="mt-1 truncate text-[10px] text-slate-500" title={productFacts.category}>{productFacts.category}</p></div><button onClick={copyProductFacts} className={`grid h-7 w-7 shrink-0 place-items-center rounded border ${factsCopyState === 'failed' ? 'border-red-200 text-red-600' : 'border-slate-200 text-slate-500 hover:border-primary hover:text-primary'}`} title={factsCopyState === 'failed' ? '复制失败，请检查浏览器权限' : '复制商品信息'}><span className="material-symbols-outlined text-sm">{factsCopyState === 'copied' ? 'check' : factsCopyState === 'failed' ? 'error' : 'content_copy'}</span></button></div>
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
              <label className="block"><span className="text-[9px] text-slate-400">SEO 优化商品名称</span><input value={productFacts.seoName} onChange={(event) => updateProductFact('seoName', event.target.value)} className="mt-0.5 h-7 w-full border-b border-slate-200 bg-transparent text-[10px] font-bold text-[#df5b43] outline-none focus:border-primary" /></label>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">{([['color', '颜色'], ['materialAndPattern', '图案 / 材质'], ['structure', '版型 / 结构']] as Array<[keyof ProductFacts, string]>).map(([key, label]) => <label key={key} className="min-w-0"><span className="block text-[9px] text-slate-400">{label}</span><input value={productFacts[key]} onChange={(event) => updateProductFact(key, event.target.value)} className="mt-0.5 h-7 w-full truncate border-b border-slate-200 bg-transparent text-[10px] font-bold text-[#df5b43] outline-none focus:border-primary" /></label>)}</div>
              <label className="block"><span className="text-[9px] text-slate-400">核心卖点</span><textarea value={productFacts.sellingPoints} onChange={(event) => updateProductFact('sellingPoints', event.target.value)} className="mt-0.5 h-12 w-full resize-none border-b border-slate-200 bg-transparent text-[10px] font-bold leading-4 text-[#df5b43] outline-none focus:border-primary" /></label>
            </div>
          </div>}
        </section>

        <section id="image-prompt-section" className="flex min-h-[640px] min-w-0 flex-col gap-3 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between"><div><p className="text-[9px] font-bold text-[#df5b43]">输出内容</p><h2 className="mt-0.5 text-xs font-black">选择图片类型</h2></div><span className="rounded bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">共生成 {totalCount} 张</span></div>
            <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
              {TYPE_ORDER.map((type) => {
                const active = selectedTypes.includes(type);
                return <div key={type} className={`flex h-16 min-w-0 items-center gap-2 rounded border px-2 ${active ? 'border-[#ef8b77] bg-[#fff3ef]' : 'border-slate-200 bg-white'}`}>
                  <button onClick={() => toggleType(type)} aria-pressed={active} className="flex min-w-0 flex-1 items-center gap-1.5 text-left"><span className={`material-symbols-outlined text-base ${active ? 'text-[#df5b43]' : 'text-slate-400'}`}>{active ? 'check_box' : typeIcon[type]}</span><span className={`truncate text-[10px] font-bold ${active ? 'text-[#c84d38]' : 'text-slate-600'}`}>{typeCompactLabel[type]}</span></button>
                  {active ? <div className="flex shrink-0 items-center rounded border border-slate-200 bg-white text-[11px]"><button onClick={() => changeTypeCount(type, -1)} disabled={typeCounts[type] <= MIN_TYPE_COUNT} className="grid h-6 w-5 place-items-center text-slate-500 disabled:text-slate-300" title="减少张数">−</button><span className="w-4 text-center font-bold">{typeCounts[type]}</span><button onClick={() => changeTypeCount(type, 1)} disabled={typeCounts[type] >= Math.min(MAX_TYPE_COUNT, model.capability.maxCount)} className="grid h-6 w-5 place-items-center text-slate-500 disabled:text-slate-300" title="增加张数">+</button></div> : <button onClick={() => toggleType(type)} className="grid h-6 w-6 shrink-0 place-items-center text-slate-400 hover:text-primary" title={`添加${typeCompactLabel[type]}`}><span className="material-symbols-outlined text-base">add</span></button>}
                </div>;
              })}
            </div>
          </div>

          <div className="flex min-h-[480px] flex-1 flex-col rounded-md border border-slate-200 bg-white">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-3 py-3"><div><p className="text-[9px] font-bold text-[#df5b43]">内容表达</p><h2 className="mt-0.5 text-xs font-black">本次图片 Prompt</h2><p className="mt-1 text-[9px] text-slate-400">参考图标签会自动写入 Prompt，并锁定重复枚举。</p></div><button onClick={refreshPrompts} disabled={assistantState === 'processing'} className="flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 hover:border-primary hover:text-primary disabled:text-slate-300"><span className={`material-symbols-outlined text-sm ${assistantState === 'processing' ? 'animate-spin' : ''}`}>auto_fix_high</span>{assistantLabel}</button></div>
            <div className="flex-1 space-y-3 p-3">
              {selectedTypes.map((type) => {
                const prompt = promptOverrides[type] ?? (assistantState === 'ready' ? generatedPrompts[type] : '');
                const suggestion = aiSuggestions[type];
                const suggestionOpen = openSuggestions[type];
                return <div key={type} className="overflow-hidden rounded border border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2"><div className="flex min-w-0 items-center gap-2"><span className="material-symbols-outlined text-sm text-[#df5b43]">{typeIcon[type]}</span><span className="text-[10px] font-black">{IMAGE_GENERATION_TYPE_LABELS[type]}</span><span className="truncate text-[9px] text-slate-400">{taskProfileByType[type]} · {typeCounts[type]} 张</span></div><span className={`text-[9px] font-bold ${manualPromptTypes[type] ? 'text-amber-700' : 'text-emerald-700'}`}>{manualPromptTypes[type] ? '已手动编辑' : 'AI 生成'}</span></div>
                  {suggestion && <div className="border-y border-amber-200 bg-amber-50 px-3 py-2"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[9px] font-bold text-amber-800">AI 有新建议：{suggestion.reason}</p><div className="flex gap-2"><button onClick={() => setOpenSuggestions((current) => ({ ...current, [type]: !suggestionOpen }))} className="text-[9px] font-bold text-primary">{suggestionOpen ? '收起' : '查看'}</button><button onClick={() => applySuggestion(type)} className="text-[9px] font-bold text-primary">采用</button><button onClick={() => dismissSuggestion(type)} className="text-[9px] font-bold text-slate-500">保留当前</button></div></div>{suggestionOpen && <p className="mt-2 whitespace-pre-wrap border-t border-amber-200 pt-2 text-[9px] leading-4 text-slate-700">{suggestion.prompt}</p>}</div>}
                  <textarea value={prompt} disabled={!mainAsset} onChange={(event) => updatePrompt(type, event.target.value)} placeholder="选择主体素材后，点击 AI 优化生成 Prompt" className="h-40 w-full resize-y p-3 text-[11px] leading-5 text-slate-700 outline-none placeholder:text-slate-300 disabled:bg-slate-50" />
                </div>;
              })}
            </div>
            <div className="border-t border-slate-100 px-3 py-3">
              <div className="mb-2 flex items-center justify-between"><p className="text-[9px] font-bold text-slate-500">创作标签</p>{(referenceSources.style.length > 0 || referenceSources.scene.length > 0 || referenceSources.pose.length > 0) && <p className="text-[9px] text-slate-400">已引用参考图的标签自动锁定</p>}</div>
              <div className="flex flex-wrap items-center gap-2">
                <VisualTagPicker label="风格" value={style} options={mockImagePromptVisualTags.styles} onChange={(value) => updateTag('style', value)} disabled={referenceSources.style.length > 0} disabledLabel={referenceSources.style.join('、')} />
                <VisualTagPicker label="场景" value={scene} options={availableScenes} onChange={(value) => updateTag('scene', value)} disabled={referenceSources.scene.length > 0} disabledLabel={referenceSources.scene.join('、')} />
                <VisualTagPicker label="姿势" value={pose} options={availablePoses} onChange={(value) => updateTag('pose', value)} disabled={referenceSources.pose.length > 0} disabledLabel={referenceSources.pose.join('、')} />
                <label className="flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-500"><span className="material-symbols-outlined text-sm">deployed_code</span><select value={`${channel.id}:${model.id}`} onChange={(event) => chooseModel(event.target.value)} className="max-w-36 bg-transparent text-[10px] font-bold text-slate-700 outline-none">{availableModels.map((item) => <option key={`${item.channel.id}:${item.model.id}`} value={`${item.channel.id}:${item.model.id}`}>{item.model.name}</option>)}</select></label>
                <label className="flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-500"><span className="material-symbols-outlined text-sm">aspect_ratio</span><select value={ratio} onChange={(event) => setRatio(event.target.value)} className="bg-transparent text-[10px] font-bold text-slate-700 outline-none">{model.capability.ratios.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label className="flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-500"><span className="material-symbols-outlined text-sm">high_quality</span><select value={resolution} onChange={(event) => setResolution(event.target.value)} className="bg-transparent text-[10px] font-bold text-slate-700 outline-none">{model.capability.resolutions.map((item) => <option key={item}>{item}</option>)}</select></label>
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-[9px] text-slate-400"><span>{totalCount} 张 · {resolution} · {channel.health === 'healthy' ? '服务健康' : '服务受限'}</span><span>商品结构与事实约束已启用</span></div>
              {!isSupported && <p className="mt-2 rounded bg-red-50 px-2 py-2 text-[9px] font-bold text-red-700">当前参考图数量、图片张数或输出规格不受所选模型支持，请调整。</p>}
            </div>
          </div>
        </section>

        <section id="image-settings-section" className="flex min-h-[520px] min-w-0 flex-col rounded-md border border-slate-200 bg-white lg:min-h-0">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-3"><h2 className="text-xs font-black">本次生成结果</h2><span className="rounded bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-700">待生成 · {totalCount} 张</span></div>
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <span className="material-symbols-outlined grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-2xl text-slate-400">imagesmode</span>
            <p className="mt-4 text-xs font-black text-slate-700">结果将在这里显示</p>
            <p className="mt-2 max-w-52 text-[10px] leading-5 text-slate-400">生成任务提交后将进入任务列表，可继续查看进度与结果。</p>
            <div className="mt-5 w-full border-y border-slate-100 py-3 text-left">
              <div className="flex justify-between text-[10px]"><span className="text-slate-400">图片类型</span><span className="font-bold text-slate-700">{selectedTypes.length} 类</span></div>
              <div className="mt-2 flex justify-between text-[10px]"><span className="text-slate-400">生成数量</span><span className="font-bold text-slate-700">{totalCount} 张</span></div>
              <div className="mt-2 flex justify-between text-[10px]"><span className="text-slate-400">预计费用</span><span className="font-bold text-slate-700">¥ {(model.cost * totalCount).toFixed(2)}</span></div>
              <div className="mt-2 flex justify-between text-[10px]"><span className="text-slate-400">输出规格</span><span className="font-bold text-slate-700">{ratio} · {resolution}</span></div>
            </div>
          </div>
          <div className="border-t border-slate-100 p-3"><button onClick={checkAndGenerate} className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#df5b43] text-xs font-bold text-white hover:bg-[#cb4d37]"><span className="material-symbols-outlined text-base">auto_awesome</span>检查并生成 {totalCount} 张</button><p className="mt-2 text-center text-[9px] leading-4 text-slate-400">提交前会展示费用、耗时与失败兜底策略。</p></div>
        </section>
      </main>

      {executionConfirmOpen && <ExecutionConfirmDialog title={`确认生成 ${selectedTypes.length} 个图片类型`} description="已按当前 Prompt、模型能力与结构化输出参数完成预检。确认费用后，任务将进入排队。" estimatedCost={`¥ ${(model.cost * totalCount).toFixed(2)}`} estimatedDuration={`${Math.max(1, Math.ceil(totalCount / 2))}–${Math.max(2, Math.ceil(totalCount * 0.8))} 分钟`} healthLabel={channel.health === 'healthy' ? '服务健康' : '额度偏低'} healthDetail={channel.quotaText} fallbackPolicy="同配置最多自动重试 1 次；仍失败则停止并通知，不自动切换其他付费通道。" summary={[{ label: '图片类型', value: selectedTypes.map((type) => IMAGE_GENERATION_TYPE_LABELS[type]).join('、') }, { label: '主体素材', value: subjectName }, { label: '模型', value: model.name }, { label: '输出规格', value: `${ratio} · ${resolution} · ${totalCount} 张` }]} requestLines={[`参考图：${orderedReferences.length ? orderedReferences.map((item) => `参考图 ${item.position}（${orderReferenceRoles(item.roles).map((role) => REFERENCE_ROLE_LABELS[role]).join('、') || '未设标签'}）`).join('、') : '未使用参考图'}`, `参数：ratio=${ratio}，resolution=${resolution}，count=${totalCount}`]} onCancel={() => setExecutionConfirmOpen(false)} onConfirm={submitTasks} />}
      <TemplatePickerDrawer open={templatePickerOpen} templates={templates} mediaType="image" onClose={() => setTemplatePickerOpen(false)} onSelect={applyTemplate} />
    </div>
  );
};
