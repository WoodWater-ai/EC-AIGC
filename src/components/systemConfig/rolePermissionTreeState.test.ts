import assert from 'node:assert/strict';
import type { MenuNode } from '../../types';
import {
  calcRolePermissionNodeState,
  collectRolePermissionNodeIds,
} from './rolePermissionTreeState';

const permissionTree: MenuNode = {
  id: 'catalog-system',
  pid: '0',
  menuName: '系统配置',
  type: 'CATALOG',
  children: [
    {
      id: 'menu-role',
      pid: 'catalog-system',
      menuName: '角色管理',
      type: 'MENU',
      children: [
        {
          id: 'button-role-add',
          pid: 'menu-role',
          menuName: '新增角色',
          type: 'BUTTON',
          permission: 'role:add',
        },
        {
          id: 'button-role-config',
          pid: 'menu-role',
          menuName: '配置权限',
          type: 'BUTTON',
          permission: 'role:config',
        },
      ],
    },
  ],
};

const menuNode = permissionTree.children![0];
const addButton = menuNode.children![0];

assert.deepEqual(collectRolePermissionNodeIds(permissionTree), [
  'catalog-system',
  'menu-role',
  'button-role-add',
  'button-role-config',
]);

assert.equal(
  calcRolePermissionNodeState(addButton, new Set(['button-role-add'])),
  'checked',
  'BUTTON should be checked when its own id is selected'
);

assert.equal(
  calcRolePermissionNodeState(addButton, new Set()),
  'unchecked',
  'BUTTON should be unchecked when its own id is not selected'
);

assert.equal(
  calcRolePermissionNodeState(permissionTree, new Set()),
  'unchecked',
  'CATALOG should be unchecked when no self or descendant id is selected'
);

assert.equal(
  calcRolePermissionNodeState(permissionTree, new Set([
    'catalog-system',
    'menu-role',
    'button-role-add',
    'button-role-config',
  ])),
  'checked',
  'CATALOG should be checked when self and all descendants are selected'
);

assert.equal(
  calcRolePermissionNodeState(permissionTree, new Set(['menu-role'])),
  'partial',
  'CATALOG should be partial when a descendant MENU remains selected but buttons are unchecked'
);

assert.equal(
  calcRolePermissionNodeState(menuNode, new Set(['menu-role'])),
  'partial',
  'MENU should be partial when the menu itself remains selected but all child buttons are unchecked'
);

assert.equal(
  calcRolePermissionNodeState(permissionTree, new Set(['catalog-system', 'menu-role'])),
  'partial',
  'Read-only selection of CATALOG + MENU should be partial, not unchecked'
);

console.info('rolePermissionTreeState tests passed');
