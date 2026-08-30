import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { publicationApi, type ComplianceReadiness, type PublicationReview } from '../../api/modules/publication';
import { AssetImage } from '../AssetImage';

interface PublicationReviewPanelProps {
  canSubmit: boolean;
  canReview: boolean;
  canExport: boolean;
}

const statusTone: Record<string, string> = {
  PENDING_REVIEW: 'bg-amber-50 text-amber-700', APPROVED: 'bg-blue-50 text-blue-700',
  REJECTED: 'bg-rose-50 text-rose-700', EXPORTED: 'bg-emerald-50 text-emerald-700',
  RESTRICTED: 'bg-rose-100 text-rose-800',
};

const readinessBlockerLabel: Record<string, string> = {
  V22_EVIDENCE_ACCESS_AUDIT_TABLE_NOT_READY: 'V22 原件访问审计表未就绪',
  V23_EVIDENCE_SCAN_TABLE_NOT_READY: 'V23 恶意文档扫描证明表未就绪',
  V25_BUDGET_RESERVATION_TABLE_NOT_READY: 'V25 预算预留与结算台账未就绪',
  V26_GARMENT_BUDGET_ADMINISTRATION_NOT_READY: 'V26 服装 AI 总额预算管理与变更审计未就绪',
  DOCUMENT_SCANNER_DISABLED: '企业文档扫描器未启用',
  DOCUMENT_SCANNER_CONFIG_INCOMPLETE: '企业文档扫描器配置不完整',
  PUBLICATION_FONT_NOT_READY: '正式 AI 标识字体或许可证原文制品未就绪',
  CONTROLLED_OBJECT_ACCESS_NOT_READY: '私有对象存储与短期签名访问尚未完成运维验收',
  ACTIVE_CHANNEL_BUDGET_GATE_DISABLED: '生产通道强制预算门禁被关闭',
  GARMENT_RENDER_ROUTE_NOT_READY: 'AI 成衣默认通道与模型未就绪',
  GARMENT_RENDER_PROVIDER_PROFILE_NOT_READY: 'AI 成衣供应商合规档案未就绪',
  GARMENT_RENDER_COST_ESTIMATE_NOT_READY: 'AI 成衣单候选保守成本未配置',
  GARMENT_RENDER_BUDGET_NOT_READY: 'AI 成衣通道正数 TOTAL 总额预算未配置',
  VIRTUAL_TRY_ON_ROUTE_NOT_READY: '虚拟试穿默认通道与模型未就绪',
  VIRTUAL_TRY_ON_PROVIDER_PROFILE_NOT_READY: '虚拟试穿供应商合规档案未就绪',
  VIRTUAL_TRY_ON_COST_ESTIMATE_NOT_READY: '虚拟试穿单候选保守成本未配置',
  VIRTUAL_TRY_ON_BUDGET_NOT_READY: '虚拟试穿通道正数 TOTAL 总额预算未配置',
};

export function PublicationReviewPanel({ canSubmit, canReview, canExport }: PublicationReviewPanelProps) {
  const [mine, setMine] = useState<PublicationReview[]>([]);
  const [pending, setPending] = useState<PublicationReview[]>([]);
  const [selected, setSelected] = useState<PublicationReview>();
  const [checks, setChecks] = useState({ rights: false, safety: false, fidelity: false, label: false });
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [readiness, setReadiness] = useState<ComplianceReadiness>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [myPage, reviewPage, readinessResult] = await Promise.all([
        canSubmit ? publicationApi.page({ pageNum: 1, pageSize: 100 }) : Promise.resolve({ list: [] as PublicationReview[] }),
        canReview ? publicationApi.adminPage({ pageNum: 1, pageSize: 100, status: 'PENDING_REVIEW' }) : Promise.resolve({ list: [] as PublicationReview[] }),
        canReview ? publicationApi.complianceReadiness() : Promise.resolve(undefined),
      ]);
      setMine(myPage.list);
      setPending(reviewPage.list);
      setReadiness(readinessResult);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '发布审核记录加载失败');
    } finally {
      setLoading(false);
    }
  }, [canReview, canSubmit]);

  useEffect(() => { void load(); }, [load]);

  const open = async (review: PublicationReview, admin: boolean) => {
    try {
      const detail = admin ? await publicationApi.adminDetail(review.id) : await publicationApi.status(review.id);
      setSelected(detail);
      setChecks({ rights: false, safety: false, fidelity: false, label: false });
      setReason('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '审核详情加载失败');
    }
  };

  const decide = async (decision: 'APPROVE' | 'REJECT') => {
    if (!selected) return;
    if (decision === 'REJECT' && !reason.trim()) { toast.error('驳回时必须填写原因'); return; }
    setSubmitting(true);
    try {
      await publicationApi.review({
        id: selected.id, decision, reason: reason.trim() || undefined,
        rightsAndConsentConfirmed: checks.rights,
        contentSafetyConfirmed: checks.safety,
        visualFidelityConfirmed: checks.fidelity,
        aiLabelConfirmed: checks.label,
      });
      toast.success(decision === 'APPROVE' ? '发布审核已批准' : '发布审核已驳回');
      setSelected(undefined);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '发布审核处理失败');
    } finally {
      setSubmitting(false);
    }
  };

  const exportAsset = async (review: PublicationReview) => {
    setSubmitting(true);
    try {
      await publicationApi.export(review.id);
      toast.success('带 AI 标识的导出资产已生成');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '合规导出失败');
    } finally {
      setSubmitting(false);
    }
  };

  const cards = (rows: PublicationReview[], admin: boolean) => rows.length === 0
    ? <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-xs text-stone-400">暂无记录</div>
    : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map((review) => <article key={review.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><b className="text-sm text-stone-900">{review.targetType === 'APPROVED_GARMENT' ? '成衣定稿发布' : '试穿效果发布'}</b><p className="mt-1 font-mono text-[9px] text-stone-400">REVIEW {review.id}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${statusTone[review.status] ?? 'bg-stone-100 text-stone-600'}`}>{review.status}</span></div><div className="mt-3 overflow-hidden rounded-lg border border-stone-100 bg-stone-50"><AssetImage urls={[review.publicationRecord?.exportImageUrl, review.sourcePreviewUrl]} alt="发布资产" className="h-40" objectFit="contain" /></div><div className="mt-3 flex gap-2"><button type="button" onClick={() => void open(review, admin)} className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-xs font-bold text-stone-700">查看规则</button>{!admin && canExport && review.status === 'APPROVED' && <button type="button" disabled={submitting} onClick={() => void exportAsset(review)} className="flex-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">加标导出</button>}{review.publicationRecord?.status === 'ACTIVE' && review.publicationRecord.exportImageUrl && <a href={review.publicationRecord.exportImageUrl} target="_blank" rel="noreferrer" className="flex-1 rounded-lg bg-primary px-3 py-2 text-center text-xs font-bold text-white">打开成品</a>}</div></article>)}</div>;

  return <div className="space-y-7">
    {canReview && readiness && <section className={`rounded-xl border p-4 ${readiness.productionReady ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}><div className="flex items-start gap-3"><span className={`material-symbols-outlined ${readiness.productionReady ? 'text-emerald-700' : 'text-rose-700'}`}>{readiness.productionReady ? 'verified' : 'gpp_maybe'}</span><div><h2 className={`text-sm font-bold ${readiness.productionReady ? 'text-emerald-900' : 'text-rose-900'}`}>{readiness.productionReady ? '商业合规基础设施已就绪' : '商业导出基础设施尚未就绪'}</h2>{readiness.productionReady ? <p className="mt-1 text-xs text-emerald-800">V22-V26、私有对象访问、企业扫描器、固定授权字体、许可证原文及 AI 通道预算均已通过运行检查。</p> : <ul className="mt-2 space-y-1 text-xs text-rose-800">{readiness.blockers.map((blocker) => <li key={blocker}>• {readinessBlockerLabel[blocker] ?? blocker}</li>)}</ul>}<p className="mt-2 font-mono text-[9px] text-stone-500">SCAN {readiness.scannerCode ?? '-'} / {readiness.scannerPolicyVersion ?? '-'}</p><p className="mt-1 font-mono text-[9px] text-stone-500">FONT {readiness.publicationFontSha256?.slice(0, 12) ?? '-'} / LICENSE {readiness.publicationFontLicenseId ?? '-'} {readiness.publicationFontLicenseSha256?.slice(0, 12) ?? '-'}</p></div></div></section>}
    {loading ? <div className="flex min-h-72 items-center justify-center text-sm text-stone-400">正在加载发布审核…</div> : <>
      {canReview && <section><div className="mb-3"><h2 className="text-base font-bold text-stone-900">待我人工复核</h2><p className="mt-1 text-xs text-stone-500">提交人与审核人必须不同；机器警告不能自动放行</p></div>{cards(pending, true)}</section>}
      {canSubmit && <section><div className="mb-3"><h2 className="text-base font-bold text-stone-900">我的发布与导出</h2><p className="mt-1 text-xs text-stone-500">仅显示本账号提交记录；被撤回授权影响的导出会标记为限制传播</p></div>{cards(mine, false)}</section>}
    </>}
    {selected && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-[#f8f6f2] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-primary">Publication review</p><h2 className="mt-1 text-lg font-bold">发布审核 {selected.id}</h2></div><button type="button" onClick={() => setSelected(undefined)} className="rounded p-2 text-stone-400 hover:bg-white"><span className="material-symbols-outlined">close</span></button></div><div className="mt-5 grid gap-5 lg:grid-cols-[280px_1fr]"><aside><div className="overflow-hidden rounded-xl border border-stone-200 bg-white"><AssetImage urls={[selected.sourcePreviewUrl]} alt="审核资产" className="h-80" objectFit="contain" /></div><p className="mt-3 break-all font-mono text-[8px] text-stone-400">SNAPSHOT {selected.sourceSnapshotHash}</p></aside><main className="space-y-3">{selected.items.map((item) => <div key={item.ruleCode} className="rounded-xl border border-stone-200 bg-white p-3"><div className="flex items-center justify-between"><span className="font-mono text-[9px] font-bold text-stone-400">{item.ruleGroup} · {item.ruleCode}</span><b className={`text-[10px] ${item.decision === 'PASS' ? 'text-emerald-700' : item.decision === 'WARN' ? 'text-amber-700' : 'text-rose-700'}`}>{item.decision}</b></div><p className="mt-1 text-xs leading-5 text-stone-700">{item.message}</p></div>)}{canReview && selected.status === 'PENDING_REVIEW' && <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-4">{([['rights', '已核对权利授权、人物同意及其范围'], ['safety', '已检查违法不良、歧视、色情和误导性内容'], ['fidelity', '已检查服装保真及人物一致性'], ['label', '已确认导出必须保留显式与隐式 AI 标识']] as const).map(([key, label]) => <label key={key} className="flex items-start gap-2 text-xs text-blue-950"><input type="checkbox" checked={checks[key]} onChange={(event) => setChecks((current) => ({ ...current, [key]: event.target.checked }))} className="mt-0.5 accent-primary" />{label}</label>)}<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="审核意见；驳回时必填" className="form-input min-h-20" /><div className="flex justify-end gap-2"><button type="button" disabled={submitting} onClick={() => void decide('REJECT')} className="rounded-lg border border-rose-300 bg-white px-4 py-2 text-xs font-bold text-rose-700">驳回</button><button type="button" disabled={submitting || !Object.values(checks).every(Boolean)} onClick={() => void decide('APPROVE')} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-40">批准发布</button></div></div>}</main></div></div></div>}
  </div>;
}
