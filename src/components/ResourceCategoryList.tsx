import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Info,
  Plus,
  Edit,
  Trash2,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Tag,
  Hash,
  User,
  Lock,
  Globe,
  Image as ImageIcon,
  Video as VideoIcon,
  Layers,
  Building2,
  FileText,
  ArrowUpDown,
  X,
  Check,
} from 'lucide-react';
import {
  assetCategoryApi,
  type AssetCategoryNode,
  type AssetCategoryCreateRequest,
  type AssetCategoryUpdateRequest,
} from '../api/modules/assetCategory';
import type { AppScreen } from '../types';

interface ResourceCategoryListProps {
  setScreen: (screen: AppScreen) => void;
}

/** Drawer 模式:create(新增) / edit(编辑) */
type DrawerMode = 'create' | 'edit';

/** Drawer 表单数据(独立于请求 DTO,便于脏检测) */
interface DrawerFormData {
  categoryName: string;
  categoryCode: string;
  categoryKind: 'IMAGE' | 'VIDEO' | 'MIXED';
  description: string;
  sort: number;
  isPublic: 'Y' | 'N';
}

const EMPTY_FORM: DrawerFormData = {
  categoryName: '',
  categoryCode: '',
  categoryKind: 'IMAGE',
  description: '',
  sort: 0,
  isPublic: 'N',
};

// =====================================================================
// 工具函数(模块顶部,组件外)
// =====================================================================

/** 在嵌套树中按 id 递归查找节点 */
function findNode(
  tree: AssetCategoryNode[],
  id: number | null,
): AssetCategoryNode | null {
  if (id === null) return null;
  for (const node of tree) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/** 统计树中节点总数 */
function countNodes(tree: AssetCategoryNode[]): number {
  let count = 0;
  for (const node of tree) {
    count += 1;
    if (node.children) {
      count += countNodes(node.children);
    }
  }
  return count;
}

// =====================================================================
// 内部子组件: TreeNode(递归树节点)
// =====================================================================

interface TreeNodeProps {
  node: AssetCategoryNode;
  depth: number;
  selectedId: number | null;
  expandedIds: Set<number>;
  onSelect: (id: number) => void;
  onToggleExpand: (id: number) => void;
  onAddChild: (parentId: number) => void;
  onEdit: (node: AssetCategoryNode) => void;
  onDelete: (node: AssetCategoryNode) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  depth,
  selectedId,
  expandedIds,
  onSelect,
  onToggleExpand,
  onAddChild,
  onEdit,
  onDelete,
}) => {
  const hasChildren = !!node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const isPublic = node.isPublic === 'Y';

  return (
    <div>
      <div
        onClick={() => onSelect(node.id)}
        className={`group flex items-center gap-1.5 py-1.5 px-2 rounded-md cursor-pointer text-xs font-medium transition-all ${
          isSelected
            ? 'bg-blue-50 text-blue-600'
            : 'text-slate-700 hover:bg-slate-50'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        id={`tree-node-${node.id}`}
      >
        {/* 展开/折叠箭头 */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            className="shrink-0 w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        ) : (
          <span className="shrink-0 w-4 h-4" />
        )}

        {/* 文件夹图标 */}
        {isExpanded && hasChildren ? (
          <FolderOpen className="shrink-0 w-3.5 h-3.5 text-amber-500" />
        ) : (
          <Folder className={`shrink-0 w-3.5 h-3.5 ${isSelected ? 'text-blue-500' : 'text-slate-400'}`} />
        )}

        {/* 名称 */}
        <span className="flex-1 truncate font-bold">{node.categoryName}</span>

        {/* 公开/私有徽标 */}
        {isPublic ? (
          <Globe className="shrink-0 w-3 h-3 text-emerald-500" />
        ) : (
          <Lock className="shrink-0 w-3 h-3 text-slate-300" />
        )}

        {/* 类型徽标 */}
        {node.categoryKind === 'VIDEO' ? (
          <VideoIcon className="shrink-0 w-3 h-3 text-purple-400" />
        ) : node.categoryKind === 'MIXED' ? (
          <Layers className="shrink-0 w-3 h-3 text-indigo-400" />
        ) : (
          <ImageIcon className="shrink-0 w-3 h-3 text-blue-400" />
        )}

        {/* hover 操作图标(默认 opacity-0) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(node.id);
            }}
            title="添加子分类"
            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"
          >
            <Plus className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(node);
            }}
            title="编辑"
            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
          >
            <Edit className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node);
            }}
            title="删除"
            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 递归渲染子节点 */}
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// =====================================================================
// 内部子组件: CategoryDetailPanel(右侧详情面板)
// =====================================================================

interface CategoryDetailPanelProps {
  node: AssetCategoryNode;
  parentName: string | null;
  onEdit: () => void;
  onAddChild: () => void;
  onDelete: () => void;
}

const CategoryDetailPanel: React.FC<CategoryDetailPanelProps> = ({
  node,
  parentName,
  onEdit,
  onAddChild,
  onDelete,
}) => {
  const isPublic = node.isPublic === 'Y';
  const kind = node.categoryKind ?? 'IMAGE';
  const KindIcon =
    kind === 'VIDEO' ? VideoIcon : kind === 'MIXED' ? Layers : ImageIcon;
  const kindLabel = kind === 'IMAGE' ? '图片' : kind === 'VIDEO' ? '视频' : '混合';

  return (
    <div className="p-6 space-y-5 overflow-y-auto" id="category-detail-panel">
      {/* 标题 + 类型徽标 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-50 text-blue-600 border border-blue-100 font-mono">
              ID #{node.id}
            </span>
            {isPublic ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100">
                <Globe className="w-3 h-3" />
                公开
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
                <Lock className="w-3 h-3" />
                私有
              </span>
            )}
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-600 border border-indigo-100">
              <KindIcon className="w-3 h-3" />
              {kindLabel}
            </span>
          </div>
          <h2 className="text-lg font-extrabold text-slate-800 break-all">
            {node.categoryName}
          </h2>
          {node.categoryCode && (
            <p className="text-[10px] text-slate-400 font-mono mt-1">
              编码: {node.categoryCode}
            </p>
          )}
        </div>
      </div>

      {/* 详情字段卡 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-4">
          {/* 父分类 */}
          <div>
            <p className="text-[10px] text-slate-400 font-bold mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              父分类
            </p>
            <p className="text-xs font-bold text-slate-700">
              {parentName ?? <span className="text-slate-400 font-medium">顶级分类</span>}
            </p>
          </div>

          {/* 排序 */}
          <div>
            <p className="text-[10px] text-slate-400 font-bold mb-1 flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3" />
              排序
            </p>
            <p className="text-xs font-bold text-slate-700 font-mono">
              {node.sort ?? 0}
            </p>
          </div>

          {/* 创建人 */}
          <div>
            <p className="text-[10px] text-slate-400 font-bold mb-1 flex items-center gap-1">
              <User className="w-3 h-3" />
              创建人 ID
            </p>
            <p className="text-xs font-bold text-slate-700 font-mono">
              {node.ownerUserId ?? <span className="text-slate-400">-</span>}
            </p>
          </div>

          {/* 子分类数 */}
          <div>
            <p className="text-[10px] text-slate-400 font-bold mb-1 flex items-center gap-1">
              <Folder className="w-3 h-3" />
              子分类数
            </p>
            <p className="text-xs font-bold text-slate-700 font-mono">
              {node.children?.length ?? 0}
            </p>
          </div>
        </div>

        {/* 描述(独立一行) */}
        {node.description && (
          <div className="pt-3 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 font-bold mb-1 flex items-center gap-1">
              <FileText className="w-3 h-3" />
              分类描述
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              {node.description}
            </p>
          </div>
        )}
      </div>

      {/* 主操作按钮区 */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-4 h-9 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer shadow-sm"
          id="btn-detail-edit"
        >
          <Edit className="w-3.5 h-3.5" />
          编辑
        </button>
        <button
          onClick={onAddChild}
          className="flex items-center gap-1.5 px-4 h-9 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
          id="btn-detail-add-child"
        >
          <Plus className="w-3.5 h-3.5" />
          添加子分类
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-4 h-9 bg-white border border-rose-200 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-50 transition-colors cursor-pointer ml-auto"
          id="btn-detail-delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
          删除
        </button>
      </div>

      {/* 提示:不能修改的字段 */}
      <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[10px] text-amber-700 leading-relaxed font-medium">
          分类类型(图片/视频/混合)和父分类在创建后不可修改,这是为了保证资源关联的稳定性。如需调整,请删除后重新创建。
        </p>
      </div>
    </div>
  );
};

// =====================================================================
// 内部子组件: CategoryDrawer(右侧抽屉表单)
// =====================================================================

interface CategoryDrawerProps {
  open: boolean;
  mode: DrawerMode;
  /** 编辑时传入,创建时为 null */
  editingNode: AssetCategoryNode | null;
  /** 创建模式下的默认 parentId(顶级为 0) */
  defaultParentId: number;
  /** 父分类名称(显示用,创建子分类时展示) */
  parentName: string;
  /** 是否有未保存修改(父组件追踪,关闭前判断) */
  dirty: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onClose: () => void;
  onSubmit: (form: DrawerFormData) => Promise<void>;
}

const CategoryDrawer: React.FC<CategoryDrawerProps> = ({
  open,
  mode,
  editingNode,
  defaultParentId,
  parentName,
  dirty,
  onDirtyChange,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] = useState<DrawerFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [showError, setShowError] = useState(false);

  // 进入 Drawer 时初始化表单
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && editingNode) {
      setForm({
        categoryName: editingNode.categoryName ?? '',
        categoryCode: editingNode.categoryCode ?? '',
        categoryKind: (editingNode.categoryKind as 'IMAGE' | 'VIDEO' | 'MIXED') ?? 'IMAGE',
        description: editingNode.description ?? '',
        sort: editingNode.sort ?? 0,
        isPublic: (editingNode.isPublic as 'Y' | 'N') ?? 'N',
      });
    } else {
      setForm({ ...EMPTY_FORM, sort: 0 });
    }
    onDirtyChange(false);
    setShowError(false);
  }, [open, mode, editingNode, onDirtyChange]);

  // 表单变更 → 标脏
  const updateField = <K extends keyof DrawerFormData>(
    key: K,
    value: DrawerFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    onDirtyChange(true);
    setShowError(false);
  };

  // 关闭前脏检测
  const handleClose = () => {
    if (dirty) {
      const confirmed = window.confirm('有未保存的修改,确认关闭?');
      if (!confirmed) return;
    }
    onClose();
  };

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dirty, submitting]);

  const handleSubmit = async () => {
    if (!form.categoryName.trim()) {
      setShowError(true);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(form);
      onDirtyChange(false);
    } catch {
      // axios 拦截器已 toast
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const isEdit = mode === 'edit';
  const title = isEdit ? '编辑资源分类' : '新建资源分类';
  const parentLabel =
    defaultParentId === 0
      ? '顶级分类(无父级)'
      : `父分类: ${parentName || `#${defaultParentId}`}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-end animate-fadeIn"
      onClick={() => !submitting && handleClose()}
    >
      <div
        className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        id="category-drawer"
      >
        {/* Header */}
        <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-slate-800">{title}</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">{parentLabel}</p>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* 错误提示条 */}
          {showError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-600 font-bold">
              分类名称不能为空
            </div>
          )}

          {/* 名称(必填) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              分类名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.categoryName}
              onChange={(e) => updateField('categoryName', e.target.value)}
              maxLength={50}
              placeholder="例如:美妆护肤"
              disabled={submitting}
              className="w-full h-9 px-3 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-slate-50"
              id="drawer-categoryName"
            />
          </div>

          {/* 编码(可选) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Hash className="w-3.5 h-3.5 text-slate-400" />
              分类编码 <span className="text-slate-400 font-normal">(可选,唯一)</span>
            </label>
            <input
              type="text"
              value={form.categoryCode}
              onChange={(e) => updateField('categoryCode', e.target.value)}
              maxLength={50}
              placeholder="例如:BEAUTY_SKINCARE"
              disabled={submitting}
              className="w-full h-9 px-3 border border-slate-200 rounded-lg text-xs font-mono font-medium outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-slate-50 uppercase"
              id="drawer-categoryCode"
            />
          </div>

          {/* 类型(创建时显示,编辑时锁定) */}
          {mode === 'create' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                分类类型
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['IMAGE', 'VIDEO', 'MIXED'] as const).map((kind) => {
                  const isActive = form.categoryKind === kind;
                  const Icon =
                    kind === 'IMAGE' ? ImageIcon : kind === 'VIDEO' ? VideoIcon : Layers;
                  const label = kind === 'IMAGE' ? '图片' : kind === 'VIDEO' ? '视频' : '混合';
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => updateField('categoryKind', kind)}
                      disabled={submitting}
                      className={`flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'border-blue-500 bg-blue-50 text-blue-600'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {mode === 'edit' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                分类类型 <span className="text-slate-400 font-normal">(创建后不可修改)</span>
              </label>
              <div className="h-9 px-3 border border-slate-200 rounded-lg bg-slate-50 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                {form.categoryKind === 'VIDEO' ? (
                  <VideoIcon className="w-3.5 h-3.5" />
                ) : form.categoryKind === 'MIXED' ? (
                  <Layers className="w-3.5 h-3.5" />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5" />
                )}
                {form.categoryKind === 'IMAGE'
                  ? '图片'
                  : form.categoryKind === 'VIDEO'
                    ? '视频'
                    : '混合'}
              </div>
            </div>
          )}

          {/* 公开性 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              {form.isPublic === 'Y' ? (
                <Globe className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-slate-400" />
              )}
              可见性
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateField('isPublic', 'N')}
                disabled={submitting}
                className={`flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  form.isPublic === 'N'
                    ? 'border-slate-500 bg-slate-50 text-slate-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                私有(仅自己)
              </button>
              <button
                type="button"
                onClick={() => updateField('isPublic', 'Y')}
                disabled={submitting}
                className={`flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  form.isPublic === 'Y'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                公开(全员可见)
              </button>
            </div>
          </div>

          {/* 描述 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              分类描述 <span className="text-slate-400 font-normal">(可选)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="用一句话说明这个分类的用途..."
              disabled={submitting}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none disabled:bg-slate-50"
              id="drawer-description"
            />
          </div>

          {/* 排序 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              排序 <span className="text-slate-400 font-normal">(数字越小越靠前)</span>
            </label>
            <input
              type="number"
              value={form.sort}
              onChange={(e) => updateField('sort', parseInt(e.target.value || '0', 10))}
              disabled={submitting}
              className="w-full h-9 px-3 border border-slate-200 rounded-lg text-xs font-mono font-medium outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-slate-50"
              id="drawer-sort"
            />
          </div>
        </div>

        {/* Footer */}
        <footer className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button
            onClick={handleClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !form.categoryName.trim()}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white text-xs font-extrabold hover:bg-blue-700 hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            id="drawer-submit"
          >
            {submitting ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                保存中...
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                保存
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
};

// =====================================================================
// 主组件: ResourceCategoryList
// =====================================================================

export const ResourceCategoryList: React.FC<ResourceCategoryListProps> = ({
  setScreen: _setScreen,
}) => {
  // ---------- state ----------
  const [tree, setTree] = useState<AssetCategoryNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('create');
  const [drawerDefaultParentId, setDrawerDefaultParentId] = useState<number>(0);
  const [drawerEditingNode, setDrawerEditingNode] = useState<AssetCategoryNode | null>(null);
  const [drawerDirty, setDrawerDirty] = useState(false);

  // 进入页面首次加载
  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 拉取最新树,可选自动选中/展开 */
  const refetch = useCallback(async (selectIdAfter?: number, expandIdAfter?: number) => {
    setLoading(true);
    try {
      const fresh = await assetCategoryApi.tree();
      setTree(fresh);
      if (selectIdAfter !== undefined) {
        setSelectedId(selectIdAfter);
        // 自动展开新节点的父节点
        const newNode = findNode(fresh, selectIdAfter);
        if (newNode?.parentId && newNode.parentId !== 0) {
          setExpandedIds((prev) => {
            const next = new Set(prev);
            next.add(newNode.parentId!);
            return next;
          });
        }
      } else if (selectedId !== null) {
        // 常规 refetch(无 selectIdAfter):如果当前选中的节点已被删除/不存在了,自动清空选中,避免悬空引用
        if (findNode(fresh, selectedId) === null) {
          setSelectedId(null);
        }
      }
      if (expandIdAfter !== undefined) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          next.add(expandIdAfter);
          return next;
        });
      }
    } catch {
      // axios 拦截器已 toast
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  // ---------- handlers ----------

  const handleSelect = (id: number) => {
    setSelectedId(id);
  };

  const handleToggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAddRoot = () => {
    setDrawerMode('create');
    setDrawerDefaultParentId(0);
    setDrawerEditingNode(null);
    setDrawerOpen(true);
  };

  const handleAddChild = (parentId: number) => {
    setDrawerMode('create');
    setDrawerDefaultParentId(parentId);
    setDrawerEditingNode(null);
    setDrawerOpen(true);
    // 自动展开父节点,这样用户能立即看到新创建的子节点
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(parentId);
      return next;
    });
  };

  const handleEdit = (node: AssetCategoryNode) => {
    setDrawerMode('edit');
    setDrawerEditingNode(node);
    setDrawerDefaultParentId(node.parentId);
    setDrawerOpen(true);
  };

  const handleDelete = async (node: AssetCategoryNode) => {
    const confirmed = window.confirm(
      `确认要删除分类「${node.categoryName}」吗?此操作不可恢复。`,
    );
    if (!confirmed) return;
    try {
      await assetCategoryApi.delete(node.id);
      toast.success(`分类「${node.categoryName}」已删除`);
      // 如果删的是当前选中,清空
      if (selectedId === node.id) {
        setSelectedId(null);
      }
      await refetch();
    } catch {
      // axios 拦截器已 toast(含"存在 N 个子分类"等业务错误)
    }
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setDrawerEditingNode(null);
    setDrawerDirty(false);
    setDrawerDefaultParentId(0);
  };

  const handleDrawerSubmit = async (form: DrawerFormData): Promise<void> => {
    if (drawerMode === 'create') {
      const req: AssetCategoryCreateRequest = {
        parentId: drawerDefaultParentId,
        categoryName: form.categoryName.trim(),
        categoryCode: form.categoryCode.trim() || undefined,
        categoryKind: form.categoryKind,
        description: form.description.trim() || undefined,
        sort: form.sort,
        isPublic: form.isPublic,
      };
      const newId = await assetCategoryApi.create(req);
      toast.success(`分类「${form.categoryName}」已创建`);
      handleDrawerClose();
      // 等待服务端 commit,refetch 后选中新节点
      await refetch(newId);
    } else if (drawerMode === 'edit' && drawerEditingNode) {
      const req: AssetCategoryUpdateRequest = {
        id: drawerEditingNode.id,
        categoryName: form.categoryName.trim(),
        categoryCode: form.categoryCode.trim() || undefined,
        description: form.description.trim() || undefined,
        sort: form.sort,
        isPublic: form.isPublic,
      };
      await assetCategoryApi.update(req);
      toast.success(`分类「${form.categoryName}」已更新`);
      handleDrawerClose();
      await refetch(drawerEditingNode.id);
    }
  };

  // ---------- derived ----------

  const selectedNode = useMemo(
    () => findNode(tree, selectedId),
    [tree, selectedId],
  );

  const totalCount = useMemo(() => countNodes(tree), [tree]);

  const parentName = useMemo(() => {
    if (drawerDefaultParentId === 0) return '';
    const parent = findNode(tree, drawerDefaultParentId);
    return parent?.categoryName ?? '';
  }, [tree, drawerDefaultParentId]);

  // ---------- render ----------

  return (
    <div className="space-y-4" id="resource-category-container">
      {/* 顶部 Banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3 shadow-xs">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-xs font-bold text-slate-800">资源分类管理</h4>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            当前共 <strong className="text-slate-700 font-mono">{totalCount}</strong> 个分类(公开 + 私有)。
            公开分类全员可见,私有分类仅创建者自己可见。删除操作要求该分类下无子分类。
          </p>
        </div>
      </div>

      {/* 主体两栏布局 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        {/* 左侧:分类树 */}
        <aside className="w-full md:w-[300px] border-r border-slate-200 flex flex-col shrink-0">
          {/* 树头部 */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">我的分类</h3>
              <p className="text-[10px] text-slate-400 mt-0.5 font-medium">共 {totalCount} 项</p>
            </div>
            <button
              onClick={handleAddRoot}
              className="flex items-center gap-1 px-2.5 h-7 bg-blue-600 text-white rounded-md text-[11px] font-bold hover:bg-blue-700 transition-colors cursor-pointer"
              id="btn-add-root"
            >
              <Plus className="w-3 h-3" />
              新建顶级
            </button>
          </div>

          {/* 树主体 */}
          <div className="flex-1 overflow-y-auto p-2" id="category-tree-body">
            {loading && tree.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <span className="material-symbols-outlined text-3xl animate-spin mb-2">progress_activity</span>
                <p className="text-xs font-bold">加载中...</p>
              </div>
            ) : tree.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Folder className="w-10 h-10 mb-2 text-slate-300" />
                <p className="text-xs font-bold mb-1">还没有任何分类</p>
                <p className="text-[10px] text-slate-400 mb-3 text-center px-4">
                  点击右上角"新建顶级"开始创建第一个资源分类
                </p>
                <button
                  onClick={handleAddRoot}
                  className="flex items-center gap-1 px-3 h-7 bg-blue-600 text-white rounded-md text-[11px] font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  新建顶级分类
                </button>
              </div>
            ) : (
              <nav className="flex flex-col gap-0.5">
                {tree.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    selectedId={selectedId}
                    expandedIds={expandedIds}
                    onSelect={handleSelect}
                    onToggleExpand={handleToggleExpand}
                    onAddChild={handleAddChild}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </nav>
            )}
          </div>
        </aside>

        {/* 右侧:详情 / 空状态 */}
        <main className="flex-1 flex flex-col bg-slate-50/30 min-w-0">
          {selectedNode ? (
            <CategoryDetailPanel
              node={selectedNode}
              parentName={
                selectedNode.parentId === 0
                  ? null
                  : findNode(tree, selectedNode.parentId)?.categoryName ?? null
              }
              onEdit={() => handleEdit(selectedNode)}
              onAddChild={() => handleAddChild(selectedNode.id)}
              onDelete={() => handleDelete(selectedNode)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
              <Folder className="w-16 h-16 mb-3 text-slate-300" />
              <p className="text-sm font-bold mb-1 text-slate-500">请从左侧选择一个分类</p>
              <p className="text-xs text-slate-400 mb-5 text-center max-w-md">
                选择一个分类节点后,这里会显示该分类的详细信息和操作按钮。你也可以创建一个新的顶级分类。
              </p>
              <button
                onClick={handleAddRoot}
                className="flex items-center gap-1.5 px-4 h-9 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                新建顶级分类
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Drawer */}
      <CategoryDrawer
        open={drawerOpen}
        mode={drawerMode}
        editingNode={drawerEditingNode}
        defaultParentId={drawerDefaultParentId}
        parentName={parentName}
        dirty={drawerDirty}
        onDirtyChange={setDrawerDirty}
        onClose={handleDrawerClose}
        onSubmit={handleDrawerSubmit}
      />
    </div>
  );
};
