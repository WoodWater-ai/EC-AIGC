import React, { useEffect, useState } from 'react';
import type { ImageGenerationType, ModelProfile, ModelProfileAnchor, ModelRightsDeclaration } from '../types';

type ModelCreationMode = 'text' | 'reference' | 'face_swap';
export type ModelCreatorAssetTarget = 'reference' | 'face_source' | 'target_appearance';

export interface ModelCreatorAsset {
  id: string;
  name: string;
  url: string;
}

interface ModelProfileCreatorProps {
  open: boolean;
  onClose: () => void;
  onPublished: (profile: ModelProfile) => void;
  /** 由 App 打开共享资源中心；素材选择完成后回传到当前输入槽位。 */
  onRequestAsset: (target: ModelCreatorAssetTarget, onSelected: (asset: ModelCreatorAsset) => void) => void;
}

interface CreationModeOption {
  id: ModelCreationMode;
  label: string;
  description: string;
  icon: string;
}

const MODES: CreationModeOption[] = [
  { id: 'text', label: '文本生成', description: '用一句描述生成新人物', icon: 'auto_awesome' },
  { id: 'reference', label: '参考图生成', description: '参考一张图的气质和画面', icon: 'image' },
  { id: 'face_swap', label: '换脸生成', description: '将来源脸替换到目标形象', icon: 'face_retouching_natural' },
];

const DEMO_CANDIDATES = [
  '/mock-assets/reference/model-pure.jpg',
  '/mock-assets/reference/model-sweet.jpg',
  '/mock-assets/reference/model-senior.jpg',
  '/mock-assets/reference/pose-tryon.jpg',
];

const DEFAULT_TASKS: ImageGenerationType[] = ['product_main', 'scene_detail', 'on_model'];

function createAnchor(assetId: string, url: string, role: ModelProfileAnchor['role']): ModelProfileAnchor {
  return { assetId, url, position: 1, role };
}

export const ModelProfileCreator: React.FC<ModelProfileCreatorProps> = ({ open, onClose, onPublished, onRequestAsset }) => {
  const [mode, setMode] = useState<ModelCreationMode>('text');
  const [prompt, setPrompt] = useState('');
  const [referenceAsset, setReferenceAsset] = useState<ModelCreatorAsset>();
  const [faceSourceAsset, setFaceSourceAsset] = useState<ModelCreatorAsset>();
  const [targetAppearanceAsset, setTargetAppearanceAsset] = useState<ModelCreatorAsset>();
  const [sourceDescription, setSourceDescription] = useState('');
  const [rightsAccepted, setRightsAccepted] = useState(false);
  const [candidateCount, setCandidateCount] = useState(4);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<string>();
  const [profileName, setProfileName] = useState('');
  const [feeConfirmationOpen, setFeeConfirmationOpen] = useState(false);

  useEffect(() => {
    if (open) return;
    setMode('text');
    setPrompt('');
    setReferenceAsset(undefined);
    setFaceSourceAsset(undefined);
    setTargetAppearanceAsset(undefined);
    setSourceDescription('');
    setRightsAccepted(false);
    setCandidateCount(4);
    setCandidates([]);
    setSelectedCandidate(undefined);
    setProfileName('');
    setFeeConfirmationOpen(false);
  }, [open]);

  if (!open) return null;

  const modeOption = MODES.find((item) => item.id === mode) ?? MODES[0];
  const canGenerate = (mode === 'text' && Boolean(prompt.trim()))
    || (mode === 'reference' && Boolean(referenceAsset))
    || (mode === 'face_swap' && Boolean(faceSourceAsset && targetAppearanceAsset && rightsAccepted && sourceDescription.trim()));

  const selectMode = (nextMode: ModelCreationMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setCandidates([]);
    setSelectedCandidate(undefined);
    setProfileName('');
    setFeeConfirmationOpen(false);
  };

  const buildCandidates = () => {
    const leadImage = mode === 'reference' ? referenceAsset?.url : mode === 'face_swap' ? targetAppearanceAsset?.url : undefined;
    const nextCandidates = [leadImage, ...DEMO_CANDIDATES].filter((url): url is string => Boolean(url)).slice(0, candidateCount);
    setCandidates(nextCandidates);
    setSelectedCandidate(nextCandidates[0]);
    setProfileName(mode === 'face_swap' ? '换脸模特' : mode === 'reference' ? '参考图模特' : 'AI 模特');
    setFeeConfirmationOpen(false);
  };

  const saveProfile = () => {
    if (!selectedCandidate || !profileName.trim()) return;
    const timestamp = new Date().toISOString();
    const faceAnchor = mode === 'face_swap' && faceSourceAsset
      ? createAnchor(faceSourceAsset.id, faceSourceAsset.url, 'face_anchor')
      : createAnchor(`model-face-${Date.now()}`, selectedCandidate, 'face_anchor');
    const appearanceAnchor = mode === 'face_swap' && targetAppearanceAsset
      ? createAnchor(targetAppearanceAsset.id, targetAppearanceAsset.url, 'appearance_anchor')
      : mode === 'reference' && referenceAsset
        ? createAnchor(referenceAsset.id, referenceAsset.url, 'style_reference')
        : createAnchor(`model-appearance-${Date.now()}`, selectedCandidate, 'appearance_anchor');
    const declaration: ModelRightsDeclaration | undefined = mode === 'face_swap'
      ? { accepted: true, version: 'portrait-generation-consent-v1.0', operator: '当前操作人', declaredAt: timestamp, sourceDescription: sourceDescription.trim() }
      : undefined;
    const tags = mode === 'face_swap'
      ? ['换脸生成', '人物资产']
      : mode === 'reference'
        ? ['参考图生成', '人物资产']
        : ['AI 生成', '人物资产'];

    onPublished({
      id: `model-${Date.now()}`,
      name: profileName.trim(),
      image: selectedCandidate,
      source: mode === 'face_swap' ? '用户授权上传' : mode === 'reference' ? '授权参考' : '虚拟模特',
      sourceMode: mode,
      status: 'active',
      faceAnchor,
      appearanceAnchor,
      declaration,
      tags,
      suitableFor: DEFAULT_TASKS,
      reason: mode === 'face_swap' ? '由授权脸部来源与目标形象生成。' : mode === 'reference' ? '由用户参考图生成。' : '由文本描述生成。',
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div><h2 className="text-lg font-black text-slate-900">新建 AI 模特</h2><p className="mt-1 text-xs text-slate-500">输入描述或图片，生成候选图并保存为可复用人物资产。</p></div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="关闭" aria-label="关闭"><span className="material-symbols-outlined">close</span></button>
        </header>

        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-3 border-b border-slate-200">
            {MODES.map((item) => <button key={item.id} onClick={() => selectMode(item.id)} className={`flex min-h-16 items-center gap-2 border-b-2 px-2 text-left transition-colors sm:px-3 ${mode === item.id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><span className="material-symbols-outlined text-lg">{item.icon}</span><span className="min-w-0"><span className="block truncate text-xs font-black">{item.label}</span><span className="hidden truncate text-[10px] text-slate-400 lg:block">{item.description}</span></span></button>)}
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
            <section className="min-w-0">
              {mode === 'text' && <div>
                <label className="block text-xs font-black text-slate-700">人物描述</label>
                <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="例如：25 岁东方面孔女模特，清透自然妆，居家睡衣风格，全身站姿" className="mt-2 h-28 w-full resize-none border border-slate-200 p-3 text-sm leading-6 outline-none transition-colors focus:border-primary" />
              </div>}

              {mode === 'reference' && <div>
                <p className="text-xs font-black text-slate-700">形象或风格参考图</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">用于参考气质、姿势或画面；不会将参考人物直接保存为模特档案。</p>
                <AssetPickerTile asset={referenceAsset} label="选择参考图" onClick={() => onRequestAsset('reference', setReferenceAsset)} />
                <label className="mt-4 block text-xs font-black text-slate-700">补充描述 <span className="font-normal text-slate-400">可选</span><input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="例如：自然全身站姿，干净商业人像" className="mt-2 h-9 w-full border border-slate-200 px-3 text-xs outline-none focus:border-primary" /></label>
              </div>}

              {mode === 'face_swap' && <div>
                <p className="text-xs font-black text-slate-700">换脸生成</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">保留目标图的身材、服装、姿势和场景，将脸部来源替换进去。</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <AssetPickerTile asset={faceSourceAsset} label="选择脸部来源" helper="要使用哪张脸" onClick={() => onRequestAsset('face_source', setFaceSourceAsset)} />
                  <AssetPickerTile asset={targetAppearanceAsset} label="选择目标形象" helper="保留身材、姿势和画面" onClick={() => onRequestAsset('target_appearance', setTargetAppearanceAsset)} />
                </div>
                <label className="mt-4 block text-xs font-black text-slate-700">来源说明<input value={sourceDescription} onChange={(event) => setSourceDescription(event.target.value)} placeholder="例如：已取得模特肖像及生成使用授权" className="mt-2 h-9 w-full border border-slate-200 px-3 text-xs outline-none focus:border-primary" /></label>
                <label className="mt-3 flex cursor-pointer items-start gap-2 text-[11px] leading-5 text-slate-600"><input checked={rightsAccepted} onChange={(event) => setRightsAccepted(event.target.checked)} type="checkbox" className="mt-1" />我确认对脸部来源拥有合法肖像及生成使用授权，系统将记录来源、操作者、时间和声明版本。</label>
              </div>}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <div className="flex h-10 items-center border border-slate-200 bg-white">
                  <span className="px-3 text-xs font-bold text-slate-600">生成数量</span>
                  <button type="button" onClick={() => setCandidateCount((count) => Math.max(1, count - 1))} disabled={candidateCount <= 1} className="grid h-full w-9 place-items-center border-l border-slate-200 text-slate-500 hover:bg-slate-50 disabled:text-slate-300" aria-label="减少候选图数量"><span className="material-symbols-outlined text-base">remove</span></button>
                  <output className="grid h-full min-w-9 place-items-center border-l border-slate-200 text-xs font-black text-slate-800">{candidateCount}</output>
                  <button type="button" onClick={() => setCandidateCount((count) => Math.min(4, count + 1))} disabled={candidateCount >= 4} className="grid h-full w-9 place-items-center border-l border-slate-200 text-slate-500 hover:bg-slate-50 disabled:text-slate-300" aria-label="增加候选图数量"><span className="material-symbols-outlined text-base">add</span></button>
                </div>
                <button onClick={() => setFeeConfirmationOpen(true)} disabled={!canGenerate} className="flex h-10 items-center gap-2 bg-primary px-4 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"><span className="material-symbols-outlined text-base">auto_awesome</span>{candidates.length ? `重新生成 ${candidateCount} 张` : `生成 ${candidateCount} 张候选图`}</button>
              </div>
            </section>

            <aside className="border-l border-slate-100 pl-0 lg:pl-6">
              <p className="text-xs font-black text-slate-700">候选图 <span className="font-normal text-slate-400">{candidates.length ? `${candidates.length} 张` : `待生成 ${candidateCount} 张`}</span></p>
              {candidates.length === 0 ? <div className="mt-3 grid h-48 place-items-center border border-dashed border-slate-300 bg-slate-50 px-5 text-center text-[11px] leading-5 text-slate-400">生成后在这里选择一张，保存到模特资源库。</div> : <div className="mt-3 grid grid-cols-2 gap-2">{candidates.map((candidate, index) => <button key={`${candidate}-${index}`} onClick={() => setSelectedCandidate(candidate)} className={`relative aspect-[3/4] overflow-hidden border-2 ${selectedCandidate === candidate ? 'border-primary' : 'border-transparent hover:border-slate-300'}`}><img src={candidate} alt={`候选模特 ${index + 1}`} className="h-full w-full object-cover" />{selectedCandidate === candidate && <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-white"><span className="material-symbols-outlined text-sm">check</span></span>}</button>)}</div>}
              {selectedCandidate && <div className="mt-4 border-t border-slate-100 pt-4"><label className="block text-[11px] font-bold text-slate-600">模特名称<input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="给这个模特起个名字" className="mt-1.5 h-9 w-full border border-slate-200 px-2 text-xs outline-none focus:border-primary" /></label><button onClick={saveProfile} disabled={!profileName.trim()} className="mt-3 h-9 w-full bg-slate-900 text-xs font-bold text-white disabled:bg-slate-300">保存到模特库</button></div>}
            </aside>
          </div>
        </div>
      </div>

      {feeConfirmationOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/30 p-4"><div className="w-full max-w-sm border border-slate-200 bg-white p-5 shadow-xl"><p className="text-[11px] font-bold text-primary">Preflight 已通过</p><h3 className="mt-1 text-sm font-black">确认生成 {candidateCount} 张模特候选图</h3><div className="mt-4 space-y-2 border-y border-slate-100 py-3 text-xs"><div className="flex justify-between"><span className="text-slate-500">模式</span><span className="font-bold">{modeOption.label}</span></div><div className="flex justify-between"><span className="text-slate-500">模型</span><span className="font-bold">GPT Image 2</span></div><div className="flex justify-between"><span className="text-slate-500">预计费用</span><span className="font-bold">¥ {(candidateCount * 2.2).toFixed(2)}</span></div></div><p className="mt-3 text-[11px] leading-4 text-slate-500">仅在确认后提交生成；保存候选图不会再次产生费用。</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setFeeConfirmationOpen(false)} className="h-8 px-3 text-xs font-bold text-slate-500">取消</button><button onClick={buildCandidates} className="h-8 bg-primary px-3 text-xs font-bold text-white">确认费用并生成</button></div></div></div>}
    </div>
  );
};

interface AssetPickerTileProps {
  asset?: ModelCreatorAsset;
  label: string;
  helper?: string;
  onClick: () => void;
}

const AssetPickerTile: React.FC<AssetPickerTileProps> = ({ asset, label, helper, onClick }) => <button onClick={onClick} className="mt-3 flex min-h-36 w-full items-center gap-3 border border-dashed border-slate-300 bg-slate-50 p-3 text-left transition-colors hover:border-primary hover:bg-blue-50"><span className="h-28 w-24 shrink-0 overflow-hidden bg-white">{asset ? <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-slate-400"><span className="material-symbols-outlined text-2xl">folder_open</span></span>}</span><span className="min-w-0"><span className="block text-xs font-black text-slate-700">{label}</span>{helper && <span className="mt-1 block text-[11px] leading-4 text-slate-500">{helper}</span>}{asset && <span className="mt-1 block truncate text-[11px] text-slate-500">{asset.name}</span>}<span className="mt-2 block text-[11px] font-bold text-primary">从资源中心选择</span></span></button>;
