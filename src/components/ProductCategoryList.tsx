import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { AppScreen } from '../types';
import {
  productCategoryApi,
  type ProductCategoryNode,
  type ProductCategoryCreateRequest,
  type ProductCategoryUpdateRequest,
} from '../api/modules/productCategory';

interface ProductCategoryListProps {
  setScreen: (screen: AppScreen) => void;
}

// 工具:深度优先遍历找节点
function findNode(tree: ProductCategoryNode[], id: number): ProductCategoryNode | null {
  for (const n of tree) {
    if (n.id === id) return n;
    if (n.children) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

// 工具:深度优先找父节点 ID
function findParentId(tree: ProductCategoryNode[], id: number, parentId: number = 0): number | null {
  for (const n of tree) {
    if (n.id === id) return parentId;
    if (n.children) {
      const found = findParentId(n.children, id, n.id);
      if (found !== null) return found;
    }
  }
  return null;
}

export const ProductCategoryList: React.FC<ProductCategoryListProps> = () => {
  const [tree, setTree] = useState<ProductCategoryNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerDefaultParentId, setDrawerDefaultParentId] = useState<number>(0);
  const [drawerEditingNode, setDrawerEditingNode] = useState<ProductCategoryNode | null>(null);
  const [drawerDirty, setDrawerDirty] = useState(false);
  const [drawerSubmitting, setDrawerSubmitting] = useState(false);

  // 统计分类总数(递归)
  const totalCount = useMemo(() => {
    const walk = (nodes: ProductCategoryNode[]): number => {
      let c = 0;
      for (const n of nodes) {
        c += 1;
        if (n.children) c += walk(n.children);
      }
      return c;
    };
    return walk(tree);
  }, [tree]);

  const refetch = useCallback(async (selectIdAfter?: number) => {
    setLoading(true);
    try {
      const fresh = await productCategoryApi.tree();
      setTree(fresh);
      if (selectIdAfter !== undefined) {
        setSelectedId(selectIdAfter);
        const newNode = findNode(fresh, selectIdAfter);
        if (newNode?.parentId && newNode.parentId !== 0) {
          setExpandedIds(prev => new Set(prev).add(newNode.parentId));
        }
      }
    } catch (e) {
      // axios 拦截器已 toast,此处静默
      console.warn('[ProductCategory] refetch 失败', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // ====== 子组件:TreeNode ======
  const TreeNode: React.FC<{
    node: ProductCategoryNode;
    depth: number;
  }> = ({ node, depth }) => {
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedId === node.id;
    const hasChildren = !!(node.children && node.children.length > 0);

    return (
      <div>
        <div
          className={`group flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors ${
            isSelected ? 'bg-blue-50 text-primary' : 'hover:bg-slate-50 text-slate-700'
          }`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => setSelectedId(node.id)}
        >
          {/* 展开/折叠图标 */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpandedIds(prev => {
                  const next = new Set(prev);
                  if (next.has(node.id)) next.delete(node.id);
                  else next.add(node.id);
                  return next;
                });
              }}
              className="w-4 h-4 flex items-center justify-center text-slate-400"
            >
              <span className="material-symbols-outlined text-base">
                {isExpanded ? 'expand_more' : 'chevron_right'}
              </span>
            </button>
          ) : (
            <span className="w-4 h-4" />
          )}

          <span className="material-symbols-outlined text-base text-slate-400">
            {hasChildren ? 'folder' : 'folder_open'}
          </span>

          <span className={`text-sm truncate ${isSelected ? 'font-semibold' : ''}`}>
            {node.categoryName}
          </span>

          {/* hover 行内操作 */}
          <div className="ml-auto opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
            <button
              title="添加子分类"
              onClick={(e) => {
                e.stopPropagation();
                setDrawerMode('create');
                setDrawerDefaultParentId(node.id);
                setDrawerEditingNode(null);
                setDrawerDirty(false);
                setDrawerOpen(true);
              }}
              className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-primary"
            >
              <span className="material-symbols-outlined text-base">add</span>
            </button>
            <button
              title="编辑"
              onClick={(e) => {
                e.stopPropagation();
                setDrawerMode('edit');
                setDrawerEditingNode(node);
                setDrawerDirty(false);
                setDrawerOpen(true);
              }}
              className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-primary"
            >
              <span className="material-symbols-outlined text-base">edit</span>
            </button>
            <button
              title="删除"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`确认删除「${node.categoryName}」?`)) {
                  void productCategoryApi.delete(node.id).then(() => {
                    if (selectedId === node.id) setSelectedId(null);
                    void refetch();
                  });
                }
              }}
              className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-danger"
            >
              <span className="material-symbols-outlined text-base">delete</span>
            </button>
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div>
            {node.children!.map(child => (
              <TreeNode key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // ====== 子组件:CategoryDetailPanel ======
  const selectedNode = useMemo(() => {
    if (selectedId == null) return null;
    return findNode(tree, selectedId);
  }, [tree, selectedId]);

  const renderDetail = () => {
    if (!selectedNode) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <span className="material-symbols-outlined text-5xl mb-3">account_tree</span>
          <p className="text-sm">请从左侧选择一个商品分类</p>
          <button
            onClick={() => {
              setDrawerMode('create');
              setDrawerDefaultParentId(0);
              setDrawerEditingNode(null);
              setDrawerDirty(false);
              setDrawerOpen(true);
            }}
            className="mt-4 h-9 px-4 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">add</span>
            新建顶级分类
          </button>
        </div>
      );
    }
    return (
      <div className="p-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">{selectedNode.categoryName}</h2>
              <p className="text-xs text-slate-400 mt-1">商品分类详情</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setDrawerMode('edit');
                  setDrawerEditingNode(selectedNode);
                  setDrawerDirty(false);
                  setDrawerOpen(true);
                }}
                className="h-8 px-3 bg-primary text-white text-xs rounded-md hover:bg-primary/90 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                编辑
              </button>
              <button
                onClick={() => {
                  setDrawerMode('create');
                  setDrawerDefaultParentId(selectedNode.id);
                  setDrawerEditingNode(null);
                  setDrawerDirty(false);
                  setDrawerOpen(true);
                }}
                className="h-8 px-3 bg-slate-100 text-slate-700 text-xs rounded-md hover:bg-slate-200 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                添加子分类
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`确认删除「${selectedNode.categoryName}」?`)) {
                    void productCategoryApi.delete(selectedNode.id).then(() => {
                      setSelectedId(null);
                      void refetch();
                    });
                  }
                }}
                className="h-8 px-3 bg-rose-50 text-rose-600 text-xs rounded-md hover:bg-rose-100 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                删除
              </button>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-400 mb-1">分类名称</dt>
              <dd className="text-slate-700">{selectedNode.categoryName}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400 mb-1">排序</dt>
              <dd className="text-slate-700">{selectedNode.sort ?? 0}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-slate-400 mb-1">分类描述</dt>
              <dd className="text-slate-700 whitespace-pre-wrap">
                {selectedNode.description || <span className="text-slate-300">无描述</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400 mb-1">ID</dt>
              <dd className="text-slate-700 font-mono text-xs">{selectedNode.id}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400 mb-1">父分类 ID</dt>
              <dd className="text-slate-700 font-mono text-xs">{selectedNode.parentId}</dd>
            </div>
          </dl>
        </div>
      </div>
    );
  };

  // ====== 子组件:CategoryDrawer ======
  const closeDrawer = () => {
    if (drawerDirty && !window.confirm('有未保存的修改,确认关闭?')) return;
    setDrawerOpen(false);
    setDrawerEditingNode(null);
    setDrawerDirty(false);
  };

  const handleSubmitDrawer = async (form: {
    categoryName: string;
    description: string;
    sort: number;
  }) => {
    if (!form.categoryName.trim()) return;
    setDrawerSubmitting(true);
    try {
      if (drawerMode === 'create') {
        const req: ProductCategoryCreateRequest = {
          parentId: drawerDefaultParentId,
          categoryName: form.categoryName.trim(),
          description: form.description,
          sort: form.sort,
        };
        const newId = await productCategoryApi.create(req);
        await refetch(newId);
      } else if (drawerMode === 'edit' && drawerEditingNode) {
        const req: ProductCategoryUpdateRequest = {
          id: drawerEditingNode.id,
          categoryName: form.categoryName.trim(),
          description: form.description,
          sort: form.sort,
        };
        await productCategoryApi.update(req);
        await refetch(drawerEditingNode.id);
      }
      setDrawerOpen(false);
      setDrawerEditingNode(null);
      setDrawerDirty(false);
    } catch (e) {
      // axios 拦截器已 toast
      console.warn('[ProductCategory] 提交失败', e);
    } finally {
      setDrawerSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 顶部 Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 mb-4 flex items-center gap-3">
        <span className="material-symbols-outlined text-3xl text-primary">account_tree</span>
        <div className="flex-1">
          <h1 className="text-base font-bold text-slate-800">商品分类管理</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            共 <span className="font-semibold text-primary">{totalCount}</span> 个商品分类
          </p>
        </div>
        <button
          onClick={() => {
            setDrawerMode('create');
            setDrawerDefaultParentId(0);
            setDrawerEditingNode(null);
            setDrawerDirty(false);
            setDrawerOpen(true);
          }}
          className="h-9 px-4 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-base">add</span>
          新建顶级分类
        </button>
      </div>

      {/* 左树 + 右详情 */}
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="w-72 shrink-0 bg-white rounded-xl border border-slate-200 p-3 overflow-y-auto">
          <div className="text-xs font-semibold text-slate-500 mb-2 px-2">商品分类</div>
          {loading && tree.length === 0 ? (
            <div className="text-center text-slate-400 py-8 text-xs">加载中...</div>
          ) : tree.length === 0 ? (
            <div className="text-center text-slate-400 py-8 text-xs">暂无分类</div>
          ) : (
            tree.map(n => <TreeNode key={n.id} node={n} depth={0} />)
          )}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <button
              onClick={() => {
                setDrawerMode('create');
                setDrawerDefaultParentId(0);
                setDrawerEditingNode(null);
                setDrawerDirty(false);
                setDrawerOpen(true);
              }}
              className="w-full h-8 text-xs text-slate-500 hover:bg-slate-50 rounded-md flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-base">add</span>
              新建顶级分类
            </button>
          </div>
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto">
          {renderDetail()}
        </div>
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <CategoryDrawer
          mode={drawerMode}
          defaultParentId={drawerDefaultParentId}
          editingNode={drawerEditingNode}
          tree={tree}
          submitting={drawerSubmitting}
          onClose={closeDrawer}
          onSubmit={handleSubmitDrawer}
          onDirtyChange={setDrawerDirty}
        />
      )}
    </div>
  );
};

// ====== CategoryDrawer 子组件(放文件底部,与 ProductCategoryList 同文件) ======

interface CategoryDrawerProps {
  mode: 'create' | 'edit';
  defaultParentId: number;
  editingNode: ProductCategoryNode | null;
  tree: ProductCategoryNode[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (form: { categoryName: string; description: string; sort: number }) => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
}

const CategoryDrawer: React.FC<CategoryDrawerProps> = ({
  mode,
  defaultParentId,
  editingNode,
  tree,
  submitting,
  onClose,
  onSubmit,
  onDirtyChange,
}) => {
  const [categoryName, setCategoryName] = useState(editingNode?.categoryName ?? '');
  const [description, setDescription] = useState(editingNode?.description ?? '');
  const [sort, setSort] = useState(editingNode?.sort ?? 0);
  const [parentId, setParentId] = useState<number>(defaultParentId);

  useEffect(() => {
    const initial = editingNode?.categoryName ?? '';
    setCategoryName(initial);
    setDescription(editingNode?.description ?? '');
    setSort(editingNode?.sort ?? 0);
    setParentId(defaultParentId);
  }, [editingNode, defaultParentId]);

  useEffect(() => {
    const initialName = editingNode?.categoryName ?? '';
    const initialDesc = editingNode?.description ?? '';
    const initialSort = editingNode?.sort ?? 0;
    const dirty =
      categoryName !== initialName ||
      description !== initialDesc ||
      sort !== initialSort ||
      (mode === 'create' && parentId !== defaultParentId);
    onDirtyChange(dirty);
  }, [categoryName, description, sort, parentId, editingNode, defaultParentId, mode, onDirtyChange]);

  const valid = categoryName.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-[420px] h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-800">
            {mode === 'create' ? '新建商品分类' : '编辑商品分类'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* create 模式展示父分类选择 */}
          {mode === 'create' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                父分类
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(Number(e.target.value))}
                className="w-full h-9 px-3 border border-slate-300 rounded-md text-sm"
              >
                <option value={0}>= 顶级分类 =</option>
                {/* 平铺所有非顶级节点供选择 */}
                {(() => {
                  const options: { id: number; name: string; depth: number }[] = [];
                  const walk = (nodes: ProductCategoryNode[], depth: number) => {
                    for (const n of nodes) {
                      if (n.id !== editingNode?.id) {
                        options.push({ id: n.id, name: n.categoryName, depth });
                      }
                      if (n.children) walk(n.children, depth + 1);
                    }
                  };
                  walk(tree, 0);
                  return options.map(o => (
                    <option key={o.id} value={o.id}>
                      {'　'.repeat(o.depth) + o.name}
                    </option>
                  ));
                })()}
              </select>
            </div>
          )}

          {/* edit 模式提示 */}
          {mode === 'edit' && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-md flex items-start gap-2">
              <span className="material-symbols-outlined text-base shrink-0">info</span>
              <span>修改父分类请删除后重建,本编辑器暂不支持改 parentId。</span>
            </div>
          )}

          {/* 名称(必填) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              分类名称 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              maxLength={255}
              className="w-full h-9 px-3 border border-slate-300 rounded-md text-sm focus:border-primary focus:outline-none"
              placeholder="如:电子产品"
            />
            {!valid && (
              <p className="text-xs text-rose-500 mt-1">名称不能为空</p>
            )}
          </div>

          {/* 描述 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              分类描述(可选)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={512}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:border-primary focus:outline-none resize-none"
              placeholder="对该分类的简要说明"
            />
          </div>

          {/* 排序 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              排序(数字越小越靠前)
            </label>
            <input
              type="number"
              value={sort}
              onChange={(e) => setSort(Number(e.target.value))}
              className="w-full h-9 px-3 border border-slate-300 rounded-md text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button
            onClick={onClose}
            disabled={submitting}
            className="h-9 px-4 bg-slate-100 text-slate-700 text-sm rounded-md hover:bg-slate-200 disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={() => onSubmit({ categoryName, description, sort })}
            disabled={!valid || submitting}
            className="h-9 px-4 bg-primary text-white text-sm rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting && (
              <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
            )}
            保存
          </button>
        </div>
      </div>
    </div>
  );
};
