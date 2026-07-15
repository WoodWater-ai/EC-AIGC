/**
 * 模板推荐参数 hook
 *
 * [v2.0 2026-07-13 F1 基础设施]
 * - useTemplateRecommend:按 templateId + versionId + channelType + capability 拉推荐
 *   智能模版中心-新 / 新建任务-新 Step 0 预填都依赖此 hook
 * - useBlankCoverage:空白清单覆盖率(F3 推荐参数管理-新 用)
 */
import { useServiceQuery } from './useServiceQuery';
import {
  recommendParamsApi,
  type RecommendParamDTO,
  type BlankCoverageResponse,
} from '../modules/templateRecommend';

/**
 * 拉取某模板某能力下的推荐参数
 *
 * @param templateId    模板 ID(undefined = 不拉)
 * @param versionId     模板版本 ID(undefined = 不拉)
 * @param channelType   通道类型(必须,推荐参数绑定 channel)
 * @param capability    能力编码(必须,推荐参数绑定 capability)
 */
export function useTemplateRecommend(
  templateId: string | undefined,
  versionId: string | undefined,
  channelType: string | undefined,
  capability: string | undefined,
) {
  return useServiceQuery<RecommendParamDTO[]>(
    () => {
      if (!templateId || !versionId || !channelType || !capability) {
        return Promise.resolve([]);
      }
      return recommendParamsApi
        .listByCapability({
          channelType,
          capability,
          // 注:按 templateId+versionId 过滤,后端 listByCapability 需要扩展支持 templateId/versionId 入参
          // F4 PR 与前端 F1-F3 同步,后端在 listByCapability 增 templateId+templateVersionId 可选过滤
        })
        .then((r) => r.list.filter(
          (p) => p.templateId === templateId && p.templateVersionId === versionId
        ));
    },
    [templateId, versionId, channelType, capability],
  );
}

/**
 * 拉取空白覆盖率(推荐参数缺失的 channel×capability×model 组合)
 */
export function useBlankCoverage(channelTypes?: string[]) {
  return useServiceQuery<BlankCoverageResponse>(
    () => recommendParamsApi.blankCoverage({ channelTypes }),
    [channelTypes?.join(',') ?? ''],
  );
}
