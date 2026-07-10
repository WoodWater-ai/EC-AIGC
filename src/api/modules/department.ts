/**
 * 部门管理 API —— 对接后端 AdminDepartmentController
 *
 * 后端路径：/v1/admin/department/*
 * 鉴权：类级 @SaCheckLogin
 *
 * 备注：/tree 接口在 TICKET-108 落地前暂用 /list + 前端 buildTree
 *       TICKET-108 落地后切到 /tree
 */
import http from '../client';
import type {
  DepartmentResponse,
  DepartmentTreeNode,
  DepartmentAddRequest,
  DepartmentUserAssignRequest,
  DepartmentUserResponse,
  PageInfo,
} from '../types';

/** 平铺列表（备用接口） */
export async function list(params: {
  pageNum?: number;
  pageSize?: number;
  deptName?: string;
  status?: string;
}): Promise<DepartmentResponse[]> {
  return http.post<DepartmentResponse[]>('/v1/admin/department/list', params);
}

/** 树形接口（TICKET-108 落地后启用） */
export async function tree(): Promise<DepartmentTreeNode[]> {
  return http.get<DepartmentTreeNode[]>('/v1/admin/department/tree');
}

/** 详情 */
export async function detail(id: number): Promise<DepartmentResponse> {
  return http.post<DepartmentResponse>('/v1/admin/department/detail', { id });
}

/** 新增 */
export async function add(req: DepartmentAddRequest): Promise<number> {
  return http.post<number>('/v1/admin/department/add', req);
}

/** 编辑 */
export async function update(req: DepartmentAddRequest & { id: number }): Promise<void> {
  return http.post<void>('/v1/admin/department/update', req);
}

/** 删除 */
export async function remove(id: number): Promise<void> {
  return http.post<void>('/v1/admin/department/delete', { id });
}

/** 启停用 */
export async function updateStatus(
  id: number,
  status: 'ENABLE' | 'DISABLE',
): Promise<void> {
  return http.post<void>('/v1/admin/department/status', { id, status });
}

/** 部门下用户列表 */
export async function userList(req: {
  deptId: number;
  pageNum: number;
  pageSize: number;
}): Promise<DepartmentUserResponse[]> {
  return http.post<DepartmentUserResponse[]>('/v1/admin/department/user/list', req);
}

/** 部门关联用户（含主部门） */
export async function assignUser(req: DepartmentUserAssignRequest): Promise<void> {
  return http.post<void>('/v1/admin/department/user/assign', req);
}

/** 部门解绑用户 */
export async function unassignUser(
  deptId: number,
  userIdList: number[],
): Promise<void> {
  return http.post<void>('/v1/admin/department/user/unassign', {
    deptId,
    userIdList,
  });
}

export const departmentApi = {
  list,
  tree,
  detail,
  add,
  update,
  remove,
  updateStatus,
  userList,
  assignUser,
  unassignUser,
};
