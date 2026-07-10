/**
 * 公共常量 —— 系统配置模块用
 */

/** 角色枚举映射（后端 EnumRole code → 前端中文 label） */
export const ROLE_LABELS: Record<string, string> = {
  ADMIN: '管理员',
  DESIGNER: '高级设计师',
  OPERATOR: '运营策划',
  AUDITOR: '审核员',
  MANAGER: '管理者',
  CLIENT: '协同客户',
};

/** 用户状态（后端 Y/N → 前端展示） */
export const USER_STATUS_MAP: Record<'Y' | 'N', { label: string; color: string }> = {
  Y: { label: '启用', color: 'emerald' },
  N: { label: '停用', color: 'slate' },
};

/** 部门状态 */
export const DEPT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  ENABLE: { label: '启用', color: 'emerald' },
  DISABLE: { label: '停用', color: 'slate' },
};
