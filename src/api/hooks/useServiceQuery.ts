import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { ApiError } from '../error';

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  /** 手动触发重新拉取(用于保存/删除后的 invalidate 模式) */
  refetch: () => void;
}

/**
 * 过渡用 query hook —— API 形状刻意对齐 TanStack Query 的 useQuery
 *
 * 当前限制（CLAUDE.md TODO 列 TanStack Query 引入时升级）：
 * - 无缓存
 * - 无 retry
 * - 无 staleTime
 *
 * 已有能力:
 * - refetch —— 业务组件在 save/delete 后手动 invalidate
 *
 * 未来引入 TanStack Query 时：
 * - 业务组件代码不动（QueryState 形状不变）
 * - 只换 hook 实现
 */
export function useServiceQuery<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList = [],
  enabled = true,
): QueryState<T> {
  const [state, setState] = useState<Omit<QueryState<T>, 'refetch'>>({
    data: null,
    loading: true,
    error: null,
  });
  // trigger counter 累加,每次 refetch 触发 useEffect 重跑 fetcher
  const [trigger, setTrigger] = useState(0);
  const previousDepsRef = useRef<DependencyList>(deps);

  useEffect(() => {
    let cancelled = false;
    const previousDeps = previousDepsRef.current;
    const depsChanged = previousDeps.length !== deps.length
      || deps.some((value, index) => !Object.is(value, previousDeps[index]));
    previousDepsRef.current = deps;
    setState((current) => ({
      data: depsChanged ? null : current.data,
      loading: enabled,
      error: null,
    }));

    if (!enabled) {
      return () => {
        cancelled = true;
      };
    }

    fetcher()
      .then((data) => {
        if (!cancelled) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((error: ApiError) => {
        if (!cancelled) {
          setState({ data: null, loading: false, error });
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, trigger]);

  const refetch = useCallback(() => {
    setTrigger((t) => t + 1);
  }, []);

  return { ...state, refetch };
}
