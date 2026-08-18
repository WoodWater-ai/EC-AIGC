import type { TaskReuseAssetResponse, TaskReuseContextResponse } from '../../api/modules/task';
import type { TaskGroupResponse } from '../../types';

/**
 * 任务列表进入制作页时使用的一次性上下文。
 * 后端直接返回原任务关系表中的 assetId、角色与顺序，前端不再通过 URL 回查素材库。
 */
export interface TaskReusePrefill {
  group: Pick<TaskGroupResponse, 'groupId' | 'productId' | 'productName'>;
  task: TaskReuseContextResponse;
  imageAssets: TaskReuseAssetResponse[];
  videoAssets: TaskReuseAssetResponse[];
}
