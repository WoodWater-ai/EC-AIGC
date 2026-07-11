/**
 * 字典数据查询 hook —— 基于 useServiceQuery,按 categoryCode 缓存.
 *
 * 模板中心 10 类字典共用一个 hook 入口,每个 category 各自 query 一次.
 * 缓存策略:依赖 categoryCode 字符串,React useEffect deps 触发.
 *
 * 用法:
 *   const { options: imageTaskTypes } = useDictOptions('IMAGE_TASK_TYPE');
 *   const { options: videoModes } = useDictOptions('VIDEO_MODE');
 */
import { useServiceQuery } from './useServiceQuery';
import { dictApi, toDictOptions, type DictItem, type DictOption } from '../modules/dict';

export interface UseDictResult {
  items: DictItem[];
  options: DictOption[];
  loading: boolean;
  error: unknown;
  refetch: () => void;
}

export function useDict(categoryCode: string | null | undefined): UseDictResult {
  const { data, loading, error, refetch } = useServiceQuery<DictItem[]>(
    () => (categoryCode ? dictApi.listItemsByCode(categoryCode) : Promise.resolve([])),
    [categoryCode],
  );
  return {
    items: data ?? [],
    options: toDictOptions(data),
    loading,
    error,
    refetch,
  };
}

/** 便捷 hook:只返回 DictOption[] */
export function useDictOptions(categoryCode: string | null | undefined): { options: DictOption[]; loading: boolean } {
  const { options, loading } = useDict(categoryCode);
  return { options, loading };
}
