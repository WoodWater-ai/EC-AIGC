import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { AssetResourceItem } from '../../../api/modules/asset';
import {
  productInfoApi,
  type ProductAddReq,
  type ProductAiAnalyzeResponse,
  type ProductDTO,
} from '../../../api/modules/productInfo';
import { DialogFrame } from './DialogFrame';

interface ProductDraft {
  name: string;
  sellingPoints: string;
  category: string;
  color: string;
  patternMaterial: string;
  silhouetteStructure: string;
}

interface Props {
  asset: AssetResourceItem | null;
  onCancel: () => void;
  onCreated: (product: ProductDTO) => void;
}

const EMPTY_DRAFT: ProductDraft = {
  name: '',
  sellingPoints: '',
  category: '',
  color: '',
  patternMaterial: '',
  silhouetteStructure: '',
};

const toDraft = (result: ProductAiAnalyzeResponse): ProductDraft => ({
  name: result.name?.trim() ?? '',
  sellingPoints: result.sellingPoints?.trim() ?? '',
  category: result.category?.trim() ?? '',
  color: result.color?.trim() ?? '',
  patternMaterial: result.patternMaterial?.trim() ?? '',
  silhouetteStructure: result.silhouetteStructure?.trim() ?? '',
});

export const CreateProductFromAssetDialog: React.FC<Props> = ({
  asset,
  onCancel,
  onCreated,
}) => {
  const [step, setStep] = useState<'notice' | 'form'>('notice');
  const [draft, setDraft] = useState<ProductDraft>(EMPTY_DRAFT);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!asset) return;
    setStep('notice');
    setDraft(EMPTY_DRAFT);
    setAnalyzing(false);
    setSaving(false);
  }, [asset]);

  const updateDraft = (field: keyof ProductDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleAnalyze = async () => {
    if (!asset) return;
    setAnalyzing(true);
    try {
      const result = await productInfoApi.aiAnalyze({ imageId: asset.id });
      setDraft(toDraft(result));
      setStep('form');
    } catch {
      // 业务错误由请求拦截器统一提示，保留当前素材和提示页供用户重试或取消。
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreate = async () => {
    if (!asset || !draft.name.trim()) {
      toast.error('商品名称不能为空');
      return;
    }
    setSaving(true);
    try {
      const request: ProductAddReq = {
        name: draft.name.trim(),
        sellingPoints: draft.sellingPoints.trim() || undefined,
        category: draft.category.trim() || undefined,
        color: draft.color.trim() || undefined,
        patternMaterial: draft.patternMaterial.trim() || undefined,
        silhouetteStructure: draft.silhouetteStructure.trim() || undefined,
        imageId: asset.id,
        categoryIds: [],
        status: 'ON_SHELF',
      };
      const productId = await productInfoApi.add(request);
      const product = await productInfoApi.detail({ id: String(productId) });
      toast.success(`商品“${product.name}”已创建并关联素材`);
      onCreated(product);
    } catch {
      // 业务错误由请求拦截器统一提示，失败时保留表单内容。
    } finally {
      setSaving(false);
    }
  };

  const cancelButton = (
    <div className="group relative">
      <button
        type="button"
        onClick={onCancel}
        disabled={analyzing || saving}
        title="取消后将取消主体素材选择"
        className="rounded border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        取消
      </button>
      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 mb-2 w-max max-w-52 rounded bg-slate-800 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
      >
        取消后将取消主体素材选择
      </div>
    </div>
  );

  return (
    <DialogFrame
      open={asset !== null}
      title={step === 'notice' ? '该素材尚未创建商品' : '确认商品信息'}
      onClose={analyzing || saving ? () => undefined : onCancel}
      maxWidthClassName={step === 'form' ? 'max-w-2xl' : 'max-w-md'}
      footer={step === 'notice' ? (
        <>
          {cancelButton}
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing}
            className="rounded bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {analyzing ? 'AI 分析中…' : '确认并进行 AI 分析'}
          </button>
        </>
      ) : (
        <>
          {cancelButton}
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="rounded bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? '创建中…' : '确认创建商品'}
          </button>
        </>
      )}
    >
      {step === 'notice' ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
            <span className="material-symbols-outlined text-xl">info</span>
            <div>
              <p className="font-bold">当前资源没有创建商品，必须创建商品后才能使用。</p>
              <p className="mt-1 text-[11px] text-amber-700">
                确认后将自动分析素材并展示商品信息，您确认信息后系统会创建商品并完成关联。
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-2">
            <img
              src={asset?.thumbnailUrl ?? asset?.originalUrl}
              alt={asset?.name ?? ''}
              className="h-14 w-14 rounded object-contain bg-slate-100"
            />
            <span className="min-w-0 truncate font-bold text-slate-700">{asset?.name}</span>
          </div>
        </div>
      ) : (
        <div className="grid max-h-[62vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          <Field label="商品名称" required value={draft.name} onChange={(value) => updateDraft('name', value)} />
          <Field label="品类" value={draft.category} onChange={(value) => updateDraft('category', value)} />
          <Field label="颜色" value={draft.color} onChange={(value) => updateDraft('color', value)} />
          <Field label="图案/材质" value={draft.patternMaterial} onChange={(value) => updateDraft('patternMaterial', value)} />
          <Field label="版型/结构" value={draft.silhouetteStructure} onChange={(value) => updateDraft('silhouetteStructure', value)} />
          <label className="sm:col-span-2">
            <span className="mb-1 block font-bold text-slate-600">商品卖点</span>
            <textarea
              value={draft.sellingPoints}
              onChange={(event) => updateDraft('sellingPoints', event.target.value)}
              rows={3}
              className="w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-primary"
            />
          </label>
        </div>
      )}
    </DialogFrame>
  );
};

const Field: React.FC<{
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}> = ({ label, value, required, onChange }) => (
  <label>
    <span className="mb-1 block font-bold text-slate-600">
      {label}{required && <span className="ml-0.5 text-rose-500">*</span>}
    </span>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-primary"
    />
  </label>
);
