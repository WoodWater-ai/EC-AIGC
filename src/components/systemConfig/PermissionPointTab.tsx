// EC-AIGC/src/components/systemConfig/PermissionPointTab.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Info, RotateCcw } from 'lucide-react';
import type { PermissionPoint, DrawerMode } from '../../types';
import {
  listPermissions,
  addPermission,
  updatePermission,
  deletePermission,
  type PermissionAddPayload,
  type PermissionUpdatePayload,
} from '../../api/permission';
import { useConfirm } from '../common/ConfirmProvider';
import PermissionPointTable from './PermissionPointTable';
import PermissionPointDrawer from './PermissionPointDrawer';

export const PermissionPointTab: React.FC = () => {
  const confirm = useConfirm();
  const [points, setPoints] = useState<PermissionPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('create');
  const [editingPoint, setEditingPoint] = useState<PermissionPoint | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPermissions({ pageNum: 1, pageSize: 200 });
      setPoints(res.list || []);
    } catch {
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const handleOpenCreate = () => {
    setEditingPoint(null);
    setDrawerMode('create');
    setDrawerOpen(true);
  };

  const handleOpenEdit = (p: PermissionPoint) => {
    setEditingPoint(p);
    setDrawerMode('edit');
    setDrawerOpen(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: '删除权限点',
      message: '确认删除该权限点?',
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await deletePermission(id);
      refetch();
    } catch {
      // axios 拦截器已 toast
    }
  };

  const handleSubmit = async (values: PermissionAddPayload) => {
    if (drawerMode === 'create') {
      await addPermission(values);
    } else if (editingPoint) {
      const payload: PermissionUpdatePayload = { id: editingPoint.id, ...values };
      await updatePermission(payload);
    }
    refetch();
  };

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-bold text-slate-800">权限点配置说明</h4>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            权限点 = 菜单中 type=BUTTON 的按钮节点,归属父菜单自动分组。后端通过
            <code className="mx-1 px-1 bg-slate-100 rounded font-mono">@SaCheckPermission(&quot;code&quot;)</code>
            鉴权。
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200/60 p-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="font-mono">DaVinci System Nodes:</span>
          <span className="font-bold text-slate-700">{points.length}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refetch}
            className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            刷新
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            新建权限点
          </button>
        </div>
      </div>

      {/* Table */}
      <PermissionPointTable
        points={points}
        loading={loading}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
      />

      {/* Drawer */}
      <PermissionPointDrawer
        open={drawerOpen}
        mode={drawerMode}
        initial={editingPoint}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default PermissionPointTab;
