import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Image as ImageIcon,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ProductDTO, ProductQueryReq, ProductStatus } from '../api/modules/productInfo';
import { productInfoApi } from '../api/modules/productInfo';
import type { PageInfo } from '../api/service-result';
import { productCategoryApi, type ProductCategoryNode } from '../api/modules/productCategory';
import { useAuth } from '../auth/AuthContext';
import { AppScreen } from '../types';
import { withCosThumbnail } from '../utils/cosImage';
import { useConfirm } from './common/ConfirmProvider';
import { ProductDetailDrawer } from './productManagement/ProductDetailDrawer';
import { ProductSpuFormDrawer } from './productManagement/ProductSpuFormDrawer';
import {
  formatProductTime,
  productParameterSummary,
  productSourceLabel,
  toProductSpu,
  type ProductManagementRecord,
  type ProductSkuView,
  type ProductSource,
  type ProductSpuView,
} from './productManagement/productManagementModel';

interface ProductManagePageProps {
  setScreen: (screen: AppScreen) => void;
}

interface ProductLoadOverrides {
  pageNum?: number;
  pageSize?: number;
  keyword?: string | null;
  status?: ProductStatus | null;
  categoryId?: string | null;
}

export default function ProductManagePage({ setScreen }: ProductManagePageProps) {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('product:create');
  const canEdit = hasPermission('product:edit');
  const canDelete = hasPermission('product:delete');
  const confirm = useConfirm();

  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | ''>('');
  const [sourceFilter, setSourceFilter] = useState<ProductSource | ''>('');
  const [categoryIdFilter, setCategoryIdFilter] = useState('');
  const [categoryTree, setCategoryTree] = useState<ProductCategoryNode[]>([]);
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pageInfo, setPageInfo] = useState<PageInfo<ProductDTO> | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [detailProduct, setDetailProduct] = useState<ProductSpuView | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductDTO | null>(null);

  async function load(overrides?: ProductLoadOverrides) {
    setLoading(true);
    try {
      const req: ProductQueryReq = {
        pageNum: overrides?.pageNum ?? pageNum,
        pageSize: overrides?.pageSize ?? pageSize,
        keyword: overrides?.keyword === null ? undefined : overrides?.keyword ?? (keyword || undefined),
        status: overrides?.status === null ? undefined : overrides?.status ?? (statusFilter || undefined),
        categoryId: overrides?.categoryId === null ? undefined : overrides?.categoryId ?? (categoryIdFilter || undefined),
      };
      const data = await productInfoApi.list(req);
      setPageInfo(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNum, pageSize]);

  useEffect(() => {
    void productCategoryApi.tree().then(setCategoryTree);
  }, []);

  const flatCategoryOptions = useMemo(() => {
    const options: Array<{ id: string; label: string }> = [];
    const walk = (nodes: ProductCategoryNode[], depth: number) => {
      nodes.forEach((node) => {
        options.push({ id: String(node.id), label: `${'　'.repeat(depth)}${node.categoryName}` });
        if (node.children?.length) walk(node.children, depth + 1);
      });
    };
    walk(categoryTree, 0);
    return options;
  }, [categoryTree]);

  const products = useMemo(
    () => (pageInfo?.list ?? []).map((item) => toProductSpu(item as ProductManagementRecord)),
    [pageInfo],
  );
  const visibleProducts = useMemo(
    () => sourceFilter ? products.filter((product) => product.source === sourceFilter) : products,
    [products, sourceFilter],
  );
  const visibleSkuCount = visibleProducts.reduce((count, product) => count + product.skus.length, 0);
  const total = pageInfo?.total ?? 0;
  const hasAnyFilter = Boolean(keyword.trim() || statusFilter || sourceFilter || categoryIdFilter);

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openAdd() {
    if (!canCreate) return;
    setEditing(null);
    setFormOpen(true);
  }

  async function openEdit(product: ProductDTO) {
    if (!canEdit) return;
    try {
      const detail = await productInfoApi.detail({ id: product.id });
      setDetailProduct(null);
      setEditing(detail);
      setFormOpen(true);
    } catch {
      // 全局 HTTP 拦截器负责错误提示。
    }
  }

  async function openDetails(product: ProductSpuView) {
    setDetailProduct(product);
    try {
      const detail = await productInfoApi.detail({ id: product.id });
      setDetailProduct(toProductSpu(detail as ProductManagementRecord));
    } catch {
      // 列表已有完整兜底数据，详情请求失败时仍可浏览当前快照。
    }
  }

  async function handleDelete(product: ProductSpuView) {
    if (!canDelete || product.source !== 'MANUAL') return;
    const approved = await confirm({
      title: '删除产品',
      message: (
        <div className="space-y-1">
          <div>确认删除产品「{product.name}」?</div>
          <div className="text-slate-400">该操作不可恢复，产品关联的分类会一起解除。</div>
        </div>
      ),
      confirmText: '删除',
      danger: true,
    });
    if (!approved) return;
    try {
      await productInfoApi.delete({ id: product.id });
      toast.success('删除成功');
      await load();
    } catch {
      // 全局 HTTP 拦截器负责错误提示。
    }
  }

  function handleCreate(sku: ProductSkuView) {
    if (!sku.canCreate) {
      toast.warning(sku.unavailableReason || '当前 SKU 暂不可用于创作');
      return;
    }
    setDetailProduct(null);
    setScreen(AppScreen.CREATE_IMAGE_TASK);
  }

  async function handleReset() {
    setKeyword('');
    setStatusFilter('');
    setSourceFilter('');
    setCategoryIdFilter('');
    setPageNum(1);
    await load({ pageNum: 1, keyword: null, status: null, categoryId: null });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-primary shadow-sm">
          <span className="material-symbols-outlined text-[22px]">inventory_2</span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-black text-slate-900">产品管理</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            共 <span className="font-bold text-slate-700">{total}</span> 个 SPU
            <span className="mx-1.5 text-slate-300">·</span>
            当前页 <span className="font-bold text-slate-700">{visibleSkuCount}</span> 个 SKU
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={openAdd}
            className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-slate-900 px-4 text-xs font-bold text-white hover:bg-primary"
          >
            <Plus className="h-4 w-4" />
            新建产品
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-3">
          <div className="relative min-w-[220px] flex-1 lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-9 w-full rounded-md border border-slate-300 pl-9 pr-3 text-xs outline-none focus:border-primary"
              placeholder="搜索商品名称 / SPU / SKU 编码"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setPageNum(1);
                  void load({ pageNum: 1 });
                }
              }}
            />
          </div>
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value as ProductSource | '')}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-700"
            aria-label="按来源筛选"
          >
            <option value="">全部来源</option>
            <option value="MANUAL">手动创建</option>
            <option value="ERP">ERP 同步</option>
          </select>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as ProductStatus | '');
              setPageNum(1);
            }}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-700"
            aria-label="按状态筛选"
          >
            <option value="">全部状态</option>
            <option value="ON_SHELF">上架</option>
            <option value="OFF_SHELF">下架</option>
          </select>
          <select
            value={categoryIdFilter}
            onChange={(event) => {
              setCategoryIdFilter(event.target.value);
              setPageNum(1);
            }}
            className="h-9 max-w-[190px] rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-700"
            aria-label="按商品分类筛选"
          >
            <option value="">全部分类</option>
            {flatCategoryOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setPageNum(1);
              void load({ pageNum: 1 });
            }}
            disabled={loading}
            className="grid h-9 w-9 place-items-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            title="查询"
            aria-label="查询"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void handleReset()}
            disabled={loading || !hasAnyFilter}
            className="grid h-9 w-9 place-items-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
            title="重置筛选"
            aria-label="重置筛选"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1080px] table-fixed text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] font-bold text-slate-500">
              <tr>
                <th className="w-10 px-2 py-2.5" />
                <th className="w-16 px-2 py-2.5">图片</th>
                <th className="w-[220px] px-3 py-2.5">商品 / 编码</th>
                <th className="w-[170px] px-3 py-2.5">分类 / 规格</th>
                <th className="px-3 py-2.5">创作参数</th>
                <th className="w-24 px-3 py-2.5">来源</th>
                <th className="w-28 px-3 py-2.5">状态</th>
                <th className="w-36 px-3 py-2.5">更新时间</th>
                <th className="w-32 px-3 py-2.5">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && visibleProducts.length === 0 && (
                <EmptyTableRow label="加载中..." />
              )}
              {!loading && visibleProducts.length === 0 && (
                <EmptyTableRow label={sourceFilter === 'ERP' ? 'ERP 接口尚未接入，暂无同步商品' : '暂无符合条件的产品'} />
              )}
              {visibleProducts.map((product) => {
                const expanded = expandedIds.has(product.id);
                const categoryLabel = product.categories.map((item) => item.categoryName).join(' / ')
                  || product.category
                  || '未分类';
                const onlySku = product.skus.length === 1 ? product.skus[0] : null;
                return (
                  <ProductRows
                    key={product.id}
                    product={product}
                    expanded={expanded}
                    categoryLabel={categoryLabel}
                    onlySku={onlySku}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onToggle={() => toggleExpanded(product.id)}
                    onDetails={() => void openDetails(product)}
                    onEdit={() => void openEdit(product.raw)}
                    onDelete={() => void handleDelete(product)}
                    onCreate={handleCreate}
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        {pageInfo && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              <span>共 {pageInfo.total} 个 SPU</span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPageNum(1);
                }}
                className="h-8 rounded border border-slate-300 bg-white px-2 text-[11px]"
                aria-label="每页数量"
              >
                <option value={10}>10 / 页</option>
                <option value={20}>20 / 页</option>
                <option value={50}>50 / 页</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pageNum <= 1}
                onClick={() => setPageNum((value) => Math.max(1, value - 1))}
                className="grid h-8 w-8 place-items-center rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-30"
                title="上一页"
                aria-label="上一页"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>第 {pageInfo.pageNum} / {Math.max(pageInfo.pages, 1)} 页</span>
              <button
                type="button"
                disabled={pageNum >= Math.max(pageInfo.pages, 1)}
                onClick={() => setPageNum((value) => value + 1)}
                className="grid h-8 w-8 place-items-center rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-30"
                title="下一页"
                aria-label="下一页"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <ProductDetailDrawer
        product={detailProduct}
        canEdit={canEdit}
        onClose={() => setDetailProduct(null)}
        onEdit={(product) => void openEdit(product)}
        onCreate={handleCreate}
      />
      <ProductSpuFormDrawer
        open={formOpen}
        initial={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  );
}

interface ProductRowsProps {
  key?: string;
  product: ProductSpuView;
  expanded: boolean;
  categoryLabel: string;
  onlySku: ProductSkuView | null;
  canEdit: boolean;
  canDelete: boolean;
  onToggle: () => void;
  onDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCreate: (sku: ProductSkuView) => void;
}

function ProductRows({
  product,
  expanded,
  categoryLabel,
  onlySku,
  canEdit,
  canDelete,
  onToggle,
  onDetails,
  onEdit,
  onDelete,
  onCreate,
}: ProductRowsProps) {
  const sourceClass = product.source === 'ERP'
    ? 'border-blue-100 bg-blue-50 text-blue-700'
    : 'border-violet-100 bg-violet-50 text-violet-700';
  return (
    <>
      <tr className="border-t border-slate-100 bg-white hover:bg-slate-50/80">
        <td className="px-2 py-2">
          <button
            type="button"
            onClick={onToggle}
            className="grid h-7 w-7 place-items-center rounded text-slate-500 hover:bg-slate-200/70"
            title={expanded ? '收起 SKU' : '展开 SKU'}
            aria-label={expanded ? '收起 SKU' : '展开 SKU'}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
        <td className="px-2 py-2">
          <ProductImage url={product.imageUrl} alt={product.name} size="lg" />
        </td>
        <td className="px-3 py-2">
          <button type="button" onClick={onDetails} className="block max-w-full text-left">
            <strong className="block truncate text-xs text-slate-900 hover:text-primary" title={product.name}>{product.name}</strong>
            <span className="mt-1 block truncate font-mono text-[9px] text-slate-400" title={product.code}>{product.code}</span>
          </button>
        </td>
        <td className="px-3 py-2">
          <span className="block truncate text-[11px] font-medium text-slate-600" title={categoryLabel}>{categoryLabel}</span>
        </td>
        <td className="px-3 py-2">
          <span className="block truncate text-[11px] text-slate-500" title={productParameterSummary(product)}>
            {productParameterSummary(product)}
          </span>
        </td>
        <td className="px-3 py-2">
          <span className={`inline-flex rounded border px-1.5 py-0.5 text-[9px] font-bold ${sourceClass}`}>
            {productSourceLabel(product.source)}
          </span>
        </td>
        <td className="px-3 py-2">
          <span className={product.status === 'ON_SHELF' ? 'text-emerald-700' : 'text-slate-500'}>
            {product.statusDesc} · {product.skus.length} SKU
          </span>
        </td>
        <td className="px-3 py-2 text-[10px] text-slate-500">{formatProductTime(product.createTime)}</td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1">
            <IconButton title="查看详情" onClick={onDetails}><Eye className="h-3.5 w-3.5" /></IconButton>
            {canEdit && product.source === 'MANUAL' && (
              <IconButton title="编辑" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></IconButton>
            )}
            {canDelete && product.source === 'MANUAL' && (
              <IconButton title="删除" danger onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></IconButton>
            )}
            {onlySku ? (
              <CreateButton sku={onlySku} onCreate={onCreate} compact />
            ) : (
              <button
                type="button"
                onClick={onDetails}
                className="ml-1 h-7 rounded bg-slate-900 px-2 text-[9px] font-bold text-white hover:bg-primary"
              >
                选择 SKU
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && product.skus.map((sku) => (
        <tr key={sku.id} className="border-t border-blue-50 bg-blue-50/35 hover:bg-blue-50/70">
          <td className="px-2 py-2 text-center text-slate-300">└</td>
          <td className="px-2 py-2"><ProductImage url={sku.imageUrl} alt={sku.name} size="sm" /></td>
          <td className="px-3 py-2 pl-6">
            <strong className="block truncate text-[11px] text-slate-800">{sku.name}</strong>
            <span className="mt-0.5 block truncate font-mono text-[9px] text-slate-400">{sku.code}</span>
          </td>
          <td className="px-3 py-2 text-[11px] text-slate-500">{sku.color || '默认规格'}</td>
          <td className="px-3 py-2 text-[11px] text-slate-500">
            {[sku.patternMaterial, sku.silhouetteStructure].filter(Boolean).join(' · ') || '待补充创作参数'}
          </td>
          <td className="px-3 py-2 text-[10px] text-slate-400">继承 {productSourceLabel(product.source)}</td>
          <td className="px-3 py-2 text-[10px]">
            <span className={sku.canCreate ? 'text-emerald-700' : 'text-amber-700'}>
              {sku.canCreate ? `${sku.materialCount} 张素材 · 可创作` : sku.unavailableReason}
            </span>
          </td>
          <td className="px-3 py-2 text-[10px] text-slate-400">{formatProductTime(product.createTime)}</td>
          <td className="px-3 py-2"><CreateButton sku={sku} onCreate={onCreate} /></td>
        </tr>
      ))}
    </>
  );
}

function ProductImage({ url, alt, size }: { url?: string; alt: string; size: 'sm' | 'lg' }) {
  const classes = size === 'lg' ? 'h-11 w-11' : 'h-9 w-9';
  return (
    <span className={`grid place-items-center overflow-hidden rounded border border-slate-200 bg-slate-50 ${classes}`}>
      {url ? (
        <img src={withCosThumbnail(url, 96) ?? url} alt={alt} className="h-full w-full object-contain p-0.5" />
      ) : (
        <ImageIcon className="h-4 w-4 text-slate-300" />
      )}
    </span>
  );
}

function CreateButton({
  sku,
  onCreate,
  compact = false,
}: {
  sku: ProductSkuView;
  onCreate: (sku: ProductSkuView) => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={!sku.canCreate}
      onClick={() => onCreate(sku)}
      title={sku.canCreate ? `使用 ${sku.name} 进入图片创作` : sku.unavailableReason}
      className={`${compact ? 'ml-1 grid h-7 w-7 place-items-center px-0' : 'h-7 px-2'} rounded bg-slate-900 text-[9px] font-bold text-white hover:bg-primary disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400`}
      aria-label={sku.canCreate ? `使用 ${sku.name} 进入图片创作` : sku.unavailableReason}
    >
      {compact ? <Sparkles className="h-3.5 w-3.5" /> : '去创作'}
    </button>
  );
}

function IconButton({
  title,
  onClick,
  danger = false,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid h-7 w-7 place-items-center rounded ${danger ? 'text-rose-500 hover:bg-rose-50' : 'text-slate-500 hover:bg-slate-100 hover:text-primary'}`}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

function EmptyTableRow({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={9} className="px-4 py-16 text-center text-xs text-slate-400">{label}</td>
    </tr>
  );
}
