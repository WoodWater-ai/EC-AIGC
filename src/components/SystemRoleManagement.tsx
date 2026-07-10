import React, { useEffect, useState, useCallback } from 'react';
import { Search, Plus, Edit, Trash2, X, Save, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { roleApi } from '../api/modules/role';
import { menuApi } from '../api/modules/menu';
import { MenuAuthTreeNode } from './MenuAuthTreeNode';
import type {
  RoleResponse,
  RoleAddRequest,
  MenuResponse,
  PageInfo,
} from '../api/types';

/**
 * 系统配置 → 角色管理（独立主 Tab）
 * 2026-07-09 用户决策升级为独立主 Tab
 * 覆盖完整 CRUD + 角色 → 菜单授权（独立 Drawer，B-D3 决策）
 */
export const SystemRoleManagement: React.FC = () => {
  // ========== 状态机 ==========
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    pageNum: 1,
    pageSize: 20,
    search: '',
    scope: '',
    status: '',
  });
  const [allMenuTree, setAllMenuTree] = useState<MenuResponse[]>([]);
  const [selectedRole, setSelectedRole] = useState<RoleResponse | null>(null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [authDrawerOpen, setAuthDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [authSelectedIds, setAuthSelectedIds] = useState<Set<number>>(new Set());
  const [authExpandedIds, setAuthExpandedIds] = useState<Set<number>>(new Set());
  const [authLoading, setAuthLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<RoleAddRequest>({
    roleName: '',
    roleCode: '',
    pid: 0,
    description: '',
    sort: 0,
    scope: 'CURRENT_DOMAIN',
    status: 'ENABLED',
    menuIds: [],
  });

  // ========== Actions ==========
  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const req: Record<string, unknown> = {
        pageNum: filters.pageNum,
        pageSize: filters.pageSize,
      };
      if (filters.search) req.roleName = filters.search;
      if (filters.scope) req.scope = filters.scope;
      if (filters.status) req.status = filters.status;
      const page: PageInfo<RoleResponse> = await roleApi.list(req as any);
      setRoles(page.list ?? []);
      setTotal(page.total);
    } catch (err) {
      console.error('[SystemRoleManagement.fetchRoles] 失败:', err);
      setRoles([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const openCreateDrawer = () => {
    setDrawerMode('create');
    setSelectedRole(null);
    setForm({
      roleName: '',
      roleCode: '',
      pid: 0,
      description: '',
      sort: 0,
      scope: 'CURRENT_DOMAIN',
      status: 'ENABLED',
      menuIds: [],
    });
    setEditDrawerOpen(true);
  };

  const openEditDrawer = async (role: RoleResponse) => {
    if (!role.id) return;
    const detail = await roleApi.detail(role.id);
    setSelectedRole(detail);
    setDrawerMode('edit');
    setForm({
      roleName: detail.roleName ?? '',
      roleCode: detail.roleCode ?? '',
      pid: 0,
      description: detail.description ?? '',
      sort: detail.sort ?? 0,
      scope:
        detail.scope === 'EMPTY' || !detail.scope ? 'CURRENT_DOMAIN' : (detail.scope as any),
      status:
        detail.status === 'EMPTY' || !detail.status ? 'ENABLED' : (detail.status as any),
      menuIds: detail.menuList?.map((m) => m.id!).filter(Boolean) ?? [],
    });
    setEditDrawerOpen(true);
  };

  const saveRole = async () => {
    if (!form.roleName.trim() || !form.roleCode.trim()) {
      alert('请填写角色名和角色编码');
      return;
    }
    if (drawerMode === 'create') {
      await roleApi.add(form);
    } else {
      if (!selectedRole?.id) return;
      await roleApi.update({ ...form, id: selectedRole.id });
    }
    setEditDrawerOpen(false);
    await fetchRoles();
  };

  const removeRole = async (id: number) => {
    if (!confirm('确定要删除该角色吗？')) return;
    await roleApi.remove(id);
    await fetchRoles();
  };

  // ========== 角色 → 菜单授权（独立 Drawer） ==========
  const openAuthDrawer = async (role: RoleResponse) => {
    if (!role.id) return;
    setAuthLoading(true);
    setAuthDrawerOpen(true);
    try {
      // 并行 3 个请求
      const [detail, boundMenus, tree] = await Promise.all([
        roleApi.detail(role.id),
        roleApi.getMenus(role.id),
        menuApi.tree(),
      ]);
      // 2026-07-09 P1 修:axios 解包 ServiceResult.data 后可能是 null(后端返回 data: null),
      // null.map() 直接 throw,整个 App 崩 → 白屏
      const safeBound = boundMenus ?? [];
      const safeTree = tree ?? [];
      setSelectedRole(detail);
      setAllMenuTree(safeTree);
      setAuthSelectedIds(new Set(safeBound.map((m) => m.id!).filter(Boolean)));
      setAuthExpandedIds(new Set(safeTree.map((t) => t.id!).filter(Boolean)));
    } catch (err) {
      console.error('[SystemRoleManagement.openAuthDrawer] 失败:', err);
      toast.error('加载菜单授权失败,请稍后重试');
    } finally {
      setAuthLoading(false);
    }
  };

  const toggleAuthMenu = (id: number, checked: boolean) => {
    setAuthSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAuthExpand = (id: number) => {
    setAuthExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveAuth = async () => {
    if (!selectedRole?.id) return;
    await roleApi.assignMenus({
      roleId: selectedRole.id,
      menuIds: Array.from(authSelectedIds),
    });
    setAuthDrawerOpen(false);
    await fetchRoles();
  };

  // ========== Render ==========
  return (
    <div className="space-y-6">
      {/* Header: 搜索 + 筛选 + 新建 */}
      <div className="flex justify-between items-center gap-3">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="搜索角色名/角色编码"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, pageNum: 1 })}
              className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 pl-9 rounded-lg"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
          <select
            value={filters.scope}
            onChange={(e) => setFilters({ ...filters, scope: e.target.value, pageNum: 1 })}
            className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg"
          >
            <option value="">全部作用域</option>
            <option value="CURRENT_DOMAIN">当前域</option>
            <option value="SUB_DOMAIN">子域</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value, pageNum: 1 })}
            className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg"
          >
            <option value="">全部状态</option>
            <option value="ENABLED">启用</option>
            <option value="DISABLED">停用</option>
          </select>
        </div>
        <button
          onClick={openCreateDrawer}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />新建角色
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase">
              <th className="py-3 px-5 text-left">角色名</th>
              <th className="py-3 px-5 text-left">角色编码</th>
              <th className="py-3 px-5 text-left">作用域</th>
              <th className="py-3 px-5 text-left">状态</th>
              <th className="py-3 px-5 text-left">系统角色</th>
              <th className="py-3 px-5 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
            {roles.map((role) => (
              <tr key={role.id} className="hover:bg-slate-50/40">
                <td className="py-3 px-5 font-bold text-slate-800">{role.roleName}</td>
                <td className="py-3 px-5 font-mono text-slate-500">{role.roleCode}</td>
                <td className="py-3 px-5">{role.scope}</td>
                <td className="py-3 px-5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      role.status === 'ENABLED' || role.status === 'NORMAL'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {role.status === 'ENABLED' || role.status === 'NORMAL' ? '启用' : '停用'}
                  </span>
                </td>
                <td className="py-3 px-5">{role.sysRole ? '是' : '否'}</td>
                <td className="py-3 px-5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEditDrawer(role)}
                      className="text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                    >
                      <Edit className="w-3.5 h-3.5" />编辑
                    </button>
                    <button
                      onClick={() => openAuthDrawer(role)}
                      className="text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                    >
                      <Shield className="w-3.5 h-3.5" />授权菜单
                    </button>
                    <button
                      onClick={() => role.id && removeRole(role.id)}
                      disabled={role.sysRole}
                      className={`flex items-center gap-0.5 ${
                        role.sysRole
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-rose-500 hover:text-rose-700'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {roles.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-slate-400 font-semibold">
                  暂无角色
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="p-3 border-t flex justify-between text-xs text-slate-400">
          <span>共 {total} 条</span>
          <div className="flex gap-1">
            <button
              onClick={() => setFilters({ ...filters, pageNum: Math.max(1, filters.pageNum - 1) })}
              disabled={filters.pageNum === 1}
              className="w-7 h-7 border rounded disabled:opacity-50"
            >
              ‹
            </button>
            <span className="w-7 h-7 flex items-center justify-center bg-blue-600 text-white rounded font-bold">
              {filters.pageNum}
            </span>
            <button
              onClick={() => setFilters({ ...filters, pageNum: filters.pageNum + 1 })}
              disabled={filters.pageNum * filters.pageSize >= total}
              className="w-7 h-7 border rounded disabled:opacity-50"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* 编辑 Drawer */}
      {editDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-[#0B1C30]/40 backdrop-blur-xs"
            onClick={() => setEditDrawerOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[480px] bg-white shadow-2xl flex flex-col">
            <div className="px-6 py-5 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-800">
                {drawerMode === 'create' ? '新建角色' : '编辑角色'}
              </h3>
              <button onClick={() => setEditDrawerOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700">角色名 *</label>
                <input
                  type="text"
                  value={form.roleName}
                  onChange={(e) => setForm({ ...form, roleName: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">角色编码 *</label>
                <input
                  type="text"
                  value={form.roleCode}
                  onChange={(e) => setForm({ ...form, roleCode: e.target.value.toUpperCase() })}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">作用域</label>
                <select
                  value={form.scope}
                  onChange={(e) => setForm({ ...form, scope: e.target.value as any })}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg"
                >
                  <option value="CURRENT_DOMAIN">当前域</option>
                  <option value="SUB_DOMAIN">子域</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">状态</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg"
                >
                  <option value="ENABLED">启用</option>
                  <option value="DISABLED">停用</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">描述</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setEditDrawerOpen(false)}
                className="px-4 py-2 border rounded-lg text-xs"
              >
                取消
              </button>
              <button
                onClick={saveRole}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
              >
                <Save className="w-4 h-4" />保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 授权 Drawer */}
      {authDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-[#0B1C30]/40 backdrop-blur-xs"
            onClick={() => setAuthDrawerOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[600px] bg-white shadow-2xl flex flex-col">
            <div className="px-6 py-5 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-800">
                角色授权菜单 — {selectedRole?.roleName}
              </h3>
              <button onClick={() => setAuthDrawerOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {authLoading ? (
                <div className="text-center py-12 text-slate-400">加载中...</div>
              ) : (
                <div className="space-y-1">
                  {allMenuTree.map((root) => (
                    <MenuAuthTreeNode
                      key={root.id}
                      node={root}
                      depth={0}
                      selectedIds={authSelectedIds}
                      expandedIds={authExpandedIds}
                      onToggle={toggleAuthMenu}
                      onExpand={toggleAuthExpand}
                    />
                  ))}
                  {allMenuTree.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-xs">暂无菜单数据</div>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-between items-center bg-slate-50">
              <span className="text-xs text-slate-500">
                已选{' '}
                <strong className="text-blue-600 font-bold">{authSelectedIds.size}</strong> 个菜单
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setAuthDrawerOpen(false)}
                  className="px-4 py-2 border rounded-lg text-xs"
                >
                  取消
                </button>
                <button
                  onClick={saveAuth}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"
                >
                  保存授权
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
