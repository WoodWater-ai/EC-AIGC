import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./RolePermissionMatrixModal.tsx', import.meta.url), 'utf8');

assert.equal(
  source.includes('仅按钮可勾选'),
  false,
  'modal subtitle should not claim only buttons are selectable'
);

assert.equal(
  source.includes('目录、菜单与按钮节点均可勾选'),
  true,
  'modal subtitle should describe CATALOG, MENU, and BUTTON node selection'
);

assert.equal(
  source.includes('勾选或取消勾选对应的按钮'),
  false,
  'info banner should not describe the interaction as button-only'
);

assert.equal(
  source.includes('勾选或取消勾选对应的权限节点'),
  true,
  'info banner should describe selecting permission nodes'
);

console.info('RolePermissionMatrixModal copy tests passed');
