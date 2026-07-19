import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useConfirm } from './common/ConfirmProvider';
import {
  Plus,
  Edit,
  Search,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  dictApi,
  type DictCategory,
  type DictItem,
  type DictItemStatus,
  type DictItemCreateRequest,
  type DictItemUpdateRequest,
} from '../api/modules/dict';
import type { PageInfo } from '../api/service-result';

/**
 * 字典管理(字典项) — 列表页
 *
 * <p>视觉风格对齐 DictCategoryList:
 * <ul>
 *   <li>顶部渐变 banner(带 icon + 项数统计)</li>
 *   <li>卡片化表格容器</li>
 *   <li>分类列渲染:从 categoryNameMap 取,缺失显示 "已删除 (id=xxx)" 占位</li>
 *   <li>status 列:绿色"启用" / 灰色"已停用"</li>
 *   <li>操作列:编辑 + 启停用切换(根据当前 status 决定文案)</li>
 * </ul>
 */
export default function DictItemList() {
  // ===== 状态 =====
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<DictItemStatus | ''>('');
  const [keyword, setKeyword] = useState('');
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(20);
  const [pageInfo, setPageInfo] = useState<PageInfo<DictItem> | null>(null);
  const [categories, setCategories] = useState<DictCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<DictItem | null>(null);

  const confirm = useConfirm();

  // ===== 分类下拉(进入页面一次性拉全) =====
  useEffect(() => {
    void dictApi.listCategories().then(setCategories).catch(() => {});
  }, []);

  // ===== 分类名 Map(用于表格列渲染) =====
  const categoryNameMap = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c) => m.set(c.id, c.categoryName));
    return m;
  }, [categories]);

  function renderCategoryName(item: DictItem): string {
    return categoryNameMap.get(item.categoryId) ?? `已删除 (id=${item.categoryId})`;
  }

  // ===== 加载 =====
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dictApi.pageItems({
        pageNum,
        pageSize,
        categoryId: categoryFilter || undefined,
        keyword: keyword || undefined,
        status: statusFilter || undefined,
      });
      setPageInfo(data);
    } catch {
      // 拦截器已 toast
    } finally {
      setLoading(false);
    }
  }, [pageNum, pageSize, categoryFilter, keyword, statusFilter]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNum, pageSize, categoryFilter, keyword, statusFilter]);

  // ===== 操作 =====
  function openAdd() {
    setEditing(null);
    setDrawerMode('create');
    setDrawerOpen(true);
  }

  function openEdit(item: DictItem) {
    setEditing(item);
    setDrawerMode('edit');
    setDrawerOpen(true);
  }

  async function handleChangeStatus(item: DictItem) {
    const next: DictItemStatus = item.status === 'NORMAL' ? 'DISABLED' : 'NORMAL';
    const verb = next === 'DISABLED' ? '停用' : '启用';
    const ok = await confirm({
      title: `${verb}字典项`,
      message: (
        <div className="space-y-1">
          <div>确认{verb}字典项「{item.itemName}」?</div>
          {next === 'DISABLED' && (
            <div className="text-slate-400">{verb}后该项不再出现在下拉列表,模板中心相关字典引用将自动隐藏。</div>
          )}
        </div>
      ),
      confirmText: verb,
      danger: next === 'DISABLED',
    });
    if (!ok) return;
    try {
      await dictApi.changeItemStatus({ id: item.id, status: next });
      toast.success(`${verb}成功`);
      load();
    } catch {
      // 拦截器已 toast
    }
  }

  function resetFilter() {
    setCategoryFilter('');
    setStatusFilter('');
    setKeyword('');
    setPageNum(1);
  }

  // ===== 渲染 =====
  return (
    <div className="p-6 md:p-8 space-y-4">
      <Banner count={pageInfo?.total ?? 0} />
      <FilterBar
        categories={categories}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        keyword={keyword}
        setKeyword={setKeyword}
        onSearch={() => setPageNum(1)}
        onReset={resetFilter}
        onAdd={openAdd}
      />
      <ItemTable
        list={pageInfo?.list ?? []}
        loading={loading}
        renderCategoryName={renderCategoryName}
        onEdit={openEdit}
        onChangeStatus={handleChangeStatus}
      />
      {pageInfo && pageInfo.pages > 1 && (
        <Pagination pageInfo={pageInfo} setPageNum={setPageNum} />
      )}
      {drawerOpen && (
        <ItemDrawer
          mode={drawerMode}
          editing={editing}
          categories={categories}
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
    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <span className="material-symbols-outlined text-white text-xl">menu_book</span>
        </div>
        <div>
          <h2 className="font-bold text-text-main text-base">字典管理</h2>
          <p className="text-xs text-text-muted mt-0.5">管理任务类型、风格、场景等字典项</p>
        </div>
      </div>
      <div className="text-xs text-text-muted">
        共 <span className="text-emerald-600 font-bold text-sm">{count}</span> 个字典项
      </div>
    </div>
  );
}

// ==================== FilterBar ====================
interface FilterBarProps {
  categories: DictCategory[];
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  statusFilter: DictItemStatus | '';
  setStatusFilter: (v: DictItemStatus | '') => void;
  keyword: string;
  setKeyword: (v: string) => void;
  onSearch: () => void;
  onReset: () => void;
  onAdd: () => void;
}
function FilterBar(p: FilterBarProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 flex-wrap">
      <select
        value={p.categoryFilter}
        onChange={(e) => p.setCategoryFilter(e.target.value)}
        className="h-9 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-primary"
      >
        <option value="">全部分类</option>
        {p.categories.map((c) => (
          <option key={c.id} value={c.id}>{c.categoryName}</option>
        ))}
      </select>
      <select
        value={p.statusFilter}
        onChange={(e) => p.setStatusFilter(e.target.value as DictItemStatus | '')}
        className="h-9 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-primary"
      >
        <option value="">全部状态</option>
        <option value="NORMAL">启用</option>
        <option value="DISABLED">已停用</option>
      </select>
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="搜索字典项编码或名称..."
          value={p.keyword}
          onChange={(e) => p.setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && p.onSearch()}
          className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
        />
      </div>
      <button
        onClick={p.onSearch}
        className="h-9 px-4 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90"
      >
        查询
      </button>
      <button
        onClick={p.onReset}
        className="h-9 px-4 border border-slate-200 bg-white text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 flex items-center gap-1.5"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        重置
      </button>
      <button
        onClick={p.onAdd}
        className="h-9 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold rounded-lg hover:from-emerald-600 hover:to-teal-600 flex items-center gap-1.5 ml-auto"
      >
        <Plus className="w-4 h-4" />
        新建字典项
      </button>
    </div>
  );
}

// ==================== ItemTable ====================
interface ItemTableProps {
  list: DictItem[];
  loading: boolean;
  renderCategoryName: (item: DictItem) => string;
  onEdit: (item: DictItem) => void;
  onChangeStatus: (item: DictItem) => Promise<void>;
}
function ItemTable({ list, loading, renderCategoryName, onEdit, onChangeStatus }: ItemTableProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {loading ? (
        <div className="p-12 text-center text-sm text-text-muted">加载中...</div>
      ) : list.length === 0 ? (
        <div className="p-12 text-center">
          <div className="text-text-muted text-sm mb-2">暂无数据</div>
          <div className="text-slate-400 text-xs">点击右上角「新建字典项」开始</div>
        </div>
      ) : (
        <table className="w-full">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">ID</th>
              <th className="px-4 py-3 text-left font-semibold">分类</th>
              <th className="px-4 py-3 text-left font-semibold">字典项编码</th>
              <th className="px-4 py-3 text-left font-semibold">字典项名称</th>
              <th className="px-4 py-3 text-left font-semibold">描述</th>
              <th className="px-4 py-3 text-left font-semibold">排序</th>
              <th className="px-4 py-3 text-left font-semibold">状态</th>
              <th className="px-4 py-3 text-right font-semibold w-32">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 group">
                <td className="px-4 py-3 text-xs text-slate-400 font-mono">{item.id}</td>
                <td className="px-4 py-3 text-sm text-text-main">{renderCategoryName(item)}</td>
                <td className="px-4 py-3 text-sm font-mono font-semibold text-text-main">{item.itemCode}</td>
                <td className="px-4 py-3 text-sm text-text-main">{item.itemName}</td>
                <td className="px-4 py-3 text-sm text-text-muted">{item.describe || '-'}</td>
                <td className="px-4 py-3 text-sm text-text-muted">{item.sort ?? 0}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEdit(item)}
                      className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/5 rounded"
                      title="编辑"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onChangeStatus(item)}
                      className={`px-2 py-1 text-xs font-semibold rounded ${
                        item.status === 'NORMAL'
                          ? 'text-slate-500 hover:text-danger hover:bg-danger/5'
                          : 'text-slate-500 hover:text-success hover:bg-success/5'
                      }`}
                      title={item.status === 'NORMAL' ? '停用' : '启用'}
                    >
                      {item.status === 'NORMAL' ? '停用' : '启用'}
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

function StatusBadge({ status }: { status: DictItemStatus }) {
  if (status === 'NORMAL') {
    return <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded">启用</span>;
  }
  return <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-semibold rounded">已停用</span>;
}

// ==================== Pagination ====================
function Pagination({ pageInfo, setPageNum }: { pageInfo: PageInfo<DictItem>; setPageNum: (n: number) => void }) {
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

// ==================== ItemDrawer ====================
interface ItemDrawerProps {
  mode: 'create' | 'edit';
  editing: DictItem | null;
  categories: DictCategory[];
  submitting: boolean;
  onClose: () => void;
  onSaved: () => void;
  onSubmittingChange: (v: boolean) => void;
}

const ITEM_CODE_RE = /^[A-Z][A-Z0-9_]{1,63}$/;

function ItemDrawer({ mode, editing, categories, submitting, onClose, onSaved, onSubmittingChange }: ItemDrawerProps) {
  const [categoryId, setCategoryId] = useState(mode === 'create' ? '' : editing?.categoryId ?? '');
  const [itemCode, setItemCode] = useState(mode === 'create' ? '' : editing?.itemCode ?? '');
  const [itemName, setItemName] = useState(mode === 'create' ? '' : editing?.itemName ?? '');
  const [describe, setDescribe] = useState(mode === 'create' ? '' : editing?.describe ?? '');
  const [sort, setSort] = useState<number>(mode === 'create' ? 0 : editing?.sort ?? 0);

  const codeValid = mode === 'edit' || (itemCode.length > 0 && ITEM_CODE_RE.test(itemCode));
  const nameValid = itemName.trim().length > 0;
  const categoryValid = mode === 'edit' || categoryId.length > 0;
  const canSubmit = codeValid && nameValid && categoryValid && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    onSubmittingChange(true);
    try {
      if (mode === 'create') {
        const req: DictItemCreateRequest = { categoryId, itemCode, itemName, describe, sort };
        await dictApi.createItem(req);
      } else if (editing) {
        const req: DictItemUpdateRequest = { id: editing.id, itemName, describe, sort };
        await dictApi.updateItem(req);
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
            {mode === 'create' ? '新建字典项' : '编辑字典项'}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {mode === 'create' && (
            <>
              <FormField label="所属分类" required error={categoryId === '' ? undefined : (!categoryValid ? '请选择分类' : undefined)}>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-primary"
                >
                  <option value="">请选择分类</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.categoryName}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="字典项编码" required error={itemCode && !codeValid ? '编码必须以大写字母开头,长度 2-64' : undefined}>
                <input
                  type="text"
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value.toUpperCase())}
                  placeholder="例:STYLE_INDUSTRIAL"
                  className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </FormField>
            </>
          )}
          <FormField label="字典项名称" required>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="例:工业风"
              className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </FormField>
          <FormField label="描述">
            <textarea
              value={describe}
              onChange={(e) => setDescribe(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 resize-none"
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
                // 去掉非整数字符(e/E/+/-/. 等),并截断到整数
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
            className="h-9 px-4 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
