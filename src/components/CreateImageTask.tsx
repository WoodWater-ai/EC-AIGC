import React, { useMemo, useState } from 'react';
import {
  AppScreen,
  GenerationTask,
  ImageGenerationType,
  IMAGE_GENERATION_TYPE_LABELS,
  MockModelDefinition,
  ProductAsset,
} from '../types';
import { imageTypePromptHints, mockAssetResources, mockModelChannels, mockModelProfiles, mockReferenceAnalysisByFileId } from '../mockData';

interface CreateImageTaskProps {
  products: ProductAsset[];
  onAddTask: (task: GenerationTask) => void;
  setScreen: (screen: AppScreen) => void;
  openTransit: (onConfirmSelection: (fileResourceIds: number[]) => void, targetSlot?: string) => void;
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
}

type ReferenceSlot = 'detail' | 'style' | 'scene' | 'pose';

const REFERENCE_SLOTS: { id: ReferenceSlot; label: string; role: string; transitSlot: string; icon: string }[] = [
  { id: 'detail', label: '细节', role: '细节参考', transitSlot: 'reference-detail', icon: 'zoom_in' },
  { id: 'style', label: '风格', role: '风格参考', transitSlot: 'reference-style', icon: 'palette' },
  { id: 'scene', label: '场景', role: '场景参考', transitSlot: 'reference-scene', icon: 'landscape' },
  { id: 'pose', label: '姿势', role: '姿势参考', transitSlot: 'reference-pose', icon: 'accessibility_new' },
];

const TYPE_ORDER: ImageGenerationType[] = ['product_main', 'scene_detail', 'detail_closeup', 'on_model'];
const PRESETS = [
  { name: '电商主图推荐', ratio: '1:1', count: 4, resolution: '2048px' },
  { name: '详情页长图', ratio: '3:4', count: 4, resolution: '1536px' },
  { name: '内容种草竖图', ratio: '4:5', count: 2, resolution: '1536px' },
];
const STYLE_OPTIONS = [
  '甜美网红风 (Sweet Influencer)',
  '极简北欧风 (Minimalist Nordic)',
  '科技赛博风 (Cyberpunk Cyber)',
  '金秋自然风 (Autumn Natural)',
  '奢华丝绸风 (Elegant Silk Satin)',
];

const typeIcon: Record<ImageGenerationType, string> = {
  product_main: 'inventory_2',
  scene_detail: 'landscape',
  detail_closeup: 'zoom_in',
  on_model: 'accessibility_new',
};

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
  const [pose, setPose] = useState('自然正面');
  const [template, setTemplate] = useState('商品商业展示模板 v2.1');
  const [negativePrompt, setNegativePrompt] = useState('模糊、商品漂移、错误文字、材质失真');
  const [ratio, setRatio] = useState('1:1');
  const [count, setCount] = useState(4);
  const [resolution, setResolution] = useState('2048px');
  const [reviewEnabled, setReviewEnabled] = useState(true);
  const [channelId, setChannelId] = useState('cloud-vision');
  const [modelId, setModelId] = useState('gpt-image-2');
  const [selectedProfileId, setSelectedProfileId] = useState<string | 'none'>('model-1');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<{ channelId: string; modelId: string } | null>(null);
  const [mainAsset, setMainAsset] = useState<TaskReference | null>(null);
  const [topAsset, setTopAsset] = useState<TaskReference | null>(null);
  const [bottomAsset, setBottomAsset] = useState<TaskReference | null>(null);
  const [compositeState, setCompositeState] = useState<'idle' | 'processing' | 'ready'>('idle');
  const [references, setReferences] = useState<Partial<Record<ReferenceSlot, TaskReference>>>({});
  const [referenceInsights, setReferenceInsights] = useState<Partial<Record<ReferenceSlot, string>>>({});

  const channel = mockModelChannels.find((item) => item.id === channelId) ?? mockModelChannels[0];
  const model = channel.models.find((item) => item.id === modelId) ?? channel.models[0];
  const selectedProfile = mockModelProfiles.find((profile) => profile.id === selectedProfileId);

  const prompts = useMemo(() => Object.fromEntries(TYPE_ORDER.map((type) => [
    type,
    `${imageTypePromptHints[type]} 商品：${selectedProduct.name}。风格：${style}；场景：${scene}；动作/姿势：${pose}${selectedProfile ? `；模特：${selectedProfile.name}` : ''}${Object.values(referenceInsights).length ? `；参考图解析：${Object.values(referenceInsights).join(' ')}` : ''}。${negativePrompt ? `负面约束：${negativePrompt}。` : ''}`,
  ])) as Record<ImageGenerationType, string>, [negativePrompt, pose, referenceInsights, scene, selectedProduct.name, selectedProfile, style]);
  const [promptOverrides, setPromptOverrides] = useState<Partial<Record<ImageGenerationType, string>>>({});

  const isSupported = model.capability.ratios.includes(ratio)
    && count <= model.capability.maxCount
    && model.capability.resolutions.includes(resolution);
  const unsupported = [
    !model.capability.ratios.includes(ratio) ? `比例 ${ratio}` : null,
    count > model.capability.maxCount ? `张数 ${count}（最大 ${model.capability.maxCount}）` : null,
    !model.capability.resolutions.includes(resolution) ? `尺寸 ${resolution}` : null,
  ].filter(Boolean);

  const setModelWithValidation = (nextChannelId: string, nextModelId: string) => {
    const nextChannel = mockModelChannels.find((item) => item.id === nextChannelId);
    const nextModel = nextChannel?.models.find((item) => item.id === nextModelId);
    if (!nextChannel || !nextModel) return;
    const incompatible = !nextModel.capability.ratios.includes(ratio)
      || count > nextModel.capability.maxCount
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
    setCount(Math.min(count, nextModel.capability.maxCount));
    setResolution(nextModel.capability.resolutions[0]);
    setConflictOpen(false);
    setPendingChoice(null);
  };

  const applyPreset = (preset: typeof PRESETS[number]) => {
    const conflicts = !model.capability.ratios.includes(preset.ratio)
      || preset.count > model.capability.maxCount
      || !model.capability.resolutions.includes(preset.resolution);
    if (conflicts) {
      setPendingChoice({ channelId, modelId });
      setConflictOpen(true);
      return;
    }
    setRatio(preset.ratio);
    setCount(preset.count);
    setResolution(preset.resolution);
  };

  const toggleType = (type: ImageGenerationType) => {
    setSelectedTypes((previous) => {
      if (previous.includes(type)) return previous.length === 1 ? previous : previous.filter((item) => item !== type);
      return [...previous, type];
    });
  };

  const startComposite = () => {
    if (!topAsset || !bottomAsset) return;
    setCompositeState('processing');
    window.setTimeout(() => setCompositeState('ready'), 700);
  };

  const toTaskReference = (fileResourceId: number, role: string): TaskReference | null => {
    const asset = mockAssetResources.find((item) => item.fileResourceId === fileResourceId);
    if (!asset) return null;
    return {
      id: `asset-${fileResourceId}`,
      role,
      name: asset.name,
      source: '资源中心',
      active: true,
      thumbnailUrl: asset.thumbnailUrl ?? asset.originalUrl,
    };
  };

  const selectMainAsset = (fileResourceIds: number[]) => {
    const reference = toTaskReference(fileResourceIds[0], '主体素材');
    if (reference) {
      setMainAsset(reference);
      const matchingProduct = products.find((product) => product.files.some((file) => file.name === reference.name));
      if (matchingProduct) setSelectedProduct(matchingProduct);
      setCompositeState('idle');
    }
  };

  const selectGarmentAsset = (part: 'top' | 'bottom') => (fileResourceIds: number[]) => {
    const reference = toTaskReference(fileResourceIds[0], part === 'top' ? '上衣图' : '下装图');
    if (reference) {
      if (part === 'top') setTopAsset(reference);
      else setBottomAsset(reference);
      setCompositeState('idle');
    }
  };

  const selectReferenceAsset = (slot: ReferenceSlot) => (fileResourceIds: number[]) => {
    const slotDefinition = REFERENCE_SLOTS.find((item) => item.id === slot);
    const reference = toTaskReference(fileResourceIds[0], slotDefinition?.role ?? '参考图');
    if (!reference) return;
    const analysis = mockReferenceAnalysisByFileId[fileResourceIds[0]];
    setReferences((current) => ({ ...current, [slot]: reference }));
    if (analysis) {
      setReferenceInsights((current) => ({ ...current, [slot]: analysis.promptHint }));
      if (analysis.style) setStyle(analysis.style);
      if (analysis.scene) setScene(analysis.scene);
      if (analysis.pose) setPose(analysis.pose);
    }
  };

  const selectModelFromTransit = (fileResourceIds: number[]) => {
    const reference = toTaskReference(fileResourceIds[0], '模特参考');
    if (!reference) return;
    const profile = mockModelProfiles.find((item) => reference.name.includes(item.name));
    if (profile) setSelectedProfileId(profile.id);
  };

  const submitTasks = () => {
    if (!isSupported || channel.health === 'maintenance') return;
    const groupId = `G-${Date.now()}`;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const outputPreviewUrl = compositeState === 'ready'
      ? topAsset?.thumbnailUrl ?? selectedProduct.thumbnail
      : mainAsset?.thumbnailUrl ?? selectedProduct.thumbnail;
    selectedTypes.forEach((imageType, index) => {
      const task: GenerationTask = {
        id: `I-${Date.now()}-${index + 1}`,
        groupId,
        name: `${IMAGE_GENERATION_TYPE_LABELS[imageType]} · ${selectedProduct.name}`,
        type: 'image',
        imageType,
        status: 'running',
        progress: 0,
        productName: selectedProduct.name,
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
          estimatedCost: model.cost * count,
        },
        params: { ratio, prompt: promptOverrides[imageType] ?? prompts[imageType], negativePrompt },
      };
      onAddTask(task);
      window.setTimeout(() => onAddTask({
        ...task,
        status: reviewEnabled ? 'candidate' : 'archived',
        progress: 100,
        resultUrl: outputPreviewUrl,
        results: [{ id: `${task.id}-r1`, url: outputPreviewUrl, version: 1, reviewStage: reviewEnabled ? 'candidate' : 'approved' }],
      }), 900 + index * 250);
    });
    setScreen(AppScreen.TASKS);
  };

  const applyAssistantSuggestion = () => {
    setPromptOverrides((previous) => Object.fromEntries(selectedTypes.map((type) => [
      type,
      `${previous[type] ?? prompts[type]} 使用自然柔光，保持商品边缘完整，并将主体放在视觉重心。`,
    ])));
    setAssistantOpen(false);
  };

  return (
    <div className="h-screen overflow-hidden bg-[#f5f7fb] text-slate-800 flex flex-col" id="create-image-task-container">
      <header className="h-16 shrink-0 px-6 bg-white border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setScreen(AppScreen.TASKS)} className="w-8 h-8 rounded-md hover:bg-slate-100 text-slate-500" title="返回任务列表"><span className="material-symbols-outlined">arrow_back</span></button>
          <div><p className="text-[11px] font-bold text-primary">图片任务工作台</p><h1 className="text-base font-black">新建多类型图片任务</h1></div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">已选择 <b className="text-slate-800">{selectedTypes.length}</b> 个图片类型，将生成独立任务</span>
          <button onClick={submitTasks} disabled={!isSupported || channel.health === 'maintenance'} className="h-9 px-4 rounded-md bg-primary disabled:bg-slate-300 text-white text-xs font-bold shadow-sm">提交 {selectedTypes.length} 条任务</button>
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
            <select value={selectedProduct.id} onChange={(event) => {
              const product = products.find((item) => item.id === event.target.value);
              if (product) setSelectedProduct(product);
            }} className="mt-3 w-full h-8 rounded border border-slate-200 px-2 text-xs bg-slate-50">{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between"><h2 className="text-sm font-black">上下装合成套图</h2><span className="text-[10px] text-slate-400">可选</span></div>
            {([{ label: '上衣图', asset: topAsset, targetSlot: 'upper', select: selectGarmentAsset('top'), clear: () => { setTopAsset(null); setCompositeState('idle'); } }, { label: '下装图', asset: bottomAsset, targetSlot: 'lower', select: selectGarmentAsset('bottom'), clear: () => { setBottomAsset(null); setCompositeState('idle'); } }]).map((item) => {
              return <div key={item.label} className="relative"><button onClick={() => openTransit(item.select, item.targetSlot)} className="w-full h-16 rounded-md border border-dashed border-slate-300 hover:border-primary flex items-center px-3 gap-3 text-left overflow-hidden">
                {item.asset?.thumbnailUrl ? <img src={item.asset.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover" referrerPolicy="no-referrer" /> : <span className="material-symbols-outlined text-slate-400">add_photo_alternate</span>}<span className="text-xs min-w-0"><b className="block text-slate-700">{item.label}</b><span className="block truncate text-slate-400">{item.asset ? item.asset.name : '从资源中心选择'}</span></span>
              </button>{item.asset && <button onClick={item.clear} className="absolute right-2 top-2 w-5 h-5 rounded-full bg-white/90 text-slate-400 hover:text-red-500" title={`移除${item.label}`}><span className="material-symbols-outlined text-sm">close</span></button>}</div>;
            })}
            <button onClick={startComposite} disabled={!topAsset || !bottomAsset || compositeState === 'processing'} className="w-full h-8 rounded bg-slate-900 disabled:bg-slate-200 text-white text-xs font-bold">{compositeState === 'processing' ? '合成中...' : compositeState === 'ready' ? '重新生成合成预览' : '生成合成预览'}</button>
            {compositeState === 'ready' && <div className="rounded bg-emerald-50 border border-emerald-100 p-2 text-[11px] text-emerald-700">合成预览已显示在上方输入素材区，并会作为本次任务主体图。</div>}
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h2 className="text-sm font-black">参考图 <span className="font-normal text-slate-400">(选传)</span></h2><p className="mt-1 text-[11px] leading-5 text-slate-400">用于补充细节、风格、场景、姿势，不直接替代主体。</p>
            <div className="grid grid-cols-4 gap-2 mt-3">{REFERENCE_SLOTS.map((slot) => {
              const reference = references[slot.id];
              return <div key={slot.id} className="min-w-0 text-center"><button onClick={() => openTransit(selectReferenceAsset(slot.id), slot.transitSlot)} className={`relative w-full aspect-square rounded-xl border-2 border-dashed overflow-hidden flex items-center justify-center transition-colors ${reference ? 'border-primary bg-blue-50' : 'border-slate-200 hover:border-primary bg-slate-50'}`} title={`选择${slot.label}参考图`}>
                {reference?.thumbnailUrl ? <><img src={reference.thumbnailUrl} alt={slot.label} className="w-full h-full object-cover" referrerPolicy="no-referrer" /><span className="absolute inset-x-0 bottom-0 py-1 bg-primary text-[10px] font-bold text-white">已解析</span></> : <span className="material-symbols-outlined text-2xl text-slate-400">add</span>}
              </button><div className={`mt-1 text-xs font-bold ${reference ? 'text-primary' : 'text-slate-400'}`}>{slot.label}</div>{reference && <button onClick={() => { setReferences((current) => ({ ...current, [slot.id]: undefined })); setReferenceInsights((current) => ({ ...current, [slot.id]: undefined })); }} className="text-[10px] text-slate-400 hover:text-red-500">移除</button>}</div>;
            })}</div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4"><div><p className="text-[11px] font-bold text-primary">任务配置</p><h2 className="text-base font-black">用户希望得到什么结果</h2></div><span className="text-[11px] text-slate-400">规格选项由所选模型提供</span></div>
            <label className="text-xs font-bold text-slate-700">生成图片类型 <span className="text-slate-400 font-normal">可多选</span></label>
            <div className="grid sm:grid-cols-2 gap-2 mt-2">{TYPE_ORDER.map((type) => <button key={type} onClick={() => toggleType(type)} className={`p-3 text-left border rounded-md transition-colors ${selectedTypes.includes(type) ? 'border-primary bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}><div className="flex items-center justify-between"><span className="material-symbols-outlined text-primary">{typeIcon[type]}</span><span className={`w-4 h-4 rounded border flex items-center justify-center ${selectedTypes.includes(type) ? 'bg-primary border-primary text-white' : 'border-slate-300'}`}>{selectedTypes.includes(type) && <span className="material-symbols-outlined text-xs">check</span>}</span></div><p className="mt-2 text-xs font-bold">{IMAGE_GENERATION_TYPE_LABELS[type]}</p></button>)}</div>
            <div className="grid md:grid-cols-3 gap-3 mt-5">
              {[['任务模板', template, setTemplate, ['商品商业展示模板 v2.1', '服装上身展示模板', '细节材质强化模板']], ['风格', style, setStyle, STYLE_OPTIONS], ['场景', scene, setScene, ['自然影棚', '城市街景', '居家陈列']]].map(([label, value, setter, options]) => <label key={String(label)} className="text-xs font-bold text-slate-700">{String(label)}<select value={value as string} onChange={(event) => (setter as (value: string) => void)(event.target.value)} className="mt-1.5 w-full h-9 px-2 rounded border border-slate-200 bg-white text-xs font-medium">{(options as string[]).map((option) => <option key={option}>{option}</option>)}</select></label>)}
            </div>
            <div className="grid md:grid-cols-2 gap-3 mt-3"><label className="text-xs font-bold text-slate-700">动作/姿势<input value={pose} onChange={(event) => setPose(event.target.value)} className="mt-1.5 w-full h-9 px-2 rounded border border-slate-200 text-xs font-medium" /></label><label className="text-xs font-bold text-slate-700">负面约束<input value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} className="mt-1.5 w-full h-9 px-2 rounded border border-slate-200 text-xs font-medium" /></label></div>
            <div className="mt-5 border-t border-slate-100 pt-4"><div className="flex items-center justify-between"><h3 className="text-xs font-black">模特选择</h3><div className="flex gap-3"><button onClick={() => openTransit(selectModelFromTransit, 'model')} className="text-[11px] text-primary font-bold">资源中心</button><button onClick={() => setSelectedProfileId('none')} className="text-[11px] text-slate-400 hover:text-slate-700">不使用模特</button></div></div><div className="grid sm:grid-cols-3 gap-2 mt-2">{mockModelProfiles.map((profile) => <button key={profile.id} onClick={() => setSelectedProfileId(profile.id)} className={`p-2 rounded-md text-left border ${selectedProfileId === profile.id ? 'border-primary bg-blue-50' : 'border-slate-200'}`}><img src={profile.image} alt="" className="w-full h-16 object-cover rounded" referrerPolicy="no-referrer"/><p className="mt-1 text-[11px] font-bold truncate">{profile.name}</p><p className="text-[10px] text-slate-400 truncate">{profile.reason}</p></button>)}</div></div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between"><div><p className="text-[11px] font-bold text-primary">任务级 Prompt 副本</p><h2 className="text-base font-black">每种图片各自编辑</h2></div><button onClick={() => setAssistantOpen(true)} className="h-8 px-3 border border-blue-200 bg-blue-50 text-primary text-xs font-bold rounded-md flex gap-1 items-center"><span className="material-symbols-outlined text-base">auto_awesome</span>AI 助手</button></div>
            <div className="mt-4 space-y-3">{selectedTypes.map((type) => <div key={type} className="border border-slate-200 rounded-md overflow-hidden"><div className="px-3 py-2 bg-slate-50 flex justify-between"><span className="text-xs font-black">{IMAGE_GENERATION_TYPE_LABELS[type]}</span><span className="text-[10px] text-slate-400">来源：{template}</span></div><textarea value={promptOverrides[type] ?? prompts[type]} onChange={(event) => setPromptOverrides((previous) => ({ ...previous, [type]: event.target.value }))} className="w-full h-24 resize-none p-3 outline-none text-xs leading-5" /></div>)}</div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <p className="text-[11px] font-bold text-primary">模型通道与模型能力</p><h2 className="text-base font-black mt-1">选择可执行的模型</h2>
            <label className="block mt-4 text-xs font-bold">接入方式<select value={channelId} onChange={(event) => { const next = mockModelChannels.find((item) => item.id === event.target.value)!; setModelWithValidation(next.id, next.models[0].id); }} className="mt-1.5 w-full h-9 rounded border border-slate-200 px-2 text-xs">{mockModelChannels.map((item) => <option key={item.id} value={item.id}>{item.accessType === 'cloud' ? '云端 API' : item.accessType === 'local' ? '本地模型' : '中转站'} · {item.name}</option>)}</select></label>
            <label className="block mt-3 text-xs font-bold">具体模型<select value={model.id} onChange={(event) => setModelWithValidation(channel.id, event.target.value)} className="mt-1.5 w-full h-9 rounded border border-slate-200 px-2 text-xs">{channel.models.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <p className="mt-2 text-[11px] text-slate-500 leading-5">{model.description}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="p-3 rounded bg-slate-50"><span className="block text-[10px] text-slate-400">健康状态</span><b className={channel.health === 'healthy' ? 'text-emerald-600' : channel.health === 'quota_low' ? 'text-amber-600' : 'text-red-600'}>{channel.health === 'healthy' ? '运行正常' : channel.health === 'quota_low' ? '额度偏低' : '维护中'}</b></div><div className="p-3 rounded bg-slate-50"><span className="block text-[10px] text-slate-400">预估成本</span><b>{(model.cost * count).toFixed(1)} 元</b></div></div>
            <p className={`mt-2 text-[11px] ${channel.health === 'healthy' ? 'text-slate-500' : 'text-amber-700'}`}>{channel.quotaText}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-sm font-black">输出规格</h3><p className="mt-1 text-[11px] text-slate-400">仅展示业务需要的选择，范围由模型能力决定。</p>
            <div className="mt-4"><span className="text-xs font-bold">平台规格推荐</span><div className="flex flex-wrap gap-2 mt-2">{PRESETS.map((preset) => <button key={preset.name} onClick={() => applyPreset(preset)} className="px-2 py-1.5 text-[11px] font-bold rounded border border-slate-200 hover:border-primary hover:text-primary">{preset.name}</button>)}</div></div>
            <label className="block mt-4 text-xs font-bold">比例<select value={ratio} onChange={(event) => setRatio(event.target.value)} className="mt-1.5 w-full h-9 rounded border border-slate-200 px-2 text-xs">{model.capability.ratios.map((item) => <option key={item}>{item}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-3 mt-3"><label className="text-xs font-bold">张数<select value={count} onChange={(event) => setCount(Number(event.target.value))} className="mt-1.5 w-full h-9 rounded border border-slate-200 px-2 text-xs">{Array.from({ length: model.capability.maxCount }, (_, index) => index + 1).map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs font-bold">图片尺寸<select value={resolution} onChange={(event) => setResolution(event.target.value)} className="mt-1.5 w-full h-9 rounded border border-slate-200 px-2 text-xs">{model.capability.resolutions.map((item) => <option key={item}>{item}</option>)}</select></label></div>
            {!isSupported && <p className="mt-3 p-2 rounded bg-red-50 text-red-700 text-[11px]">当前规格不受所选模型支持：{unsupported.join('、')}</p>}
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-5"><h3 className="text-sm font-black">审核策略</h3><label className="mt-3 flex items-center justify-between text-xs font-bold">启用评分审核<input checked={reviewEnabled} onChange={(event) => setReviewEnabled(event.target.checked)} type="checkbox" className="accent-primary" /></label><p className="mt-2 text-[11px] text-slate-400">一次完成评分与通过/打回决策；通过后可创建视频。</p></div>
        </section>
      </main>

      {assistantOpen && <div className="fixed inset-0 z-50 flex justify-end"><button className="absolute inset-0 bg-slate-900/30" onClick={() => setAssistantOpen(false)} aria-label="关闭" /><aside className="relative w-full max-w-sm h-full bg-white shadow-2xl p-6"><div className="flex justify-between items-center"><div><p className="text-[11px] text-primary font-bold">AI 助手</p><h2 className="font-black">本次任务建议</h2></div><button onClick={() => setAssistantOpen(false)} className="material-symbols-outlined">close</button></div><div className="mt-6 p-4 border border-blue-100 bg-blue-50 rounded-lg text-xs leading-6">建议保持主体周围留白，并用自然柔光强化材质层次。该建议只会应用到本次任务级 Prompt，不会修改全局模板。</div><button onClick={applyAssistantSuggestion} className="mt-4 w-full h-9 rounded bg-primary text-white text-xs font-bold">确认应用建议</button></aside></div>}
      {conflictOpen && pendingChoice && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-900/40" /><div className="relative bg-white rounded-lg w-full max-w-md p-6 shadow-xl"><div className="flex gap-3"><span className="material-symbols-outlined text-amber-500">warning</span><div><h2 className="font-black">模型能力与当前规格冲突</h2><p className="mt-2 text-xs text-slate-500 leading-5">目标模型不支持当前的 {unsupported.length ? unsupported.join('、') : '输出规格'}。确认后将自动切换到该模型首个可用比例、尺寸，并将张数限制在上限内。</p></div></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => { setConflictOpen(false); setPendingChoice(null); }} className="h-8 px-3 text-xs font-bold border border-slate-200 rounded">保留当前选择</button><button onClick={applyCompatibleModel} className="h-8 px-3 text-xs font-bold text-white bg-primary rounded">确认调整</button></div></div></div>}
    </div>
  );
};
