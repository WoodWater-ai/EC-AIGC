import React from 'react';
import type { MenuResponse } from '../api/types';

interface Props {
  node: MenuResponse;
  depth: number;
  selectedIds: Set<number>;
  expandedIds: Set<number>;
  onToggle: (id: number, checked: boolean) => void;
  onExpand: (id: number) => void;
}

/**
 * 菜单授权树节点 —— 递归组件
 * 用于角色管理 → 授权菜单抽屉
 * 也可复用于菜单管理页的树视图
 */
export const MenuAuthTreeNode: React.FC<Props> = ({
  node,
  depth,
  selectedIds,
  expandedIds,
  onToggle,
  onExpand,
}) => {
  const id = node.id ?? -1;
  const isChecked = selectedIds.has(id);
  const isExpanded = expandedIds.has(id);
  const hasChildren = (node.children?.length ?? 0) > 0;

  return (
    <div style={{ marginLeft: depth * 20 }} className="select-none">
      <div className="flex items-center gap-2 py-1.5 hover:bg-slate-50 rounded px-2">
        <button
          onClick={() => onExpand(id)}
          className={`w-4 h-4 flex items-center justify-center text-slate-400 text-[10px] ${
            hasChildren ? '' : 'invisible'
          }`}
          type="button"
        >
          {isExpanded ? '▼' : '▶'}
        </button>
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => onToggle(id, e.target.checked)}
          className="w-3.5 h-3.5"
        />
        <span className="text-xs font-semibold text-slate-700">{node.menuName}</span>
        <span className="text-[10px] text-slate-400 font-mono">({node.type})</span>
        {node.permission && (
          <span className="text-[10px] text-blue-500 font-mono">{node.permission}</span>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <MenuAuthTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedIds={selectedIds}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onExpand={onExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};
