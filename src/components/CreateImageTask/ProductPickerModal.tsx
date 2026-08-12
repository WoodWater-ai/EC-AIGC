// src/components/CreateImageTask/ProductPickerModal.tsx
// 轻量版"选择产品"picker —— 复用 productInfoApi.list,不依赖完整 ProductManagePage
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import type { ProductDTO, ProductQueryReq, ProductStatus } from '../../api/modules/productInfo';
import { productInfoApi } from '../../api/modules/productInfo';
import { withCosThumbnail } from '../../utils/cosImage';
import { AssetImage } from '../AssetImage';
import type { PageInfo } from '../../api/service-result';

export interface ProductPickerModalProps {
  open: boolean;
  onClose: () => void;
  onPick: (product: ProductDTO) => void;
  onCreate?: () => void;
}

const PAGE_SIZE = 20;

/**
 * 选择产品 modal — 从产品管理表里选一条,回调 onPick(product) 给父容器
 *
 * 设计要点:
 * - 复用 productInfoApi.list,简化版表格(缩略图 + name + 品类 + status)
 * - 不分产品分类(精简为搜索框 + 全表)
 * - 单页 20 条,翻页器用 button 简单 prev/next
 * - 选中行后调 onPick(product) 并自动 onClose
 */
export const ProductPickerModal: React.FC<ProductPickerModalProps> = ({ open, onClose, onPick, onCreate }) => {
  // 搜索栏:输入态(draftKeyword)与触发态(appliedKeyword)分离,只有点"搜索"
  // 或回车 Enter 才提交到 appliedKeyword 触发 fetch;重置按钮清空两个 + 触发 fetch。
  const [draftKeyword, setDraftKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | ''>('ON_SHELF');
  const [pageNum, setPageNum] = useState(1);
  const [pageInfo, setPageInfo] = useState<PageInfo<ProductDTO> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const req: ProductQueryReq = {
          pageNum,
          pageSize: PAGE_SIZE,
          keyword: appliedKeyword.trim() || undefined,
          status: (statusFilter || undefined) as ProductStatus | undefined,
        };
        const page = await productInfoApi.list(req);
        if (!cancelled) setPageInfo(page);
      } catch (err) {
        toast.error(`加载产品失败: ${(err as Error).message}`);
        if (!cancelled) setPageInfo(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, pageNum, appliedKeyword, statusFilter]);

  // 打开时重置输入 + 应用 + 页码
  useEffect(() => {
    if (open) {
      setPageNum(1);
      setDraftKeyword('');
      setAppliedKeyword('');
    }
  }, [open]);

  const handleSearch = () => {
    setPageNum(1);
    setAppliedKeyword(draftKeyword);
  };

  const handleReset = () => {
    setPageNum(1);
    setDraftKeyword('');
    setAppliedKeyword('');
    setStatusFilter('ON_SHELF');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const products = pageInfo?.list ?? [];

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
                <p className="text-[11px] font-bold text-primary">产品库</p>
                <h2 className="text-base font-black text-slate-800">选择产品</h2>
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

            {/* Toolbar */}
            <div className="px-6 py-3 border-b border-slate-200 flex items-center gap-3 shrink-0">
              <div className="relative flex-1 max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                <input
                  type="text"
                  placeholder="搜索产品名称"
                  value={draftKeyword}
                  onChange={(e) => setDraftKeyword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as ProductStatus | ''); setPageNum(1); }}
                className="h-9 px-2 rounded-md border border-slate-200 text-xs font-bold bg-white"
              >
                <option value="">全部状态</option>
                <option value="ON_SHELF">已上架</option>
                <option value="OFF_SHELF">已下架</option>
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
                共 {pageInfo?.total ?? 0} 个
              </span>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { if (p.canCreate !== false) { onPick(p); onClose(); } }}
                      disabled={p.canCreate === false}
                      className="group text-left bg-white border border-slate-200 rounded-lg overflow-hidden hover:border-primary hover:shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-55"
                      title={p.canCreate === false ? (p.unavailableReason || '当前产品暂不可创作') : `选择 ${p.name}`}
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
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between shrink-0 bg-white">
              <div className="text-[10px] text-slate-400">
                第 {(pageInfo?.pageNum ?? 1)} 页 · 共 {pageInfo?.pages ?? 1} 页
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPageNum((p) => Math.max(1, p - 1))}
                  disabled={pageNum <= 1}
                  className="h-8 px-3 text-xs font-bold border border-slate-200 rounded disabled:opacity-40"
                >
                  上一页
                </button>
                <button
                  type="button"
                  onClick={() => setPageNum((p) => (pageInfo && p < pageInfo.pages ? p + 1 : p))}
                  disabled={!pageInfo || pageNum >= pageInfo.pages}
                  className="h-8 px-3 text-xs font-bold border border-slate-200 rounded disabled:opacity-40"
                >
                  下一页
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-8 px-3 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded ml-2"
                >
                  取消
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
