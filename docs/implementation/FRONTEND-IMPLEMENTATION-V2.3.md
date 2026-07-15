# 前端实施任务书：五步生成工作流 V2.3

状态：内部执行文档
日期：2026-07-15
产品基线：V2.3
文档职责：前端页面、组件、DTO、Adapter、Mock 和验收任务拆解
实施仓库：本仓库

开始开发前依次阅读：`../product/PRD-V2.3.md`、`../product/API-CONTRACT-V2.3.md`、本文。后端内部结构仅在联调或排查契约问题时参考 `../product/BACKEND-TECHNICAL-SPEC-V2.3.md`。

## 1. 结论与边界

当前前端只部分满足正式产品要求。可复用能力包括素材/COS 上传、商品与模特资源、模板版本、管理员模型通道配置、任务列表和审核 UI。以下关键链路尚未满足：

| 能力 | 当前实现 | 目标实现 |
| --- | --- | --- |
| 创建流程 | 图片/视频单页表单，直接提交 | 统一五步向导，阶段不可跳过 |
| 多图片类型 | 创建多条松散任务 | 一个任务组和多个独立子任务 |
| Prompt 确认 | 可编辑文本，无确认快照 | 每个子任务独立确认并展示快照版本 |
| 通道参数 | `mockModelChannels` 静态字段 | 根据后端 `parameter_schema.fields[]` 动态渲染 |
| 参考图 | 有角色但缺统一顺序契约 | `{asset_id, role, position}`，同一清单内顺序唯一，支持上移/下移 |
| Preflight | 静态成本和健康度展示 | 调用组级 Preflight，展示逐任务与组汇总 |
| 付费门禁 | 直接写入 `running` 并 `setTimeout` | 确认执行后单独 Submit，服务端返回 `queued` |
| 状态 | `pending/running/candidate/completed` | 使用正式任务状态并区分排队、重试等待、两段审核 |
| 结果 | 图片专用，缺来源与规格状态 | 统一图片/视频结果，展示 `generated/reused`、`spec_mismatch` |

本阶段不引入 React Router、状态管理库、TanStack Query、表单库或拖拽库。继续使用 React `useState`、现有 Axios Client、现有导航方式和现有图标库。

## 2. 前端契约

### 2.1 核心类型

在 `src/api/modules/generation.types.ts` 定义并只从正式 API DTO 映射，不使用 `any`：

```ts
export type MediaType = 'image' | 'video';
export type TaskProfile =
  | 'main_image'
  | 'scene_image'
  | 'detail_image'
  | 'tryon_three_view'
  | 'img2video'
  | 'reference2video';

export type GenerationTaskStatus =
  | 'draft'
  | 'assets_ready'
  | 'asset_conflict'
  | 'pending_product_confirmation'
  | 'pending_prompt_confirmation'
  | 'pending_execution_confirmation'
  | 'queued'
  | 'retry_waiting'
  | 'generating'
  | 'generation_failed'
  | 'pending_aesthetic_review'
  | 'pending_listing_review'
  | 'returned'
  | 'archived'
  | 'cancelled';

export interface OrderedReferenceAsset {
  asset_id: string;
  role: string;
  position: number;
}

export type ResultSourceType = 'generated' | 'reused';
export type ResultValidationStatus =
  | 'pending'
  | 'valid'
  | 'spec_mismatch'
  | 'validation_failed';
```

动态字段类型固定为 `string | enum | integer | number | boolean`，DTO 包含 `key/label/type/required/default/options/min/max/step/unit/visible_when`。未知字段类型视为契约错误，显示阻断提示，不静默忽略。

### 2.2 API 模块与 Adapter

新增或修改：

| 文件 | 职责 |
| --- | --- |
| `src/api/modules/generation.types.ts` | 任务组、子任务、能力 Schema、Preflight、执行快照和统一结果 DTO |
| `src/api/modules/generation.ts` | `/v1/generation-task-groups`、任务、结果和业务通道 API |
| `src/api/modules/generation.mock.ts` | 与真实 DTO 完全相同的 mock 实现，模拟状态和失效规则 |
| `src/api/modules/generation.adapter.ts` | 暴露统一 `GenerationService`，在 mock/real 间选择 |
| `src/api/modules/task.ts` | 删除占位导出，改为兼容入口并转发 `GenerationService` |
| `src/api/modules/channel.ts` | 保留管理员接口，新增普通业务侧通道和能力读取函数 |

Adapter 选择读取可选的 `VITE_GENERATION_API_MODE=mock|real`，缺省为 `mock`。不得在组件中判断模式。更新 `.env.example` 前按项目规则单独取得确认；代码不得依赖该文件存在。

### 2.3 五步交互状态

| 步骤 | 前端允许动作 | 完成条件 |
| --- | --- | --- |
| 1 来源素材与 Profile | 选商品/来源图、图片多选 Profile 或视频模式、保存草稿 | 已返回任务组和全部子任务 |
| 2 商品/来源事实确认 | 运行分析、编辑事实、处理视频素材冲突、确认 | 已返回有效上下文快照 |
| 3 Prompt 内容确认 | 展示各子任务方案、编辑 Prompt、调整有序参考图、整组确认 | 全部子任务具有同批次 Prompt 快照 |
| 4 通道参数与 Preflight | 选通道/模型、渲染动态参数、运行 Preflight | 组级 `valid=true` 且未过期 |
| 5 付费执行确认 | 展示请求、成本、耗时、健康度和兜底策略，确认执行并 Submit | Submit 返回全部子任务 `queued` |

上游变化的失效规则：上下文变化清除 Prompt、Preflight 和执行确认；Prompt 或参考图变化清除 Preflight 和执行确认；通道、参数或兜底策略变化清除 Preflight 和执行确认。失效后页面自动回到最早需要重新确认的步骤。

## 3. 页面与组件改造

### 3.1 共享组件

新增以下无业务请求组件：

| 文件 | 行为 |
| --- | --- |
| `src/components/TaskCreationStepper.tsx` | 固定五步、当前/完成/失效状态，不允许点击跳过未完成步骤 |
| `src/components/DynamicParameterForm.tsx` | 按 `fields[]` 顺序渲染并执行必填、范围、枚举和 `visible_when` 校验 |
| `src/components/OrderedReferenceList.tsx` | 展示角色和顺序，使用上移/下移按钮重排并重新生成连续 position |
| `src/components/PreflightSummary.tsx` | 组总成本/耗时/健康度、逐子任务请求预览、警告和错误 |
| `src/components/TaskStatusBadge.tsx` | 唯一正式任务状态映射 |
| `src/components/ResultSourceBadge.tsx` | `generated/reused` 与 `spec_mismatch` 展示 |

### 3.2 图片创建页

`CreateImageTask.tsx` 改为任务组五步容器：

- 步骤 1 支持多选图片 Profile，但只调用一次 `createTaskGroup`。
- 步骤 3 为每个子任务保留独立 Prompt 编辑区和参考图顺序。
- 步骤 4 共享通道、模型、动态参数和兜底策略；Preflight 结果按子任务展示。
- 任一子任务校验失败时禁用“确认执行”，并滚动定位第一个错误子任务。
- 删除直接创建 `running` 任务和所有模拟生成完成的 `setTimeout`。

### 3.3 视频创建页

`CreateVideoTask.tsx` 复用相同五步和共享组件：

- `img2video` 只允许一个 `first_frame`；`reference2video` 按能力限制多个有序参考图。
- 模式变化时重新获取能力 Schema，清空不兼容参数并使执行确认失效。
- 来源冲突展示 `asset_conflict`，用户调整后重新分析，不允许进入 Prompt 确认。
- Submit 只发送任务组确认批次和幂等键，不在前端拼装 Provider 请求。

### 3.4 列表与详情

- `TaskList.tsx` 使用正式状态 Tab，重点区分 `queued`、`retry_waiting`、`generating` 和两段审核状态。
- `TaskDetailsDrawer.tsx` 读取统一结果，图片和视频共用来源、规格、attempt、成本和审核摘要。
- `spec_mismatch` 显示阻断告警和差异明细，不允许自动归档。
- `reused` 持续显示来源资产，不展示 Provider 成功或新增生成成本。
- 排队或生成中的任务使用 3 秒轮询；离开页面、进入终态或组件卸载时停止轮询。

## 4. 实施顺序

1. 先完成 DTO、API 模块和 mock/real adapter，确保两个实现返回相同对象。
2. 替换 `src/types.ts` 中旧任务状态和图片专用结果类型，并更新 mock 数据。
3. 实现五步共享组件及失效逻辑。
4. 改造图片创建页，再复用到视频创建页。
5. 改造任务列表和详情结果展示。
6. 接入真实 API 后删除组件内 `setTimeout` 和直接写状态逻辑，保留 mock adapter 用于后端未就绪时联调。

## 5. 验收与验证

必须手工验证：

- 多选三个图片 Profile 只创建一个任务组和三个子任务。
- 任一子任务 Preflight 失败时整组不能确认或 Submit。
- 修改 Prompt 后步骤 4、5 失效并要求重新 Preflight。
- 视频参考图上移/下移后提交预览与 position 顺序一致。
- Submit 后首先显示排队中，限流后显示重试等待，不复用旧图伪装成功。
- 结果卡能够区分 `generated`、`reused` 和 `spec_mismatch`。

实施完成后运行：

```bash
npm run lint
npm run build
```

不得通过前端本地状态模拟付费生成成功，不得把密钥、Provider Base URL 或完整原始响应写入页面状态或日志。

