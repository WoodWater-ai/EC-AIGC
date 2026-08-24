import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  garmentBudgetApi,
  type GarmentChannelBudget,
  type GarmentChannelBudgetHistory,
  type GarmentBudgetStatus,
} from '../../api/modules/garmentBudget';

const moneyPattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/;
const thresholdPattern = /^(?:100(?:\.0{1,2})?|(?:0|[1-9]\d?)(?:\.\d{1,2})?)$/;

export function GarmentBudgetPanel() {
  const [budgets, setBudgets] = useState<GarmentChannelBudget[]>([]);
  const [history, setHistory] = useState<GarmentChannelBudgetHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<GarmentChannelBudget>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [budgetRows, historyPage] = await Promise.all([
        garmentBudgetApi.list(),
        garmentBudgetApi.history(),
      ]);
      setBudgets(budgetRows);
      setHistory(historyPage.list);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '服装 AI 预算加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <div className="flex min-h-72 items-center justify-center text-sm text-stone-400">正在加载服装 AI 总额预算…</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
        首期只允许专用通道使用 <b>TOTAL 总额预算</b>。日/月周期预算没有期间实例与跨期预留归属，当前会被商业执行门禁阻断。降低额度不能低于“已用 + 已预留”。
      </section>

      <section>
        <div className="mb-4"><h2 className="text-base font-bold text-stone-900">模型通道总额预算</h2><p className="mt-1 text-xs text-stone-500">预算配置属于管理员/财务操作，不向设计师开放</p></div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {budgets.map((budget) => {
            return (
              <article key={budget.channelId} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-stone-900">{budget.channelName ?? '已删除或不可见通道'}</h3><p className="mt-1 font-mono text-[10px] text-stone-400">{budget.channelType ?? 'UNKNOWN'} · {budget.channelId}</p><p className={`mt-1 text-[10px] font-bold ${budget.channelStatus === 'NORMAL' ? 'text-emerald-600' : 'text-amber-600'}`}>通道 {budget.channelStatus ?? '不可用'}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${budget.status === 'NORMAL' ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>{budget.configured ? budget.status : '未配置'}</span></div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><Metric label="预算上限" value={budget.configured ? `¥${budget.amountLimit}` : '—'} /><Metric label="可用" value={budget.configured ? `¥${budget.availableAmount}` : '—'} /><Metric label="已结算" value={budget.configured ? `¥${budget.usedAmount}` : '—'} /><Metric label="已预留" value={budget.configured ? `¥${budget.reservedAmount}` : '—'} /></div>
                <div className="mt-4 flex items-center justify-between text-[10px] text-stone-400"><span>告警阈值 {budget.alertThreshold ?? '—'}%</span><span>{budget.updateTime ? budget.updateTime.replace('T', ' ') : '尚未配置'}</span></div>
                <button type="button" disabled={!budget.channelName} onClick={() => setEditing(budget)} className="mt-4 w-full rounded-lg border border-stone-200 px-3 py-2 text-xs font-bold text-stone-700 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40">{budget.configured ? '调整预算' : '配置 TOTAL 预算'}</button>
              </article>
            );
          })}
        </div>
        {budgets.length === 0 && <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center text-xs text-stone-500">当前没有可配置的模型通道，请先由通道管理员完成通道创建与安全配置。</div>}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-100 px-5 py-4"><h2 className="text-sm font-bold text-stone-900">最近预算变更审计</h2><p className="mt-1 text-xs text-stone-500">保存操作人、前后额度/状态与必填原因</p></div>
        {history.length === 0 ? <div className="p-8 text-center text-xs text-stone-400">暂无变更记录</div> : <div className="divide-y divide-stone-100">{history.map((row) => <div key={row.id} className="grid gap-2 px-5 py-4 text-xs md:grid-cols-[1.2fr_1fr_2fr]"><div><b>{row.action === 'CREATE' ? '创建' : '调整'} · 通道 {row.channelId}</b><p className="mt-1 text-stone-400">{row.createTime?.replace('T', ' ') ?? '—'} · 操作人 {row.operatorId ?? '—'}</p></div><div className="text-stone-600">¥{row.beforeAmountLimit ?? '—'} → ¥{row.afterAmountLimit}<br />{row.beforeStatus ?? '—'} → {row.afterStatus}</div><div className="text-stone-600">{row.reason}</div></div>)}</div>}
      </section>

      {editing && <BudgetEditor channel={editing} onClose={() => setEditing(undefined)} onCompleted={() => { setEditing(undefined); void load(); }} />}
    </div>
  );
}

function BudgetEditor({ channel, onClose, onCompleted }: { channel: GarmentChannelBudget; onClose: () => void; onCompleted: () => void }) {
  const [amountLimit, setAmountLimit] = useState(channel.amountLimit ?? '100.000000');
  const [alertThreshold, setAlertThreshold] = useState(channel.alertThreshold ?? '80.00');
  const [status, setStatus] = useState<GarmentBudgetStatus>(channel.status ?? 'NORMAL');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const valid = moneyPattern.test(amountLimit) && /[1-9]/.test(amountLimit)
    && thresholdPattern.test(alertThreshold) && reason.trim().length >= 5;

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    try {
      await garmentBudgetApi.upsert({ channelId: channel.channelId, amountLimit, alertThreshold, status, reason: reason.trim() });
      toast.success(channel.configured ? '预算调整已保存并写入审计' : 'TOTAL 预算已创建并写入审计');
      onCompleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '预算保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-2xl bg-[#faf9f6] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-primary">TOTAL budget</p><h2 className="mt-1 text-lg font-bold">{channel.channelName}</h2><p className="mt-1 font-mono text-[10px] text-stone-400">{channel.channelType} · {channel.channelId}</p></div><button type="button" onClick={onClose} className="rounded p-2 text-stone-400"><span className="material-symbols-outlined">close</span></button></div><div className="mt-5 space-y-4"><Field label="总额上限（CNY，最多 6 位小数）"><input value={amountLimit} onChange={(event) => setAmountLimit(event.target.value)} inputMode="decimal" className="form-input font-mono" /></Field><Field label="提醒阈值（0—100%）"><input value={alertThreshold} onChange={(event) => setAlertThreshold(event.target.value)} inputMode="decimal" className="form-input font-mono" /></Field><Field label="状态"><select value={status} onChange={(event) => setStatus(event.target.value as GarmentBudgetStatus)} className="form-input"><option value="NORMAL">启用</option><option value="DISABLED">停用（阻断新执行）</option></select></Field><Field label="变更原因（至少 5 个字符）"><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} className="form-input resize-none" /></Field></div><div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">停用预算会阻断尚未调用供应商的任务；已发生供应商调用的成本仍会结算或进入人工对账，不会因停用而丢失。</div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-bold">取消</button><button type="button" disabled={!valid || submitting} onClick={() => void submit()} className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-white disabled:opacity-40">{submitting ? '保存中…' : '保存并记录审计'}</button></div></div></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-stone-50 p-2.5"><div className="text-[9px] uppercase tracking-wider text-stone-400">{label}</div><div className="mt-1 font-mono font-bold text-stone-700">{value}</div></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-stone-600">{label}</span>{children}</label>;
}
