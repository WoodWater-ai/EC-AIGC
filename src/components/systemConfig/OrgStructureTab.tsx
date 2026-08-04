import React, { useState, useMemo, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  Network, Building2, ChevronDown, ChevronRight, User,
  Plus, Edit, Trash2, X, Info, CheckCircle2
} from 'lucide-react';
import { departmentApi, type DepartmentDTO, type DepartmentStatus } from '../../api/modules/department';
import { useServiceQuery } from '../../api/hooks/useServiceQuery';
import { useConfirm } from '../common/ConfirmProvider';
import type { SystemUser } from '../../types';
import { useAuth } from '../../auth/AuthContext';

// —— Props interface + ref(给 SystemConfig 反查部门用) ——
export interface OrgStructureTabRef {
  getDeptNameByUserId: (userId: string) => string;
  getAllDepartments: () => DepartmentDTO[];
}

export interface OrgStructureTabProps {
  /** 当前用户列表(用于计算 KPI 直属员工/总人数 + 部门负责人下拉) */
  users: SystemUser[];
  /** 员工编辑时调用:userId 改到新 deptId */
  onAssignUser: (userId: string, deptId: string) => Promise<void>;
}

export const OrgStructureTab = forwardRef<OrgStructureTabRef, OrgStructureTabProps>(
  ({ users: propUsers, onAssignUser: _onAssignUser }, ref) => {
    const { hasPermission } = useAuth();
    const canManageOrg = hasPermission('org:manage');
    // —— 1. 加载部门列表(后端 list 是平铺,前端 useMemo 转 Map) ——
    const { data: deptList, loading, refetch } = useServiceQuery<DepartmentDTO[]>(
      () => departmentApi.list({ pageNum: 1, pageSize: 1000 }),
      []
    );

    // —— 2. 直接用后端数据(Phase 2 后端 description/managerName/managerUserId 字段已就位) ——
    const departments: DepartmentDTO[] = deptList ?? [];

    // —— 3. 部门 Map 供反查 + 树形化 ——
    const deptMap = useMemo(() => new Map(departments.map(d => [d.id, d])), [departments]);
    const rootDepts = useMemo(
      () => departments.filter(d => d.pid === '0' || !d.pid),
      [departments]
    );

    // —— 4. localUsers 取 prop 注入的 users ——
    const localUsers = propUsers;

    const confirm = useConfirm();

    // —— 5. 暴露 ref 给 SystemConfig 反查 ——
    useImperativeHandle(ref, () => ({
      getDeptNameByUserId: (userId: string) => {
        const u = localUsers.find(x => x.id === userId);
        if (!u?.deptId) return '未分配';
        return deptMap.get(u.deptId)?.deptName || '未知部门';
      },
      getAllDepartments: () => departments,
    }), [localUsers, deptMap, departments]);

    // —— 6. 部门展开状态(纯 UI 控制) ——
    const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});
    useEffect(() => {
      // 初次加载时,把所有根部门展开
      const init: Record<string, boolean> = {};
      rootDepts.forEach(d => { init[d.id] = true; });
      setExpandedDepts(init);
    }, [rootDepts.length]);

    // —— 7. 部门 Drawer 状态 ——
    const [isDeptDrawerOpen, setIsDeptDrawerOpen] = useState(false);
    const [deptDrawerMode, setDeptDrawerMode] = useState<'create' | 'edit'>('create');
    const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

    const [deptFormName, setDeptFormName] = useState('');
    const [deptFormCode, setDeptFormCode] = useState('');
    const [deptFormParentId, setDeptFormParentId] = useState<string | null>(null);
    const [deptFormManager, setDeptFormManager] = useState('');  // userId 字符串
    const [deptFormDescription, setDeptFormDescription] = useState('');

    // —— 8. Toast ——
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const triggerToast = (msg: string) => {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 3000);
    };

    // —— 9. 打开 Drawer(create / edit) ——
    const handleOpenCreateDeptDrawer = (initialParentId: string | null = null) => {
      if (!canManageOrg) return;
      setDeptDrawerMode('create');
      setDeptFormName('');
      setDeptFormCode('');
      setDeptFormParentId(initialParentId);
      setDeptFormManager('');
      setDeptFormDescription('');
      setSelectedDeptId(null);
      setIsDeptDrawerOpen(true);
    };

    const handleOpenEditDeptDrawer = (dept: DepartmentDTO) => {
      if (!canManageOrg) return;
      setDeptDrawerMode('edit');
      setDeptFormName(dept.deptName);
      setDeptFormCode(dept.deptCode);
      setDeptFormParentId(dept.pid === '0' ? null : dept.pid);
      // managerName 来自后端 join,但 select 需要 userId
      const managerUser = dept.managerUserId
        ? localUsers.find(u => u.id === dept.managerUserId)
        : localUsers.find(u => u.name === dept.managerName);
      setDeptFormManager(managerUser?.id || '');
      setDeptFormDescription(dept.description || '');
      setSelectedDeptId(dept.id);
      setIsDeptDrawerOpen(true);
    };

    // —— 10. 后代判断(供 Drawer 上级 select 排除循环) ——
    const isDescendant = (parentCandidateId: string, childId: string): boolean => {
      let current: DepartmentDTO | undefined = deptMap.get(parentCandidateId);
      while (current && current.pid && current.pid !== '0') {
        if (current.pid === childId) return true;
        current = deptMap.get(current.pid);
      }
      return false;
    };

    // —— 11. 保存部门 ——
    const handleSaveDepartment = async () => {
      if (!canManageOrg) return;
      if (!deptFormName.trim() || !deptFormCode.trim()) {
        triggerToast('请填写完整的部门名称和唯一编码');
        return;
      }
      const codeUpper = deptFormCode.toUpperCase().trim();

      try {
        if (deptDrawerMode === 'create') {
          const newId = await departmentApi.create({
            pid: deptFormParentId || '0',
            deptName: deptFormName,
            deptCode: codeUpper,
            status: 'ENABLE',
            description: deptFormDescription || undefined,
            managerUserId: deptFormManager || undefined,
          });
          triggerToast(`部门「${deptFormName}」已成功创建`);
        } else if (deptDrawerMode === 'edit' && selectedDeptId) {
          if (deptFormParentId === selectedDeptId) {
            triggerToast('无法将部门自身选为上级部门');
            return;
          }
          await departmentApi.update({
            id: selectedDeptId,
            pid: deptFormParentId || '0',
            deptName: deptFormName,
            deptCode: codeUpper,
            description: deptFormDescription || undefined,
            managerUserId: deptFormManager || undefined,
          });
          triggerToast(`部门「${deptFormName}」信息已成功保存`);
        }
        setIsDeptDrawerOpen(false);
        refetch();
      } catch {
        // HTTP 拦截器已 toast
      }
    };

    // —— 12. 删除部门(用 useConfirm) ——
    const handleDeleteDepartment = async (dept: DepartmentDTO) => {
      if (!canManageOrg) return;
      // 前端双重检查
      const hasChildren = departments.some(d => d.pid === dept.id);
      if (hasChildren) {
        triggerToast('无法删除:当前部门仍包含下属部门');
        return;
      }
      const deptMembers = localUsers.filter(u => u.deptId === dept.id);
      if (deptMembers.length > 0) {
        triggerToast(`无法删除:当前部门下仍有 ${deptMembers.length} 名绑定员工`);
        return;
      }

      const ok = await confirm({
        title: '删除部门',
        message: `将删除部门「${dept.deptName}」(${dept.deptCode})。该操作不可恢复,请确认。`,
        confirmText: '删除',
        danger: true,
      });
      if (!ok) return;

      try {
        await departmentApi.remove(dept.id);
        triggerToast(`部门「${dept.deptName}」已成功移除`);
        refetch();
      } catch {
        // HTTP 拦截器已 toast
      }
    };

    // —— 13. 递归员工数(含子部门) ——
    const getEmployeeCount = (deptId: string): number => {
      let count = localUsers.filter(u => u.deptId === deptId).length;
      departments.filter(d => d.pid === deptId).forEach(cd => {
        count += getEmployeeCount(cd.id);
      });
      return count;
    };

    // —— 14. 渲染单个部门节点 ——
    const renderDepartmentNode = (dept: DepartmentDTO, depth: number) => {
      const children = departments.filter(d => d.pid === dept.id);
      const isExpanded = !!expandedDepts[dept.id];
      const hasChildren = children.length > 0;

      const directMembers = localUsers.filter(u => u.deptId === dept.id);
      const totalMembers = getEmployeeCount(dept.id);

      const toggleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedDepts(prev => ({ ...prev, [dept.id]: !prev[dept.id] }));
      };

      const managerDisplay = (() => {
        if (dept.managerUserId) {
          const u = localUsers.find(x => x.id === dept.managerUserId);
          if (u) return u.name;
        }
        if (dept.managerName) return dept.managerName;
        return null;
      })();

      return (
        <div key={dept.id} className="space-y-2 select-none" style={{ marginLeft: depth > 0 ? `${depth * 16}px` : '0px' }}>
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
                  <span className="text-xs font-bold text-slate-800">{dept.deptName}</span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 font-mono rounded font-bold uppercase border border-slate-200/40">
                    {dept.deptCode}
                  </span>
                  {managerDisplay && (
                    <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200/50 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      负责人: {managerDisplay}
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
                  直属员工: <strong className="text-slate-700 font-bold font-mono">{directMembers.length}</strong>
                </span>
                <span className="text-[10px] text-blue-500 bg-blue-50/70 px-2 py-1 rounded-lg font-semibold">
                  总人数: <strong className="text-blue-600 font-bold font-mono">{totalMembers}</strong>
                </span>
              </div>

              {canManageOrg && <div className="flex items-center gap-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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
                  onClick={() => handleDeleteDepartment(dept)}
                  title="删除空置部门"
                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>}
            </div>
          </div>

          {hasChildren && isExpanded && (
            <div className="relative pl-3 border-l-2 border-slate-100 ml-4 space-y-2.5">
              {children.map(child => renderDepartmentNode(child, 0))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="space-y-6 relative" id="org-structure-container">
        {/* TOAST */}
        {toastMessage && (
          <div className="fixed top-20 right-8 z-50 bg-[#0B1C30] text-white px-4 py-3 rounded-xl border border-blue-500/30 shadow-2xl flex items-center gap-2.5 animate-bounce-short">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* 提示 banner */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3 shadow-xs">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-slate-800">组织架构功能提示</h4>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed font-semibold">
              本面板支持创建与管理多级归属部门,建立层级化的业务关联。
              你可以通过将子部门绑定到上级,直观地呈现企业多层树状组织脉络。鼠标悬停在对应部门卡片上可以快速 <strong>"新增子部门"</strong>、<strong>"编辑配置"</strong> 或 <strong>"删除空置部门"</strong>。
            </p>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs">
            <span className="text-[10px] font-mono text-slate-400 block uppercase font-bold">Total Departments</span>
            <span className="text-xl font-bold text-slate-800 block mt-1">{departments.length} 个</span>
            <span className="text-[10px] text-emerald-500 font-semibold block mt-1">已建立多级层级结构</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs">
            <span className="text-[10px] font-mono text-slate-400 block uppercase font-bold">Active Staff Mapped</span>
            <span className="text-xl font-bold text-slate-800 block mt-1">{localUsers.length} 人</span>
            <span className="text-[10px] text-slate-400 font-semibold block mt-1">全量绑定到所属部门</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs">
            <span className="text-[10px] font-mono text-slate-400 block uppercase font-bold">Primary Departments</span>
            <span className="text-xl font-bold text-slate-800 block mt-1">{rootDepts.length} 个</span>
            <span className="text-[10px] text-blue-500 font-semibold block mt-1">含总部核心支柱业务</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs">
            <span className="text-[10px] font-mono text-slate-400 block uppercase font-bold">Unassigned</span>
            <span className="text-xl font-bold text-slate-800 block mt-1">
              {localUsers.filter(u => !u.deptId).length} 人
            </span>
            <span className="text-[10px] text-slate-400 font-semibold block mt-1">新入职员工自动绑定</span>
          </div>
        </div>

        {/* 部门树 Card */}
        <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden shadow-xs flex flex-col">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Network className="w-4 h-4 text-blue-600" />
              企业多级组织部门树状图
            </span>
            {canManageOrg && <button
              onClick={() => handleOpenCreateDeptDrawer(null)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              新增一级部门
            </button>}
          </div>

          <div className="p-5 md:p-6 space-y-3.5 bg-slate-50/30">
            {loading ? (
              <div className="text-center py-12 text-slate-400 font-semibold">加载中...</div>
            ) : rootDepts.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-semibold">
                暂无一级根部门,请先点击右上角新增一级部门!
              </div>
            ) : (
              rootDepts.map(root => renderDepartmentNode(root, 0))
            )}
          </div>
        </div>

        {/* 部门 Drawer */}
        {isDeptDrawerOpen && (
          <div className="fixed inset-0 z-50 flex" id="new-dept-drawer">
            <div
              className="absolute inset-0 bg-[#0B1C30]/40 backdrop-blur-xs transition-opacity cursor-pointer"
              onClick={() => setIsDeptDrawerOpen(false)}
            />

            <div className="absolute right-0 top-0 h-full w-[480px] bg-white shadow-2xl flex flex-col transform transition-transform duration-300 z-50 animate-slide-in-right">
              <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Network className="w-5 h-5 text-blue-600" />
                  {deptDrawerMode === 'create' ? '新建组织部门' : '编辑部门配置'}
                </h3>
                <button
                  onClick={() => setIsDeptDrawerOpen(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-blue-600 border-l-4 border-blue-600 pl-2">基本信息</h4>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      部门名称 <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      value={deptFormName}
                      onChange={(e) => setDeptFormName(e.target.value)}
                      placeholder="例如: 智能创意二组"
                      className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-semibold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      部门唯一编码 <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      value={deptFormCode}
                      onChange={(e) => setDeptFormCode(e.target.value)}
                      placeholder="例如: DESIGN-G2"
                      disabled={deptDrawerMode === 'edit'}
                      className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-mono uppercase font-bold disabled:opacity-60"
                    />
                    <p className="text-[10px] text-slate-400 leading-normal">
                      创建后编码不可修改,用于 API 映射或系统后台日志定位。
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">上级归属部门</label>
                    <select
                      value={deptFormParentId || ''}
                      onChange={(e) => setDeptFormParentId(e.target.value || null)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none text-slate-700 font-semibold"
                    >
                      <option value="">(无上级部门 - 设为一级部门)</option>
                      {departments
                        .filter(d => d.id !== selectedDeptId && (!selectedDeptId || !isDescendant(d.id, selectedDeptId)))
                        .map(d => (
                          <option key={d.id} value={d.id}>{d.deptName}</option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">部门负责人 / 领队</label>
                    <select
                      value={deptFormManager}
                      onChange={(e) => setDeptFormManager(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none text-slate-700 font-semibold"
                    >
                      <option value="">请选择负责人</option>
                      {localUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">部门简要描述</label>
                    <textarea
                      value={deptFormDescription}
                      onChange={(e) => setDeptFormDescription(e.target.value)}
                      placeholder="请输入部门的核心业务简介,限 100 字以内..."
                      rows={3}
                      className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-semibold resize-none"
                    />
                  </div>
                </div>

                <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-400 leading-normal">
                    组织架构调整后将实时影响「员工账号」以及「模型通道分配」的归属范围,并且相关变更会自动记录在操作日志中。
                  </p>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
                <button
                  onClick={() => setIsDeptDrawerOpen(false)}
                  className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  取消
                </button>
                {canManageOrg && <button
                  onClick={handleSaveDepartment}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {deptDrawerMode === 'create' ? '确认创建' : '保存修改'}
                </button>}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

OrgStructureTab.displayName = 'OrgStructureTab';
