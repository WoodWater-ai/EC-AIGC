import React, { useState, useEffect, useCallback } from 'react';
import {
  Info,
  Building2,
  Plus,
  Edit,
  Trash2,
  X,
  User,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { departmentApi } from '../api/modules/department';
import { userApi } from '../api/modules/user';
import type { DepartmentTreeNode, UserResponse } from '../api/types';

export interface Department {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  description: string;
  managerName: string;
}

/**
 * 系统配置 → 组织架构（独立主 Tab）
 * 2026-07-09 用户决策升级:从 SystemConfig.tsx 的"组织架构"tab 移出
 * 涵盖部门树形 CRUD + Drawer
 */
export const SystemDeptManagement: React.FC = () => {
  // ===== state =====
  const [departmentTree, setDepartmentTree] = useState<DepartmentTreeNode[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [apiUsers, setApiUsers] = useState<UserResponse[]>([]);
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});

  // Drawer state
  const [isDeptDrawerOpen, setIsDeptDrawerOpen] = useState(false);
  const [deptDrawerMode, setDeptDrawerMode] = useState<'create' | 'edit'>('create');
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

  // Form fields
  const [deptFormName, setDeptFormName] = useState('');
  const [deptFormCode, setDeptFormCode] = useState('');
  const [deptFormParentId, setDeptFormParentId] = useState<string | null>(null);
  const [deptFormManager, setDeptFormManager] = useState('');
  const [deptFormDescription, setDeptFormDescription] = useState('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ===== fetch =====
  const fetchDepartments = useCallback(async () => {
    try {
      const list = await departmentApi.list({ pageNum: 1, pageSize: 200 });
      // 简易 buildTree
      const map = new Map<number, DepartmentTreeNode>();
      const roots: DepartmentTreeNode[] = [];
      list.forEach((d) =>
        map.set(d.id!, { ...d, children: [] } as DepartmentTreeNode),
      );
      list.forEach((d) => {
        if (d.pid === 0 || !d.pid) {
          roots.push(map.get(d.id!)!);
        } else {
          const parent = map.get(d.pid);
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(map.get(d.id!)!);
          }
        }
      });
      setDepartmentTree(roots);

      // 同步扁平列表,给 Drawer 的 parentId 下拉用
      setDepartments(
        list.map((d) => ({
          id: String(d.id),
          name: d.deptName ?? '',
          code: d.deptCode ?? '',
          parentId: d.pid ? String(d.pid) : null,
          description: d.description ?? '',
          managerName: d.managerName ?? '',
        })),
      );
    } catch (e) {
      // axios 已 toast
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const page = await userApi.list({ pageNum: 1, pageSize: 200 });
      setApiUsers(page.list ?? []);
    } catch (e) {
      // axios 已 toast
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
    fetchUsers();
  }, [fetchDepartments, fetchUsers]);

  // ===== utils =====
  const isDescendant = (parentCandidateId: string, childId: string): boolean => {
    let current = departments.find((d) => d.id === parentCandidateId);
    while (current && current.parentId) {
      if (current.parentId === childId) return true;
      current = departments.find((d) => d.id === current.parentId);
    }
    return false;
  };

  // ===== handlers =====
  const handleOpenCreateDeptDrawer = (initialParentId: string | null = null) => {
    setDeptDrawerMode('create');
    setDeptFormName('');
    setDeptFormCode('');
    setDeptFormParentId(initialParentId);
    setDeptFormManager('');
    setDeptFormDescription('');
    setSelectedDeptId(null);
    setIsDeptDrawerOpen(true);
  };

  const handleOpenEditDeptDrawer = (dept: Department) => {
    setDeptDrawerMode('edit');
    setDeptFormName(dept.name);
    setDeptFormCode(dept.code);
    setDeptFormParentId(dept.parentId);
    setDeptFormManager(dept.managerName);
    setDeptFormDescription(dept.description);
    setSelectedDeptId(dept.id);
    setIsDeptDrawerOpen(true);
  };

  const handleSaveDepartment = async () => {
    if (!deptFormName.trim() || !deptFormCode.trim()) {
      alert('请填写完整的部门名称和唯一编码！');
      return;
    }

    const codeUpper = deptFormCode.toUpperCase().trim();
    const isCodeDup = departments.some(
      (d) => d.code === codeUpper && d.id !== selectedDeptId,
    );
    if (isCodeDup) {
      alert(`部门编码「${codeUpper}」已存在，请使用唯一的编码！`);
      return;
    }

    if (deptDrawerMode === 'edit' && selectedDeptId) {
      if (deptFormParentId === selectedDeptId) {
        alert('无法将部门自身选为上级部门！');
        return;
      }
      if (deptFormParentId && isDescendant(deptFormParentId, selectedDeptId)) {
        alert('上级部门不能设为当前部门的下属子部门，这会导致无限循环！');
        return;
      }
    }

    try {
      const req = {
        deptName: deptFormName,
        deptCode: codeUpper,
        pid: deptFormParentId ? Number(deptFormParentId) : 0,
        description: deptFormDescription,
        managerName: deptFormManager,
      };
      if (deptDrawerMode === 'create') {
        await departmentApi.add(req as any);
        triggerToast(`部门「${deptFormName}」已成功创建！`);
      } else if (selectedDeptId) {
        await departmentApi.update({ ...req, id: Number(selectedDeptId) } as any);
        triggerToast(`部门「${deptFormName}」信息已成功保存！`);
      }
      setIsDeptDrawerOpen(false);
      await fetchDepartments();
    } catch (e) {
      // axios 已 toast
    }
  };

  const handleDeleteDepartment = async (deptId: string) => {
    const hasChildren = departments.some((d) => d.parentId === deptId);
    if (hasChildren) {
      alert('无法删除该部门：当前部门仍包含下属部门，请先调整下属部门的上级归属！');
      return;
    }
    if (!confirm('确定要删除该部门吗？')) return;
    try {
      await departmentApi.remove(Number(deptId));
      triggerToast('部门已成功移除！');
      await fetchDepartments();
    } catch (e) {
      // axios 已 toast
    }
  };

  // ===== render department tree node =====
  const renderDepartmentNode = (dept: Department, depth: number): React.ReactNode => {
    const children = departments.filter((d) => d.parentId === dept.id);
    const isExpanded = !!expandedDepts[dept.id];
    const hasChildren = children.length > 0;

    const getEmployeeCount = (dId: string): number => {
      let count = apiUsers.filter((u) => u.deptId != null && String(u.deptId) === dId).length;
      const childDepts = departments.filter((d) => d.parentId === dId);
      childDepts.forEach((cd) => {
        count += getEmployeeCount(cd.id);
      });
      return count;
    };

    const directMembers = apiUsers.filter(
      (u) => u.deptId != null && String(u.deptId) === dept.id,
    );
    const totalMembers = getEmployeeCount(dept.id);

    const toggleExpand = (e: React.MouseEvent) => {
      e.stopPropagation();
      setExpandedDepts((prev) => ({ ...prev, [dept.id]: !prev[dept.id] }));
    };

    return (
      <div
        key={dept.id}
        className="space-y-2 select-none"
        style={{ marginLeft: depth > 0 ? `${depth * 16}px` : '0px' }}
      >
        <div className="group bg-white rounded-xl border border-slate-200/60 p-4 hover:border-blue-300 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 relative">
          <div className="flex items-start gap-3">
            <button
              onClick={toggleExpand}
              className={`p-1 mt-0.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer text-slate-400 hover:text-slate-600 ${
                !hasChildren ? 'opacity-30 pointer-events-none' : ''
              }`}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            <div className="p-2.5 bg-blue-50/60 text-blue-600 rounded-xl border border-blue-100/40">
              <Building2 className="w-5 h-5 shrink-0" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-800">{dept.name}</span>
                <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 font-mono rounded font-bold uppercase border border-slate-200/40">
                  {dept.code}
                </span>
                {dept.managerName && (
                  <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200/50 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    负责人: {dept.managerName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 leading-normal max-w-xl">
                {dept.description || '暂无部门业务范围详细说明。'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 self-end md:self-auto">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 bg-slate-100/80 px-2 py-1 rounded-lg font-semibold">
                直属员工:{' '}
                <strong className="text-slate-700 font-bold font-mono">{directMembers.length}</strong>
              </span>
              <span className="text-[10px] text-blue-500 bg-blue-50/70 px-2 py-1 rounded-lg font-semibold">
                总人数:{' '}
                <strong className="text-blue-600 font-bold font-mono">{totalMembers}</strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleOpenCreateDeptDrawer(dept.id)}
                title="添加子部门"
                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleOpenEditDeptDrawer(dept)}
                title="编辑配置"
                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteDepartment(dept.id)}
                title="删除空置部门"
                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div className="space-y-2">{children.map((c) => renderDepartmentNode(c, depth + 1))}</div>
        )}
      </div>
    );
  };

  // ===== KPI =====
  const rootDepts = departments.filter((d) => d.parentId === null);
  const maxDepth = (() => {
    const compute = (id: string, depth: number): number => {
      const children = departments.filter((d) => d.parentId === id);
      if (children.length === 0) return depth;
      return Math.max(...children.map((c) => compute(c.id, depth + 1)));
    };
    return rootDepts.length > 0 ? Math.max(...rootDepts.map((d) => compute(d.id, 1))) : 0;
  })();
  const totalEmployees = apiUsers.filter((u) => u.deptId != null).length;

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg text-xs font-bold animate-fadeIn">
          {toastMessage}
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3 shadow-xs">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-bold text-slate-800">组织架构功能提示</h4>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed font-semibold">
            本面板支持创建与管理多级归属部门，建立层级化的业务关联。
            你可以通过将子部门绑定到上级，直观地呈现企业多层树状组织脉络。鼠标悬停在对应部门卡片上可以快速 新增子部门、编辑配置 或 删除空置部门。
          </p>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs">
          <span className="text-[10px] font-mono text-slate-400 block uppercase font-bold">
            Total Departments
          </span>
          <span className="text-xl font-bold text-slate-800 block mt-1">
            {departments.length} 个
          </span>
          <span className="text-[10px] text-emerald-500 font-semibold block mt-1">
            已建立 {maxDepth} 级层级结构
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs">
          <span className="text-[10px] font-mono text-slate-400 block uppercase font-bold">
            Active Staff Mapped
          </span>
          <span className="text-xl font-bold text-slate-800 block mt-1">
            {totalEmployees} 人
          </span>
          <span className="text-[10px] text-slate-400 font-semibold block mt-1">
            全量绑定到所属部门
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs">
          <span className="text-[10px] font-mono text-slate-400 block uppercase font-bold">
            Root Branches
          </span>
          <span className="text-xl font-bold text-slate-800 block mt-1">
            {rootDepts.length} 个
          </span>
          <span className="text-[10px] text-blue-500 font-semibold block mt-1">
            顶级部门节点
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs">
          <span className="text-[10px] font-mono text-slate-400 block uppercase font-bold">
            Hierarchy Depth
          </span>
          <span className="text-xl font-bold text-slate-800 block mt-1">
            {maxDepth} 层
          </span>
          <span className="text-[10px] text-purple-500 font-semibold block mt-1">
            最大组织纵深
          </span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex justify-end">
        <button
          onClick={() => handleOpenCreateDeptDrawer()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          新增一级部门
        </button>
      </div>

      {/* Department Tree */}
      <div className="bg-slate-50/30 rounded-xl p-4">
        {rootDepts.length === 0 ? (
          <div className="text-center py-12 text-slate-400 font-semibold">
            暂无一级根部门，请先点击右上角新增一级部门！
          </div>
        ) : (
          rootDepts.map((d) => renderDepartmentNode(d, 0))
        )}
      </div>

      {/* Department Drawer */}
      {isDeptDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-[#0B1C30]/40 backdrop-blur-xs"
            onClick={() => setIsDeptDrawerOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[480px] bg-white shadow-2xl flex flex-col">
            <div className="px-6 py-5 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-800">
                {deptDrawerMode === 'create' ? '新增部门' : '编辑部门'}
              </h3>
              <button onClick={() => setIsDeptDrawerOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700">部门名称 *</label>
                <input
                  type="text"
                  value={deptFormName}
                  onChange={(e) => setDeptFormName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">部门编码 *</label>
                <input
                  type="text"
                  value={deptFormCode}
                  onChange={(e) => setDeptFormCode(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">上级部门</label>
                <select
                  value={deptFormParentId ?? ''}
                  onChange={(e) => setDeptFormParentId(e.target.value || null)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none"
                >
                  <option value="">顶级部门</option>
                  {departments
                    .filter((d) => d.id !== selectedDeptId)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">负责人</label>
                <select
                  value={deptFormManager}
                  onChange={(e) => setDeptFormManager(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none"
                >
                  <option value="">请选择负责人</option>
                  {apiUsers.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name}
                      {u.isAdmin ? '(管理员)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">部门描述</label>
                <textarea
                  rows={4}
                  value={deptFormDescription}
                  onChange={(e) => setDeptFormDescription(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none"
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setIsDeptDrawerOpen(false)}
                className="px-4 py-2 border rounded-lg text-xs"
              >
                取消
              </button>
              <button
                onClick={handleSaveDepartment}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
