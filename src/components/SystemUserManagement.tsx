import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, UserPlus, Edit, Trash2, X, Key, Info, RotateCcw } from 'lucide-react';
import { userApi } from '../api/modules/user';
import { departmentApi } from '../api/modules/department';
import { roleApi } from '../api/modules/role';
import { md5UpperCase } from '../utils/crypto';
import type {
  UserResponse,
  UserAddRequest,
  DepartmentTreeNode,
  RoleResponse,
  PageInfo,
} from '../api/types';

/**
 * 系统配置 → 用户管理（独立主 Tab）
 * 2026-07-09 用户决策升级:从 SystemConfig.tsx 的"账号与角色"中移出
 * 涵盖账号列表 + 新建/编辑/删除/启停/重置密码
 */
export const SystemUserManagement: React.FC = () => {
  // ===== state =====
  const [apiUsers, setApiUsers] = useState<UserResponse[]>([]);
  const [apiUsersTotal, setApiUsersTotal] = useState(0);
  const [apiUsersLoading, setApiUsersLoading] = useState(false);
  const [userPageNum, setUserPageNum] = useState(1);
  const [userStatusFilter, setUserStatusFilter] = useState<'' | 'Y' | 'N'>('');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('全部部门');
  const [deptNameToNode, setDeptNameToNode] = useState<Record<string, DepartmentTreeNode>>({});
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  const [rolesList, setRolesList] = useState<RoleResponse[]>([]);

  // 角色分配
  const [formRoleIds, setFormRoleIds] = useState<number[]>([]);
  const [showRolePicker, setShowRolePicker] = useState(false);

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editSelectedUser, setEditSelectedUser] = useState<UserResponse | null>(null);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formStatus, setFormStatus] = useState<'online' | 'offline'>('online');

  // 重置密码
  const [resetPwdUserId, setResetPwdUserId] = useState<number | null>(null);
  const [resetPwdValue, setResetPwdValue] = useState('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ===== fetch =====
  const fetchUsers = useCallback(async () => {
    setApiUsersLoading(true);
    try {
      const page: PageInfo<UserResponse> = await userApi.list({
        pageNum: userPageNum,
        pageSize: 20,
        name: searchQuery || undefined,
        status: userStatusFilter || undefined,
      });
      setApiUsers(page.list ?? []);
      setApiUsersTotal(page.total);
    } catch (e) {
      // axios 已 toast
    } finally {
      setApiUsersLoading(false);
    }
  }, [userPageNum, searchQuery, userStatusFilter]);

  const fetchDepartments = useCallback(async () => {
    try {
      const list = await departmentApi.list({ pageNum: 1, pageSize: 200 });
      const map = new Map<number, DepartmentTreeNode>();
      list.forEach((d) => map.set(d.id!, { ...d, children: [] } as DepartmentTreeNode));
      const nameMap: Record<string, DepartmentTreeNode> = {};
      list.forEach((d) => {
        if (d.deptName) nameMap[d.deptName] = map.get(d.id!)!;
      });
      setDeptNameToNode(nameMap);
      setDepartments(
        list.map((d) => ({ id: String(d.id), name: d.deptName ?? '' })),
      );
    } catch (e) {
      // axios 已 toast
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const page: PageInfo<RoleResponse> = await roleApi.list({ pageNum: 1, pageSize: 100 });
      setRolesList(page.list ?? []);
    } catch (e) {
      // axios 已 toast
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);
  useEffect(() => {
    fetchDepartments();
    fetchRoles();
  }, [fetchDepartments, fetchRoles]);

  // ===== utils =====
  // 2026-07-09 修白屏:Date 构造对无效输入(NaN/字符串/越界)会 throw RangeError,
  // 用 try/catch + 类型守卫兜底,后端字段为 null/undefined/0 都安全。
  const formatTs = (ts: unknown): string => {
    if (ts == null) return '-';
    const n = typeof ts === 'number' ? ts : Number(ts);
    if (!Number.isFinite(n) || n <= 0) return '-';
    try {
      return new Date(n).toISOString().split('T')[0];
    } catch {
      return '-';
    }
  };

  const getDeptForUser = (_user: UserResponse): string => {
    // TODO: TICKET-105 落地后,接口应返回 user.deptName
    return '未分配';
  };

  const filteredUsers = useMemo(() => {
    return apiUsers.filter((u) => {
      const matchSearch =
        !searchQuery ||
        (u.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.userName ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.phone ?? '').includes(searchQuery);
      const userDept = getDeptForUser(u);
      const matchDept = selectedDept === '全部部门' || userDept === selectedDept;
      return matchSearch && matchDept;
    });
  }, [apiUsers, searchQuery, selectedDept]);

  // ===== handlers =====
  const handleOpenCreateDrawer = () => {
    setDrawerMode('create');
    setFormName('');
    setFormEmail('');
    setFormStatus('online');
    setFormRoleIds([]);
    setFormPassword('');
    setEditSelectedUser(null);
    setSelectedUserId(null);
    setIsDrawerOpen(true);
  };

  const handleOpenEditDrawer = async (user: UserResponse) => {
    if (!user.id) return;
    try {
      const detail = await userApi.detail(user.id);
      setEditSelectedUser(detail);
      setFormName(detail.name ?? '');
      setFormEmail(detail.userName ?? detail.phone ?? '');
      setFormStatus(detail.status === 'DISABLED' ? 'offline' : 'online');
      setFormRoleIds([]);
      setFormPassword('');
      setSelectedUserId(String(detail.id));
      setDrawerMode('edit');
      setIsDrawerOpen(true);
    } catch (e) {
      // axios 已 toast
    }
  };

  const handleSaveUser = async () => {
    if (!formName.trim() || !formEmail.trim()) {
      alert('请填写完整的姓名与账号！');
      return;
    }
    if (drawerMode === 'create' && !formPassword.trim()) {
      alert('请输入初始密码！');
      return;
    }

    try {
      if (drawerMode === 'create') {
        const req: UserAddRequest = {
          userName: formEmail,
          phone: formEmail,
          name: formName,
          password: md5UpperCase(formPassword),
          roleIds: formRoleIds,
        };
        await userApi.add(req);
        triggerToast(`账号「${formName}」已成功创建！`);
      } else if (drawerMode === 'edit' && selectedUserId) {
        const req: UserAddRequest = {
          userName: formEmail,
          phone: formEmail,
          name: formName,
          password: 'placeholder',
          roleIds: formRoleIds,
        };
        await userApi.update({ ...req, id: Number(selectedUserId) });
        triggerToast(`账号「${formName}」配置修改已成功保存！`);
      }
      setIsDrawerOpen(false);
      await fetchUsers();
    } catch (e) {
      // axios 已 toast
    }
  };

  const handleToggleUserStatus = async (userId: number, currentStatus: 'Y' | 'N') => {
    const nextStatus: 'Y' | 'N' = currentStatus === 'Y' ? 'N' : 'Y';
    try {
      await userApi.updateStatus(userId, nextStatus);
      await fetchUsers();
      triggerToast(`账号已${nextStatus === 'Y' ? '启用' : '停用'}`);
    } catch (e) {
      // axios 已 toast
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('确定要删除该账号吗？此操作不可恢复。')) return;
    try {
      await userApi.remove(userId);
      await fetchUsers();
      triggerToast('账号已删除');
    } catch (e) {
      // axios 已 toast
    }
  };

  const handleResetPassword = async () => {
    if (!resetPwdUserId) return;
    if (!resetPwdValue.trim()) {
      alert('请输入新密码');
      return;
    }
    try {
      await userApi.resetPassword(resetPwdUserId, md5UpperCase(resetPwdValue));
      triggerToast('密码已重置');
      setResetPwdUserId(null);
      setResetPwdValue('');
    } catch (e) {
      // axios 已 toast
    }
  };

  // ===== render =====
  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg text-xs font-bold animate-fadeIn">
          {toastMessage}
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3 shadow-xs">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-bold text-slate-800">用户管理</h4>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            当前系统账号由管理员统一在后台分配创建，暂不开放企业员工自助注册。如需新增人员，请点击右侧「新建账号」。
          </p>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/60 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <input
                type="text"
                placeholder="搜索姓名/账号"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-60 bg-slate-50 border border-slate-200 text-xs px-3 py-2 pl-9 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-700 transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg text-slate-700 outline-none"
            >
              <option value="全部部门">全部部门</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              value={userStatusFilter}
              onChange={(e) => setUserStatusFilter(e.target.value as '' | 'Y' | 'N')}
              className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg text-slate-700 outline-none"
            >
              <option value="">全部状态</option>
              <option value="Y">启用</option>
              <option value="N">停用</option>
            </select>
          </div>

          <button
            onClick={handleOpenCreateDrawer}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            新建账号
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-5">姓名</th>
                <th className="py-3 px-5">登录账号</th>
                <th className="py-3 px-5">所属部门</th>
                <th className="py-3 px-5">系统角色</th>
                <th className="py-3 px-5">状态</th>
                <th className="py-3 px-5">加入日期</th>
                <th className="py-3 px-5 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 font-semibold">
                    暂无符合条件的员工账号记录
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const initials = (user.name ?? '?').charAt(0);
                  const userDept = getDeptForUser(user);
                  const isOnline = user.status !== 'DISABLED';
                  const isAdmin = user.isAdmin === true;
                  const joinedDate = formatTs(user.firstLoginTime);

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/40 transition-colors group">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center border border-blue-100 shrink-0 select-none">
                            {initials}
                          </div>
                          <span className="font-bold text-slate-800 text-sm">{user.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-slate-500">
                        {user.userName ?? user.phone ?? '-'}
                      </td>
                      <td className="py-3.5 px-5 text-slate-600">{userDept}</td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isAdmin
                              ? 'bg-blue-50 text-blue-600 border-blue-200'
                              : 'bg-purple-50 text-purple-600 border-purple-200'
                          }`}
                        >
                          {isAdmin ? '管理员' : '普通用户'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          {isOnline ? '启用' : '停用'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-slate-400">{joinedDate}</td>
                      <td className="py-3.5 px-5 text-right font-semibold">
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            onClick={() => handleOpenEditDrawer(user)}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            编辑
                          </button>
                          <button
                            onClick={() => handleResetPasswordInit(user.id!)}
                            className="text-amber-600 hover:text-amber-800 flex items-center gap-0.5 cursor-pointer"
                          >
                            <Key className="w-3.5 h-3.5" />
                            重置密码
                          </button>
                          <button
                            onClick={() =>
                              handleToggleUserStatus(user.id!, user.status === 'DISABLED' ? 'N' : 'Y')
                            }
                            className={`flex items-center gap-0.5 cursor-pointer ${
                              isOnline
                                ? 'text-rose-500 hover:text-rose-700'
                                : 'text-emerald-500 hover:text-emerald-700'
                            }`}
                          >
                            {isOnline ? '停用' : '启用'}
                          </button>
                          <button
                            onClick={() => user.id && handleDeleteUser(user.id)}
                            className="text-slate-400 hover:text-rose-600 flex items-center gap-0.5 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50 text-slate-400 select-none">
          <span className="font-mono text-[11px]">共 {filteredUsers.length} 条记录</span>
          <div className="flex gap-1">
            <button
              onClick={() => setUserPageNum(Math.max(1, userPageNum - 1))}
              disabled={userPageNum === 1}
              className="w-7 h-7 rounded border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
            >
              &lt;
            </button>
            <span className="w-7 h-7 rounded bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
              {userPageNum}
            </span>
            <button
              onClick={() => setUserPageNum(userPageNum + 1)}
              disabled={userPageNum * 20 >= apiUsersTotal}
              className="w-7 h-7 rounded border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      {/* Edit/Create Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-[#0B1C30]/40 backdrop-blur-xs"
            onClick={() => setIsDrawerOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[480px] bg-white shadow-2xl flex flex-col">
            <div className="px-6 py-5 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-800">
                {drawerMode === 'create' ? '新建账号' : '编辑账号'}
              </h3>
              <button onClick={() => setIsDrawerOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700">姓名 *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">登录账号（手机号）*</label>
                <input
                  type="text"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none"
                />
              </div>
              {drawerMode === 'create' && (
                <div>
                  <label className="text-xs font-bold text-slate-700">初始密码 *</label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none"
                    autoComplete="new-password"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-slate-700">账号状态</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as 'online' | 'offline')}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none"
                >
                  <option value="online">启用</option>
                  <option value="offline">停用</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">角色分配</label>
                <button
                  onClick={() => setShowRolePicker(!showRolePicker)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg text-left text-slate-700"
                >
                  已选 {formRoleIds.length} 个角色 ▼
                </button>
                {showRolePicker && (
                  <div className="mt-1 max-h-40 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                    {rolesList.map((r) => (
                      <label
                        key={r.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={formRoleIds.includes(r.id!)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormRoleIds([...formRoleIds, r.id!]);
                            } else {
                              setFormRoleIds(formRoleIds.filter((id) => id !== r.id));
                            }
                          }}
                        />
                        <span>{r.roleName}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="px-4 py-2 border rounded-lg text-xs"
              >
                取消
              </button>
              <button
                onClick={handleSaveUser}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPwdUserId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1C30]/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl p-6 w-[400px] shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <RotateCcw className="w-4 h-4 text-amber-600" />
              <h3 className="font-bold text-slate-800">重置密码</h3>
            </div>
            <label className="text-xs font-bold text-slate-700">新密码</label>
            <input
              type="password"
              value={resetPwdValue}
              onChange={(e) => setResetPwdValue(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none"
              autoComplete="new-password"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setResetPwdUserId(null);
                  setResetPwdValue('');
                }}
                className="px-4 py-2 border rounded-lg text-xs"
              >
                取消
              </button>
              <button
                onClick={handleResetPassword}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold"
              >
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function handleResetPasswordInit(userId: number) {
    setResetPwdUserId(userId);
    setResetPwdValue('');
  }
};
