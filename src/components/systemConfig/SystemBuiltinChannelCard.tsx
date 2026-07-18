import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import type { ModelChannelDTO } from '../../types';

interface Props {
  label: string;
  current: ModelChannelDTO | null;
  options: ModelChannelDTO[];
  onSave: (channelId: string | null) => Promise<void>;
}

/**
 * 单个内置通道配置卡片。
 * - 下拉显示 options(后端按能力过滤)+ 一个 "清空" 选项。
 * - 变更未保存时启用保存按钮;点击保存后调 onSave。
 */
export function SystemBuiltinChannelCard({ label, current, options, onSave }: Props) {
  const [draftId, setDraftId] = useState<string | null>(current?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 当 current 从父级刷新(保存成功后)时,同步 draftId
  useEffect(() => {
    setDraftId(current?.id ?? null);
  }, [current?.id]);

  const dirty = (draftId ?? null) !== (current?.id ?? null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(draftId);
    } catch (e: any) {
      setError(e?.message ?? '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">{label}</h3>
        {current ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
            已配置
          </span>
        ) : (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
            暂未配置
          </span>
        )}
      </div>

      {current && (
        <div className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
          当前通道:<span className="font-medium">{current.channelName}</span>
          <span className="ml-2 text-slate-500">
            ({current.channelType} · {current.status})
          </span>
        </div>
      )}

      <div className="mb-3">
        <label className="mb-1 block text-xs text-slate-600">切换为</label>
        <select
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          value={draftId ?? ''}
          onChange={(e) => setDraftId(e.target.value || null)}
          disabled={saving}
        >
          <option value="">— 清空(不使用内置通道)—</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.channelName} ({c.channelType})
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={!dirty || saving}
        className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <Save className="h-4 w-4" />
        {saving ? '保存中…' : '保存'}
      </button>
    </div>
  );
}
