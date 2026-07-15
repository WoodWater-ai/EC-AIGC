# 前端 Mock 改动交接 - 视频工作台与模板中心

日期：2026-07-15  
适用产品基线：V2.3  
当前阶段：前端 Mock 已完成，等待按正式契约联调

## 1. 先读哪些文档

全栈联调以以下资料为准，禁止依据当前页面中的 mock 对象反推接口。

| 优先级 | 文档 | 用途 |
| --- | --- | --- |
| 1 | `docs/product/API-CONTRACT-V2.3.md` | 正式接口路径、请求和响应 DTO、状态流，发生冲突时以此为准。 |
| 2 | `docs/product/PRD-V2.3.md` | 业务范围、页面行为、验收标准和状态语义。 |
| 3 | `docs/implementation/FRONTEND-IMPLEMENTATION-V2.3.md` | 前端组件、Adapter、Mock/Real 切换和实施顺序。 |
| 4 | `docs/product/BACKEND-TECHNICAL-SPEC-V2.3.md` | 后端实现参考；不得覆盖正式 API 契约。 |

API 契约中的相关章节：任务组创建见第 5 节，结果和审核见第 6 节，模板见第 7 节，模型通道见第 8 节，爆款复刻 Demo 接口见第 12 节。

## 2. 本次前端已实现的 Mock 交互

### 模板中心

- 模板中心在 mock 模式下不再请求后端，覆盖五类模板：图片任务、风格场景、视频 Prompt、平台规格、负面约束。
- Tab 数量随当前 mock 数据变化，不再固定显示 `0`。
- 新增、编辑、批量停用在浏览器本地状态完成，仅用于演示。
- 平台规格字段已拆开：`platformUsage` 是适用用途，`platformFormat` 是文件格式；二者不能再复用或相互覆盖。

### 视频任务工作台

- 新建视频任务默认是空白上下文；只有从审核通过的图片结果点击“创建视频”时，才预填该图片、商品、风格、模特和 Prompt 上下文。
- 页面是三栏布局：输入素材、任务配置与 Prompt/分镜、模型能力与模特。
- 支持三个同级模式：`img2video`、`reference2video`、`trending_replicate`。
- `reference2video` 支持首帧和多张参考图，参考图具备角色、缩略图和移除操作，并受到模型参考图数量上限约束。
- `trending_replicate` 支持输入本地视频或链接，选择替换商品、模特和场景素材，演示结构拆解、关键帧、爆点、替换策略和风险提示。
- 视频页仅展示业务可理解的模型信息：通道、模型、比例、时长、分辨率、运动幅度、参考图上限、成本、健康状态和额度。技术参数由模型配置保留，不进入页面。
- 模型切换导致比例、时长、分辨率或参考图数量不兼容时，页面提示冲突和替代值，用户确认后才变更。
- AI 助手在右侧抽屉中给出建议，只有用户确认后才更新本次 Prompt。

### 前端导航上下文

`VideoTaskEntryContext` 仅用于前端页面跳转：

```ts
type VideoTaskEntryContext =
  | { kind: 'blank' }
  | { kind: 'approved-image'; sourceTask: GenerationTask; sourceResult: GeneratedImageResult };
```

它不是后端 DTO。后端需要按任务组、来源素材和结果 ID 的正式字段承接上下文。

## 3. 全栈接入时必须对齐的能力

### 3.1 统一五步任务组流程

图片和视频都必须走 `GenerationTaskGroup`，不能直接把页面表单转换为 Provider 请求：

1. `POST /generation-task-groups` 创建草稿组和子任务。
2. `POST /generation-task-groups/{group_id}/analyze-context` 分析商品或视频来源事实、冲突和风险。
3. `POST /generation-task-groups/{group_id}/confirm-context` 由用户确认事实并生成上下文快照。
4. `POST /generation-task-groups/{group_id}/prepare-content` 生成每个子任务的内容方案、Prompt 草稿、负面约束和有序参考图。
5. 通过 Prompt 确认、通道能力/Preflight 和执行确认后，再提交到异步队列。

图片多选 Profile 时，前端提交一个任务组和多个子任务；视频通常是一个子任务。子任务状态是执行事实来源，任务组只返回派生的汇总状态。

### 3.2 视频来源素材和角色

后端对视频来源的统一字段是：

```json
{"asset_id": "asset_x", "role": "first_frame", "position": 1}
```

需要支持：

- `img2video`：一个首帧。
- `reference2video`：首帧与多张有序参考图；角色应可表达风格、动作/镜头、场景等用途。
- `trending_replicate`：原视频或 URL，及商品、模特、场景等替换素材。
- 返回素材分析、角色/来源冲突、模型上限和处理建议；存在冲突时状态保持 `asset_conflict`，不得进入 Prompt 确认或执行。

### 3.3 模型通道和业务能力

前端需要从 `GET /model-channels` 以及 `GET /model-channels/{channel_id}/capabilities` 获取当前模型的能力，而不是硬编码模型和规格。

接口至少需要支持：

- 接入类型：云端 API、本地模型、中转站、停用。
- 通道、模型版本、适用媒体类型和健康度/额度/成本规则。
- 业务规格：比例、分辨率、时长、运动幅度、最大参考图数量、生成张数等可选项、默认值与边界。
- 技术参数：可由 `parameter_schema` 返回并保存到执行快照，但任务页面默认不展示。
- 当前选择不兼容时，返回明确的冲突原因与可选替代项；前端必须经用户确认才能应用替代值。

### 3.4 结果、审核与创建视频

- 图片结果需要携带结果 ID、来源、规格校验、成本、attempt 和审核摘要。
- 只有满足上架审核通过条件的图片结果，才允许创建视频。
- “创建视频”应使用通过的结果 ID 和任务上下文进行后端承接，不以图片 URL 或前端导航对象作为唯一来源。
- 结果局部修改仅支持图片；`POST /generation-results/{result_id}/revise-region` 需要保留修改说明、区域与父结果关系，产生新的派生版本而非覆盖原图。

### 3.5 模板接口

- 模板列表支持模板类型、任务 Profile、风格、场景和启用状态筛选。
- 编辑全局模板必须产生新版本；任务使用时保存对应版本快照。
- 平台规格返回 `platformUsage` 和 `platformFormat` 两个独立字段；规格是推荐预设，仍要经过当前模型能力校验。

## 4. 状态机差异

当前前端演示数据仍含 `candidate` 等历史 mock 状态，用于展示效果，不能作为正式状态枚举。正式接入必须统一使用：

```text
draft
assets_ready
asset_conflict
pending_product_confirmation
pending_prompt_confirmation
pending_execution_confirmation
queued
retry_waiting
generating
generation_failed
pending_aesthetic_review
pending_listing_review
returned
archived
cancelled
```

其中 `asset_conflict` 阻断后续内容确认，`pending_aesthetic_review` 和 `pending_listing_review` 需分别反映在任务列表、详情和审核工作台。任何本地 `setTimeout` 模拟成功的行为，在真实 API 模式都必须由队列状态轮询或推送替代。

## 5. 建议联调顺序

1. 模型通道、模型能力和参数 Schema。
2. 任务组与子任务草稿创建。
3. 商品/视频来源分析、资产角色排序和冲突处理。
4. Prompt 准备、确认和快照版本。
5. Preflight、成本预估、执行确认和异步 Submit。
6. 任务列表、详情、结果版本、局部修改和双阶段审核。
7. 审核通过结果创建视频。
8. 爆款复刻分析与生成 Demo API。

## 6. 联调验收路径

1. 新建视频任务时，页面应为空白，用户从资源中心选择首帧、商品和可选模特。
2. 切到参考生视频，添加多张带角色的参考图，验证数量超限和来源冲突提示。
3. 切换模型，验证不支持的比例、时长或分辨率不会被静默修改。
4. 从审核通过的图片结果创建视频，验证商品、通过图片、风格、模特和 Prompt 上下文被正确预填。
5. 在爆款复刻上传视频/填 URL，选择替换素材，验证分析结果、风险提示和生成提交。
6. 在模板中心编辑平台规格，验证用途和文件格式分别保存、展示和回填。

## 7. 当前边界与后续清理

- 当前所有功能仍为前端 mock，不调用真实生成、审核、模板或通道 API。
- `src/components/CreateVideoTaskV2.tsx` 是当前接入入口；旧 `src/components/CreateVideoTask.tsx` 暂保留以避免未经授权删除文件。后续在真实 API 接入完成后应收敛为一个实现。
- 不应将 `src/mockData.ts`、页面局部 state 或 `VideoTaskEntryContext` 直接复制为后端数据库 Schema 或正式 DTO。
