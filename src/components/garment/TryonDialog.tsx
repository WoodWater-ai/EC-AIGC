import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { garmentRenderApi, type ApprovedGarment } from '../../api/modules/garmentRender';
import { tryonApi, type TryonAvailableModel, type TryonPreflight, type TryonProject, type TryonTask } from '../../api/modules/tryon';
import { AssetImage } from '../AssetImage';
import { PublicationDialog } from './PublicationDialog';

interface TryonDialogProps {
  designId: string;
  designName: string;
  approvedGarmentId: string;
  canPublish: boolean;
  canExportPublication: boolean;
  onClose: () => void;
}

export function TryonDialog({ designId, designName, approvedGarmentId, canPublish, canExportPublication, onClose }: TryonDialogProps) {
  const [garment, setGarment] = useState<ApprovedGarment | null>(null);
  const [models, setModels] = useState<TryonAvailableModel[]>([]);
  const [modelId, setModelId] = useState('');
  const [candidateCount, setCandidateCount] = useState(2);
  const [poseCode, setPoseCode] = useState('NATURAL_STANDING');
  const [sceneCode, setSceneCode] = useState('LIGHT_GRAY_STUDIO');
  const [preflight, setPreflight] = useState<TryonPreflight>();
  const [project, setProject] = useState<TryonProject>();
  const [task, setTask] = useState<TryonTask>();
  const [taskId, setTaskId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [publicationCandidateId, setPublicationCandidateId] = useState('');

  const loadTask = useCallback(async (id: string) => {
    try { setTask(await tryonApi.taskDetail(id)); }
    catch (error) { toast.error(error instanceof Error ? error.message : '试穿任务加载失败'); }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const current = await garmentRenderApi.currentApproved(designId);
        if (!current || current.id !== approvedGarmentId) throw new Error('当前成衣定稿已变化，请刷新设计列表');
        const available = await tryonApi.availableModels(approvedGarmentId, 'CN');
        if (!active) return;
        setGarment(current); setModels(available); setModelId(available[0]?.id ?? '');
      } catch (error) { toast.error(error instanceof Error ? error.message : '试穿准备失败'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [approvedGarmentId, designId]);

  useEffect(() => {
    if (!taskId) return;
    if (task && !['PENDING', 'RUNNING'].includes(task.status)) return;
    const timer = window.setTimeout(() => void loadTask(taskId), 2200);
    return () => window.clearTimeout(timer);
  }, [loadTask, task, taskId]);

  const generate = async () => {
    if (!modelId) return;
    setSubmitting(true); setPreflight(undefined); setTask(undefined); setProject(undefined);
    try {
      const projectId = await tryonApi.createProject({
        approvedGarmentId, modelProfileId: modelId,
        name: `${designName} · 虚拟试穿`, targetMarket: 'CN',
      });
      const check = await tryonApi.preflight(projectId, candidateCount);
      setPreflight(check);
      if (!check.ready) return;
      const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      const id = await tryonApi.submit({ projectId, idempotencyKey: `tryon:${random}`, candidateCount, poseCode, sceneCode });
      setProject(await tryonApi.projectDetail(projectId));
      setTaskId(id);
      await loadTask(id);
    } catch (error) { toast.error(error instanceof Error ? error.message : '试穿任务提交失败'); }
    finally { setSubmitting(false); }
  };

  const select = async (candidateId: string) => {
    try {
      const updated = await tryonApi.selectCandidate(candidateId);
      setProject(updated);
      if (taskId) await loadTask(taskId);
      toast.success('已选为内部试穿效果；商业导出仍需发布审核');
    } catch (error) { toast.error(error instanceof Error ? error.message : '试穿候选选择失败'); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"><div className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-stone-200 bg-[#f8f6f2] p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-widest text-primary">Authorized virtual try-on</p><h2 className="mt-1 text-lg font-bold text-stone-900">{designName} · 一键上身</h2><p className="mt-1 text-xs text-stone-500">锁定成衣 + 当前用途合规模特；候选默认仅限内部预览</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-stone-400 hover:bg-white"><span className="material-symbols-outlined">close</span></button></div>
    {loading ? <div className="flex min-h-80 items-center justify-center text-sm text-stone-400">正在检查成衣、模特权利、人物同意和供应商档案…</div> : <div className="mt-5 grid gap-5 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-4"><div className="overflow-hidden rounded-xl border border-stone-200 bg-white"><div className="aspect-[3/4] bg-stone-50"><AssetImage urls={[garment?.imageUrl]} alt="锁定成衣" className="h-full" objectFit="contain" /></div><div className="p-3"><b className="text-xs">锁定成衣事实源</b><p className="mt-1 font-mono text-[9px] text-stone-400">{approvedGarmentId}</p></div></div><label className="block"><span className="mb-1 block text-xs font-bold text-stone-600">姿态</span><select value={poseCode} onChange={(event) => setPoseCode(event.target.value)} className="form-input"><option value="NATURAL_STANDING">自然站立</option><option value="FRONT_RELAXED">正面放松</option><option value="THREE_QUARTER">轻微侧身</option></select></label><label className="block"><span className="mb-1 block text-xs font-bold text-stone-600">场景</span><select value={sceneCode} onChange={(event) => setSceneCode(event.target.value)} className="form-input"><option value="LIGHT_GRAY_STUDIO">浅灰影棚</option><option value="WHITE_STUDIO">纯白影棚</option><option value="SOFT_BEIGE">柔和米色</option></select></label><label className="block"><span className="mb-1 block text-xs font-bold text-stone-600">候选数量</span><select value={candidateCount} onChange={(event) => setCandidateCount(Number(event.target.value))} className="form-input"><option value={1}>1 张</option><option value={2}>2 张</option><option value={4}>4 张</option></select></label><button type="button" disabled={!modelId || submitting} onClick={() => void generate()} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{submitting ? '提交与预检中…' : '生成试穿候选'}</button></aside>
      <main className="space-y-5"><section><div className="flex items-center justify-between"><h3 className="text-sm font-bold text-stone-900">当前可用模特</h3><span className="text-[10px] text-stone-400">目标市场 CN · 不展示无权使用的模特</span></div>{models.length === 0 ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">暂无合规模特。请先登记 VIRTUAL_TRY_ON 供应商档案，为模特绑定覆盖 CN/供应商通道的商业权利；真人或上传模特还需独立审核人物同意。</div> : <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">{models.map((model) => <button key={model.id} type="button" onClick={() => setModelId(model.id)} className={`overflow-hidden rounded-xl border bg-white text-left ${modelId === model.id ? 'border-primary ring-2 ring-primary/15' : 'border-stone-200'}`}><div className="aspect-[3/4] bg-stone-50"><AssetImage urls={[model.imageUrl]} alt={model.name} className="h-full" objectFit="cover" /></div><div className="p-2"><b className="block truncate text-xs">{model.name}</b><span className="mt-1 block text-[9px] text-stone-400">{model.syntheticModel ? '纯合成模特' : '已审核人物同意'}</span></div></button>)}</div>}</section>
      {preflight && <section className={`rounded-xl border p-4 text-xs ${preflight.ready ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}><b>{preflight.ready ? '执行门禁通过' : '执行门禁阻断'}</b>{preflight.ready ? <p className="mt-1">{preflight.channelType} / {preflight.modelCode} · 合同 {preflight.agreementVersion} · 本次保守预估 ¥{preflight.estimatedCost}</p> : <ul className="mt-2 list-disc pl-5">{preflight.blockers.map((item) => <li key={item}>{item}</li>)}</ul>}</section>}
      {task && <section><div className="flex items-center justify-between"><div><h3 className="text-sm font-bold">试穿候选</h3><p className="mt-1 text-[10px] text-stone-500">预估 ¥{task.estimatedCost ?? '-'} · 入账 ¥{task.accountedCost ?? '-'} · {task.costBasis ?? 'PENDING'}</p></div><span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-bold">{task.status}</span></div>{task.failureMessage && <div className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{task.failureMessage}</div>}<div className="mt-3 grid gap-4 md:grid-cols-2">{task.candidates.map((candidate) => <article key={candidate.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white"><div className="aspect-[3/4] bg-stone-50"><AssetImage urls={[candidate.imageUrl]} alt={`试穿候选 ${candidate.outputIndex + 1}`} className="h-full" objectFit="contain" /></div><div className="p-3"><div className="grid grid-cols-3 gap-1 text-[9px]"><span className="rounded bg-amber-50 p-1 text-center text-amber-700">成衣 {candidate.garmentFidelityStatus}</span><span className="rounded bg-amber-50 p-1 text-center text-amber-700">人物 {candidate.personConsistencyStatus}</span><span className="rounded bg-amber-50 p-1 text-center text-amber-700">安全 {candidate.safetyStatus}</span></div><button type="button" onClick={() => void select(candidate.id)} className={`mt-3 w-full rounded-lg px-3 py-2 text-xs font-bold ${candidate.status === 'SELECTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-primary text-white'}`}>{candidate.status === 'SELECTED' ? '内部效果已选定' : '选为内部试穿效果'}</button><p className="mt-2 truncate font-mono text-[8px] text-stone-400">SHA-256 {candidate.contentSha256}</p></div></article>)}</div></section>}
      {project?.currentCandidateImageUrl && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><p>已选效果仍为内部预览，未进行内容安全与视觉保真人工复核、AI 标识或商业发布审核，不可直接对外导出。</p>{canPublish && project.currentCandidateId && <button type="button" onClick={() => setPublicationCandidateId(project.currentCandidateId!)} className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white">试穿效果发布审核与加标导出</button>}</div>}
      </main></div>}
    {publicationCandidateId && <PublicationDialog targetType="TRYON_CANDIDATE" targetId={publicationCandidateId} title={`${designName} · 试穿效果`} canExport={canExportPublication} onClose={() => setPublicationCandidateId('')} />}
    </div></div>;
}
