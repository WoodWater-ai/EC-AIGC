import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Edit, Trash2, X, Save, Search } from 'lucide-react';
import { menuApi } from '../api/modules/menu';
import type { MenuResponse, MenuAddRequest } from '../api/types';

/**
 * 系统配置 → 菜单管理（独立主 Tab）
 * 2026-07-09 用户决策新建独立主 Tab
 * 树视图 + 列表视图双模式，Drawer CRUD
 */
export const SystemMenuManagement: React.FC = () => {
  // ========== 状态机 ==========
  const [allMenus, setAllMenus] = useState<MenuResponse[]>([]);
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [selectedMenu, setSelectedMenu] = useState<MenuResponse | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [loading, setLoading] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [searchName, setSearchName] = useState('');
  const [form, setForm] = useState<MenuAddRequest>({
    menuName: '',
    menuPath: '',
    routerName: '',
    comPath: '',
    icon: '',
    sort: 0,
    pid: 0,
    type: 'MENU',
    permission: '',
    applicationScope: 'ADMIN',
  });

  // ========== Actions ==========
  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      const tree = await menuApi.tree();
      setAllMenus(tree);
      setExpandedIds(new Set(tree.map((t) => t.id!).filter(Boolean)));
    } catch (err) {
      console.error('[SystemMenuManagement.fetchTree] 失败:', err);
      setAllMenus([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const page = await menuApi.list({
        pageNum,
        pageSize,
        menuName: searchName || undefined,
      });
      setAllMenus(page.list ?? []);
      setTotal(page.total);
    } catch (err) {
      console.error('[SystemMenuManagement.fetchList] 失败:', err);
      setAllMenus([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [pageNum, pageSize, searchName]);

  useEffect(() => {
    if (viewMode === 'tree') fetchTree();
    else fetchList();
  }, [viewMode, fetchTree, fetchList]);

  // 树形中查找节点
  const findInTree = (tree: MenuResponse[], id: number): MenuResponse | null => {
    for (const node of tree) {
      if (node.id === id) return node;
      const child = findInTree(node.children ?? [], id);
      if (child) return child;
    }
    return null;
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreateChildDrawer = (parentId: number) => {
    setDrawerMode('create');
    setForm({ ...form, pid: parentId });
    setSelectedMenu(null);
    setDrawerOpen(true);
  };

  const openCreateTopDrawer = () => {
    setDrawerMode('create');
    setForm({ ...form, pid: 0 });
    setSelectedMenu(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = async (menu: MenuResponse) => {
    if (!menu.id) return;
    const detail = await menuApi.detail(menu.id);
    setSelectedMenu(detail);
    setDrawerMode('edit');
    setForm({
      menuName: detail.menuName ?? '',
      menuPath: detail.menuPath ?? '',
      routerName: detail.routerName ?? '',
      comPath: detail.comPath ?? '',
      icon: detail.icon ?? '',
      sort: detail.sort ?? 0,
      pid: detail.pid ?? 0,
      type:
        detail.type === 'EMPTY' || !detail.type
          ? 'MENU'
          : (detail.type as MenuAddRequest['type']),
      permission: detail.permission ?? '',
      applicationScope:
        detail.applicationScope === 'EMPTY' || !detail.applicationScope
          ? 'ADMIN'
          : (detail.applicationScope as MenuAddRequest['applicationScope']),
    });
    setDrawerOpen(true);
  };

  const saveMenu = async () => {
    if (!form.menuName.trim()) {
      alert('请填写菜单名');
      return;
    }
    if (drawerMode === 'create') {
      await menuApi.add(form);
    } else {
      if (!selectedMenu?.id) return;
      await menuApi.update({ ...form, id: selectedMenu.id });
    }
    setDrawerOpen(false);
    if (viewMode === 'tree') await fetchTree();
    else await fetchList();
  };

  const removeMenu = async (menu: MenuResponse) => {
    const node = viewMode === 'tree' ? menu : findInTree(allMenus, menu.id!);
    if (!node) return;
    if ((node.children?.length ?? 0) > 0) {
      alert(
        `无法删除菜单「${node.menuName}」:该菜单下仍有 ${node.children!.length} 个子菜单`,
      );
      return;
    }
    if (!confirm(`确定要删除菜单「${node.menuName}」吗?`)) return;
    await menuApi.remove(menu.id!);
    if (viewMode === 'tree') await fetchTree();
    else await fetchList();
  };

  // 树形节点渲染
  const renderTreeNode = (node: MenuResponse, depth: number): React.ReactNode => {
    const isExpanded = expandedIds.has(node.id!);
    const hasChildren = (node.children?.length ?? 0) > 0;
    return (
      <div key={node.id} style={{ marginLeft: depth * 16 }}>
        <div className="bg-white rounded-xl border border-slate-200/60 p-3 mb-2 flex items-center justify-between hover:border-blue-300 hover:shadow-sm transition-all">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              onClick={() => toggleExpand(node.id!)}
              className={`w-4 h-4 flex items-center justify-center text-slate-400 text-[10px] ${
                hasChildren ? '' : 'invisible'
              }`}
              type="button"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
            <span className="font-mono text-[10px] text-slate-400 w-12 shrink-0">
              #{node.id}
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">{node.menuName}</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-mono shrink-0">
              {node.type}
            </span>
            {node.routerName && (
              <span className="text-[10px] text-blue-500 font-mono shrink-0">
                {node.routerName}
              </span>
            )}
            {node.permission && (
              <span className="text-[10px] text-purple-500 font-mono shrink-0">
                {node.permission}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => openCreateChildDrawer(node.id!)}
              className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
              title="新增子菜单"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => openEditDrawer(node)}
              className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
              title="编辑"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => removeMenu(node)}
              className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded"
              title="删除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>{node.children!.map((child) => renderTreeNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header: 搜索 + 视图切换 + 新建 */}
      <div className="flex justify-between items-center gap-3">
        <div className="flex gap-2 flex-1">
          {viewMode === 'list' && (
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="搜索菜单名"
                value={searchName}
                onChange={(e) => {
                  setSearchName(e.target.value);
                  setPageNum(1);
                }}
                className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 pl-9 rounded-lg"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          )}
          <div className="flex gap-1 border border-slate-200 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1 rounded text-xs font-semibold ${
                viewMode === 'tree'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              树视图
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded text-xs font-semibold ${
                viewMode === 'list'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              列表视图
            </button>
          </div>
        </div>
        <button
          onClick={openCreateTopDrawer}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />新增菜单
        </button>
      </div>

      {/* 树视图 */}
      {viewMode === 'tree' && (
        <div className="bg-slate-50/30 rounded-xl p-4">
          {allMenus.map((root) => renderTreeNode(root, 0))}
          {allMenus.length === 0 && !loading && (
            <div className="text-center py-12 text-slate-400 font-semibold">暂无菜单数据</div>
          )}
        </div>
      )}

      {/* 列表视图 */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase">
                <th className="py-3 px-5 text-left">ID</th>
                <th className="py-3 px-5 text-left">菜单名</th>
                <th className="py-3 px-5 text-left">父 ID</th>
                <th className="py-3 px-5 text-left">类型</th>
                <th className="py-3 px-5 text-left">路由</th>
                <th className="py-3 px-5 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allMenus.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/40">
                  <td className="py-3 px-5 font-mono text-slate-400">{m.id}</td>
                  <td className="py-3 px-5 font-bold text-slate-800">{m.menuName}</td>
                  <td className="py-3 px-5 font-mono text-slate-400">{m.pid}</td>
                  <td className="py-3 px-5 font-mono">{m.type}</td>
                  <td className="py-3 px-5 font-mono text-blue-500">
                    {m.routerName || '-'}
                  </td>
                  <td className="py-3 px-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditDrawer(m)}
                        className="text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                      >
                        <Edit className="w-3.5 h-3.5" />编辑
                      </button>
                      <button
                        onClick={() => removeMenu(m)}
                        className="text-rose-500 hover:text-rose-700 flex items-center gap-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {allMenus.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 font-semibold">
                    暂无菜单数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="p-3 border-t flex justify-between text-xs text-slate-400">
            <span>共 {total} 条</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPageNum(Math.max(1, pageNum - 1))}
                disabled={pageNum === 1}
                className="w-7 h-7 border rounded disabled:opacity-50"
              >
                ‹
              </button>
              <span className="w-7 h-7 flex items-center justify-center bg-blue-600 text-white rounded font-bold">
                {pageNum}
              </span>
              <button
                onClick={() => setPageNum(pageNum + 1)}
                disabled={pageNum * pageSize >= total}
                className="w-7 h-7 border rounded disabled:opacity-50"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-[#0B1C30]/40 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[480px] bg-white shadow-2xl flex flex-col">
            <div className="px-6 py-5 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-800">
                {drawerMode === 'create' ? '新增菜单' : '编辑菜单'}
              </h3>
              <button onClick={() => setDrawerOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700">菜单名 *</label>
                <input
                  type="text"
                  value={form.menuName}
                  onChange={(e) => setForm({ ...form, menuName: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">菜单路径 (menuPath)</label>
                <input
                  type="text"
                  value={form.menuPath}
                  onChange={(e) => setForm({ ...form, menuPath: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">路由名 (routerName)</label>
                <input
                  type="text"
                  value={form.routerName}
                  onChange={(e) => setForm({ ...form, routerName: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg font-mono"
                  placeholder="用于 Sidebar 映射"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">组件路径 (comPath)</label>
                <input
                  type="text"
                  value={form.comPath}
                  onChange={(e) => setForm({ ...form, comPath: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">图标 (icon)</label>
                <input
                  type="text"
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg font-mono"
                  placeholder="Material Symbols / lucide name"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">父菜单 (pid, 0=顶级)</label>
                <input
                  type="number"
                  value={form.pid}
                  onChange={(e) => setForm({ ...form, pid: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">类型</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg"
                >
                  <option value="CATALOG">目录</option>
                  <option value="MENU">菜单</option>
                  <option value="BUTTON">按钮</option>
                  <option value="PAGE">页面</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">应用范围</label>
                <select
                  value={form.applicationScope}
                  onChange={(e) =>
                    setForm({ ...form, applicationScope: e.target.value as any })
                  }
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg"
                >
                  <option value="ALL">全部</option>
                  <option value="ADMIN">管理后台</option>
                  <option value="CHANNEL">渠道</option>
                  <option value="TENANT">租户</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">权限码 (permission)</label>
                <input
                  type="text"
                  value={form.permission}
                  onChange={(e) => setForm({ ...form, permission: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg font-mono"
                  placeholder="如 user:create"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">排序 (sort)</label>
                <input
                  type="number"
                  value={form.sort}
                  onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg"
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setDrawerOpen(false)}
                className="px-4 py-2 border rounded-lg text-xs"
              >
                取消
              </button>
              <button
                onClick={saveMenu}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
              >
                <Save className="w-4 h-4" />保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
