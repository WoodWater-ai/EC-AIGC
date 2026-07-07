/**
 * 任务相关 API —— 当前为空占位
 *
 * 接入第一个真实接口的步骤（详见 docs/api-integration-guide.md §1）：
 * 1. 在 knife4j 找到对应 endpoint（如 GET /v1/admin/tasks）
 * 2. 跑 npm run gen:api 同步 types.generated.ts
 * 3. 在本文件写 export const listTasks = (params: ...) => http.get<TaskDTO[]>('/v1/admin/tasks', { params })
 * 4. 业务组件用 const { data, loading, error } = useServiceQuery(() => listTasks(), [])
 */

import http from '../client';

export const _placeholder = true; // 占位文件，删除前确保至少有一个 export
