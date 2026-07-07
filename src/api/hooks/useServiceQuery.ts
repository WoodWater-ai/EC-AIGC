import { useEffect, useRef, useState, type DependencyList } from 'react';
import { ApiError } from '../error';

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

/**
 * 过渡用 query hook —— API 形状刻意对齐 TanStack Query 的 useQuery
 *
 * 当前限制（CLAUDE.md TODO 列 TanStack Query 引入时升级）：
 * - 无缓存
 * - 无 refetch
 * - 无 retry
 * - 无 staleTime
 *
 * 未来引入 TanStack Query 时：
 * - 业务组件代码不动（QueryState 形状不变）
 * - 只换 hook 实现
 */
export function useServiceQuery<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList = []
): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    setState({ data: null, loading: true, error: null });

    fetcher()
      .then((data) => {
        if (aliveRef.current) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((error: ApiError) => {
        if (aliveRef.current) {
          setState({ data: null, loading: false, error });
        }
      });

    return () => {
      aliveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
