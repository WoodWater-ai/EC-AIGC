import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { ProductDTO, ProductQueryReq, ProductStatus } from '../api/modules/productInfo';
import { productInfoApi } from '../api/modules/productInfo';
import type { PageInfo } from '../api/service-result';
import { withCosThumbnail } from '../utils/cosImage';
import { useConfirm } from './common/ConfirmProvider';
import { productCategoryApi, type ProductCategoryNode } from '../api/modules/productCategory';
import ProductFormDrawer from './ProductFormDrawer';

/**
 * 产品管理 - 列表页
 *
 * 视觉风格对齐 ProductCategoryList:
 *  - 顶部渐变 banner(带 icon + 统计 + 新建按钮)
 *  - 卡片化表格容器(bg-white rounded-xl border-slate-200)
 *  - 行 hover:bg-slate-50
 *  - 操作列内联 group-hover 显现图标按钮
 *  - 分页器底部对齐
 */
export default function ProductManagePage() {
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | ''>('');
  // 分类筛选(单选):value 为 product_category.id (string 防止精度丢失)
  const [categoryIdFilter, setCategoryIdFilter] = useState<string>('');
  const [categoryTree, setCategoryTree] = useState<ProductCategoryNode[]>([]);
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pageInfo, setPageInfo] = useState<PageInfo<ProductDTO> | null>(null);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ProductDTO | null>(null);

  const confirm = useConfirm();

  async function load() {
    setLoading(true);
    try {
      const req: ProductQueryReq = {
        pageNum,
        pageSize,
        keyword: keyword || undefined,
        status: statusFilter || undefined,
        categoryId: categoryIdFilter || undefined,
      };
      const data = await productInfoApi.list(req);
      setPageInfo(data);
    } catch {
      // toast 由 http 拦截器处理
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNum, pageSize]);

  // 进入页面时一次性拉取 product-category 树(用于分类筛选下拉)
  useEffect(() => {
    void productCategoryApi
      .tree()
      .then(setCategoryTree)
      .catch(() => {
        // http 拦截器已 toast
      });
  }, []);

  // 分类树扁平化为带 depth 的选项列表(多级用 '　' 缩进显示)
  const flatCategoryOptions = useMemo(() => {
    const opts: { id: string; label: string }[] = [];
    const walk = (nodes: ProductCategoryNode[], depth: number) => {
      for (const n of nodes) {
        opts.push({
          id: String(n.id),
          label: `${'　'.repeat(depth)}${n.categoryName}`,
        });
        if (n.children?.length) walk(n.children, depth + 1);
      }
    };
    walk(categoryTree, 0);
    return opts;
  }, [categoryTree]);

  function openAdd() {
    setEditing(null);
    setDrawerOpen(true);
  }

  async function openEdit(p: ProductDTO) {
    try {
      const detail = await productInfoApi.detail({ id: p.id });
      setEditing(detail);
      setDrawerOpen(true);
    } catch {
      // toast 由 http 拦截器处理
    }
  }

  async function handleDelete(p: ProductDTO) {
    const ok = await confirm({
      title: '删除产品',
      message: (
        <div className="space-y-1">
          <div>确认删除产品「{p.name}」?</div>
          <div className="text-slate-400">该操作不可恢复,产品关联的分类会一起解除。</div>
        </div>
      ),
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await productInfoApi.delete({ id: p.id });
      toast.success('删除成功');
      load();
    } catch {
      // toast 由 http 拦截器处理
    }
  }

  function onSaved() {
    load();
  }

  // 当前是否有任意筛选条件
  const hasAnyFilter =
    keyword.trim() !== '' || statusFilter !== '' || categoryIdFilter !== '';

  function handleReset() {
    setKeyword('');
    setStatusFilter('');
    setCategoryIdFilter('');
    setPageNum(1);
    load();
  }

  const list = pageInfo?.list ?? [];
  const total = pageInfo?.total ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* 顶部 Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 mb-4 flex items-center gap-3">
        <span className="material-symbols-outlined text-3xl text-primary">inventory_2</span>
        <div className="flex-1">
          <h1 className="text-base font-bold text-slate-800">产品管理</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            共 <span className="font-semibold text-primary">{total}</span> 个产品
          </p>
        </div>
        <button
          onClick={openAdd}
          className="h-9 px-4 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-base">add</span>
          新建产品
        </button>
      </div>

      {/* 筛选 + 表格卡片 */}
      <div className="bg-white rounded-xl border border-slate-200 flex-1 flex flex-col min-h-0">
        {/* 筛选条 */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none">
              search
            </span>
            <input
              className="w-full h-9 pl-9 pr-3 border border-slate-300 rounded-md text-sm focus:border-primary focus:outline-none"
              placeholder="搜索产品名称"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPageNum(1);
                  load();
                }
              }}
            />
          </div>
          <select
            className="h-9 px-3 border border-slate-300 rounded-md text-sm bg-white"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ProductStatus | '');
              setPageNum(1);
            }}
          >
            <option value="">全部状态</option>
            <option value="ON_SHELF">上架</option>
            <option value="OFF_SHELF">下架</option>
          </select>
          {/* 分类筛选(单选,平铺树状带缩进显示) */}
          <select
            className="h-9 px-3 border border-slate-300 rounded-md text-sm bg-white max-w-[180px]"
            value={categoryIdFilter}
            onChange={(e) => {
              setCategoryIdFilter(e.target.value);
              setPageNum(1);
            }}
            title="按产品分类筛选"
          >
            <option value="">全部分类</option>
            {flatCategoryOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            className="h-9 px-3 border border-slate-300 bg-white text-slate-700 text-sm rounded-md hover:bg-slate-50 flex items-center gap-1 disabled:opacity-50"
            onClick={() => {
              setPageNum(1);
              load();
            }}
            disabled={loading}
          >
            <span className="material-symbols-outlined text-base">search</span>
            查询
          </button>
          {/* 重置按钮:清空所有筛选条件,跳回第一页,重新加载 */}
          <button
            className="h-9 px-3 border border-slate-300 bg-white text-slate-700 text-sm rounded-md hover:bg-slate-50 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleReset}
            disabled={loading || !hasAnyFilter}
            title={hasAnyFilter ? '清空所有筛选条件' : '没有筛选条件可清空'}
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            重置
          </button>
        </div>

        {/* 表格 */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold w-20">图片</th>
                <th className="px-4 py-2.5 text-left font-semibold w-48">名称</th>
                <th className="px-4 py-2.5 text-left font-semibold w-24">颜色</th>
                <th className="px-4 py-2.5 text-left font-semibold">图案/材质</th>
                <th className="px-4 py-2.5 text-left font-semibold">版型/结构</th>
                <th className="px-4 py-2.5 text-left font-semibold w-28">品类</th>
                <th className="px-4 py-2.5 text-left font-semibold w-48">分类</th>
                <th className="px-4 py-2.5 text-left font-semibold w-24">状态</th>
                <th className="px-4 py-2.5 text-left font-semibold w-44 whitespace-nowrap">创建时间</th>
                <th className="px-4 py-2.5 text-left font-semibold w-28">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && list.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400 text-sm">
                    加载中…
                  </td>
                </tr>
              ) : !loading && list.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400 text-sm">
                    暂无产品
                  </td>
                </tr>
              ) : (
                list.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50 group">
                    <td className="px-4 py-2">
                      {p.imageUrl ? (
                        <img
                          src={withCosThumbnail(p.imageUrl, 64) ?? p.imageUrl}
                          alt={p.name}
                          className="w-12 h-12 object-cover rounded-md border border-slate-200"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center">
                          <span className="material-symbols-outlined text-slate-300 text-lg">image</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-800 font-medium max-w-[180px] truncate" title={p.name}>{p.name}</td>
                    <td className="px-4 py-2 text-slate-600 max-w-[120px] truncate" title={p.color || ''}>{p.color || '—'}</td>
                    <td className="px-4 py-2 text-slate-600 max-w-[180px] truncate" title={p.patternMaterial || ''}>{p.patternMaterial || '—'}</td>
                    <td className="px-4 py-2 text-slate-600 max-w-[180px] truncate" title={p.silhouetteStructure || ''}>{p.silhouetteStructure || '—'}</td>
                    {/* 品类:产品侧自由文本标签(与 product_category 表无关),独立业务定义 */}
                    <td className="px-4 py-2 max-w-[120px]">
                      {p.category ? (
                        <span
                          className="inline-flex items-center rounded bg-slate-100 text-slate-500 text-xs px-1.5 py-0.5 truncate max-w-full"
                          title={p.category}
                        >
                          {p.category}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    {/* 分类:与 product_category 表结构化关联,后端沿祖先链补全保存 */}
                    <td className="px-4 py-2 max-w-[220px]">
                      {p.categories && p.categories.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {p.categories.map((c) => (
                            <span
                              key={c.id}
                              className="inline-flex items-center rounded bg-blue-50 text-primary text-xs px-1.5 py-0.5 truncate max-w-[200px]"
                              title={c.categoryName}
                            >
                              {c.categoryName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ' +
                          (p.status === 'ON_SHELF'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600')
                        }
                      >
                        <span
                          className={
                            'w-1.5 h-1.5 rounded-full ' +
                            (p.status === 'ON_SHELF' ? 'bg-emerald-500' : 'bg-slate-400')
                          }
                        />
                        {p.statusDesc}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-500 text-xs whitespace-nowrap tabular-nums">
                      {p.createTime ? new Date(Number(p.createTime)).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2 text-left">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-primary hover:bg-blue-50 rounded"
                          title="编辑"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="w-7 h-7 flex items-center justify-center text-rose-600 hover:bg-rose-50 rounded"
                          title="删除"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {pageInfo && pageInfo.pages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              共 <span className="font-semibold text-slate-700">{pageInfo.total}</span> 条 · 第{' '}
              <span className="font-semibold text-slate-700">{pageInfo.pageNum}</span> /{' '}
              <span className="font-semibold text-slate-700">{pageInfo.pages}</span> 页
            </div>
            <div className="flex gap-2">
              <button
                className="h-8 px-3 border border-slate-300 bg-white text-slate-700 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                disabled={pageNum <= 1}
                onClick={() => setPageNum((n) => Math.max(1, n - 1))}
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
                上一页
              </button>
              <button
                className="h-8 px-3 border border-slate-300 bg-white text-slate-700 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                disabled={pageNum >= (pageInfo.pages ?? 1)}
                onClick={() => setPageNum((n) => n + 1)}
              >
                下一页
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <ProductFormDrawer
        open={drawerOpen}
        initial={editing}
        onClose={() => setDrawerOpen(false)}
        onSaved={onSaved}
      />
    </div>
  );
}