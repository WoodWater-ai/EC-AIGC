import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { GarmentDesign } from '../../api/modules/garmentDesign';
import {
  garmentRenderApi,
  type ApprovedGarment,
  type GarmentRenderPreflight,
  type GarmentRenderTask,
} from '../../api/modules/garmentRender';

interface GarmentRenderDialogProps {
  design: GarmentDesign;
  onClose: () => void;
  onLocked: () => void;
}

const terminal = new Set<GarmentRenderTask['status']>(['SUCCEEDED', 'PARTIAL_FAILED', 'FAILED', 'BLOCKED']);

export function GarmentRenderDialog({ design, onClose, onLocked }: GarmentRenderDialogProps) {
  const versionId = design.currentVersionId ?? '';
  const [preflight, setPreflight] = useState<GarmentRenderPreflight>();
  const [task, setTask] = useState<GarmentRenderTask>();
  const [approved, setApproved] = useState<ApprovedGarment | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lockingId, setLockingId] = useState('');
  const [candidateCount, setCandidateCount] = useState(2);
  const [artDirectionCode, setArtDirectionCode] = useState<'NEUTRAL_STUDIO' | 'SOFT_NATURAL_LIGHT' | 'TEXTURE_DETAIL' | 'ECOMMERCE_CATALOG'>('NEUTRAL_STUDIO');
  const [confirmInternal, setConfirmInternal] = useState(false);

  const load = useCallback(async () => {
    if (!versionId) return;
    setLoading(true);
    try {
      const [check, tasks, current] = await Promise.all([
        garmentRenderApi.preflight(versionId, candidateCount),
        garmentRenderApi.page({ pageNum: 1, pageSize: 1, designId: design.id }),
        garmentRenderApi.currentApproved(design.id),
      ]);
      setPreflight(check);
      setTask(tasks.list[0]);
      setApproved(current);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '成衣生成信息加载失败');
    } finally {
      setLoading(false);
    }
  }, [candidateCount, design.id, versionId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!task || terminal.has(task.status)) return;
    const timer = window.setInterval(() => {
      void garmentRenderApi.detail(task.id).then(setTask).catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [task]);

  const submit = async () => {
    if (!preflight?.ready || !versionId) return;
    setSubmitting(true);
    try {
      const random = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const taskId = await garmentRenderApi.submit({
        designVersionId: versionId,
        idempotencyKey: `garment-render:${random}`,
        candidateCount,
        artDirectionCode,
      });
      setTask(await garmentRenderApi.detail(taskId));
      toast.success('成衣生成任务已提交，关闭窗口后任务仍会继续');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '成衣生成提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const lock = async (candidateId: string) => {
    if (!confirmInternal) return;
    setLockingId(candidateId);
    try {
      const result = await garmentRenderApi.lockCandidate(candidateId);
      setApproved(result);
      setTask((current) => current ? {
        ...current,
        candidates: current.candidates.map((candidate) => ({
          ...candidate,
          status: candidate.id === candidateId ? 'SELECTED' : candidate.status,
        })),
      } : current);
      toast.success('已设为内部成衣定稿，可进入授权模特试穿；商业发布仍需终审');
      onLocked();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '候选定稿失败');
    } finally {
      setLockingId('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-stone-200 bg-[#f8f6f2] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-stone-200 bg-[#f8f6f2]/95 px-6 py-4 backdrop-blur">
          <div><p className="text-[10px] font-bold uppercase tracking-widest text-primary">AI garment render</p><h2 className="mt-1 text-lg font-bold text-stone-900">{design.name} · 生成成衣图</h2><p className="mt-1 font-mono text-[10px] text-stone-400">DESIGN VERSION {versionId || 'NONE'}</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-stone-400 hover:bg-white"><span className="material-symbols-outlined">close</span></button>
        </div>

        {loading ? <div className="flex min-h-[520px] items-center justify-center text-sm text-stone-400">正在执行生成前门禁检查…</div> : (
          <div className="grid gap-5 p-6 lg:grid-cols-[330px_1fr]">
            <aside className="space-y-4">
              <section className={`rounded-xl border p-4 ${preflight?.ready ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                <div className="flex items-center gap-2"><span className={`material-symbols-outlined ${preflight?.ready ? 'text-emerald-700' : 'text-rose-700'}`}>{preflight?.ready ? 'verified_user' : 'gpp_bad'}</span><b className="text-sm">{preflight?.ready ? '生成门禁已通过' : '生成已阻断'}</b></div>
                {preflight?.ready ? <div className="mt-3 space-y-1 text-xs leading-5 text-emerald-900"><p>通道：{preflight.channelName} / {preflight.modelCode}</p><p>合规档案：{preflight.providerProfileCode}</p><p>协议版本：{preflight.agreementVersion}</p><p>本次保守预估：¥{preflight.estimatedCost}</p></div> : <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-rose-800">{preflight?.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}
              </section>

              <section className="rounded-xl border border-stone-200 bg-white p-4">
                <label className="block text-xs font-bold text-stone-600">候选数量
                  <select value={candidateCount} onChange={(event) => setCandidateCount(Number(event.target.value))} disabled={Boolean(task && !terminal.has(task.status))} className="form-input mt-2"><option value={1}>1 张</option><option value={2}>2 张</option><option value={3}>3 张</option><option value={4}>4 张</option></select>
                </label>
                <label className="mt-4 block text-xs font-bold text-stone-600">受控画面方向
                  <select value={artDirectionCode} onChange={(event) => setArtDirectionCode(event.target.value as typeof artDirectionCode)} disabled={Boolean(task && !terminal.has(task.status))} className="form-input mt-2">
                    <option value="NEUTRAL_STUDIO">中性影棚 · 结构优先</option>
                    <option value="SOFT_NATURAL_LIGHT">柔和自然光 · 保持原色</option>
                    <option value="TEXTURE_DETAIL">面料细节 · 不改变结构</option>
                    <option value="ECOMMERCE_CATALOG">电商目录 · 纯净背景</option>
                  </select>
                </label>
                <button type="button" disabled={!preflight?.ready || submitting || Boolean(task && !terminal.has(task.status))} onClick={() => void submit()} className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{submitting ? '提交中…' : '生成新一组成衣候选'}</button>
              </section>

              {approved && <section className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-xs leading-5 text-violet-900"><b>当前内部定稿</b><p className="mt-1">{approved.status} · {approved.approvedAt}</p><p className="mt-2 break-all font-mono text-[9px] text-violet-500">PROVENANCE {approved.provenanceHash}</p></section>}
            </aside>

            <main className="rounded-xl border border-stone-200 bg-white p-5">
              {!task ? <div className="flex min-h-[500px] flex-col items-center justify-center text-stone-400"><span className="material-symbols-outlined text-5xl">auto_awesome</span><p className="mt-3 text-sm font-bold text-stone-600">尚未生成候选</p><p className="mt-1 text-xs">通过左侧门禁后提交，任务会异步执行并立即转存结果</p></div> : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-stone-900">生成任务 {task.id}</h3><p className="mt-1 font-mono text-[9px] text-stone-400">REQUEST {task.requestHash}</p><p className="mt-1 text-[10px] text-stone-500">预估 ¥{task.estimatedCost ?? '-'} · 入账 ¥{task.accountedCost ?? '-'} · {task.costBasis ?? 'PENDING'}</p></div><span className={`rounded-full px-3 py-1 text-[10px] font-bold ${task.status === 'SUCCEEDED' ? 'bg-emerald-50 text-emerald-700' : task.status === 'FAILED' || task.status === 'BLOCKED' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>{task.status}</span></div>
                  {task.failureMessage && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{task.failureMessage}</div>}
                  {!terminal.has(task.status) && <div className="mt-8 flex min-h-[360px] flex-col items-center justify-center text-blue-600"><span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span><p className="mt-3 text-sm font-bold">模型处理中，结果返回后会自动转存</p></div>}
                  {task.candidates.length > 0 && <div className="mt-5 grid gap-4 md:grid-cols-2">{task.candidates.map((candidate) => <article key={candidate.id} className={`overflow-hidden rounded-xl border ${candidate.status === 'SELECTED' ? 'border-violet-400 ring-2 ring-violet-100' : 'border-stone-200'}`}><div className="aspect-square bg-stone-50">{candidate.imageUrl ? <img src={candidate.imageUrl} alt={`候选 ${candidate.outputIndex + 1}`} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-xs text-stone-400">图片暂不可访问</div>}</div><div className="p-3"><div className="flex items-center justify-between"><b className="text-xs text-stone-800">候选 {candidate.outputIndex + 1}</b><span className="text-[9px] font-bold text-stone-400">{candidate.status}</span></div><p className="mt-2 truncate font-mono text-[9px] text-stone-400">SHA-256 {candidate.contentSha256}</p><button type="button" disabled={!confirmInternal || lockingId === candidate.id || candidate.status === 'SELECTED'} onClick={() => void lock(candidate.id)} className="mt-3 w-full rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800 disabled:opacity-40">{lockingId === candidate.id ? '定稿中…' : candidate.status === 'SELECTED' ? '已选为定稿' : '选为内部定稿'}</button></div></article>)}</div>}
                  {task.candidates.length > 0 && <label className="mt-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><input type="checkbox" checked={confirmInternal} onChange={(event) => setConfirmInternal(event.target.checked)} className="mt-1 accent-primary" /><span>我已人工检查衣服结构与结果内容，并理解此操作只形成内部设计定稿；模特试穿、对外发布和商业投放仍需各自的授权与合规检查。</span></label>}
                </>
              )}
            </main>
          </div>
        )}
      </div>
    </div>
  );
}
