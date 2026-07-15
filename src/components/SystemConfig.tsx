import React, { useState, useMemo, useEffect } from 'react';
import { SystemUser } from '../types';
import { channelApi } from '../api/modules/channel';
import {
  type ModelChannelDTO,
  type ModelChannelAddRequest,
  type ModelChannelUpdateRequest,
  type ModelChannelQueryRequest,
  type ChannelType,
  type CapabilityMatrix,
  type CapabilityGroup,
  CHANNEL_TYPE_LABELS,
  CHANNEL_CATEGORIES,
  BASE_URL_PLACEHOLDERS,
  DEFAULT_MODEL_PLACEHOLDERS,
} from '../types';
import {
  Search,
  Plus,
  Check,
  Edit,
  Trash2,
  X,
  Info,
  Shield,
  UserCheck,
  Key,
  List,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  UserPlus,
  Sliders,
  Settings,
  HelpCircle,
  Lock,
  ChevronRight,
  ChevronDown,
  Building2,
  Users,
  User,
  PlusCircle,
  Network,
  Cloud,
  Database,
  Cpu,
  Layers,
  Film,
  Activity,
  CheckSquare
} from 'lucide-react';
import { MenuConfigTab } from './systemConfig/MenuConfigTab';
import RoleManageTab from './systemConfig/RoleManageTab';
import { OrgStructureTab, type OrgStructureTabRef } from './systemConfig/OrgStructureTab';
import { useRef } from 'react';
import { departmentApi, type DepartmentDTO } from '../api/modules/department';
import { useServiceQuery } from '../api/hooks/useServiceQuery';
import type { PageInfo } from '../api/service-result';
import { userApi, type UserDTO } from '../api/modules/user';
import { toast } from 'sonner';
import { getRoleList, type RoleInfo } from '../api/roleMenu';
import { useConfirm } from './common/ConfirmProvider';
import { isMockRuntime } from '../config/runtime';
import { mockUsers } from '../mockData';

interface SystemConfigProps {
  onUpdateUserRole: (id: string, role: any, deptId?: string) => void;
}

// Activity Log definition
interface OperationLog {
  id: string;
  operatorName: string;
  operatorRole: string;
  actionType: string;
  actionDetail: string;
  ipAddress: string;
  timestamp: string;
  status: 'success' | 'failed';
}

const MockAdminNotice: React.FC<{ title: string }> = ({ title }) => <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 text-sm text-slate-600"><p className="font-bold text-slate-800">{title} Demo</p><p className="mt-2 leading-6">当前为前端 mock 模式，页面不请求管理端接口，因此不支持保存真实组织、角色或菜单配置。接入后端后会自动启用对应管理能力。</p></div>;

export const SystemConfig: React.FC<SystemConfigProps> = ({
  onUpdateUserRole
}) => {
  // 1. High level main tabs
  const [activeMainTab, setActiveMainTab] = useState<'users' | 'org' | 'channels' | 'logs'>('users');
  
  // 2. User management sub-tabs
  const [activeUserSubTab, setActiveUserSubTab] = useState<'accounts' | 'roles' | 'menu'>('accounts');

  // 3. Search and department filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('全部部门');

  // 4. 真接用户列表(Phase 1.5) ——
  // localUsers 由 useServiceQuery(userApi.listAll) 派生,不再接收 prop users。
  // 这里走 useEffect + setLocalUsers 同步派生(SystemUser 字段含 isAdmin/status 转换,非纯函数映射)。
  // 注意:useServiceQuery 内部 data 初始为 null,ES6 解构 `= []` 只对 undefined 生效,所以用 ?? [] 显式 nullish
  const userListQuery = useServiceQuery<UserDTO[]>(
    () => isMockRuntime ? Promise.resolve(mockUsers.map((user) => ({ id: user.id, userName: user.email, name: user.name, headUrl: user.avatar, status: user.status === 'offline' ? 'DISABLED' as const : 'NORMAL' as const, isAdmin: user.role === '管理员', email: user.email }))) : userApi.listAll(),
    []
  );

  // Dynamic role list (from backend, replaces hardcoded 4 roles)
  const { data: roleList = [] } = useServiceQuery<RoleInfo[]>(
    async () => isMockRuntime ? [{ id: 'r1', roleName: '管理员', roleCode: 'ADMIN', sysRole: true, status: 'NORMAL' }, { id: 'r2', roleName: '设计/美工', roleCode: 'DESIGNER', status: 'NORMAL' }, { id: 'r3', roleName: '审核人', roleCode: 'REVIEWER', status: 'NORMAL' }] : (await getRoleList({ pageNum: 1, pageSize: 50 })).list ?? [],
    []
  );
  // Department list (direct backend query, decoupled from OrgStructureTab ref timing)
  const { data: deptList = [] } = useServiceQuery<DepartmentDTO[]>(
    () => isMockRuntime ? Promise.resolve([{ id: 'd1', pid: '0', deptName: '商品创意组', deptCode: 'CREATIVE', status: 'ENABLE' as const, createTime: '2026-07-01T09:00:00', updateTime: '2026-07-01T09:00:00' }]) : departmentApi.list({ pageNum: 1, pageSize: 1000 }),
    []
  );
  const allDepartments = deptList ?? [];

  // 通道能力矩阵(后端下发,驱动 chip 渲染 + baseUrl placeholder)
  const matrixQuery = useServiceQuery<CapabilityMatrix>(
    () => isMockRuntime ? Promise.resolve({ capabilities: [], matrix: {} } as CapabilityMatrix) : channelApi.getCapabilityMatrix(),
    []
  );
  const matrix = matrixQuery.data ?? null;
  const realUsers = userListQuery.data ?? [];
  const [localUsers, setLocalUsers] = useState<SystemUser[]>([]);
  useEffect(() => {
    setLocalUsers(realUsers.map(u => ({
      id: u.id,
      name: u.name || u.userName || u.phone || '(未命名)',
      avatar: u.headUrl || '',
      role: u.isAdmin ? '管理员' : '运营策划',  // P1 TODO:从 roleIds 查角色名
      email: u.email || u.phone || '',
      status: (u.status as 'NORMAL' | 'DISABLED') ?? 'NORMAL',  // 2026-07-11:对齐项目惯例 NORMAL/DISABLED(同 template/dict/role)
      joinedDate: '',  // UserResponse 无此字段
      deptId: u.deptId || undefined,
    })));
  }, [realUsers]);
  
  // 通道列表(直接走后端 page 接口,pageSize=1000 简化为全量拉,二期做分页 UI)
  // 通道列表:后端驱动筛选(channelFilter 变化时重新拉 page,避免通道多了前端卡)
  const [channelFilter, setChannelFilter] = useState<'all' | 'cloud' | 'local' | 'relay' | 'disabled'>('all');
  const channelListQuery = useServiceQuery<PageInfo<ModelChannelDTO>>(
    () => {
      // 按 tab 拼后端筛选条件
      const req: ModelChannelQueryRequest = { pageNum: 1, pageSize: 1000 };
      if (channelFilter === 'cloud') {
        // 云端 API:按 4 家云端 channelType 过滤(不过滤 status,NORMAL + DISABLED 都展示)
        req.channelTypes = ['OPENAI', 'QWEN', 'DOUBAO', 'DEEPSEEK'];
      } else if (channelFilter === 'disabled') {
        // 停用通道:按 status 过滤(不限 channelType)
        req.status = 'DISABLED';
      }
      // 本地模型和中转站当前由前端 mock 任务配置提供；真实接口接入后补 server-side type 筛选。
      return isMockRuntime ? Promise.resolve({ list: [], total: 0 } as PageInfo<ModelChannelDTO>) : channelApi.page(req);
    },
    [channelFilter]
  );
  const channels: ModelChannelDTO[] = channelListQuery.data?.list ?? [];

  // Ref to OrgStructureTab (for user→dept reverse lookup & department select data source)
  const orgTabRef = useRef<OrgStructureTabRef>(null);

  // Channel modal/drawer states
  const [isChannelDrawerOpen, setIsChannelDrawerOpen] = useState(false);
  const [channelDrawerMode, setChannelDrawerMode] = useState<'create' | 'edit'>('create');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  // Channel Form states
  const [channelFormName, setChannelFormName] = useState('');
  const [channelFormProvider, setChannelFormProvider] = useState<ChannelType>('OPENAI');
  const [channelFormBaseUrl, setChannelFormBaseUrl] = useState('https://api.openai.com/v1');
  const [channelFormApiKey, setChannelFormApiKey] = useState('');
  const [channelFormDefaultModels, setChannelFormDefaultModels] = useState<Partial<Record<CapabilityGroup, string>>>({});
  const [channelFormLimit, setChannelFormLimit] = useState(5000);
  const [channelFormConcurrencyLimit, setChannelFormConcurrencyLimit] = useState(10);
  const [channelFormTimeout, setChannelFormTimeout] = useState(60);
  const [channelFormRetryPolicy, setChannelFormRetryPolicy] = useState<'exponential' | 'linear' | 'none'>('exponential');
  const [channelFormCostRatio, setChannelFormCostRatio] = useState(0.015);
  const [channelFormCapabilities, setChannelFormCapabilities] = useState<string[]>(['MAIN_IMAGE', 'DETAIL_ENHANCE', 'BG_RECONSTRUCT']);

  // 5. Drawer state for adding / editing user
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Drawer Form fields
  const [formUserName, setFormUserName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formName, setFormName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDeptId, setFormDeptId] = useState('');
  const [formRoleIds, setFormRoleIds] = useState<string[]>([]);
  const [formStatus, setFormStatus] = useState<'NORMAL' | 'DISABLED'>('NORMAL');

  // Notification success toasts
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Reset password modal state
  const [resetPwdFor, setResetPwdFor] = useState<SystemUser | null>(null);
  const [resetPwdNew, setResetPwdNew] = useState('');

  // Pre-populated Operation logs for high fidelity
  const [logs, setLogs] = useState<OperationLog[]>([
    { id: 'l1', operatorName: '陆永奇', operatorRole: '管理员', actionType: '账号管理', actionDetail: '新建员工账号 zhangsf@company.com 并赋予超级管理员角色', ipAddress: '192.168.1.14', timestamp: '2026-07-06 10:15', status: 'success' },
    { id: 'l2', operatorName: '陆永奇', operatorRole: '管理员', actionType: '渠道配置', actionDetail: '启用 Kling AI 1.5 Pro Video Engine 通道并设置每日限额 500 Pts', ipAddress: '192.168.1.14', timestamp: '2026-07-06 09:30', status: 'success' },
    { id: 'l3', operatorName: '陈美晴', operatorRole: '高级设计师', actionType: '模板管理', actionDetail: '更新了模板「女装电商白底图 V2」的 Prompt 片段规则', ipAddress: '192.168.1.28', timestamp: '2026-07-05 14:24', status: 'success' },
    { id: 'l4', operatorName: '张思豪', operatorRole: '运营策划', actionType: '任务管理', actionDetail: '审核通过了批次素材 「T-1002 - 精华保湿乳」', ipAddress: '192.168.2.102', timestamp: '2026-07-05 11:15', status: 'success' },
    { id: 'l5', operatorName: '陆永奇', operatorRole: '管理员', actionType: '安全配置', actionDetail: '尝试修改超级管理员内置角色权限组 - 拒绝操作', ipAddress: '192.168.1.14', timestamp: '2026-07-04 16:40', status: 'failed' },
    { id: 'l6', operatorName: '系统自动', operatorRole: '系统账号', actionType: '任务监控', actionDetail: '批次任务 T-1003 内存不足抛出 CUDA 异常，发送系统警告通知', ipAddress: '127.0.0.1', timestamp: '2026-07-03 16:11', status: 'success' }
  ]);

  const confirm = useConfirm();

  // Map system role to department dynamically (via allDepartments,不再依赖 OrgStructureTab ref)
  const userDeptName = (u: SystemUser): string => {
    return allDepartments.find(d => d.id === u.deptId)?.deptName ?? '未分配';
  };

  // Filtered employee users
  const filteredUsers = useMemo(() => {
    return localUsers.filter(u => {
      const matchSearch = searchQuery === '' ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());

      const userDept = userDeptName(u);
      const matchDept = selectedDept === '全部部门' || userDept === selectedDept;

      return matchSearch && matchDept;
    });
    // orgTabRef.current is stable across renders (useImperativeHandle cache), no need to add as dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localUsers, searchQuery, selectedDept]);

  // 删前端 filteredChannels useMemo —— 筛选已下沉到后端 page 接口(channelFilter 变化触发 refetch)

  // Show a temporary success toast message
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Helper: assign user to department (calls department API + syncs local state + notifies App)
  const handleAssignUser = async (userId: string, deptId: string) => {
    const user = localUsers.find(u => u.id === userId);
    const oldDeptId = user?.deptId;
    try {
      if (oldDeptId && oldDeptId !== deptId) {
        await departmentApi.unassignUser(oldDeptId, [userId]);
      }
      if (deptId) {
        await departmentApi.assignUser(deptId, [userId], userId);
      }
      // Sync localUsers
      setLocalUsers(prev => prev.map(u => u.id === userId
        ? { ...u, deptId: deptId || undefined }
        : u
      ));
      // Notify App.tsx to persist deptId at the top level
      onUpdateUserRole(userId, user?.role || '运营策划', deptId || undefined);
    } catch {
      // HTTP interceptor already toasts
    }
  };

  // Open Drawer for creating new user
  const handleOpenCreateDrawer = () => {
    setDrawerMode('create');
    setFormUserName('');
    setFormPhone('');
    setFormName('');
    setFormPassword('');
    setFormCode('');
    setFormDeptId('');
    setFormRoleIds([]);
    setFormStatus('NORMAL');
    setSelectedUserId(null);
    setIsDrawerOpen(true);
  };

  // Open Drawer for editing user
  const handleOpenEditDrawer = async (user: SystemUser) => {
    setDrawerMode('edit');
    setSelectedUserId(user.id);
    try {
      // 详情走 userApi.detail(已修 GET)
      const detail = await userApi.detail(user.id);
      setFormUserName(detail.userName ?? '');
      setFormPhone(detail.phone ?? '');
      setFormName(detail.name ?? '');
      setFormCode(detail.code ?? '');
      setFormPassword('');  // 编辑时密码字段留空
      setFormDeptId(user.deptId || '');
      setFormRoleIds(detail.roleIds ?? []);
      setFormStatus((detail.status as 'NORMAL' | 'DISABLED') ?? 'NORMAL');
      // 注:formIsAdmin 已去除(2026-07-11 用户决定),后端 UserAddRequest.isAdmin 默认 'N'
    } catch {
      // toast 由 http 拦截器统一处理
      return;
    }
    setIsDrawerOpen(true);
  };

  // Save drawer form
  const handleSaveUser = async () => {
    if (!formUserName.trim() || !formName.trim()) {
      toast.error('请填写账号和姓名');
      return;
    }
    if (drawerMode === 'create' && !formPassword.trim()) {
      toast.error('请填写初始密码');
      return;
    }
    if (formRoleIds.length === 0) {
      toast.error('请至少选择 1 个角色');
      return;
    }
    try {
      if (drawerMode === 'create') {
        await userApi.add({
          userName: formUserName,
          phone: formPhone || undefined,
          name: formName,
          code: formCode || undefined,
          password: formPassword,
          // 注:isAdmin 已去除(2026-07-11 用户决定),不传,后端 schema 默认 'N'
          roleIds: formRoleIds,  // 直接发 string[] 防 Long 精度丢失(后端 @JsonSerialize 对齐)
        });
        toast.success(`账号「${formName}」创建成功`);
      } else if (drawerMode === 'edit' && selectedUserId) {
        await userApi.update({
          id: selectedUserId,
          userName: formUserName,
          // ★ phone / password 后端 UserUpdateRequest 暂不支持,本次不传
          name: formName,
          code: formCode || undefined,
          roleIds: formRoleIds,  // 直接发 string[] 防 Long 精度丢失(后端 @JsonSerialize 对齐)
        });
        // 部门变更:如果 formDeptId 跟当前不同
        const current = localUsers.find(u => u.id === selectedUserId);
        if (current && current.deptId !== formDeptId) {
          if (current.deptId) await departmentApi.unassignUser(current.deptId, [selectedUserId]);
          if (formDeptId) await departmentApi.assignUser(formDeptId, [selectedUserId], selectedUserId);
        }
        toast.success(`账号「${formName}」修改成功`);
      }
      await userListQuery.refetch();
      setIsDrawerOpen(false);
    } catch {
      // toast 由 http 拦截器统一处理
    }
  };

  // Toggle user active status (NORMAL ↔ DISABLED)
  const handleToggleUserStatus = async (userId: string, currentStatus: 'NORMAL' | 'DISABLED') => {
    const nextStatus = currentStatus === 'NORMAL' ? 'DISABLED' : 'NORMAL';
    const target = localUsers.find(u => u.id === userId);
    try {
      await userApi.status({ id: userId, status: nextStatus });
      await userListQuery.refetch();
      toast.success(`账号「${target?.name || userId}」已${nextStatus === 'NORMAL' ? '启用' : '停用'}`);
    } catch {
      // toast 由 http 拦截器统一处理
    }
  };

  // Delete user (with confirm)
  const handleDeleteUser = async (user: SystemUser) => {
    const ok = await confirm({
      title: '删除账号',
      message: `将删除「${user.name}」,该操作不可恢复,请确认。`,
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await userApi.remove(user.id);
      await userListQuery.refetch();
      toast.success(`账号「${user.name}」已删除`);
    } catch {
      // toast 由 http 拦截器统一处理
    }
  };

  // Reset password (opens modal)
  const handleResetPassword = async () => {
    if (!resetPwdFor || !resetPwdNew.trim()) {
      toast.error('请输入新密码');
      return;
    }
    try {
      await userApi.resetPassword(resetPwdFor.id, resetPwdNew);
      toast.success(`已为「${resetPwdFor.name}」重置密码`);
      setResetPwdFor(null);
      setResetPwdNew('');
    } catch {
      // toast 由 http 拦截器统一处理
    }
  };

  // Toggle Model Channel Status (走 channelApi.updateStatus 专用端点,不走 update 全量流程)
  const handleToggleChannelStatus = async (channelId: string) => {
    const target = channels.find(ch => ch.id === channelId);
    if (!target) return;
    const nextStatus = target.status === 'NORMAL' ? 'DISABLED' : 'NORMAL';
    try {
      await channelApi.updateStatus(channelId, nextStatus);
      await channelListQuery.refetch();
      toast.success(`通道「${target.channelName}」已${nextStatus === 'NORMAL' ? '启用' : '停用'}!`);
    } catch {
      // toast 由 http 拦截器统一处理
    }
  };

  // Open create channel drawer
  const handleOpenCreateChannelDrawer = () => {
    setChannelDrawerMode('create');
    setChannelFormName('');
    setChannelFormProvider('OPENAI');
    // 优先用矩阵 placeholder(后端权威),矩阵未拉回时 fallback 到前端常量
    setChannelFormBaseUrl(matrix?.matrix?.OPENAI?.baseUrlPlaceholder ?? BASE_URL_PLACEHOLDERS.OPENAI);
    setChannelFormApiKey('');
    setChannelFormDefaultModels({});
    setChannelFormLimit(5000);
    setChannelFormConcurrencyLimit(10);
    setChannelFormTimeout(60);
    setChannelFormRetryPolicy('exponential');
    setChannelFormCostRatio(0.015);
    setChannelFormCapabilities(['MAIN_IMAGE', 'DETAIL_ENHANCE', 'BG_RECONSTRUCT']);
    setSelectedChannelId(null);
    setIsChannelDrawerOpen(true);
  };

  // Open edit channel drawer — 必须先调 detail 接口拿完整数据(含 capabilities)
  // page 接口 toResponse 不查 capability 关联表,只有 detail 查;list 拿的 ch.capabilities 永远是 null
  const handleOpenEditChannelDrawer = async (ch: ModelChannelDTO) => {
    setChannelDrawerMode('edit');
    setSelectedChannelId(ch.id);
    setIsChannelDrawerOpen(true);
    try {
      // 调 detail 拿完整 ch(含 capabilities / apiKey 明文)
      const fullCh = await channelApi.detail(ch.id);
      setChannelFormName(fullCh.channelName);
      setChannelFormProvider(fullCh.channelType);
      const placeholder = matrix?.matrix?.[fullCh.channelType]?.baseUrlPlaceholder ?? BASE_URL_PLACEHOLDERS[fullCh.channelType];
      setChannelFormBaseUrl(fullCh.baseUrl ?? placeholder);
      setChannelFormApiKey(fullCh.apiKey ?? '');                        // ★ 明文回显
      setChannelFormDefaultModels(fullCh.defaultModels ?? {});
      setChannelFormLimit(fullCh.monthlyBudget ?? 5000);
      setChannelFormConcurrencyLimit(fullCh.concurrency ?? 10);
      setChannelFormTimeout(fullCh.timeoutSeconds ?? 60);
      setChannelFormRetryPolicy((fullCh.retryStrategy as any) ?? 'exponential');
      setChannelFormCostRatio(fullCh.costRate ?? 0.015);
      // 用矩阵过滤(防御历史脏数据 + 兼容矩阵变更)
      const supportedSet = new Set(matrix?.matrix?.[fullCh.channelType]?.supported ?? []);
      const filteredCaps = (fullCh.capabilities ?? []).filter((c) => supportedSet.has(c));
      setChannelFormCapabilities(filteredCaps);
    } catch (err: any) {
      toast.error('加载通道详情失败: ' + (err?.message ?? '未知错误'));
      setIsChannelDrawerOpen(false);
    }
  };

  // Save channel (create or edit) - 走 channelApi
  const handleSaveChannel = async () => {
    if (!channelFormName.trim()) {
      toast.error('请填写通道名称!');
      return;
    }
    // 校验 baseUrl(强制填写 + 百炼不可含 {WorkspaceId} 占位符)
    if (!channelFormBaseUrl.trim()) {
      toast.error('请填写 Base URL!');
      return;
    }
    if (channelFormBaseUrl.includes('{') || channelFormBaseUrl.includes('}')) {
      toast.error('Base URL 不可含 {WorkspaceId} 占位符,请在阿里百炼控制台"业务空间详情"查 WorkspaceId 后填入完整域名');
      return;
    }
    // ★ 二次防御:过滤掉当前 channelType 不支持的能力(防止切 channelType 后 state 残留,虽然 onChange 已清空)
    const supportedSet = new Set(matrix?.matrix?.[channelFormProvider]?.supported ?? []);
    const validCapabilities = channelFormCapabilities.filter((c) => supportedSet.has(c));
    if (validCapabilities.length !== channelFormCapabilities.length) {
      toast.warning('已自动过滤当前供应商不支持的能力,清空后请重新勾选');
      setChannelFormCapabilities(validCapabilities);
    }
    try {
      const req: ModelChannelAddRequest = {
        channelName: channelFormName,
        channelType: channelFormProvider,
        baseUrl: channelFormBaseUrl || undefined,
        apiKey: channelFormApiKey || undefined,          // 空字符串不传,后端保持原 apiKey_enc 不变
        defaultModels: channelFormDefaultModels,
        concurrency: channelFormConcurrencyLimit,
        monthlyBudget: channelFormLimit,
        timeoutSeconds: channelFormTimeout,
        retryStrategy: channelFormRetryPolicy,
        costRate: channelFormCostRatio,
        capabilities: validCapabilities,
      };

      if (channelDrawerMode === 'create') {
        await channelApi.add(req);
        toast.success(`通道「${channelFormName}」已成功创建!`);
      } else if (channelDrawerMode === 'edit' && selectedChannelId) {
        await channelApi.update({
          ...req,
          id: selectedChannelId,
        } as ModelChannelUpdateRequest);
        toast.success(`通道「${channelFormName}」配置已成功更新!`);
      }

      await channelListQuery.refetch();
      setIsChannelDrawerOpen(false);
    } catch {
      // toast 由 http 拦截器统一处理
    }
  };

  // Delete channel - 走 channelApi.delete
  const handleDeleteChannel = async (channelId: string) => {
    const ch = channels.find(c => c.id === channelId);
    if (!ch) return;
    const ok = await confirm({
      title: '删除通道',
      message: `将删除「${ch.channelName}」,该操作不可恢复,请确认。`,
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await channelApi.delete(channelId);
      await channelListQuery.refetch();
      toast.success(`通道「${ch.channelName}」已成功删除!`);
    } catch {
      // toast 由 http 拦截器统一处理
    }
  };

  return (
    <div className="space-y-6 relative" id="system-config-container">
      
      {/* SUCCESS TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-[#0B1C30] text-white px-4 py-3 rounded-xl border border-blue-500/30 shadow-2xl flex items-center gap-2.5 animate-bounce-short">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header Tabs for System Config (Replaces hidden brand logo/old dashboard) */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-0">
        <div className="flex h-12">
          <button
            onClick={() => setActiveMainTab('users')}
            className={`h-full px-6 flex items-center gap-2 text-xs font-bold relative transition-all duration-200 cursor-pointer ${
              activeMainTab === 'users' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Shield className="w-4 h-4 shrink-0" />
            账号与角色 (用户管理)
          </button>
          <button
            onClick={() => setActiveMainTab('org')}
            className={`h-full px-6 flex items-center gap-2 text-xs font-bold relative transition-all duration-200 cursor-pointer ${
              activeMainTab === 'org' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Network className="w-4 h-4 shrink-0" />
            组织架构 (部门管理)
          </button>
          <button
            onClick={() => setActiveMainTab('channels')}
            className={`h-full px-6 flex items-center gap-2 text-xs font-bold relative transition-all duration-200 cursor-pointer ${
              activeMainTab === 'channels' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Sliders className="w-4 h-4 shrink-0" />
            模型通道统管
          </button>
          <button
            onClick={() => setActiveMainTab('logs')}
            className={`h-full px-6 flex items-center gap-2 text-xs font-bold relative transition-all duration-200 cursor-pointer ${
              activeMainTab === 'logs' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            操作日志
          </button>
        </div>

        {activeMainTab === 'users' && (
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/60 select-none">
            <button
              onClick={() => setActiveUserSubTab('accounts')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                activeUserSubTab === 'accounts' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              员工账号
            </button>
            <button
              onClick={() => setActiveUserSubTab('roles')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                activeUserSubTab === 'roles' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              角色管理
            </button>
            <button
              onClick={() => setActiveUserSubTab('menu')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                activeUserSubTab === 'menu' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              菜单配置
            </button>
          </div>
        )}
      </div>

      {/* MAIN VIEW A: 用户与角色 (User Management) */}
      {activeMainTab === 'users' && (
        <div className="space-y-6">
          
          {/* Inner Tab 1: 员工账号 (Employee accounts list) */}
          {activeUserSubTab === 'accounts' && (
            <div className="space-y-4">
              {/* Info System Tip Banner */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3 shadow-xs">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">系统提示</h4>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    当前系统账号由管理员统一在后台分配创建，暂不开放企业员工自助注册。如需新增人员，请点击右侧「新建账号」。
                  </p>
                </div>
              </div>

              {/* Bento style table toolbar */}
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
                      {allDepartments.map(d => (
                        <option key={d.id} value={d.deptName}>{d.deptName}</option>
                      ))}
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

                {/* Employees list table */}
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
                          const initials = user.name.charAt(0);
                          const userDept = userDeptName(user);
                          const isEnabled = user.status === 'NORMAL';

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
                              <td className="py-3.5 px-5 font-mono text-slate-500">{user.email}</td>
                              <td className="py-3.5 px-5 text-slate-600">{userDept}</td>
                              <td className="py-3.5 px-5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  user.role === '管理员'
                                    ? 'bg-blue-50 text-blue-600 border-blue-200'
                                    : user.role === '高级设计师'
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                    : 'bg-purple-50 text-purple-600 border-purple-200'
                                }`}>
                                  {user.role}
                                </span>
                              </td>
                              <td className="py-3.5 px-5">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  isEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                  {isEnabled ? '启用' : '停用'}
                                </span>
                              </td>
                              <td className="py-3.5 px-5 font-mono text-slate-400">{user.joinedDate}</td>
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
                                    onClick={() => handleToggleUserStatus(user.id, user.status)}
                                    className={`flex items-center gap-0.5 cursor-pointer ${
                                      isEnabled ? 'text-rose-500 hover:text-rose-700' : 'text-emerald-500 hover:text-emerald-700'
                                    }`}
                                  >
                                    {isEnabled ? '停用' : '启用'}
                                  </button>
                                  <button
                                    onClick={() => { setResetPwdFor(user); setResetPwdNew(''); }}
                                    className="text-amber-600 hover:text-amber-800 flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <Key className="w-3.5 h-3.5" />
                                    重置密码
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(user)}
                                    className="text-rose-500 hover:text-rose-700 flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    删除
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

                {/* Pagination */}
                <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50 text-slate-400 select-none">
                  <span className="font-mono text-[11px]">共 {filteredUsers.length} 条记录</span>
                  <div className="flex gap-1">
                    <button className="w-7 h-7 rounded border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-50">
                      &lt;
                    </button>
                    <button className="w-7 h-7 rounded bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                      1
                    </button>
                    <button className="w-7 h-7 rounded border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer">
                      &gt;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Inner Tab 2: 角色管理 (RBAC Role configuration matrices) */}
          {activeUserSubTab === 'roles' && (isMockRuntime ? <MockAdminNotice title="角色管理" /> : <RoleManageTab />)}

          {/* Inner Tab 3: 菜单配置 (Menu configuration) */}
          {activeUserSubTab === 'menu' && (isMockRuntime ? <MockAdminNotice title="菜单配置" /> : <MenuConfigTab />)}

        </div>
      )}

      {/* MAIN VIEW: 组织架构 (Organization Structure Management) */}
      {activeMainTab === 'org' && (isMockRuntime ? <MockAdminNotice title="组织架构" /> : (
        <OrgStructureTab
          ref={orgTabRef}
          users={localUsers}
          onAssignUser={handleAssignUser}
        />
      ))}

      {/* MAIN VIEW B: 模型通道统管 (Model Channels Management) */}
      {activeMainTab === 'channels' && (
        <div className="space-y-6">
          
          {/* Top Row Title & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-600" />
                模型通道配置
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                管理并监控所有云端、中转站及本地 AI 模型服务的连接状态。
              </p>
            </div>
            <button
              onClick={handleOpenCreateChannelDrawer}
              className="sm:self-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer self-start"
            >
              <Plus className="w-4 h-4" />
              新建通道
            </button>
          </div>

          {/* Security Alert Banner */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex items-start gap-3 shadow-2xs">
            <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <h4 className="text-xs font-bold text-blue-800 mb-0.5">安全配置提示</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                为保障系统与资产安全，所有 API Key 均在服务端进行高强度加密存储，配置界面仅展示脱敏状态，不提供明文查看功能。如需更换，请直接重新输入并保存。
              </p>
            </div>
          </div>

          {/* Category Tabs Block */}
          <div className="flex gap-6 border-b border-slate-200/60 pb-px">
            {[
              { id: 'all', label: '全部通道' },
              { id: 'cloud', label: '云端 API' },
              { id: 'local', label: '本地模型' },
              { id: 'relay', label: '中转站' },
              { id: 'disabled', label: '停用通道' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setChannelFilter(tab.id as any)}
                className={`text-xs font-bold pb-2.5 transition-all relative cursor-pointer ${
                  channelFilter === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-slate-500 hover:text-blue-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Channels Cards Grid */}
          {channels.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-400 text-sm">
              暂无通道配置
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {channels.map((ch) => {
                const isActive = ch.status === 'NORMAL';

                // Dynamic icons depending on channelType(对齐 4 家精简版)
                const getProviderIcon = () => {
                  switch (ch.channelType) {
                    case 'OPENAI': return <Cloud className="w-5 h-5 text-blue-600" />;
                    case 'QWEN':
                    case 'DOUBAO':
                    case 'DEEPSEEK': return <Cpu className="w-5 h-5 text-emerald-600" />;
                    default: return <Layers className="w-5 h-5 text-amber-600" />;
                  }
                };

                // Type sub-badge text(对齐 4 家精简版,本期仅云端 API 一类)
                const getTypeBadge = () => {
                  if (CHANNEL_CATEGORIES.CLOUD.includes(ch.channelType)) return '云端 API';
                  return '其他';
                };

                // Mapped capabilities(后端能力编码,可能为 null)
                const caps = ch.capabilities || [];

                // 今日消耗(后端 todayCost,单位元)
                const todayCost = ch.todayCost ?? 0;

                return (
                  <div
                    key={ch.id}
                    className={`bg-white rounded-2xl p-5 border shadow-2xs transition-all flex flex-col justify-between space-y-4 group relative hover:shadow-md ${
                      isActive ? 'border-slate-200' : 'border-slate-200/60 bg-slate-50/50 opacity-70'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shadow-3xs">
                          {getProviderIcon()}
                        </div>
                        <div>
                          <h4 className="text-xs font-extrabold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">
                            {ch.channelName}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="inline-block text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                              {getTypeBadge()}
                            </span>
                            <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              ch.apiKeyConfigured === 'Y'
                                ? 'text-emerald-600 bg-emerald-50 border border-emerald-100'
                                : 'text-slate-400 bg-slate-50 border border-slate-100'
                            }`}>
                              Key {ch.apiKeyConfigured === 'Y' ? '已设置' : '未设置'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Switch Toggle */}
                      <button
                        onClick={() => handleToggleChannelStatus(ch.id)}
                        className={`p-0.5 rounded-full w-9 h-5.5 transition-all focus:outline-none cursor-pointer flex items-center ${
                          isActive ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                        }`}
                      >
                        <span className="w-4.5 h-4.5 rounded-full bg-white shadow-xs" />
                      </button>
                    </div>

                    {/* Channel type label */}
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block mb-1.5">供应商</span>
                      <span className="text-xs font-bold text-slate-700">
                        {CHANNEL_TYPE_LABELS[ch.channelType] ?? ch.channelType}
                      </span>
                    </div>

                    {/* Capabilities range */}
                    {caps.length > 0 && (
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block mb-1.5">能力范围</span>
                        <div className="flex flex-wrap gap-1.5">
                          {caps.map((cap) => (
                            <span
                              key={cap}
                              className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200/55 px-2 py-0.5 rounded"
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Stats details mapping */}
                    <div className="pt-4 border-t border-slate-100">
                      {isActive ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block leading-none mb-1">今日消耗</span>
                            <span className="text-xs font-black text-slate-800">
                              ¥ {todayCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block leading-none mb-1">今日调用</span>
                            <span className="text-xs font-black text-slate-800">
                              {ch.todayCallCount ?? 0} 次
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5 justify-center py-2 bg-slate-100 rounded-xl">
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                          此通道已停用,将拒绝前台提交请求
                        </div>
                      )}
                    </div>

                    {/* Footer Action Row — 永远显示,放卡片底部(跟 stats 平级),与 Switch 完全分离不遮挡 */}
                    <div className="pt-3 mt-1 border-t border-slate-100 flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditChannelDrawer(ch)}
                        className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Edit className="w-3 h-3" />
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeleteChannel(ch.id)}
                        className="px-2.5 py-1 text-[10px] font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        删除
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* MAIN VIEW C: 操作日志 (Operation Logs) */}
      {activeMainTab === 'logs' && (
        <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-xs font-bold text-slate-800">系统审计与安全操作日志</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">记录当前系统高危权限操作、一键断电及RBAC安全权限调整动作。</p>
            </div>
            <button
              onClick={() => {
                // simple log reset
                triggerToast('审计日志已完成实时刷新归档！');
              }}
              className="px-2.5 py-1 text-xs border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1 font-semibold text-slate-600 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              刷新日志
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="py-3 px-5">时间</th>
                  <th className="py-3 px-5">操作员</th>
                  <th className="py-3 px-5">系统角色</th>
                  <th className="py-3 px-5">操作类型</th>
                  <th className="py-3 px-5">详细事件描述</th>
                  <th className="py-3 px-5">IP地址</th>
                  <th className="py-3 px-5 text-right">结果</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-slate-500">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/30">
                    <td className="py-3.5 px-5 font-medium text-slate-400 whitespace-nowrap">{log.timestamp}</td>
                    <td className="py-3.5 px-5 font-bold text-slate-700 whitespace-nowrap">{log.operatorName}</td>
                    <td className="py-3.5 px-5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.operatorRole === '管理员'
                          ? 'bg-blue-50 text-blue-600 border border-blue-100'
                          : 'bg-purple-50 text-purple-600 border border-purple-100'
                      }`}>
                        {log.operatorRole}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-700 whitespace-nowrap">{log.actionType}</td>
                    <td className="py-3.5 px-5 font-sans text-slate-600 max-w-sm truncate" title={log.actionDetail}>
                      {log.actionDetail}
                    </td>
                    <td className="py-3.5 px-5 text-slate-400">{log.ipAddress}</td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        log.status === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                        <span className={`w-1 h-1 rounded-full ${log.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {log.status === 'success' ? '成功' : '被拦截'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OVERLAY PANEL DRAWER: 新建 / 编辑账号 */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex" id="new-account-drawer">
          {/* Backdrop blur overlay */}
          <div
            className="absolute inset-0 bg-[#0B1C30]/40 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Sliding Drawer Container */}
          <div className="absolute right-0 top-0 h-full w-[480px] bg-white shadow-2xl flex flex-col transform transition-transform duration-300 z-50">
            
            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                {drawerMode === 'create' ? '新建协作账号' : '编辑账号配置'}
              </h3>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* SECTION 1: Basic details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-blue-600 border-l-4 border-blue-600 pl-2">
                  基础信息
                </h4>

                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    姓名 <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="请输入员工真实姓名"
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-semibold"
                  />
                </div>

                {/* Account (login name) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    账号(登录名) <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={formUserName}
                    onChange={(e) => setFormUserName(e.target.value)}
                    placeholder="请输入登录账号"
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-mono font-bold"
                  />
                </div>

                {/* Password (only required for create) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    密码 {drawerMode === 'create' && <span className="text-rose-500 font-bold">*</span>}
                    {drawerMode === 'edit' && <span className="text-slate-400 font-normal ml-1">(编辑不改,留空)</span>}
                  </label>
                  <input
                    type="text"
                    autoComplete="new-password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={drawerMode === 'create' ? '请输入初始密码(明文,后端加密存储)' : '编辑模式不改密码,留空'}
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-mono"
                  />
                </div>

                {/* Phone (optional) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    手机号 <span className="text-slate-400 font-normal">(可选)</span>
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="请输入手机号(选填)"
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-mono"
                  />
                </div>

                {/* Job number (optional) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    工号 <span className="text-slate-400 font-normal">(可选)</span>
                  </label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="请输入工号(选填)"
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-mono"
                  />
                </div>

                {/* 注:是否超管 toggle 已去除(2026-07-11 用户决定),后端 UserAddRequest.isAdmin 默认 'N' */}

                {/* Department Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    所属部门 <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <select
                    value={formDeptId}
                    onChange={(e) => setFormDeptId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none text-slate-700 font-semibold"
                  >
                    <option value="">(未分配)</option>
                    {allDepartments.map(d => (
                      <option key={d.id} value={d.id}>{d.deptName}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SECTION 2: 角色分配(动态多选) */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-blue-600 border-l-4 border-blue-600 pl-2">
                  角色分配(可多选)
                </h4>

                {roleList.length === 0 ? (
                  <div className="text-xs text-slate-400">角色加载中...</div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {roleList.map((r) => {
                      const checked = formRoleIds.includes(String(r.id));
                      return (
                        <div
                          key={r.id}
                          onClick={() => setFormRoleIds(prev =>
                            checked
                              ? prev.filter(x => x !== String(r.id))
                              : [...prev, String(r.id)]
                          )}
                          className={`p-3 rounded-lg border cursor-pointer transition-all select-none flex flex-col space-y-1.5 ${
                            checked
                              ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500/20'
                              : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              {r.roleName}
                              {r.sysRole && (
                                <span className="text-[9px] px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-bold">
                                  内置
                                </span>
                              )}
                            </span>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                              checked ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                            }`}>
                              {checked && <Check className="w-2.5 h-2.5 stroke-[3px]" />}
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-relaxed">
                            {r.description || '—'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tips footer block */}
              <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-400 leading-normal">
                  创建或保存成功后，系统后台会自动重置账号安全密码并实时发出提醒至该员工邮箱。
                </p>
              </div>

            </div>

            {/* Drawer Actions Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSaveUser}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                {drawerMode === 'create' ? '确认创建' : '保存修改'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* OVERLAY PANEL DRAWER: 新建 / 编辑模型通道 */}
      {isChannelDrawerOpen && (
        <div className="fixed inset-0 z-50 flex" id="new-channel-drawer">
          <div
            className="absolute inset-0 bg-[#0B1C30]/40 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setIsChannelDrawerOpen(false)}
          />

          <div className="absolute right-0 top-0 h-full w-[480px] bg-white shadow-2xl flex flex-col transform transition-transform duration-300 z-50 animate-slide-in-right">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-600" />
                {channelDrawerMode === 'create' ? '新建模型生成通道' : '编辑模型通道配置'}
              </h3>
              <button
                onClick={() => setIsChannelDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Part 1: Service Provider */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-blue-600 border-l-4 border-blue-600 pl-2">
                  1. 算法厂商与基本信息
                </h4>

                {/* Channel Type Select (对齐后端 EnumChannelType) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    供应商厂商 <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <select
                    value={channelFormProvider}
                    onChange={(e) => {
                      const prov = e.target.value as ChannelType;
                      setChannelFormProvider(prov);
                      // Auto populate baseUrl + defaultModel based on channelType
                      // 优先用矩阵 placeholder(后端权威),fallback 到前端常量
                      const placeholder = matrix?.matrix?.[prov]?.baseUrlPlaceholder ?? BASE_URL_PLACEHOLDERS[prov];
                      setChannelFormBaseUrl(placeholder);
                      setChannelFormDefaultModels({});
                      // ★ 切 channelType 时清空 capabilities(防御旧 state 残留,避免非法组合提交)
                      setChannelFormCapabilities([]);
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none text-slate-700 font-bold"
                  >
                    {(Object.keys(CHANNEL_TYPE_LABELS) as ChannelType[]).map((ct) => (
                      <option key={ct} value={ct}>{CHANNEL_TYPE_LABELS[ct]}</option>
                    ))}
                  </select>
                </div>

                {/* Channel Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    通道显示名称 <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={channelFormName}
                    onChange={(e) => setChannelFormName(e.target.value)}
                    placeholder="如: 星火核心自研专道"
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Part 2: Connect Config */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-blue-600 border-l-4 border-blue-600 pl-2">
                  2. 接口参数与访问凭证
                </h4>

                {/* Base URL */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    API 基础代理网关 (Base URL) <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={channelFormBaseUrl}
                    onChange={(e) => setChannelFormBaseUrl(e.target.value)}
                    placeholder={matrix?.matrix?.[channelFormProvider]?.baseUrlPlaceholder ?? BASE_URL_PLACEHOLDERS[channelFormProvider]}
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    {channelFormProvider === 'QWEN' ? (
                      <>
                        阿里百炼官方推荐使用<strong>业务空间专属域名</strong>(性能/稳定性更佳),旧域名 <code className="text-[9px] bg-slate-100 px-1 rounded">https://dashscope.aliyuncs.com/compatible-mode/v1</code> 仍可用。
                        <br />
                        新域名格式: <code className="text-[9px] bg-slate-100 px-1 rounded">https://{'{WorkspaceId}'}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1</code>,需在百炼控制台「业务空间详情」查 WorkspaceId 后替换。
                      </>
                    ) : (
                      <>官方推荐域名(可在供应商控制台自定义,留空使用默认值)。</>
                    )}
                  </p>
                </div>

                {/* API Key (明文回显,运维工具偏好) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    API 密钥私钥凭证 (Secret Key) — 明文
                  </label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={channelFormApiKey}
                    onChange={(e) => setChannelFormApiKey(e.target.value)}
                    placeholder="请输入服务商提供的 API-Key (后端 jasypt 加密存储,前端明文回显)"
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-mono"
                  />
                </div>

                {/* Default Model [v1.4 2026-07-12] 整段移除,改到下方"能力边界"按 group 折叠面板渲染 */}
              </div>

              {/* Part 3: Cap & Limit */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-blue-600 border-l-4 border-blue-600 pl-2">
                  3. 限制阈值与能力范围
                </h4>

                {/* Limits Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      每日算力峰值配额 (Pts)
                    </label>
                    <input
                      type="number"
                      value={channelFormLimit}
                      onChange={(e) => setChannelFormLimit(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      并发连接线程数
                    </label>
                    <input
                      type="number"
                      value={channelFormConcurrencyLimit}
                      onChange={(e) => setChannelFormConcurrencyLimit(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Timeout, Retries and Cost */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      连接超时时限 (秒)
                    </label>
                    <input
                      type="number"
                      value={channelFormTimeout}
                      onChange={(e) => setChannelFormTimeout(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      算力换算比率系数
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={channelFormCostRatio}
                      onChange={(e) => setChannelFormCostRatio(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    失败重试策略
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'exponential', name: '指数级退避' },
                      { id: 'linear', name: '线性重试' },
                      { id: 'none', name: '直接报错' }
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setChannelFormRetryPolicy(item.id as any)}
                        className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          channelFormRetryPolicy === item.id
                            ? 'bg-blue-50 border-blue-600 text-blue-600'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 赋能能力边界范围(中文 label 多选,内部存英文 code) */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-700">
                    赋能能力边界范围
                  </label>
                  {/* 矩阵提示行:显示当前供应商支持的能力(后端下发,前端不可勾选不支持的) */}
                  {matrix?.matrix?.[channelFormProvider] && (
                    <p className="text-[10px] text-slate-500">
                      当前供应商 <strong>{matrix.matrix[channelFormProvider].label}</strong> 官方支持
                      <strong className="text-blue-600 mx-1">{matrix.matrix[channelFormProvider].supported.length}</strong>
                      个能力,仅可勾选其中项。
                    </p>
                  )}
                  {([
                    { key: 'TEXT',  label: '文本类' },
                    { key: 'IMAGE', label: '图像类' },
                    { key: 'VIDEO', label: '视频类' },
                    { key: 'SOLUTION', label: '解决方案' },
                  ] as const).map((group) => {
                    // 从矩阵动态生成:本组的能力 × 当前供应商支持的交集
                    const supportedSet = new Set(matrix?.matrix?.[channelFormProvider]?.supported ?? []);
                    const groupOpts = (matrix?.capabilities ?? [])
                      .filter((c) => c.group === group.key && supportedSet.has(c.code));
                    if (groupOpts.length === 0) return null;
                    return (
                      <div key={group.key} className="space-y-1.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {group.label}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {groupOpts.map((opt) => {
                            const isChecked = channelFormCapabilities.includes(opt.code);
                            return (
                              <button
                                key={opt.code}
                                type="button"
                                onClick={() => {
                                  setChannelFormCapabilities((prev) =>
                                    prev.includes(opt.code)
                                      ? prev.filter((c) => c !== opt.code)
                                      : [...prev, opt.code]
                                  );
                                }}
                                className={`flex items-center justify-start gap-1.5 py-2 px-2 rounded-lg border text-[11px] font-bold transition-all cursor-pointer select-none ${
                                  isChecked
                                    ? 'bg-blue-50 border-blue-500 text-blue-600'
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                <span className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${
                                  isChecked ? 'bg-blue-500 border-blue-500' : 'border-slate-300'
                                }`}>
                                  {isChecked && (
                                    <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M2 6l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </span>
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-slate-400 mt-1">
                    提交到后端为英文编码(数组形式),不传将清空该通道的所有能力
                  </p>
                </div>

                {/* [v1.4 2026-07-12] group 级默认模型 — 跟能力边界绑定,按 group 折叠面板
                  *  - 矩阵下发 modelRequired:true 的 group → 渲染 input
                  *  - modelRequired:false 的 group(Vidu × SOLUTION 之类)→ 不渲染,Vidu 后端自动选
                  *  - 后端强约束:modelRequired=true 的 group 选中了 capability 但未填 model → 报错
                  */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">
                    默认模型(按能力大类分组)
                  </label>
                  <p className="text-[10px] text-slate-400 -mt-1">
                    自由输入,可填任意模型名(占位灰字仅为提示)。下方折叠面板仅展示该通道需要配模型的 group。
                  </p>
                  {([
                    { key: 'TEXT' as CapabilityGroup,     label: '文本类',     icon: '💬' },
                    { key: 'IMAGE' as CapabilityGroup,    label: '图像类',     icon: '🖼️' },
                    { key: 'VIDEO' as CapabilityGroup,    label: '视频类',     icon: '🎬' },
                    { key: 'SOLUTION' as CapabilityGroup, label: '解决方案',   icon: '🧩' },
                  ]).map((group) => {
                    // ★ 后端单点收口:matrix 下发决定要不要渲染
                    const modelRequired = matrix?.matrix?.[channelFormProvider]?.modelRequired?.[group.key] ?? false;
                    if (!modelRequired) return null;
                    // 当前 group 是否有被勾选 capability(没勾选就不需要展示)
                    const groupCapsCount = channelFormCapabilities.filter((c) => {
                      const cap = (matrix?.capabilities ?? []).find((x) => x.code === c);
                      return cap?.group === group.key;
                    }).length;
                    if (groupCapsCount === 0) return null;
                    const hasValue = !!(channelFormDefaultModels[group.key] ?? '').trim();
                    return (
                      <details
                        key={group.key}
                        open={hasValue}
                        className="group rounded-lg border border-slate-200 bg-white"
                      >
                        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-bold text-slate-700 flex items-center justify-between hover:bg-slate-50 transition-colors list-none">
                          <span className="flex items-center gap-2">
                            <span>{group.icon}</span>
                            <span>{group.label} 默认模型</span>
                            <span className="text-rose-500">*</span>
                            {hasValue && (
                              <span className="text-[10px] font-mono font-bold text-blue-600 ml-1">
                                {channelFormDefaultModels[group.key]}
                              </span>
                            )}
                          </span>
                          <svg viewBox="0 0 12 12" className="w-3 h-3 text-slate-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </summary>
                        <div className="px-3 pb-3 pt-1 space-y-1.5">
                          <input
                            type="text"
                            value={channelFormDefaultModels[group.key] ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setChannelFormDefaultModels((prev) => {
                                const next = { ...prev };
                                if (v) next[group.key] = v; else delete next[group.key];
                                return next;
                              });
                            }}
                            placeholder={DEFAULT_MODEL_PLACEHOLDERS[channelFormProvider]?.[group.key] ?? '请输入模型名称'}
                            className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-mono font-bold"
                          />
                          <p className="text-[10px] text-slate-400">
                            提示:{DEFAULT_MODEL_PLACEHOLDERS[channelFormProvider]?.[group.key] ?? '—'}(仅 UI 提示,可填任意模型名)
                          </p>
                        </div>
                      </details>
                    );
                  })}
                  {/* 兜底:所有 group 都没勾选能力时,显示空提示 */}
                  {(['TEXT', 'IMAGE', 'VIDEO', 'SOLUTION'] as CapabilityGroup[]).every((g) =>
                    !channelFormCapabilities.some((c) => {
                      const cap = (matrix?.capabilities ?? []).find((x) => x.code === c);
                      return cap?.group === g;
                    })
                  ) && (
                    <p className="text-[10px] text-slate-400 italic px-2 py-1">
                      请先勾选上方能力,选中后才需要配置对应 group 的默认模型
                    </p>
                  )}
                </div>
              </div>

            </div>

            {/* Drawer Actions Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsChannelDrawerOpen(false)}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSaveChannel}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                {channelDrawerMode === 'create' ? '确认创建' : '保存修改'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetPwdFor && (
        <div className="fixed inset-0 z-50 flex" id="reset-pwd-modal">
          <div
            className="absolute inset-0 bg-[#0B1C30]/40 backdrop-blur-xs cursor-pointer"
            onClick={() => setResetPwdFor(null)}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] bg-white shadow-2xl rounded-2xl flex flex-col z-50">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-500" />
                为「{resetPwdFor.name}」重置密码
              </h3>
              <button
                onClick={() => setResetPwdFor(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <label className="text-xs font-bold text-slate-700">新密码(明文,后端加密存储)</label>
              <input
                type="text"
                autoComplete="new-password"
                value={resetPwdNew}
                onChange={(e) => setResetPwdNew(e.target.value)}
                placeholder="建议 8 位以上,字母+数字组合"
                className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
              <p className="text-[10px] text-slate-400 leading-relaxed">
                重置后请通过安全渠道告知员工,旧密码立即失效。
              </p>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setResetPwdFor(null)}
                className="px-4 py-2 border border-slate-200 bg-white text-slate-700 text-xs font-semibold rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleResetPassword}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg"
              >
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
