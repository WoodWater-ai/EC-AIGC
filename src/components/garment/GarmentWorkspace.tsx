import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { AssetTransitModal } from '../AssetTransitModal';
import { AssetImage } from '../AssetImage';
import { useAuth } from '../../auth/AuthContext';
import { useFileUpload } from '../../hooks/useFileUpload';
import { sha256FileHex } from '../../utils/crypto';
import { openProtectedEvidence } from '../../utils/evidence';
import { assetApi, type AssetResourceItem } from '../../api/modules/asset';
import { garmentCategoryApi, type GarmentCategory } from '../../api/modules/garmentCategory';
import { garmentBlockApi, type GarmentBlock } from '../../api/modules/garmentBlock';
import {
  commercialRightsApi,
  type CommercialRightsRecord,
} from '../../api/modules/commercialRights';
import {
  garmentPartApi,
  type GarmentPart,
  type GarmentPartProcessStatus,
} from '../../api/modules/garmentPart';
import { GarmentDesignStudio } from './GarmentDesignStudio';
import { ProviderCompliancePanel } from './ProviderCompliancePanel';
import { PersonConsentPanel } from './PersonConsentPanel';
import { PublicationReviewPanel } from './PublicationReviewPanel';
import { GarmentBudgetPanel } from './GarmentBudgetPanel';
import { GARMENT_PREVIEW_BASE_WIDTH_RATIO } from '../../utils/renderGarmentPreview';

type WorkspaceTab = 'designs' | 'parts' | 'blocks' | 'categories' | 'rights' | 'providers' | 'budgets' | 'consents' | 'publications';

const statusLabel: Record<GarmentPartProcessStatus, string> = {
  DRAFT: '草稿',
  PROCESSING: '处理中',
  NEEDS_ADJUSTMENT: '待调整',
  READY_FOR_REVIEW: '可送审',
  APPROVED: '审核通过',
  PUBLISHED: '已发布',
  REJECTED: '已驳回',
  FAILED: '处理失败',
  DISABLED: '已停用',
};

const statusTone: Record<GarmentPartProcessStatus, string> = {
  DRAFT: 'bg-stone-100 text-stone-600',
  PROCESSING: 'bg-blue-50 text-blue-700',
  NEEDS_ADJUSTMENT: 'bg-amber-50 text-amber-700',
  READY_FOR_REVIEW: 'bg-cyan-50 text-cyan-700',
  APPROVED: 'bg-violet-50 text-violet-700',
  PUBLISHED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-rose-50 text-rose-700',
  FAILED: 'bg-rose-50 text-rose-700',
  DISABLED: 'bg-stone-100 text-stone-500',
};

interface PartImportWizardProps {
  categories: GarmentCategory[];
  blocks: GarmentBlock[];
  onClose: () => void;
  onCompleted: () => void;
}

function PartImportWizard({ categories, blocks, onClose, onCompleted }: PartImportWizardProps) {
  const [step, setStep] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sourceAsset, setSourceAsset] = useState<AssetResourceItem>();
  const [preparedCutout, setPreparedCutout] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState(`PART_${Date.now()}`);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const selectedCategory = categories.find((item) => item.id === categoryId);
  const availableSlots = selectedCategory?.slots ?? [];
  const [slotCode, setSlotCode] = useState(availableSlots[0]?.slotCode ?? '');
  const selectedSlot = availableSlots.find((item) => item.slotCode === slotCode);
  const [blockVersionId, setBlockVersionId] = useState(
    blocks.find((item) => item.categoryId === categories[0]?.id && item.currentVersionId)?.currentVersionId ?? '',
  );
  const [blockDetail, setBlockDetail] = useState<GarmentBlock>();
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const slots = categories.find((item) => item.id === categoryId)?.slots ?? [];
    if (!slots.some((item) => item.slotCode === slotCode)) {
      setSlotCode(slots[0]?.slotCode ?? '');
    }
  }, [categories, categoryId, slotCode]);

  useEffect(() => {
    const valid = blocks.some((item) => item.categoryId === categoryId && item.currentVersionId === blockVersionId);
    if (!valid) {
      setBlockVersionId(
        blocks.find((item) => item.categoryId === categoryId && item.currentVersionId)?.currentVersionId ?? '',
      );
    }
  }, [blockVersionId, blocks, categoryId]);

  useEffect(() => {
    const block = blocks.find((item) => item.currentVersionId === blockVersionId);
    if (!block) {
      setBlockDetail(undefined);
      return;
    }
    let active = true;
    void garmentBlockApi.availableDetail(block.id)
      .then((detail) => { if (active) setBlockDetail(detail); })
      .catch(() => { if (active) setBlockDetail(undefined); });
    return () => { active = false; };
  }, [blockVersionId, blocks]);

  const targetAnchor = useMemo(() => {
    const version = blockDetail?.versions?.find((item) => item.id === blockVersionId);
    const profile = version?.coordinateProfiles.find((item) => item.viewCode === 'FRONT');
    const anchors = profile?.anchors ?? {};
    const candidates = [anchors[slotCode], anchors[`${slotCode}_LEFT`], anchors.BODY];
    const raw = candidates.find((item) => typeof item === 'object' && item !== null) as Record<string, unknown> | undefined;
    return {
      x: typeof raw?.x === 'number' ? raw.x : 0.5,
      y: typeof raw?.y === 'number' ? raw.y : 0.5,
      coordinateProfileId: profile?.id,
      profileHash: profile?.profileHash,
    };
  }, [blockDetail, blockVersionId, slotCode]);

  const canContinue = step === 1
    ? Boolean(sourceAsset && preparedCutout)
    : step === 2
      ? Boolean(name.trim() && code.trim() && categoryId && slotCode)
      : Boolean(blockVersionId && targetAnchor.coordinateProfileId && targetAnchor.profileHash && scale > 0);

  const submit = async () => {
    if (!sourceAsset || !selectedSlot || !blockVersionId) return;
    setSubmitting(true);
    try {
      const sourceId = await garmentPartApi.importSource({
        sourceAssetId: sourceAsset.id,
        cutoutAssetId: sourceAsset.id,
        sourceMode: 'CUTOUT',
        sourceDescription: `设计师抠图导入：${name.trim()}`,
        scopeType: 'PRIVATE',
      });
      await garmentPartApi.saveAdjustment({
        sourceId,
        cutoutAssetId: sourceAsset.id,
        partType: selectedSlot.partType,
        viewCode: 'FRONT',
        processSnapshot: {
          mode: 'MANUAL_CUTOUT',
          normalizedCanvas: true,
          designerConfirmed: true,
        },
      });
      const versionId = await garmentPartApi.createVersion({
        sourceId,
        categoryId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        partType: selectedSlot.partType,
        slotCode,
        reuseLevel: 'PROJECT',
        viewCode: 'FRONT',
        representationType: 'RASTER_2D',
        geometryAssetId: sourceAsset.id,
        previewAssetId: sourceAsset.id,
        anchorSchema: {
          coordinateSystem: 'NORMALIZED_0_1',
          origin: { x: 0.5, y: 0.5 },
          slotCode,
        },
        deformationRule: { uniformScale: true, minScale: 0.5, maxScale: 2 },
        layerRule: { layerOrder: 30 },
        engineCode: 'MANUAL_2D',
        engineVersion: '1.0',
      });
      await garmentPartApi.saveProjectBinding({
        partTemplateVersionId: versionId,
        bindingScope: 'EXACT_BLOCK',
        blockVersionId,
        viewCode: 'FRONT',
        anchorMapping: {
          sourceAnchor: 'origin',
          targetSlot: slotCode,
          coordinateSystem: 'NORMALIZED_0_1',
          targetAnchor: { x: targetAnchor.x, y: targetAnchor.y },
          coordinateProfileId: targetAnchor.coordinateProfileId,
          coordinateProfileHash: targetAnchor.profileHash,
        },
        transform: {
          scale,
          translateX: offsetX,
          translateY: offsetY,
          translationSpace: 'CANVAS_NORMALIZED',
        },
        deformationMesh: { mode: 'NONE' },
        layerOrder: 30,
        confidenceScore: 1,
        engineCode: 'MANUAL_2D',
        engineVersion: '1.0',
      });
      toast.success('组件已创建并绑定到所选版型');
      onCompleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '组件创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-stone-200 bg-[#fbfaf8] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-[#fbfaf8]/95 px-6 py-4 backdrop-blur">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Component onboarding</p>
            <h2 className="mt-1 text-lg font-bold text-stone-900">新建服装组件</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="grid grid-cols-4 border-b border-stone-200 bg-white px-6">
          {['选择抠图', '定义组件', '版型适配', '确认创建'].map((label, index) => {
            const number = index + 1;
            return (
              <div key={label} className={`border-b-2 py-3 text-center text-xs font-bold ${step === number ? 'border-primary text-primary' : step > number ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-stone-400'}`}>
                <span className="mr-1.5 font-mono">{number.toString().padStart(2, '0')}</span>{label}
              </div>
            );
          })}
        </div>

        <div className="min-h-[430px] p-6">
          {step === 1 && (
            <div className="grid gap-6 md:grid-cols-[280px_1fr]">
              <button type="button" onClick={() => setPickerOpen(true)} className="group overflow-hidden rounded-xl border-2 border-dashed border-stone-300 bg-white text-left transition hover:border-primary">
                {sourceAsset ? (
                  <AssetImage urls={[sourceAsset.originalUrl, sourceAsset.thumbnailUrl]} alt={sourceAsset.name} className="h-[330px]" aspectRatio="auto" objectFit="contain" />
                ) : (
                  <div className="flex h-[330px] flex-col items-center justify-center text-stone-400">
                    <span className="material-symbols-outlined text-5xl">add_photo_alternate</span>
                    <span className="mt-3 text-sm font-bold">从素材中心选择</span>
                    <span className="mt-1 text-xs">支持现场上传后立即使用</span>
                  </div>
                )}
              </button>
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  当前开发阶段接收设计师已完成的透明背景抠图。原图自动抠图和 AI 锚点识别会通过后续标准化任务接入，不会用未准入模型代替。
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-white p-4">
                  <input type="checkbox" checked={preparedCutout} onChange={(event) => setPreparedCutout(event.target.checked)} className="mt-1 h-4 w-4 accent-primary" />
                  <span>
                    <span className="block text-sm font-bold text-stone-800">确认图片已完成抠图</span>
                    <span className="mt-1 block text-xs leading-5 text-stone-500">主体边缘清晰、背景透明，并且我有权将其用于当前项目。</span>
                  </span>
                </label>
                {sourceAsset && (
                  <div className="rounded-xl border border-stone-200 bg-white p-4 text-xs text-stone-600">
                    <div className="font-bold text-stone-900">{sourceAsset.name}</div>
                    <div className="mt-2 font-mono text-[10px] text-stone-400">ASSET {sourceAsset.id}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="组件名称"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：尖领 A 款" className="form-input" /></Field>
              <Field label="组件编码"><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} className="form-input font-mono" /></Field>
              <Field label="服装品类">
                <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="form-input">
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </Field>
              <Field label="目标槽位">
                <select value={slotCode} onChange={(event) => setSlotCode(event.target.value)} className="form-input">
                  {availableSlots.map((slot) => <option key={slot.id} value={slot.slotCode}>{slot.name} · {slot.partType}</option>)}
                </select>
              </Field>
              <div className="md:col-span-2 rounded-xl border border-stone-200 bg-white p-4 text-xs leading-5 text-stone-500">
                首次创建固定为项目私有组件。设计师不能自行套用企业授权；申请进入部门或公共组件库后，由具备审核权限的人员选择已生效的商用与演绎授权。
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-6 md:grid-cols-[1fr_320px]">
              <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-stone-200 bg-[linear-gradient(45deg,#f5f5f4_25%,transparent_25%),linear-gradient(-45deg,#f5f5f4_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f5f5f4_75%),linear-gradient(-45deg,transparent_75%,#f5f5f4_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px]">
                {sourceAsset && (
                  <div style={{ width: `${GARMENT_PREVIEW_BASE_WIDTH_RATIO * 100}%`, left: `${(targetAnchor.x + offsetX) * 100}%`, top: `${(targetAnchor.y + offsetY) * 100}%`, transform: 'translate(-50%, -50%)' }} className="absolute transition-all">
                    <div style={{ transform: `scale(${scale})`, transformOrigin: '50% 50%' }}><AssetImage urls={[sourceAsset.originalUrl, sourceAsset.thumbnailUrl]} alt="适配预览" aspectRatio="auto" objectFit="contain" /></div>
                  </div>
                )}
                <div style={{ left: `${targetAnchor.x * 100}%`, top: `${targetAnchor.y * 100}%` }} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-4 ring-primary/20" />
                <span className="absolute bottom-3 left-3 rounded bg-white/90 px-2 py-1 font-mono text-[10px] text-stone-500">FRONT · NORMALIZED 0—1</span>
              </div>
              <div className="space-y-4">
                <Field label="目标版型">
                  <select value={blockVersionId} onChange={(event) => setBlockVersionId(event.target.value)} className="form-input">
                    {blocks.filter((block) => block.categoryId === categoryId && block.currentVersionId).map((block) => <option key={block.id} value={block.currentVersionId}>{block.name} · {block.code}</option>)}
                  </select>
                </Field>
                <RangeField label="缩放" value={scale} min={0.5} max={2} step={0.01} onChange={setScale} />
                <RangeField label="水平偏移（画布比例）" value={offsetX} min={-0.25} max={0.25} step={0.005} onChange={setOffsetX} />
                <RangeField label="垂直偏移（画布比例）" value={offsetY} min={-0.25} max={0.25} step={0.005} onChange={setOffsetY} />
                <div className="rounded-xl border border-stone-200 bg-white p-3 font-mono text-[10px] text-stone-500">TARGET {slotCode} · X {targetAnchor.x.toFixed(3)} · Y {targetAnchor.y.toFixed(3)}<br />PROFILE {targetAnchor.profileHash?.slice(0, 16) ?? 'FALLBACK_CENTER'}</div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
                  此处保存的是版型坐标配置 ID/摘要、归一化锚点和画布比例偏移，不直接改变原始抠图。设计工作台与固化预览复用同一绑定；坐标配置发生变化时后端会拒绝旧提交并要求重新适配。
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="mx-auto max-w-2xl space-y-4">
              <h3 className="text-base font-bold text-stone-900">创建前检查</h3>
              <CheckRow ok={Boolean(sourceAsset)} label="抠图素材已选择" detail={sourceAsset?.name ?? '未选择'} />
              <CheckRow ok={preparedCutout} label="设计师已确认抠图质量与使用权" detail="确认记录会写入处理快照" />
              <CheckRow ok={Boolean(selectedSlot)} label="组件类型符合品类槽位" detail={`${selectedCategory?.name ?? '-'} / ${selectedSlot?.name ?? '-'}`} />
              <CheckRow ok={Boolean(blockVersionId)} label="已选择精确版型版本" detail="绑定将自动标记为设计师人工确认" />
              <CheckRow ok={Boolean(targetAnchor.coordinateProfileId && targetAnchor.profileHash)} label="版型坐标配置已锁定" detail={targetAnchor.profileHash ? `SHA-256 ${targetAnchor.profileHash.slice(0, 16)}…` : '缺少坐标配置，不能创建绑定'} />
              <CheckRow ok={false} warning label="公共复用授权" detail="当前保持项目私有；公共授权由独立审核人员在入库环节绑定" />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between border-t border-stone-200 bg-white px-6 py-4">
          <button type="button" disabled={step === 1 || submitting} onClick={() => setStep((current) => current - 1)} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-bold text-stone-600 disabled:opacity-40">上一步</button>
          {step < 4 ? (
            <button type="button" disabled={!canContinue} onClick={() => setStep((current) => current + 1)} className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">继续</button>
          ) : (
            <button type="button" disabled={!canContinue || submitting} onClick={submit} className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{submitting ? '创建中…' : '创建并绑定'}</button>
          )}
        </div>
      </div>
      {pickerOpen && (
        <AssetTransitModal
          onClose={() => setPickerOpen(false)}
          onConfirmSelection={(assets) => {
            setSourceAsset(assets[0]);
            setPickerOpen(false);
          }}
          purpose="OTHER"
          assetKind="IMAGE"
          multiSelect={false}
          selectionOnly
          allowedSources={['UPLOAD']}
          initialSource="UPLOAD"
          targetSlot="garment-part"
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-stone-600">{label}</span>{children}</label>;
}

function RangeField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="block rounded-xl border border-stone-200 bg-white p-3">
      <span className="flex justify-between text-xs font-bold text-stone-600"><span>{label}</span><span className="font-mono text-primary">{value.toFixed(2)}</span></span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} className="mt-3 w-full accent-primary" />
    </label>
  );
}

function CheckRow({ ok, warning = false, label, detail }: { ok: boolean; warning?: boolean; label: string; detail: string }) {
  const color = ok ? 'text-emerald-600' : warning ? 'text-amber-600' : 'text-rose-600';
  return (
    <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-4">
      <span className={`material-symbols-outlined ${color}`}>{ok ? 'check_circle' : warning ? 'warning' : 'cancel'}</span>
      <div><div className="text-sm font-bold text-stone-800">{label}</div><div className="mt-1 text-xs text-stone-500">{detail}</div></div>
    </div>
  );
}

function CommercialRightsCreateModal({ onClose, onCompleted }: { onClose: () => void; onCompleted: () => void }) {
  const { upload: uploadEvidence, loading: evidenceUploading, progress: evidenceProgress } = useFileUpload({ purpose: 'COMMERCIAL_RIGHTS' });
  const [evidenceFileId, setEvidenceFileId] = useState('');
  const [evidenceFileName, setEvidenceFileName] = useState('');
  const [rightsCode, setRightsCode] = useState(`RIGHTS_${Date.now()}`);
  const [licensorName, setLicensorName] = useState('');
  const [licenseeName, setLicenseeName] = useState('');
  const [licenseType, setLicenseType] = useState<'OWNED' | 'PURCHASED' | 'CUSTOM' | 'OTHER'>('CUSTOM');
  const [territoryText, setTerritoryText] = useState('中国大陆');
  const [territoryScope, setTerritoryScope] = useState('CN');
  const [channelScope, setChannelScope] = useState('AGNES_AI');
  const [evidenceHash, setEvidenceHash] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [commercialUse, setCommercialUse] = useState(true);
  const [derivativeUse, setDerivativeUse] = useState(true);
  const [aiProcessing, setAiProcessing] = useState(true);
  const [thirdPartyTransfer, setThirdPartyTransfer] = useState(false);
  const [crossBorder, setCrossBorder] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const uploadEvidenceFile = async (file?: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('授权证明必须上传原始 PDF 文件');
      return;
    }
    try {
      const [uploadResult, sha256] = await Promise.all([uploadEvidence(file), sha256FileHex(file)]);
      setEvidenceFileId(uploadResult.fileResourceId);
      setEvidenceFileName(file.name);
      setEvidenceHash(sha256);
      toast.success('授权证明原始文件已上传并计算 SHA-256');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '授权证明上传失败');
    }
  };

  const submit = async () => {
    if (!evidenceFileId || !/^[a-fA-F0-9]{64}$/.test(evidenceHash.trim())) return;
    setSubmitting(true);
    try {
      await commercialRightsApi.add({
        rightsCode: rightsCode.trim().toUpperCase(),
        rightsType: 'LICENSE',
        licensorName: licensorName.trim(),
        licenseeName: licenseeName.trim(),
        licenseType,
        commercialUse,
        derivativeUse,
        aiProcessing,
        thirdPartyTransfer,
        crossBorder,
        territoryText: territoryText.trim() || undefined,
        territoryScope: territoryScope.split(/[，,]+/).map((item) => item.trim().toUpperCase()).filter(Boolean),
        channelScope: channelScope.split(/[，,]+/).map((item) => item.trim()).filter(Boolean),
        validFrom: validFrom ? String(new Date(`${validFrom}T00:00:00`).getTime()) : undefined,
        validTo: validTo ? String(new Date(`${validTo}T23:59:59`).getTime()) : undefined,
        evidenceFileId,
        evidenceHash: evidenceHash.trim().toLowerCase(),
      });
      toast.success('权利记录已创建，等待另一位审核人确认');
      onCompleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '权利记录创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const valid = Boolean(rightsCode.trim() && licensorName.trim() && licenseeName.trim()
    && evidenceFileId && /^[a-fA-F0-9]{64}$/.test(evidenceHash.trim()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-stone-200 bg-[#fbfaf8] p-6 shadow-2xl">
        <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-primary">Commercial rights</p><h2 className="mt-1 text-lg font-bold text-stone-900">新增商业权利记录</h2></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-stone-400 hover:bg-stone-100"><span className="material-symbols-outlined">close</span></button></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="权利记录编码"><input value={rightsCode} onChange={(event) => setRightsCode(event.target.value.toUpperCase())} className="form-input font-mono" /></Field>
          <Field label="授权类型"><select value={licenseType} onChange={(event) => setLicenseType(event.target.value as typeof licenseType)} className="form-input"><option value="OWNED">企业自有</option><option value="PURCHASED">采购许可</option><option value="CUSTOM">定制授权</option><option value="OTHER">其他</option></select></Field>
          <Field label="授权方"><input value={licensorName} onChange={(event) => setLicensorName(event.target.value)} className="form-input" /></Field>
          <Field label="被授权方"><input value={licenseeName} onChange={(event) => setLicenseeName(event.target.value)} className="form-input" /></Field>
          <Field label="授权地域"><input value={territoryText} onChange={(event) => setTerritoryText(event.target.value)} className="form-input" /></Field>
          <Field label="目标市场编码（逗号分隔）"><input value={territoryScope} onChange={(event) => setTerritoryScope(event.target.value)} className="form-input font-mono" /></Field>
          <Field label="允许 AI 通道编码（逗号分隔）"><input value={channelScope} onChange={(event) => setChannelScope(event.target.value)} className="form-input font-mono" /></Field>
          <Field label="有效期开始"><input type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} className="form-input" /></Field>
          <Field label="有效期结束"><input type="date" value={validTo} onChange={(event) => setValidTo(event.target.value)} className="form-input" /></Field>
          <div className="md:col-span-2 grid gap-2 sm:grid-cols-3">
            {[
              ['允许商业使用', commercialUse, setCommercialUse],
              ['允许修改演绎', derivativeUse, setDerivativeUse],
              ['允许 AI 处理', aiProcessing, setAiProcessing],
              ['允许第三方传输', thirdPartyTransfer, setThirdPartyTransfer],
              ['允许跨境', crossBorder, setCrossBorder],
            ].map(([label, checked, setter]) => <label key={label as string} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white p-3 text-xs font-bold text-stone-600"><input type="checkbox" checked={checked as boolean} onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)} className="accent-primary" />{label as string}</label>)}
          </div>
          <div className="md:col-span-2 grid gap-4 md:grid-cols-[220px_1fr]">
            <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-white p-4 text-stone-500 hover:border-primary">
              <span className="material-symbols-outlined">picture_as_pdf</span><span className="mt-1 text-center text-xs font-bold">{evidenceFileName || (evidenceUploading ? `上传中 ${evidenceProgress}%` : '上传原始授权 PDF')}</span><input type="file" accept="application/pdf,.pdf" disabled={evidenceUploading} onChange={(event) => void uploadEvidenceFile(event.target.files?.[0])} className="hidden" />
            </label>
            <Field label="授权证明文件 SHA-256"><input value={evidenceHash} readOnly placeholder="上传 PDF 后自动计算" className="form-input bg-stone-50 font-mono" /><span className="mt-1.5 block text-[10px] leading-4 text-emerald-700">浏览器摘要仅用于提交比对；后端会重新读取对象存储原件并复算，截图或素材元数据不能代替授权 PDF。</span></Field>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-bold text-stone-600">取消</button><button type="button" disabled={!valid || submitting} onClick={() => void submit()} className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-white disabled:opacity-40">{submitting ? '保存中…' : '保存并提交独立审核'}</button></div>
      </div>
    </div>
  );
}

function CommercialRightsCard({ record, canReview, onReview, onView }: {
  record: CommercialRightsRecord;
  canReview: boolean;
  onReview: (decision: 'APPROVE' | 'REJECT') => void;
  onView: () => void;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-bold text-stone-900">{record.rightsCode}</h3><p className="mt-1 text-xs text-stone-500">{record.licensorName} → {record.licenseeName}</p></div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${record.status === 'VALID' ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>{record.status}</span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <Metric label="商业使用" value={record.commercialUse ? '允许' : '禁止'} />
        <Metric label="修改演绎" value={record.derivativeUse ? '允许' : '禁止'} />
        <Metric label="AI 处理" value={record.aiProcessing ? '允许' : '禁止'} />
        <Metric label="第三方传输" value={record.thirdPartyTransfer ? '允许' : '禁止'} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] text-stone-400"><span>ID {record.id}</span><div className="flex items-center gap-2"><span>SHA-256 {record.evidenceHash}</span><button type="button" onClick={onView} className="rounded border border-stone-200 px-2 py-1 font-sans text-[10px] font-bold text-stone-600">查看原件</button></div></div>
      {record.latestReview && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-stone-50 p-3 text-xs">
          <span>审核状态：<b>{record.latestReview.decision}</b></span>
          {canReview && record.latestReview.decision === 'PENDING' && (
            <div className="flex gap-2"><button type="button" onClick={() => onReview('REJECT')} className="rounded border border-rose-200 bg-white px-3 py-1.5 font-bold text-rose-700">驳回</button><button type="button" onClick={() => onReview('APPROVE')} className="rounded bg-primary px-3 py-1.5 font-bold text-white">审核通过</button></div>
          )}
        </div>
      )}
    </div>
  );
}

function GarmentAdminBootstrapModal({ categories, blocks, onClose, onCompleted }: {
  categories: GarmentCategory[];
  blocks: GarmentBlock[];
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const initialize = async () => {
    setSubmitting(true);
    try {
      const existingCategory = categories.find((item) => item.code === 'WOMEN_SHIRT');
      const categoryId = existingCategory?.id ?? await garmentCategoryApi.add({
        code: 'WOMEN_SHIRT',
        name: '女装衬衫',
        sort: 10,
        slots: [
          { slotCode: 'BODY', name: '主体', partType: 'BODY', required: true, maxCount: 1, sort: 10 },
          { slotCode: 'COLLAR', name: '领口', partType: 'COLLAR', required: true, maxCount: 1, sort: 20 },
          { slotCode: 'SLEEVE', name: '袖型', partType: 'SLEEVE', required: true, maxCount: 2, sort: 30 },
          { slotCode: 'CUFF', name: '袖口', partType: 'CUFF', required: false, maxCount: 2, sort: 40 },
          { slotCode: 'PLACKET', name: '门襟', partType: 'PLACKET', required: false, maxCount: 1, sort: 50 },
          { slotCode: 'BUTTON', name: '纽扣', partType: 'BUTTON', required: false, maxCount: 12, sort: 60 },
          { slotCode: 'POCKET', name: '贴袋', partType: 'POCKET', required: false, maxCount: 2, sort: 70 },
        ],
      });

      const existingBlock = blocks.find((item) => item.code === 'WS_BASIC_FRONT');
      let blockId = existingBlock?.id;
      if (!blockId) {
        const familyId = await garmentBlockApi.addFamily({
          categoryId,
          code: 'WS_STANDARD',
          name: '女衬衫标准版型族',
        });
        blockId = await garmentBlockApi.add({
          familyId,
          categoryId,
          code: 'WS_BASIC_FRONT',
          name: '女衬衫基础正面版型',
          scopeType: 'PRIVATE',
        });
      }
      if (!existingBlock?.currentVersionId) {
        const versionId = await garmentBlockApi.createVersion({
          blockId,
          representationType: 'RASTER_2D',
          viewSet: ['FRONT'],
          sizeSchema: { mode: 'VISUAL_NORMALIZED', width: 1, height: 1, productionReady: false },
          coordinateProfiles: [{
            viewCode: 'FRONT',
            canvasWidth: 1200,
            canvasHeight: 1500,
            anchors: {
              coordinateSystem: 'NORMALIZED_0_1',
              BODY: { x: 0.5, y: 0.52 },
              COLLAR: { x: 0.5, y: 0.2 },
              SLEEVE_LEFT: { x: 0.25, y: 0.42 },
              SLEEVE_RIGHT: { x: 0.75, y: 0.42 },
              CUFF_LEFT: { x: 0.12, y: 0.7 },
              CUFF_RIGHT: { x: 0.88, y: 0.7 },
              PLACKET: { x: 0.5, y: 0.5 },
              POCKET_LEFT: { x: 0.37, y: 0.48 },
              POCKET_RIGHT: { x: 0.63, y: 0.48 },
            },
          }],
        });
        await garmentBlockApi.publishVersion(versionId);
      }
      toast.success('女装衬衫基础目录已初始化');
      onCompleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '基础目录初始化失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-stone-200 bg-[#fbfaf8] p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-widest text-primary">Catalog bootstrap</p><h2 className="mt-1 text-lg font-bold text-stone-900">初始化基础品类与版型</h2></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-stone-400 hover:bg-stone-100"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="mt-5 rounded-xl border border-stone-200 bg-white p-4 text-sm leading-6 text-stone-600">
          将创建“女装衬衫”、7 个组件槽位、标准版型族和一个正面归一化版型。版型固定为当前管理员私有，仅用于首轮配置与验证；未补齐企业权利记录前不会自动开放为公共版型。
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><Metric label="品类" value={categories.some((item) => item.code === 'WOMEN_SHIRT') ? '已存在，将复用' : '待创建'} /><Metric label="基础版型" value={blocks.some((item) => item.code === 'WS_BASIC_FRONT') ? '已存在，将补全版本' : '待创建'} /></div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" disabled={submitting} onClick={onClose} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-bold text-stone-600">取消</button>
          <button type="button" disabled={submitting} onClick={() => void initialize()} className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{submitting ? '初始化中…' : '确认初始化'}</button>
        </div>
      </div>
    </div>
  );
}

export function GarmentWorkspace() {
  const { hasPermission, isAdmin } = useAuth();
  const canManage = isAdmin || hasPermission('garment:part:manage');
  const canReview = isAdmin || hasPermission('garment:part:review');
  const canUpload = isAdmin || hasPermission('garment:part:upload');
  const canManageRights = isAdmin || hasPermission('garment:rights:manage');
  const canReviewRights = isAdmin || hasPermission('garment:rights:review');
  const canEditDesign = isAdmin || hasPermission('garment:design:edit');
  const canRender = isAdmin || hasPermission('garment:render:use');
  const canTryon = isAdmin || hasPermission('garment:tryon:use');
  const canManageProviders = isAdmin || hasPermission('garment:provider-compliance:manage');
  const canReviewProviders = isAdmin || hasPermission('garment:provider-compliance:review');
  const canManageBudgets = isAdmin || hasPermission('garment:budget:manage');
  const canManageConsents = isAdmin || hasPermission('garment:person-consent:manage');
  const canReviewConsents = isAdmin || hasPermission('garment:person-consent:review');
  const canSubmitPublication = isAdmin || hasPermission('garment:publication:submit');
  const canReviewPublication = isAdmin || hasPermission('garment:publication:review');
  const canExportPublication = isAdmin || hasPermission('garment:publication:export');
  const [tab, setTab] = useState<WorkspaceTab>('parts');
  const [parts, setParts] = useState<GarmentPart[]>([]);
  const [categories, setCategories] = useState<GarmentCategory[]>([]);
  const [blocks, setBlocks] = useState<GarmentBlock[]>([]);
  const [rightsRecords, setRightsRecords] = useState<CommercialRightsRecord[]>([]);
  const [previewAssets, setPreviewAssets] = useState<Record<string, AssetResourceItem>>({});
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [bootstrapOpen, setBootstrapOpen] = useState(false);
  const [rightsCreateOpen, setRightsCreateOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<GarmentPart>();
  const [selectedRightsId, setSelectedRightsId] = useState('');
  const [blockRightsSelection, setBlockRightsSelection] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [partPage, categoryList, blockPage] = await Promise.all([
        canManage
          ? garmentPartApi.adminPage({ pageNum: 1, pageSize: 100 })
          : garmentPartApi.myPage({ pageNum: 1, pageSize: 100 }),
        garmentCategoryApi.available(),
        canManage
          ? garmentBlockApi.page({ pageNum: 1, pageSize: 100 })
          : garmentBlockApi.available({ pageNum: 1, pageSize: 100 }),
      ]);
      setParts(partPage.list);
      setCategories(categoryList);
      setBlocks(blockPage.list);
      if (canManageRights || canReviewRights) {
        const rightsPage = await commercialRightsApi.page({ pageNum: 1, pageSize: 100 });
        setRightsRecords(rightsPage.list);
      } else {
        setRightsRecords([]);
      }
      const previewIds = [...new Set(partPage.list.map((item) => item.previewAssetId).filter((id): id is string => Boolean(id)))];
      const assets = await Promise.all(previewIds.map(async (id) => {
        try { return await assetApi.get(id); } catch { return undefined; }
      }));
      setPreviewAssets(Object.fromEntries(assets.filter((item): item is AssetResourceItem => Boolean(item)).map((item) => [item.id, item])));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '服装组件数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [canManage, canManageRights, canReviewRights]);

  useEffect(() => { void load(); }, [load]);

  const filteredParts = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) return parts;
    return parts.filter((part) => `${part.name} ${part.code} ${part.partType} ${part.slotCode}`.toLowerCase().includes(normalized));
  }, [keyword, parts]);

  const aiTransferRights = useMemo(() => rightsRecords.filter((record) =>
    record.status === 'VALID' && record.commercialUse && record.derivativeUse
    && record.aiProcessing && record.thirdPartyTransfer), [rightsRecords]);

  const openDetail = async (part: GarmentPart) => {
    try {
      setSelectedRightsId('');
      setSelectedPart(await garmentPartApi.detail(part.id, canManage));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '组件详情加载失败');
    }
  };

  const submitReview = async (part: GarmentPart) => {
    try {
      await garmentPartApi.submitLibraryReview({ templateId: part.id, targetScopeType: 'PUBLIC', reason: '申请进入公共组件库' });
      toast.success('已提交公共组件库审核');
      await load();
      setSelectedPart(undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '提交审核失败');
    }
  };

  const reviewPart = async (part: GarmentPart, decision: 'APPROVE' | 'REJECT') => {
    if (!part.latestReview || part.latestReview.decision !== 'PENDING') return;
    const reason = decision === 'REJECT' ? window.prompt('请输入驳回原因')?.trim() : undefined;
    if (decision === 'REJECT' && !reason) return;
    try {
      await garmentPartApi.review({ id: part.latestReview.id, decision, reason });
      toast.success(decision === 'APPROVE' ? '组件已审核通过' : '组件已驳回');
      setSelectedPart(undefined);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '组件审核失败');
    }
  };

  const publishPart = async (part: GarmentPart) => {
    try {
      await garmentPartApi.publish(part.id);
      toast.success('组件版本已发布');
      setSelectedPart(undefined);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '组件发布失败');
    }
  };

  const bindRightsToPart = async (part: GarmentPart) => {
    if (!selectedRightsId) return;
    try {
      await garmentPartApi.bindRights({ templateId: part.id, rightsRecordIds: [selectedRightsId] });
      toast.success('已绑定审核生效的商业权利记录');
      setSelectedPart(await garmentPartApi.detail(part.id, canManage));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '组件授权绑定失败');
    }
  };

  const bindRightsToBlock = async (block: GarmentBlock) => {
    const rightsId = blockRightsSelection[block.id];
    if (!rightsId) return;
    try {
      await garmentBlockApi.bindRights(block.id, [rightsId]);
      toast.success('版型已绑定可用于第三方 AI 处理的商业权利记录');
      setBlockRightsSelection((current) => ({ ...current, [block.id]: '' }));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '版型权利绑定失败');
    }
  };

  const reviewRights = async (record: CommercialRightsRecord, decision: 'APPROVE' | 'REJECT') => {
    if (!record.latestReview || record.latestReview.decision !== 'PENDING') return;
    const reason = decision === 'REJECT' ? window.prompt('请输入权利记录驳回原因')?.trim() : undefined;
    if (decision === 'REJECT' && !reason) return;
    try {
      await commercialRightsApi.review({ id: record.latestReview.id, decision, reason });
      toast.success(decision === 'APPROVE' ? '权利记录已生效' : '权利记录已驳回');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '权利记录审核失败');
    }
  };

  return (
    <div className="min-h-full bg-[#f5f3ef]">
      <header className="border-b border-stone-200 bg-[#fbfaf8] px-5 py-4 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary"><span className="h-2 w-2 rounded-full bg-primary" />Garment studio</div>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-stone-900">服装设计工作台</h1>
            <p className="mt-1 text-xs text-stone-500">结构化组件、版型适配与可追溯版本</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-bold text-stone-500">2D FRONT · MVP</span>
            {canManage && <button type="button" onClick={() => setBootstrapOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-bold text-stone-700 shadow-sm hover:border-primary/40"><span className="material-symbols-outlined text-lg">foundation</span>初始化目录</button>}
            {canUpload && <button type="button" onClick={() => setWizardOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary-hover"><span className="material-symbols-outlined text-lg">add</span>上传组件</button>}
          </div>
        </div>
        <div className="mt-5 flex gap-1 rounded-lg bg-stone-100 p-1">
          {([
            ['designs', '我的设计', 'apparel'],
            ['parts', '组件库', 'deployed_code'],
            ['blocks', '版型库', 'checkroom'],
            ['categories', '品类与槽位', 'account_tree'],
            ['rights', '商业权利', 'verified_user'],
            ['providers', 'AI 供应商合规', 'policy'],
            ['budgets', 'AI 成本预算', 'account_balance_wallet'],
            ['consents', '人物同意与模特权利', 'person_shield'],
            ['publications', '发布审核与导出', 'publish'],
          ] as const).map(([value, label, icon]) => (
            (value !== 'rights' || canManageRights || canReviewRights) && (value !== 'designs' || canEditDesign) && (value !== 'providers' || canManageProviders || canReviewProviders) && (value !== 'budgets' || canManageBudgets) && (value !== 'consents' || canManageConsents || canReviewConsents) && (value !== 'publications' || canSubmitPublication || canReviewPublication) && <button key={value} type="button" onClick={() => setTab(value)} className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-bold transition ${tab === value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>
              <span className="material-symbols-outlined text-base">{icon}</span>{label}
            </button>
          ))}
        </div>
      </header>

      <main className="p-5 lg:p-8">
        {tab === 'designs' && canEditDesign && <GarmentDesignStudio categories={categories} blocks={blocks} canRender={canRender} canTryon={canTryon} canPublish={canSubmitPublication} canExportPublication={canExportPublication} />}

        {tab === 'publications' && (canSubmitPublication || canReviewPublication) && <PublicationReviewPanel canSubmit={canSubmitPublication} canReview={canReviewPublication} canExport={canExportPublication} />}

        {tab === 'parts' && (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="relative w-full max-w-sm">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-stone-400">search</span>
                <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索名称、编码、组件类型…" className="w-full rounded-lg border border-stone-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary" />
              </div>
              <div className="text-xs text-stone-500">共 {filteredParts.length} 个组件 · 精确版本引用</div>
            </div>
            {loading ? (
              <div className="flex min-h-72 items-center justify-center text-sm text-stone-400">正在加载组件…</div>
            ) : filteredParts.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white text-stone-400">
                <span className="material-symbols-outlined text-5xl">deployed_code</span>
                <div className="mt-3 text-sm font-bold text-stone-600">还没有组件</div>
                <div className="mt-1 text-xs">从一张设计师抠图开始，完成标准化和版型绑定</div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
                {filteredParts.map((part) => {
                  const preview = part.previewAssetId ? previewAssets[part.previewAssetId] : undefined;
                  return (
                    <button key={part.id} type="button" onClick={() => void openDetail(part)} className="group overflow-hidden rounded-xl border border-stone-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                      <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
                        <AssetImage urls={[preview?.originalUrl, preview?.thumbnailUrl]} alt={part.name} className="h-full" aspectRatio="auto" objectFit="contain" />
                        <span className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold ${statusTone[part.processStatus]}`}>{statusLabel[part.processStatus]}</span>
                      </div>
                      <div className="p-3.5">
                        <div className="flex items-start justify-between gap-2"><h3 className="truncate text-sm font-bold text-stone-900">{part.name}</h3><span className="font-mono text-[9px] text-stone-400">v{part.version}</span></div>
                        <p className="mt-1 truncate font-mono text-[10px] text-stone-400">{part.code}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <span className="rounded bg-stone-100 px-2 py-1 text-[10px] font-bold text-stone-600">{part.partType}</span>
                          <span className="rounded bg-stone-100 px-2 py-1 text-[10px] font-bold text-stone-600">{part.slotCode}</span>
                          <span className="rounded bg-stone-100 px-2 py-1 text-[10px] font-bold text-stone-600">{part.scopeType}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === 'blocks' && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {blocks.map((block) => (
              <div key={block.id} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between"><div><h3 className="font-bold text-stone-900">{block.name}</h3><p className="mt-1 font-mono text-[10px] text-stone-400">{block.code}</p></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">{block.status}</span></div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-xs"><Metric label="范围" value={block.scopeType} /><Metric label="权利" value={block.rightsStatus} /><Metric label="当前版本" value={block.currentVersionId ? '已发布' : '未发布'} /><Metric label="表示" value="2D FRONT" /></div>
                {canManageRights && block.rightsStatus !== 'VALID' && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-[10px] leading-4 text-amber-800">AI 生成要求版型授权同时覆盖商业使用、演绎、AI 处理与第三方传输。</p><div className="mt-2 flex gap-2"><select value={blockRightsSelection[block.id] ?? ''} onChange={(event) => setBlockRightsSelection((current) => ({ ...current, [block.id]: event.target.value }))} className="form-input bg-white text-xs"><option value="">选择有效权利记录</option>{aiTransferRights.map((record) => <option key={record.id} value={record.id}>{record.rightsCode}</option>)}</select><button type="button" disabled={!blockRightsSelection[block.id]} onClick={() => void bindRightsToBlock(block)} className="shrink-0 rounded bg-amber-700 px-3 text-xs font-bold text-white disabled:opacity-40">绑定</button></div></div>}
              </div>
            ))}
          </div>
        )}

        {tab === 'categories' && (
          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category.id} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between"><div><h3 className="font-bold text-stone-900">{category.name}</h3><p className="mt-1 font-mono text-[10px] text-stone-400">{category.code}</p></div><span className="text-xs font-bold text-stone-500">{category.slots?.length ?? 0} 个槽位</span></div>
                <div className="mt-4 flex flex-wrap gap-2">{category.slots?.map((slot) => <span key={slot.id} className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600"><b>{slot.name}</b><span className="ml-2 font-mono text-[10px] text-stone-400">{slot.slotCode}</span></span>)}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'rights' && (canManageRights || canReviewRights) && (
          <div>
            <div className="mb-5 flex items-center justify-between"><div><h2 className="text-base font-bold text-stone-900">商业权利记录</h2><p className="mt-1 text-xs text-stone-500">组件公开审核只接受有效、未到期且覆盖商用与演绎的记录</p></div>{canManageRights && <button type="button" onClick={() => setRightsCreateOpen(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white">新增权利记录</button>}</div>
            <div className="space-y-3">{rightsRecords.map((record) => <div key={record.id}><CommercialRightsCard record={record} canReview={canReviewRights} onReview={(decision) => void reviewRights(record, decision)} onView={() => void openProtectedEvidence(() => commercialRightsApi.evidence(record.id)).catch((error) => toast.error(error instanceof Error ? error.message : '授权原件读取失败'))} /></div>)}</div>
            {rightsRecords.length === 0 && <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white text-stone-400"><span className="material-symbols-outlined text-5xl">verified_user</span><div className="mt-3 text-sm font-bold text-stone-600">还没有商业权利记录</div><div className="mt-1 text-xs">上传授权证明并登记使用范围后，才能申请公共组件审核</div></div>}
          </div>
        )}

        {tab === 'providers' && (canManageProviders || canReviewProviders) && <ProviderCompliancePanel canManage={canManageProviders} canReview={canReviewProviders} />}
        {tab === 'budgets' && canManageBudgets && <GarmentBudgetPanel />}
        {tab === 'consents' && (canManageConsents || canReviewConsents) && <PersonConsentPanel canManage={canManageConsents} canReview={canReviewConsents} canManageRights={canManageRights} />}
      </main>

      {wizardOpen && <PartImportWizard categories={categories} blocks={blocks} onClose={() => setWizardOpen(false)} onCompleted={() => { setWizardOpen(false); void load(); }} />}
      {bootstrapOpen && <GarmentAdminBootstrapModal categories={categories} blocks={blocks} onClose={() => setBootstrapOpen(false)} onCompleted={() => { setBootstrapOpen(false); void load(); }} />}
      {rightsCreateOpen && <CommercialRightsCreateModal onClose={() => setRightsCreateOpen(false)} onCompleted={() => { setRightsCreateOpen(false); void load(); }} />}

      {selectedPart && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={() => setSelectedPart(undefined)}>
          <aside className="h-full w-full max-w-xl overflow-y-auto bg-[#fbfaf8] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-widest text-primary">Component detail</p><h2 className="mt-1 text-xl font-bold text-stone-900">{selectedPart.name}</h2><p className="mt-1 font-mono text-xs text-stone-400">{selectedPart.code}</p></div><button type="button" onClick={() => setSelectedPart(undefined)} className="rounded-lg p-2 text-stone-400 hover:bg-stone-100"><span className="material-symbols-outlined">close</span></button></div>
            <div className="mt-6 grid grid-cols-2 gap-3"><Metric label="组件类型" value={selectedPart.partType} /><Metric label="目标槽位" value={selectedPart.slotCode} /><Metric label="复用级别" value={selectedPart.reuseLevel} /><Metric label="权利状态" value={selectedPart.rightsStatus} /></div>
            <section className="mt-6"><h3 className="text-sm font-bold text-stone-800">不可变版本</h3><div className="mt-3 space-y-2">{selectedPart.versions?.map((version) => <div key={version.id} className="rounded-lg border border-stone-200 bg-white p-3"><div className="flex justify-between text-xs"><b>v{version.versionNo} · {version.viewCode}</b><span>{version.status}</span></div><div className="mt-2 truncate font-mono text-[9px] text-stone-400">SHA-256 {version.contentHash}</div></div>)}</div></section>
            <section className="mt-6"><h3 className="text-sm font-bold text-stone-800">版型绑定</h3><div className="mt-3 space-y-2">{selectedPart.bindings?.map((binding) => <div key={binding.id} className="rounded-lg border border-stone-200 bg-white p-3 text-xs"><div className="flex justify-between"><b>{binding.bindingScope}</b><span className={binding.status === 'VERIFIED' ? 'text-emerald-600' : 'text-amber-600'}>{binding.status}</span></div><div className="mt-2 font-mono text-[9px] text-stone-400">BLOCK VERSION {binding.blockVersionId ?? '-'}</div></div>)}</div></section>
            {selectedPart.latestReview && <section className="mt-6"><h3 className="text-sm font-bold text-stone-800">最新入库审核</h3><div className="mt-3 rounded-lg border border-stone-200 bg-white p-4 text-xs"><div className="flex justify-between"><b>{selectedPart.latestReview.requestedScopeType}</b><span>{selectedPart.latestReview.decision}</span></div><p className="mt-2 text-stone-500">{selectedPart.latestReview.reason || '未填写说明'}</p><p className="mt-2 font-mono text-[9px] text-stone-400">REVIEW {selectedPart.latestReview.id}</p></div></section>}
            {canManageRights && aiTransferRights.length > 0 && <section className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4"><h3 className="text-sm font-bold text-blue-900">追加 AI 处理与第三方传输授权</h3><p className="mt-1 text-xs leading-5 text-blue-800">已能公开复用不等于可以发送给外部模型；成衣生成会再次按 AI 与第三方传输范围检查。</p><div className="mt-3 flex gap-2"><select value={selectedRightsId} onChange={(event) => setSelectedRightsId(event.target.value)} className="form-input bg-white"><option value="">请选择权利记录</option>{aiTransferRights.map((record) => <option key={record.id} value={record.id}>{record.rightsCode} · {record.licensorName}</option>)}</select><button type="button" disabled={!selectedRightsId} onClick={() => void bindRightsToPart(selectedPart)} className="shrink-0 rounded-lg bg-blue-700 px-4 text-xs font-bold text-white disabled:opacity-40">绑定</button></div></section>}
            {canReview && selectedPart.latestReview?.decision === 'PENDING' && selectedPart.rightsStatus !== 'VALID' && rightsRecords.some((record) => record.status === 'VALID' && record.commercialUse && record.derivativeUse) && (
              <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="text-sm font-bold text-amber-900">绑定公共复用授权</h3>
                <p className="mt-1 text-xs leading-5 text-amber-800">仅列出已经由另一位审核人确认，且覆盖商业使用和修改演绎的权利记录。</p>
                <div className="mt-3 flex gap-2"><select value={selectedRightsId} onChange={(event) => setSelectedRightsId(event.target.value)} className="form-input bg-white"><option value="">请选择权利记录</option>{rightsRecords.filter((record) => record.status === 'VALID' && record.commercialUse && record.derivativeUse).map((record) => <option key={record.id} value={record.id}>{record.rightsCode} · {record.licensorName}</option>)}</select><button type="button" disabled={!selectedRightsId} onClick={() => void bindRightsToPart(selectedPart)} className="shrink-0 rounded-lg bg-amber-700 px-4 text-xs font-bold text-white disabled:opacity-40">绑定</button></div>
              </section>
            )}
            {!canManage && selectedPart.processStatus === 'READY_FOR_REVIEW' && (
              <button type="button" onClick={() => void submitReview(selectedPart)} className="mt-8 w-full rounded-lg bg-primary px-4 py-3 text-sm font-bold text-white">申请进入公共组件库</button>
            )}
            {canReview && selectedPart.latestReview?.decision === 'PENDING' && <div className="mt-8 grid grid-cols-2 gap-3"><button type="button" onClick={() => void reviewPart(selectedPart, 'REJECT')} className="rounded-lg border border-rose-200 bg-white px-4 py-3 text-sm font-bold text-rose-700">驳回</button><button type="button" onClick={() => void reviewPart(selectedPart, 'APPROVE')} className="rounded-lg bg-primary px-4 py-3 text-sm font-bold text-white">审核通过</button></div>}
            {canReview && selectedPart.processStatus === 'APPROVED' && <button type="button" onClick={() => void publishPart(selectedPart)} className="mt-8 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white">发布当前组件版本</button>}
          </aside>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-stone-200 bg-stone-50 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}</div><div className="mt-1 text-xs font-bold text-stone-700">{value}</div></div>;
}
