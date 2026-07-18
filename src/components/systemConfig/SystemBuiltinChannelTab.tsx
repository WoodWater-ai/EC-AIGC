import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { builtinChannelApi } from '../../api/modules/builtinChannel';
import type { BuiltinKey, ModelChannelDTO } from '../../types';
import { SystemBuiltinChannelCard } from './SystemBuiltinChannelCard';

const BUILTIN_KEYS: { key: BuiltinKey; label: string }[] = [
  { key: 'BUILTIN_CHAT', label: '文本对话' },
  { key: 'BUILTIN_IMAGE_UNDERSTAND', label: '图片理解' },
];

/** 「系统内置通道配置」主 tab */
export function SystemBuiltinChannelTab() {
  const [all, setAll] = useState<Record<BuiltinKey, ModelChannelDTO | null> | null>(null);
  const [optionsMap, setOptionsMap] = useState<Record<BuiltinKey, ModelChannelDTO[]>>({
    BUILTIN_CHAT: [],
    BUILTIN_IMAGE_UNDERSTAND: [],
  });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [allRes, chatOpts, imgOpts] = await Promise.all([
        builtinChannelApi.getAll(),
        builtinChannelApi.listAvailableChannels('BUILTIN_CHAT'),
        builtinChannelApi.listAvailableChannels('BUILTIN_IMAGE_UNDERSTAND'),
      ]);
      setAll(allRes);
      setOptionsMap({ BUILTIN_CHAT: chatOpts, BUILTIN_IMAGE_UNDERSTAND: imgOpts });
    } catch (e: any) {
      toast.error(e?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSave = useCallback(
    async (key: BuiltinKey, channelId: string | null) => {
      await builtinChannelApi.update([{ builtinKey: key, channelId }]);
      toast.success('已保存');
      // 局部更新 all
      if (all) {
        const next: Record<BuiltinKey, ModelChannelDTO | null> = { ...all };
        if (channelId == null) {
          next[key] = null;
        } else {
          const matched = optionsMap[key].find((c) => c.id === channelId);
          if (matched) next[key] = matched;
        }
        setAll(next);
      }
    },
    [all, optionsMap],
  );

  if (loading || !all) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        加载中…
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {BUILTIN_KEYS.map(({ key, label }) => (
        <SystemBuiltinChannelCard
          key={key}
          label={label}
          current={all[key]}
          options={optionsMap[key]}
          onSave={(channelId) => handleSave(key, channelId)}
        />
      ))}
    </div>
  );
}
