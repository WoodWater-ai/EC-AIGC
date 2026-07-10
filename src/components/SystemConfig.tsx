import React, { useState, useMemo } from 'react';
import { ModelChannel, SystemUser } from '../types';
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

export interface Department {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  description: string;
  managerName: string;
}

interface SystemConfigProps {
  channels: ModelChannel[];
  users: SystemUser[];
  onToggleChannel: (id: string) => void;
  onUpdateUserRole: (id: string, role: any) => void;
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

export const SystemConfig: React.FC<SystemConfigProps> = ({
  channels,
  users,
  onToggleChannel,
  onUpdateUserRole
}) => {
  // 1. High level main tabs
  const [activeMainTab, setActiveMainTab] = useState<'users' | 'org' | 'channels' | 'logs'>('users');
  
  // 2. User management sub-tabs
  const [activeUserSubTab, setActiveUserSubTab] = useState<'accounts' | 'roles' | 'menu'>('accounts');

  // 3. Search and department filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('全部部门');

  // 4. Local state for interactive users list
  const [localUsers, setLocalUsers] = useState<SystemUser[]>(users);
  
  // Local state for model channels
  const [localChannels, setLocalChannels] = useState<ModelChannel[]>(channels);
  const [channelFilter, setChannelFilter] = useState<'all' | 'cloud' | 'local' | 'transit' | 'disabled'>('all');

  // Channel modal/drawer states
  const [isChannelDrawerOpen, setIsChannelDrawerOpen] = useState(false);
  const [channelDrawerMode, setChannelDrawerMode] = useState<'create' | 'edit'>('create');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  // Channel Form states
  const [channelFormName, setChannelFormName] = useState('');
  const [channelFormProvider, setChannelFormProvider] = useState<ModelChannel['provider']>('DaVinci Core');
  const [channelFormBaseUrl, setChannelFormBaseUrl] = useState('');
  const [channelFormApiKey, setChannelFormApiKey] = useState('');
  const [channelFormDefaultModel, setChannelFormDefaultModel] = useState('davinci-v3.5');
  const [channelFormLimit, setChannelFormLimit] = useState(5000);
  const [channelFormConcurrencyLimit, setChannelFormConcurrencyLimit] = useState(10);
  const [channelFormTimeout, setChannelFormTimeout] = useState(60);
  const [channelFormRetryPolicy, setChannelFormRetryPolicy] = useState<'exponential' | 'linear' | 'none'>('exponential');
  const [channelFormCostRatio, setChannelFormCostRatio] = useState(0.015);
  const [channelFormCapabilities, setChannelFormCapabilities] = useState<string[]>(['主图生成', '细节放大', '背景重构']);

  // Departments List State
  const [departments, setDepartments] = useState<Department[]>([
    {
      id: 'dep-1',
      name: '达芬奇AI创意总部',
      code: 'DAVINCI-HQ',
      parentId: null,
      description: '达芬奇智能内容创意生态集团总部，统管全局业务与技术研发。',
      managerName: '陆永奇'
    },
    {
      id: 'dep-2',
      name: '内容运营部',
      code: 'OPER-DEPT',
      parentId: 'dep-1',
      description: '负责AI生图/生视频的提报、运营部署、线上活动推广与数据复盘。',
      managerName: '张思豪'
    },
    {
      id: 'dep-3',
      name: '设计中心',
      code: 'DESIGN-CTR',
      parentId: 'dep-1',
      description: '负责核心AI生成排版模板库配置、创意风格研究以及负面避坑规则设计。',
      managerName: '陈美晴'
    },
    {
      id: 'dep-4',
      name: '系统架构部',
      code: 'ARCH-DEPT',
      parentId: 'dep-1',
      description: '负责多卡算力网关的高并发调度、模型通道限额管理与企业安全策略。',
      managerName: '陆永奇'
    },
    {
      id: 'dep-5',
      name: '内容运营一组 (电商方向)',
      code: 'OPER-G1',
      parentId: 'dep-2',
      description: '主攻跨境及主流电商（女装、美妆等）的日常商品场景图快速生成和提报。',
      managerName: '王小芬'
    },
    {
      id: 'dep-6',
      name: '内容运营二组 (视频方向)',
      code: 'OPER-G2',
      parentId: 'dep-2',
      description: '负责Kling及Runway短视频推广素材、动态海报创意脚本的调度生产。',
      managerName: '李大壮'
    },
    {
      id: 'dep-7',
      name: '视觉设计组',
      code: 'DSN-VISUAL',
      parentId: 'dep-3',
      description: '专注于生图模型微调、高审美排版图层设计以及人工精细化后置合成。',
      managerName: '陈美晴'
    },
    {
      id: 'dep-8',
      name: '外部协同客户组',
      code: 'CLIENT-COOP',
      parentId: 'dep-1',
      description: '对接外部协作商、供应链代表，在线提供生图成品的审阅和反馈评价。',
      managerName: '协同客户代表'
    }
  ]);

  // Mapping of user IDs to dynamic department IDs
  const [userDeptMap, setUserDeptMap] = useState<Record<string, string>>({
    'u-1': 'dep-4', // Admin
    'u-2': 'dep-3', // Senior Designer
    'u-3': 'dep-2', // Operator
    'u-4': 'dep-8'  // Client
  });

  // Department expand/collapse states
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({
    'dep-1': true,
    'dep-2': true,
    'dep-3': true,
    'dep-4': true
  });

  // Department modal/drawer states
  const [isDeptDrawerOpen, setIsDeptDrawerOpen] = useState(false);
  const [deptDrawerMode, setDeptDrawerMode] = useState<'create' | 'edit'>('create');
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

  // Department form states
  const [deptFormName, setDeptFormName] = useState('');
  const [deptFormCode, setDeptFormCode] = useState('');
  const [deptFormParentId, setDeptFormParentId] = useState<string | null>(null);
  const [deptFormManager, setDeptFormManager] = useState('');
  const [deptFormDescription, setDeptFormDescription] = useState('');

  // 5. Drawer state for adding / editing user
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Drawer Form fields
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formDeptId, setFormDeptId] = useState('dep-2');
  const [formRole, setFormRole] = useState<SystemUser['role']>('运营策划');
  const [formStatus, setFormStatus] = useState<'online' | 'offline'>('online');

  // Notification success toasts
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pre-populated Operation logs for high fidelity
  const [logs, setLogs] = useState<OperationLog[]>([
    { id: 'l1', operatorName: '陆永奇', operatorRole: '管理员', actionType: '账号管理', actionDetail: '新建员工账号 zhangsf@company.com 并赋予超级管理员角色', ipAddress: '192.168.1.14', timestamp: '2026-07-06 10:15', status: 'success' },
    { id: 'l2', operatorName: '陆永奇', operatorRole: '管理员', actionType: '渠道配置', actionDetail: '启用 Kling AI 1.5 Pro Video Engine 通道并设置每日限额 500 Pts', ipAddress: '192.168.1.14', timestamp: '2026-07-06 09:30', status: 'success' },
    { id: 'l3', operatorName: '陈美晴', operatorRole: '高级设计师', actionType: '模板管理', actionDetail: '更新了模板「女装电商白底图 V2」的 Prompt 片段规则', ipAddress: '192.168.1.28', timestamp: '2026-07-05 14:24', status: 'success' },
    { id: 'l4', operatorName: '张思豪', operatorRole: '运营策划', actionType: '任务管理', actionDetail: '审核通过了批次素材 「T-1002 - 精华保湿乳」', ipAddress: '192.168.2.102', timestamp: '2026-07-05 11:15', status: 'success' },
    { id: 'l5', operatorName: '陆永奇', operatorRole: '管理员', actionType: '安全配置', actionDetail: '尝试修改超级管理员内置角色权限组 - 拒绝操作', ipAddress: '192.168.1.14', timestamp: '2026-07-04 16:40', status: 'failed' },
    { id: 'l6', operatorName: '系统自动', operatorRole: '系统账号', actionType: '任务监控', actionDetail: '批次任务 T-1003 内存不足抛出 CUDA 异常，发送系统警告通知', ipAddress: '127.0.0.1', timestamp: '2026-07-03 16:11', status: 'success' }
  ]);

  // Map system role to department dynamically
  const getDeptForUser = (user: SystemUser) => {
    const deptId = userDeptMap[user.id];
    if (deptId) {
      return departments.find(d => d.id === deptId)?.name || '未分配';
    }
    if (user.role === '管理员') return '系统架构部';
    if (user.role === '高级设计师') return '设计中心';
    if (user.role === '运营策划') return '内容运营部';
    return '外部协同客户组';
  };

  // Filtered employee users
  const filteredUsers = useMemo(() => {
    return localUsers.filter(u => {
      const matchSearch = searchQuery === '' || 
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      const userDept = getDeptForUser(u);
      const matchDept = selectedDept === '全部部门' || userDept === selectedDept;

      return matchSearch && matchDept;
    });
  }, [localUsers, searchQuery, selectedDept, userDeptMap, departments]);

  // Computed filteredChannels array based on the category sub-tabs
  const filteredChannels = useMemo(() => {
    return localChannels.filter(ch => {
      if (channelFilter === 'disabled') {
        return ch.status === 'inactive';
      }
      
      // Filter by type:
      if (channelFilter === 'cloud') {
        return ch.status === 'active' && (ch.provider === 'DaVinci Core' || ch.provider === 'Runway');
      }
      if (channelFilter === 'transit') {
        return ch.status === 'active' && (ch.provider === 'Midjourney' || ch.provider === 'Kling AI');
      }
      if (channelFilter === 'local') {
        return ch.status === 'active' && ch.provider === 'Stable Diffusion';
      }

      return true; // 'all' displays both active & inactive
    });
  }, [localChannels, channelFilter]);

  // Show a temporary success toast message
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Helper: check if parentCandidate is a descendant of child
  const isDescendant = (parentCandidateId: string, childId: string): boolean => {
    let current = departments.find(d => d.id === parentCandidateId);
    while (current && current.parentId) {
      if (current.parentId === childId) {
        return true;
      }
      current = departments.find(d => d.id === current.parentId);
    }
    return false;
  };

  // Open Department Drawer for creating new department
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

  // Open Department Drawer for editing department
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

  // Save department drawer form
  const handleSaveDepartment = () => {
    if (!deptFormName.trim() || !deptFormCode.trim()) {
      alert('请填写完整的部门名称和唯一编码！');
      return;
    }

    const codeUpper = deptFormCode.toUpperCase().trim();

    // Check code duplication excluding current edit target
    const isCodeDup = departments.some(d => d.code === codeUpper && d.id !== selectedDeptId);
    if (isCodeDup) {
      alert(`部门编码「${codeUpper}」已存在，请使用唯一的编码！`);
      return;
    }

    if (deptDrawerMode === 'create') {
      const newDeptId = `dep-${Date.now()}`;
      const newDept: Department = {
        id: newDeptId,
        name: deptFormName,
        code: codeUpper,
        parentId: deptFormParentId,
        description: deptFormDescription,
        managerName: deptFormManager || '未指定'
      };

      setDepartments(prev => [...prev, newDept]);
      setExpandedDepts(prev => ({ ...prev, [newDeptId]: true }));

      // Add operation log
      const newLog: OperationLog = {
        id: `log-${Date.now()}`,
        operatorName: '陆永奇',
        operatorRole: '管理员',
        actionType: '组织架构',
        actionDetail: `成功创建了部门 「${deptFormName}」 (${codeUpper})`,
        ipAddress: '192.168.1.14',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        status: 'success'
      };
      setLogs(prev => [newLog, ...prev]);

      triggerToast(`部门「${deptFormName}」已成功创建！`);
    } else if (deptDrawerMode === 'edit' && selectedDeptId) {
      if (deptFormParentId === selectedDeptId) {
        alert('无法将部门自身选为上级部门！');
        return;
      }
      if (deptFormParentId && isDescendant(deptFormParentId, selectedDeptId)) {
        alert('上级部门不能设为当前部门的下属子部门，这会导致无限循环！');
        return;
      }

      setDepartments(prev => prev.map(d => d.id === selectedDeptId ? {
        ...d,
        name: deptFormName,
        code: codeUpper,
        parentId: deptFormParentId,
        description: deptFormDescription,
        managerName: deptFormManager || '未指定'
      } : d));

      // Add operation log
      const newLog: OperationLog = {
        id: `log-${Date.now()}`,
        operatorName: '陆永奇',
        operatorRole: '管理员',
        actionType: '组织架构',
        actionDetail: `成功更新了部门 「${deptFormName}」 的基本架构与配置信息`,
        ipAddress: '192.168.1.14',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        status: 'success'
      };
      setLogs(prev => [newLog, ...prev]);

      triggerToast(`部门「${deptFormName}」信息已成功保存！`);
    }

    setIsDeptDrawerOpen(false);
  };

  // Delete department with checks
  const handleDeleteDepartment = (deptId: string) => {
    // Check if department has child departments
    const hasChildren = departments.some(d => d.parentId === deptId);
    if (hasChildren) {
      alert('无法删除该部门：当前部门仍包含下属部门，请先调整下属部门的上级归属！');
      return;
    }

    // Check if department has active employees
    const deptMembers = localUsers.filter(u => userDeptMap[u.id] === deptId);
    if (deptMembers.length > 0) {
      const memberNames = deptMembers.map(m => m.name).join('、');
      alert(`无法删除该部门：当前部门下仍有绑定的员工账号（${memberNames}）。请先在员工列表中将他们调整至其他部门！`);
      return;
    }

    const dept = departments.find(d => d.id === deptId);
    setDepartments(prev => prev.filter(d => d.id !== deptId));

    // Add operation log
    const newLog: OperationLog = {
      id: `log-${Date.now()}`,
      operatorName: '陆永奇',
      operatorRole: '管理员',
      actionType: '组织架构',
      actionDetail: `成功删除了空置部门 「${dept?.name || deptId}」`,
      ipAddress: '192.168.1.14',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'success'
    };
    setLogs(prev => [newLog, ...prev]);

    triggerToast(`部门「${dept?.name}」已成功移除！`);
  };

  // Open Drawer for creating new user
  const handleOpenCreateDrawer = () => {
    setDrawerMode('create');
    setFormName('');
    setFormEmail('');
    setFormDeptId('dep-2'); // Set default department ID (内容运营部)
    setFormRole('运营策划');
    setFormStatus('online');
    setSelectedUserId(null);
    setIsDrawerOpen(true);
  };

  // Open Drawer for editing user
  const handleOpenEditDrawer = (user: SystemUser) => {
    setDrawerMode('edit');
    setFormName(user.name);
    // strip out the suffix for simple prefill
    const emailPrefix = user.email.split('@')[0];
    setFormEmail(emailPrefix);
    setFormDeptId(userDeptMap[user.id] || 'dep-2');
    setFormRole(user.role);
    setFormStatus(user.status);
    setSelectedUserId(user.id);
    setIsDrawerOpen(true);
  };

  // Save drawer form
  const handleSaveUser = () => {
    if (!formName.trim() || !formEmail.trim()) {
      alert('请填写完整的姓名与邮箱！');
      return;
    }

    const fullEmail = formEmail.includes('@') ? formEmail : `${formEmail}@davinci.ai`;

    if (drawerMode === 'create') {
      const newUserId = `u-${Date.now()}`;
      const newUser: SystemUser = {
        id: newUserId,
        name: formName,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        role: formRole,
        email: fullEmail,
        status: formStatus,
        joinedDate: new Date().toISOString().split('T')[0]
      };

      setLocalUsers(prev => [...prev, newUser]);
      setUserDeptMap(prev => ({ ...prev, [newUserId]: formDeptId }));
      // Sync to parent list
      onUpdateUserRole(newUser.id, newUser.role);
      
      // Add log
      const newLog: OperationLog = {
        id: `log-${Date.now()}`,
        operatorName: '陆永奇',
        operatorRole: '管理员',
        actionType: '账号管理',
        actionDetail: `成功创建了账号 ${newUser.name} (${fullEmail}) 并赋予了 ${newUser.role} 角色`,
        ipAddress: '192.168.1.14',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        status: 'success'
      };
      setLogs(prev => [newLog, ...prev]);
      
      triggerToast(`账号「${formName}」已成功创建！`);
    } else if (drawerMode === 'edit' && selectedUserId) {
      setLocalUsers(prev => prev.map(u => u.id === selectedUserId ? {
        ...u,
        name: formName,
        email: fullEmail,
        role: formRole,
        status: formStatus
      } : u));
      setUserDeptMap(prev => ({ ...prev, [selectedUserId]: formDeptId }));

      // Invoke parent hook
      onUpdateUserRole(selectedUserId, formRole);

      // Add log
      const newLog: OperationLog = {
        id: `log-${Date.now()}`,
        operatorName: '陆永奇',
        operatorRole: '管理员',
        actionType: '账号管理',
        actionDetail: `成功修改了账号 ${formName} 的配置以及部门归属`,
        ipAddress: '192.168.1.14',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        status: 'success'
      };
      setLogs(prev => [newLog, ...prev]);

      triggerToast(`账号「${formName}」配置修改已成功保存！`);
    }

    setIsDrawerOpen(false);
  };

  // Toggle user active status (online/offline simulates enable/disable)
  const handleToggleUserStatus = (userId: string, currentStatus: 'online' | 'offline') => {
    const nextStatus = currentStatus === 'online' ? 'offline' : 'online';
    const updatedUsers = localUsers.map(u => u.id === userId ? { ...u, status: nextStatus } : u);
    setLocalUsers(updatedUsers);
    
    const targetUser = localUsers.find(u => u.id === userId);
    const logAction = nextStatus === 'online' ? '启用' : '禁用';

    const newLog: OperationLog = {
      id: `log-${Date.now()}`,
      operatorName: '陆永奇',
      operatorRole: '管理员',
      actionType: '权限配置',
      actionDetail: `将账号 ${targetUser?.name || userId} 的状态更改为：${logAction}`,
      ipAddress: '192.168.1.14',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'success'
    };
    setLogs(prev => [newLog, ...prev]);

    triggerToast(`账号「${targetUser?.name}」已成功${logAction}！`);
  };

  // Toggle Model Channel Status locally
  const handleToggleChannelLocal = (channelId: string) => {
    const target = localChannels.find(ch => ch.id === channelId);
    if (!target) return;

    onToggleChannel(channelId);
    const updatedChannels = localChannels.map(ch => 
      ch.id === channelId ? { ...ch, status: ch.status === 'active' ? 'inactive' : 'active' as const } : ch
    );
    setLocalChannels(updatedChannels);

    const isNowActive = target.status !== 'active';
    const actionDesc = isNowActive ? '启用' : '停用';

    // Add activity log
    const newLog: OperationLog = {
      id: `log-${Date.now()}`,
      operatorName: '陆永奇',
      operatorRole: '管理员',
      actionType: '通道控制',
      actionDetail: `${actionDesc}算法模型通道「${target.name}」`,
      ipAddress: '192.168.1.14',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'success'
    };
    setLogs(prev => [newLog, ...prev]);

    triggerToast(`通道「${target.name}」已成功${actionDesc}！`);
  };

  // Open create channel drawer
  const handleOpenCreateChannelDrawer = () => {
    setChannelDrawerMode('create');
    setChannelFormName('');
    setChannelFormProvider('DaVinci Core');
    setChannelFormBaseUrl('https://api.davinci-ai.com/v1');
    setChannelFormApiKey('');
    setChannelFormDefaultModel('davinci-v3.5');
    setChannelFormLimit(5000);
    setChannelFormConcurrencyLimit(10);
    setChannelFormTimeout(60);
    setChannelFormRetryPolicy('exponential');
    setChannelFormCostRatio(0.015);
    setChannelFormCapabilities(['主图生成', '细节放大', '背景重构']);
    setSelectedChannelId(null);
    setIsChannelDrawerOpen(true);
  };

  // Open edit channel drawer
  const handleOpenEditChannelDrawer = (ch: ModelChannel) => {
    setChannelDrawerMode('edit');
    setChannelFormName(ch.name);
    setChannelFormProvider(ch.provider);
    setChannelFormBaseUrl(ch.baseUrl || 'https://api.davinci-ai.com/v1');
    setChannelFormApiKey(ch.apiKey || '••••••••••••••••••••••••••••••••');
    setChannelFormDefaultModel(ch.defaultModel || 'davinci-v3.5');
    setChannelFormLimit(ch.limit || 5000);
    setChannelFormConcurrencyLimit(ch.concurrencyLimit || 10);
    setChannelFormTimeout(ch.timeoutSeconds || 60);
    setChannelFormRetryPolicy(ch.retryPolicy || 'exponential');
    setChannelFormCostRatio(ch.costRatio || 0.015);
    setChannelFormCapabilities(ch.capabilities || ['主图生成', '细节放大', '背景重构']);
    setSelectedChannelId(ch.id);
    setIsChannelDrawerOpen(true);
  };

  // Save channel (create or edit)
  const handleSaveChannel = () => {
    if (!channelFormName.trim()) {
      alert('请填写通道名称！');
      return;
    }

    if (channelDrawerMode === 'create') {
      const newChannel: ModelChannel = {
        id: `m-${Date.now()}`,
        name: channelFormName,
        provider: channelFormProvider,
        status: 'active',
        todayUsage: 0,
        limit: channelFormLimit,
        latency: '1.5s', // mocked latency for initial
        baseUrl: channelFormBaseUrl,
        apiKey: channelFormApiKey,
        defaultModel: channelFormDefaultModel,
        concurrencyLimit: channelFormConcurrencyLimit,
        timeoutSeconds: channelFormTimeout,
        retryPolicy: channelFormRetryPolicy,
        costRatio: channelFormCostRatio,
        capabilities: channelFormCapabilities
      };

      setLocalChannels(prev => [...prev, newChannel]);

      // Add operation log
      const newLog: OperationLog = {
        id: `log-${Date.now()}`,
        operatorName: '陆永奇',
        operatorRole: '管理员',
        actionType: '渠道配置',
        actionDetail: `成功创建了模型生成通道 「${channelFormName}」 (${channelFormProvider})`,
        ipAddress: '192.168.1.14',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        status: 'success'
      };
      setLogs(prev => [newLog, ...prev]);

      triggerToast(`通道「${channelFormName}」已成功创建！`);
    } else if (channelDrawerMode === 'edit' && selectedChannelId) {
      setLocalChannels(prev => prev.map(ch => ch.id === selectedChannelId ? {
        ...ch,
        name: channelFormName,
        provider: channelFormProvider,
        limit: channelFormLimit,
        baseUrl: channelFormBaseUrl,
        apiKey: channelFormApiKey,
        defaultModel: channelFormDefaultModel,
        concurrencyLimit: channelFormConcurrencyLimit,
        timeoutSeconds: channelFormTimeout,
        retryPolicy: channelFormRetryPolicy,
        costRatio: channelFormCostRatio,
        capabilities: channelFormCapabilities
      } : ch));

      // Add operation log
      const newLog: OperationLog = {
        id: `log-${Date.now()}`,
        operatorName: '陆永奇',
        operatorRole: '管理员',
        actionType: '渠道配置',
        actionDetail: `成功更新了模型通道 「${channelFormName}」 的接口与配额配置`,
        ipAddress: '192.168.1.14',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        status: 'success'
      };
      setLogs(prev => [newLog, ...prev]);

      triggerToast(`通道「${channelFormName}」配置已成功更新！`);
    }

    setIsChannelDrawerOpen(false);
  };

  // Delete channel
  const handleDeleteChannel = (channelId: string) => {
    const ch = localChannels.find(c => c.id === channelId);
    if (!ch) return;

    if (confirm(`确定要彻底删除模型通道「${ch.name}」吗？`)) {
      setLocalChannels(prev => prev.filter(c => c.id !== channelId));

      // Add operation log
      const newLog: OperationLog = {
        id: `log-${Date.now()}`,
        operatorName: '陆永奇',
        operatorRole: '管理员',
        actionType: '渠道配置',
        actionDetail: `删除了模型通道 「${ch.name}」`,
        ipAddress: '192.168.1.14',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        status: 'success'
      };
      setLogs(prev => [newLog, ...prev]);

      triggerToast(`通道「${ch.name}」已成功删除！`);
    }
  };

  const handleToggleCapability = (cap: string) => {
    setChannelFormCapabilities(prev =>
      prev.includes(cap) ? prev.filter(c => c !== cap) : [...prev, cap]
    );
  };

  // Recursive function to render a single department and its descendants
  const renderDepartmentNode = (dept: Department, depth: number) => {
    const children = departments.filter(d => d.parentId === dept.id);
    const isExpanded = !!expandedDepts[dept.id];
    const hasChildren = children.length > 0;
    
    // Count direct and indirect employees
    const getEmployeeCount = (dId: string): number => {
      let count = localUsers.filter(u => userDeptMap[u.id] === dId).length;
      // Also sum children
      const childDepts = departments.filter(d => d.parentId === dId);
      childDepts.forEach(cd => {
        count += getEmployeeCount(cd.id);
      });
      return count;
    };

    const directMembers = localUsers.filter(u => userDeptMap[u.id] === dept.id);
    const totalMembers = getEmployeeCount(dept.id);

    const toggleExpand = (e: React.MouseEvent) => {
      e.stopPropagation();
      setExpandedDepts(prev => ({ ...prev, [dept.id]: !prev[dept.id] }));
    };

    return (
      <div key={dept.id} className="space-y-2 select-none" style={{ marginLeft: depth > 0 ? `${depth * 16}px` : '0px' }}>
        {/* Department Card */}
        <div className="group bg-white rounded-xl border border-slate-200/60 p-4 hover:border-blue-300 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 relative">
          
          {/* Left info */}
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

          {/* Right meta and actions */}
          <div className="flex items-center gap-4 self-end md:self-auto">
            {/* Direct / Total Staff Badges */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 bg-slate-100/80 px-2 py-1 rounded-lg font-semibold">
                直属员工: <strong className="text-slate-700 font-bold font-mono">{directMembers.length}</strong>
              </span>
              <span className="text-[10px] text-blue-500 bg-blue-50/70 px-2 py-1 rounded-lg font-semibold">
                总人数: <strong className="text-blue-600 font-bold font-mono">{totalMembers}</strong>
              </span>
            </div>

            {/* Quick action buttons (Visible on card hover) */}
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

        {/* Child level list */}
        {hasChildren && isExpanded && (
          <div className="relative pl-3 border-l-2 border-slate-100 ml-4 space-y-2.5">
            {children.map(child => renderDepartmentNode(child, 0))}
          </div>
        )}
      </div>
    );
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
                      {departments.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
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
                          const userDept = getDeptForUser(user);
                          const isOnline = user.status === 'online';

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
                                  isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                  {isOnline ? '启用' : '停用'}
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
                                      isOnline ? 'text-rose-500 hover:text-rose-700' : 'text-emerald-500 hover:text-emerald-700'
                                    }`}
                                  >
                                    {isOnline ? '停用' : '启用'}
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
          {activeUserSubTab === 'roles' && <RoleManageTab />}

          {/* Inner Tab 3: 菜单配置 (Menu configuration) */}
          {activeUserSubTab === 'menu' && <MenuConfigTab />}

        </div>
      )}

      {/* MAIN VIEW: 组织架构 (Organization Structure Management) */}
      {activeMainTab === 'org' && (
        <div className="space-y-6">
          {/* Top Info Banner */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3 shadow-xs">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-800">组织架构功能提示</h4>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed font-semibold">
                本面板支持创建与管理多级归属部门，建立层级化的业务关联。
                你可以通过将子部门绑定到上级，直观地呈现企业多层树状组织脉络。鼠标悬停在对应部门卡片上可以快速 <strong>“新增子部门”</strong>、<strong>“编辑配置”</strong> 或 <strong>“删除空置部门”</strong>。
              </p>
            </div>
          </div>

          {/* Org KPI Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs">
              <span className="text-[10px] font-mono text-slate-400 block uppercase font-bold">Total Departments</span>
              <span className="text-xl font-bold text-slate-800 block mt-1">{departments.length} 个</span>
              <span className="text-[10px] text-emerald-500 font-semibold block mt-1">已建立三级层级结构</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs">
              <span className="text-[10px] font-mono text-slate-400 block uppercase font-bold">Active Staff Mapped</span>
              <span className="text-xl font-bold text-slate-800 block mt-1">{localUsers.length} 人</span>
              <span className="text-[10px] text-slate-400 font-semibold block mt-1">全量绑定到所属部门</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs">
              <span className="text-[10px] font-mono text-slate-400 block uppercase font-bold">Primary Departments</span>
              <span className="text-xl font-bold text-slate-800 block mt-1">
                {departments.filter(d => d.parentId === null).length} 个
              </span>
              <span className="text-[10px] text-blue-500 font-semibold block mt-1">含总部核心支柱业务</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs">
              <span className="text-[10px] font-mono text-slate-400 block uppercase font-bold">Unassigned</span>
              <span className="text-xl font-bold text-slate-800 block mt-1">0 人</span>
              <span className="text-[10px] text-slate-400 font-semibold block mt-1">新入职员工自动绑定</span>
            </div>
          </div>

          {/* Org Tree Card Panel */}
          <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden shadow-xs flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Network className="w-4 h-4 text-blue-600" />
                企业多级组织部门树状图
              </span>
              <button
                onClick={() => handleOpenCreateDeptDrawer(null)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                新增一级部门
              </button>
            </div>

            <div className="p-5 md:p-6 space-y-3.5 bg-slate-50/30">
              {/* Root branches rendering */}
              {departments.filter(d => d.parentId === null).length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-semibold">
                  暂无一级根部门，请先点击右上角新增一级部门！
                </div>
              ) : (
                departments
                  .filter(d => d.parentId === null)
                  .map(rootDept => renderDepartmentNode(rootDept, 0))
              )}
            </div>
          </div>
        </div>
      )}

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
              { id: 'transit', label: '中转站' },
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
          {filteredChannels.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 font-bold">
              暂无匹配此分类的模型通道，你可以点击右上角新建一个通道！
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredChannels.map((ch) => {
                const isActive = ch.status === 'active';
                
                // Dynamic icons depending on provider
                const getProviderIcon = () => {
                  if (ch.provider === 'DaVinci Core') return <Cloud className="w-5 h-5 text-blue-600" />;
                  if (ch.provider === 'Midjourney') return <Cpu className="w-5 h-5 text-emerald-600" />;
                  if (ch.provider === 'Stable Diffusion') return <Database className="w-5 h-5 text-indigo-600" />;
                  if (ch.provider === 'Runway') return <Film className="w-5 h-5 text-pink-600" />;
                  return <Layers className="w-5 h-5 text-amber-600" />;
                };

                // Type sub-badge text
                const getTypeBadge = () => {
                  if (ch.provider === 'DaVinci Core' || ch.provider === 'Runway') return '云端 API';
                  if (ch.provider === 'Stable Diffusion') return '本地模型 (HTTP)';
                  return '中转站';
                };

                // Mapped capabilities
                const caps = ch.capabilities || ['主图生成', '细节放大', '背景重构'];

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
                            {ch.name}
                          </h4>
                          <span className="inline-block mt-1 text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                            {getTypeBadge()}
                          </span>
                        </div>
                      </div>

                      {/* Switch Toggle */}
                      <button
                        onClick={() => handleToggleChannelLocal(ch.id)}
                        className={`p-0.5 rounded-full w-9 h-5.5 transition-all focus:outline-none cursor-pointer flex items-center ${
                          isActive ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                        }`}
                      >
                        <span className="w-4.5 h-4.5 rounded-full bg-white shadow-xs" />
                      </button>
                    </div>

                    {/* Capabilities range */}
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

                    {/* Stats details mapping */}
                    <div className="pt-4 border-t border-slate-100">
                      {isActive ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block leading-none mb-1">今日消耗预估</span>
                            <span className="text-xs font-black text-slate-800">
                              ¥ {(ch.todayUsage * 1.5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block leading-none mb-1">异常率 (1h内)</span>
                            <span className={`text-xs font-black flex items-center gap-0.5 ${ch.todayUsage > 1000 ? 'text-amber-500' : 'text-emerald-500'}`}>
                              {ch.todayUsage > 1000 ? '1.45%' : '0.02%'}
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5 justify-center py-2 bg-slate-100 rounded-xl">
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                          此通道已停用，将拒绝前台提交请求
                        </div>
                      )}
                    </div>

                    {/* Action buttons overlays shown on group hover */}
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 backdrop-blur-xs p-1 rounded-lg border border-slate-100 shadow-sm">
                      <button
                        onClick={() => handleOpenEditChannelDrawer(ch)}
                        className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
                        title="编辑配置"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteChannel(ch.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
                        title="删除通道"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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

                {/* Corporate email prefix */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    企业邮箱账号 <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="例如: username"
                      className="w-full pl-3 pr-24 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-mono font-bold"
                    />
                    <span className="absolute right-3 text-[11px] text-slate-400 font-mono font-bold select-none bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      @daVinci.ai
                    </span>
                  </div>
                </div>

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
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SECTION 2: Role assigning cards */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-blue-600 border-l-4 border-blue-600 pl-2">
                  角色分配与授权范围
                </h4>

                <div className="grid grid-cols-1 gap-3">
                  {[
                    { roleVal: '运营策划', title: '运营专员 (Operator)', desc: '负责批次素材的日常提交、在线筛选评分以及基础运营效能复盘。' },
                    { roleVal: '高级设计师', title: '设计师 (Designer)', desc: '负责设计模板创作、维护负面规则，拥有核心创意控制权。' },
                    { roleVal: '管理员', title: '系统管理员 (Admin)', desc: '最高运维控制级。负责员工协作分配，一键断电模型接口等操作。' },
                    { roleVal: '协同客户', title: '外部协同人 (Client)', desc: '仅预览协作权限，拥有成品阅览、在线评论与标记反馈等协作属性。' }
                  ].map((card) => {
                    const isChecked = formRole === card.roleVal;
                    return (
                      <div
                        key={card.roleVal}
                        onClick={() => setFormRole(card.roleVal as any)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all select-none flex flex-col space-y-1.5 ${
                          isChecked
                            ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500/20'
                            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-800">{card.title}</span>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isChecked ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                          }`}>
                            {isChecked && <Check className="w-2.5 h-2.5 stroke-[3px]" />}
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          {card.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
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

      {/* OVERLAY PANEL DRAWER: 新建 / 编辑部门 */}
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
                <h4 className="text-xs font-bold text-blue-600 border-l-4 border-blue-600 pl-2">
                  基本信息
                </h4>

                {/* Name */}
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

                {/* Unique Code */}
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
                    创建后编码不可修改，用于API映射或系统后台日志定位。
                  </p>
                </div>

                {/* Parent Department Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    上级归属部门
                  </label>
                  <select
                    value={deptFormParentId || ''}
                    onChange={(e) => setDeptFormParentId(e.target.value || null)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none text-slate-700 font-semibold"
                  >
                    <option value="">(无上级部门 - 设为一级部门)</option>
                    {departments
                      .filter(d => d.id !== selectedDeptId && (!selectedDeptId || !isDescendant(d.id, selectedDeptId)))
                      .map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                  </select>
                </div>

                {/* Manager Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    部门负责人 / 领队
                  </label>
                  <select
                    value={deptFormManager}
                    onChange={(e) => setDeptFormManager(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none text-slate-700 font-semibold"
                  >
                    <option value="">请选择负责人</option>
                    {localUsers.map(u => (
                      <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
                    ))}
                    <option value="协同客户代表">协同客户代表</option>
                  </select>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    部门简要描述
                  </label>
                  <textarea
                    value={deptFormDescription}
                    onChange={(e) => setDeptFormDescription(e.target.value)}
                    placeholder="请输入部门的核心业务简介，限100字以内..."
                    rows={3}
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-semibold resize-none"
                  />
                </div>
              </div>

              <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-400 leading-normal">
                  组织架构调整后将实时影响「员工账号」以及「模型通道分配」的归属范围，并且相关变更会自动记录在操作日志中。
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
              <button
                onClick={handleSaveDepartment}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                {deptDrawerMode === 'create' ? '确认创建' : '保存修改'}
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

                {/* Provider Select */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    供应商厂商 <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <select
                    value={channelFormProvider}
                    onChange={(e) => {
                      const prov = e.target.value as ModelChannel['provider'];
                      setChannelFormProvider(prov);
                      // Auto populate defaults
                      if (prov === 'DaVinci Core') {
                        setChannelFormBaseUrl('https://api.davinci-ai.com/v1');
                        setChannelFormDefaultModel('davinci-v3.5');
                      } else if (prov === 'Midjourney') {
                        setChannelFormBaseUrl('https://api.midjourney.com/v2');
                        setChannelFormDefaultModel('mj-v6.0');
                      } else if (prov === 'Stable Diffusion') {
                        setChannelFormBaseUrl('http://127.0.0.1:7860/sdapi/v1');
                        setChannelFormDefaultModel('sd-xl-base-1.0');
                      } else if (prov === 'Runway') {
                        setChannelFormBaseUrl('https://api.runwayml.com/v1');
                        setChannelFormDefaultModel('gen-2');
                      } else if (prov === 'Kling AI') {
                        setChannelFormBaseUrl('https://api.klingai.com/v1');
                        setChannelFormDefaultModel('kling-v1.5');
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none text-slate-700 font-bold"
                  >
                    <option value="DaVinci Core">DaVinci Core (自研星火核心)</option>
                    <option value="Midjourney">Midjourney (写实美学中转)</option>
                    <option value="Stable Diffusion">Stable Diffusion (本地私有部署)</option>
                    <option value="Runway">Runway (高表现力视频流)</option>
                    <option value="Kling AI">Kling AI (快手可灵视频)</option>
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
                    API 基础代理网关 (Base URL)
                  </label>
                  <input
                    type="text"
                    value={channelFormBaseUrl}
                    onChange={(e) => setChannelFormBaseUrl(e.target.value)}
                    placeholder="https://api.davinci-ai.com/v1"
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-mono"
                  />
                </div>

                {/* API Key */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    API 密钥私钥凭证 (Secret Key)
                  </label>
                  <input
                    type="password"
                    value={channelFormApiKey}
                    onChange={(e) => setChannelFormApiKey(e.target.value)}
                    placeholder="请输入服务商提供的 API-Key (保存后将高强度脱敏)"
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-mono"
                  />
                </div>

                {/* Default Model */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    主调用模型名称 (Default Model ID)
                  </label>
                  <input
                    type="text"
                    value={channelFormDefaultModel}
                    onChange={(e) => setChannelFormDefaultModel(e.target.value)}
                    placeholder="davinci-v3.5"
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-mono font-bold"
                  />
                </div>
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

                {/* Capabilities check grid */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">
                    赋能能力边界范围
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['主图生成', '细节放大', '背景重构', '局部重绘', '智能排版', '场景融合'].map((cap) => {
                      const isChecked = channelFormCapabilities.includes(cap);
                      return (
                        <div
                          key={cap}
                          onClick={() => handleToggleCapability(cap)}
                          className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all select-none ${
                            isChecked ? 'bg-blue-50/20 border-blue-200' : 'bg-slate-50/50 border-slate-150'
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                            isChecked ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                          }`}>
                            {isChecked && <Check className="w-2.5 h-2.5 stroke-[3px]" />}
                          </div>
                          <span className="text-[10px] font-bold text-slate-700">{cap}</span>
                        </div>
                      );
                    })}
                  </div>
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

    </div>
  );
};
