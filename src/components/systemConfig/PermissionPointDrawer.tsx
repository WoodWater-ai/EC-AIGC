import React, { useState, useEffect } from 'react';
import { X, Info } from 'lucide-react';
import type { PermissionPoint, DrawerMode, MenuNode } from '../../types';
import { getMenuTree } from '../../api/roleMenu';

interface PermissionPointDrawerProps {
  open: boolean;
  mode: DrawerMode;
  initial: PermissionPoint | null;
  onClose: () => void;
  onSubmit: (values: {
    code: string;
    name: string;
    pid: string;
    sort?: number;
    description?: string;
  }) => Promise<void>;
}

export const PermissionPointDrawer: React.FC<PermissionPointDrawerProps> = ({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [pid, setPid] = useState('');
  const [sort, setSort] = useState<number | undefined>(0);
  const [description, setDescription] = useState('');
  const [parentMenus, setParentMenus] = useState<MenuNode[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);

    getMenuTree()
      .then((tree) => {
        // 只保留 type IN (CATALOG, MENU) 的节点,平铺给下拉
        const flat: MenuNode[] = [];
        const walk = (nodes: MenuNode[], depth: number) => {
          for (const n of nodes) {
            if (n.type === 'CATALOG' || n.type === 'MENU') {
              flat.push({ ...n, menuName: '　'.repeat(depth) + n.menuName });
            }
            if (n.children?.length) walk(n.children, depth + 1);
          }
        };
        walk(tree, 0);
        setParentMenus(flat);
      })
      .catch(() => setParentMenus([]));

    if (mode === 'edit' && initial) {
      setCode(initial.code);
      setName(initial.name);
      setPid(initial.pid);
      setSort(initial.sort ?? 0);
      setDescription(initial.description ?? '');
    } else {
      setCode('');
      setName('');
      setPid('');
      setSort(0);
      setDescription('');
    }
  }, [open, mode, initial]);

  if (!open) return null;

  const canSubmit = code.trim() !== '' && name.trim() !== '' && pid !== '' && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        code: code.trim(),
        name: name.trim(),
        pid,
        sort,
        description: description.trim() || undefined,
      });
      onClose();
    } catch (e: any) {
      setError(e?.errMessage || e?.message || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-[#0B1C30]/40 backdrop-blur-xs cursor-pointer"
        onClick={onClose}
      />
      <div className="absolute right-0 top-0 h-full w-[480px] bg-white shadow-2xl flex flex-col z-50">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            {mode === 'create' ? '新建权限点' : '编辑权限点'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* code */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              权限点 code <span className="text-rose-500">*</span>
              <span className="text-slate-400 font-normal">(全局唯一,鉴权用,如 user:create)</span>
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={64}
              placeholder="例如: user:create"
              className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white font-mono"
            />
          </div>

          {/* name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              权限点显示名 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              placeholder="例如: 新建协作账号"
              className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {/* pid */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              归属父菜单 <span className="text-rose-500">*</span>
            </label>
            <select
              value={pid}
              onChange={(e) => setPid(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none"
            >
              <option value="">请选择</option>
              {parentMenus.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.menuName}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400">父菜单必须是菜单或目录(后端校验)</p>
          </div>

          {/* sort */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">排序</label>
            <input
              type="number"
              value={sort ?? 0}
              onChange={(e) => setSort(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none font-mono"
            />
          </div>

          {/* description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">权限点描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={255}
              rows={3}
              placeholder="对权限点用途的简要说明,限 255 字"
              className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white resize-none"
            />
          </div>

          {error && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2">
              {error}
            </div>
          )}

          <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-500 leading-normal">
              权限点(按钮)归属于“父菜单”,前端按父菜单名自动分组展示。后端 @SaCheckPermission("你填的 code") 用此串鉴权。
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {submitting && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {mode === 'create' ? '确认创建' : '保存修改'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionPointDrawer;
