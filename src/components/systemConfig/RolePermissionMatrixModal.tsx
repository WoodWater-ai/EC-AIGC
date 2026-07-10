import React, { useEffect, useState } from 'react';
import { X, ChevronRight, ChevronDown, Info, Check } from 'lucide-react';
import type { MenuNode } from '../../types';
import { getMenuTree, getRoleMenuIds, assignMenus } from '../../api/roleMenu';
import { useConfirm } from '../common/ConfirmProvider';
import {
  calcRolePermissionNodeState,
  collectRolePermissionNodeIds,
} from './rolePermissionTreeState';

interface RolePermissionMatrixModalProps {
  open: boolean;
  roleId: string | null;
  roleName: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const collectCheckedIds = (nodes: MenuNode[]): string[] => {
  const out: string[] = [];
  const walk = (ns: MenuNode[]) => {
    for (const n of ns) {
      out.push(n.id);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
};

const collectAncestors = (tree: MenuNode[], targetIds: string[]): Set<string> => {
  const ancestors = new Set<string>();
  const find = (ns: MenuNode[], parents: string[]): boolean => {
    for (const n of ns) {
      const cur = [...parents, n.id];
      if (targetIds.includes(n.id)) {
        parents.forEach((p) => ancestors.add(p));
        ancestors.add(n.id);
      }
      if (n.children?.length) find(n.children, cur);
    }
    return false;
  };
  find(tree, []);
  return ancestors;
};

export const RolePermissionMatrixModal: React.FC<RolePermissionMatrixModalProps> = ({
  open,
  roleId,
  roleName,
  onClose,
  onSaved,
}) => {
  const [fullTree, setFullTree] = useState<MenuNode[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const confirm = useConfirm();

  useEffect(() => {
    if (!open || !roleId) return;

    setLoading(true);
    Promise.all([getMenuTree(), getRoleMenuIds(roleId)])
      .then(([tree, menuIds]) => {
        setFullTree(tree);
        const ids = menuIds.map(String);
        setCheckedIds(new Set(ids));
        setExpandedIds(collectAncestors(tree, ids));
      })
      .catch(() => {
        setFullTree([]);
        setCheckedIds(new Set());
        setExpandedIds(new Set());
      })
      .finally(() => setLoading(false));
  }, [open, roleId]);

  if (!open) return null;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleParentClick = (node: MenuNode) => {
    if (node.type === 'BUTTON') {
      toggleCheck(node.id);
      return;
    }

    setCheckedIds((prev) => {
      const next = new Set(prev);
      const nodeIds = collectRolePermissionNodeIds(node);
      const allChecked = nodeIds.every((nodeId) => next.has(nodeId));

      if (allChecked) {
        nodeIds.forEach((nodeId) => next.delete(nodeId));
      } else {
        nodeIds.forEach((nodeId) => next.add(nodeId));
      }
      return next;
    });
  };

  const presetFull = (nodes: MenuNode[]) => {
    const ids = new Set<string>();
    const walk = (ns: MenuNode[]) => {
      for (const n of ns) {
        ids.add(String(n.id));
        if (n.children) walk(n.children);
      }
    };
    walk(nodes);
    setCheckedIds(ids);
  };

  const presetReadOnly = (nodes: MenuNode[]) => {
    const ids = new Set<string>();
    const walk = (ns: MenuNode[]) => {
      for (const n of ns) {
        if (n.type === 'CATALOG' || n.type === 'MENU') {
          ids.add(String(n.id));
        }
        if (n.children) walk(n.children);
      }
    };
    walk(nodes);
    setCheckedIds(ids);
  };

  const handleSave = async () => {
    if (!roleId) return;
    const ok = await confirm({
      title: '保存授权方案',
      message: `将替换「${roleName}」角色的所有菜单权限,确认?`,
      confirmText: '保存',
    });
    if (!ok) return;
    setSaving(true);
    try {
      await assignMenus(roleId, Array.from(checkedIds));
      onSaved();
      onClose();
    } catch {
      // toast already
    } finally {
      setSaving(false);
    }
  };

  const renderNode = (node: MenuNode, depth: number) => {
    const isExpandable = node.type !== 'BUTTON' && (node.children?.length || 0) > 0;
    const isExpanded = expandedIds.has(node.id);
    const state = calcRolePermissionNodeState(node, checkedIds);

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2 py-2 px-3 hover:bg-slate-50/50 rounded-md cursor-pointer"
          style={{ paddingLeft: 12 + depth * 20 }}
          onClick={() => handleParentClick(node)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isExpandable) toggleExpand(node.id);
            }}
            className={`p-0.5 ${isExpandable ? 'text-slate-400' : 'text-transparent'}`}
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          <div
            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
              state === 'checked'
                ? 'border-blue-600 bg-blue-600 text-white'
                : state === 'partial'
                ? 'border-blue-400 bg-blue-100'
                : 'border-slate-300'
            }`}
          >
            {state === 'checked' && <Check className="w-2.5 h-2.5 stroke-[3px]" />}
            {state === 'partial' && <div className="w-2 h-0.5 bg-blue-500" />}
          </div>

          <div className="flex items-center gap-2 flex-1">
            <span
              className={`text-xs ${
                node.type === 'BUTTON' ? 'font-bold text-slate-800' : 'text-slate-600'
              }`}
            >
              {node.menuName}
            </span>
            {node.permission && (
              <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                {node.permission}
              </span>
            )}
            {node.type === 'CATALOG' && (
              <span className="text-[9px] px-1 py-0.5 bg-purple-50 text-purple-600 border border-purple-100 rounded font-bold">
                目录
              </span>
            )}
            {node.type === 'MENU' && (
              <span className="text-[9px] px-1 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded font-bold">
                菜单
              </span>
            )}
            {node.type === 'BUTTON' && (
              <span className="text-[9px] px-1 py-0.5 bg-slate-50 text-slate-600 border border-slate-200 rounded font-bold">
                按钮
              </span>
            )}
          </div>
        </div>

        {isExpandable && isExpanded && node.children && (
          <div>{node.children.map((c) => renderNode(c, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-[#0B1C30]/50 backdrop-blur-xs cursor-pointer" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-[560px] bg-white shadow-2xl flex flex-col z-50">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">RBAC 功能授权配置矩阵</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              定制专属角色「{roleName || ''}」的全套功能授权(目录、菜单与按钮节点均可勾选)
            </p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => presetFull(fullTree)}
                className="px-2 py-1 text-[10px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded"
              >
                一键全选
              </button>
              <button
                onClick={() => presetReadOnly(fullTree)}
                className="px-2 py-1 text-[10px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded"
              >
                一键只读
              </button>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-xs">加载中...</div>
          ) : (
            <>
              <div className="bg-blue-50/60 p-3 rounded-lg text-[11px] text-slate-500 leading-relaxed border border-blue-100/30 mb-4 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                <span>
                  勾选或取消勾选对应的权限节点。保存后,隶属于「{roleName || ''}」角色的所有协作账号会立即按新矩阵生效,并同步记录入系统审计操作日志。
                </span>
              </div>
              <div className="space-y-0.5">
                {fullTree.map((n) => renderNode(n, 0))}
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex justify-between items-center shrink-0">
          <span className="text-[10px] text-slate-400 font-mono">
            已勾选 {Array.from(checkedIds).length} 个节点
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              保存授权方案
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RolePermissionMatrixModal;
