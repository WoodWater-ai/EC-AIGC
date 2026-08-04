import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Route } from 'lucide-react';
import { toast } from 'sonner';
import { useServiceQuery } from '../../api/hooks/useServiceQuery';
import {
  capabilityDefaultRouteApi,
  type TaskCapabilityDefaultRoute,
} from '../../api/modules/capabilityDefaultRoute';
import {
  channelApi,
  fetchChannelGroupModels,
} from '../../api/modules/channel';
import type {
  CapabilityGroup,
  CapabilityMatrix,
  ModelChannelDTO,
} from '../../types';

interface CapabilityDefaultRoutePanelProps {
  matrix: CapabilityMatrix | null;
  canManage: boolean;
}

interface RouteDraft {
  channelId: string;
  modelCode: string;
}

const statusText = (route: TaskCapabilityDefaultRoute) => {
  if (!route.configured) return '未配置';
  if (!route.valid) return '已失效';
  return '有效';
};

export const CapabilityDefaultRoutePanel: React.FC<
  CapabilityDefaultRoutePanelProps
> = ({ matrix, canManage }) => {
  const routeQuery = useServiceQuery(
    capabilityDefaultRouteApi.list,
    [],
  );
  const routes = routeQuery.data ?? [];
  const [candidates, setCandidates] = useState<Record<string, ModelChannelDTO[]>>({});
  const [drafts, setDrafts] = useState<Record<string, RouteDraft>>({});
  const [modelOptions, setModelOptions] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (routes.length === 0) return;
    setDrafts(Object.fromEntries(routes.map((route) => [route.capabilityCode, {
      channelId: route.channelId ?? '',
      modelCode: route.modelCode ?? '',
    }])));
  }, [routes]);

  useEffect(() => {
    if (routes.length === 0) return;
    let cancelled = false;
    Promise.all(routes.map(async (route) => {
      const available = (await channelApi.listAvailable(route.capabilityCode))
        .filter((channel) => channel.channelType === 'VIDU');
      let options: string[] = [];
      if (route.channelId && route.channelType) {
        const defaults = await fetchChannelGroupModels(route.channelId);
        const defaultModel = defaults.find((item) => item.group === route.group)?.model;
        const catalog = matrix?.matrix[route.channelType as keyof CapabilityMatrix['matrix']]
          ?.modelOptions?.[route.group as CapabilityGroup] ?? [];
        options = [...new Set([
          defaultModel,
          route.modelCode,
          ...catalog,
        ].filter((value): value is string => Boolean(value?.trim())))] as string[];
      }
      return { capabilityCode: route.capabilityCode, available, options };
    })).then((items) => {
      if (cancelled) return;
      setCandidates(Object.fromEntries(items.map((item) => [item.capabilityCode, item.available])));
      setModelOptions(Object.fromEntries(items.map((item) => [item.capabilityCode, item.options])));
    }).catch(() => {
      if (!cancelled) toast.error('默认路由候选加载失败');
    });
    return () => { cancelled = true; };
  }, [matrix, routes]);

  const routeMap = useMemo(
    () => Object.fromEntries(routes.map((route) => [route.capabilityCode, route])),
    [routes],
  );

  const handleChannelChange = async (capabilityCode: string, channelId: string) => {
    const route = routeMap[capabilityCode];
    setDrafts((current) => ({
      ...current,
      [capabilityCode]: { channelId, modelCode: '' },
    }));
    if (!route?.modelRequired || !channelId) return;
    const channel = candidates[capabilityCode]?.find((item) => item.id === channelId);
    if (!channel) return;
    try {
      const defaults = await fetchChannelGroupModels(channelId);
      const defaultModel = defaults.find((item) => item.group === route.group)?.model ?? '';
      const catalog = matrix?.matrix[channel.channelType]
        ?.modelOptions?.[route.group as CapabilityGroup] ?? [];
      const options = [...new Set([defaultModel, ...catalog].filter(Boolean))];
      setModelOptions((current) => ({ ...current, [capabilityCode]: options }));
      setDrafts((current) => ({
        ...current,
        [capabilityCode]: { channelId, modelCode: defaultModel },
      }));
    } catch {
      toast.error('通道默认模型加载失败');
    }
  };

  const handleSave = async (route: TaskCapabilityDefaultRoute) => {
    const draft = drafts[route.capabilityCode];
    if (!draft?.channelId) {
      toast.error('请选择默认通道');
      return;
    }
    if (route.modelRequired && !draft.modelCode) {
      toast.error('请选择默认模型');
      return;
    }
    setSaving(route.capabilityCode);
    try {
      await capabilityDefaultRouteApi.update({
        capabilityCode: route.capabilityCode,
        channelId: draft.channelId,
        modelCode: route.modelRequired ? draft.modelCode : null,
      });
      toast.success(`${route.capabilityLabel}默认路由已保存`);
      routeQuery.refetch();
    } finally {
      setSaving(null);
    }
  };

  if (routeQuery.loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-500">
        正在加载能力默认路由…
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      <div className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/70 p-4">
        <Route className="mt-0.5 h-5 w-5 text-blue-600" />
        <div>
          <h4 className="text-sm font-bold text-slate-800">任务能力默认路由</h4>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            直接创建任务时自动选择这里配置的通道和模型；模板执行配置失效时也会回退到这里。
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] text-left text-xs">
          <thead className="border-b border-slate-100 bg-white text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">能力</th>
              <th className="px-4 py-3">默认通道</th>
              <th className="px-4 py-3">默认模型</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {routes.map((route) => {
              const draft = drafts[route.capabilityCode] ?? { channelId: '', modelCode: '' };
              return (
                <tr key={route.capabilityCode}>
                  <td className="px-4 py-4">
                    <p className="font-bold text-slate-800">{route.capabilityLabel}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                      {route.capabilityCode} · {route.group}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <select
                      value={draft.channelId}
                      disabled={!canManage}
                      onChange={(event) => handleChannelChange(
                        route.capabilityCode,
                        event.target.value,
                      )}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-blue-500 disabled:bg-slate-50"
                    >
                      <option value="">请选择通道</option>
                      {(candidates[route.capabilityCode] ?? []).map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          {channel.channelName} ({channel.channelType})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-4">
                    {route.modelRequired ? (
                      <select
                        value={draft.modelCode}
                        disabled={!canManage || !draft.channelId}
                        onChange={(event) => setDrafts((current) => ({
                          ...current,
                          [route.capabilityCode]: {
                            ...draft,
                            modelCode: event.target.value,
                          },
                        }))}
                        className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 font-mono text-xs text-slate-700 outline-none focus:border-blue-500 disabled:bg-slate-50"
                      >
                        <option value="">请选择模型</option>
                        {(modelOptions[route.capabilityCode] ?? []).map((model) => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="inline-flex h-9 items-center rounded-md bg-slate-100 px-3 text-xs font-bold text-slate-500">
                        供应商自动
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold ${
                      route.valid
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {route.valid
                        ? <CheckCircle2 className="h-3 w-3" />
                        : <AlertTriangle className="h-3 w-3" />}
                      {statusText(route)}
                    </span>
                    {!route.valid && route.invalidReason && (
                      <p className="mt-1 font-mono text-[9px] text-slate-400">
                        {route.invalidReason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {canManage && (
                      <button
                        type="button"
                        disabled={saving === route.capabilityCode}
                        onClick={() => handleSave(route)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-[11px] font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {saving === route.capabilityCode && <Loader2 className="h-3 w-3 animate-spin" />}
                        保存
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
