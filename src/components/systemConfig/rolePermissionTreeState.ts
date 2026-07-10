import type { MenuNode } from '../../types';

export type RolePermissionNodeState = 'checked' | 'partial' | 'unchecked';

export const collectRolePermissionNodeIds = (node: MenuNode): string[] => {
  const ids: string[] = [node.id];

  if (node.children) {
    for (const child of node.children) {
      ids.push(...collectRolePermissionNodeIds(child));
    }
  }

  return ids;
};

export const calcRolePermissionNodeState = (
  node: MenuNode,
  checkedIds: ReadonlySet<string>
): RolePermissionNodeState => {
  if (node.type === 'BUTTON') {
    return checkedIds.has(node.id) ? 'checked' : 'unchecked';
  }

  const nodeIds = collectRolePermissionNodeIds(node);
  const checkedCount = nodeIds.filter((id) => checkedIds.has(id)).length;

  if (checkedCount === 0) return 'unchecked';
  if (checkedCount === nodeIds.length) return 'checked';
  return 'partial';
};
