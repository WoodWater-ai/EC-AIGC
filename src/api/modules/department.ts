/**
 * 部门管理 API 封装
 *
 * 严格镜像后端 AdminDepartmentController 9 个端点 + Department*Request/Response DTO
 *
 * 字段命名规则:
 * - Long 字段(后端 @JsonSerialize ToStringSerializer 已处理)→ 前端用 string
 * - status 枚举(ENABLE/DISABLE) → string 字面量联合
 * - 字段名严格对齐后端,不做 camelCase/snake_case 互转
 *
 * @see dafenqi-ai/.../web/controller/admin/department/AdminDepartmentController.java
 */
import http from '../client';

export type DepartmentStatus = 'ENABLE' | 'DISABLE';

export interface DepartmentDTO {
  id: string;          // 后端 @JsonSerialize → string
  pid: string;         // 0 = 根
  deptName: string;
  deptCode: string;
  sort?: number;
  status: DepartmentStatus;
  description?: string | null;   // P1 TODO,DB 迁移期间可能 null
  managerName?: string | null;   // P1 TODO,后端 join user 表反查
  managerUserId?: string | null; // P1 TODO,Phase 3 后端字段就位后启用,Phase 1 永远 null
  createTime: string;  // ISO 8601
  updateTime: string;
}

export interface DepartmentCreateRequest {
  pid?: string;          // 0 或不传 = 根
  deptName: string;
  deptCode: string;
  sort?: number;
  status?: DepartmentStatus;
  description?: string;  // P1:DB 迁移就位后必传
  managerUserId?: string;  // P1:存 userId(防用户名变更不一致)
}

export interface DepartmentUpdateRequest extends DepartmentCreateRequest {
  id: string;
}

export interface DepartmentUserDTO {
  id: string;
  deptId: string;
  userId: string;
  userName?: string;
  phone?: string;
  isMain?: 'Y' | 'N';
}

export const departmentApi = {
  /** 列表(分页,通常传 pageSize:1000 一次拉全,前端做树形化) */
  list: (q: { deptName?: string; status?: DepartmentStatus; pageNum?: number; pageSize?: number } = {}) =>
    http.post<DepartmentDTO[]>('/v1/admin/department/list', q),

  /** 详情 */
  detail: (id: string) =>
    http.post<DepartmentDTO>('/v1/admin/department/detail', { id }),

  /** 新增,返回新部门 ID(string) */
  create: (req: DepartmentCreateRequest) =>
    http.post<string>('/v1/admin/department/add', req),

  /** 更新 */
  update: (req: DepartmentUpdateRequest) =>
    http.post<void>('/v1/admin/department/update', req),

  /** 删除(后端自带校验) */
  remove: (id: string) =>
    http.post<void>('/v1/admin/department/delete', { id }),

  /** 启停用 —— 本 plan 前端不调,保留供后续启用 */
  status: (id: string, status: DepartmentStatus) =>
    http.post<void>('/v1/admin/department/status', { id, status }),

  /** 部门关联用户 —— 员工账号 Tab 改部门时调用 */
  assignUser: (deptId: string, userIdList: string[], mainUserId?: string) =>
    http.post<void>('/v1/admin/department/user/assign', { deptId, userIdList, mainUserId }),

  /** 部门解绑用户 */
  unassignUser: (deptId: string, userIdList: string[]) =>
    http.post<void>('/v1/admin/department/user/unassign', { deptId, userIdList }),

  /** 部门下用户列表(本 plan 不直接用,见 spec §6.3) */
  userList: (deptId: string) =>
    http.post<DepartmentUserDTO[]>('/v1/admin/department/user/list', { deptId }),
};
