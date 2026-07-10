import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, ChevronRight, ChevronDown, Trash2, Edit3, FolderPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { MenuNode, MenuNodeType, DrawerMode } from '../../types';
import {
  getMenuTree,
  addMenu,
  updateMenu,
  deleteMenu,
  type MenuAddPayload,
  type MenuUpdatePayload,
} from '../../api/roleMenu';
import { useConfirm } from '../common/ConfirmProvider';
import { MenuEditDrawer } from './MenuEditDrawer';

type FilterType = MenuNodeType | 'ALL';

const TYPE_LABEL: Record<MenuNodeType, string> = {
  CATALOG: '目录',
  MENU: '菜单',
  BUTTON: '按钮',
};

const TYPE_BADGE: Record<MenuNodeType, string> = {
  CATALOG: 'bg-purple-50 text-purple-700 border-purple-200',
  MENU: 'bg-blue-50 text-blue-700 border-blue-200',
  BUTTON: 'bg-slate-50 text-slate-600 border-slate-200',
};

export const MenuConfigTab: React.FC = () => {
  const [tree, setTree] = useState<MenuNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('create');
  const [drawerInitial, setDrawerInitial] = useState<MenuNode | null>(null);
  const [drawerDefaultPid, setDrawerDefaultPid] = useState<string | undefined>(undefined);
  const [drawerDefaultType, setDrawerDefaultType] = useState<MenuNodeType | undefined>(undefined);

  const confirm = useConfirm();

  const loadTree = async () => {
    setLoading(true);
    try {
      const t = (await getMenuTree()) ?? [];
      setTree(Array.isArray(t) ? t : []);
      if (!selectedId && t.length > 0) {
        const first = t[0];
        setSelectedId(String(first.id));
        setExpandedIds(new Set(t.map((n) => String(n.id))));
      }
    } catch {
      // toast 由 http 拦截器统一处理
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
  };

  const findNode = (nodes: MenuNode[], id: string): MenuNode | null => {
    for (const n of nodes) {
      if (String(n.id) === id) return n;
      if (n.children?.length) {
        const found = findNode(n.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const filterTree = (nodes: MenuNode[], type: FilterType): MenuNode[] => {
    if (type === 'ALL') return nodes;
    const out: MenuNode[] = [];
    for (const n of nodes) {
      if (n.type === type) {
        out.push(n);
      } else if (n.children?.length) {
        const sub = filterTree(n.children, type);
        if (sub.length) out.push(...sub);
      }
    }
    return out;
  };

  const filteredTree = useMemo(
    () => (filterType === 'ALL' ? tree : filterTree(tree, filterType)),
    [tree, filterType]
  );

  const selectedNode = selectedId ? findNode(tree, selectedId) : null;

  const openCreateRoot = () => {
    setDrawerMode('create');
    setDrawerInitial(null);
    setDrawerDefaultPid('0');
    setDrawerDefaultType('CATALOG');
    setDrawerOpen(true);
  };

  const openCreateChild = (parent: MenuNode) => {
    setDrawerMode('create');
    setDrawerInitial(null);
    setDrawerDefaultPid(String(parent.id));
    setDrawerDefaultType(parent.type === 'CATALOG' ? 'MENU' : 'BUTTON');
    setDrawerOpen(true);
  };

  const openEdit = (node: MenuNode) => {
    setDrawerMode('edit');
    setDrawerInitial(node);
    setDrawerDefaultPid(undefined);
    setDrawerDefaultType(undefined);
    setDrawerOpen(true);
  };

  const handleDrawerSubmit = async (
    values: MenuAddPayload | Omit<MenuUpdatePayload, 'id'>
  ): Promise<void> => {
    try {
      if (drawerMode === 'create') {
        await addMenu(values as MenuAddPayload);
      } else if (drawerInitial) {
        const payload = { ...values, id: String(drawerInitial.id) } as MenuUpdatePayload;
        await updateMenu(payload);
      }
      await loadTree();
    } catch (e) {
      // 错误由 http 拦截器统一 toast,容器只负责防止异常逃逸
      // eslint-disable-next-line no-console
      console.error('handleDrawerSubmit failed:', e);
    }
  };

  const handleDelete = async () => {
    if (!selectedNode) return;
    if (selectedNode.children && selectedNode.children.length > 0) {
      toast.error('请先删除子节点');
      return;
    }
    const ok = await confirm({
      title: '删除菜单',
      message: `确认删除「${selectedNode.menuName}」?`,
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteMenu(String(selectedNode.id));
      setSelectedId(null);
      await loadTree();
    } catch {
      // toast 由 http 拦截器统一处理
    } finally {
      setDeleting(false);
    }
  };

  const renderNode = (node: MenuNode, depth: number): React.ReactNode => {
    const id = String(node.id);
    const isExpandable =
      node.type !== 'BUTTON' && (node.children?.length || 0) > 0;
    const isExpanded = expandedIds.has(id);
    const isSelected = selectedId === id;

    return (
      <div key={id}>
        <div
          onClick={() => handleSelect(id)}
          onDoubleClick={() => openEdit(node)}
          className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-colors ${
            isSelected
              ? 'bg-blue-50 border border-blue-200'
              : 'hover:bg-slate-50 border border-transparent'
          }`}
          style={{ paddingLeft: 12 + depth * 20 }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isExpandable) toggleExpand(id);
            }}
            className={`p-0.5 rounded ${
              isExpandable ? 'text-slate-500 hover:text-slate-700' : 'text-transparent'
            }`}
            tabIndex={isExpandable ? 0 : -1}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>

          <span
            className={`text-xs font-semibold flex-1 truncate ${
              isSelected ? 'text-blue-700' : 'text-slate-700'
            }`}
          >
            {node.menuName}
          </span>

          <span
            className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border font-mono ${
              TYPE_BADGE[node.type]
            }`}
          >
            {TYPE_LABEL[node.type]}
          </span>
        </div>

        {isExpandable && isExpanded && node.children && (
          <div>{node.children.map((c) => renderNode(c, depth + 1))}</div>
        )}
      </div>
    );
  };

  const totalNodes = (() => {
    let n = 0;
    const walk = (list: MenuNode[]) => {
      for (const x of list) {
        n += 1;
        if (x.children?.length) walk(x.children);
      }
    };
    walk(tree);
    return n;
  })();

  return (
    <div className="space-y-4">
      {/* 顶部工具栏 */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3">
        <button
          onClick={openCreateRoot}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          新增根节点
        </button>

        <button
          onClick={loadTree}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-slate-500">类型筛选</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as FilterType)}
            className="px-2 py-1.5 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">全部 ({totalNodes})</option>
            <option value="CATALOG">目录 (CATALOG)</option>
            <option value="MENU">菜单 (MENU)</option>
            <option value="BUTTON">按钮 (BUTTON)</option>
          </select>
        </div>
      </div>

      {/* 双栏 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 左:树形 */}
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <h4 className="text-xs font-bold text-slate-700">菜单树</h4>
            <span className="text-[10px] text-slate-400">单击选中,双击编辑</span>
          </div>
          <div className="max-h-[600px] overflow-y-auto pr-1">
            {loading && tree.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-12">加载中...</div>
            ) : filteredTree.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-12">
                {tree.length === 0 ? '暂无菜单' : '无匹配的菜单'}
              </div>
            ) : (
              filteredTree.map((n) => renderNode(n, 0))
            )}
          </div>
        </div>

        {/* 右:详情 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 min-h-[400px]">
          {!selectedNode ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
              请从左侧选择一个菜单节点
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-800">{selectedNode.menuName}</h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-1">ID: {selectedNode.id}</p>
                </div>
                <span
                  className={`shrink-0 text-[10px] px-2 py-0.5 rounded border font-mono ${
                    TYPE_BADGE[selectedNode.type]
                  }`}
                >
                  {TYPE_LABEL[selectedNode.type]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">权限标识</div>
                  <div className="text-xs text-slate-700 font-mono break-all">
                    {selectedNode.permission || '-'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">图标</div>
                  <div className="text-xs text-slate-700 font-mono break-all">
                    {selectedNode.icon || '-'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">客户端类型</div>
                  <div className="text-xs text-slate-700">
                    {selectedNode.clientType || '通用'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">排序</div>
                  <div className="text-xs text-slate-700 font-mono">
                    {selectedNode.sort ?? 0}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">描述</div>
                <div className="text-xs text-slate-700 leading-relaxed">
                  {selectedNode.description || '-'}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                <button
                  onClick={() => openEdit(selectedNode)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  编辑
                </button>

                {selectedNode.type !== 'BUTTON' && (
                  <button
                    onClick={() => openCreateChild(selectedNode)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    新增子菜单
                  </button>
                )}

                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold rounded-lg disabled:opacity-60 ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  删除
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <MenuEditDrawer
        open={drawerOpen}
        mode={drawerMode}
        initial={drawerInitial}
        defaultPid={drawerDefaultPid}
        defaultType={drawerDefaultType}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleDrawerSubmit}
      />
    </div>
  );
};

export default MenuConfigTab;
