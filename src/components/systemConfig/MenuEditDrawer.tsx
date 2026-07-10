import React, { useState, useEffect } from 'react';
import { X, Info } from 'lucide-react';
import type { MenuNode, MenuNodeType, DrawerMode } from '../../types';
import { getMenuTree } from '../../api/roleMenu';

interface MenuEditDrawerProps {
  open: boolean;
  mode: DrawerMode;
  initial: MenuNode | null;
  defaultPid?: string;
  defaultType?: MenuNodeType;
  onClose: () => void;
  onSubmit: (values: {
    type: MenuNodeType;
    menuName: string;
    pid: string;
    permission?: string;
    icon?: string;
    clientType?: 'PC' | 'IPAD';
    sort?: number;
    description?: string;
  }) => Promise<void>;
}

export const MenuEditDrawer: React.FC<MenuEditDrawerProps> = ({
  open,
  mode,
  initial,
  defaultPid,
  defaultType,
  onClose,
  onSubmit,
}) => {
  const [type, setType] = useState<MenuNodeType>('MENU');
  const [menuName, setMenuName] = useState('');
  const [pid, setPid] = useState('');
  const [permission, setPermission] = useState('');
  const [icon, setIcon] = useState('');
  const [clientType, setClientType] = useState<'PC' | 'IPAD' | ''>('');
  type AppScope = 'ALL' | 'CHANNEL' | 'TENANT' | 'ADMIN' | 'EMPTY';
  const APP_SCOPES: readonly AppScope[] = ['ALL', 'CHANNEL', 'TENANT', 'ADMIN', 'EMPTY'];
  const isAppScope = (v: string): v is AppScope =>
    (APP_SCOPES as readonly string[]).includes(v);
  const [applicationScope, setApplicationScope] = useState<AppScope>('ALL');
  const [sort, setSort] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [parentCandidates, setParentCandidates] = useState<MenuNode[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);

    getMenuTree()
      .then((tree) => {
        const candidates: MenuNode[] = [];
        const walk = (nodes: MenuNode[]) => {
          for (const n of nodes) {
            candidates.push(n);
            if (n.children?.length) walk(n.children);
          }
        };
        walk(tree);
        setParentCandidates(candidates);
      })
      .catch(() => setParentCandidates([]));

    if (mode === 'edit' && initial) {
      setType(initial.type);
      setMenuName(initial.menuName);
      setPid(String(initial.pid));
      setPermission(initial.permission || '');
      setIcon(initial.icon || '');
      setClientType((initial.clientType as 'PC' | 'IPAD') || '');
      setApplicationScope(
        initial.applicationScope && isAppScope(initial.applicationScope)
          ? initial.applicationScope
          : 'ALL'
      );
      setSort(initial.sort ?? 0);
      setDescription(initial.description || '');
    } else {
      setType(defaultType || 'MENU');
      setMenuName('');
      setPid(defaultPid || '');
      setPermission('');
      setIcon('');
      setClientType('');
      setApplicationScope('ALL');
      setSort(0);
      setDescription('');
    }
  }, [open, mode, initial, defaultPid, defaultType]);

  if (!open) return null;

  const handleTypeChange = (newType: MenuNodeType) => {
    if (mode === 'edit') return;
    setType(newType);
    setPid('');
  };

  const validPids = parentCandidates.filter((n) => {
    if (type === 'CATALOG') return false;
    if (type === 'MENU') return n.type === 'CATALOG';
    if (type === 'BUTTON') return n.type === 'MENU';
    return false;
  });

  const canSubmit =
    menuName.trim() !== '' &&
    (type === 'CATALOG' ? true : pid !== '') &&
    (type === 'BUTTON' ? permission.trim() !== '' : true) &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        type,
        menuName: menuName.trim(),
        pid: type === 'CATALOG' ? '0' : pid,
        permission: permission.trim() || undefined,
        icon: icon.trim() || undefined,
        clientType: clientType || undefined,
        applicationScope,
        sort,
        description: description.trim() || undefined,
      });
      onClose();
    } catch (e) {
      const err = e as { errMessage?: string; message?: string };
      setError(err?.errMessage || err?.message || '保存失败');
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
            {mode === 'create' ? '新建菜单' : '编辑菜单'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* type */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              菜单类型 <span className="text-rose-500">*</span>
              {mode === 'edit' && (
                <span className="text-slate-400 font-normal">(编辑模式不可改)</span>
              )}
            </label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as MenuNodeType)}
              disabled={mode === 'edit'}
              className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="CATALOG">目录(CATALOG)</option>
              <option value="MENU">菜单(MENU)</option>
              <option value="BUTTON">按钮(BUTTON)</option>
            </select>
            <p className="text-[10px] text-slate-400">
              {type === 'CATALOG' && '目录:一级导航分组,父节点固定为 0(根)'}
              {type === 'MENU' && '菜单:可点击的导航项,父节点必须为目录'}
              {type === 'BUTTON' && '按钮:页面内的功能按钮,父节点必须为菜单'}
            </p>
          </div>

          {/* menuName */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              菜单名称 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={menuName}
              onChange={(e) => setMenuName(e.target.value)}
              maxLength={64}
              placeholder="例如: 系统配置"
              className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {/* pid */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              归属父节点{' '}
              {type !== 'CATALOG' && <span className="text-rose-500">*</span>}
              <span className="text-slate-400 font-normal">
                ({type === 'CATALOG' ? '目录无父节点' : type === 'MENU' ? '父=目录' : '父=菜单'})
              </span>
            </label>
            <select
              value={pid}
              onChange={(e) => setPid(e.target.value)}
              disabled={type === 'CATALOG'}
              className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="">请选择</option>
              {validPids.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.menuName}
                </option>
              ))}
            </select>
            {type === 'CATALOG' && (
              <p className="text-[10px] text-slate-400">目录的父节点固定为 0(根)</p>
            )}
          </div>

          {/* permission */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              权限标识 code{' '}
              {type === 'BUTTON' && <span className="text-rose-500">*</span>}
              <span className="text-slate-400 font-normal">(全局唯一,鉴权用,如 menu:create)</span>
            </label>
            <input
              type="text"
              value={permission}
              onChange={(e) => setPermission(e.target.value)}
              maxLength={128}
              placeholder="例如: menu:create"
              className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white font-mono"
            />
          </div>

          {/* icon */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              图标标识 <span className="text-slate-400 font-normal">(lucide 名称或自定义 key)</span>
            </label>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              maxLength={128}
              placeholder="例如: settings"
              className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white font-mono"
            />
          </div>

          {/* clientType */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              客户端类型 <span className="text-slate-400 font-normal">(不选则通用)</span>
            </label>
            <select
              value={clientType}
              onChange={(e) => setClientType(e.target.value as 'PC' | 'IPAD' | '')}
              className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none"
            >
              <option value="">通用</option>
              <option value="PC">PC</option>
              <option value="IPAD">IPAD</option>
            </select>
          </div>

          {/* applicationScope */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              菜单应用范围 <span className="text-rose-500">*</span>
            </label>
            <select
              value={applicationScope}
              onChange={(e) => {
                const v = e.target.value;
                if (isAppScope(v)) setApplicationScope(v);
              }}
              className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none"
            >
              <option value="ALL">通用(ALL)</option>
              <option value="CHANNEL">渠道(CHANNEL)</option>
              <option value="TENANT">租户(TENANT)</option>
              <option value="ADMIN">管理员(ADMIN)</option>
              <option value="EMPTY">空(EMPTY)</option>
            </select>
            <p className="text-[10px] text-slate-400">
              决定菜单在哪些场景下可见。EMPTY 表示禁用
            </p>
          </div>

          {/* sort */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">排序</label>
            <input
              type="number"
              value={sort}
              onChange={(e) => setSort(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none font-mono"
            />
            <p className="text-[10px] text-slate-400">同级菜单按 sort 升序展示,默认 0</p>
          </div>

          {/* description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={255}
              rows={3}
              placeholder="对菜单用途的简要说明,限 255 字"
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
              菜单层级:目录(CATALOG)→ 菜单(MENU)→ 按钮(BUTTON)。按钮类型的 permission
              字段会用于后端 @SaCheckPermission 鉴权,务必全局唯一。
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
            {submitting && (
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {mode === 'create' ? '确认创建' : '保存修改'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MenuEditDrawer;