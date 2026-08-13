import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, Image as ImageIcon, Plus, RotateCcw, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import type { AssetResourceItem } from '../../api/modules/asset';
import {
  productInfoApi,
  type ProductAddReq,
  type ProductDTO,
  type ProductStatus,
  type ProductUpdateReq,
} from '../../api/modules/productInfo';
import { productCategoryApi, type ProductCategoryNode } from '../../api/modules/productCategory';
import { withCosThumbnail } from '../../utils/cosImage';
import { AssetTransitModal } from '../AssetTransitModal';
import { useConfirm } from '../common/ConfirmProvider';

interface ProductSpuFormDrawerProps {
  open: boolean;
  initial?: ProductDTO | null;
  onClose: () => void;
  onSaved: () => void;
}

interface ImageRef {
  id: string;
  thumbnailUrl?: string;
  originalUrl?: string;
  name?: string;
}

interface CategoryOption {
  id: string;
  name: string;
  label: string;
}

const inputClassName = 'h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10';

const flattenCategories = (tree: ProductCategoryNode[]) => {
  const options: CategoryOption[] = [];
  const walk = (nodes: ProductCategoryNode[], depth: number) => {
    nodes.forEach((node) => {
      options.push({
        id: String(node.id),
        name: node.categoryName,
        label: `${'　'.repeat(depth)}${node.categoryName}`,
      });
      if (node.children?.length) walk(node.children, depth + 1);
    });
  };
  walk(tree, 0);
  return options;
};

export function ProductSpuFormDrawer({
  open,
  initial,
  onClose,
  onSaved,
}: ProductSpuFormDrawerProps) {
  const confirm = useConfirm();
  const [name, setName] = useState('');
  const [sellingPoints, setSellingPoints] = useState('');
  const [category, setCategory] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [categoryTree, setCategoryTree] = useState<ProductCategoryNode[]>([]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [status, setStatus] = useState<ProductStatus>('ON_SHELF');
  const [imageRef, setImageRef] = useState<ImageRef | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [color, setColor] = useState('');
  const [patternMaterial, setPatternMaterial] = useState('');
  const [silhouetteStructure, setSilhouetteStructure] = useState('');
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiSnapshot, setAiSnapshot] = useState<{
    sellingPoints: string;
    category: string;
    color: string;
    patternMaterial: string;
    silhouetteStructure: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const isErpEdit = initial?.sourceType === 'ERP';

  const categoryOptions = useMemo(() => flattenCategories(categoryTree), [categoryTree]);
  const selectedCategories = categoryOptions.filter((option) => selectedCategoryIds.includes(option.id));

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setSellingPoints(initial?.sellingPoints ?? '');
    setCategory(initial?.category ?? '');
    setSelectedCategoryIds((initial?.categories ?? []).map((item) => String(item.id)));
    setStatus(initial?.status ?? 'ON_SHELF');
    setColor(initial?.color ?? '');
    setPatternMaterial(initial?.patternMaterial ?? '');
    setSilhouetteStructure(initial?.silhouetteStructure ?? '');
    setImageRef(initial?.imageId && initial.imageUrl
      ? {
          id: String(initial.imageId),
          thumbnailUrl: withCosThumbnail(initial.imageUrl, 360) ?? initial.imageUrl,
          originalUrl: initial.imageUrl,
          name: initial.name,
        }
      : null);
    setPickerOpen(false);
    setCategoryOpen(false);
    setAiSnapshot(null);
  }, [initial, open]);

  useEffect(() => {
    if (!open || categoryTree.length > 0) return;
    void productCategoryApi.tree().then(setCategoryTree);
  }, [categoryTree.length, open]);

  const initialCategoryIds = (initial?.categories ?? []).map((item) => String(item.id)).sort().join(',');
  const currentCategoryIds = [...selectedCategoryIds].sort().join(',');
  const dirty = open && (
    name !== (initial?.name ?? '')
    || sellingPoints !== (initial?.sellingPoints ?? '')
    || category !== (initial?.category ?? '')
    || (!isErpEdit && currentCategoryIds !== initialCategoryIds)
    || status !== (initial?.status ?? 'ON_SHELF')
    || color !== (initial?.color ?? '')
    || patternMaterial !== (initial?.patternMaterial ?? '')
    || silhouetteStructure !== (initial?.silhouetteStructure ?? '')
    || (imageRef?.id ?? null) !== (initial?.imageId ? String(initial.imageId) : null)
  );

  if (!open) return null;

  async function handleClose() {
    if (dirty) {
      const approved = await confirm({
        title: '放弃修改',
        message: '当前产品有未保存的修改，确认关闭？',
        confirmText: '放弃修改',
        danger: true,
      });
      if (!approved) return;
    }
    onClose();
  }

  function handlePickerConfirm(items: AssetResourceItem[]) {
    const item = items[0];
    if (!item) return;
    setImageRef({
      id: String(item.id),
      thumbnailUrl: withCosThumbnail(item.originalUrl ?? item.thumbnailUrl, 360)
        ?? item.thumbnailUrl
        ?? item.originalUrl,
      originalUrl: item.originalUrl,
      name: item.name,
    });
    setPickerOpen(false);
  }

  function toggleCategory(id: string) {
    setSelectedCategoryIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  async function handleAiAnalyze() {
    if (!imageRef?.id) {
      toast.error('请先选择 SKU 图片');
      return;
    }
    setAiSnapshot({ sellingPoints, category, color, patternMaterial, silhouetteStructure });
    setAiAnalyzing(true);
    try {
      const result = await productInfoApi.aiAnalyze({ imageId: imageRef.id });
      if (result.sellingPoints !== undefined) setSellingPoints(result.sellingPoints ?? '');
      if (result.category !== undefined) setCategory(result.category ?? '');
      if (result.color !== undefined) setColor(result.color ?? '');
      if (result.patternMaterial !== undefined) setPatternMaterial(result.patternMaterial ?? '');
      if (result.silhouetteStructure !== undefined) setSilhouetteStructure(result.silhouetteStructure ?? '');
      toast.success('SKU 创作参数已更新');
    } catch {
      setAiSnapshot(null);
    } finally {
      setAiAnalyzing(false);
    }
  }

  function restoreAiSnapshot() {
    if (!aiSnapshot) return;
    setSellingPoints(aiSnapshot.sellingPoints);
    setCategory(aiSnapshot.category);
    setColor(aiSnapshot.color);
    setPatternMaterial(aiSnapshot.patternMaterial);
    setSilhouetteStructure(aiSnapshot.silhouetteStructure);
    setAiSnapshot(null);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error('商品名称不能为空');
      return;
    }
    if (!imageRef?.id) {
      toast.error('至少需要 1 个带图片的 SKU');
      return;
    }
    setSaving(true);
    try {
      const common = {
        name: name.trim(),
        sellingPoints: sellingPoints || undefined,
        color: color || undefined,
        patternMaterial: patternMaterial || undefined,
        silhouetteStructure: silhouetteStructure || undefined,
        category: category || undefined,
        imageId: String(imageRef.id),
        categoryIds: isErpEdit ? undefined : selectedCategoryIds,
        status,
      };
      if (initial?.id) {
        const request: ProductUpdateReq = { id: initial.id, ...common };
        await productInfoApi.update(request);
        toast.success('产品更新成功');
      } else {
        const request: ProductAddReq = common;
        await productInfoApi.add(request);
        toast.success('产品创建成功');
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        onClick={() => void handleClose()}
        className="absolute inset-0 cursor-default bg-slate-950/25 backdrop-blur-[1px]"
        aria-label="关闭产品表单"
      />
      <aside className="relative flex h-full w-full max-w-[720px] flex-col border-l border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900">{initial?.id ? '编辑产品' : '新建产品'}</h2>
              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${isErpEdit ? 'border-blue-100 bg-blue-50 text-blue-700' : 'border-violet-100 bg-violet-50 text-violet-700'}`}>
                {isErpEdit ? 'ERP 商品补录' : '手动创建'}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              {isErpEdit
                ? `SKU-${initial?.id} · 商品名称和结构化分类由 ERP 维护，其余信息可补录`
                : `${initial?.id ? `SPU-${initial.id}` : '保存后生成 SPU'} · 当前接口保存 1 个默认 SKU`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleClose()}
            className="grid h-9 w-9 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="关闭"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-5 py-4">
          <section>
            <SectionTitle index="1" title="SPU 共享信息" caption="商品公共事实" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="商品名称" required className="sm:col-span-2">
                <input value={name} onChange={(event) => setName(event.target.value)} readOnly={isErpEdit} maxLength={128} className={`${inputClassName} ${isErpEdit ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`} placeholder="例如：法式方领连衣裙" />
                {isErpEdit && <span className="mt-1 block text-[9px] text-slate-400">ERP 商品名称由同步数据维护，不允许手动修改</span>}
              </Field>
              <Field label="商品分类" className="sm:col-span-2">
                <div className="relative">
                  {selectedCategories.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {selectedCategories.map((item) => (
                        <span key={item.id} className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-[10px] font-bold text-primary">
                          {item.name}
                          {!isErpEdit && <button type="button" onClick={() => toggleCategory(item.id)} className="text-primary/60 hover:text-rose-600" aria-label={`移除${item.name}`}><X className="h-3 w-3" /></button>}
                        </span>
                      ))}
                    </div>
                  )}
                  <button type="button" disabled={isErpEdit} onClick={() => setCategoryOpen((value) => !value)} className="flex h-9 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 text-left text-xs text-slate-600 hover:border-primary disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
                    {isErpEdit ? 'ERP 分类由同步数据维护' : categoryOptions.length === 0 ? '加载分类中...' : '选择商品分类'}
                    <ChevronDown className={`h-4 w-4 transition-transform ${categoryOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {categoryOpen && !isErpEdit && (
                    <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-xl">
                      {categoryOptions.map((option) => (
                        <label key={option.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50">
                          <input type="checkbox" checked={selectedCategoryIds.includes(option.id)} onChange={() => toggleCategory(option.id)} />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </Field>
              <Field label="品类标签">
                <input value={category} onChange={(event) => setCategory(event.target.value)} maxLength={255} className={inputClassName} placeholder="例如：连衣裙" />
              </Field>
              <Field label="上下架状态">
                <select value={status} onChange={(event) => setStatus(event.target.value as ProductStatus)} className={inputClassName}>
                  <option value="ON_SHELF">上架</option>
                  <option value="OFF_SHELF">下架</option>
                </select>
              </Field>
              <Field label="核心卖点" className="sm:col-span-2">
                <textarea value={sellingPoints} onChange={(event) => setSellingPoints(event.target.value)} maxLength={500} rows={3} className={`${inputClassName} h-auto resize-none py-2`} placeholder="用于商品事实和创作提示词" />
              </Field>
            </div>
          </section>

          <section className="mt-6 border-t border-slate-200 pt-5">
            <div className="mb-4 flex items-center gap-3">
              <SectionTitle index="2" title="SKU 与创作素材" caption="至少保留 1 个 SKU" />
              <button
                type="button"
                disabled
                title="多 SKU 保存将在接口接入后开放"
                className="ml-auto grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-300 disabled:cursor-not-allowed"
                aria-label="添加 SKU（等待接口接入）"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-hidden rounded-md border border-blue-100 bg-blue-50/25">
              <div className="flex items-center border-b border-blue-100 bg-blue-50/70 px-3 py-2.5">
                <strong className="text-xs text-slate-800">SKU 1 · {initial?.specName || color || '默认规格'}</strong>
                <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-[9px] font-bold text-primary">SPU 封面</span>
                <span className="ml-auto font-mono text-[9px] text-slate-400">
                  {initial?.id ? initial.skuCode || '暂无规格编码' : '保存后生成'}
                </span>
              </div>
              <div className="grid gap-5 p-4 sm:grid-cols-[190px_minmax(0,1fr)]">
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold text-slate-600">SKU 图片 <span className="text-rose-500">*</span></label>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="group relative grid aspect-[4/5] w-full place-items-center overflow-hidden rounded-md border border-dashed border-slate-300 bg-white hover:border-primary"
                  >
                    {imageRef ? (
                      <img
                        src={withCosThumbnail(imageRef.originalUrl ?? imageRef.thumbnailUrl, 360)
                          ?? imageRef.thumbnailUrl
                          ?? imageRef.originalUrl}
                        alt={imageRef.name ?? 'SKU 图片'}
                        className="h-full w-full object-contain p-3"
                      />
                    ) : (
                      <span className="text-center text-slate-400">
                        <ImageIcon className="mx-auto h-6 w-6" />
                        <span className="mt-2 block text-[10px] font-bold">选择 SKU 图片</span>
                      </span>
                    )}
                  </button>
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={!imageRef?.id || aiAnalyzing} onClick={() => void handleAiAnalyze()} className="flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-slate-300 bg-white text-[10px] font-bold text-primary hover:bg-blue-50 disabled:opacity-40">
                      <Sparkles className={`h-3.5 w-3.5 ${aiAnalyzing ? 'animate-spin' : ''}`} />
                      {aiAnalyzing ? '理解中' : '图片理解'}
                    </button>
                    {aiSnapshot && (
                      <button type="button" onClick={restoreAiSnapshot} className="grid h-8 w-8 place-items-center rounded-md border border-slate-300 text-slate-500 hover:bg-slate-50" title="恢复理解前参数" aria-label="恢复理解前参数"><RotateCcw className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                </div>

                <div className="grid content-start gap-4 sm:grid-cols-2">
                  <Field label="颜色 / 款式">
                    <input value={color} onChange={(event) => setColor(event.target.value)} maxLength={500} className={inputClassName} placeholder="例如：酒红" />
                  </Field>
                  <Field label="规格">
                    <input value={initial?.specName || color || '默认规格'} readOnly className={`${inputClassName} bg-slate-50 text-slate-500`} title="ERP 规格名称为只读字段" />
                  </Field>
                  <Field label="图案 / 材质" className="sm:col-span-2">
                    <input value={patternMaterial} onChange={(event) => setPatternMaterial(event.target.value)} maxLength={500} className={inputClassName} placeholder="例如：纯色 · 醋酸混纺" />
                  </Field>
                  <Field label="版型 / 结构" className="sm:col-span-2">
                    <input value={silhouetteStructure} onChange={(event) => setSilhouetteStructure(event.target.value)} maxLength={500} className={inputClassName} placeholder="例如：收腰 A 字裙" />
                  </Field>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="flex items-center gap-3 border-t border-slate-200 px-5 py-3">
          <p className="min-w-0 flex-1 text-[10px] text-slate-400">
            {isErpEdit ? '保存到当前 ERP SKU · 不修改 ERP 商品名称与结构化分类' : '1 个 SKU · 首个 SKU 图片自动作为 SPU 封面'}
          </p>
          <button type="button" onClick={() => void handleClose()} disabled={saving} className="h-9 rounded-md border border-slate-300 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">取消</button>
          <button type="button" onClick={() => void handleSave()} disabled={saving} className="h-9 rounded-md bg-slate-900 px-4 text-xs font-bold text-white hover:bg-primary disabled:opacity-40">{saving ? '保存中...' : '保存产品'}</button>
        </footer>
      </aside>

      {pickerOpen && (
        <AssetTransitModal
          multiSelect={false}
          mode="picker"
          assetKind="IMAGE"
          allowedSources={['UPLOAD']}
          onClose={() => setPickerOpen(false)}
          onConfirmSelection={handlePickerConfirm}
        />
      )}
    </div>
  );
}

function SectionTitle({ index, title, caption }: { index: string; title: string; caption: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-slate-900 text-[10px] font-black text-white">{index}</span>
      <h3 className="text-xs font-black text-slate-800">{title}</h3>
      <span className="truncate text-[10px] text-slate-400">{caption}</span>
    </div>
  );
}

function Field({
  label,
  required = false,
  className = '',
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-[10px] font-bold text-slate-600">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}
