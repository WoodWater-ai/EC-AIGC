import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { commercialRightsApi, type CommercialRightsRecord } from '../../api/modules/commercialRights';
import { modelProfileApi, type ModelProfileDTO } from '../../api/modules/modelProfile';
import { modelRightsApi, personConsentApi, type PersonConsent } from '../../api/modules/personConsent';
import { useFileUpload } from '../../hooks/useFileUpload';
import { sha256FileHex } from '../../utils/crypto';
import { openProtectedEvidence } from '../../utils/evidence';

interface PersonConsentPanelProps {
  canManage: boolean;
  canReview: boolean;
  canManageRights: boolean;
}

export function PersonConsentPanel({ canManage, canReview, canManageRights }: PersonConsentPanelProps) {
  const [consents, setConsents] = useState<PersonConsent[]>([]);
  const [models, setModels] = useState<ModelProfileDTO[]>([]);
  const [rights, setRights] = useState<CommercialRightsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [binding, setBinding] = useState(false);
  const [bindModelId, setBindModelId] = useState('');
  const [bindRightsId, setBindRightsId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const consentPage = await personConsentApi.page({ pageNum: 1, pageSize: 100 });
      setConsents(consentPage.list);
      if (canManage || canManageRights) {
        const modelPage = await modelProfileApi.page({ pageNum: 1, pageSize: 200, status: 'active' });
        setModels(modelPage.list);
      }
      if (canManageRights) {
        const rightsPage = await commercialRightsApi.page({ pageNum: 1, pageSize: 200, status: 'VALID' });
        setRights(rightsPage.list);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '人物同意记录加载失败');
    } finally {
      setLoading(false);
    }
  }, [canManage, canManageRights]);

  useEffect(() => { void load(); }, [load]);

  const review = async (consent: PersonConsent, decision: 'APPROVE' | 'REJECT') => {
    const pending = consent.latestReview;
    if (!pending || pending.decision !== 'PENDING') return;
    const reason = decision === 'REJECT'
      ? window.prompt('请输入驳回原因')?.trim() ?? ''
      : '已核对同意原件、用途、AI 操作、通道、市场、有效期与跨境范围';
    if (decision === 'REJECT' && !reason) return;
    try {
      await personConsentApi.review({ reviewId: pending.id, decision, reason });
      toast.success(decision === 'APPROVE' ? '人物同意已独立审核生效' : '人物同意已驳回');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '人物同意审核失败');
    }
  };

  const revoke = async (consent: PersonConsent) => {
    const reason = window.prompt('请输入撤回原因；新的试穿任务会立即被阻断')?.trim();
    if (!reason) return;
    try {
      await personConsentApi.revoke(consent.id, reason);
      toast.success('人物同意已撤回');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '撤回失败');
    }
  };

  const viewEvidence = async (consent: PersonConsent) => {
    try {
      await openProtectedEvidence(() => personConsentApi.evidence(consent.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '人物同意原件读取失败');
    }
  };

  const bindRights = async () => {
    if (!bindModelId || !bindRightsId) return;
    setBinding(true);
    try {
      await modelRightsApi.bind(bindModelId, [bindRightsId]);
      toast.success('模特商业权利已绑定；试穿时仍会按目标市场和供应商重新校验');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '模特权利绑定失败');
    } finally {
      setBinding(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-base font-bold text-stone-900">人物同意与模特权利</h2><p className="mt-1 text-xs text-stone-500">真人/上传模特必须有双人审核同意；所有模特都必须有明确商业输出权利</p></div>
        {canManage && <button type="button" onClick={() => setCreateOpen(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white">新增人物同意</button>}
      </div>

      {canManageRights && (
        <div className="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 md:grid-cols-[1fr_1fr_auto]">
          <select value={bindModelId} onChange={(event) => setBindModelId(event.target.value)} className="form-input"><option value="">选择模特档案</option>{models.map((model) => <option key={model.id} value={model.id}>{model.name} · {model.modelType}</option>)}</select>
          <select value={bindRightsId} onChange={(event) => setBindRightsId(event.target.value)} className="form-input"><option value="">选择已生效权利记录</option>{rights.map((right) => <option key={right.id} value={right.id}>{right.rightsCode} · {right.licensorName}</option>)}</select>
          <button type="button" disabled={!bindModelId || !bindRightsId || binding} onClick={() => void bindRights()} className="rounded-lg border border-primary px-4 py-2 text-xs font-bold text-primary disabled:opacity-40">绑定模特权利</button>
          <p className="text-[10px] leading-4 text-stone-500 md:col-span-3">试穿要求权利记录显式包含供应商通道编码（例如 AGNES_AI）和目标市场编码（例如 CN），并覆盖商业、演绎、AI 处理、第三方传输；跨境时还需允许跨境。</p>
        </div>
      )}

      {loading ? <div className="flex min-h-64 items-center justify-center text-sm text-stone-400">正在加载人物同意…</div> : consents.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white text-stone-400"><span className="material-symbols-outlined text-5xl">person_shield</span><p className="mt-3 text-sm font-bold text-stone-600">还没有人物同意记录</p><p className="mt-1 text-xs">纯合成模特可免人物同意，但仍需商业权利记录</p></div> : <div className="space-y-3">{consents.map((consent) => <article key={consent.id} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-stone-900">{consent.consentCode} · {consent.modelName ?? consent.modelProfileId}</h3><p className="mt-1 text-xs text-stone-500">授权人 {consent.grantorName} · 市场 {consent.territoryScopes.join(', ')}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${consent.status === 'VALID' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{consent.status}</span></div><div className="mt-3 grid gap-2 text-[10px] text-stone-600 sm:grid-cols-3"><span className="rounded bg-stone-50 p-2">用途 {consent.purposeScopes.join(', ')}</span><span className="rounded bg-stone-50 p-2">操作 {consent.operationScopes.join(', ')}</span><span className="rounded bg-stone-50 p-2">通道 {consent.channelScopes.join(', ')}</span></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="font-mono text-[9px] text-stone-400">SHA-256 {consent.evidenceHash}</span><div className="flex gap-2"><button type="button" onClick={() => void viewEvidence(consent)} className="rounded border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700">查看原件</button>{canReview && consent.status === 'VALID' && <button type="button" onClick={() => void revoke(consent)} className="rounded border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700">撤回</button>}{canReview && consent.latestReview?.decision === 'PENDING' && <><button type="button" onClick={() => void review(consent, 'REJECT')} className="rounded border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700">驳回</button><button type="button" onClick={() => void review(consent, 'APPROVE')} className="rounded bg-primary px-3 py-1.5 text-xs font-bold text-white">审核通过</button></>}</div></div></article>)}</div>}

      {createOpen && <PersonConsentCreateDialog models={models} onClose={() => setCreateOpen(false)} onCompleted={() => { setCreateOpen(false); void load(); }} />}
    </div>
  );
}

function PersonConsentCreateDialog({ models, onClose, onCompleted }: { models: ModelProfileDTO[]; onClose: () => void; onCompleted: () => void }) {
  const { upload, loading, progress } = useFileUpload({ purpose: 'PERSON_CONSENT' });
  const eligibleModels = useMemo(() => models.filter((model) => !(model.modelType === 'virtual' && model.sourceMode === 'text')), [models]);
  const [modelProfileId, setModelProfileId] = useState(eligibleModels[0]?.id ?? '');
  const [consentCode, setConsentCode] = useState(`CONSENT_${Date.now()}`);
  const [grantorName, setGrantorName] = useState('');
  const [channelScopes, setChannelScopes] = useState('AGNES_AI');
  const [territoryScopes, setTerritoryScopes] = useState('CN');
  const [territoryText, setTerritoryText] = useState('中国大陆商业虚拟试穿');
  const [crossBorder, setCrossBorder] = useState(false);
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [evidenceFileId, setEvidenceFileId] = useState('');
  const [evidenceHash, setEvidenceHash] = useState('');
  const [fileName, setFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const uploadEvidence = async (file?: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { toast.error('人物同意原件只接受 PDF'); return; }
    try {
      const [result, hash] = await Promise.all([upload(file), sha256FileHex(file)]);
      setEvidenceFileId(result.fileResourceId); setEvidenceHash(hash); setFileName(file.name);
    } catch (error) { toast.error(error instanceof Error ? error.message : '人物同意原件上传失败'); }
  };

  const submit = async () => {
    if (!modelProfileId || !grantorName.trim() || !evidenceFileId) return;
    setSubmitting(true);
    try {
      await personConsentApi.add({
        consentCode: consentCode.trim().toUpperCase(), modelProfileId, grantorName: grantorName.trim(),
        purposeScopes: ['COMMERCIAL_VIRTUAL_TRY_ON'], operationScopes: ['VIRTUAL_TRY_ON'],
        channelScopes: splitCodes(channelScopes), territoryScopes: splitCodes(territoryScopes),
        territoryText: territoryText.trim() || undefined, crossBorder,
        validFrom: validFrom ? String(new Date(`${validFrom}T00:00:00`).getTime()) : undefined,
        validTo: validTo ? String(new Date(`${validTo}T23:59:59`).getTime()) : undefined,
        evidenceFileId, evidenceHash,
      });
      toast.success('人物同意已提交独立审核'); onCompleted();
    } catch (error) { toast.error(error instanceof Error ? error.message : '人物同意创建失败'); }
    finally { setSubmitting(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-[#faf9f6] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-primary">Person consent</p><h2 className="mt-1 text-lg font-bold">新增人物同意</h2></div><button type="button" onClick={onClose} className="rounded p-2 text-stone-400"><span className="material-symbols-outlined">close</span></button></div><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="同意记录编码"><input value={consentCode} onChange={(event) => setConsentCode(event.target.value.toUpperCase())} className="form-input font-mono" /></Field><Field label="模特档案"><select value={modelProfileId} onChange={(event) => setModelProfileId(event.target.value)} className="form-input"><option value="">请选择真人/上传模特</option>{eligibleModels.map((model) => <option key={model.id} value={model.id}>{model.name} · {model.modelType}</option>)}</select></Field><Field label="授权人/合法代理人"><input value={grantorName} onChange={(event) => setGrantorName(event.target.value)} className="form-input" /></Field><Field label="允许 AI 通道编码"><input value={channelScopes} onChange={(event) => setChannelScopes(event.target.value)} className="form-input font-mono" /></Field><Field label="允许市场编码"><input value={territoryScopes} onChange={(event) => setTerritoryScopes(event.target.value)} className="form-input font-mono" /></Field><Field label="地域说明"><input value={territoryText} onChange={(event) => setTerritoryText(event.target.value)} className="form-input" /></Field><Field label="有效期开始"><input type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} className="form-input" /></Field><Field label="有效期结束"><input type="date" value={validTo} onChange={(event) => setValidTo(event.target.value)} className="form-input" /></Field><label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-white p-4"><span className="material-symbols-outlined">picture_as_pdf</span><span className="mt-1 text-xs font-bold">{fileName || (loading ? `上传中 ${progress}%` : '上传人物同意原始 PDF')}</span><input type="file" accept="application/pdf,.pdf" className="hidden" disabled={loading} onChange={(event) => void uploadEvidence(event.target.files?.[0])} /></label><Field label="原件 SHA-256"><input value={evidenceHash} readOnly className="form-input bg-stone-50 font-mono" /></Field><label className="md:col-span-2 flex items-center gap-2 rounded-xl border border-stone-200 bg-white p-3 text-xs font-bold"><input type="checkbox" checked={crossBorder} onChange={(event) => setCrossBorder(event.target.checked)} className="accent-primary" />同意将人像发送到境外处理者（仅合同与内部审批也通过时生效）</label></div><div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">录入人与审核人必须为不同账号。勾选和结构化字段只用于执行门禁，不能替代法务对原始同意文本和适用法律的审查。</div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-bold">取消</button><button type="button" disabled={!modelProfileId || !grantorName.trim() || !evidenceFileId || submitting} onClick={() => void submit()} className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-white disabled:opacity-40">{submitting ? '提交中…' : '保存并提交审核'}</button></div></div></div>;
}

function splitCodes(value: string) { return value.split(/[，,]+/).map((item) => item.trim().toUpperCase()).filter(Boolean); }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-stone-600">{label}</span>{children}</label>; }
