import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  publicationApi,
  type PublicationPreflight,
  type PublicationRecord,
  type PublicationReview,
  type PublicationTargetType,
} from '../../api/modules/publication';
import { AssetImage } from '../AssetImage';

interface PublicationDialogProps {
  targetType: PublicationTargetType;
  targetId: string;
  title: string;
  canExport: boolean;
  onClose: () => void;
}

export function PublicationDialog({ targetType, targetId, title, canExport, onClose }: PublicationDialogProps) {
  const [preflight, setPreflight] = useState<PublicationPreflight>();
  const [review, setReview] = useState<PublicationReview>();
  const [record, setRecord] = useState<PublicationRecord>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void publicationApi.preflight(targetType, targetId)
      .then((result) => { if (active) setPreflight(result); })
      .catch((error) => toast.error(error instanceof Error ? error.message : '发布预检失败'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [targetId, targetType]);

  useEffect(() => {
    if (!review || review.status !== 'PENDING_REVIEW') return;
    const timer = window.setTimeout(() => {
      void publicationApi.status(review.id).then(setReview).catch(() => undefined);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [review]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      const id = await publicationApi.submit(targetType, targetId, `publication:${random}`);
      const current = await publicationApi.status(id);
      setReview(current);
      toast.success('已提交独立人工审核');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '发布审核提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const exportAsset = async () => {
    if (!review) return;
    setSubmitting(true);
    try {
      const exported = await publicationApi.export(review.id);
      setRecord(exported);
      setReview(await publicationApi.status(review.id));
      toast.success('已生成带 AI 标识图片和来源追溯清单');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '合规导出失败');
    } finally {
      setSubmitting(false);
    }
  };

  const currentRecord = record ?? review?.publicationRecord;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-stone-200 bg-[#f8f6f2] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[10px] font-bold uppercase tracking-widest text-primary">CN publication gate</p><h2 className="mt-1 text-lg font-bold text-stone-900">{title} · 发布审核</h2><p className="mt-1 text-xs text-stone-500">机器规则预检 → 独立人工复核 → 服务端加标导出</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-stone-400 hover:bg-white"><span className="material-symbols-outlined">close</span></button>
        </div>
        {loading ? <div className="flex min-h-72 items-center justify-center text-sm text-stone-400">正在核对来源、权利、同意、供应商与标识策略…</div> : preflight && (
          <div className="mt-5 grid gap-5 lg:grid-cols-[320px_1fr]">
            <aside className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white"><div className="aspect-[3/4] bg-stone-50"><AssetImage urls={[currentRecord?.exportImageUrl, preflight.sourcePreviewUrl]} alt="待发布资产" className="h-full" objectFit="contain" /></div><div className="p-3"><b className="text-xs">{targetType === 'APPROVED_GARMENT' ? '成衣定稿' : '已选试穿效果'}</b><p className="mt-1 truncate font-mono text-[9px] text-stone-400">{targetId}</p></div></div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">仅支持 <b>PUBLIC_DOWNLOAD / CN</b>。其他市场必须建立独立策略版本并经法务复核，当前不会静默放行。</div>
              {!review && <button type="button" disabled={!preflight.ready || submitting} onClick={() => void submit()} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{submitting ? '提交中…' : '提交独立人工审核'}</button>}
              {review?.status === 'APPROVED' && canExport && <button type="button" disabled={submitting} onClick={() => void exportAsset()} className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{submitting ? '服务端加标中…' : '生成合规导出资产'}</button>}
            </aside>
            <main className="space-y-4">
              <section className={`rounded-xl border p-4 ${preflight.ready ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}><div className="flex items-center justify-between"><b className={`text-sm ${preflight.ready ? 'text-emerald-800' : 'text-rose-800'}`}>{preflight.ready ? '机器预检可提交' : '机器预检阻断'}</b><span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold">{preflight.machineDecision}</span></div><p className="mt-1 font-mono text-[9px] text-stone-500">POLICY {preflight.policyVersion}</p></section>
              <section className="space-y-2">{preflight.items.map((item) => <div key={item.ruleCode} className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-3"><span className={`material-symbols-outlined text-lg ${item.decision === 'PASS' ? 'text-emerald-600' : item.decision === 'WARN' ? 'text-amber-600' : 'text-rose-600'}`}>{item.decision === 'PASS' ? 'check_circle' : item.decision === 'WARN' ? 'warning' : 'block'}</span><div><div className="font-mono text-[9px] font-bold text-stone-400">{item.ruleGroup} · {item.ruleCode}</div><p className="mt-1 text-xs leading-5 text-stone-700">{item.message}</p></div></div>)}</section>
              {review && <section className="rounded-xl border border-stone-200 bg-white p-4"><div className="flex items-center justify-between"><b className="text-sm">人工审核状态</b><span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-bold">{review.status}</span></div><p className="mt-2 text-xs text-stone-500">{review.status === 'PENDING_REVIEW' ? '等待具备发布审核权限且不同于提交人的人员复核。此页面会自动刷新。' : review.reviewReason || '审核已完成。'}</p><p className="mt-2 truncate font-mono text-[9px] text-stone-400">SNAPSHOT {review.sourceSnapshotHash}</p></section>}
              {currentRecord && <section className={`rounded-xl border p-4 ${currentRecord.status === 'ACTIVE' ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}><b className="text-sm">{currentRecord.status === 'ACTIVE' ? '合规导出已生成' : '该导出已被限制传播'}</b><p className="mt-2 text-xs leading-5">显式标识：{currentRecord.visibleLabelText} · 隐式元数据与来源清单策略：{currentRecord.labelPolicyVersion}</p><div className="mt-3 flex flex-wrap gap-2">{currentRecord.status === 'ACTIVE' && <a href={currentRecord.exportImageUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">打开加标图片</a>}<a href={currentRecord.manifestUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-800">查看追溯清单</a></div><p className="mt-3 truncate font-mono text-[8px] text-emerald-800">IMAGE SHA-256 {currentRecord.exportContentSha256}</p></section>}
            </main>
          </div>
        )}
      </div>
    </div>
  );
}
