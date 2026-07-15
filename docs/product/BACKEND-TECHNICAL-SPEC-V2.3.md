# 达芬奇密码 AI 素材工作台后端技术规范 V2.3

状态：正式开发依据
日期：2026-07-15
产品基线：V2.3
文档职责：后端架构、数据语义、事务、队列、Skills 编排和 Provider 接入的唯一技术规范
主要读者：后端/全栈工程师、算法工程师、测试工程师

## 1. 使用说明

后端交付包固定为同目录三份正式文档：

1. `PRD-V2.3.md`：理解产品范围、业务流程、状态语义和验收标准。
2. `API-CONTRACT-V2.3.md`：实现浏览器可调用接口、DTO、错误码、幂等和调用顺序。
3. 本文：设计数据库与模块，实现 Workflow Engine、Generation Gateway、Skills、队列、审核和成本。

冲突处理顺序：

1. 业务行为与验收以 PRD 为准。
2. 浏览器交互边界以 API Contract 为准。
3. 后端内部结构以本文为准。
4. 发现冲突时不得自行选择旧文件，应先更新 V2.3 文档基线再实现。

数据库表名和字段是逻辑模型。后端工程师可以按所选技术栈补充物理字段、索引和迁移细节，但不得改变状态、快照、幂等、结果血缘和付费门禁语义。任何数据库迁移执行前仍需按项目规则获得负责人确认。

## 第一篇：后端实施与模块职责

### 1. 目标与边界

后端负责提供不可绕过的付费生成门禁、任务组事务、异步执行、结果血缘和 Skills 编排。前端只能调用业务阶段 API，不直接调用 Provider 或通用 Skill 执行接口。

必须保证：

```text
确认 Prompt -> 选择通道和参数 -> Preflight -> 用户确认执行 -> Submit
```

本任务书不修改现有 demo 的飞书链路；正式业务数据进入自建数据库和私有对象存储。数据库 migration 属于后端实施内容，但执行 schema 变更前必须按项目红线取得负责人确认。

### 2. 模块职责

| 模块 | 职责 |
| --- | --- |
| Task Group Service | 创建任务组和子任务、组内顺序、完整性校验、聚合状态 |
| Workflow Engine | 状态转换、阶段确认、快照失效、队列、轮询、重试、通知 |
| Content Orchestrator | 编排 `visual-understanding`、`creative-planning`、`prompt-composer` |
| Generation Gateway | 能力 Schema、Preflight、请求序列化、Provider Adapter、成本与健康度 |
| Result Service | 图片/视频结果持久化、规格校验、Checksum、来源血缘 |
| Review Service | 两段审核、结果结论、任务归档和打回 |
| Audit & Metrics | `workflow_node_runs`、attempt、成本、操作日志和统计 |

Provider Adapter 只处理外部协议差异，不读取页面状态、不决定业务审核、不静默复用资产。

### 3. 数据与事务

按本文第二篇“数据模型与字段字典”实现：

- 新增 `generation_task_groups`、`generation_preflights`、`model_channel_health_snapshots`、`workflow_node_runs`。
- `generation_tasks` 增加任务组、顺序、媒体类型和 Profile。
- 将图片专用结果迁移为 `generation_results`，统一图片和视频。
- Prompt、Preflight 和执行快照使用批次 ID 关联同一组确认。
- `generation_attempts.provider_task_id` 在 Provider 接受异步任务后立即持久化。

必须具备数据库约束：

- `task_group_id + group_order` 唯一，顺序从 1 开始连续。
- 同一请求的参考图 `position` 唯一并连续。
- `source_type=generated` 要求 attempt 非空；`source_type=reused` 要求 attempt 为空且存在来源资产或结果。
- 同一任务内 `attempt_no` 唯一；节点 `idempotency_key` 唯一。
- `spec_mismatch` 结果不得被自动归档。

组 Submit 使用单个数据库事务：锁定任务组，校验全部子任务、执行快照和幂等键，创建全部初始 attempt，写入 Outbox/队列记录，更新全部子任务为 `queued`。任一步失败必须整体回滚，不允许部分子任务入队。

### 4. API 实施

API 以 `API-CONTRACT-V2.3.md` 为唯一请求响应依据，固定前缀 `/api/v1`。

#### 4.1 阶段接口

| 阶段 | 接口 | 服务端结果 |
| --- | --- | --- |
| 创建 | `POST /generation-task-groups` | 一个任务组和一个或多个子任务 |
| 上下文分析 | `POST /{group_id}/analyze-context` | Skill 输出和节点运行记录 |
| 上下文确认 | `POST /{group_id}/confirm-context` | 组级不可变快照 |
| 内容准备 | `POST /{group_id}/prepare-content` | 每个子任务的内容和 Prompt 草稿 |
| Prompt 确认 | `POST /{group_id}/confirm-prompts` | 同批次独立 Prompt 快照 |
| Preflight | `POST /{group_id}/preflight` | 逐任务记录和组汇总，不调用付费 Provider |
| 执行确认 | `POST /{group_id}/confirm-execution` | 同批次独立执行快照 |
| Submit | `POST /{group_id}/submit` | 原子创建 attempts 并全量入队 |

所有 `{group_id}` 路径实际位于 `/generation-task-groups/{group_id}` 下。

#### 4.2 Preflight

Preflight 必须执行：

1. Prompt 快照存在且未失效。
2. 参考图角色、位置、数量、格式、大小和总请求体符合能力约束。
3. 参数字段、必填、类型、范围、枚举和条件依赖符合能力 Schema。
4. 通道、模型和 Profile 兼容，能力版本仍启用。
5. Provider 请求可以完成脱敏序列化，但不发送生成请求。
6. 预算、成本规则、队列、健康度、限流和兜底策略有效。

每个子任务产生 `request_fingerprint`，任务组返回总成本、耗时区间、健康度和逐子任务结果。默认 10 分钟过期。任一子任务无效时组级 `valid=false`，禁止执行确认。

#### 4.3 执行确认与 Submit

`confirm-execution` 只消费未过期且组内全部有效的 Preflight 批次，不调用 Provider。执行快照冻结 Prompt、参考图顺序、通道、模型、能力版本、参数、成本、健康快照和兜底策略。

Submit 再次验证：

- 确认批次属于当前任务组且覆盖全部有效子任务。
- Prompt、参考图、通道、参数和能力版本未发生变化。
- Preflight 未过期，预算仍允许提交。
- 幂等键未使用；重复请求返回原提交结果，不重复计费。
- 通道不可用时只执行用户确认的兜底策略，否则返回需重新 Preflight 的冲突错误。

### 5. 状态机与异步执行

服务端只能按正式状态机转换。图片主线：

```text
draft -> pending_product_confirmation -> pending_prompt_confirmation
-> pending_execution_confirmation -> queued -> generating
-> pending_aesthetic_review/pending_listing_review/archived
```

视频主线：

```text
draft -> assets_ready/asset_conflict -> pending_prompt_confirmation
-> pending_execution_confirmation -> queued -> generating
-> pending_aesthetic_review/pending_listing_review/archived
```

异常规则：

- 队列繁忙或限流：`queued -> retry_waiting -> queued`。
- Provider 失败：`generating -> generation_failed`。
- 修改 Prompt/参考图：回到 `pending_prompt_confirmation`。
- 只修改通道/参数：回到 `pending_execution_confirmation`。
- 审核打回：`returned -> pending_prompt_confirmation`。
- `unusable` 不改变为 `cancelled`；审核完成后按结果汇总归档。

Worker 必须从执行快照读取请求，不读取任务表上的可编辑缓存字段。每次初始调用、同配置重试、改配置重试和兜底切换都创建独立 attempt，禁止覆盖历史。

### 6. Generation Gateway

#### 6.1 能力 Schema

通道能力按版本保存，包含 `media_types`、`task_profiles`、`parameter_schema.fields[]`、参考图约束、成本规则和序列化规则。正式生成只使用执行快照记录的能力版本；已禁用版本不能用于新 Preflight。

#### 6.2 Provider Adapter

统一内部方法：

```text
describeCapabilities
health
preflightSerialize
submit
query
cancel
normalizeResult
```

Adapter 输出统一 Provider task ID、状态、进度、结果文件、用量、错误和脱敏响应摘要。外部错误映射为正式错误码，并明确 `retryable`。

#### 6.3 兜底策略

支持三种模式：`stop_and_ask`、`retry_same_channel`、`switch_to_confirmed_channel`。自动切换必须包含用户确认的兜底通道、触发条件和最大次数；每次切换创建 `trigger_type=fallback_switch` 的新 attempt，并记录原因。

### 7. Skills 与节点记录

Workflow Engine 使用蓝图定义的 5 个 Skills：

- `visual-understanding`
- `creative-planning`
- `prompt-composer`
- `quality-evaluator`
- `retry-advisor`

每次执行写入 `workflow_node_runs`，记录 Skill 名称、版本、Profile、幂等键、输入输出摘要、warnings、diagnostics、metrics、trace 和错误。Skill 只能输出建议；不能确认业务数据、选择通道、Submit、自动重试或改变审核结论。

### 8. 结果、审核与成本

- Provider 结果下载到私有对象存储后创建 `generation_results`。
- 图片校验数量、宽高、比例、格式和 Checksum；视频额外校验时长、封面和媒体元数据。
- `spec_mismatch` 结果进入人工审核，不自动归档。
- `reused` 由显式复用接口创建，不创建 attempt、不增加生成成本。
- 审核记录关联统一结果；视频可保存抽帧评分和漂移时间点。
- 成本按 attempt 和结果记录，任务组、任务、通道和时间维度可汇总。

### 9. 测试与验收

后端至少覆盖以下自动化场景：

1. 三子任务组中一个 Preflight 失败，确认执行和 Submit 均被拒绝。
2. Prompt 确认后修改参考图，旧 Preflight 和执行快照失效。
3. 同一 Submit 幂等键重复请求只创建一组 attempts 和队列记录。
4. 模拟事务中第三个子任务入队失败，数据库中无任何子任务进入 `queued`。
5. 限流进入 `retry_waiting`，重试后回到 `queued`，不产生复用结果。
6. 兜底切换创建新 attempt 并保留主通道失败记录。
7. Provider 返回错误比例时结果为 `spec_mismatch` 且不能自动归档。
8. 显式复用结果的 attempt 为空、成本为 0、来源血缘完整。
9. 视频参考图按 position 序列化，重复或断裂 position 返回 `REFERENCE_ORDER_INVALID`。
10. Provider task ID 在异步受理后持久化，服务重启后可继续查询。

联调完成定义：前端只通过正式阶段 API 完成图片多 Profile 和单视频任务，刷新页面后状态、快照、attempt、成本、结果来源和审核记录均可恢复。

## 第二篇：数据模型与字段字典


### 1. 设计原则

- 飞书不作为正式主数据库。
- 所有图片文件只在数据库保存元数据和对象存储地址，不保存二进制。
- 删除优先软删除或停用。
- 任务、审核、Prompt、成本、模型通道调用必须可追溯。
- 普通员工可以编辑任务级 Prompt 副本，不能修改全局模板。
- 任何付费生成必须关联已确认 Prompt、未过期 Preflight 和执行确认快照。
- 图片和视频结果统一建模，旧资产复用不得伪装为 Provider 生成成功。

### 2. 通用字段约定

多数业务表建议包含：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string/uuid | 是 | 主键 |
| `created_at` | datetime | 是 | 创建时间 |
| `updated_at` | datetime | 是 | 更新时间 |
| `created_by` | string/uuid | 否 | 创建人用户 ID |
| `updated_by` | string/uuid | 否 | 更新人用户 ID |
| `deleted_at` | datetime | 否 | 软删除时间 |

### 3. 核心枚举

#### 3.1 角色

| 枚举值 | 中文名 | 说明 |
| --- | --- | --- |
| `admin` | 管理员 | 全部系统配置权限 |
| `operator` | 运营/任务创建人 | 上传素材、创建任务、查看自己的任务 |
| `designer` | 设计/美工 | 维护模板、审美评分、优化 Prompt |
| `reviewer` | 审核人/业务确认人 | 上架审核、打回、归档 |
| `manager` | 项目负责人/管理者 | 查看数据复盘和整体进度 |

#### 3.2 任务状态

| 枚举值 | 中文名 | 可进入方式 |
| --- | --- | --- |
| `draft` | 草稿 | 用户保存草稿 |
| `assets_ready` | 视频素材已就绪 | 视频来源图片已完成解析和角色标记 |
| `asset_conflict` | 视频素材冲突 | 参考图数量、角色或内容存在冲突，等待用户处理 |
| `pending_product_confirmation` | 待商品确认 | AI 理解完成，等待用户确认商品事实 |
| `pending_prompt_confirmation` | 待内容确认 | 商品事实已确认，等待确认拍摄方案和 Prompt |
| `pending_execution_confirmation` | 待执行确认 | Prompt 已确认，等待选择通道、预检和付费确认 |
| `queued` | 排队中 | 执行快照已确认且任务已提交队列 |
| `retry_waiting` | 重试等待 | 限流、队列繁忙或可恢复错误，等待再次入队 |
| `generating` | 生成中 | Worker 开始处理 |
| `generation_failed` | 生成失败 | 模型失败、超时、预算不足 |
| `pending_aesthetic_review` | 待审美评分 | 生成成功且启用审美评分 |
| `pending_listing_review` | 待上架审核 | 完成评分或跳过评分 |
| `returned` | 已打回 | 评分或审核打回 |
| `archived` | 已归档 | 审核通过或跳过审核 |
| `cancelled` | 已取消 | 用户主动取消尚未完成的任务 |

适用范围：图片任务使用 `pending_product_confirmation`；视频任务使用 `assets_ready`、`asset_conflict`。生成成功后根据审核配置进入 `pending_aesthetic_review`、`pending_listing_review` 或直接 `archived`。`unusable` 是结果审核结论，`spec_mismatch` 是结果校验状态，二者都不是任务状态。

#### 3.3 素材类型

| 枚举值 | 中文名 | 是否商品主体 |
| --- | --- | --- |
| `product_original` | 商品原图 | 是 |
| `top_garment` | 上衣图 | 是，合成前源图 |
| `bottom_garment` | 下装图 | 是，合成前源图 |
| `composite_white_bg` | 套图白底图 | 是，可作为任务原图 |
| `detail` | 细节图 | 部分保真 |
| `style_reference` | 风格参考图 | 否 |
| `scene_reference` | 场景参考图 | 否 |
| `model_pose_reference` | 模特/姿势参考图 | 否 |
| `model_reference` | 模特参考图 | 否，来自虚拟/授权模特参考库 |
| `generation_result` | 生成结果文件 | 图片或视频输出素材 |

#### 3.4 媒体类型与任务 Profile

| 媒体类型 | Profile | 中文名 |
| --- | --- | --- |
| `image` | `main_image` | 商品主图生成 |
| `image` | `scene_image` | 详情页/场景图生成 |
| `image` | `detail_image` | 细节图生成 |
| `image` | `tryon_three_view` | 上身/三视图生成 |
| `video` | `img2video` | 首帧图生视频 |
| `video` | `reference2video` | 参考图组生视频 |

#### 3.5 审核结论与标签

| 类型 | 枚举值 | 中文名 |
| --- | --- | --- |
| 审核结论 | `approved` | 通过 |
| 审核结论 | `returned` | 打回 |
| 审核结论 | `unusable` | 不可用 |
| 审核结论 | `pending_confirm` | 待确认 |
| 问题标签 | `subject_mismatch` | 主体跑偏 |
| 问题标签 | `color_inaccurate` | 颜色不准 |
| 问题标签 | `fabric_inaccurate` | 面料不准 |
| 问题标签 | `structure_changed` | 版型结构改变 |
| 问题标签 | `composition_bad` | 构图不佳 |
| 问题标签 | `detail_unusable` | 细节不可用 |
| 问题标签 | `text_error` | 文字错误 |
| 问题标签 | `style_inconsistent` | 风格不统一 |
| 问题标签 | `spec_mismatch` | 规格不符 |
| 问题标签 | `body_artifact` | 人体/手脚异常 |
| 问题标签 | `model_unrealistic` | 模特真人感不足 |
| 问题标签 | `facial_ratio_bad` | 五官/三庭五眼不自然 |
| 问题标签 | `head_body_ratio_bad` | 头身比例不自然 |
| 问题标签 | `pose_stiff` | 姿势僵硬 |
| 问题标签 | `tryon_fidelity_bad` | 商品上身保真不足 |

### 4. 表结构建议

#### 4.1 `users`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 用户 ID |
| `name` | varchar | 是 | 员工姓名 |
| `login_account` | varchar | 是 | 登录账号，唯一 |
| `password_hash` | varchar | 是 | 密码哈希，不保存明文 |
| `department` | varchar | 否 | 部门 |
| `status` | enum | 是 | `active`、`disabled` |
| `last_login_at` | datetime | 否 | 最后登录时间 |

索引建议：`login_account` 唯一索引，`status` 普通索引。

#### 4.2 `roles` / `permissions` / `user_roles` / `role_permissions`

`roles`：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 角色 ID |
| `code` | varchar | 是 | 角色编码，如 `admin` |
| `name` | varchar | 是 | 中文角色名 |
| `description` | text | 否 | 权限说明 |
| `enabled` | boolean | 是 | 是否启用 |

`permissions`：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 权限 ID |
| `code` | varchar | 是 | 权限编码 |
| `name` | varchar | 是 | 中文名 |
| `scope` | enum | 是 | `menu`、`button`、`api`、`data` |

中间表使用 `user_id`、`role_id` 和 `role_id`、`permission_id` 关联。

#### 4.3 `product_assets`

商品资产是长期沉淀对象，不以单次任务为中心。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 商品资产 ID |
| `product_name` | varchar | 是 | 商品名称 |
| `category` | varchar | 否 | 品类 |
| `color` | varchar | 否 | 颜色 |
| `fabric` | varchar | 否 | 面料 |
| `selling_points` | text | 否 | 核心卖点 |
| `forbidden_changes` | text/json | 否 | 禁止改写项，如颜色、Logo、版型 |
| `ai_extraction` | json | 否 | 图片识别结果、置信度、原始输出 |
| `source` | enum | 是 | `manual`、`ai_extracted`、`imported` |
| `status` | enum | 是 | `active`、`archived`、`disabled` |

索引建议：`product_name`、`category`、`created_at`。

#### 4.4 `asset_files`

保存所有输入图、合成图、生成图和归档图的元数据。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 素材文件 ID |
| `product_asset_id` | uuid | 否 | 关联商品 |
| `generation_task_id` | uuid | 否 | 来源任务 |
| `generation_result_id` | uuid | 否 | 若为生成结果文件，关联统一结果 |
| `asset_type` | enum | 是 | 见素材类型枚举 |
| `storage_key` | varchar | 是 | OSS/COS/S3 对象 key |
| `url` | varchar | 否 | 内部访问地址或签名地址缓存 |
| `thumbnail_key` | varchar | 否 | 缩略图 key |
| `filename` | varchar | 是 | 原始文件名 |
| `mime_type` | varchar | 是 | MIME 类型 |
| `size_bytes` | bigint | 是 | 文件大小 |
| `width` | int | 否 | 图片宽度 |
| `height` | int | 否 | 图片高度 |
| `checksum` | varchar | 否 | 去重校验 |
| `metadata` | json | 否 | 上传来源、识别结果、合成信息 |

索引建议：`product_asset_id`、`generation_task_id`、`asset_type`、`checksum`。

#### 4.4A `model_profiles`

P0 轻量版虚拟/授权模特参考库。不支持任意联网抓取真人图片，不做真人身份复刻。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 模特资源 ID |
| `name` | varchar | 是 | 模特名称或内部代号 |
| `model_type` | enum | 是 | `virtual`、`licensed_real_reference`、`internal_asset` |
| `license_status` | enum | 是 | `approved`、`pending_confirm`、`unavailable` |
| `source_note` | text | 否 | 来源和授权说明 |
| `style_tags` | json/array | 否 | 甜美、清冷、高级、轻熟、东方、欧美、中老年等 |
| `age_feel` | varchar | 否 | 少女、轻熟、成熟、中老年等 |
| `facial_features` | json | 否 | 脸型、五官立体度、亲和力、高级感、三庭五眼评分 |
| `skin_hair_makeup` | json | 否 | 肤色、发型、妆容 |
| `body_ratio` | varchar/json | 否 | 高挑、标准、微胖、中老年体型等 |
| `head_body_ratio` | varchar | 否 | 7 头身、8 头身、自然比例等 |
| `applicable_categories` | json/array | 否 | 适用品类 |
| `applicable_task_profiles` | json/array | 否 | `main_image`、`tryon_three_view`、`reference2video`、`img2video` |
| `reference_assets` | json/array | 否 | 模特参考素材，元素为 `{asset_id, role, position}` |
| `status` | enum | 是 | `active`、`disabled` |
| `stats` | json | 否 | 使用次数、平均审美分、通过率 |

索引建议：`model_type`、`license_status`、`status`。

#### 4.4B `model_profile_recommendations`

记录任务中系统推荐和用户最终选择的模特，用于追溯与复盘。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 推荐记录 ID |
| `generation_task_id` | uuid | 是 | 关联任务 |
| `recommended_profile_ids` | json/array | 是 | 系统推荐的 2-3 个模特 |
| `selected_profile_id` | uuid | 否 | 用户最终选择的模特 |
| `selection_mode` | enum | 是 | `system_recommended`、`manual_selected`、`none` |
| `recommendation_reason` | json/text | 否 | 推荐理由，如品类、风格、头身比例、适用任务 |
| `snapshot` | json | 否 | 模特标签快照，避免后续模特资料变更影响历史任务 |

#### 4.5 `generation_task_groups`

一次五步创建流程对应一个任务组。任务组不复制子任务的完整状态；接口根据子任务返回 `aggregate_status`。提交前的确认和 Submit 通过事务保证组内子任务阶段一致。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 任务组 ID |
| `group_no` | varchar | 是 | 业务可读编号，唯一 |
| `product_asset_id` | uuid | 是 | 关联商品资产 |
| `media_type` | enum | 是 | `image`、`video` |
| `title` | varchar | 是 | 任务组名称 |
| `shared_model_channel_id` | uuid | 否 | 当前选择的主通道；提交前允许为空 |
| `shared_model_id` | varchar | 否 | 当前选择的模型 |
| `shared_parameters` | json | 否 | 组内共享执行参数草稿，正式提交值以子任务执行快照为准 |
| `shared_fallback_policy` | json | 否 | 用户选择的组级兜底策略草稿 |
| `context_snapshot_id` | uuid | 否 | 当前有效的商品/来源事实快照 |
| `created_by` | uuid | 是 | 创建人 |
| `cancelled_at` | datetime | 否 | 整组取消时间 |

索引建议：`group_no` 唯一索引，`product_asset_id`、`media_type`、`created_by`、`created_at`。

#### 4.6 `generation_tasks`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 任务 ID |
| `task_no` | varchar | 是 | 业务可读编号，如 `T-20260615-001` |
| `task_group_id` | uuid | 是 | 关联任务组 |
| `group_order` | int | 是 | 组内顺序，从 1 开始且唯一 |
| `product_asset_id` | uuid | 是 | 关联商品资产 |
| `title` | varchar | 是 | 任务名称 |
| `media_type` | enum | 是 | `image`、`video` |
| `task_profile` | enum | 是 | 六类正式 Profile 之一 |
| `status` | enum | 是 | 任务状态 |
| `style_preset` | varchar | 否 | 风格，如甜美网红风 |
| `scene_preset` | varchar | 否 | 场景，如室内、室外 |
| `action_preset` | varchar | 否 | 动作/姿势 |
| `ratio` | varchar | 否 | 内容阶段的目标比例偏好；最终提交值只认执行快照 |
| `image_count` | int | 否 | 内容阶段的目标张数偏好；最终提交值只认执行快照 |
| `model_channel_id` | uuid | 否 | 当前已确认或最近实际执行通道；创建草稿时不必填写 |
| `template_id` | uuid | 否 | 全局模板 ID |
| `template_version` | int | 否 | 使用的模板版本 |
| `task_prompt` | text | 否 | 最新任务级 Prompt 预览缓存；已确认版本以 `task_prompt_snapshots` 为准 |
| `negative_prompt` | text | 否 | 本次负面约束 |
| `free_description` | text | 否 | 用户补充描述 |
| `prompt_sources` | json | 否 | 变量值、模板版本、AI 助手应用记录 |
| `input_assets` | json/array | 是 | 有序输入素材，元素为 `{asset_id, role, position}` |
| `model_profile_id` | uuid | 否 | 当前任务选择的模特资源 |
| `model_profile_context` | json | 否 | 模特推荐理由、风格标签、头身比例等快照 |
| `retry_count` | int | 是 | 已重试次数 |
| `max_retry_count` | int | 是 | 最大重试次数 |
| `cost_total` | decimal | 否 | 任务总成本 |
| `started_at` | datetime | 否 | 开始生成时间 |
| `finished_at` | datetime | 否 | 结束时间 |
| `failed_reason` | text | 否 | 失败原因 |
| `confirmed_product_snapshot_id` | uuid | 否 | 当前有效的商品事实快照 |
| `prompt_snapshot_id` | uuid | 否 | 当前有效的 Prompt 内容快照 |
| `execution_snapshot_id` | uuid | 否 | 当前有效且已确认的执行快照 |

索引建议：`task_no` 唯一索引，`task_group_id + group_order` 唯一索引，以及 `status`、`media_type`、`task_profile`、`product_asset_id`、`created_by`、`created_at`。

#### 4.7 `generation_results`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 结果 ID |
| `generation_task_id` | uuid | 是 | 关联任务 |
| `asset_file_id` | uuid | 是 | 关联素材文件 |
| `version_no` | int | 是 | 任务内版本号 |
| `media_type` | enum | 是 | `image`、`video`，必须与任务一致 |
| `source_type` | enum | 是 | `generated`、`reused` |
| `review_status` | enum | 是 | `pending`、`approved`、`returned`、`unusable`、`archived` |
| `validation_status` | enum | 是 | `pending`、`valid`、`spec_mismatch`、`validation_failed` |
| `width` | int | 否 | 图片宽度 |
| `height` | int | 否 | 图片高度 |
| `ratio` | varchar | 否 | 输出比例 |
| `format` | varchar | 否 | 文件格式 |
| `video_duration_ms` | int | 否 | 视频时长 |
| `cover_asset_file_id` | uuid | 否 | 视频封面素材 |
| `media_metadata` | json | 否 | 编码、帧率、码率、音频等媒体元数据 |
| `frame_quality_summary` | json | 否 | 视频抽帧质量评估摘要 |
| `drift_timestamps_ms` | json/array | 否 | 人物、服装、颜色或图案漂移时间点 |
| `model_channel_id` | uuid | 否 | 实际通道 |
| `seed` | varchar/int | 否 | seed |
| `cost_amount` | decimal | 否 | 本结果成本；复用结果为 0 |
| `generation_duration_ms` | int | 否 | 生成耗时 |
| `prompt_snapshot` | text | 否 | `generated` 记录实际使用 Prompt；`reused` 可为空 |
| `raw_response` | json | 否 | 模型原始响应摘要，不保存敏感信息 |
| `model_profile_id` | uuid | 否 | 如果结果使用了模特资源，记录所用模特 |
| `generation_attempt_id` | uuid | 否 | `generated` 必填，`reused` 必须为空 |
| `source_asset_file_id` | uuid | 否 | 复用来源资产 |
| `source_result_id` | uuid | 否 | 复用来源结果 |
| `actual_width` | int | 否 | Provider 实际返回宽度 |
| `actual_height` | int | 否 | Provider 实际返回高度 |
| `actual_ratio` | varchar | 否 | Provider 实际返回比例 |
| `actual_format` | varchar | 否 | Provider 实际返回格式 |
| `spec_validation` | json | 是 | 张数、尺寸、比例、格式校验结果和 `spec_mismatch` 明细 |

约束：`source_type = generated` 时 `generation_attempt_id` 必填；`source_type = reused` 时 `generation_attempt_id` 为空，且 `source_asset_file_id`、`source_result_id` 至少一个必填。`spec_mismatch` 结果不得自动归档。

索引建议：`generation_task_id`、`media_type`、`source_type`、`review_status`、`validation_status`、`model_channel_id`。

#### 4.8 `prompt_templates`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 模板 ID |
| `name` | varchar | 是 | 模板名称 |
| `template_type` | enum | 是 | `task_profile`、`style`、`scene`、`platform_spec`、`negative_constraint` |
| `applicable_task_profiles` | json/array | 否 | 适用任务 Profile |
| `applicable_categories` | json/array | 否 | 适用品类 |
| `prompt_body` | text | 是 | Prompt 正文，支持变量 |
| `negative_prompt` | text | 否 | 负面约束 |
| `variables` | json | 否 | 变量定义 |
| `default_ratio` | varchar | 否 | 默认比例 |
| `default_image_count` | int | 否 | 默认张数 |
| `default_model_channel_id` | uuid | 否 | 默认通道 |
| `version` | int | 是 | 当前版本 |
| `enabled` | boolean | 是 | 是否启用 |
| `stats` | json | 否 | 使用次数、通过率、平均分、平均成本 |

模板修改时建议新增版本记录，历史任务绑定创建时版本。

#### 4.9 `model_channels`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 模型通道 ID |
| `name` | varchar | 是 | 通道名称 |
| `channel_type` | enum | 是 | `cloud_api`、`relay`、`third_party`、`local_model` |
| `base_url` | varchar | 否 | 服务地址 |
| `api_key_secret_ref` | varchar | 否 | secret 引用，不保存明文 |
| `default_model` | varchar | 否 | 默认模型名 |
| `capability_version` | varchar | 是 | 当前生效能力 Schema 版本 |
| `health_status` | enum | 是 | `healthy`、`degraded`、`busy`、`unavailable` |
| `fallback_policy` | json | 否 | 可供用户确认的兜底通道和触发条件，不允许静默切换 |
| `enabled` | boolean | 是 | 是否启用 |
| `priority` | int | 是 | 调度优先级 |
| `timeout_ms` | int | 是 | 超时时间 |
| `retry_policy` | json | 否 | 重试策略 |
| `cost_rule` | json | 否 | 成本规则 |
| `error_mapping` | json | 否 | 外部错误到内部错误映射 |

#### 4.10 `task_context_snapshots`

冻结用户确认后的商品事实和参考资产上下文。后续飞书字段、商品资料或模特资料变化不影响历史任务。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 快照 ID |
| `task_group_id` | uuid | 是 | 关联任务组，共享给组内子任务 |
| `snapshot_type` | enum | 是 | `product_confirmed`、`source_confirmed`、`reference_confirmed` |
| `content` | json | 是 | 商品/来源事实、禁止改写项及 `{asset_id, role, position}` 有序素材 |
| `version` | int | 是 | 任务组内版本 |
| `confirmed_by` | uuid | 是 | 确认人 |
| `confirmed_at` | datetime | 是 | 确认时间 |
| `invalidated_at` | datetime | 否 | 上游内容变化后的失效时间 |

#### 4.11 `task_prompt_snapshots`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | Prompt 快照 ID |
| `generation_task_id` | uuid | 是 | 关联任务 |
| `confirmation_batch_id` | uuid | 是 | 同一任务组本轮 Prompt 确认批次 |
| `prompt` | text | 是 | 用户确认的最终 Prompt |
| `negative_prompt` | text | 否 | 用户确认的负面约束 |
| `template_version` | varchar | 否 | 模板版本 |
| `source_snapshot_ids` | json/array | 是 | 商品、参考资产等上游快照 |
| `variables` | json | 否 | 实际变量值和来源 |
| `version` | int | 是 | 任务内版本 |
| `confirmed_by` | uuid | 是 | 确认人 |
| `confirmed_at` | datetime | 是 | 确认时间 |
| `invalidated_at` | datetime | 否 | Prompt 或上游快照变化后的失效时间 |

#### 4.12 `generation_preflights`

Preflight 是无付费预检记录。任务组 Preflight 为每个子任务创建一条记录，并使用同一个 `preflight_batch_id`；任一记录无效时整组 `valid = false`。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | Preflight ID |
| `preflight_batch_id` | uuid | 是 | 任务组本轮 Preflight 批次 |
| `task_group_id` | uuid | 是 | 关联任务组 |
| `generation_task_id` | uuid | 是 | 关联子任务 |
| `prompt_snapshot_id` | uuid | 是 | 已确认 Prompt 快照 |
| `model_channel_id` | uuid | 是 | 用户选择的主通道 |
| `model_id` | varchar | 是 | 用户选择的模型 |
| `capability_version` | varchar | 是 | 能力 Schema 版本 |
| `parameters` | json | 是 | 结构化参数 |
| `reference_assets` | json | 是 | `{asset_id, role, position}` 有序清单 |
| `fallback_policy` | json | 是 | 待确认的重试、切换或终止策略 |
| `request_preview` | json | 是 | 脱敏请求摘要 |
| `request_fingerprint` | varchar | 是 | Prompt、参考图、通道、参数和兜底策略指纹 |
| `validation_result` | json | 是 | 能力、素材、预算、请求大小和序列化校验 |
| `health_snapshot_id` | uuid | 是 | 预检时通道健康快照 |
| `estimated_cost` | decimal | 否 | 子任务预计成本 |
| `estimated_duration_min_ms` | int | 否 | 预计耗时下界 |
| `estimated_duration_max_ms` | int | 否 | 预计耗时上界 |
| `status` | enum | 是 | `valid`、`invalid`、`expired`、`consumed` |
| `expires_at` | datetime | 是 | 默认创建后 10 分钟过期 |

索引建议：`preflight_batch_id`、`task_group_id`、`generation_task_id`、`status`、`expires_at`。

#### 4.13 `generation_execution_snapshots`

记录一次明确的付费执行确认。Prompt、参考图、模型通道或参数任一变化，都必须生成新快照。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 执行快照 ID |
| `generation_task_id` | uuid | 是 | 关联任务 |
| `confirmation_batch_id` | uuid | 是 | 同一任务组本轮执行确认批次 |
| `prompt_snapshot_id` | uuid | 是 | 已确认 Prompt 快照 |
| `preflight_id` | uuid | 是 | 确认时仍有效且未过期的 Preflight |
| `model_channel_id` | uuid | 是 | 用户确认的主通道 |
| `capability_version` | varchar | 是 | 预检时使用的能力 Schema 版本 |
| `parameters` | json | 是 | 比例、尺寸、张数、时长、质量等结构化参数 |
| `reference_assets` | json | 是 | 参考图 ID、角色和有序列表 |
| `request_preview` | json | 是 | 脱敏后的 Provider 请求摘要 |
| `estimated_cost` | decimal | 否 | 预计成本 |
| `estimated_duration_min_ms` | int | 否 | 预计耗时下界 |
| `estimated_duration_max_ms` | int | 否 | 预计耗时上界 |
| `fallback_policy` | json | 是 | 用户确认的重试、切换或终止策略 |
| `confirmed_by` | uuid | 是 | 付费执行确认人 |
| `confirmed_at` | datetime | 是 | 确认时间 |
| `invalidated_at` | datetime | 否 | 任一输入变化后的失效时间 |

约束：只有 `generation_preflights.status = valid` 且未过期时才能创建执行快照。创建后 Preflight 标记为 `consumed`。Prompt、参考图、通道、参数、能力版本或兜底策略变化时，关联执行快照立即失效。

#### 4.14 `generation_attempts`

每次提交、重试或切换通道都创建新记录，禁止覆盖上一轮调用。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 尝试 ID |
| `generation_task_id` | uuid | 是 | 关联任务 |
| `execution_snapshot_id` | uuid | 是 | 本次使用的执行快照 |
| `attempt_no` | int | 是 | 任务内尝试序号 |
| `model_channel_id` | uuid | 是 | 实际调用通道 |
| `provider_task_id` | varchar | 否 | Provider 异步任务 ID |
| `status` | enum | 是 | `queued`、`submitting`、`generating`、`retry_waiting`、`succeeded`、`failed`、`cancelled` |
| `trigger_type` | enum | 是 | `initial`、`retry_same_config`、`retry_changed_config`、`fallback_switch` |
| `request_payload_summary` | json | 是 | 脱敏请求摘要 |
| `raw_response_summary` | json | 否 | 脱敏响应摘要 |
| `error_code` | varchar | 否 | 标准错误码 |
| `error_message` | text | 否 | 错误说明 |
| `started_at` | datetime | 否 | 开始时间 |
| `finished_at` | datetime | 否 | 结束时间 |

#### 4.15 `model_channel_capabilities`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 能力记录 ID |
| `model_channel_id` | uuid | 是 | 关联通道 |
| `version` | varchar | 是 | 能力 Schema 版本 |
| `media_types` | json/array | 是 | 支持的 `image`、`video` |
| `task_profiles` | json/array | 是 | 支持的正式任务 Profile |
| `parameter_schema` | json | 是 | `{schema_version, fields[]}`；字段按数组顺序渲染 |
| `reference_constraints` | json | 是 | 图片数量、格式、大小、角色和顺序限制 |
| `cost_schema` | json | 否 | 成本估算规则 |
| `serialization_rules` | json | 是 | 内部参数到 Provider 参数的映射 |
| `enabled` | boolean | 是 | 是否可用于新任务 |

`parameter_schema.fields[]` 每项固定支持：`key`、`label`、`type`、`required`、`default`、`options`、`min`、`max`、`step`、`unit`、`visible_when`。一期不允许 Provider 自定义前端组件类型。

#### 4.16 `model_channel_health_snapshots`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 健康快照 ID |
| `model_channel_id` | uuid | 是 | 关联通道 |
| `status` | enum | 是 | `healthy`、`degraded`、`busy`、`unavailable` |
| `queue_depth` | int | 否 | 可获取时记录队列深度 |
| `estimated_wait_ms` | int | 否 | 预计排队耗时 |
| `rate_limit_remaining` | int | 否 | 剩余限流额度 |
| `budget_available` | boolean | 是 | 当前预算是否允许提交 |
| `diagnostics` | json | 否 | 脱敏诊断信息 |
| `checked_at` | datetime | 是 | 检查时间 |

#### 4.17 `workflow_node_runs`

记录 Workflow Engine 对 Skill、平台能力和人工确认节点的执行情况。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 节点运行 ID |
| `task_group_id` | uuid | 否 | 关联任务组 |
| `generation_task_id` | uuid | 否 | 关联子任务 |
| `node_name` | varchar | 是 | 节点名称 |
| `node_type` | enum | 是 | `skill`、`platform`、`human_confirmation` |
| `skill_name` | varchar | 否 | Skill 名称 |
| `skill_version` | varchar | 否 | Skill 版本 |
| `skill_profile` | varchar | 否 | Skill Profile |
| `status` | enum | 是 | `queued`、`running`、`succeeded`、`failed`、`cancelled` |
| `idempotency_key` | varchar | 是 | 节点幂等键，唯一 |
| `input_summary` | json | 是 | 脱敏输入摘要 |
| `output_summary` | json | 否 | 脱敏输出摘要 |
| `warnings` | json/array | 否 | 非阻断告警 |
| `diagnostics` | json | 否 | 诊断信息 |
| `metrics` | json | 否 | 耗时、Token、预计成本等指标 |
| `trace_id` | varchar | 是 | Trace ID |
| `error_code` | varchar | 否 | 标准错误码 |
| `error_message` | text | 否 | 错误说明 |
| `started_at` | datetime | 否 | 开始时间 |
| `finished_at` | datetime | 否 | 结束时间 |

#### 4.18 `review_records`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 审核记录 ID |
| `generation_task_id` | uuid | 是 | 关联任务 |
| `generation_result_id` | uuid | 否 | 可针对单个图片或视频结果 |
| `review_type` | enum | 是 | `aesthetic`、`listing` |
| `score` | int | 否 | 审美 1-5 分 |
| `dimension_scores` | json | 否 | 主体准确、风格一致、构图、质感、商业可用 |
| `conclusion` | enum | 否 | 通过、打回、不可用、待确认 |
| `labels` | json/array | 否 | 问题标签 |
| `comment` | text | 否 | 优化意见 |
| `reviewed_by` | uuid | 是 | 审核人 |
| `reviewed_at` | datetime | 是 | 审核时间 |

#### 4.19 `cost_records`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 成本记录 ID |
| `generation_task_id` | uuid | 是 | 关联任务 |
| `generation_result_id` | uuid | 否 | 可关联单个图片或视频结果 |
| `model_channel_id` | uuid | 否 | 模型通道 |
| `cost_type` | enum | 是 | `api_call`、`image`、`video`、`retry`、`local_compute` |
| `amount` | decimal | 是 | 金额或点数 |
| `currency` | varchar | 是 | `CNY`、`USD`、`POINT` |
| `unit_count` | decimal | 否 | 调用次数、张数、秒数等 |
| `raw_usage` | json | 否 | 模型返回的用量摘要 |
| `occurred_at` | datetime | 是 | 发生时间 |

#### 4.20 `notifications`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 通知 ID |
| `user_id` | uuid | 是 | 接收人 |
| `type` | enum | 是 | `generated`、`failed`、`pending_aesthetic_review`、`pending_listing_review`、`returned` |
| `title` | varchar | 是 | 标题 |
| `content` | text | 否 | 内容 |
| `related_type` | varchar | 否 | 关联对象类型 |
| `related_id` | uuid | 否 | 关联对象 ID |
| `read_at` | datetime | 否 | 已读时间 |

#### 4.21 `operation_logs`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 日志 ID |
| `actor_id` | uuid | 否 | 操作人 |
| `action` | varchar | 是 | 操作编码 |
| `resource_type` | varchar | 是 | 资源类型 |
| `resource_id` | uuid | 否 | 资源 ID |
| `before_snapshot` | json | 否 | 变更前摘要 |
| `after_snapshot` | json | 否 | 变更后摘要 |
| `ip` | varchar | 否 | IP |
| `user_agent` | text | 否 | 浏览器信息 |
| `created_at` | datetime | 是 | 操作时间 |

#### 4.22 `assistant_sessions` / `assistant_messages`

`assistant_sessions`：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 会话 ID |
| `generation_task_id` | uuid | 否 | 任务上下文 |
| `product_asset_id` | uuid | 否 | 商品上下文 |
| `created_by` | uuid | 是 | 发起人 |
| `context_snapshot` | json | 是 | 商品信息、参数、Prompt、审核标签等 |

`assistant_messages`：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | uuid | 是 | 消息 ID |
| `session_id` | uuid | 是 | 会话 ID |
| `role` | enum | 是 | `user`、`assistant`、`system` |
| `content` | text | 是 | 消息内容 |
| `suggested_actions` | json | 否 | 应用到 Prompt、补充自由描述等 |
| `applied_at` | datetime | 否 | 建议应用时间 |
| `applied_by` | uuid | 否 | 应用人 |

### 5. 关键关联关系

```text
users n..m roles
roles n..m permissions
product_assets 1..n asset_files
product_assets 1..n generation_task_groups
generation_task_groups 1..n generation_tasks
generation_task_groups 1..n task_context_snapshots
generation_tasks 1..n task_prompt_snapshots
generation_task_groups 1..n generation_preflights
generation_tasks 1..n generation_preflights
generation_tasks 1..n generation_execution_snapshots
generation_tasks 1..n generation_attempts
generation_tasks 1..n generation_results
generation_tasks 1..n review_records
generation_tasks 1..n cost_records
generation_results 1..1 asset_files
prompt_templates 1..n generation_tasks
model_channels 1..n generation_tasks
model_channels 1..n generation_results
model_channels 1..n model_channel_capabilities
model_channels 1..n model_channel_health_snapshots
model_channel_health_snapshots 1..n generation_preflights
generation_preflights 1..1 generation_execution_snapshots
generation_execution_snapshots 1..n generation_attempts
generation_attempts 1..n generation_results
generation_task_groups 1..n workflow_node_runs
generation_tasks 1..n workflow_node_runs
generation_tasks 1..n assistant_sessions
model_profiles 1..n generation_tasks
model_profiles 1..n model_profile_recommendations
generation_tasks 1..1 model_profile_recommendations
```

### 6. 物理实现约束

- 本文的 `uuid`、`json`、`datetime` 是逻辑类型；后端按项目已批准的数据库映射，不得改变字段语义、唯一约束和关联关系。
- JSON 能力 Schema、请求预览和外部响应摘要必须做大小限制、敏感字段过滤和版本控制。
- 对象存储只保存文件，数据库只保存元数据、存储键和短期签名访问所需信息。
- 队列实现必须支持幂等、可恢复重试和任务取消；具体中间件不影响 API 状态语义。
- 数据库 schema 或迁移文件由后端实施任务单独提交，并按项目红线取得负责人确认。

## 第三篇：模型通道与 Provider Adapter


### 1. 目标

模型通道负责把统一任务请求转换为具体模型调用，并把结果、错误、成本和耗时转换为系统统一格式。

一期通道类型：

| 类型 | 说明 |
| --- | --- |
| `cloud_api` | 官方云端模型 API |
| `relay` | OpenAI-compatible 或第三方中转站 |
| `third_party` | 第三方平台封装能力 |
| `local_model` | 公司本地微调模型 HTTP 服务 |

### 2. 能力声明

每个模型通道需要在后台配置能力范围：

```json
{
  "media_types": ["image", "video"],
  "task_profiles": ["main_image", "scene_image", "detail_image", "tryon_three_view", "img2video", "reference2video"],
  "input_asset_types": ["product_original", "composite_white_bg", "style_reference", "model_pose_reference"],
  "parameter_schema": {
    "schema_version": 1,
    "fields": [
      {"key": "ratio", "label": "比例", "type": "enum", "required": true, "options": ["1:1", "4:5"]},
      {"key": "image_count", "label": "张数", "type": "integer", "required": true, "min": 1, "max": 4, "step": 1, "unit": "张"}
    ]
  },
  "reference_constraints": {"min": 1, "max": 4, "ordered": true},
  "supports_seed": true,
  "supports_region_revision": true,
  "supports_callback": true,
  "supports_cancel": true
}
```

前端只消费业务 API 返回的标准 Schema；任务服务和 Generation Gateway 在 Preflight、执行确认和 Submit 时重复校验。动态字段只允许 `string/enum/integer/number/boolean` 及正式契约规定的约束属性。

### 3. 统一生成接口

本地模型和自建适配器建议提供：

```text
POST /generate
```

请求：

```json
{
  "request_id": "req_20260615_001",
  "task_id": "task_001",
  "media_type": "image",
  "task_profile": "main_image",
  "prompt": "最终任务级 Prompt",
  "negative_prompt": "负面约束",
  "reference_assets": [
    {
      "asset_id": "asset_product",
      "role": "product",
      "position": 1,
      "url": "https://signed-url/product.png",
      "storage_key": "assets/product.png"
    },
    {
      "asset_id": "asset_model",
      "role": "model",
      "position": 2,
      "url": "https://signed-url/model.png",
      "storage_key": "assets/model.png"
    }
  ],
  "params": {
    "ratio": "3:4",
    "image_count": 4,
    "seed": 123456,
    "width": 1024,
    "height": 1536,
    "style_preset": "甜美网红风",
    "scene_preset": "室内",
    "model_name": "local-fashion-v1",
    "steps": 30,
    "cfg_scale": 7.5
  },
  "callback_url": "https://workbench.example.com/api/v1/model-callbacks/task_001",
  "metadata": {
    "product_asset_id": "product_001",
    "template_id": "tpl_001",
    "template_version": 3
  }
}
```

同步成功响应：

```json
{
  "status": "succeeded",
  "external_task_id": "local_job_001",
  "results": [
    {
      "media_type": "image",
      "url": "https://model-output/result-1.png",
      "width": 1024,
      "height": 1536,
      "seed": 123456
    }
  ],
  "usage": {
    "cost_amount": 0,
    "currency": "CNY",
    "duration_ms": 45200,
    "unit_count": 1
  },
  "raw": {}
}
```

异步受理响应：

```json
{
  "status": "queued",
  "external_task_id": "local_job_001",
  "estimated_seconds": 60
}
```

### 4. 任务查询接口

```text
GET /generate/{external_task_id}
```

响应：

```json
{
  "status": "running",
  "progress": 0.45,
  "message": "generating"
}
```

终态响应：

```json
{
  "status": "succeeded",
  "results": [
    {
      "media_type": "image",
      "url": "https://model-output/result-1.png",
      "width": 1024,
      "height": 1536,
      "seed": 123456
    }
  ],
  "usage": {
    "cost_amount": 0,
    "currency": "CNY",
    "duration_ms": 45200
  }
}
```

### 5. 回调接口

模型服务可回调工作台：

```text
POST {callback_url}
```

请求：

```json
{
  "request_id": "req_20260615_001",
  "task_id": "task_001",
  "external_task_id": "local_job_001",
  "status": "succeeded",
  "results": [
    {
      "media_type": "image",
      "url": "https://model-output/result-1.png",
      "width": 1024,
      "height": 1536,
      "seed": 123456
    }
  ],
  "usage": {
    "cost_amount": 0,
    "currency": "CNY",
    "duration_ms": 45200
  },
  "error": null
}
```

回调必须幂等。工作台按 `request_id + external_task_id` 去重。

### 6. 取消接口

可选：

```text
POST /generate/{external_task_id}/cancel
```

如果通道不支持取消，后台应在能力声明中标记 `supports_cancel: false`。

### 7. 统一状态

| 通道状态 | 工作台状态 | 说明 |
| --- | --- | --- |
| `queued` | `queued` | 已进入通道队列 |
| `running` | `generating` | 生成中 |
| `succeeded` | 根据审核配置进入待评分/待审核/已归档 | 成功 |
| `failed` | `generation_failed` | 失败 |
| `timeout` | `generation_failed` | 超时 |
| `cancelled` | `cancelled` | 取消 |

### 8. 统一错误码

| code | 是否可重试 | 用户可见提示 |
| --- | --- | --- |
| `INVALID_INPUT_IMAGE` | 否 | 输入图片不符合要求，请更换图片 |
| `PROMPT_REJECTED` | 否 | 提示词不符合模型规则，请调整描述 |
| `MODEL_BUSY` | 是 | 模型繁忙，稍后可重试 |
| `MODEL_TIMEOUT` | 是 | 生成超时，可重试或切换通道 |
| `INSUFFICIENT_BALANCE` | 否 | 模型通道余额不足，请联系管理员 |
| `RATE_LIMITED` | 是 | 调用频率过高，系统将稍后重试 |
| `OUTPUT_EMPTY` | 是 | 模型未返回媒体结果，可重试 |
| `UNKNOWN_ERROR` | 是 | 生成失败，请稍后重试 |

错误响应：

```json
{
  "status": "failed",
  "external_task_id": "local_job_001",
  "error": {
    "code": "MODEL_TIMEOUT",
    "message": "模型处理超时",
    "retryable": true,
    "raw_code": "TIMEOUT_120S"
  }
}
```

### 9. 有序参考资产规则

- 每项必须包含 `asset_id`、`role`、`position`；position 从 1 开始、唯一且连续。
- 图片任务第 1 张商品原图或套图白底图是服装事实来源。
- 风格参考、场景参考、模特/姿势参考只用于辅助生成，不可覆盖商品事实。
- `img2video` 只允许一张 `first_frame`；`reference2video` 按能力上限接收有序图组。
- 模型服务不得把参考图中的服装、配饰或背景直接复制到输出，除非该图本身是商品主体。
- 图片 URL 建议使用短期签名 URL，有效期不少于模型最大超时时间。

### 10. 成本回传

成本字段统一：

```json
{
  "usage": {
    "cost_amount": 1.2,
    "currency": "CNY",
    "unit_count": 4,
    "unit_type": "image",
    "duration_ms": 62000
  }
}
```

本地模型如果暂不计算成本，返回：

```json
{
  "cost_amount": 0,
  "currency": "CNY",
  "unit_count": 1,
  "unit_type": "local_job",
  "duration_ms": 62000
}
```

即使成本为 0，也必须记录调用次数、耗时、成功率和失败原因。

### 11. 局部重生成

如果通道支持局部修复，额外传：

```json
{
  "media_type": "image",
  "task_profile": "main_image",
  "operation": "region_revision",
  "reference_assets": [
    {
      "asset_id": "result_original",
      "role": "generation_result",
      "position": 1,
      "url": "https://signed-url/original-result.png"
    }
  ],
  "params": {
    "region_point": { "x": 0.52, "y": 0.71 },
    "region_label": "脚部",
    "lock_product": true,
    "lock_identity": true,
    "lock_background": true
  }
}
```

要求：只修复标记区域，不改变人物、服装、构图、背景和比例。

### 12. 接入验收

一个新模型通道上线前必须通过：

- 健康检查可用。
- `main_image` 至少 2 个样例成功。
- `scene_image` 至少 2 个样例成功。
- `detail_image` 至少 2 个样例成功。
- `tryon_three_view` 至少 2 个样例成功。
- 通道声明视频能力时，`img2video`、`reference2video` 各至少 2 个样例成功。
- Preflight 序列化后的参考资产顺序与 `position` 完全一致。
- 错误码能映射到工作台统一错误。
- 成本和耗时可记录。
- 不返回明文密钥、内部路径或不可访问的临时文件路径。

## 后端交付清单

后端交付至少包括：

- 可评审的数据库 schema 与 migration 方案，执行 migration 前单独确认。
- 与 `API-CONTRACT-V2.3.md` 一致的 OpenAPI 文档；实现完成后 OpenAPI 是接口实现事实源，Markdown 仍保留业务调用顺序和跨接口约束。
- 任务组、上下文快照、Prompt 快照、Preflight、执行确认和原子 Submit。
- 异步队列、Worker、重试等待、生成尝试、结果校验和审核状态流。
- Generation Gateway 的能力 Schema、Provider Adapter、健康度、成本和透明兜底。
- 五个 Skills 的内部编排、`workflow_node_runs` 记录和评估可追溯性。
- 六个关键场景的自动化测试：整组 Preflight 阻断、Prompt 修改失效、排队转重试等待、规格不符进入审核、复用结果无 attempt、视频参考图按顺序序列化。
