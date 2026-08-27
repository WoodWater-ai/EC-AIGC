import React from 'react';
import { Copy, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductDTO } from '../../../api/modules/productInfo';
import type { ProductFactsInput } from '../../../lib/createImageTask/extractProductFacts';

interface ProductFactsDialogProps {
  product: ProductDTO;
  facts: ProductFactsInput;
  seoName: string;
  onFactsChange: (facts: ProductFactsInput) => void;
  onSeoNameChange: (value: string) => void;
  onClose: () => void;
}

const textOrFallback = (value?: string | number) => {
  if (value == null) return '未提供';
  return String(value).trim() || '未提供';
};

export const formatProductSyncTime = (value?: string | number): string => {
  const source = value == null ? '' : String(value).trim();
  if (!source) return '未提供';
  const timestamp = /^\d{10,13}$/.test(source)
    ? Number(source) * (source.length === 10 ? 1000 : 1)
    : Date.parse(source);
  if (!Number.isFinite(timestamp)) return source;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return source;
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export const mergeProductFactsWithErp = (
  product: ProductDTO | null,
  facts: ProductFactsInput,
): ProductFactsInput => {
  if (!product) return facts;
  return {
    name: product.name?.trim() || facts.name,
    sellingPoints: product.sellingPoints?.trim() || facts.sellingPoints,
    productCategory: product.category?.trim() || facts.productCategory,
    colorPattern: product.color?.trim() || facts.colorPattern,
    fabricTexture: product.patternMaterial?.trim() || facts.fabricTexture,
    fitStructure: product.silhouetteStructure?.trim() || facts.fitStructure,
  };
};

const ReadonlyRow: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
  <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 border-b border-slate-100 py-2 text-[11px] last:border-b-0">
    <span className="text-slate-400">{label}</span>
    <span className="break-words font-medium text-slate-700">{textOrFallback(value)}</span>
  </div>
);

interface PromptFieldRowProps {
  label: string;
  erpValue?: string;
  value: string;
  multiline?: boolean;
  onChange: (value: string) => void;
}

const PromptFieldRow: React.FC<PromptFieldRowProps> = ({
  label,
  erpValue,
  value,
  multiline = false,
  onChange,
}) => {
  const lockedValue = erpValue?.trim();
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 border-b border-slate-100 py-2 last:border-b-0">
      <span className="pt-1.5 text-[11px] text-slate-400">{label}</span>
      {lockedValue ? (
        <span className="py-1 text-[11px] font-medium text-slate-700">{lockedValue}</span>
      ) : multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`补充${label}`}
          className="min-h-16 resize-y border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-5 text-slate-700 outline-none focus:border-primary"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`补充${label}`}
          className="h-8 border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-primary"
        />
      )}
    </div>
  );
};

export const ProductFactsDialog: React.FC<ProductFactsDialogProps> = ({
  product,
  facts,
  seoName,
  onFactsChange,
  onSeoNameChange,
  onClose,
}) => {
  const updateFact = <K extends keyof ProductFactsInput>(key: K, value: ProductFactsInput[K]) => {
    onFactsChange({ ...facts, [key]: value });
  };

  const mergedFacts = mergeProductFactsWithErp(product, facts);
  const syncTime = formatProductSyncTime(product.lastSyncTime);
  const copyText = [
    `商品名称：${textOrFallback(product.name)}`,
    `SKU：${textOrFallback(product.skuCode)}`,
    `SPU：${textOrFallback(product.spuCode)}`,
    `条码：${textOrFallback(product.barcode)}`,
    `品牌：${textOrFallback(product.brand)}`,
    `SEO 商品名称：${textOrFallback(seoName)}`,
    `品类：${textOrFallback(mergedFacts.productCategory)}`,
    `颜色：${textOrFallback(mergedFacts.colorPattern)}`,
    `图案/材质：${textOrFallback(mergedFacts.fabricTexture)}`,
    `版型/结构：${textOrFallback(mergedFacts.fitStructure)}`,
    `核心卖点：${textOrFallback(mergedFacts.sellingPoints)}`,
    `来源渠道：${textOrFallback(product.sourceChannel)}`,
    `最后同步：${syncTime}`,
  ].join('\n');

  const copyAll = () => {
    void navigator.clipboard.writeText(copyText)
      .then(() => toast.success('商品事实已复制'))
      .catch(() => toast.error('复制失败，请检查浏览器权限'));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-facts-title"
        className="flex max-h-[86vh] w-[560px] max-w-full flex-col border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-[#df5b43]">ERP 商品事实</p>
            <h2 id="product-facts-title" className="mt-1 truncate text-base font-black text-slate-800">
              {product.name || '未命名商品'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center text-slate-400 hover:text-slate-700"
            title="关闭"
            aria-label="关闭商品事实"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto px-4 py-2">
          <ReadonlyRow label="商品名称" value={product.name} />
          <ReadonlyRow label="SKU" value={product.skuCode} />
          <ReadonlyRow label="SPU" value={product.spuCode} />
          <ReadonlyRow label="条码" value={product.barcode} />
          <ReadonlyRow label="品牌" value={product.brand} />
          <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 border-b border-slate-100 py-2">
            <label htmlFor="seo-product-name" className="pt-1.5 text-[11px] text-slate-400">SEO 商品名称</label>
            <input
              id="seo-product-name"
              value={seoName}
              onChange={(event) => onSeoNameChange(event.target.value)}
              placeholder="补充 SEO 商品名称"
              className="h-8 border border-slate-200 bg-white px-2 text-[11px] font-medium text-[#c84d38] outline-none focus:border-primary"
            />
          </div>
          <PromptFieldRow
            label="品类"
            erpValue={product.category}
            value={facts.productCategory}
            onChange={(value) => updateFact('productCategory', value)}
          />
          <PromptFieldRow
            label="颜色"
            erpValue={product.color}
            value={facts.colorPattern}
            onChange={(value) => updateFact('colorPattern', value)}
          />
          <PromptFieldRow
            label="图案/材质"
            erpValue={product.patternMaterial}
            value={facts.fabricTexture}
            onChange={(value) => updateFact('fabricTexture', value)}
          />
          <PromptFieldRow
            label="版型/结构"
            erpValue={product.silhouetteStructure}
            value={facts.fitStructure}
            onChange={(value) => updateFact('fitStructure', value)}
          />
          <PromptFieldRow
            label="核心卖点"
            erpValue={product.sellingPoints}
            value={facts.sellingPoints}
            multiline
            onChange={(value) => updateFact('sellingPoints', value)}
          />
          <ReadonlyRow label="来源渠道" value={product.sourceChannel} />
          <ReadonlyRow label="最后同步" value={syncTime} />
        </div>

        <footer className="border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={copyAll}
            className="flex h-9 w-full items-center justify-center gap-2 bg-primary text-xs font-bold text-white hover:bg-primary/90"
          >
            <Copy className="h-4 w-4" />
            复制全文
          </button>
        </footer>
      </section>
    </div>
  );
};
