import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  RotateCcw,
  XCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Code2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  type ChannelAsyncTask,
  type ChannelAsyncTaskQueryRequest,
  type ChannelType,
  type AsyncTaskStatus,
  CHANNEL_TYPE_LABELS,
  ASYNC_TASK_STATUS_STYLES,
} from '../types';
import { asyncTaskApi } from '../api/modules/asyncTask';
import { useServiceQuery } from '../api/hooks/useServiceQuery';

/**
 * 通道异步任务列表(Vidu 异步任务管理)
 * <p>
 * [v1.2 2026-07-11] Vidu 接入 — 管理员查/重试/取消异步任务
 * <p>
 * 决策 6 + 架构师审阅:
 * - 不引新依赖(用现有 lucide-react + Tailwind)
 * - 不重复造分页(用后端 pageInfo)
 * - 不写"同步排队"任务(留二期)
 */
export const AsyncTaskList: React.FC = () => {
  // 筛选条件
  const [channelType, setChannelType] = useState<ChannelType | ''>('');
  const [status, setStatus] = useState<AsyncTaskStatus | ''>('');
  const [bizId, setBizId] = useState('');
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(20);

  // 详情抽屉
  const [detail, setDetail] = useState<ChannelAsyncTask | null>(null);

  // 强制刷新(操作后 refetch 用)
  const [refreshKey, setRefreshKey] = useState(0);

  const queryReq: ChannelAsyncTaskQueryRequest = useMemo(() => ({
    page: pageNum,
    size: pageSize,
    channelType: channelType || undefined,
    status: status || undefined,
    bizId: bizId || undefined,
  }), [pageNum, pageSize, channelType, status, bizId]);

  // useServiceQuery:deps 含 queryReq + refreshKey,操作后改 refreshKey 触发 refetch
  const query = useServiceQuery(
    () => asyncTaskApi.page(queryReq),
    [queryReq, refreshKey]
  );

  // 初次进入 / 切换筛选时,数据可能 stale(后端 queryReq 已变但 useServiceQuery 没重跑)
  // 用一个 effect 显式 refetch
  useEffect(() => {
    // queryReq 变化时 useServiceQuery 会自动跑(它 deps 包含 queryReq 对象引用)
    // 这里不需要额外 refetch
  }, [queryReq]);

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const list: ChannelAsyncTask[] = query.data?.list ?? [];

  // 操作
  const handleRetry = async (id: string) => {
    if (!confirm(`确认重试异步任务 #${id}?`)) return;
    try {
      await asyncTaskApi.retry(id);
      setRefreshKey(k => k + 1);
    } catch (e: any) {
      alert(`重试失败: ${e?.message ?? e}`);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm(`确认取消异步任务 #${id}?`)) return;
    try {
      await asyncTaskApi.cancel(id);
      setRefreshKey(k => k + 1);
    } catch (e: any) {
      alert(`取消失败: ${e?.message ?? e}`);
    }
  };

  const handleResetFilter = () => {
    setChannelType('');
    setStatus('');
    setBizId('');
    setPageNum(1);
  };

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Loader2 className="text-primary" />
            通道异步任务
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Vidu 等异步通道任务的提交/轮询/失败管理
          </p>
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="flex items-center gap-2 px-4 h-10 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <RefreshCw size={16} />
          刷新
        </button>
      </header>

      {/* 筛选条 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            value={bizId}
            onChange={(e) => { setBizId(e.target.value); setPageNum(1); }}
            placeholder="按业务 ID 搜索 (generation_task.id)"
            className="flex-1 h-9 px-3 rounded-md border border-slate-200 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        <select
          value={channelType}
          onChange={(e) => { setChannelType(e.target.value as ChannelType | ''); setPageNum(1); }}
          className="h-9 px-3 rounded-md border border-slate-200 text-sm bg-white min-w-[140px]"
        >
          <option value="">全部通道</option>
          {(['VIDU', 'OPENAI', 'QWEN', 'DOUBAO', 'DEEPSEEK'] as ChannelType[]).map(t => (
            <option key={t} value={t}>{CHANNEL_TYPE_LABELS[t]}</option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as AsyncTaskStatus | ''); setPageNum(1); }}
          className="h-9 px-3 rounded-md border border-slate-200 text-sm bg-white min-w-[140px]"
        >
          <option value="">全部状态</option>
          {Object.entries(ASYNC_TASK_STATUS_STYLES).map(([s, style]) => (
            <option key={s} value={s}>{style.label}</option>
          ))}
        </select>

        <button
          onClick={handleResetFilter}
          className="h-9 px-3 rounded-md border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
        >
          重置
        </button>
      </div>

      {/* 表格 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">ID</th>
              <th className="px-4 py-3 text-left font-semibold">业务</th>
              <th className="px-4 py-3 text-left font-semibold">通道</th>
              <th className="px-4 py-3 text-left font-semibold">能力</th>
              <th className="px-4 py-3 text-left font-semibold">状态</th>
              <th className="px-4 py-3 text-left font-semibold">远程 Task ID</th>
              <th className="px-4 py-3 text-right font-semibold">结果数</th>
              <th className="px-4 py-3 text-right font-semibold">重试</th>
              <th className="px-4 py-3 text-left font-semibold">提交时间</th>
              <th className="px-4 py-3 text-left font-semibold">耗时</th>
              <th className="px-4 py-3 text-right font-semibold">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {query.loading && list.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                  <Loader2 className="inline animate-spin mr-2" size={16} />加载中...
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                  暂无异步任务
                </td>
              </tr>
            ) : (
              list.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">#{t.id}</td>
                  <td className="px-4 py-3">
                    {t.bizId ? (
                      <span className="font-mono text-xs">task #{t.bizId}</span>
                    ) : <span className="text-slate-400">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-slate-700">
                      {CHANNEL_TYPE_LABELS[t.channelType] ?? t.channelType}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{t.capability}</td>
                  <td className="px-4 py-3">
                    <StatusChip status={t.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 max-w-[180px] truncate" title={t.remoteTaskId ?? ''}>
                    {t.remoteTaskId ?? <span className="text-slate-400">-</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {t.resultType && (
                      <span className="text-slate-500 mr-1">{t.resultType}</span>
                    )}
                    {t.resultCount}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">
                    {t.retryCount ?? 0}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {t.startedAt ? formatTime(t.startedAt) : '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {t.durationMs != null ? `${t.durationMs}ms` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionButtons task={t} onDetail={setDetail} onRetry={handleRetry} onCancel={handleCancel} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {total > pageSize && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>共 {total} 条 · 第 {pageNum} / {totalPages} 页</span>
          <div className="flex gap-2">
            <button
              disabled={pageNum <= 1}
              onClick={() => setPageNum(p => p - 1)}
              className="h-9 px-3 rounded-md border border-slate-200 disabled:opacity-50 hover:bg-slate-50"
            >
              上一页
            </button>
            <button
              disabled={pageNum >= totalPages}
              onClick={() => setPageNum(p => p + 1)}
              className="h-9 px-3 rounded-md border border-slate-200 disabled:opacity-50 hover:bg-slate-50"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* 详情抽屉 */}
      {detail && (
        <DetailDrawer task={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
};

// ============ 子组件 ============

const StatusChip: React.FC<{ status: AsyncTaskStatus }> = ({ status }) => {
  const style = ASYNC_TASK_STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center px-2 h-6 rounded-md text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
};

const ActionButtons: React.FC<{
  task: ChannelAsyncTask;
  onDetail: (t: ChannelAsyncTask) => void;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
}> = ({ task, onDetail, onRetry, onCancel }) => {
  const showRetry = task.status === 'DEAD_LETTER' || task.status === 'FAILED';
  const showCancel = task.status === 'PENDING' || task.status === 'PENDING_SUBMIT' || task.status === 'PROCESSING';
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={() => onDetail(task)}
        className="h-7 px-2 rounded text-xs text-slate-600 hover:bg-slate-100"
        title="查看详情"
      >
        <Code2 size={14} />
      </button>
      {showRetry && (
        <button
          onClick={() => onRetry(task.id)}
          className="h-7 px-2 rounded text-xs text-primary hover:bg-primary/10 inline-flex items-center gap-1"
          title="重试"
        >
          <RotateCcw size={12} />重试
        </button>
      )}
      {showCancel && (
        <button
          onClick={() => onCancel(task.id)}
          className="h-7 px-2 rounded text-xs text-rose-600 hover:bg-rose-50 inline-flex items-center gap-1"
          title="取消"
        >
          <XCircle size={12} />取消
        </button>
      )}
    </div>
  );
};

const DetailDrawer: React.FC<{ task: ChannelAsyncTask; onClose: () => void }> = ({ task, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-end" onClick={onClose}>
      <div
        className="w-[640px] max-w-full h-full bg-white shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">异步任务详情 #{task.id}</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-slate-100 flex items-center justify-center">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4 text-sm">
          <DetailRow label="业务 ID" value={`task #${task.bizId}`} />
          <DetailRow label="通道" value={`${CHANNEL_TYPE_LABELS[task.channelType]} (ID: ${task.channelId})`} />
          <DetailRow label="能力" value={task.capability} mono />
          <DetailRow label="状态">
            <StatusChip status={task.status} />
          </DetailRow>
          <DetailRow label="远程 Task ID" value={task.remoteTaskId ?? '-'} mono />
          <DetailRow label="结果类型 / 数量" value={`${task.resultType ?? '-'} × ${task.resultCount}`} />
          <DetailRow label="提交节点" value={task.claimedBy ?? '-'} mono />
          <DetailRow label="提交时间" value={task.startedAt ? formatTime(task.startedAt) : '-'} />
          <DetailRow label="完成时间" value={task.finishedAt ? formatTime(task.finishedAt) : '-'} />
          <DetailRow label="耗时" value={task.durationMs != null ? `${task.durationMs}ms` : '-'} />
          <DetailRow label="重试次数" value={String(task.retryCount ?? 0)} />
          {task.nextRetryTime && (
            <DetailRow label="下次重试" value={formatTime(task.nextRetryTime)} />
          )}
          {task.failReason && (
            <DetailRow label="失败原因" value={task.failReason} />
          )}

          <JsonSection title="请求体" json={task.requestPayload} />
          <JsonSection title="响应体" json={task.responsePayload} />
        </div>
      </div>
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value?: string; children?: React.ReactNode; mono?: boolean }> = ({ label, value, children, mono }) => (
  <div className="grid grid-cols-[120px_1fr] gap-2 py-1.5 border-b border-slate-100 last:border-0">
    <span className="text-slate-500 text-xs">{label}</span>
    {children ?? (
      <span className={`text-slate-900 ${mono ? 'font-mono text-xs' : ''} break-all`}>{value}</span>
    )}
  </div>
);

const JsonSection: React.FC<{ title: string; json: string | null }> = ({ title, json }) => {
  const [expanded, setExpanded] = useState(false);
  if (!json) return null;
  let pretty = json;
  try {
    pretty = JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    // 已经是字符串 / 不是 JSON
  }
  return (
    <div className="border border-slate-200 rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-3 py-2 bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-700"
      >
        {title}
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {expanded && (
        <pre className="px-3 py-2 text-xs font-mono bg-slate-900 text-slate-100 overflow-x-auto max-h-64">
          {pretty}
        </pre>
      )}
    </div>
  );
};

function formatTime(iso: string): string {
  // 后端 LocalDateTime 序列化为 "2026-07-11T23:30:00" 形式
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}
