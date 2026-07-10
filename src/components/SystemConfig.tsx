import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Edit,
  Trash2,
  X,
  Check,
  Info,
  Sliders,
  Clock,
  RotateCcw,
  CheckCircle2,
  Cloud,
  Cpu,
  Database,
  Film,
  Layers,
  Lock,
  Shield,
  Plus,
} from 'lucide-react';
import { rightsApi } from '../api/modules/rights';
import { roleApi } from '../api/modules/role';
import type { RightsResponse, RoleResponse, PageInfo } from '../api/types';
import type { ModelChannel } from '../types';

interface SystemConfigProps {
  channels: ModelChannel[];
  onToggleChannel: (id: string) => void;
}

// Activity Log definition（mock，操作日志模块本期排除，保留渲染）
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

/**
 * 系统配置主 Tab
 * 2026-07-09 改造:用户管理 / 组织架构 已移出为独立主 Tab
 * 现在此页面只保留:
 *   - 权限点配置（对接 AdminRightsController）
 *   - 模型通道统管（mock,本期不接入）
 *   - 操作日志（mock,本期不接入）
 */
export const SystemConfig: React.FC<SystemConfigProps> = ({
  channels,
  onToggleChannel,
}) => {
  // 1. High level main tabs（2026-07-09 改:users/org 已移出）
  const [activeMainTab, setActiveMainTab] = useState<'permissions' | 'channels' | 'logs'>(
    'permissions',
  );

  // 2. 权限码列表（接 AdminRightsController）
  const [rightsList, setRightsList] = useState<RightsResponse[]>([]);
  const [rightsLoading, setRightsLoading] = useState(false);

  // 3. 角色列表（用于角色权限矩阵 — 暂保留 mock,后续 TICKET 落地）
  const [rolesList, setRolesList] = useState<RoleResponse[]>([]);

  // 4. 角色权限矩阵 (mock)
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({
    '管理员': ['user:create', 'user:edit', 'user:status', 'role:config', 'channel:toggle', 'channel:limit', 'task:create', 'task:audit', 'template:manage'],
    '高级设计师': ['task:create', 'template:manage', 'channel:toggle'],
    '运营策划': ['task:create', 'task:audit'],
    '协同客户': ['task:audit'],
  });
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<string | null>(null);

  // 5. 操作日志（mock,本期不接入）
  const [logs] = useState<OperationLog[]>([
    { id: 'l1', operatorName: '陆永奇', operatorRole: '管理员', actionType: '账号管理', actionDetail: '新建员工账号 zhangsf@company.com 并赋予超级管理员角色', ipAddress: '192.168.1.14', timestamp: '2026-07-06 10:15', status: 'success' },
    { id: 'l2', operatorName: '陆永奇', operatorRole: '管理员', actionType: '渠道配置', actionDetail: '启用 Kling AI 1.5 Pro Video Engine 通道并设置每日限额 500 Pts', ipAddress: '192.168.1.14', timestamp: '2026-07-06 09:30', status: 'success' },
    { id: 'l3', operatorName: '陈美晴', operatorRole: '高级设计师', actionType: '模板管理', actionDetail: '更新了模板「女装电商白底图 V2」的 Prompt 片段规则', ipAddress: '192.168.1.28', timestamp: '2026-07-05 14:24', status: 'success' },
    { id: 'l4', operatorName: '张思豪', operatorRole: '运营策划', actionType: '任务管理', actionDetail: '审核通过了批次素材 「T-1002 - 精华保湿乳」', ipAddress: '192.168.2.102', timestamp: '2026-07-05 11:15', status: 'success' },
    { id: 'l5', operatorName: '陆永奇', operatorRole: '管理员', actionType: '安全配置', actionDetail: '尝试修改超级管理员内置角色权限组 - 拒绝操作', ipAddress: '192.168.1.14', timestamp: '2026-07-04 16:40', status: 'failed' },
    { id: 'l6', operatorName: '系统自动', operatorRole: '系统账号', actionType: '任务监控', actionDetail: '批次任务 T-1003 内存不足抛出 CUDA 异常，发送系统警告通知', ipAddress: '127.0.0.1', timestamp: '2026-07-03 16:11', status: 'success' },
  ]);

  // 6. 通道相关 state（mock 状态 + drawer）
  const [localChannels, setLocalChannels] = useState<ModelChannel[]>(channels);
  const [channelFilter, setChannelFilter] = useState<'all' | 'cloud' | 'local' | 'transit' | 'disabled'>('all');
  const [isChannelDrawerOpen, setIsChannelDrawerOpen] = useState(false);
  const [channelDrawerMode, setChannelDrawerMode] = useState<'create' | 'edit'>('create');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
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

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ===== fetch effects =====
  const fetchRights = useCallback(async () => {
    setRightsLoading(true);
    try {
      const list = await rightsApi.list();
      setRightsList(list ?? []);
    } catch (e) {
      // axios 已 toast
    } finally {
      setRightsLoading(false);
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
    fetchRights();
    fetchRoles();
  }, [fetchRights, fetchRoles]);

  // ===== derived =====
  const groupedRights = useMemo(() => {
    const map = new Map<string, RightsResponse[]>();
    rightsList.forEach((r) => {
      const key = r.module || '未分组';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries());
  }, [rightsList]);

  const permissionPoints = useMemo(
    () =>
      rightsList.map((r) => ({
        code: r.rightsCode ?? '',
        name: r.rightsName ?? '',
        module: r.module ?? '未分组',
        description: r.description ?? '',
      })),
    [rightsList],
  );

  const filteredChannels = useMemo(() => {
    return localChannels.filter((ch) => {
      if (channelFilter === 'disabled') return ch.status === 'inactive';
      if (channelFilter === 'cloud') return ch.status === 'active' && (ch.provider === 'DaVinci Core' || ch.provider === 'Runway');
      if (channelFilter === 'transit') return ch.status === 'active' && (ch.provider === 'Midjourney' || ch.provider === 'Kling AI');
      if (channelFilter === 'local') return ch.status === 'active' && ch.provider === 'Stable Diffusion';
      return true;
    });
  }, [localChannels, channelFilter]);

  // ===== channel handlers =====
  const handleToggleChannelLocal = (channelId: string) => {
    onToggleChannel(channelId);
    setLocalChannels((prev) => prev.map((ch) =>
      ch.id === channelId ? { ...ch, status: ch.status === 'active' ? 'inactive' : 'active' } : ch,
    ));
    const target = localChannels.find((ch) => ch.id === channelId);
    if (target) {
      triggerToast(`通道「${target.name}」已成功${target.status !== 'active' ? '启用' : '停用'}！`);
    }
  };

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
        latency: '1.5s',
        baseUrl: channelFormBaseUrl,
        apiKey: channelFormApiKey,
        defaultModel: channelFormDefaultModel,
        concurrencyLimit: channelFormConcurrencyLimit,
        timeoutSeconds: channelFormTimeout,
        retryPolicy: channelFormRetryPolicy,
        costRatio: channelFormCostRatio,
        capabilities: channelFormCapabilities,
      };
      setLocalChannels((prev) => [...prev, newChannel]);
      triggerToast(`通道「${channelFormName}」已成功创建！`);
    } else if (channelDrawerMode === 'edit' && selectedChannelId) {
      setLocalChannels((prev) =>
        prev.map((ch) =>
          ch.id === selectedChannelId
            ? {
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
                capabilities: channelFormCapabilities,
              }
            : ch,
        ),
      );
      triggerToast(`通道「${channelFormName}」配置已成功更新！`);
    }
    setIsChannelDrawerOpen(false);
  };

  const handleDeleteChannel = (channelId: string) => {
    const ch = localChannels.find((c) => c.id === channelId);
    if (!ch) return;
    if (confirm(`确定要彻底删除模型通道「${ch.name}」吗？`)) {
      setLocalChannels((prev) => prev.filter((c) => c.id !== channelId));
      triggerToast(`通道「${ch.name}」已成功删除！`);
    }
  };

  const handleToggleCapability = (cap: string) => {
    setChannelFormCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap],
    );
  };

  // ===== RBAC handlers =====
  const handleToggleRolePermission = (role: string, permCode: string) => {
    setRolePermissions((prev) => {
      const current = prev[role] || [];
      const updated = current.includes(permCode)
        ? current.filter((c) => c !== permCode)
        : [...current, permCode];
      return { ...prev, [role]: updated };
    });
  };

  const handleSaveRolePermissions = () => {
    if (!selectedRoleForPerms) return;
    triggerToast(`角色「${selectedRoleForPerms}」的 RBAC 权限授权方案已保存并实时生效！`);
    setSelectedRoleForPerms(null);
  };

  // ===== render =====
  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-[#0B1C30] text-white px-4 py-3 rounded-xl border border-blue-500/30 shadow-2xl flex items-center gap-2.5 animate-bounce-short">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header Tabs */}
      <div className="flex border-b border-slate-200 pb-0">
        <div className="flex h-12">
          <button
            onClick={() => setActiveMainTab('permissions')}
            className={`h-full px-6 flex items-center gap-2 text-xs font-bold relative transition-all duration-200 cursor-pointer ${
              activeMainTab === 'permissions'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Shield className="w-4 h-4 shrink-0" />
            权限点配置
          </button>
          <button
            onClick={() => setActiveMainTab('channels')}
            className={`h-full px-6 flex items-center gap-2 text-xs font-bold relative transition-all duration-200 cursor-pointer ${
              activeMainTab === 'channels'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Sliders className="w-4 h-4 shrink-0" />
            模型通道统管
          </button>
          <button
            onClick={() => setActiveMainTab('logs')}
            className={`h-full px-6 flex items-center gap-2 text-xs font-bold relative transition-all duration-200 cursor-pointer ${
              activeMainTab === 'logs'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            操作日志
          </button>
        </div>
      </div>

      {/* Tab: 权限点 */}
      {activeMainTab === 'permissions' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3 shadow-xs">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-800">权限点配置</h4>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                系统全局功能权限点清单，由 AdminRightsController 管理。新增 / 编辑 / 删除请走接口。
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs font-bold text-slate-700">系统全局功能权限点清单</span>
              <span className="text-[10px] text-slate-400 font-semibold font-mono">
                DaVinci System Nodes: {permissionPoints.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="py-3 px-5 w-48">权限点编码</th>
                    <th className="py-3 px-5 w-40">权限点名称</th>
                    <th className="py-3 px-5 w-40">归属模块</th>
                    <th className="py-3 px-5">权限描述</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                  {permissionPoints.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-slate-400 font-semibold">
                        {rightsLoading ? '加载中...' : '暂无权限点数据,请在右侧 RBAC 矩阵中添加'}
                      </td>
                    </tr>
                  ) : (
                    permissionPoints.map((point) => (
                      <tr key={point.code} className="hover:bg-slate-50/20">
                        <td className="py-3.5 px-5 font-mono text-blue-600 font-bold">{point.code}</td>
                        <td className="py-3.5 px-5 font-bold text-slate-800">{point.name}</td>
                        <td className="py-3.5 px-5">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">
                            {point.module}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-slate-400">{point.description}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* RBAC 角色权限矩阵（mock,仅展示） */}
          <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs font-bold text-slate-700">RBAC 角色权限矩阵（mock）</span>
              <span className="text-[10px] text-slate-400 font-semibold">
                实际角色授权请到"角色管理"主 Tab
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
              {(['管理员', '高级设计师', '运营策划', '协同客户'] as const).map((role) => {
                const permsCount = rolePermissions[role]?.length || 0;
                return (
                  <div key={role} className="bg-slate-50/30 rounded-xl border border-slate-200/60 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-sm font-bold text-slate-800">{role}</h4>
                      <span className="bg-blue-50 text-blue-600 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-100">
                        {permsCount}权限
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedRoleForPerms(role)}
                      className="w-full mt-2 px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer"
                    >
                      配置权限
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab: 模型通道 */}
      {activeMainTab === 'channels' && (
        <div className="space-y-6">
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

          <div className="flex gap-6 border-b border-slate-200/60 pb-px">
            {[
              { id: 'all', label: '全部通道' },
              { id: 'cloud', label: '云端 API' },
              { id: 'local', label: '本地模型' },
              { id: 'transit', label: '中转站' },
              { id: 'disabled', label: '停用通道' },
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

          {filteredChannels.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 font-bold">
              暂无匹配此分类的模型通道，你可以点击右上角新建一个通道！
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredChannels.map((ch) => {
                const isActive = ch.status === 'active';
                const getProviderIcon = () => {
                  if (ch.provider === 'DaVinci Core') return <Cloud className="w-5 h-5 text-blue-600" />;
                  if (ch.provider === 'Midjourney') return <Cpu className="w-5 h-5 text-emerald-600" />;
                  if (ch.provider === 'Stable Diffusion') return <Database className="w-5 h-5 text-indigo-600" />;
                  if (ch.provider === 'Runway') return <Film className="w-5 h-5 text-pink-600" />;
                  return <Layers className="w-5 h-5 text-amber-600" />;
                };
                const getTypeBadge = () => {
                  if (ch.provider === 'DaVinci Core' || ch.provider === 'Runway') return '云端 API';
                  if (ch.provider === 'Stable Diffusion') return '本地模型 (HTTP)';
                  return '中转站';
                };
                const caps = ch.capabilities || ['主图生成', '细节放大', '背景重构'];

                return (
                  <div
                    key={ch.id}
                    className={`bg-white rounded-2xl p-5 border shadow-2xs transition-all flex flex-col justify-between space-y-4 group relative hover:shadow-md ${
                      isActive ? 'border-slate-200' : 'border-slate-200/60 bg-slate-50/50 opacity-70'
                    }`}
                  >
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
                      <button
                        onClick={() => handleToggleChannelLocal(ch.id)}
                        className={`p-0.5 rounded-full w-9 h-5.5 transition-all focus:outline-none cursor-pointer flex items-center ${
                          isActive ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                        }`}
                      >
                        <span className="w-4.5 h-4.5 rounded-full bg-white shadow-xs" />
                      </button>
                    </div>

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

                    <div className="pt-4 border-t border-slate-100">
                      {isActive ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block leading-none mb-1">今日消耗预估</span>
                            <span className="text-xs font-black text-slate-800">
                              ¥ {(ch.todayUsage * 1.5).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block leading-none mb-1">异常率 (1h内)</span>
                            <span
                              className={`text-xs font-black flex items-center gap-0.5 ${
                                ch.todayUsage > 1000 ? 'text-amber-500' : 'text-emerald-500'
                              }`}
                            >
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

      {/* Tab: 操作日志 */}
      {activeMainTab === 'logs' && (
        <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-xs font-bold text-slate-800">系统审计与安全操作日志</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                记录当前系统高危权限操作、一键断电及RBAC安全权限调整动作。
              </p>
            </div>
            <button
              onClick={() => triggerToast('审计日志已完成实时刷新归档！')}
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
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.operatorRole === '管理员'
                            ? 'bg-blue-50 text-blue-600 border border-blue-100'
                            : 'bg-purple-50 text-purple-600 border border-purple-100'
                        }`}
                      >
                        {log.operatorRole}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-700 whitespace-nowrap">{log.actionType}</td>
                    <td
                      className="py-3.5 px-5 font-sans text-slate-600 max-w-sm truncate"
                      title={log.actionDetail}
                    >
                      {log.actionDetail}
                    </td>
                    <td className="py-3.5 px-5 text-slate-400">{log.ipAddress}</td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'success'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-rose-50 text-rose-600'
                        }`}
                      >
                        <span
                          className={`w-1 h-1 rounded-full ${
                            log.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
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

      {/* 通道 Drawer */}
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
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-blue-600 border-l-4 border-blue-600 pl-2">
                  1. 算法厂商与基本信息
                </h4>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    供应商厂商 <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <select
                    value={channelFormProvider}
                    onChange={(e) => {
                      const prov = e.target.value as ModelChannel['provider'];
                      setChannelFormProvider(prov);
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

              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-blue-600 border-l-4 border-blue-600 pl-2">
                  2. 接口参数与访问凭证
                </h4>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">API 基础代理网关</label>
                  <input
                    type="text"
                    value={channelFormBaseUrl}
                    onChange={(e) => setChannelFormBaseUrl(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">API 密钥凭证</label>
                  <input
                    type="password"
                    value={channelFormApiKey}
                    onChange={(e) => setChannelFormApiKey(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-mono"
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">主调用模型名称</label>
                  <input
                    type="text"
                    value={channelFormDefaultModel}
                    onChange={(e) => setChannelFormDefaultModel(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-blue-600 border-l-4 border-blue-600 pl-2">
                  3. 限制阈值与能力范围
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">每日算力峰值配额 (Pts)</label>
                    <input
                      type="number"
                      value={channelFormLimit}
                      onChange={(e) => setChannelFormLimit(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">并发连接线程数</label>
                    <input
                      type="number"
                      value={channelFormConcurrencyLimit}
                      onChange={(e) => setChannelFormConcurrencyLimit(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-mono font-bold"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">连接超时 (秒)</label>
                    <input
                      type="number"
                      value={channelFormTimeout}
                      onChange={(e) => setChannelFormTimeout(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-800 transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">算力换算比率</label>
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
                  <label className="text-xs font-bold text-slate-700">失败重试策略</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'exponential', name: '指数级退避' },
                      { id: 'linear', name: '线性重试' },
                      { id: 'none', name: '直接报错' },
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

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">赋能能力边界范围</label>
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
                          <div
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                              isChecked ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                            }`}
                          >
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

      {/* RBAC PERMISSIONS MODAL */}
      {selectedRoleForPerms && (
        <div className="fixed inset-0 bg-[#0B1C30]/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">RBAC 功能授权配置矩阵</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  定制专属角色 「{selectedRoleForPerms}」 的全套功能授权
                </p>
              </div>
              <button
                onClick={() => setSelectedRoleForPerms(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="bg-blue-50/60 p-3 rounded-lg text-[11px] text-slate-500 leading-relaxed border border-blue-100/30">
                勾选或取消勾选对应的权限点。保存设置后，隶属于「{selectedRoleForPerms}」角色的所有协作账号其拥有的后台方法都会立即根据 RBAC 映射表重载。
              </div>
              <div className="space-y-3.5 pt-2">
                {permissionPoints.map((point) => {
                  const isChecked = (rolePermissions[selectedRoleForPerms] || []).includes(point.code);
                  return (
                    <div
                      key={point.code}
                      onClick={() => handleToggleRolePermission(selectedRoleForPerms, point.code)}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer select-none transition-colors ${
                        isChecked ? 'bg-blue-50/30 border-blue-200' : 'bg-slate-50/50 border-slate-150'
                      }`}
                    >
                      <div className="pt-0.5 shrink-0">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isChecked ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                          }`}
                        >
                          {isChecked && <Check className="w-2.5 h-2.5 stroke-[3px]" />}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{point.name}</span>
                          <span className="font-mono text-[9px] text-slate-400 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                            {point.code}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 leading-normal">{point.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setSelectedRoleForPerms(null)}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSaveRolePermissions}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm cursor-pointer"
              >
                保存授权方案
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 保留 groupedRights 供后续按 module 分组 UI 使用
