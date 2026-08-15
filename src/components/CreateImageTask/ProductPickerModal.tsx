// src/components/CreateImageTask/ProductPickerModal.tsx
// 轻量版"选择产品"picker —— 复用 productInfoApi.list,不依赖完整 ProductManagePage
// [2026-08-15] 改为无限滚动加载,隐藏上一页/下一页
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import type { ProductDTO, ProductQueryReq, ProductStatus } from '../../api/modules/productInfo';
import { productInfoApi } from '../../api/modules/productInfo';
import { AssetImage } from '../AssetImage';
import { productCategoryApi, type ProductCategoryNode } from '../../api/modules/productCategory';
import type { ProductSource } from '../productManagement/productManagementModel';

export interface ProductPickerModalProps {
  open: boolean;
  onClose: () => void;
  onPick: (product: ProductDTO) => void;
  onCreate?: () => void;
  /** 创建任务时要求 SKU 可创作；关联素材时可关闭，允许选择暂无素材的 SKU。 */
  requireCreatable?: boolean;
}

// [2026-08-15] 每页条数按产品要求设为 21
const PAGE_SIZE = 21;

/**
 * 选择 SKU modal — product 表一行对应一个 SKU,回调 onPick(product) 给父容器
 *
 * [2026-08-15] 无限滚动:
 * - 复用 productInfoApi.list,滚动到底部自动加载下一页,列表累积
 * - 名称/来源/状态/分类筛选全部收口到「搜索」按钮(草稿值 vs 已应用值)
 * - 已隐藏上一页/下一页,底部展示「已加载 X / 共 Y」
 */
export const ProductPickerModal: React.FC<ProductPickerModalProps> = ({
  open,
  onClose,
  onPick,
  onCreate,
  requireCreatable = true,
}) => {
  // 搜索栏:输入态(draftKeyword)与触发态(appliedKeyword)分离,只有点"搜索"
  // 或回车 Enter 才提交到 appliedKeyword 触发 fetch;重置按钮清空两个 + 触发 fetch。
  const [draftKeyword, setDraftKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  // [2026-08-15] 与产品管理筛选对齐:默认全部状态,新增来源 + 分类筛选。
  // 来源/状态/分类与名称一样拆「草稿值(界面)」与「已应用值(查询)」,统一由点「搜索」提交。
  const [statusFilter, setStatusFilter] = useState<ProductStatus | ''>('');
  const [appliedStatus, setAppliedStatus] = useState<ProductStatus | ''>('');
  const [sourceFilter, setSourceFilter] = useState<ProductSource | ''>('');
  const [appliedSource, setAppliedSource] = useState<ProductSource | ''>('');
  const [categoryIdFilter, setCategoryIdFilter] = useState('');
  const [appliedCategoryId, setAppliedCategoryId] = useState('');
  const [categoryOptions, setCategoryOptions] = useState<Array<{ id: string; label: string }>>([]);
  // [2026-08-15] 查询触发号:点「搜索」必 +1,保证每次点击都重新拉取(即使关键字没变化)
  const [queryNonce, setQueryNonce] = useState(0);

  // ---- [2026-08-15] 无限滚动:累积列表 + hasMore + 加载态 ----
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false); // 首页/搜索加载
  const [loadingMore, setLoadingMore] = useState(false); // 滚动追加
  const [loadMoreError, setLoadMoreError] = useState<Error | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nextPageRef = useRef(1);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const queryVersionRef = useRef(0);

  const loadPage = useCallback(async (pageNum: number, version: number) => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const req: ProductQueryReq = {
        pageNum,
        pageSize: PAGE_SIZE,
        keyword: appliedKeyword.trim() || undefined,
        status: (appliedStatus || undefined) as ProductStatus | undefined,
        sourceType: (appliedSource || undefined) as 'MANUAL' | 'ERP' | undefined,
        categoryId: appliedCategoryId || undefined,
      };
      const page = await productInfoApi.list(req);
      if (version !== queryVersionRef.current) return;
      setProducts((current) => pageNum === 1
        ? page.list
        : [...current, ...page.list.filter((next) => !current.some((existing) => existing.id === next.id))]);
      setTotal(page.total);
      hasMoreRef.current = pageNum < page.pages;
      setHasMore(hasMoreRef.current);
      nextPageRef.current = pageNum + 1;
    } catch (err) {
      if (version !== queryVersionRef.current) return;
      if (pageNum === 1) {
        toast.error(`加载产品失败: ${(err as Error).message}`);
        setProducts([]);
      } else {
        setLoadMoreError(err as Error);
      }
    } finally {
      if (version === queryVersionRef.current) {
        loadingRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [appliedKeyword, appliedStatus, appliedSource, appliedCategoryId]);

  // 查询触发:open / 已应用筛选 / queryNonce 变化 → 重置到第一页
  useEffect(() => {
    if (!open) return;
    queryVersionRef.current += 1;
    const version = queryVersionRef.current;
    loadingRef.current = false;
    hasMoreRef.current = true;
    nextPageRef.current = 1;
    setProducts([]);
    scrollRef.current?.scrollTo({ top: 0 });
    void loadPage(1, version);
  }, [open, appliedKeyword, appliedStatus, appliedSource, appliedCategoryId, queryNonce, loadPage]);

  // 滚动到底部附近 → 加载下一页
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 160) {
      if (hasMoreRef.current && !loadingRef.current) {
        void loadPage(nextPageRef.current, queryVersionRef.current);
      }
    }
  };

  // 打开时重置全部筛选(草稿 + 已应用)
  useEffect(() => {
    if (open) {
      setDraftKeyword('');
      setAppliedKeyword('');
      setSourceFilter('');
      setAppliedSource('');
      setStatusFilter('');
      setAppliedStatus('');
      setCategoryIdFilter('');
      setAppliedCategoryId('');
    }
  }, [open]);

  // [2026-08-15] 加载产品分类树,展平成下拉选项(与产品管理一致;失败不阻塞弹框)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tree = await productCategoryApi.tree();
        if (cancelled) return;
        const flat: Array<{ id: string; label: string }> = [];
        const walk = (nodes: ProductCategoryNode[], depth: number) => {
          nodes.forEach((node) => {
            flat.push({ id: node.id, label: `${'　'.repeat(depth)}${node.categoryName}` });
            if (node.children?.length) walk(node.children, depth + 1);
          });
        };
        walk(tree, 0);
        setCategoryOptions(flat);
      } catch (err) {
        if (!cancelled) toast.error(`商品分类加载失败: ${(err as Error).message}`);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSearch = () => {
    setAppliedKeyword(draftKeyword);
    setAppliedStatus(statusFilter);
    setAppliedSource(sourceFilter);
    setAppliedCategoryId(categoryIdFilter);
    setQueryNonce((n) => n + 1);
  };

  const handleReset = () => {
    setDraftKeyword('');
    setAppliedKeyword('');
    setSourceFilter('');
    setAppliedSource('');
    setStatusFilter('');
    setAppliedStatus('');
    setCategoryIdFilter('');
    setAppliedCategoryId('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
          <motion.div
            className="relative bg-white rounded-lg w-full max-w-4xl max-h-[80vh] shadow-xl flex flex-col overflow-hidden"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.16 }}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <p className="text-[11px] font-bold text-primary">产品库 · SKU</p>
                <h2 className="text-base font-black text-slate-800">选择 SKU</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Toolbar —— [2026-08-15] 与产品管理筛选项对齐:来源 / 状态 / 分类 */}
            <div className="px-6 py-3 border-b border-slate-200 flex flex-wrap items-center gap-2 shrink-0">
              <div className="relative min-w-[180px] flex-1 max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                <input
                  type="text"
                  placeholder="搜索商品名称、规格或 SKU 编码"
                  value={draftKeyword}
                  onChange={(e) => setDraftKeyword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <select
                value={sourceFilter}
                onChange={(e) => { setSourceFilter(e.target.value as ProductSource | ''); }}
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold"
                aria-label="按来源筛选"
              >
                <option value="">全部来源</option>
                <option value="MANUAL">手动创建</option>
                <option value="ERP">ERP 同步</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as ProductStatus | ''); }}
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold"
                aria-label="按状态筛选"
              >
                <option value="">全部状态</option>
                <option value="ON_SHELF">上架</option>
                <option value="OFF_SHELF">下架</option>
              </select>
              <select
                value={categoryIdFilter}
                onChange={(e) => { setCategoryIdFilter(e.target.value); }}
                className="h-9 max-w-[190px] rounded-md border border-slate-200 bg-white px-2 text-xs font-bold"
                aria-label="按商品分类筛选"
                title={categoryIdFilter
                  ? (categoryOptions.find((option) => option.id === categoryIdFilter)?.label ?? '按商品分类筛选')
                  : '按商品分类筛选'}
              >
                <option value="">全部分类</option>
                {categoryOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSearch}
                className="h-9 px-4 rounded-md bg-primary text-white text-xs font-bold shadow-sm hover:opacity-90 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">search</span>
                搜索
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="h-9 px-3 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-md border border-slate-200"
              >
                重置
              </button>
              {onCreate && (
                <button
                  type="button"
                  onClick={onCreate}
                  className="h-9 px-3 text-xs font-bold text-primary hover:bg-[#fff5f1] rounded-md border border-primary/30"
                >
                  新建商品
                </button>
              )}
              <span className="text-xs text-slate-500">
                共 {total} 个 SKU
              </span>
            </div>

            {/* Body —— [2026-08-15] 固定高度 764px(两行),无限滚动加载 */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="min-h-[764px] max-h-[764px] overflow-y-auto p-4 bg-slate-50"
            >
              {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-500 text-xs">
                  <span className="material-symbols-outlined mr-2 animate-spin">progress_activity</span>
                  加载中…
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs">
                  <span className="material-symbols-outlined text-3xl mb-2">inbox</span>
                  暂无产品
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {products.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          if (!requireCreatable || p.canCreate !== false) {
                            onPick(p);
                            onClose();
                          }
                        }}
                        disabled={requireCreatable && p.canCreate === false}
                        className="group text-left bg-white border border-slate-200 rounded-lg overflow-hidden hover:border-primary hover:shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-55"
                        title={requireCreatable && p.canCreate === false
                          ? (p.unavailableReason || '当前 SKU 暂不可创作')
                          : `选择 ${p.name}`}
                      >
                        <div className="aspect-square relative bg-slate-100 overflow-hidden">
                          <AssetImage
                            urls={[p.imageUrl]}
                            alt={p.name}
                            className="w-full h-full"
                            aspectRatio="auto"
                          />
                        </div>
                        <div className="p-3">
                          <p className="text-xs font-bold text-slate-800 truncate" title={p.name}>{p.name}</p>
                          <p
                            className="mt-1 truncate text-[10px] font-medium text-slate-500"
                            title={[p.specName, p.skuCode].filter(Boolean).join(' · ')}
                          >
                            {[p.specName, p.skuCode].filter(Boolean).join(' · ') || '默认规格'}
                          </p>
                          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                            <span className="truncate">{p.category ?? '未分类'}</span>
                            <span className={
                              'px-1.5 py-0.5 rounded font-bold ' +
                              (p.status === 'ON_SHELF' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500')
                            }>{p.statusDesc}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  {loadingMore && (
                    <div className="flex items-center justify-center py-4 text-slate-400 text-xs">
                      <span className="material-symbols-outlined mr-2 animate-spin">progress_activity</span>
                      加载中…
                    </div>
                  )}
                  {!loadingMore && loadMoreError && (
                    <div className="py-4 text-center text-xs font-bold text-red-500">
                      加载更多失败:{loadMoreError.message}
                      <button
                        type="button"
                        onClick={() => void loadPage(nextPageRef.current, queryVersionRef.current)}
                        className="ml-2 text-primary underline"
                      >
                        重试
                      </button>
                    </div>
                  )}
                  {!hasMore && !loadingMore && (
                    <div className="py-4 text-center text-[10px] text-slate-300">已加载全部</div>
                  )}
                </>
              )}
            </div>

            {/* Footer —— [2026-08-15] 已隐藏上一页/下一页,展示已加载数量 */}
            <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between shrink-0 bg-white">
              <div className="text-[10px] text-slate-400">
                已加载 {products.length} 个 · 共 {total} 个 SKU
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-8 px-3 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded border border-slate-200"
              >
                取消
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
