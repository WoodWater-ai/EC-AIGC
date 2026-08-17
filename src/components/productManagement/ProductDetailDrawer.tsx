import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, Image as ImageIcon, Pencil, X } from 'lucide-react';
import { withCosThumbnail } from '../../utils/cosImage';
import { ImagePreviewModal, type PreviewImage } from '../ImagePreviewModal';
import {
  formatProductTime,
  formatProductParameters,
  productSourceLabel,
  type ProductSkuView,
  type ProductSpuView,
} from './productManagementModel';

interface ProductDetailDrawerProps {
  product: ProductSpuView | null;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (product: ProductSpuView, sku: ProductSkuView) => void;
  onCreate: (sku: ProductSkuView) => void;
}

const sourceClassName = (source: ProductSpuView['source']) =>
  source === 'ERP'
    ? 'border-blue-100 bg-blue-50 text-blue-700'
    : 'border-violet-100 bg-violet-50 text-violet-700';

const statusClassName = (enabled: boolean) =>
  enabled
    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
    : 'border-slate-200 bg-slate-100 text-slate-600';

export function ProductDetailDrawer({
  product,
  canEdit,
  onClose,
  onEdit,
  onCreate,
}: ProductDetailDrawerProps) {
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null);
  /** 商品图大图预览(详情抽屉内任意位置点击图片触发) */
  const [previewState, setPreviewState] = useState<{
    images: PreviewImage[];
    initialIndex: number;
  } | null>(null);
  function openProductPreview(url: string, alt: string) {
    setPreviewState({ images: [{ url, label: alt }], initialIndex: 0 });
  }

  useEffect(() => {
    setSelectedSkuId(product?.skus.length === 1 ? product.skus[0].id : null);
  }, [product]);

  const selectedSku = useMemo(
    () => product?.skus.find((sku) => sku.id === selectedSkuId) ?? null,
    [product, selectedSkuId],
  );

  if (!product) return null;

  const displayImage = selectedSku?.imageUrl ?? product.imageUrl;
  const categoryLabel = product.categories.map((item) => item.categoryName).join(' / ')
    || product.category
    || '未分类';
  const createDisabledReason = selectedSku
    ? selectedSku.unavailableReason
    : '请先选择一个 SKU';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-slate-950/25 backdrop-blur-[1px]"
        aria-label="关闭产品详情"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-[720px] flex-col border-l border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          {product.imageUrl ? (
            <button
              type="button"
              onClick={() => openProductPreview(product.imageUrl!, product.name)}
              title="点击查看大图"
              className="group relative grid h-13 w-13 shrink-0 place-items-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 hover:border-primary/60"
            >
              <img
                src={withCosThumbnail(product.imageUrl, 120) ?? product.imageUrl}
                alt={product.name}
                className="h-full w-full object-contain p-1 transition group-hover:scale-[1.02]"
              />
            </button>
          ) : (
            <div className="grid h-13 w-13 shrink-0 place-items-center rounded-md border border-slate-200 bg-slate-50">
              <ImageIcon className="h-5 w-5 text-slate-300" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-black text-slate-900">{product.name}</h2>
              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${sourceClassName(product.source)}`}>
                {productSourceLabel(product.source)}
              </span>
              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${statusClassName(product.status === 'ON_SHELF')}`}>
                {product.statusDesc}
              </span>
            </div>
            <p className="mt-1 truncate text-[11px] text-slate-500">
              {product.code} · {categoryLabel} · {product.skus.length} 个 SKU
            </p>
          </div>
          {canEdit && (product.source === 'MANUAL' || selectedSku) && (
            <button
              type="button"
              onClick={() => selectedSku && onEdit(product, selectedSku)}
              disabled={!selectedSku}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-600 hover:border-primary/30 hover:bg-blue-50 hover:text-primary"
              title={product.source === 'ERP' ? '补录当前 ERP SKU 信息' : '编辑手动商品'}
              aria-label={product.source === 'ERP' ? '补录当前 ERP SKU 信息' : '编辑手动商品'}
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            disabled={!selectedSku?.canCreate}
            onClick={() => selectedSku && onCreate(selectedSku)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-xs font-bold text-white hover:bg-primary disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            title={selectedSku?.canCreate ? '使用当前 SKU 进入图片创作' : createDisabledReason}
          >
            进入创作
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="关闭"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-xs font-black text-slate-800">选择创作 SKU</h3>
              <p className="text-[10px] text-slate-400">
                {selectedSku ? `已选择 ${selectedSku.name}` : '多规格商品需先选择 SKU'}
              </p>
            </div>
            <div className="overflow-hidden rounded-md border border-slate-200">
              <div className="grid grid-cols-[28px_48px_minmax(150px,1.5fr)_1fr_90px_84px] items-center gap-2 bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-500">
                <span />
                <span>图片</span>
                <span>规格 / SKU 编码</span>
                <span>创作参数</span>
                <span>素材</span>
                <span>状态</span>
              </div>
              {product.skus.map((sku) => {
                const selected = sku.id === selectedSkuId;
                return (
                  <button
                    type="button"
                    key={sku.id}
                    onClick={() => setSelectedSkuId(sku.id)}
                    className={`grid w-full grid-cols-[28px_48px_minmax(150px,1.5fr)_1fr_90px_84px] items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-[11px] transition-colors ${selected ? 'bg-blue-50/80' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <span className={`h-4 w-4 rounded-full border ${selected ? 'border-[4px] border-primary bg-white' : 'border-slate-300 bg-white'}`} />
                    {sku.imageUrl ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          // 阻止冒泡到外层 <button>(切换 SKU 选中)
                          e.preventDefault();
                          e.stopPropagation();
                          openProductPreview(sku.imageUrl!, sku.name);
                        }}
                        title="点击查看大图"
                        className="group relative grid h-10 w-10 min-w-0 shrink-0 place-items-center overflow-hidden rounded border border-slate-200 bg-slate-50 hover:border-primary/60"
                      >
                        <img
                          src={withCosThumbnail(sku.imageUrl, 96) ?? sku.imageUrl}
                          alt={sku.name}
                          className="min-h-0 min-w-0 max-h-full max-w-full object-contain p-0.5 transition group-hover:scale-[1.02]"
                          loading="lazy"
                        />
                      </button>
                    ) : (
                      <span className="grid h-10 w-10 place-items-center rounded border border-slate-200 bg-slate-50">
                        <ImageIcon className="h-4 w-4 text-slate-300" />
                      </span>
                    )}
                    <span className="min-w-0">
                      <strong className="block truncate text-slate-800">{sku.name}</strong>
                      <span className="mt-0.5 block truncate font-mono text-[9px] text-slate-400">{sku.code}</span>
                    </span>
                    <span className="min-w-0 truncate text-slate-500" title={formatProductParameters(sku)}>
                      {formatProductParameters(sku)}
                    </span>
                    <span className={sku.materialCount > 0 ? 'text-emerald-700' : 'text-amber-700'}>
                      {sku.materialCount > 0 ? `${sku.materialCount} 张可用图` : '暂无图片'}
                    </span>
                    <span className={sku.canCreate ? 'text-emerald-700' : 'text-slate-400'}>
                      {sku.canCreate ? '可创作' : sku.unavailableReason}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-5 grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-800">SKU 素材</h3>
                <span className="text-[10px] font-bold text-primary">{selectedSku?.materialCount ?? 0} 张</span>
              </div>
              {displayImage ? (
                <button
                  type="button"
                  onClick={() => openProductPreview(displayImage, selectedSku?.name ?? product.name)}
                  title="点击查看大图"
                  className="group relative grid aspect-[4/5] min-w-0 place-items-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 hover:border-primary/60"
                >
                  <img
                    src={withCosThumbnail(displayImage, 480) ?? displayImage}
                    alt={selectedSku?.name ?? product.name}
                    className="min-h-0 min-w-0 max-h-full max-w-full object-contain p-3 transition group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </button>
              ) : (
                <div className="grid aspect-[4/5] place-items-center rounded-md border border-slate-200 bg-slate-50">
                  <div className="text-center text-slate-300">
                    <ImageIcon className="mx-auto h-7 w-7" />
                    <p className="mt-2 text-[10px] font-bold">暂无可用素材</p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-800">创作相关参数</h3>
                <span className="text-[10px] text-slate-400">
                  {product.source === 'ERP' ? 'ERP 事实 + 图片理解' : '手动事实 + 图片理解'}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-5 gap-y-4 rounded-md border border-slate-200 p-4 text-[11px]">
                <Fact label="商品名称" value={product.name} />
                <Fact label="商品分类" value={categoryLabel} />
                <Fact label="品牌" value={product.brand || '—'} />
                <Fact label="当前规格" value={selectedSku?.name || '未选择'} />
                <Fact label="颜色" value={selectedSku?.color || product.color || '—'} />
                <Fact label="图案 / 材质" value={selectedSku?.patternMaterial || product.patternMaterial || '—'} />
                <Fact label="版型 / 结构" value={selectedSku?.silhouetteStructure || product.silhouetteStructure || '—'} />
                <Fact label="关键细节" value={selectedSku?.keyDetails || '—'} />
              </dl>

              <details className="group mt-3 rounded-md border border-slate-200 bg-slate-50/70">
                <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-[11px] font-bold text-slate-700">
                  来源信息
                  <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <dl className="grid grid-cols-2 gap-3 border-t border-slate-200 px-3 py-3 text-[10px]">
                  <Fact label="来源" value={productSourceLabel(product.source)} />
                  <Fact label="SPU 编码" value={product.code} />
                  <Fact label="创建时间" value={formatProductTime(product.createTime)} />
                  <Fact label="最后同步" value={product.source === 'ERP' ? formatProductTime(product.lastSyncAt) : '不适用'} />
                </dl>
              </details>
            </div>
          </section>
        </div>
      </aside>

      {previewState && (
        <ImagePreviewModal
          images={previewState.images}
          initialIndex={previewState.initialIndex}
          onClose={() => setPreviewState(null)}
        />
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[9px] font-bold text-slate-400">{label}</dt>
      <dd className="mt-1 break-words font-bold text-slate-700">{value}</dd>
    </div>
  );
}
