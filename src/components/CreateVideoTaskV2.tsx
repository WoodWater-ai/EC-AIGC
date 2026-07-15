import React, { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  AppScreen,
  GenerationTask,
  ProductAsset,
  TrendingReplicateAnalysis,
  VideoAssetRole,
  VideoInputAsset,
  VideoTaskEntryContext,
  VideoTaskMode,
} from '../types';
import { mockAssetResources, mockModelChannels, mockModelProfiles } from '../mockData';

interface CreateVideoTaskProps {
  products: ProductAsset[];
  onAddTask: (task: GenerationTask) => void;
  setScreen: (screen: AppScreen) => void;
  openTransit: (onConfirmSelection: (fileResourceIds: number[]) => void, targetSlot?: string) => void;
  selectedProduct: ProductAsset;
  setSelectedProduct: (product: ProductAsset) => void;
  entryContext: VideoTaskEntryContext;
}

const MODE_META: Record<VideoTaskMode, { label: string; description: string }> = {
  img2video: { label: '首帧图生视频', description: '用一张首帧锁定商品主体和构图。' },
  reference2video: { label: '参考图生视频', description: '在首帧基础上补充风格、动作或场景参考。' },
  trending_replicate: { label: '爆款复刻', description: '拆解爆款视频结构，再替换商品、模特和场景。' },
};

const ROLE_LABELS: Record<VideoAssetRole, string> = {
  first_frame: '首帧', style: '风格', action: '动作/镜头', scene: '场景', product: '商品', model: '模特',
};

const shotsForDuration = (duration: number) => duration === 5
  ? [{ key: '0-2', label: '0-2 秒 · 建立画面' }, { key: '2-5', label: '2-5 秒 · 商品收束' }]
  : duration === 8
    ? [{ key: '0-2', label: '0-2 秒 · 建立画面' }, { key: '2-5', label: '2-5 秒 · 动作推进' }, { key: '5-8', label: '5-8 秒 · 商品收束' }]
    : [{ key: '0-3', label: '0-3 秒 · 建立画面' }, { key: '3-9', label: '3-9 秒 · 氛围与动作' }, { key: '9-15', label: '9-15 秒 · 商品收束' }];

const mockTrendingAnalysis: TrendingReplicateAnalysis = {
  keyframes: [
    { id: 'frame-1', label: '0 秒 · 视觉钩子', url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=480&q=80' },
    { id: 'frame-2', label: '4 秒 · 动作展示', url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=480&q=80' },
    { id: 'frame-3', label: '8 秒 · 卖点收束', url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=480&q=80' },
  ],
  shots: [
    { time: '0-2 秒', scene: '高对比开场', action: '商品主体快速入画', camera: '低机位推进' },
    { time: '2-5 秒', scene: '功能动作', action: '放大核心材质与使用感', camera: '环绕特写' },
    { time: '5-8 秒', scene: '品牌收束', action: '定格核心卖点', camera: '缓慢拉远' },
  ],
  sellingLogic: ['前两秒明确商品和氛围', '中段用动作强化功能记忆', '结尾留出品牌与卖点停留'],
  replacementPlan: ['以新商品替换原主体，保持镜头节奏', '用已选模特承接人物动作', '按所选场景保留原片明暗关系'],
  risks: ['素材比例差异可能影响构图', '人物动作与商品结构需二次确认'],
  generatedPrompt: '保持原视频的高密度镜头节奏：开场快速建立商品主体，中段以自然动作展示卖点，结尾定格品牌与材质细节。使用所选商品、模特和场景完成替换，不复制原片标识或人物。',
};

const createAsset = (id: string, name: string, url: string, source: string, role: VideoAssetRole): VideoInputAsset => ({ id, name, url, source, role });

export const CreateVideoTaskV2: React.FC<CreateVideoTaskProps> = ({
  products, onAddTask, setScreen, openTransit, selectedProduct, setSelectedProduct, entryContext,
}) => {
  const videoChannels = mockModelChannels.filter((channel) => channel.models.some((model) => model.capability.durations?.length));
  const [mode, setMode] = useState<VideoTaskMode>('img2video');
  const [channelId, setChannelId] = useState('relay-studio');
  const [modelId, setModelId] = useState('vidu-q2');
  const [duration, setDuration] = useState(8);
  const [ratio, setRatio] = useState('9:16');
  const [resolution, setResolution] = useState('1080p');
  const [motion, setMotion] = useState<'轻微' | '适中' | '强烈'>('适中');
  const [firstFrame, setFirstFrame] = useState<VideoInputAsset | null>(null);
  const [references, setReferences] = useState<VideoInputAsset[]>([]);
  const [trendingSource, setTrendingSource] = useState<VideoInputAsset | null>(null);
  const [trendingAssets, setTrendingAssets] = useState<VideoInputAsset[]>([]);
  const [linkedProduct, setLinkedProduct] = useState<ProductAsset | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | 'none'>('none');
  const [segments, setSegments] = useState<Record<string, string>>({});
  const [taskPrompt, setTaskPrompt] = useState('镜头稳定呈现商品主体，突出材质、动作和核心卖点。');
  const [negativePrompt, setNegativePrompt] = useState('商品漂移、面料闪烁、人物畸形、镜头突变、文字变化');
  const [analysis, setAnalysis] = useState<TrendingReplicateAnalysis | null>(null);
  const [replicateGoal, setReplicateGoal] = useState('保留原视频的创意结构、镜头节奏和爆点，替换为新的商品、模特和场景素材。');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [pendingModel, setPendingModel] = useState<{ channelId: string; modelId: string } | null>(null);

  const channel = videoChannels.find((item) => item.id === channelId) ?? videoChannels[0];
  const model = channel.models.find((item) => item.id === modelId) ?? channel.models[0];
  const selectedProfile = mockModelProfiles.find((profile) => profile.id === selectedProfileId);
  const shots = useMemo(() => shotsForDuration(duration), [duration]);
  const maxReferences = model.capability.maxReferenceImages ?? 1;
  const supportsSpec = (model.capability.durations?.includes(duration) ?? false)
    && model.capability.ratios.includes(ratio)
    && model.capability.resolutions.includes(resolution)
    && (model.capability.motions?.includes(motion) ?? false);
  const needsFirstFrame = mode === 'img2video' || mode === 'reference2video';
  const hasRequiredInputs = mode === 'trending_replicate'
    ? Boolean(trendingSource && trendingAssets.some((asset) => asset.role === 'product') && analysis)
    : Boolean(firstFrame) && (mode !== 'reference2video' || references.length > 0);
  const canSubmit = supportsSpec && hasRequiredInputs && channel.health !== 'maintenance';

  useEffect(() => {
    if (entryContext.kind === 'approved-image') {
      setFirstFrame(createAsset(entryContext.sourceResult.id, `审核通过图片 v${entryContext.sourceResult.version}`, entryContext.sourceResult.url, '审核通过结果', 'first_frame'));
      setLinkedProduct(selectedProduct);
      setTaskPrompt(entryContext.sourceTask.taskPrompt ?? entryContext.sourceTask.params?.prompt ?? '镜头稳定呈现审核通过图片中的商品主体，突出材质和核心卖点。');
      return;
    }
    setFirstFrame(null);
    setReferences([]);
    setLinkedProduct(null);
    setSelectedProfileId('none');
    setTaskPrompt('镜头稳定呈现商品主体，突出材质、动作和核心卖点。');
  }, [entryContext]);

  useEffect(() => {
    setSegments((previous) => {
      const next = { ...previous };
      shotsForDuration(duration).forEach((shot, index) => {
        if (!next[shot.key]) next[shot.key] = index === 0 ? '镜头缓慢建立，焦点锁定在商品主体。' : '保持商品主体稳定，展示材质、动作和细节。';
      });
      return next;
    });
  }, [duration]);

  const resolveAssets = (fileResourceIds: number[], role: VideoAssetRole): VideoInputAsset[] => fileResourceIds
    .map((id) => mockAssetResources.find((asset) => asset.fileResourceId === id))
    .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset))
    .map((asset) => createAsset(`asset-${asset.fileResourceId}`, asset.name, asset.thumbnailUrl ?? asset.originalUrl ?? '', '资源中心', role));

  const selectFirstFrame = (ids: number[]) => {
    const asset = resolveAssets(ids, 'first_frame')[0];
    if (!asset) return;
    setFirstFrame(asset);
    const product = products.find((item) => item.files.some((file) => file.name === asset.name));
    if (product) {
      setLinkedProduct(product);
      setSelectedProduct(product);
    }
  };

  const addReferences = (ids: number[]) => {
    setReferences((current) => [...current, ...resolveAssets(ids, 'style').filter((asset) => !current.some((item) => item.id === asset.id))].slice(0, maxReferences));
  };

  const addTrendingAssets = (ids: number[]) => {
    setTrendingAssets((current) => [...current, ...resolveAssets(ids, 'product').filter((asset) => !current.some((item) => item.id === asset.id))].slice(0, 7));
    setAnalysis(null);
  };

  const selectModelFromTransit = (ids: number[]) => {
    const asset = resolveAssets(ids, 'model')[0];
    if (!asset) return;
    const profile = mockModelProfiles.find((item) => asset.name.includes(item.name));
    if (profile) setSelectedProfileId(profile.id);
  };

  const chooseModel = (nextChannelId: string, nextModelId: string) => {
    const nextChannel = videoChannels.find((item) => item.id === nextChannelId);
    const nextModel = nextChannel?.models.find((item) => item.id === nextModelId);
    if (!nextChannel || !nextModel) return;
    const incompatible = !nextModel.capability.ratios.includes(ratio)
      || !nextModel.capability.resolutions.includes(resolution)
      || !(nextModel.capability.durations?.includes(duration) ?? false)
      || !(nextModel.capability.motions?.includes(motion) ?? false);
    if (incompatible) {
      setPendingModel({ channelId: nextChannelId, modelId: nextModelId });
      return;
    }
    setChannelId(nextChannelId);
    setModelId(nextModelId);
  };

  const confirmModelChange = () => {
    if (!pendingModel) return;
    const nextChannel = videoChannels.find((item) => item.id === pendingModel.channelId)!;
    const nextModel = nextChannel.models.find((item) => item.id === pendingModel.modelId)!;
    setChannelId(nextChannel.id);
    setModelId(nextModel.id);
    setRatio(nextModel.capability.ratios[0]);
    setResolution(nextModel.capability.resolutions[0]);
    setDuration(nextModel.capability.durations?.[0] ?? 5);
    setMotion(nextModel.capability.motions?.[0] ?? '轻微');
    setReferences((items) => items.slice(0, nextModel.capability.maxReferenceImages));
    setPendingModel(null);
  };

  const chooseLocalVideo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setTrendingSource(createAsset(`upload-${Date.now()}`, file.name, URL.createObjectURL(file), '本地上传', 'scene'));
    setAnalysis(null);
  };

  const runAnalysis = () => {
    if (!trendingSource || !trendingAssets.some((asset) => asset.role === 'product')) return;
    setAnalysis(mockTrendingAnalysis);
    setTaskPrompt(mockTrendingAnalysis.generatedPrompt);
  };

  const submit = () => {
    if (!canSubmit) return;
    const productName = linkedProduct?.name ?? (mode === 'trending_replicate' ? '爆款复刻商品' : '未关联商品');
    const cover = mode === 'trending_replicate' ? trendingAssets.find((asset) => asset.role === 'product')?.url ?? '' : firstFrame?.url ?? '';
    const segmentPrompt = shots.map((shot) => `${shot.label}：${segments[shot.key] ?? ''}`).join(' | ');
    const context = mode === 'trending_replicate'
      ? `复刻目标：${replicateGoal}；替换素材：${trendingAssets.map((asset) => `${ROLE_LABELS[asset.role]}-${asset.name}`).join('、')}；${segmentPrompt}`
      : `首帧：${firstFrame?.name ?? ''}；参考图：${references.map((asset) => `${ROLE_LABELS[asset.role]}-${asset.name}`).join('、')}；${segmentPrompt}`;
    const prompt = `${taskPrompt} ${context}${selectedProfile ? `；模特：${selectedProfile.name}` : ''}`;
    const task: GenerationTask = {
      id: `V-${Date.now()}`, name: `${MODE_META[mode].label} · ${productName}`, type: 'video', status: 'running', progress: 0,
      productName, productImg: cover, templateName: MODE_META[mode].label, timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16), creator: '陆永奇',
      modelChannel: `${channel.name} / ${model.name}`, taskPrompt: prompt, negativePrompt,
      modelSnapshot: { accessType: channel.accessType, channelId: channel.id, channelName: channel.name, modelId: model.id, modelName: model.name, supportedRatios: model.capability.ratios, maxCount: model.capability.maxCount, supportedResolutions: model.capability.resolutions, estimatedCost: model.cost },
      params: { ratio, prompt, negativePrompt },
    };
    onAddTask(task);
    setScreen(AppScreen.TASKS);
    window.setTimeout(() => onAddTask({ ...task, status: 'candidate', progress: 100, resultUrl: cover }), 900);
  };

  const openTrendingUrl = (value: string) => {
    const url = value.trim();
    if (!url) return;
    setTrendingSource(createAsset(`url-${Date.now()}`, '爆款视频直链', url, '视频直链', 'scene'));
    setAnalysis(null);
  };

  return <div className="h-screen overflow-hidden bg-[#f5f7fb] text-slate-800 flex flex-col" id="create-video-task-container">
    <header className="h-16 shrink-0 px-6 bg-white border-b border-slate-200 flex items-center justify-between">
      <div className="flex items-center gap-3"><button onClick={() => setScreen(AppScreen.TASKS)} className="w-8 h-8 rounded-md hover:bg-slate-100 text-slate-500" title="返回任务列表"><span className="material-symbols-outlined">arrow_back</span></button><div><p className="text-[11px] font-bold text-emerald-600">视频任务工作台</p><h1 className="text-base font-black">{entryContext.kind === 'approved-image' ? '从审核通过图片创建视频' : '新建视频任务'}</h1></div></div>
      <button onClick={submit} disabled={!canSubmit} className="h-9 px-4 rounded-md bg-primary disabled:bg-slate-300 text-white text-xs font-bold">提交视频任务</button>
    </header>
    <div className="bg-white border-b border-slate-200 px-6"><div className="max-w-[1440px] mx-auto flex gap-6 overflow-x-auto">{(Object.keys(MODE_META) as VideoTaskMode[]).map((item) => <button key={item} onClick={() => setMode(item)} className={`h-12 shrink-0 text-xs font-bold border-b-2 ${mode === item ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`}>{MODE_META[item].label}</button>)}</div></div>
    <main className="flex-1 overflow-y-auto p-5 grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_380px] gap-5 max-w-[1440px] mx-auto w-full">
      <section className="space-y-4">
        {mode === 'trending_replicate' ? <TrendingInputs source={trendingSource} assets={trendingAssets} onUpload={chooseLocalVideo} onUrl={openTrendingUrl} onPickAssets={() => openTransit(addTrendingAssets, 'replicate-assets')} onRemoveAsset={(id) => { setTrendingAssets((items) => items.filter((item) => item.id !== id)); setAnalysis(null); }} onRoleChange={(id, role) => { setTrendingAssets((items) => items.map((item) => item.id === id ? { ...item, role } : item)); setAnalysis(null); }} /> : <ImageVideoInputs firstFrame={firstFrame} references={references} maxReferences={maxReferences} linkedProduct={linkedProduct} entrySource={entryContext.kind === 'approved-image'} onPickFirstFrame={() => openTransit(selectFirstFrame, 'video-first-frame')} onRemoveFirstFrame={() => { setFirstFrame(null); setLinkedProduct(null); }} onPickReferences={() => openTransit(addReferences, 'video-reference')} onRemoveReference={(id) => setReferences((items) => items.filter((item) => item.id !== id))} onRoleChange={(id, role) => setReferences((items) => items.map((item) => item.id === id ? { ...item, role } : item))} showReferences={mode === 'reference2video'} />}
      </section>
      <section className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5"><p className="text-[11px] font-bold text-primary">任务配置</p><h2 className="mt-1 font-black">{MODE_META[mode].label}</h2><p className="mt-2 text-xs text-slate-500 leading-5">{MODE_META[mode].description}</p>{mode === 'trending_replicate' && <TrendingAnalysisPanel goal={replicateGoal} setGoal={setReplicateGoal} analysis={analysis} onAnalyze={runAnalysis} disabled={!trendingSource || !trendingAssets.some((asset) => asset.role === 'product')} />}</div>
        <div className="bg-white border border-slate-200 rounded-lg p-5"><div className="flex justify-between items-start gap-3"><div><p className="text-[11px] font-bold text-primary">时长驱动分镜</p><h2 className="mt-1 font-black">镜头 Prompt</h2><p className="mt-2 text-[11px] text-slate-400">切换时长只补充缺失建议，已编辑内容不会覆盖。</p></div><select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="h-9 px-2 rounded border border-slate-200 text-xs">{model.capability.durations?.map((item) => <option key={item} value={item}>{item} 秒</option>)}</select></div><div className="mt-4 space-y-3">{shots.map((shot) => <label key={shot.key} className="block text-xs font-bold">{shot.label}<textarea value={segments[shot.key] ?? ''} onChange={(event) => setSegments((items) => ({ ...items, [shot.key]: event.target.value }))} className="mt-1.5 h-20 w-full resize-none border border-slate-200 rounded-md p-2 text-xs font-normal leading-5" /></label>)}</div><label className="block mt-4 text-xs font-bold">任务级 Prompt<textarea value={taskPrompt} onChange={(event) => setTaskPrompt(event.target.value)} className="mt-1.5 h-24 w-full resize-none border border-slate-200 rounded-md p-2 text-xs font-normal leading-5" /></label><label className="block mt-3 text-xs font-bold">负面约束<input value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} className="mt-1.5 h-9 w-full border border-slate-200 rounded-md px-2 text-xs font-normal" /></label><button onClick={() => setAssistantOpen(true)} className="mt-4 h-8 px-3 rounded border border-primary text-primary text-xs font-bold">AI 助手建议</button></div>
      </section>
      <aside className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5"><p className="text-[11px] font-bold text-primary">模型通道与模型能力</p><h2 className="mt-1 font-black">可用视频规格</h2><label className="block mt-4 text-xs font-bold">模型通道<select value={channel.id} onChange={(event) => { const next = videoChannels.find((item) => item.id === event.target.value)!; chooseModel(next.id, next.models[0].id); }} className="mt-1.5 h-9 w-full border border-slate-200 rounded px-2">{videoChannels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block mt-3 text-xs font-bold">模型版本<select value={model.id} onChange={(event) => chooseModel(channel.id, event.target.value)} className="mt-1.5 h-9 w-full border border-slate-200 rounded px-2">{channel.models.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="grid grid-cols-2 gap-3 mt-3"><SelectField label="比例" value={ratio} onChange={setRatio} values={model.capability.ratios} /><SelectField label="分辨率" value={resolution} onChange={setResolution} values={model.capability.resolutions} /><SelectField label="运动幅度" value={motion} onChange={(value) => setMotion(value as typeof motion)} values={model.capability.motions ?? []} /></div><div className="mt-4 p-3 rounded bg-slate-50 text-xs leading-6"><p>支持时长：{model.capability.durations?.join(' / ') ?? '—'} 秒</p><p>参考图上限：{maxReferences} 张</p><p>预估成本：<b>{model.cost.toFixed(1)} 元</b></p><p className={channel.health === 'healthy' ? 'text-emerald-700' : 'text-amber-700'}>{channel.quotaText}</p></div>{!supportsSpec && <p className="mt-3 text-[11px] text-red-600">当前模型不支持已选规格，请确认后调整。</p>}</div>
        <div className="bg-white border border-slate-200 rounded-lg p-5"><div className="flex justify-between"><div><p className="text-[11px] font-bold text-primary">模特选择</p><h2 className="mt-1 font-black">推荐或手选模特</h2></div><button onClick={() => openTransit(selectModelFromTransit, 'video-model')} className="text-xs font-bold text-primary">资源中心</button></div><div className="grid grid-cols-3 gap-2 mt-4">{mockModelProfiles.map((profile) => <button key={profile.id} onClick={() => setSelectedProfileId(profile.id)} className={`p-1.5 rounded-md text-left border ${selectedProfileId === profile.id ? 'border-primary bg-blue-50' : 'border-slate-200'}`}><img src={profile.image} alt="" className="w-full h-14 object-cover rounded" referrerPolicy="no-referrer"/><p className="mt-1 text-[10px] font-bold truncate">{profile.name}</p></button>)}</div><button onClick={() => setSelectedProfileId('none')} className="mt-3 text-[11px] text-slate-500">不使用模特</button></div>
        {mode === 'trending_replicate' && <TrendingPreview source={trendingSource} analysis={analysis} />}
      </aside>
    </main>
    {assistantOpen && <AssistantDrawer onClose={() => setAssistantOpen(false)} onApply={() => { setTaskPrompt((value) => `${value} 使用稳定运动和清晰商品边缘，重点突出核心卖点。`); setAssistantOpen(false); }} />}
    {pendingModel && <ModelConflictDialog onCancel={() => setPendingModel(null)} onConfirm={confirmModelChange} />}
  </div>;
};

const ImageVideoInputs: React.FC<{ firstFrame: VideoInputAsset | null; references: VideoInputAsset[]; maxReferences: number; linkedProduct: ProductAsset | null; entrySource: boolean; onPickFirstFrame: () => void; onRemoveFirstFrame: () => void; onPickReferences: () => void; onRemoveReference: (id: string) => void; onRoleChange: (id: string, role: VideoAssetRole) => void; showReferences: boolean }> = ({ firstFrame, references, maxReferences, linkedProduct, entrySource, onPickFirstFrame, onRemoveFirstFrame, onPickReferences, onRemoveReference, onRoleChange, showReferences }) => <>
  <div className="bg-white border border-slate-200 rounded-lg p-4"><div className="flex justify-between"><div><p className="text-[11px] font-bold text-primary">输入素材</p><h2 className="mt-1 text-sm font-black">视频首帧</h2></div><button onClick={onPickFirstFrame} className="text-xs text-primary font-bold">资源中心</button></div>{firstFrame ? <AssetCard asset={firstFrame} onReplace={onPickFirstFrame} onRemove={onRemoveFirstFrame} /> : <EmptyAssetButton label="添加首帧素材" onClick={onPickFirstFrame} />}{entrySource && <p className="mt-3 text-[11px] text-emerald-700">已从审核通过图片预填，可替换为资源中心素材。</p>}<p className="mt-3 text-xs leading-6 text-slate-500"><b className="text-slate-700">商品：</b>{linkedProduct?.name ?? '未关联商品'}</p></div>
  {showReferences && <div className="bg-white border border-slate-200 rounded-lg p-4"><div className="flex justify-between"><div><p className="text-[11px] font-bold text-primary">参考图片组</p><h2 className="mt-1 text-sm font-black">风格、动作与场景</h2><p className="mt-1 text-[11px] text-slate-400">当前模型最多 {maxReferences} 张。</p></div><button onClick={onPickReferences} disabled={references.length >= maxReferences} className="text-xs text-primary font-bold disabled:text-slate-300">资源中心</button></div><div className="grid grid-cols-3 gap-2 mt-4"><button onClick={onPickReferences} disabled={references.length >= maxReferences} className="aspect-square rounded-md border-2 border-dashed border-slate-300 text-slate-400 disabled:opacity-40"><span className="material-symbols-outlined text-2xl">add</span></button>{references.map((asset) => <ReferenceTile key={asset.id} asset={asset} onRemove={() => onRemoveReference(asset.id)} onRoleChange={(role) => onRoleChange(asset.id, role)} roles={['style', 'action', 'scene']} />)}</div></div>}
</>;

const TrendingInputs: React.FC<{ source: VideoInputAsset | null; assets: VideoInputAsset[]; onUpload: (event: ChangeEvent<HTMLInputElement>) => void; onUrl: (url: string) => void; onPickAssets: () => void; onRemoveAsset: (id: string) => void; onRoleChange: (id: string, role: VideoAssetRole) => void }> = ({ source, assets, onUpload, onUrl, onPickAssets, onRemoveAsset, onRoleChange }) => {
  const [url, setUrl] = useState('');
  return <><div className="bg-white border border-slate-200 rounded-lg p-4"><p className="text-[11px] font-bold text-primary">爆款视频</p><h2 className="mt-1 text-sm font-black">导入分析对象</h2><label className="mt-4 h-24 rounded-md border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-xs text-slate-500 cursor-pointer"><span className="material-symbols-outlined text-2xl">video_file</span><span className="mt-1">{source?.source === '本地上传' ? source.name : '上传 mp4 / mov 视频'}</span><input type="file" accept="video/mp4,video/quicktime,.mp4,.mov" className="hidden" onChange={onUpload} /></label><div className="flex gap-2 mt-3"><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="或输入视频直链" className="h-8 min-w-0 flex-1 border border-slate-200 rounded px-2 text-xs" /><button onClick={() => onUrl(url)} className="h-8 px-2 rounded border border-slate-200 text-xs font-bold">导入</button></div>{source && <p className="mt-3 text-xs font-bold text-slate-700 truncate">已选：{source.name}</p>}</div><div className="bg-white border border-slate-200 rounded-lg p-4"><div className="flex justify-between"><div><p className="text-[11px] font-bold text-primary">替换素材</p><h2 className="mt-1 text-sm font-black">商品、模特与场景</h2><p className="mt-1 text-[11px] text-slate-400">至少选择一张商品图，最多 7 张。</p></div><button onClick={onPickAssets} className="text-xs text-primary font-bold">资源中心</button></div><div className="grid grid-cols-3 gap-2 mt-4"><button onClick={onPickAssets} className="aspect-square rounded-md border-2 border-dashed border-slate-300 text-slate-400"><span className="material-symbols-outlined text-2xl">add</span></button>{assets.map((asset) => <ReferenceTile key={asset.id} asset={asset} onRemove={() => onRemoveAsset(asset.id)} onRoleChange={(role) => onRoleChange(asset.id, role)} roles={['product', 'model', 'scene']} />)}</div></div></>;
};

const TrendingAnalysisPanel: React.FC<{ goal: string; setGoal: (value: string) => void; analysis: TrendingReplicateAnalysis | null; onAnalyze: () => void; disabled: boolean }> = ({ goal, setGoal, analysis, onAnalyze, disabled }) => <div className="mt-5 border-t border-slate-100 pt-5"><label className="block text-xs font-bold">复刻目标<textarea value={goal} onChange={(event) => setGoal(event.target.value)} className="mt-1.5 h-20 w-full resize-none border border-slate-200 rounded-md p-2 text-xs font-normal leading-5" /></label><button onClick={onAnalyze} disabled={disabled} className="mt-3 h-8 px-3 rounded bg-slate-900 disabled:bg-slate-200 text-white text-xs font-bold">{analysis ? '重新分析分镜与爆点' : '分析分镜与爆点'}</button>{analysis && <div className="mt-4 space-y-3"><div className="grid grid-cols-3 gap-2">{analysis.keyframes.map((frame) => <div key={frame.id}><img src={frame.url} alt={frame.label} className="w-full aspect-[4/3] object-cover rounded" referrerPolicy="no-referrer"/><p className="mt-1 text-[10px] text-slate-500">{frame.label}</p></div>)}</div><div className="rounded bg-slate-50 p-3 text-xs">{analysis.shots.map((shot) => <div key={shot.time} className="py-2 border-b border-slate-200 last:border-0"><b>{shot.time}</b><span className="ml-2">{shot.scene} · {shot.action} · {shot.camera}</span></div>)}</div><div className="grid sm:grid-cols-3 gap-2 text-[11px]">{[['爆点逻辑', analysis.sellingLogic], ['替换策略', analysis.replacementPlan], ['风险提示', analysis.risks]].map(([title, values]) => <div key={String(title)} className="rounded border border-slate-200 p-2"><b>{String(title)}</b><ul className="mt-1 leading-5 text-slate-500">{(values as string[]).map((value) => <li key={value}>{value}</li>)}</ul></div>)}</div></div>}</div>;

const TrendingPreview: React.FC<{ source: VideoInputAsset | null; analysis: TrendingReplicateAnalysis | null }> = ({ source, analysis }) => <div className="bg-white border border-slate-200 rounded-lg p-5"><p className="text-[11px] font-bold text-primary">视频对照</p><h2 className="mt-1 font-black">原片与复刻结果</h2><div className="grid grid-cols-2 gap-3 mt-4">{[{ label: '原视频', value: source?.name ?? '等待导入' }, { label: '复刻结果', value: analysis ? '分析后提交生成' : '等待分析' }].map((item) => <div key={item.label} className="aspect-[9/16] rounded-md bg-slate-100 border border-slate-200 flex flex-col items-center justify-center p-2 text-center"><span className="material-symbols-outlined text-2xl text-slate-400">play_circle</span><p className="mt-2 text-[10px] font-bold">{item.label}</p><p className="mt-1 text-[10px] text-slate-400 line-clamp-2">{item.value}</p></div>)}</div></div>;

const AssetCard: React.FC<{ asset: VideoInputAsset; onReplace: () => void; onRemove: () => void }> = ({ asset, onReplace, onRemove }) => <div className="mt-4"><div className="relative"><button onClick={onReplace} className="block w-full"><img src={asset.url} alt={asset.name} className="w-full h-44 rounded-md object-cover border border-slate-200" referrerPolicy="no-referrer"/></button><button onClick={onRemove} className="absolute right-2 top-2 w-6 h-6 rounded-full bg-white text-slate-500 shadow" title="移除素材"><span className="material-symbols-outlined text-sm">close</span></button></div><p className="mt-2 text-xs font-bold truncate">{asset.name}</p><p className="mt-1 text-[10px] text-slate-400">来源：{asset.source}</p></div>;
const EmptyAssetButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => <button onClick={onClick} className="mt-4 w-full h-44 rounded-md border-2 border-dashed border-slate-300 bg-slate-50 hover:border-primary hover:bg-blue-50 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-primary"><span className="material-symbols-outlined text-4xl">add</span><span className="text-xs font-bold">{label}</span></button>;
const ReferenceTile: React.FC<{ asset: VideoInputAsset; onRemove: () => void; onRoleChange: (role: VideoAssetRole) => void; roles: VideoAssetRole[] }> = ({ asset, onRemove, onRoleChange, roles }) => <div className="relative min-w-0"><img src={asset.url} alt={asset.name} className="w-full aspect-square object-cover rounded border border-slate-200" referrerPolicy="no-referrer"/><button onClick={onRemove} className="absolute -right-1 -top-1 w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-400"><span className="material-symbols-outlined text-sm">close</span></button><select value={asset.role} onChange={(event) => onRoleChange(event.target.value as VideoAssetRole)} className="mt-1 w-full h-6 rounded border border-slate-200 px-1 text-[10px]">{roles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select><p className="mt-1 text-[10px] truncate">{asset.name}</p></div>;
const SelectField: React.FC<{ label: string; value: string; onChange: (value: string) => void; values: readonly string[] }> = ({ label, value, onChange, values }) => <label className="text-xs font-bold">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-9 w-full border border-slate-200 rounded px-2 text-xs">{values.map((item) => <option key={item}>{item}</option>)}</select></label>;
const AssistantDrawer: React.FC<{ onClose: () => void; onApply: () => void }> = ({ onClose, onApply }) => <div className="fixed inset-0 z-[70] flex justify-end"><button onClick={onClose} className="absolute inset-0 bg-slate-900/35" aria-label="关闭 AI 助手"/><aside className="relative w-full max-w-md bg-white h-full shadow-2xl p-6"><div className="flex justify-between"><div><p className="text-[11px] font-bold text-primary">AI 助手</p><h2 className="mt-1 font-black">视频 Prompt 建议</h2></div><button onClick={onClose} className="material-symbols-outlined text-slate-500">close</button></div><div className="mt-6 rounded-lg bg-blue-50 border border-blue-100 p-4 text-xs leading-6 text-slate-700">建议保持首帧中的商品主体和构图，使用克制的镜头运动，结尾通过特写强化材质与核心卖点。</div><button onClick={onApply} className="mt-5 h-9 px-4 rounded bg-primary text-white text-xs font-bold">应用到本次 Prompt</button></aside></div>;
const ModelConflictDialog: React.FC<{ onCancel: () => void; onConfirm: () => void }> = ({ onCancel, onConfirm }) => <div className="fixed inset-0 z-[75] flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-900/45"/><div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-2xl"><p className="text-[11px] font-bold text-amber-600">规格冲突</p><h2 className="mt-1 font-black">当前模型不支持已选规格</h2><p className="mt-3 text-xs leading-6 text-slate-500">确认后将调整为该模型支持的比例、时长、分辨率、运动幅度及参考图上限。</p><div className="mt-5 flex justify-end gap-2"><button onClick={onCancel} className="h-9 px-3 rounded border border-slate-200 text-xs font-bold">保留当前模型</button><button onClick={onConfirm} className="h-9 px-3 rounded bg-primary text-white text-xs font-bold">确认调整</button></div></div></div>;
