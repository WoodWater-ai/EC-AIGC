// [新增 2026-07-12 P0/M2 前端] 能力矩阵 zustand store
import { create } from 'zustand';
import {
  fetchCapabilityMatrix,
  type MatrixResponse,
  type CapabilityDefinition,
} from '../api/modules/capability';

interface CapabilityMatrixStore {
  matrix: MatrixResponse | null;
  loaded: boolean;
  loadOnce: () => Promise<void>;
}

export const useCapabilityMatrixStore = create<CapabilityMatrixStore>((set, get) => ({
  matrix: null,
  loaded: false,
  loadOnce: async () => {
    if (get().loaded) return;
    try {
      const matrix = await fetchCapabilityMatrix();
      // 守卫:channels 缺失(拦截器误配/网络层异常)不标 loaded,允许重试
      if (!matrix || !Array.isArray(matrix.channels)) {
        console.error('[capabilityMatrix] invalid response, channels missing', matrix);
        return;
      }
      set({ matrix, loaded: true });
    } catch (e) {
      console.error('[capabilityMatrix] load failed', e);
    }
  },
}));

// 辅助 hook:从 matrix 拿单个能力的 schema
export function useCapabilityDef(
  channelType: string | undefined,
  capability: string | undefined
): CapabilityDefinition | null {
  return useCapabilityMatrixStore((s) => {
    if (!s.matrix || !channelType || !capability) return null;
    const ch = s.matrix.channels.find((c) => c.channelType === channelType);
    return ch?.capabilities.find((c) => c.code === capability) ?? null;
  });
}
