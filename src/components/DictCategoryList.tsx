import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useConfirm } from './common/ConfirmProvider';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  dictApi,
  type DictCategory,
  type DictCategoryCreateRequest,
  type DictCategoryUpdateRequest,
} from '../api/modules/dict';
import type { PageInfo } from '../api/service-result';

/**
 * 字典分类管理 — 列表页
 *
 * <p>视觉风格对齐 ProductManagePage:
 * <ul>
 *   <li>顶部渐变 banner(带 icon + 分类数统计)</li>
 *   <li>卡片化表格容器</li>
 *   <li>行 hover:bg-slate-50</li>
 *   <li>操作列内联 group-hover 显现图标按钮</li>
 *   <li>分页器底部对齐</li>
 * </ul>
 */
export default function DictCategoryList() {
  // ===== 状态 =====
  const [keyword, setKeyword] = useState('');
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(20);
  const [pageInfo, setPageInfo] = useState<PageInfo<DictCategory> | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<DictCategory | null>(null);

  const confirm = useConfirm();

  // ===== 加载 =====
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dictApi.pageCategories({
        pageNum,
        pageSize,
        keyword: keyword || undefined,
      });
      setPageInfo(data);
    } catch {
      // 拦截器已 toast
    } finally {
      setLoading(false);
    }
  }, [pageNum, pageSize, keyword]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNum, pageSize, keyword]);

  // ===== 操作 =====
  function openAdd() {
    setEditing(null);
    setDrawerMode('create');
    setDrawerOpen(true);
  }

  function openEdit(cat: DictCategory) {
    setEditing(cat);
    setDrawerMode('edit');
    setDrawerOpen(true);
  }

  async function handleDelete(cat: DictCategory) {
    const ok = await confirm({
      title: '删除字典分类',
      message: (
        <div className="space-y-1">
          <div>确认删除字典分类「{cat.categoryName}」?</div>
          <div className="text-slate-400">该操作会被软删除(is_delete='Y'),已删除分类不再出现在下拉列表。</div>
        </div>
      ),
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await dictApi.deleteCategory(cat.id);
      toast.success('删除成功');
      load();
    } catch {
      // 拦截器已 toast
    }
  }

  function resetFilter() {
    setKeyword('');
    setPageNum(1);
  }

  // ===== 渲染 =====
  return (
    <div className="p-6 md:p-8 space-y-4">
      <Banner count={pageInfo?.total ?? 0} />
      <FilterBar
        keyword={keyword}
        setKeyword={setKeyword}
        onSearch={() => setPageNum(1)}
        onReset={resetFilter}
        onAdd={openAdd}
      />
      <CategoryTable
        list={pageInfo?.list ?? []}
        loading={loading}
        onEdit={openEdit}
        onDelete={handleDelete}
      />
      {pageInfo && pageInfo.pages > 1 && (
        <Pagination pageInfo={pageInfo} setPageNum={setPageNum} />
      )}
      {drawerOpen && (
        <CategoryDrawer
          mode={drawerMode}
          editing={editing}
          submitting={submitting}
          onClose={() => setDrawerOpen(false)}
          onSaved={() => {
            setDrawerOpen(false);
            load();
          }}
          onSubmittingChange={setSubmitting}
        />
      )}
    </div>
  );
}

// ==================== Banner ====================
function Banner({ count }: { count: number }) {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0256FF] to-[#3B82F6] flex items-center justify-center shadow-lg shadow-blue-500/20">
          <span className="material-symbols-outlined text-white text-xl">dataset</span>
        </div>
        <div>
          <h2 className="font-bold text-text-main text-base">字典分类管理</h2>
          <p className="text-xs text-text-muted mt-0.5">管理任务类型、风格、场景等字典分类</p>
        </div>
      </div>
      <div className="text-xs text-text-muted">
        共 <span className="text-primary font-bold text-sm">{count}</span> 个分类
      </div>
    </div>
  );
}

// ==================== FilterBar ====================
interface FilterBarProps {
  keyword: string;
  setKeyword: (v: string) => void;
  onSearch: () => void;
  onReset: () => void;
  onAdd: () => void;
}
function FilterBar({ keyword, setKeyword, onSearch, onReset, onAdd }: FilterBarProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 min-w-[240px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="搜索分类编码或名称..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
        />
      </div>
      <button
        onClick={onSearch}
        className="h-9 px-4 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90"
      >
        查询
      </button>
      <button
        onClick={onReset}
        className="h-9 px-4 border border-slate-200 bg-white text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 flex items-center gap-1.5"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        重置
      </button>
      <button
        onClick={onAdd}
        className="h-9 px-4 bg-gradient-to-r from-primary to-blue-500 text-white text-xs font-semibold rounded-lg hover:from-primary/90 hover:to-blue-600 flex items-center gap-1.5 ml-auto"
      >
        <Plus className="w-4 h-4" />
        新建分类
      </button>
    </div>
  );
}

// ==================== CategoryTable ====================
interface CategoryTableProps {
  list: DictCategory[];
  loading: boolean;
  onEdit: (cat: DictCategory) => void;
  onDelete: (cat: DictCategory) => Promise<void>;
}
function CategoryTable({ list, loading, onEdit, onDelete }: CategoryTableProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {loading ? (
        <div className="p-12 text-center text-sm text-text-muted">加载中...</div>
      ) : list.length === 0 ? (
        <div className="p-12 text-center">
          <div className="text-text-muted text-sm mb-2">暂无数据</div>
          <div className="text-slate-400 text-xs">点击右上角「新建分类」开始</div>
        </div>
      ) : (
        <table className="w-full">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">ID</th>
              <th className="px-4 py-3 text-left font-semibold">分类编码</th>
              <th className="px-4 py-3 text-left font-semibold">分类名称</th>
              <th className="px-4 py-3 text-left font-semibold">排序</th>
              <th className="px-4 py-3 text-right font-semibold w-32">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((cat) => (
              <tr key={cat.id} className="hover:bg-slate-50 group">
                <td className="px-4 py-3 text-xs text-slate-400 font-mono">{cat.id}</td>
                <td className="px-4 py-3 text-sm font-mono font-semibold text-text-main">{cat.categoryCode}</td>
                <td className="px-4 py-3 text-sm text-text-main">{cat.categoryName}</td>
                <td className="px-4 py-3 text-sm text-text-muted">{cat.sort ?? 0}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEdit(cat)}
                      className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/5 rounded"
                      title="编辑"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(cat)}
                      className="p-1.5 text-slate-500 hover:text-danger hover:bg-danger/5 rounded"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ==================== Pagination ====================
function Pagination({ pageInfo, setPageNum }: { pageInfo: PageInfo<DictCategory>; setPageNum: (n: number) => void }) {
  return (
    <div className="flex items-center justify-end gap-2 text-xs text-text-muted px-2">
      <span>共 {pageInfo.total} 条 / 第 {pageInfo.pageNum} / {pageInfo.pages} 页</span>
      <button
        onClick={() => setPageNum(pageInfo.pageNum - 1)}
        disabled={!pageInfo.hasPreviousPage}
        className="h-8 px-3 border border-slate-200 bg-white rounded-lg disabled:opacity-50 hover:bg-slate-50"
      >
        上一页
      </button>
      <button
        onClick={() => setPageNum(pageInfo.pageNum + 1)}
        disabled={!pageInfo.hasNextPage}
        className="h-8 px-3 border border-slate-200 bg-white rounded-lg disabled:opacity-50 hover:bg-slate-50"
      >
        下一页
      </button>
    </div>
  );
}

// ==================== CategoryDrawer ====================
interface CategoryDrawerProps {
  mode: 'create' | 'edit';
  editing: DictCategory | null;
  submitting: boolean;
  onClose: () => void;
  onSaved: () => void;
  onSubmittingChange: (v: boolean) => void;
}

const CATEGORY_CODE_RE = /^[A-Z][A-Z0-9_]{1,31}$/;

function CategoryDrawer({ mode, editing, submitting, onClose, onSaved, onSubmittingChange }: CategoryDrawerProps) {
  const [categoryCode, setCategoryCode] = useState(mode === 'create' ? '' : editing?.categoryCode ?? '');
  const [categoryName, setCategoryName] = useState(mode === 'create' ? '' : editing?.categoryName ?? '');
  const [sort, setSort] = useState<number>(mode === 'create' ? 0 : editing?.sort ?? 0);

  const codeValid = mode === 'edit' || (categoryCode.length > 0 && CATEGORY_CODE_RE.test(categoryCode));
  const nameValid = categoryName.trim().length > 0;
  const canSubmit = codeValid && nameValid && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    onSubmittingChange(true);
    try {
      if (mode === 'create') {
        const req: DictCategoryCreateRequest = { categoryCode, categoryName, sort };
        await dictApi.createCategory(req);
      } else if (editing) {
        const req: DictCategoryUpdateRequest = { id: editing.id, categoryName, sort };
        await dictApi.updateCategory(req);
      }
      toast.success(mode === 'create' ? '新建成功' : '保存成功');
      onSaved();
    } catch {
      // 拦截器已 toast
    } finally {
      onSubmittingChange(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-[#0B1C30]/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative ml-auto bg-white w-[480px] max-w-[90vw] h-full flex flex-col shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-text-main text-sm">
            {mode === 'create' ? '新建字典分类' : '编辑字典分类'}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {mode === 'create' && (
            <FormField label="分类编码" required error={categoryCode && !codeValid ? '编码必须以大写字母开头,长度 2-32' : undefined}>
              <input
                type="text"
                value={categoryCode}
                onChange={(e) => setCategoryCode(e.target.value.toUpperCase())}
                placeholder="例:STYLE_INDUSTRIAL"
                className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </FormField>
          )}
          <FormField label="分类名称" required>
            <input
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="例:工业风"
              className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </FormField>
          <FormField label="排序" hint="整数,数字越小排序越靠前,留空使用默认值 0">
            <input
              type="number"
              step={1}
              min={-2147483648}
              max={2147483647}
              value={sort}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') { setSort(0); return; }
                // 去掉非整数字符(e/E/+/-/. 等),并四舍五入到整数
                const n = Math.trunc(Number(v));
                if (Number.isFinite(n)) setSort(n);
              }}
              className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </FormField>
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-9 px-4 border border-slate-200 bg-white text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-9 px-4 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '提交中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}
function FormField({ label, required, error, hint, children }: FormFieldProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-danger ml-1">*</span>}
      </label>
      {children}
      {hint && !error && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
      {error && <div className="text-xs text-danger mt-1">{error}</div>}
    </div>
  );
}
