# 前端实施任务书：单页生成工作台与五阶段门禁 V2.3

状态：内部执行文档
日期：2026-07-17
产品基线：V2.3
文档职责：前端页面、组件、DTO、Adapter、Mock 和验收任务拆解
实施仓库：本仓库

开始开发前依次阅读：`../product/PRD-V2.3.md`、`../product/API-CONTRACT-V2.3.md`、本文。后端内部结构仅在联调或排查契约问题时参考 `../product/BACKEND-TECHNICAL-SPEC-V2.3.md`。

## 1. 结论与边界

当前前端只部分满足正式产品要求。可复用能力包括素材/COS 上传、商品与模特资源、模板版本、管理员模型通道配置、任务列表和审核 UI。以下关键链路尚未满足：

| 能力 | 当前实现 | 目标实现 |
| --- | --- | --- |
| 创建流程 | 图片/视频单页表单，直接提交 | 保留单页工作台，以就地确认、准备度核验和付费确认弹窗完成五阶段门禁 |
| 多图片类型 | 创建多条松散任务 | 一个任务组和多个独立子任务 |
| Prompt 确认 | 可编辑文本，无确认快照 | 每个子任务独立确认并展示快照版本 |
| 通道参数 | `mockModelChannels` 静态字段 | 根据后端 `parameter_schema.fields[]` 动态渲染 |
| 参考图 | 有角色但缺统一顺序契约 | `{asset_id, role, position}`，同一清单内顺序唯一，支持上移/下移 |
| Preflight | 静态成本和健康度展示 | 调用组级 Preflight，展示逐任务与组汇总 |
| 付费门禁 | 直接写入 `running` 并 `setTimeout` | 确认执行后单独 Submit，服务端返回 `queued` |
| 状态 | `pending/running/candidate/completed` | 使用正式任务状态并区分排队、重试等待、两段审核 |
| 结果 | 图片专用，缺来源与规格状态 | 统一图片/视频结果，展示 `generated/reused`、`spec_mismatch` |
| 视频 Prompt 初始化 | 页面已有内容编辑与 AI 助手，但没有正式 Profile 快照 | 阶段 3 使用默认通道 Prompt Profile 初始化并展示 Profile/版本 |
| 视频通道切换 | 切换主要更新静态参数，未形成编译批次 | 调用 `promptApi.compileForChannel`，展示差异、刷新 Schema，并处理兼容回退 |
| 视频镜头 | 页面可编辑镜头，但数量规则未形成契约 | 5s 默认 1 镜头、8s 默认 1-2 镜头、15/16s 默认 2-3 镜头，按内容复杂度调整 |
| Vidu 专有规则 | 可在页面 Prompt 中出现，但缺少来源边界 | 仅显示后端 Vidu Profile 编译结果，不写入通用模板或其他通道 Prompt |

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

export interface PromptProfile {
  profile_id: string;
  code: string;
  version: string;
}

export interface VideoShot {
  order: number;
  focus: string;
  action: string;
  camera: string;
  suggested_time_range?: string;
}

export interface VideoContentPlan {
  content_plan_snapshot_id: string;
  narrative: string;
  duration_seconds: number;
  shots: VideoShot[];
  reference_assets: OrderedReferenceAsset[];
}

export type PromptCompatibilityStatus =
  | 'unchanged'
  | 'syntax_only'
  | 'content_revision_required';

export interface PromptCompilationResult {
  compilation_batch_id: string;
  model_channel_id: string;
  model_id: string;
  capability_version: string;
  compatibility_status: PromptCompatibilityStatus;
  requires_content_reconfirmation: boolean;
  tasks: Array<{
    task_id: string;
    compiled_prompt_snapshot_id: string;
    prompt_profile: PromptProfile;
    compiled_prompt: string;
    diff: { summary: string; changed_sections: string[] };
    warnings: string[];
  }>;
}

export type ChannelSwitchState =
  | 'idle'
  | 'compiling'
  | 'compiled'
  | 'content_reconfirmation_required'
  | 'error';

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
| `src/api/modules/prompt.ts` | 暴露 `promptApi.compileForChannel`；real 实现调用正式通道编译接口，mock 实现返回相同 DTO |

Adapter 选择读取可选的 `VITE_GENERATION_API_MODE=mock|real`，缺省为 `mock`。不得在组件中判断模式。更新 `.env.example` 前按项目规则单独取得确认；代码不得依赖该文件存在。

`promptApi.compileForChannel` 的 mock 必须至少覆盖 `unchanged`、`syntax_only`、`content_revision_required`、Profile 缺失和 Profile 不兼容，不得只返回一条固定成功数据。相同 `idempotency_key` 和相同输入返回同一 `compilation_batch_id`。

### 2.3 五阶段业务状态

五阶段用于约束接口顺序、确认快照和失效规则，不要求映射为五个页面或顶部 Stepper。前端保留图片/视频三栏工作台：用户在原区域编辑素材、事实、Prompt 和模型参数；点击“检查并生成”时按阶段顺序核验，失败则定位原区域，成功才运行 Preflight 并打开最终付费确认弹窗。AI 助手是独立内容辅助入口，不参与 Preflight、费用确认或 Submit。

| 步骤 | 前端允许动作 | 完成条件 |
| --- | --- | --- |
| 1 来源素材与 Profile | 选商品/来源图、图片多选 Profile 或视频模式、保存草稿 | 已返回任务组和全部子任务 |
| 2 商品/来源事实确认 | 运行分析、编辑事实、处理视频素材冲突、确认 | 已返回有效上下文快照 |
| 3 Prompt 内容确认 | 展示各子任务方案、编辑 Prompt、调整有序参考图；视频使用默认通道 Prompt Profile 初始化并展示 Profile/版本；整组确认 | 全部子任务具有同批次 Prompt 快照，视频具有已确认内容方案快照 |
| 4 通道参数与 Preflight | 选通道/模型后调用通道编译、展示 Prompt 差异、刷新动态参数，再运行 Preflight | 编译兼容且组级 `valid=true`、未过期 |
| 5 付费执行确认 | 展示请求、成本、耗时、健康度和兜底策略，确认执行并 Submit | Submit 返回全部子任务 `queued` |

上游变化的失效规则：上下文变化清除内容方案、Prompt、编译批次、Preflight 和执行确认；Prompt、镜头或参考图变化清除编译批次、Preflight 和执行确认；通道变化先清除旧编译批次、参数、Preflight 和执行确认，再重新编译并刷新能力 Schema；参数或兜底策略变化清除 Preflight 和执行确认。`syntax_only` 保留阶段 3 内容确认，`content_revision_required` 使 Prompt 区重新进入待确认。失效后页面在原工作台定位最早需要补充或重新确认的区域，不切换到另一套向导。

## 3. 页面与组件改造

### 3.1 共享组件

新增以下无业务请求组件：

| 文件 | 行为 |
| --- | --- |
| `src/components/ExecutionConfirmDialog.tsx` | Preflight 通过后展示费用、耗时、健康度、请求摘要和兜底策略；最终确认后才允许 Submit |
| `src/components/DynamicParameterForm.tsx` | 按 `fields[]` 顺序渲染并执行必填、范围、枚举和 `visible_when` 校验 |
| `src/components/OrderedReferenceList.tsx` | 展示角色和顺序，使用上移/下移按钮重排并重新生成连续 position |
| `src/components/PreflightSummary.tsx` | 组总成本/耗时/健康度、逐子任务请求预览、警告和错误 |
| `src/components/TaskStatusBadge.tsx` | 唯一正式任务状态映射 |
| `src/components/ResultSourceBadge.tsx` | `generated/reused` 与 `spec_mismatch` 展示 |

### 3.2 图片创建页

`CreateImageTask.tsx` 保留现有三栏任务工作台，并接入五阶段业务状态：

- 素材区支持多选图片 Profile，但只调用一次 `createTaskGroup`。
- 内容区为每个子任务保留独立 Prompt 编辑区、就地确认和参考图顺序；AI 助手继续负责解析与改写。
- 设置区共享通道、模型、动态参数和兜底策略；通道选择不依赖 AI 助手。
- 顶部主操作改为“检查并生成”；缺失或失效时展示准备度问题并滚动定位第一个问题区域。
- Preflight 通过后打开付费确认弹窗，汇总逐子任务请求、成本、耗时、健康度和兜底策略。
- 删除直接创建 `running` 任务和所有模拟生成完成的 `setTimeout`。

### 3.3 视频创建页

当前路由实际使用 `CreateVideoTaskV2.tsx`，它是本轮主改造入口；`CreateVideoTask.tsx` 仅保留兼容用途，不承载两套并行状态机。视频页复用相同单页核验和付费确认组件：

- `img2video` 只允许一个 `first_frame`；`reference2video` 按能力限制多个有序参考图。
- 步骤 3 调用内容准备接口，使用默认通道的 Prompt Profile 初始化 Prompt，并展示 Profile 名称和版本。
- 镜头数组按目标时长和内容复杂度生成：5s 默认 1 镜头、8s 默认 1-2 镜头、15/16s 默认 2-3 镜头；UI 不预建固定三段。
- 步骤 4 每次切换通道或模型先进入 `compiling`，调用 `promptApi.compileForChannel`，成功后展示 Prompt diff 并刷新该通道 `parameter_schema.fields[]`。
- `unchanged` 和 `syntax_only` 保留阶段 3 确认；`content_revision_required` 显示具体不兼容项，禁用 Preflight，并引导返回阶段 3。
- Vidu 的图片强调、规划切镜、自动切镜、按秒描述、宫格叙事和音画同步只作为 Vidu Profile 编译结果展示，不在浏览器自行拼装。
- 模式变化时重新获取能力 Schema，清空不兼容参数并使执行确认失效。
- 来源冲突展示 `asset_conflict`，用户调整后重新分析，不允许进入 Prompt 确认。
- AI 助手只提供 Prompt、镜头和风险建议；“检查并生成”独立运行确定性校验和 Preflight。
- Submit 只发送任务组确认批次和幂等键，不在前端拼装 Provider 请求。

### 3.4 模板中心

`TemplateCenter.tsx` 继续保持现有五类模板，不新增 Prompt Profile Tab。视频 Prompt 模板只维护通道共性的内容结构；Profile 名称、版本和 Vidu 专有语法仅在任务阶段 3/4 作为只读编译信息出现。

### 3.5 列表与详情

- `TaskList.tsx` 使用正式状态 Tab，重点区分 `queued`、`retry_waiting`、`generating` 和两段审核状态。
- `TaskDetailsDrawer.tsx` 读取统一结果，图片和视频共用来源、规格、attempt、成本和审核摘要。
- `spec_mismatch` 显示阻断告警和差异明细，不允许自动归档。
- `reused` 持续显示来源资产，不展示 Provider 成功或新增生成成本。
- 排队或生成中的任务使用 3 秒轮询；离开页面、进入终态或组件卸载时停止轮询。

### 3.6 文件级改造清单

| 文件 | 改造内容 |
| --- | --- |
| `src/components/ExecutionConfirmDialog.tsx` | 图片/视频共用的最终付费确认弹窗，不包含 AI 助手能力 |
| `src/components/CreateImageTask.tsx` | 原页面就地确认、生成准备度核验、问题定位和最终付费确认 |
| `src/components/CreateVideoTaskV2.tsx` | 默认 Profile 初始化、动态镜头、通道切换编译状态、Prompt diff、兼容回退、动态参数刷新 |
| `src/components/CreateVideoTask.tsx` | 仅处理兼容入口；不得形成另一套 Prompt 编译和阶段状态 |
| `src/components/TemplateCenter.tsx` | 保持五类模板和通道共性内容，不新增 Profile Tab，不写入 Vidu 专有语法 |
| `src/types.ts` 或 `src/api/modules/generation.types.ts` | 增加内容方案、Prompt Profile、编译结果、兼容状态和通道切换状态 DTO |
| `src/mockData.ts` | 增加默认通道/Profile、动态镜头和三类兼容结果样例 |
| `src/api/modules/prompt.ts` | 实现 `promptApi.compileForChannel` 的 mock/real 统一入口和幂等参数 |
| `src/api/modules/channel.ts` | 返回默认通道、能力版本、Profile 映射和有序动态字段 |
| `src/components/__tests__/CreateVideoTaskV2.test.tsx` | 后续引入测试框架后覆盖通道切换和动态镜头；当前阶段按项目约定先列为验收用例，不强制新增测试依赖 |

## 4. 实施顺序

1. 先完成 DTO、API 模块和 mock/real adapter，确保两个实现返回相同对象。
2. 替换 `src/types.ts` 中旧任务状态和图片专用结果类型，并更新 mock 数据。
3. 实现准备度核验、最终付费确认组件及失效逻辑，不新增可见向导。
4. 改造图片创建页，再复用到视频创建页；视频页补默认 Profile 初始化、通道编译和兼容回退。
5. 增加 `promptApi.compileForChannel` mock，覆盖差异展示、动态参数刷新和动态镜头规则。
6. 改造任务列表和详情结果展示。
7. 接入真实 API 后删除组件内 `setTimeout` 和直接写状态逻辑，保留 mock adapter 用于后端未就绪时联调。

## 5. 验收与验证

必须手工验证：

- 多选三个图片 Profile 只创建一个任务组和三个子任务。
- 任一子任务 Preflight 失败时整组不能确认或 Submit。
- 修改 Prompt 后通道编译、Preflight 和执行确认失效；页面保留当前布局并把 Prompt 区标记为待确认。
- AI 助手和“检查并生成”是两个独立入口；助手不能运行 Preflight、确认费用或 Submit。
- 视频参考图上移/下移后提交预览与 position 顺序一致。
- Submit 后首先显示排队中，限流后显示重试等待，不复用旧图伪装成功。
- 结果卡能够区分 `generated`、`reused` 和 `spec_mismatch`。
- 阶段 3 使用默认通道 Profile 初始化视频 Prompt，并展示正确的 Profile 名称和版本。
- 阶段 4 切换通道时显示加载态；编译完成后展示 Prompt 差异并按新 Schema 刷新参数。
- `syntax_only` 不清除内容确认；`content_revision_required` 禁用 Preflight 并返回阶段 3。
- 5s、8s、15/16s 分别生成 1、1-2、2-3 个默认镜头，不出现固定三段占位。
- Vidu 专有提示词规则不会出现在其他通道编译结果或模板中心通用视频模板中。
- Profile 缺失、Profile 不兼容和编译失败均显示可恢复错误，不沿用上一通道 Prompt。

实施完成后运行：

```bash
npm run lint
npm run build
```

不得通过前端本地状态模拟付费生成成功，不得把密钥、Provider Base URL 或完整原始响应写入页面状态或日志。
