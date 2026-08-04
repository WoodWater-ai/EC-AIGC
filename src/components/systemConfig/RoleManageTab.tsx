import React, { useEffect, useState } from 'react';
import { Shield, Lock, Plus, Edit, Trash2 } from 'lucide-react';
import { getRoleList, deleteRole, type RoleInfo } from '../../api/roleMenu';
import RolePermissionMatrixModal from './RolePermissionMatrixModal';
import RoleEditDrawer from './RoleEditDrawer';
import { useConfirm } from '../common/ConfirmProvider';
import { useAuth } from '../../auth/AuthContext';

interface RoleManageTabProps {
  onRolePermissionChange?: () => void;
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  管理员: '最高管理角色。拥有全局账号维护、一键模型启停、算力限额控制等核心运维操作权限。',
  高级设计师: '内容设计组主导角色。拥有批量生成任务调度、商品素材提报、模板及负面避坑中心配置权。',
  运营策划: '运营业务端发起人。主要负责生产任务排号启动、基础素材评分、审核,及全量数据统计分析。',
  协同客户: '跨部门或企业外部协同账号。拥有查看分享生成的成品、在线提出审核与对生图结果批注的权限。',
};

export const RoleManageTab: React.FC<RoleManageTabProps> = ({ onRolePermissionChange }) => {
  const { hasPermission, hasAnyPermission } = useAuth();
  const canCreateRole = hasAnyPermission(['role:create', 'role:config']);
  const canEditRole = hasAnyPermission(['role:edit', 'role:config']);
  const canDeleteRole = hasAnyPermission(['role:delete', 'role:config']);
  const canConfigureRole = hasPermission('role:config');
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [activeRole, setActiveRole] = useState<RoleInfo | null>(null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleInfo | null>(null);
  const confirm = useConfirm();

  const refetch = async () => {
    setLoading(true);
    try {
      const res = await getRoleList({ pageNum: 1, pageSize: 50 });
      setRoles(res.list || []);
    } catch {
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, []);

  const openMatrix = (role: RoleInfo) => {
    if (role.sysRole || !canConfigureRole) return;
    setActiveRole(role);
    setMatrixOpen(true);
  };

  const openCreateDrawer = () => {
    if (!canCreateRole) return;
    setEditingRole(null);
    setEditDrawerOpen(true);
  };

  const openEditDrawer = (role: RoleInfo) => {
    if (role.sysRole || !canEditRole) return;
    setEditingRole(role);
    setEditDrawerOpen(true);
  };

  const handleDeleteRole = async (role: RoleInfo) => {
    if (role.sysRole || !canDeleteRole) return;
    const ok = await confirm({
      title: '删除角色',
      message: `将删除「${role.roleName}」角色。该角色下若仍有关联用户,删除会失败。请确认。`,
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteRole(role.id);
      await refetch();
      onRolePermissionChange?.();
    } catch {
      // http interceptor already toasts
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <h4 className="text-xs font-bold text-slate-800">RBAC 角色权限模型说明</h4>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
            系统采用标准基于角色的权限控制模型(RBAC)。每个员工账号通过分配系统角色,自动继承对应的功能细分权限。请选择下方角色进行"配置授权权限矩阵"。
          </p>
        </div>
        {canCreateRole && <button
          onClick={openCreateDrawer}
          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          新建角色
        </button>}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-xs">加载中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {roles.map((role) => {
            const desc = ROLE_DESCRIPTIONS[role.roleName] || role.description || '—';
            const isBuiltIn = !!role.sysRole;
            return (
              <div
                key={role.id}
                className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] text-slate-400 font-mono block">Code: {role.roleCode}</span>
                      <h4 className="text-sm font-bold text-slate-800 mt-0.5 flex items-center gap-1.5">
                        {role.roleName}
                        {isBuiltIn && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-bold">
                            内置
                          </span>
                        )}
                      </h4>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed text-justify">{desc}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-400" />
                    功能权限点(详见矩阵)
                  </span>
                  <div className="flex items-center gap-1.5">
                    {!isBuiltIn && (canEditRole || canDeleteRole) && (
                      <>
                        {canEditRole && <button
                          onClick={() => openEditDrawer(role)}
                          title="编辑角色"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>}
                        {canDeleteRole && <button
                          onClick={() => handleDeleteRole(role)}
                          title="删除角色"
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>}
                      </>
                    )}
                    <button
                      onClick={() => openMatrix(role)}
                      disabled={isBuiltIn || !canConfigureRole}
                      title={isBuiltIn ? '系统内置角色不允许修改权限' : !canConfigureRole ? '当前账号没有角色配置权限' : ''}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                        isBuiltIn || !canConfigureRole
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100'
                      }`}
                    >
                      配置权限
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RolePermissionMatrixModal
        open={matrixOpen}
        roleId={activeRole?.id ?? null}
        roleName={activeRole?.roleName ?? null}
        onClose={() => setMatrixOpen(false)}
        onSaved={() => {
          refetch();
          onRolePermissionChange?.();
        }}
      />

      <RoleEditDrawer
        open={editDrawerOpen}
        editingRole={editingRole}
        onClose={() => {
          setEditDrawerOpen(false);
          setEditingRole(null);
        }}
        onSaved={() => {
          refetch();
          onRolePermissionChange?.();
        }}
      />
    </div>
  );
};

export default RoleManageTab;
