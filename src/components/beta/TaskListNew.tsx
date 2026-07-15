/**
 * 任务列表-新 · Dark Launch 版本
 *
 * [v2.0 2026-07-13 F3]
 * 改造点:
 *   D2 3 级 chip 过滤(group → capability → channel)
 *   D4 通道 chip 角标 "支持 N/M 个能力"
 *
 * 不动原 TaskList.tsx(老版本),两版并存。
 *
 * [v2.0 修订] Tailwind + lucide-react + sonner(项目 UI 库)
 */
import React, { useState, useMemo } from 'react';
import { useServiceQuery } from '../../api/hooks/useServiceQuery';
import { fetchCapabilityMatrix, type MatrixResponse } from '../../api/modules/capability';
import { Filter, X, Loader2, ChevronRight, Clock, CheckCircle2, AlertCircle, Layers } from 'lucide-react';
import { toast } from 'sonner';

type Group = 'all' | 'IMAGE' | 'VIDEO' | 'SOLUTION';
type TabKey = 'all' | 'running' | 'completed' | 'failed';

interface TaskListNewProps {
  /** [F2 mock] 暂用 mock 数据,F4 上线后切换为真实 taskApi.page */
  mockTasks?: any[];
}

const MOCK_TASKS = [
  { id: 'T-001', name: '夏季女装主图', type: 'image', status: 'completed', modelChannel: 'Qwen', capability: 'MAIN_IMAGE', model: 'qwen-vl-max', progress: 100, createdAt: '2026-07-12 14:30' },
  { id: 'T-002', name: '美妆场景图', type: 'image', status: 'running', modelChannel: 'Vidu', capability: 'SCENE_FUSION', model: 'viduq2', progress: 60, createdAt: '2026-07-12 15:22' },
  { id: 'T-003', name: '主图细节放大', type: 'image', status: 'completed', modelChannel: 'OpenAI', capability: 'DETAIL_ENHANCE', model: 'dall-e-3', progress: 100, createdAt: '2026-07-12 13:10' },
  { id: 'T-004', name: '电商成片-连衣裙', type: 'video', status: 'failed', modelChannel: 'Vidu', capability: 'SOLUTION_AD_FILM', model: 'viduq3-turbo', progress: 30, createdAt: '2026-07-12 12:45' },
  { id: 'T-005', name: '鞋靴 360°', type: 'image', status: 'completed', modelChannel: 'Doubao', capability: 'REF_IMG_EDIT', model: 'doubao-seedream', progress: 100, createdAt: '2026-07-12 11:00' },
];

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  running: { label: '进行中', color: 'bg-blue-100 text-blue-700', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  completed: { label: '已完成', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="w-3 h-3" /> },
  failed: { label: '失败', color: 'bg-rose-100 text-rose-700', icon: <AlertCircle className="w-3 h-3" /> },
  pending: { label: '排队中', color: 'bg-slate-100 text-slate-700', icon: <Clock className="w-3 h-3" /> },
};

export const TaskListNew: React.FC<TaskListNewProps> = () => {
  const [groupFilter, setGroupFilter] = useState<Group>('all');
  const [capabilityFilter, setCapabilityFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 拉能力矩阵
  const { data: matrix, loading: matrixLoading } = useServiceQuery<MatrixResponse>(
    () => fetchCapabilityMatrix(),
    [],
  );

  // 当前 group 下的 capability 列表
  const capabilitiesInGroup = useMemo(() => {
    if (!matrix || groupFilter === 'all') return [];
    const set = new Set<string>();
    for (const ch of matrix.channels) {
      for (const cap of ch.capabilities) {
        if (cap.group === groupFilter) set.add(cap.code);
      }
    }
    return Array.from(set);
  }, [matrix, groupFilter]);

  // 当前 group 下的 channel 列表
  const channelsInGroup = useMemo(() => {
    if (!matrix || groupFilter === 'all') return matrix?.channels ?? [];
    return matrix.channels.filter((ch) =>
      ch.capabilities.some((c) => c.group === groupFilter),
    );
  }, [matrix, groupFilter]);

  // 客户端过滤
  const filteredTasks = useMemo(() => {
    return MOCK_TASKS.filter((t) => {
      if (groupFilter !== 'all') {
        const cap = (matrix?.channels.flatMap((c) => c.capabilities) ?? []).find((c) => c.code === t.capability);
        if (cap?.group !== groupFilter) return false;
      }
      if (capabilityFilter !== 'all' && t.capability !== capabilityFilter) return false;
      if (channelFilter !== 'all' && t.modelChannel !== channelFilter) return false;
      if (activeTab !== 'all' && t.status !== activeTab) return false;
      if (searchTerm && !t.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [matrix, groupFilter, capabilityFilter, channelFilter, activeTab, searchTerm]);

  const clearFilters = () => {
    setGroupFilter('all');
    setCapabilityFilter('all');
    setChannelFilter('all');
    setActiveTab('all');
    setSearchTerm('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            任务列表
            <span className="text-rose-500 text-sm font-bold">-新</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 font-bold tracking-wider">BETA</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">3 级 chip 过滤(group → capability → channel)+ 通道能力角标</p>
        </div>
        <button
          type="button"
          onClick={() => toast.info('F3 阶段列表为 mock,F4 上线后接真实 taskApi.page')}
          className="px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-md hover:bg-slate-50"
        >
          数据源: mock(F3) → real(F4)
        </button>
      </div>

      {/* Row 1: 状态 Tab */}
      <div className="flex items-center border-b border-slate-200">
        {([
          ['all', '全部'],
          ['running', '进行中'],
          ['completed', '已完成'],
          ['failed', '失败'],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setActiveTab(k)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === k
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 3 级 chip 过滤 */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Filter className="w-3.5 h-3.5" />
          <span>3 级过滤</span>
          {(groupFilter !== 'all' || capabilityFilter !== 'all' || channelFilter !== 'all') && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto text-rose-500 hover:underline flex items-center gap-0.5"
            >
              <X className="w-3 h-3" />清空
            </button>
          )}
        </div>

        {/* Row 2: group */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-slate-500 w-12">分组</span>
          {(['all', 'IMAGE', 'VIDEO', 'SOLUTION'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => { setGroupFilter(g); setCapabilityFilter('all'); setChannelFilter('all'); }}
              className={`px-3 py-1 text-xs rounded-full border ${
                groupFilter === g
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-500'
              }`}
            >
              {g === 'all' ? '全部' : g}
            </button>
          ))}
        </div>

        {/* Row 3: capability */}
        {groupFilter !== 'all' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-500 w-12">能力</span>
            <button
              type="button"
              onClick={() => setCapabilityFilter('all')}
              className={`px-3 py-1 text-xs rounded-full border ${
                capabilityFilter === 'all'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-500'
              }`}
            >
              全部
            </button>
            {capabilitiesInGroup.map((cap) => (
              <button
                key={cap}
                type="button"
                onClick={() => setCapabilityFilter(cap)}
                className={`px-3 py-1 text-xs rounded-full border font-mono ${
                  capabilityFilter === cap
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-500'
                }`}
              >
                {cap}
              </button>
            ))}
          </div>
        )}

        {/* Row 4: channel(带角标) */}
        {groupFilter !== 'all' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-500 w-12">通道</span>
            {channelsInGroup.map((ch) => {
              const supported = ch.capabilities.filter((c) => c.group === groupFilter).length;
              const total = ch.capabilities.length;
              return (
                <button
                  key={ch.channelType}
                  type="button"
                  onClick={() => setChannelFilter(ch.channelType)}
                  className={`px-3 py-1 text-xs rounded-full border flex items-center gap-1.5 ${
                    channelFilter === ch.channelType
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-500'
                  }`}
                >
                  {ch.channelType}
                  <span className={`text-[10px] px-1 py-0 rounded-full ${
                    channelFilter === ch.channelType ? 'bg-white/20' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {supported}/{total} cap
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* 搜索框 */}
        <input
          type="text"
          placeholder="搜索任务名称"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {/* 列表 */}
      <div className="text-xs text-slate-500">共 {filteredTasks.length} 条任务</div>

      <div className="space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl text-center py-16 text-slate-400">
            <Layers className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>当前过滤条件下无任务</p>
          </div>
        ) : (
          filteredTasks.map((t) => {
            const status = STATUS_META[t.status] ?? STATUS_META.pending;
            return (
              <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-800 truncate">{t.name}</h3>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${status.color}`}>
                        {status.icon}{status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                      <span className="font-mono">{t.id}</span>
                      <span>·</span>
                      <span>通道: <span className="font-mono text-slate-700">{t.modelChannel}</span></span>
                      <span>·</span>
                      <span>能力: <span className="font-mono text-slate-700">{t.capability}</span></span>
                      <span>·</span>
                      <span>模型: <span className="font-mono text-slate-700">{t.model}</span></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {t.status === 'running' && (
                      <div className="w-32">
                        <div className="text-[10px] text-slate-500 text-right">{t.progress}%</div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${t.progress}%` }} />
                        </div>
                      </div>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">{t.createdAt}</span>
                    <button
                      type="button"
                      onClick={() => toast.info('F3 阶段任务详情 drawer 未实现,F4 PR 接入')}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
