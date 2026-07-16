import React, { useMemo, useState } from 'react';
import {
  AppScreen,
  GenerationTask,
  ImageGenerationType,
  IMAGE_GENERATION_TYPE_LABELS,
  ProductAsset,
} from '../types';
import { imageTypePromptHints, mockModelChannels, mockReferenceAnalysisByFileId } from '../mockData';
import type { AssetResourceItem } from '../api/modules/asset';

interface CreateImageTaskProps {
  products: ProductAsset[];
  onAddTask: (task: GenerationTask) => void;
  setScreen: (screen: AppScreen) => void;
  openTransit: (onConfirmSelection: (assets: AssetResourceItem[]) => void, targetSlot?: string) => void;
  selectedProduct: ProductAsset;
  setSelectedProduct: (product: ProductAsset) => void;
}

interface TaskReference {
  id: string;
  role: string;
  name: string;
  source: string;
  active: boolean;
  thumbnailUrl?: string;
  productAssetId?: string;
}

interface ProductFacts {
  name: string;
  sellingPoints: string;
  category: string;
  color: string;
  patternAndMaterial: string;
  structure: string;
}

type ReferenceSlot = 'detail' | 'style' | 'scene' | 'pose' | 'model';

const REFERENCE_SLOTS: { id: ReferenceSlot; label: string; role: string; transitSlot: string; icon: string }[] = [
  { id: 'detail', label: '细节', role: '细节参考', transitSlot: 'reference-detail', icon: 'zoom_in' },
  { id: 'style', label: '风格', role: '风格参考', transitSlot: 'reference-style', icon: 'palette' },
  { id: 'scene', label: '场景', role: '场景参考', transitSlot: 'reference-scene', icon: 'landscape' },
  { id: 'pose', label: '姿势', role: '姿势参考', transitSlot: 'reference-pose', icon: 'accessibility_new' },
  { id: 'model', label: '模特', role: '模特参考', transitSlot: 'reference-model', icon: 'face_3' },
];

const TYPE_ORDER: ImageGenerationType[] = ['product_main', 'scene_detail', 'detail_closeup', 'on_model'];
const MIN_TYPE_COUNT = 1;
const MAX_TYPE_COUNT = 5;
const PRESETS = [
  { name: '电商主图推荐', ratio: '1:1', resolution: '2048px' },
  { name: '详情页长图', ratio: '3:4', resolution: '1536px' },
  { name: '内容种草竖图', ratio: '4:5', resolution: '1536px' },
];
const STYLE_OPTIONS = [
  '甜美网红风 (Sweet Influencer)',
  '极简北欧风 (Minimalist Nordic)',
  '科技赛博风 (Cyberpunk Cyber)',
  '金秋自然风 (Autumn Natural)',
  '奢华丝绸风 (Elegant Silk Satin)',
];
const POSE_OPTIONS = ['自然站姿', '正面站姿', '轻松坐姿', '行走动态'];
const TASK_TEMPLATES = [
  { name: '商品商业展示模板 v2.1', description: '适合商品主图与详情场景，优先保持主体准确。' },
  { name: '服装上身展示模板', description: '适合服饰上身和三视图，强调版型与穿着关系。' },
  { name: '细节材质强化模板', description: '适合局部细节与材质展示，突出纹理和工艺。' },
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

const EMPTY_PRODUCT_FACTS: ProductFacts = {
  name: '',
  sellingPoints: '',
  category: '',
  color: '',
  patternAndMaterial: '',
  structure: '',
};

const PRODUCT_FACT_FIELDS: { key: keyof ProductFacts; label: string }[] = [
  { key: 'name', label: '商品名称' },
  { key: 'sellingPoints', label: '核心卖点' },
  { key: 'category', label: '品类' },
  { key: 'color', label: '颜色' },
  { key: 'patternAndMaterial', label: '图案 / 材质' },
  { key: 'structure', label: '版型 / 结构' },
];

const extractProductFacts = (product: ProductAsset): ProductFacts => ({
  name: product.name,
  sellingPoints: product.specs.sellingPoints.join(' · '),
  category: product.category,
  color: product.specs.color.join(' · '),
  patternAndMaterial: product.fabric ?? product.specs.material,
  structure: product.category === '户外服饰' ? '以来源素材中的版型和剪裁为准' : '以来源素材中的商品结构为准',
});

export const CreateImageTask: React.FC<CreateImageTaskProps> = ({
  products,
  onAddTask,
  setScreen,
  openTransit,
  selectedProduct,
  setSelectedProduct,
}) => {
  const [selectedTypes, setSelectedTypes] = useState<ImageGenerationType[]>(['product_main']);
  const [style, setStyle] = useState(STYLE_OPTIONS[0]);
  const [scene, setScene] = useState('自然影棚');
  const [pose, setPose] = useState(POSE_OPTIONS[0]);
  const [template, setTemplate] = useState('商品商业展示模板 v2.1');
  const [negativePrompt, setNegativePrompt] = useState('模糊、商品漂移、错误文字、材质失真');
  const [ratio, setRatio] = useState('1:1');
  const [typeCounts, setTypeCounts] = useState<Record<ImageGenerationType, number>>({
    product_main: 1,
    scene_detail: 1,
    detail_closeup: 1,
    on_model: 1,
  });
  const [resolution, setResolution] = useState('2048px');
  const [reviewEnabled, setReviewEnabled] = useState(true);
  const [channelId, setChannelId] = useState('cloud-vision');
  const [modelId, setModelId] = useState('gpt-image-2');
  const [assistantState, setAssistantState] = useState<'idle' | 'processing' | 'complete'>('idle');
  const [productFacts, setProductFacts] = useState<ProductFacts>(EMPTY_PRODUCT_FACTS);
  const [factsConfirmed, setFactsConfirmed] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<{ channelId: string; modelId: string } | null>(null);
  const [mainAsset, setMainAsset] = useState<TaskReference | null>(null);
  const [topAsset, setTopAsset] = useState<TaskReference | null>(null);
  const [bottomAsset, setBottomAsset] = useState<TaskReference | null>(null);
  const [compositeState, setCompositeState] = useState<'idle' | 'processing' | 'ready'>('idle');
  const [references, setReferences] = useState<Partial<Record<ReferenceSlot, TaskReference>>>({});
  const [referenceInsights, setReferenceInsights] = useState<Partial<Record<ReferenceSlot, string>>>({});
  const [referenceOrder, setReferenceOrder] = useState<Partial<Record<ReferenceSlot, number>>>({});
  const [promptOverrides, setPromptOverrides] = useState<Partial<Record<ImageGenerationType, string>>>({});
  const [promptHasEdits, setPromptHasEdits] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);
  const [templateOverwriteOpen, setTemplateOverwriteOpen] = useState(false);

  const channel = mockModelChannels.find((item) => item.id === channelId) ?? mockModelChannels[0];
  const model = channel.models.find((item) => item.id === modelId) ?? channel.models[0];
  const selectedMainProduct = mainAsset?.productAssetId
    ? products.find((product) => product.id === mainAsset.productAssetId) ?? null
    : null;
  const isProductBound = Boolean(mainAsset && selectedMainProduct);
  const taskProduct = selectedMainProduct ?? selectedProduct;
  const usesOnModel = selectedTypes.includes('on_model');
  const availableModels = useMemo(() => mockModelChannels
    .filter((item) => item.health !== 'maintenance')
    .flatMap((item) => item.models
      .filter((itemModel) => itemModel.mediaTypes.includes('image'))
      .map((itemModel) => ({ channel: item, model: itemModel }))), []);
  const hasPromptEdits = promptHasEdits;
  const totalCount = selectedTypes.reduce((total, type) => total + typeCounts[type], 0);
  const orderedReferenceInsights = useMemo(() => Object.entries(referenceInsights)
    .sort(([left], [right]) => (referenceOrder[left as ReferenceSlot] ?? 99) - (referenceOrder[right as ReferenceSlot] ?? 99))
    .map(([, insight]) => insight), [referenceInsights, referenceOrder]);

  const prompts = useMemo(() => Object.fromEntries(TYPE_ORDER.map((type) => [
    type,
    `${template}。${imageTypePromptHints[type]} 商品：${taskProduct.name}。风格：${style}；场景：${scene}${usesOnModel ? `；动作/姿势：${pose}` : ''}${orderedReferenceInsights.length ? `；参考图解析：${orderedReferenceInsights.join(' ')}` : ''}。${negativePrompt ? `负面约束：${negativePrompt}。` : ''}`,
  ])) as Record<ImageGenerationType, string>, [negativePrompt, orderedReferenceInsights, pose, scene, style, taskProduct.name, template, usesOnModel]);
  const buildPromptFromFacts = (type: ImageGenerationType, facts: ProductFacts, templateName = template) => (
    `${templateName}。${imageTypePromptHints[type]} 商品：${facts.name}；品类：${facts.category}；核心卖点：${facts.sellingPoints}；颜色：${facts.color}；图案/材质：${facts.patternAndMaterial}；版型/结构：${facts.structure}。风格：${style}；场景：${scene}${usesOnModel ? `；动作/姿势：${pose}` : ''}${orderedReferenceInsights.length ? `；参考图解析：${orderedReferenceInsights.join(' ')}` : ''}。${negativePrompt ? `负面约束：${negativePrompt}。` : ''}`
  );

  const isSupported = model.capability.ratios.includes(ratio)
    && selectedTypes.every((type) => typeCounts[type] <= model.capability.maxCount)
    && model.capability.resolutions.includes(resolution);
  const unsupported = [
    !model.capability.ratios.includes(ratio) ? `比例 ${ratio}` : null,
    selectedTypes.some((type) => typeCounts[type] > model.capability.maxCount) ? `单个图片类型张数（最大 ${model.capability.maxCount}）` : null,
    !model.capability.resolutions.includes(resolution) ? `尺寸 ${resolution}` : null,
  ].filter(Boolean);

  const setModelWithValidation = (nextChannelId: string, nextModelId: string) => {
    const nextChannel = mockModelChannels.find((item) => item.id === nextChannelId);
    const nextModel = nextChannel?.models.find((item) => item.id === nextModelId);
    if (!nextChannel || !nextModel) return;
    const incompatible = !nextModel.capability.ratios.includes(ratio)
      || selectedTypes.some((type) => typeCounts[type] > nextModel.capability.maxCount)
      || !nextModel.capability.resolutions.includes(resolution);
    if (incompatible) {
      setPendingChoice({ channelId: nextChannelId, modelId: nextModelId });
      setConflictOpen(true);
      return;
    }
    setChannelId(nextChannelId);
    setModelId(nextModelId);
  };

  const applyCompatibleModel = () => {
    if (!pendingChoice) return;
    const nextChannel = mockModelChannels.find((item) => item.id === pendingChoice.channelId)!;
    const nextModel = nextChannel.models.find((item) => item.id === pendingChoice.modelId)!;
    setChannelId(nextChannel.id);
    setModelId(nextModel.id);
    setRatio(nextModel.capability.ratios[0]);
    setTypeCounts((current) => {
      return selectedTypes.reduce((next, type) => {
        next[type] = Math.min(current[type], nextModel.capability.maxCount, MAX_TYPE_COUNT);
        return next;
      }, { ...current });
    });
    setResolution(nextModel.capability.resolutions[0]);
    setConflictOpen(false);
    setPendingChoice(null);
  };

  const applyPreset = (preset: typeof PRESETS[number]) => {
    const conflicts = !model.capability.ratios.includes(preset.ratio)
      || !model.capability.resolutions.includes(preset.resolution);
    if (conflicts) {
      setPendingChoice({ channelId, modelId });
      setConflictOpen(true);
      return;
    }
    setRatio(preset.ratio);
    setResolution(preset.resolution);
  };

  const toggleType = (type: ImageGenerationType) => {
    if (selectedTypes.includes(type)) {
      if (selectedTypes.length > 1) setSelectedTypes((previous) => previous.filter((item) => item !== type));
      return;
    }
    setTypeCounts((current) => ({ ...current, [type]: MIN_TYPE_COUNT }));
    setSelectedTypes((previous) => [...previous, type]);
  };

  const changeTypeCount = (type: ImageGenerationType, delta: number) => {
    if (!selectedTypes.includes(type)) return;
    const maximum = Math.min(MAX_TYPE_COUNT, model.capability.maxCount);
    setTypeCounts((current) => ({
      ...current,
      [type]: Math.min(maximum, Math.max(MIN_TYPE_COUNT, current[type] + delta)),
    }));
  };

  const resetFactsAndPrompts = () => {
    setProductFacts(EMPTY_PRODUCT_FACTS);
    setFactsConfirmed(false);
    setAssistantState('idle');
    setPromptOverrides({});
    setPromptHasEdits(false);
  };

  const startComposite = () => {
    if (!topAsset || !bottomAsset) return;
    setCompositeState('processing');
    window.setTimeout(() => setCompositeState('ready'), 700);
  };

  const toTaskReference = (asset: AssetResourceItem, role: string): TaskReference => {
    return {
      id: `asset-${asset.id}`,
      role,
      name: asset.name,
      source: '资源中心',
      active: true,
      thumbnailUrl: asset.thumbnailUrl ?? asset.originalUrl,
      productAssetId: asset.productAssetId,
    };
  };

  const selectMainAsset = (assets: AssetResourceItem[]) => {
    const asset = assets[0];
    if (!asset) return;
    const reference = toTaskReference(asset, '主体素材');
    setMainAsset(reference);
    const linkedProduct = reference.productAssetId
      ? products.find((product) => product.id === reference.productAssetId)
      : undefined;
    if (linkedProduct) setSelectedProduct(linkedProduct);
    resetFactsAndPrompts();
    setCompositeState('idle');
  };

  const selectGarmentAsset = (part: 'top' | 'bottom') => (assets: AssetResourceItem[]) => {
    const asset = assets[0];
    if (!asset) return;
    const reference = toTaskReference(asset, part === 'top' ? '上衣图' : '下装图');
    if (part === 'top') setTopAsset(reference);
    else setBottomAsset(reference);
    setCompositeState('idle');
  };

  const selectReferenceAsset = (slot: ReferenceSlot) => (assets: AssetResourceItem[]) => {
    const asset = assets[0];
    if (!asset) return;
    const slotDefinition = REFERENCE_SLOTS.find((item) => item.id === slot);
    const reference = toTaskReference(asset, slotDefinition?.role ?? '参考图');
    const analysis = asset.fileResourceId ? mockReferenceAnalysisByFileId[asset.fileResourceId] : undefined;
    setReferences((current) => ({ ...current, [slot]: reference }));
    setReferenceOrder((current) => ({ ...current, [slot]: current[slot] ?? Object.keys(current).length + 1 }));
    if (analysis) {
      setReferenceInsights((current) => ({ ...current, [slot]: analysis.promptHint }));
      if (analysis.style) setStyle(analysis.style);
      if (analysis.scene) setScene(analysis.scene);
      if (analysis.pose) setPose(analysis.pose);
    }
  };

  const submitTasks = () => {
    if (!isProductBound || !isSupported) return;
    const groupId = `G-${Date.now()}`;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const outputPreviewUrl = compositeState === 'ready'
      ? topAsset?.thumbnailUrl ?? taskProduct.thumbnail
      : mainAsset?.thumbnailUrl ?? taskProduct.thumbnail;
    selectedTypes.forEach((imageType, index) => {
      const task: GenerationTask = {
        id: `I-${Date.now()}-${index + 1}`,
        groupId,
        name: `${IMAGE_GENERATION_TYPE_LABELS[imageType]} · ${taskProduct.name}`,
        type: 'image',
        imageType,
        status: 'running',
        progress: 0,
        productName: taskProduct.name,
        productImg: outputPreviewUrl,
        templateName: template,
        timestamp: now,
        creator: '陆永奇',
        modelChannel: `${channel.name} / ${model.name}`,
        taskPrompt: promptOverrides[imageType] ?? prompts[imageType],
        negativePrompt,
        reviewStrategy: { aesthetic: reviewEnabled, listing: false },
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
        params: { ratio, count: typeCounts[imageType], prompt: promptOverrides[imageType] ?? prompts[imageType], negativePrompt },
      };
      onAddTask(task);
      window.setTimeout(() => onAddTask({
        ...task,
        status: reviewEnabled ? 'candidate' : 'archived',
        progress: 100,
        resultUrl: outputPreviewUrl,
        results: Array.from({ length: typeCounts[imageType] }, (_, resultIndex) => ({
          id: `${task.id}-r${resultIndex + 1}`,
          url: outputPreviewUrl,
          version: resultIndex + 1,
          reviewStage: reviewEnabled ? 'candidate' : 'approved' as const,
        })),
      }), 900 + index * 250);
    });
    setScreen(AppScreen.TASKS);
  };

  const runAssistantAnalysis = () => {
    if (!isProductBound || assistantState === 'processing') return;
    setAssistantState('processing');
    window.setTimeout(() => {
      const nextFacts = extractProductFacts(taskProduct);
      setProductFacts(nextFacts);
      setFactsConfirmed(false);
      setPromptOverrides(Object.fromEntries(selectedTypes.map((type) => [
        type,
        buildPromptFromFacts(type, nextFacts),
      ])));
      setPromptHasEdits(true);
      setAssistantState('complete');
    }, 500);
  };

  const updateProductFact = (key: keyof ProductFacts, value: string) => {
    setProductFacts((previous) => ({ ...previous, [key]: value }));
    setFactsConfirmed(false);
  };

  const applyTemplate = (nextTemplate: string) => {
    setTemplate(nextTemplate);
    setPromptOverrides(productFacts.name
      ? Object.fromEntries(selectedTypes.map((type) => [type, buildPromptFromFacts(type, productFacts, nextTemplate)]))
      : {});
    setPromptHasEdits(false);
    setTemplatePickerOpen(false);
    setTemplateOverwriteOpen(false);
    setPendingTemplate(null);
  };

  const requestTemplateChange = (nextTemplate: string) => {
    if (nextTemplate === template) {
      setTemplatePickerOpen(false);
      return;
    }
    if (hasPromptEdits) {
      setPendingTemplate(nextTemplate);
      setTemplatePickerOpen(false);
      setTemplateOverwriteOpen(true);
      return;
    }
    applyTemplate(nextTemplate);
  };

  const updateReferenceOrder = (slot: ReferenceSlot, nextOrder: number) => {
    setReferenceOrder((current) => {
      const currentOrder = current[slot];
      const swapSlot = (Object.keys(current) as ReferenceSlot[]).find((item) => item !== slot && current[item] === nextOrder);
      return {
        ...current,
        [slot]: nextOrder,
        ...(swapSlot && currentOrder ? { [swapSlot]: currentOrder } : {}),
      };
    });
  };

  return (
    <div className="h-screen overflow-hidden bg-[#f5f7fb] text-slate-800 flex flex-col" id="create-image-task-container">
      <header className="h-16 shrink-0 px-6 bg-white border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setScreen(AppScreen.TASKS)} className="w-8 h-8 rounded-md hover:bg-slate-100 text-slate-500" title="返回任务列表"><span className="material-symbols-outlined">arrow_back</span></button>
          <div><p className="text-[11px] font-bold text-primary">图片任务工作台</p><h1 className="text-base font-black">新建多类型图片任务</h1></div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">已选择 <b className="text-slate-800">{selectedTypes.length}</b> 个图片类型，共 <b className="text-slate-800">{totalCount}</b> 张</span>
          <button onClick={submitTasks} disabled={!isProductBound || !isSupported} className="h-9 px-4 rounded-md bg-primary disabled:bg-slate-300 text-white text-xs font-bold shadow-sm">提交 {selectedTypes.length} 条任务</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-5 grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_380px] gap-5">
        <section className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between"><h2 className="text-sm font-black">输入素材</h2><button onClick={() => openTransit(selectMainAsset, 'main')} className="text-xs text-primary font-bold">资源中心</button></div>
            {compositeState === 'ready' && topAsset && bottomAsset ? (
              <div className="mt-3 h-44 rounded-md border border-emerald-200 bg-emerald-50 overflow-hidden relative">
                <div className="grid grid-cols-2 h-full"><img src={topAsset.thumbnailUrl} alt="上衣合成素材" className="w-full h-full object-cover" referrerPolicy="no-referrer" /><img src={bottomAsset.thumbnailUrl} alt="下装合成素材" className="w-full h-full object-cover" referrerPolicy="no-referrer" /></div>
                <span className="absolute left-2 bottom-2 px-2 py-1 rounded bg-emerald-600 text-[10px] font-bold text-white">上下装合成预览</span>
              </div>
            ) : mainAsset?.thumbnailUrl ? (
              <button onClick={() => openTransit(selectMainAsset, 'main')} className="mt-3 w-full text-left"><img src={mainAsset.thumbnailUrl} alt={mainAsset.name} className="w-full h-44 object-cover rounded-md border border-slate-100" referrerPolicy="no-referrer" /><p className="mt-2 text-xs font-bold leading-5">{mainAsset.name}</p></button>
            ) : (
              <button onClick={() => openTransit(selectMainAsset, 'main')} className="mt-3 w-full h-44 rounded-md border-2 border-dashed border-slate-300 bg-slate-50 hover:border-primary hover:bg-blue-50 transition-colors flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-primary" title="从资源中心选择主体素材"><span className="material-symbols-outlined text-4xl">add</span><span className="text-xs font-bold">添加主体素材</span></button>
            )}
            {mainAsset && selectedMainProduct && <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2"><span className="block text-[10px] text-slate-400">已关联商品资产</span><span className="mt-0.5 block text-xs font-bold text-slate-700">{selectedMainProduct.name}</span><span className="block text-[11px] text-slate-400">SKU：{selectedMainProduct.sku}</span></div>}
            {mainAsset && !selectedMainProduct && <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-700"><b className="font-bold">该主体素材未关联商品资产。</b> 请先在素材库关联或创建商品资产，再继续解析和提交。</div>}
          </div>
          {taskProduct.category === '户外服饰' && <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between"><h2 className="text-sm font-black">上下装合成套图</h2><span className="text-[10px] text-slate-400">可选</span></div>
            {([{ label: '上衣图', asset: topAsset, targetSlot: 'upper', select: selectGarmentAsset('top'), clear: () => { setTopAsset(null); setCompositeState('idle'); } }, { label: '下装图', asset: bottomAsset, targetSlot: 'lower', select: selectGarmentAsset('bottom'), clear: () => { setBottomAsset(null); setCompositeState('idle'); } }]).map((item) => {
              return <div key={item.label} className="relative"><button onClick={() => openTransit(item.select, item.targetSlot)} className="w-full h-16 rounded-md border border-dashed border-slate-300 hover:border-primary flex items-center px-3 gap-3 text-left overflow-hidden">
                {item.asset?.thumbnailUrl ? <img src={item.asset.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover" referrerPolicy="no-referrer" /> : <span className="material-symbols-outlined text-slate-400">add_photo_alternate</span>}<span className="text-xs min-w-0"><b className="block text-slate-700">{item.label}</b><span className="block truncate text-slate-400">{item.asset ? item.asset.name : '从资源中心选择'}</span></span>
              </button>{item.asset && <button onClick={item.clear} className="absolute right-2 top-2 w-5 h-5 rounded-full bg-white/90 text-slate-400 hover:text-red-500" title={`移除${item.label}`}><span className="material-symbols-outlined text-sm">close</span></button>}</div>;
            })}
            <button onClick={startComposite} disabled={!topAsset || !bottomAsset || compositeState === 'processing'} className="w-full h-8 rounded bg-slate-900 disabled:bg-slate-200 text-white text-xs font-bold">{compositeState === 'processing' ? '合成中...' : compositeState === 'ready' ? '重新生成合成预览' : '生成合成预览'}</button>
            {compositeState === 'ready' && <div className="rounded bg-emerald-50 border border-emerald-100 p-2 text-[11px] text-emerald-700">合成预览已显示在上方输入素材区，并会作为本次任务主体图。</div>}
          </div>}
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h2 className="text-sm font-black">参考图 <span className="font-normal text-slate-400">(选传)</span></h2><p className="mt-1 text-[11px] leading-5 text-slate-400">用于补充细节、风格、场景、姿势或模特，不直接替代主体。</p>
            <div className="grid grid-cols-2 gap-2 mt-3">{REFERENCE_SLOTS.map((slot, index) => {
              const reference = references[slot.id];
              return <div key={slot.id} className="min-w-0"><button onClick={() => openTransit(selectReferenceAsset(slot.id), slot.transitSlot)} className={`relative w-full h-16 rounded-md border-2 border-dashed overflow-hidden flex items-center gap-2 px-2 text-left transition-colors ${reference ? 'border-primary bg-blue-50' : 'border-slate-200 hover:border-primary bg-slate-50'}`} title={`选择${slot.label}参考图`}>
                {reference?.thumbnailUrl ? <><img src={reference.thumbnailUrl} alt={slot.label} className="w-10 h-10 rounded object-cover" referrerPolicy="no-referrer" /><span className="min-w-0 text-[11px] font-bold text-primary truncate">{reference.name}</span></> : <><span className="material-symbols-outlined text-2xl text-slate-400">add</span><span className="text-[11px] text-slate-400">添加{slot.label}参考</span></>}
              </button><div className="mt-1 flex items-center justify-between gap-1"><span className={`text-[11px] font-bold ${reference ? 'text-primary' : 'text-slate-400'}`}>{slot.label}参考</span>{reference && <><label className="text-[10px] text-slate-400">顺序<select value={referenceOrder[slot.id] ?? index + 1} onChange={(event) => updateReferenceOrder(slot.id, Number(event.target.value))} className="ml-1 h-5 border border-slate-200 bg-white text-[10px]">{REFERENCE_SLOTS.map((item, orderIndex) => <option key={item.id} value={orderIndex + 1}>{orderIndex + 1}</option>)}</select></label><button onClick={() => { setReferences((current) => ({ ...current, [slot.id]: undefined })); setReferenceInsights((current) => ({ ...current, [slot.id]: undefined })); setReferenceOrder((current) => ({ ...current, [slot.id]: undefined })); }} className="text-[10px] text-slate-400 hover:text-red-500">移除</button></>}</div></div>;
            })}</div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3"><div><p className="text-[11px] font-bold text-primary">任务配置</p><h2 className="text-base font-black">用户希望得到什么结果</h2></div><span className="text-[11px] text-slate-400">规格选项由所选模型提供</span></div>
            <label className="text-xs font-bold text-slate-700">生成图片类型 <span className="text-slate-400 font-normal">可多选</span></label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-1.5">{TYPE_ORDER.map((type) => {
              const isSelected = selectedTypes.includes(type);
              const canDecrease = isSelected && typeCounts[type] > MIN_TYPE_COUNT;
              const canIncrease = isSelected && typeCounts[type] < Math.min(MAX_TYPE_COUNT, model.capability.maxCount);
              return <div key={type} className={`relative min-h-[76px] border rounded-md transition-colors ${isSelected ? 'border-primary bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <button onClick={() => toggleType(type)} className="absolute inset-0 flex items-center gap-2 rounded-md px-3 pr-24 text-left" title={`${isSelected ? '取消选择' : '选择'}${IMAGE_GENERATION_TYPE_LABELS[type]}`}><span className={`material-symbols-outlined shrink-0 text-xl ${isSelected ? 'text-primary' : 'text-slate-500'}`}>{typeIcon[type]}</span><span className="min-w-0 text-xs font-bold leading-4 text-slate-800">{typeCompactLabel[type]}</span><span className={`absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded border ${isSelected ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white'}`}>{isSelected && <span className="material-symbols-outlined text-[11px]">check</span>}</span></button>
                {isSelected && <div className="absolute bottom-2 right-2 z-10 flex h-7 items-center rounded border border-blue-200 bg-white shadow-sm"><button onClick={() => changeTypeCount(type, -1)} disabled={!canDecrease} className="w-7 h-full text-slate-500 disabled:text-slate-300 hover:text-primary" title="减少一张"><span className="material-symbols-outlined text-base">remove</span></button><span className="w-7 border-x border-blue-100 text-center text-xs font-black leading-7 text-slate-700">{typeCounts[type]}</span><button onClick={() => changeTypeCount(type, 1)} disabled={!canIncrease} className="w-7 h-full text-slate-500 disabled:text-slate-300 hover:text-primary" title={typeCounts[type] >= MAX_TYPE_COUNT ? `每个图片类型最多 ${MAX_TYPE_COUNT} 张` : `当前模型最多生成 ${model.capability.maxCount} 张`}><span className="material-symbols-outlined text-base">add</span></button></div>}
              </div>;
            })}</div>
            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
              <div className="relative text-xs font-bold text-slate-700"><span>当前模板</span><div className="mt-1.5 flex h-9 items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2"><span className="min-w-0 truncate text-xs font-medium">{template}</span><button onClick={() => setTemplatePickerOpen((open) => !open)} className="shrink-0 text-[11px] font-bold text-primary">更换模板</button></div>{templatePickerOpen && <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white p-1 shadow-lg">{TASK_TEMPLATES.map((item) => <button key={item.name} onClick={() => requestTemplateChange(item.name)} className={`w-full rounded px-2 py-2 text-left hover:bg-slate-50 ${item.name === template ? 'bg-blue-50 text-primary' : ''}`}><span className="block text-[11px] font-bold">{item.name}</span><span className="block mt-0.5 text-[10px] font-normal text-slate-400">{item.description}</span></button>)}</div>}</div>
              {[['风格', style, setStyle, STYLE_OPTIONS], ['场景', scene, setScene, ['自然影棚', '城市街景', '居家陈列']], ['姿势', pose, setPose, POSE_OPTIONS]].map(([label, value, setter, options]) => <label key={String(label)} className="text-xs font-bold text-slate-700">{String(label)}<select value={value as string} onChange={(event) => (setter as (value: string) => void)(event.target.value)} className="mt-1.5 w-full h-9 px-2 rounded border border-slate-200 bg-white text-xs font-medium">{(options as string[]).map((option) => <option key={option}>{option}</option>)}</select></label>)}
            </div>
            <details className="mt-4 border-t border-slate-100 pt-4"><summary className="cursor-pointer text-xs font-bold text-slate-600">高级设置</summary><label className="mt-3 block text-xs font-bold text-slate-700">负面约束<input value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} className="mt-1.5 w-full h-9 px-2 rounded border border-slate-200 text-xs font-medium" /></label><p className="mt-1.5 text-[10px] text-slate-400">默认沿用当前模板的约束，可按本次任务覆盖。</p></details>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between"><div><p className="text-[11px] font-bold text-primary">任务级 Prompt 副本</p><h2 className="text-base font-black">每种图片各自编辑</h2></div><button onClick={runAssistantAnalysis} disabled={!isProductBound || assistantState === 'processing'} className="h-8 px-3 border border-blue-200 bg-blue-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 text-primary text-xs font-bold rounded-md flex gap-1 items-center"><span className={`material-symbols-outlined text-base ${assistantState === 'processing' ? 'animate-pulse' : ''}`}>auto_awesome</span>{assistantState === 'processing' ? 'AI 解析中' : assistantState === 'complete' ? '重新生成' : 'AI 助手'}</button></div>
            {!isProductBound && <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">先选择已关联商品资产的主体素材，才能确认商品事实、生成 Prompt 和提交任务。</div>}
            {assistantState !== 'idle' && <div className={`mt-4 flex items-center gap-2 rounded-md border px-3 py-2 text-[11px] ${assistantState === 'complete' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-100 bg-blue-50 text-primary'}`}><span className="material-symbols-outlined text-sm">{assistantState === 'complete' ? 'check_circle' : 'progress_activity'}</span>{assistantState === 'complete' ? '已基于商品事实写入当前任务的 Prompt 副本，可在下方继续编辑。' : '正在提取商品名称、卖点、品类、颜色、图案和结构，并初始化 Prompt…'}</div>}
            <div className="mt-4 border-y border-slate-100 py-3">
              <div className="flex items-start justify-between gap-3"><div><h3 className="text-xs font-black">商品事实确认</h3><p className="mt-1 text-[11px] text-slate-400">随任务常驻保存，是 AI 推荐和 Prompt 初始化的事实依据。</p></div><span className={`shrink-0 px-2 py-1 rounded text-[10px] font-bold ${factsConfirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{factsConfirmed ? '已确认' : '待确认'}</span></div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">{PRODUCT_FACT_FIELDS.map((field) => <label key={field.key} className="min-w-0 rounded border border-slate-200 bg-slate-50 px-2 py-1.5"><span className="block text-[10px] text-slate-400">{field.label}</span><input disabled={!isProductBound} value={productFacts[field.key]} onChange={(event) => updateProductFact(field.key, event.target.value)} placeholder="待 AI 解析" className="mt-0.5 w-full min-w-0 bg-transparent outline-none disabled:cursor-not-allowed text-[11px] font-bold text-slate-700 placeholder:text-slate-300" /></label>)}</div>
              <div className="mt-3 flex items-center justify-between gap-3"><p className="text-[10px] leading-4 text-slate-400">修改事实不会自动覆盖下方 Prompt；需要重写时点击 AI 助手。</p><button onClick={() => setFactsConfirmed(true)} disabled={!isProductBound} className="shrink-0 h-7 px-2.5 rounded border border-slate-200 bg-white disabled:bg-slate-100 disabled:text-slate-400 text-[11px] font-bold text-slate-600 hover:border-primary hover:text-primary">确认商品事实</button></div>
            </div>
            <div className="mt-4 space-y-3">{selectedTypes.map((type) => <div key={type} className="border border-slate-200 rounded-md overflow-hidden"><div className="px-3 py-2 bg-slate-50 flex justify-between"><span className="text-xs font-black">{IMAGE_GENERATION_TYPE_LABELS[type]}</span><span className="text-[10px] text-slate-400">来源：{template}</span></div><textarea disabled={!isProductBound} value={promptOverrides[type] ?? prompts[type]} onChange={(event) => { setPromptOverrides((previous) => ({ ...previous, [type]: event.target.value })); setPromptHasEdits(true); }} className="w-full h-24 resize-none p-3 outline-none disabled:bg-slate-50 disabled:text-slate-400 text-xs leading-5" /></div>)}</div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <p className="text-[11px] font-bold text-primary">执行参数</p><h2 className="text-base font-black mt-1">模型与输出规格</h2><p className="mt-1 text-[11px] text-slate-400">仅展示当前可用模型；成本、耗时和执行风险将在提交前确认。</p>
            <label className="block mt-4 text-xs font-bold">模型<select value={`${channel.id}:${model.id}`} onChange={(event) => { const choice = availableModels.find((item) => `${item.channel.id}:${item.model.id}` === event.target.value); if (choice) setModelWithValidation(choice.channel.id, choice.model.id); }} className="mt-1.5 w-full h-9 rounded border border-slate-200 px-2 text-xs">{availableModels.map((item) => <option key={`${item.channel.id}:${item.model.id}`} value={`${item.channel.id}:${item.model.id}`}>{item.model.name} · {item.model.description}</option>)}</select></label>
            <div className="mt-4"><span className="text-xs font-bold">平台规格推荐</span><div className="flex flex-wrap gap-2 mt-2">{PRESETS.map((preset) => <button key={preset.name} onClick={() => applyPreset(preset)} className="px-2 py-1.5 text-[11px] font-bold rounded border border-slate-200 hover:border-primary hover:text-primary">{preset.name}</button>)}</div></div>
            <label className="block mt-4 text-xs font-bold">比例<select value={ratio} onChange={(event) => setRatio(event.target.value)} className="mt-1.5 w-full h-9 rounded border border-slate-200 px-2 text-xs">{model.capability.ratios.map((item) => <option key={item}>{item}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-3 mt-3"><div className="text-xs font-bold">本次总张数<div className="mt-1.5 flex h-9 items-center justify-between rounded border border-slate-200 bg-slate-50 px-2"><span className="text-sm font-black text-slate-800">{totalCount} 张</span><span className="text-[10px] font-normal text-slate-400">{selectedTypes.length} 个类型</span></div></div><label className="text-xs font-bold">图片尺寸<select value={resolution} onChange={(event) => setResolution(event.target.value)} className="mt-1.5 w-full h-9 rounded border border-slate-200 px-2 text-xs">{model.capability.resolutions.map((item) => <option key={item}>{item}</option>)}</select></label></div>
            {!isSupported && <p className="mt-3 p-2 rounded bg-red-50 text-red-700 text-[11px]">当前规格不受所选模型支持：{unsupported.join('、')}</p>}
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-5"><h3 className="text-sm font-black">审核策略</h3><label className="mt-3 flex items-center justify-between text-xs font-bold">启用评分审核<input checked={reviewEnabled} onChange={(event) => setReviewEnabled(event.target.checked)} type="checkbox" className="accent-primary" /></label><p className="mt-2 text-[11px] text-slate-400">一次完成评分与通过/打回决策；通过后可创建视频。</p></div>
        </section>
      </main>

      {conflictOpen && pendingChoice && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-900/40" /><div className="relative bg-white rounded-lg w-full max-w-md p-6 shadow-xl"><div className="flex gap-3"><span className="material-symbols-outlined text-amber-500">warning</span><div><h2 className="font-black">模型能力与当前规格冲突</h2><p className="mt-2 text-xs text-slate-500 leading-5">目标模型不支持当前的 {unsupported.length ? unsupported.join('、') : '输出规格'}。确认后将自动切换到该模型首个可用比例、尺寸，并将张数限制在上限内。</p></div></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => { setConflictOpen(false); setPendingChoice(null); }} className="h-8 px-3 text-xs font-bold border border-slate-200 rounded">保留当前选择</button><button onClick={applyCompatibleModel} className="h-8 px-3 text-xs font-bold text-white bg-primary rounded">确认调整</button></div></div></div>}
      {templateOverwriteOpen && pendingTemplate && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-900/40" /><div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl"><div className="flex gap-3"><span className="material-symbols-outlined text-amber-500">warning</span><div><h2 className="font-black">覆盖当前任务级 Prompt？</h2><p className="mt-2 text-xs leading-5 text-slate-500">已由 AI 或人工改写的 Prompt 会被“{pendingTemplate}”重新初始化。本次任务之外的模板和任务不会受影响。</p></div></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => { setTemplateOverwriteOpen(false); setPendingTemplate(null); }} className="h-8 rounded border border-slate-200 px-3 text-xs font-bold">保留当前 Prompt</button><button onClick={() => applyTemplate(pendingTemplate)} className="h-8 rounded bg-primary px-3 text-xs font-bold text-white">覆盖并更换</button></div></div></div>}
    </div>
  );
};
