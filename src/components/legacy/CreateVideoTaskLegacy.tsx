import React, { useEffect, useMemo, useState } from 'react';
import { AppScreen, GenerationTask, ProductAsset, VideoTaskEntryContext } from '../../types';
import { mockAssetResources, mockModelChannels, mockModelProfiles } from '../../mockData';

interface CreateVideoTaskProps {
  products: ProductAsset[];
  onAddTask: (task: GenerationTask) => void;
  setScreen: (screen: AppScreen) => void;
  openTransit: (onConfirmSelection: (fileResourceIds: number[]) => void, targetSlot?: string) => void;
  selectedProduct: ProductAsset;
  setSelectedProduct: (product: ProductAsset) => void;
  entryContext: VideoTaskEntryContext;
}

interface VideoAsset {
  id: string;
  name: string;
  url: string;
}

const shotsForDuration = (duration: number) => duration === 5
  ? [{ key: '0-2', label: '0-2 秒 · 建立画面' }, { key: '2-5', label: '2-5 秒 · 商品收束' }]
  : duration === 8
    ? [{ key: '0-2', label: '0-2 秒 · 建立画面' }, { key: '2-5', label: '2-5 秒 · 动作推进' }, { key: '5-8', label: '5-8 秒 · 商品收束' }]
    : [{ key: '0-3', label: '0-3 秒 · 建立画面' }, { key: '3-9', label: '3-9 秒 · 氛围与动作' }, { key: '9-15', label: '9-15 秒 · 商品收束' }];

export const CreateVideoTaskLegacy: React.FC<CreateVideoTaskProps> = ({ onAddTask, setScreen, openTransit, selectedProduct, entryContext }) => {
  const [mode, setMode] = useState<'img2video' | 'reference2video'>('img2video');
  const [duration, setDuration] = useState(8);
  const [motion, setMotion] = useState<'轻微' | '适中' | '强烈'>('适中');
  const [resolution, setResolution] = useState('1080p');
  const [referenceRole, setReferenceRole] = useState<'first_frame' | 'style_reference'>('style_reference');
  const [channelId, setChannelId] = useState('relay-studio');
  const [modelId, setModelId] = useState('vidu-q2');
  const [selectedProfileId, setSelectedProfileId] = useState<string | 'none'>('none');
  const [sourceAsset, setSourceAsset] = useState<VideoAsset | null>(null);
  const [referenceAssets, setReferenceAssets] = useState<VideoAsset[]>([]);
  const [segments, setSegments] = useState<Record<string, string>>({});
  const [negativePrompt, setNegativePrompt] = useState('商品漂移、面料闪烁、人物畸形');

  const channel = mockModelChannels.find((item) => item.id === channelId) ?? mockModelChannels[1];
  const model = channel.models.find((item) => item.id === modelId) ?? channel.models[0];
  const shots = useMemo(() => shotsForDuration(duration), [duration]);
  const sourceTask = entryContext.kind === 'approved-image' ? entryContext.sourceTask : null;
  const approvedSourceUrl = entryContext.kind === 'approved-image' ? entryContext.sourceResult.url : '';
  const sourceImage = sourceAsset?.url ?? approvedSourceUrl;
  const selectedProfile = mockModelProfiles.find((profile) => profile.id === selectedProfileId);
  const maxReferences = model.capability.maxReferenceImages ?? 1;
  const supportsSelection = (model.capability.durations?.includes(duration) ?? false)
    && (model.capability.motions?.includes(motion) ?? false)
    && model.capability.resolutions.includes(resolution)
    && (mode === 'img2video' || referenceAssets.length > 0);

  const resolveAssets = (fileResourceIds: number[]): VideoAsset[] => fileResourceIds
    .map((fileResourceId) => mockAssetResources.find((asset) => asset.fileResourceId === fileResourceId))
    .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset))
    .map((asset) => ({ id: `asset-${asset.fileResourceId}`, name: asset.name, url: asset.thumbnailUrl ?? asset.originalUrl ?? '' }));

  const selectSourceAsset = (fileResourceIds: number[]) => {
    const asset = resolveAssets(fileResourceIds)[0];
    if (asset) setSourceAsset(asset);
  };

  const addReferenceAssets = (fileResourceIds: number[]) => {
    setReferenceAssets((current) => [...current, ...resolveAssets(fileResourceIds).filter((asset) => !current.some((item) => item.id === asset.id))].slice(0, maxReferences));
  };

  const selectModelFromTransit = (fileResourceIds: number[]) => {
    const asset = resolveAssets(fileResourceIds)[0];
    if (!asset) return;
    const profile = mockModelProfiles.find((item) => asset.name.includes(item.name));
    if (profile) setSelectedProfileId(profile.id);
  };

  useEffect(() => {
    setSegments((previous) => {
      const next = { ...previous };
      shotsForDuration(duration).forEach((shot) => {
        if (!next[shot.key]) next[shot.key] = shot.key.includes('0-') ? '镜头缓慢建立，焦点锁定在商品主体。' : '保持商品主体稳定，展示材质与动作细节。';
      });
      return next;
    });
  }, [duration]);

  const handleChannelChange = (nextChannelId: string) => {
    const nextChannel = mockModelChannels.find((item) => item.id === nextChannelId)!;
    setChannelId(nextChannelId);
    setModelId(nextChannel.models[0].id);
  };

  const submit = () => {
    if (!supportsSelection || channel.health === 'maintenance') return;
    const referenceSummary = referenceAssets.length ? `；参考图：${referenceAssets.map((asset) => asset.name).join('、')}（${referenceRole === 'first_frame' ? '首帧补充' : '风格/动作参考'}）` : '';
    const modelSummary = selectedProfile ? `；模特：${selectedProfile.name}` : '';
    const prompt = `${shots.map((shot) => `${shot.label}: ${segments[shot.key]}`).join(' | ')}${referenceSummary}${modelSummary}`;
    const task: GenerationTask = {
      id: `V-${Date.now()}`,
      name: `视频任务 · ${selectedProduct.name}`,
      type: 'video',
      status: 'running',
      progress: 0,
      productName: selectedProduct.name,
      productImg: sourceImage,
      templateName: mode === 'img2video' ? '图片驱动视频模板' : '参考图驱动视频模板',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      creator: '陆永奇',
      modelChannel: `${channel.name} / ${model.name}`,
      taskPrompt: prompt,
      negativePrompt,
      modelSnapshot: { accessType: channel.accessType, channelId: channel.id, channelName: channel.name, modelId: model.id, modelName: model.name, supportedRatios: model.capability.ratios, maxCount: model.capability.maxCount, supportedResolutions: model.capability.resolutions, estimatedCost: model.cost },
      params: { ratio: '9:16', prompt },
    };
    onAddTask(task);
    setScreen(AppScreen.TASKS);
    window.setTimeout(() => onAddTask({ ...task, status: 'candidate', progress: 100, resultUrl: sourceImage }), 1000);
  };

  return <div className="h-screen overflow-hidden bg-[#f5f7fb] flex flex-col text-slate-800">
    <header className="h-16 shrink-0 px-6 bg-white border-b border-slate-200 flex items-center justify-between"><div className="flex gap-3 items-center"><button onClick={() => setScreen(AppScreen.TASKS)} className="material-symbols-outlined text-slate-500">arrow_back</button><div><p className="text-[11px] font-bold text-emerald-600">受控视频生成</p><h1 className="text-base font-black">从审核通过图片创建视频</h1></div></div><button onClick={submit} disabled={!supportsSelection || channel.health === 'maintenance'} className="h-9 px-4 rounded-md bg-primary disabled:bg-slate-300 text-white text-xs font-bold">提交视频任务</button></header>
    <main className="flex-1 overflow-y-auto p-6 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_350px] gap-5 max-w-[1440px] mx-auto w-full">
      <section className="space-y-5">
        <div className="bg-white border border-slate-200 rounded-lg p-5"><div className="flex justify-between items-start"><div><p className="text-[11px] font-bold text-primary">视频输入素材</p><h2 className="mt-1 font-black">审核通过首帧</h2></div><button onClick={() => openTransit(selectSourceAsset, 'main')} className="text-xs font-bold text-primary">资源中心</button></div><div className="mt-4 grid md:grid-cols-[240px_1fr] gap-4"><button onClick={() => openTransit(selectSourceAsset, 'main')} className="text-left"><img src={sourceImage} alt="视频首帧" className="w-full h-48 object-cover rounded-md border border-slate-100" referrerPolicy="no-referrer"/></button><div className="text-xs leading-6 text-slate-600"><p><b className="text-slate-800">商品：</b>{selectedProduct.name}</p><p><b className="text-slate-800">来源任务：</b>{sourceTask?.name ?? '从资源中心选择'}</p><p><b className="text-slate-800">优先级：</b>审核通过图片优先，资源中心选择可用于 mock 替换验证。</p><p className="mt-3 p-3 rounded bg-emerald-50 text-emerald-700">首帧确定商品主体和构图，是视频生成的最高优先级。</p></div></div></div>
        <div className="bg-white border border-slate-200 rounded-lg p-5"><p className="text-[11px] font-bold text-primary">视频任务配置</p><h2 className="mt-1 font-black">选择驱动方式</h2><div className="grid sm:grid-cols-2 gap-3 mt-4">{([{ id: 'img2video', title: 'img2video', text: '以首帧约束主体和构图。' }, { id: 'reference2video', title: 'reference2video', text: '在首帧基础上加入多张风格或动作参考。' }] as const).map((item) => <button key={item.id} onClick={() => setMode(item.id)} className={`p-4 border rounded-md text-left ${mode === item.id ? 'border-primary bg-blue-50' : 'border-slate-200'}`}><b className="text-xs">{item.title}</b><p className="text-[11px] mt-2 text-slate-500 leading-5">{item.text}</p></button>)}</div>{mode === 'reference2video' && <div className="mt-4 rounded-md border border-slate-200 p-4"><div className="flex justify-between items-center"><div><p className="text-xs font-bold">参考图片组</p><p className="mt-1 text-[11px] text-slate-400">当前模型最多 {maxReferences} 张；可一次从资源中心多选。</p></div><button onClick={() => openTransit(addReferenceAssets, 'video-reference')} className="text-xs text-primary font-bold">从资源中心添加</button></div><div className="flex flex-wrap gap-3 mt-4"><button onClick={() => openTransit(addReferenceAssets, 'video-reference')} className="w-20 h-20 rounded-md border-2 border-dashed border-slate-300 text-slate-400 hover:border-primary hover:text-primary"><span className="material-symbols-outlined text-2xl">add</span></button>{referenceAssets.map((asset) => <div key={asset.id} className="relative w-20"><img src={asset.url} alt={asset.name} className="w-20 h-20 rounded-md object-cover border border-slate-200" referrerPolicy="no-referrer"/><button onClick={() => setReferenceAssets((current) => current.filter((item) => item.id !== asset.id))} className="absolute -right-1 -top-1 w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-red-500"><span className="material-symbols-outlined text-sm">close</span></button><p className="mt-1 text-[10px] truncate">{asset.name}</p></div>)}</div><div className="flex gap-5 mt-4 text-xs"><label><input type="radio" checked={referenceRole === 'first_frame'} onChange={() => setReferenceRole('first_frame')} className="mr-2 accent-primary"/>首帧补充</label><label><input type="radio" checked={referenceRole === 'style_reference'} onChange={() => setReferenceRole('style_reference')} className="mr-2 accent-primary"/>风格 / 动作参考</label></div><p className="mt-3 text-[11px] text-amber-700">冲突时以审核通过首帧的商品主体与构图为最高优先级。</p></div>}</div>
        <div className="bg-white border border-slate-200 rounded-lg p-5"><div className="flex justify-between"><div><p className="text-[11px] font-bold text-primary">时长驱动分镜</p><h2 className="mt-1 font-black">镜头 Prompt</h2></div><select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="h-8 px-2 rounded border border-slate-200 text-xs">{[5, 8, 15].map((item) => <option key={item} value={item}>{item} 秒</option>)}</select></div><p className="mt-2 text-[11px] text-slate-400">切换时长会补充新的建议分镜，已编辑内容不会被覆盖。</p><div className="mt-4 space-y-3">{shots.map((shot) => <label key={shot.key} className="block text-xs font-bold">{shot.label}<textarea value={segments[shot.key] ?? ''} onChange={(event) => setSegments((all) => ({ ...all, [shot.key]: event.target.value }))} className="mt-1.5 h-20 w-full resize-none border border-slate-200 rounded-md p-2 font-normal leading-5" /></label>)}</div><label className="block mt-3 text-xs font-bold">负面约束<input value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} className="mt-1.5 h-9 w-full border border-slate-200 rounded-md px-2 font-normal" /></label></div>
      </section>
      <aside className="space-y-4"><div className="bg-white border border-slate-200 rounded-lg p-5"><p className="text-[11px] font-bold text-primary">模型能力</p><h2 className="font-black mt-1">视频规格</h2><label className="block mt-4 text-xs font-bold">模型通道<select value={channelId} onChange={(event) => handleChannelChange(event.target.value)} className="mt-1.5 h-9 w-full border border-slate-200 rounded px-2">{mockModelChannels.filter((item) => item.models.some((model) => model.capability.durations)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block mt-3 text-xs font-bold">具体模型<select value={modelId} onChange={(event) => setModelId(event.target.value)} className="mt-1.5 h-9 w-full border border-slate-200 rounded px-2">{channel.models.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block mt-3 text-xs font-bold">运动幅度<select value={motion} onChange={(event) => setMotion(event.target.value as typeof motion)} className="mt-1.5 h-9 w-full border border-slate-200 rounded px-2">{model.capability.motions?.map((item) => <option key={item}>{item}</option>)}</select></label><label className="block mt-3 text-xs font-bold">分辨率<select value={resolution} onChange={(event) => setResolution(event.target.value)} className="mt-1.5 h-9 w-full border border-slate-200 rounded px-2">{model.capability.resolutions.map((item) => <option key={item}>{item}</option>)}</select></label><div className="mt-4 p-3 bg-slate-50 rounded text-xs"><p>预估成本 <b>{model.cost.toFixed(1)} 元</b></p><p className="mt-2 text-slate-500">{channel.quotaText}</p></div>{!supportsSelection && <p className="mt-3 text-[11px] text-red-600">当前模型不支持所选规格，或 reference2video 尚未添加参考图。</p>}</div><div className="bg-white border border-slate-200 rounded-lg p-5"><div className="flex justify-between"><div><p className="text-[11px] font-bold text-primary">模特选择</p><h2 className="font-black mt-1">与图片任务保持一致</h2></div><button onClick={() => openTransit(selectModelFromTransit, 'model')} className="text-xs font-bold text-primary">资源中心</button></div><div className="grid grid-cols-3 gap-2 mt-4">{mockModelProfiles.map((profile) => <button key={profile.id} onClick={() => setSelectedProfileId(profile.id)} className={`p-1.5 rounded-md text-left border ${selectedProfileId === profile.id ? 'border-primary bg-blue-50' : 'border-slate-200'}`}><img src={profile.image} alt="" className="w-full h-14 object-cover rounded" referrerPolicy="no-referrer"/><p className="mt-1 text-[10px] font-bold truncate">{profile.name}</p></button>)}</div><button onClick={() => setSelectedProfileId('none')} className="mt-3 text-[11px] text-slate-400 hover:text-slate-700">不使用模特</button></div></aside>
    </main>
  </div>;
};
