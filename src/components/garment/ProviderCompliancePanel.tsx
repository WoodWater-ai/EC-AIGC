import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { channelApi } from '../../api/modules/channel';
import {
  providerComplianceApi,
  type ProviderComplianceProfile,
} from '../../api/modules/providerCompliance';
import type { ModelChannelDTO } from '../../types';
import { useFileUpload } from '../../hooks/useFileUpload';
import { sha256FileHex } from '../../utils/crypto';
import { openProtectedEvidence } from '../../utils/evidence';

type GarmentAiCapability = 'GARMENT_RENDER' | 'VIRTUAL_TRY_ON';

export function ProviderCompliancePanel({ canManage, canReview }: { canManage: boolean; canReview: boolean }) {
  const [capability, setCapability] = useState<GarmentAiCapability>('GARMENT_RENDER');
  const [profiles, setProfiles] = useState<ProviderComplianceProfile[]>([]);
  const [channels, setChannels] = useState<ModelChannelDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [page, availableChannels] = await Promise.all([
        providerComplianceApi.page({ pageNum: 1, pageSize: 100, capabilityCode: capability }),
        channelApi.listAvailable(capability),
      ]);
      setProfiles(page.list);
      setChannels(availableChannels);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '供应商合规档案加载失败');
    } finally {
      setLoading(false);
    }
  }, [capability]);

  useEffect(() => { void load(); }, [load]);

  const review = async (profile: ProviderComplianceProfile, decision: 'APPROVE' | 'REJECT') => {
    if (!profile.latestReview || profile.latestReview.decision !== 'PENDING') return;
    const reason = decision === 'REJECT' ? window.prompt('请输入驳回原因') ?? '' : '已核对协议原件、商业输出、训练使用、知识产权、分包方、留存与跨境条款';
    if (decision === 'REJECT' && !reason.trim()) return;
    try {
      await providerComplianceApi.review({ id: profile.latestReview.id, decision, reason });
      toast.success(decision === 'APPROVE' ? '合规档案已独立审核生效' : '合规档案已驳回');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '审核失败');
    }
  };

  const suspend = async (profile: ProviderComplianceProfile) => {
    const reason = window.prompt('请输入紧急停用原因（后续生成会立即阻断）')?.trim();
    if (!reason) return;
    try {
      await providerComplianceApi.suspend(profile.id, reason);
      toast.success('供应商合规档案已停用');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '停用失败');
    }
  };

  const viewEvidence = async (profile: ProviderComplianceProfile) => {
    try {
      await openProtectedEvidence(() => providerComplianceApi.evidence(profile.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '供应商协议原件读取失败');
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-bold text-stone-900">AI 供应商合规档案</h2><p className="mt-1 text-xs text-stone-500">生成执行只接受与通道、能力和模型精确匹配的已审核档案</p></div><div className="flex gap-2"><select value={capability} onChange={(event) => setCapability(event.target.value as GarmentAiCapability)} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-bold"><option value="GARMENT_RENDER">成衣生成</option><option value="VIRTUAL_TRY_ON">虚拟试穿</option></select>{canManage && <button type="button" onClick={() => setCreateOpen(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white">新增供应商档案</button>}</div></div>
      {channels.length === 0 && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">尚无启用 {capability} 能力的模型通道。请先在系统配置中启用 Agnes AI 对应能力并设置 IMAGE 默认模型，再登记合同档案与默认路由。</div>}
      {loading ? <div className="flex min-h-64 items-center justify-center text-sm text-stone-400">正在加载合规档案…</div> : profiles.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white text-stone-400"><span className="material-symbols-outlined text-5xl">policy</span><p className="mt-3 text-sm font-bold text-stone-600">还没有供应商合规档案</p><p className="mt-1 text-xs">缺少档案时系统会在调用外部模型前阻断</p></div> : <div className="space-y-3">{profiles.map((profile) => <article key={profile.id} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-stone-900">{profile.profileCode} · {profile.providerName}</h3><p className="mt-1 text-xs text-stone-500">{profile.channelType} / {profile.modelCode} · 协议 {profile.agreementVersion}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${profile.status === 'VALID' && profile.executionBlockers.length === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{profile.status}</span></div><div className="mt-4 grid gap-2 sm:grid-cols-4"><Flag label="商业输出" ok={profile.commercialOutput} /><Flag label="供应商训练" ok={!profile.providerTrainingUse} reversed /><Flag label="知识产权已审" ok={profile.ipTermsReviewed} /><Flag label="分包方已披露" ok={profile.subprocessorDisclosed} /><Flag label="输入留存" ok={profile.inputRetentionDays <= 30} value={`${profile.inputRetentionDays} 天`} /><Flag label="跨境审批" ok={!profile.crossBorderTransfer || profile.crossBorderApproved} /><Flag label="人像处理" ok={profile.portraitProcessing} value={profile.portraitProcessing ? '允许' : '未允许'} /><Flag label="协议原件" ok={Boolean(profile.agreementFileId)} value="已关联" /></div>{profile.executionBlockers.length > 0 && <ul className="mt-4 list-disc rounded-lg bg-rose-50 p-3 pl-8 text-xs leading-5 text-rose-800">{profile.executionBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}<div className="mt-4 flex flex-wrap items-center justify-between gap-3 font-mono text-[9px] text-stone-400"><span>SHA-256 {profile.agreementSha256}</span><div className="flex gap-2 font-sans"><button type="button" onClick={() => void viewEvidence(profile)} className="rounded border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700">查看原件</button>{profile.status === 'VALID' && <button type="button" onClick={() => void suspend(profile)} className="rounded border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-800">紧急停用</button>}{canReview && profile.latestReview?.decision === 'PENDING' && <><button type="button" onClick={() => void review(profile, 'REJECT')} className="rounded border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700">驳回</button><button type="button" disabled={profile.executionBlockers.filter((item) => item !== '档案未独立审核生效').length > 0} onClick={() => void review(profile, 'APPROVE')} className="rounded bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">审核通过</button></>}</div></div></article>)}</div>}
      {createOpen && <ProviderComplianceCreateDialog capability={capability} channels={channels} onClose={() => setCreateOpen(false)} onCompleted={() => { setCreateOpen(false); void load(); }} />}
    </div>
  );
}

function ProviderComplianceCreateDialog({ capability, channels, onClose, onCompleted }: { capability: GarmentAiCapability; channels: ModelChannelDTO[]; onClose: () => void; onCompleted: () => void }) {
  const { upload, loading: uploading, progress } = useFileUpload({ purpose: 'PROVIDER_AGREEMENT' });
  const [channelId, setChannelId] = useState(channels[0]?.id ?? '');
  const channel = channels.find((item) => item.id === channelId);
  const defaultModel = channel?.defaultModels?.IMAGE ?? '';
  const [modelCode, setModelCode] = useState(defaultModel ?? '');
  const [profileCode, setProfileCode] = useState(`${capability}_${Date.now()}`);
  const [providerName, setProviderName] = useState('');
  const [agreementName, setAgreementName] = useState('');
  const [agreementVersion, setAgreementVersion] = useState('');
  const [agreementFileId, setAgreementFileId] = useState('');
  const [agreementFileName, setAgreementFileName] = useState('');
  const [agreementSha256, setAgreementSha256] = useState('');
  const [commercialOutput, setCommercialOutput] = useState(false);
  const [providerTrainingUse, setProviderTrainingUse] = useState(true);
  const [ipTermsReviewed, setIpTermsReviewed] = useState(false);
  const [portraitProcessing, setPortraitProcessing] = useState(capability === 'VIRTUAL_TRY_ON');
  const [subprocessorDisclosed, setSubprocessorDisclosed] = useState(false);
  const [crossBorderTransfer, setCrossBorderTransfer] = useState(false);
  const [crossBorderApproved, setCrossBorderApproved] = useState(false);
  const [dataRegion, setDataRegion] = useState('');
  const [destinationRegions, setDestinationRegions] = useState('');
  const [legalBasisText, setLegalBasisText] = useState('');
  const [inputRetentionDays, setInputRetentionDays] = useState(0);
  const [deletionSlaHours, setDeletionSlaHours] = useState(24);
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [riskNotes, setRiskNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setModelCode(channel?.defaultModels?.IMAGE ?? ''); }, [channel]);

  const valid = useMemo(() => Boolean(channelId && modelCode.trim() && profileCode.trim() && providerName.trim()
    && agreementName.trim() && agreementVersion.trim() && agreementFileId && /^[a-fA-F0-9]{64}$/.test(agreementSha256)
    && commercialOutput && !providerTrainingUse && ipTermsReviewed && subprocessorDisclosed
    && (capability !== 'VIRTUAL_TRY_ON' || portraitProcessing)
    && inputRetentionDays <= 30
    && (!crossBorderTransfer || (crossBorderApproved && destinationRegions.trim() && legalBasisText.trim()))), [agreementFileId, agreementName, agreementSha256, agreementVersion, capability, channelId, commercialOutput, crossBorderApproved, crossBorderTransfer, destinationRegions, inputRetentionDays, ipTermsReviewed, legalBasisText, modelCode, portraitProcessing, profileCode, providerName, providerTrainingUse, subprocessorDisclosed]);

  const uploadAgreement = async (file?: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('协议原件只接受 PDF');
      return;
    }
    try {
      const [result, hash] = await Promise.all([upload(file), sha256FileHex(file)]);
      setAgreementFileId(result.fileResourceId);
      setAgreementSha256(hash);
      setAgreementFileName(file.name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '协议文件上传失败');
    }
  };

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    try {
      await providerComplianceApi.add({
        profileCode: profileCode.trim().toUpperCase(), channelId, providerName: providerName.trim(),
        capabilityCode: capability, modelCode: modelCode.trim(), agreementName: agreementName.trim(),
        agreementVersion: agreementVersion.trim(), agreementFileId, agreementSha256,
        commercialOutput, providerTrainingUse, ipTermsReviewed, portraitProcessing,
        subprocessorDisclosed, crossBorderTransfer, crossBorderApproved,
        dataRegion: dataRegion.trim() || undefined,
        destinationRegions: destinationRegions.split(',').map((item) => item.trim()).filter(Boolean),
        legalBasisText: legalBasisText.trim() || undefined, inputRetentionDays, deletionSlaHours,
        validFrom: validFrom ? String(new Date(`${validFrom}T00:00:00`).getTime()) : undefined,
        validTo: validTo ? String(new Date(`${validTo}T23:59:59`).getTime()) : undefined,
        riskNotes: riskNotes.trim() || undefined,
      });
      toast.success('供应商合规档案已提交独立审核');
      onCompleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '供应商合规档案创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"><div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-stone-200 bg-[#f8f6f2] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-primary">Provider compliance</p><h2 className="mt-1 text-lg font-bold text-stone-900">新增 AI 供应商合规档案</h2></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-stone-400 hover:bg-white"><span className="material-symbols-outlined">close</span></button></div><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="档案编码"><input value={profileCode} onChange={(event) => setProfileCode(event.target.value.toUpperCase())} className="form-input font-mono" /></Field><Field label="模型通道"><select value={channelId} onChange={(event) => setChannelId(event.target.value)} className="form-input"><option value="">请选择</option>{channels.map((item) => <option key={item.id} value={item.id}>{item.channelName} · {item.channelType}</option>)}</select></Field><Field label="供应商法定名称"><input value={providerName} onChange={(event) => setProviderName(event.target.value)} className="form-input" /></Field><Field label="精确模型编码"><input value={modelCode} onChange={(event) => setModelCode(event.target.value)} className="form-input font-mono" /></Field><Field label="协议/合同名称"><input value={agreementName} onChange={(event) => setAgreementName(event.target.value)} className="form-input" /></Field><Field label="协议/合同版本"><input value={agreementVersion} onChange={(event) => setAgreementVersion(event.target.value)} className="form-input" /></Field><label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-white p-4 text-stone-500 hover:border-primary"><span className="material-symbols-outlined">picture_as_pdf</span><span className="mt-1 text-center text-xs font-bold">{agreementFileName || (uploading ? `上传中 ${progress}%` : '上传协议原始 PDF')}</span><input type="file" accept="application/pdf,.pdf" disabled={uploading} onChange={(event) => void uploadAgreement(event.target.files?.[0])} className="hidden" /></label><Field label="协议原件 SHA-256"><input value={agreementSha256} readOnly className="form-input bg-stone-50 font-mono" /></Field><Field label="数据处理区域"><input value={dataRegion} onChange={(event) => setDataRegion(event.target.value)} className="form-input" /></Field><Field label="跨境目的区域（逗号分隔）"><input value={destinationRegions} onChange={(event) => setDestinationRegions(event.target.value)} disabled={!crossBorderTransfer} className="form-input disabled:bg-stone-100" /></Field><Field label="输入留存天数（执行上限 30）"><input type="number" min={0} max={3650} value={inputRetentionDays} onChange={(event) => setInputRetentionDays(Number(event.target.value))} className="form-input" /></Field><Field label="删除请求 SLA（小时）"><input type="number" min={1} value={deletionSlaHours} onChange={(event) => setDeletionSlaHours(Number(event.target.value))} className="form-input" /></Field><Field label="有效期开始"><input type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} className="form-input" /></Field><Field label="有效期结束"><input type="date" value={validTo} onChange={(event) => setValidTo(event.target.value)} className="form-input" /></Field><div className="md:col-span-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><Check label="协议允许商业输出" checked={commercialOutput} onChange={setCommercialOutput} /><Check label="供应商可用于训练（必须关闭）" checked={providerTrainingUse} onChange={setProviderTrainingUse} danger /><Check label="知识产权条款已审阅" checked={ipTermsReviewed} onChange={setIpTermsReviewed} /><Check label="分包处理者已披露" checked={subprocessorDisclosed} onChange={setSubprocessorDisclosed} /><Check label="发生跨境传输" checked={crossBorderTransfer} onChange={setCrossBorderTransfer} /><Check label="跨境已完成内部批准" checked={crossBorderApproved} onChange={setCrossBorderApproved} disabled={!crossBorderTransfer} /></div><div className="md:col-span-2"><Field label="数据处理/跨境法律依据"><textarea value={legalBasisText} onChange={(event) => setLegalBasisText(event.target.value)} disabled={!crossBorderTransfer} rows={3} className="form-input resize-none disabled:bg-stone-100" /></Field></div><div className="md:col-span-2"><Field label="风险备注"><textarea value={riskNotes} onChange={(event) => setRiskNotes(event.target.value)} rows={3} className="form-input resize-none" /></Field></div></div><div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">浏览器摘要只作为声明值；保存和独立审核时，后端都会从自有对象存储重新读取 PDF，校验真实文件结构、大小和 SHA-256。</div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-bold text-stone-600">取消</button><button type="button" disabled={!valid || submitting} onClick={() => void submit()} className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-white disabled:opacity-40">{submitting ? '提交中…' : '保存并提交独立审核'}</button></div></div></div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-stone-600">{label}</span>{children}</label>;
}

function Check({ label, checked, onChange, danger = false, disabled = false }: { label: string; checked: boolean; onChange: (value: boolean) => void; danger?: boolean; disabled?: boolean }) {
  return <label className={`flex items-center gap-2 rounded-lg border bg-white p-3 text-xs font-bold ${danger && checked ? 'border-rose-300 text-rose-700' : 'border-stone-200 text-stone-600'} ${disabled ? 'opacity-50' : ''}`}><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="accent-primary" />{label}</label>;
}

function Flag({ label, ok, value, reversed = false }: { label: string; ok: boolean; value?: string; reversed?: boolean }) {
  return <div className={`rounded-lg border p-3 ${ok ? 'border-emerald-100 bg-emerald-50' : 'border-rose-100 bg-rose-50'}`}><span className="block text-[9px] font-bold text-stone-400">{label}</span><span className={`mt-1 block text-xs font-bold ${ok ? 'text-emerald-700' : 'text-rose-700'}`}>{value ?? (ok ? (reversed ? '已禁止' : '已确认') : '未通过')}</span></div>;
}
