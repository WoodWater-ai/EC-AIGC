# 达芬奇密码 AI 素材工作台 API 契约 V2.3

状态：正式开发依据
日期：2026-07-17
产品基线：V2.3
文档职责：前后端接口、DTO、错误码、幂等与交互顺序的唯一 SSOT

本文定义正式产品化一期的 REST API 边界和交互顺序。当前 demo API 仅作参考，正式实现不继续把飞书作为主数据源。阶段 3 使用默认通道 Prompt Profile 初始化 Prompt；阶段 4 选择或切换通道时基于已确认内容方案重新编译。任何付费生成必须经过“确认内容与 Prompt -> 选择通道并加载对应 Prompt/参数 -> Preflight -> 用户确认执行 -> Submit”。

## 1. 通用约定

Base path 固定为：

```text
/api/v1
```

认证：

- 登录后使用 HttpOnly Session Cookie 或 Bearer Token。
- 管理员接口必须校验 RBAC。
- 普通员工只能访问自己创建或有权限的数据。

成功响应：

```json
{
  "data": {},
  "request_id": "req_xxx"
}
```

失败响应：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "参数不完整",
    "details": {}
  },
  "request_id": "req_xxx"
}
```

### 1.1 核心枚举

```text
TaskStatus = draft | assets_ready | asset_conflict |
  pending_product_confirmation | pending_prompt_confirmation |
  pending_execution_confirmation | queued | retry_waiting | generating |
  generation_failed | pending_aesthetic_review | pending_listing_review |
  returned | archived | cancelled

MediaType = image | video

TaskProfile = main_image | scene_image | detail_image | tryon_three_view |
  img2video | reference2video

ResultSourceType = generated | reused
ResultValidationStatus = pending | valid | spec_mismatch | validation_failed
ResultReviewStatus = pending | approved | returned | unusable | archived
```

`unusable` 和 `spec_mismatch` 不得作为 TaskStatus 返回。

## 2. 错误码

| code | HTTP | 说明 |
| --- | ---: | --- |
| `UNAUTHORIZED` | 401 | 未登录或登录过期 |
| `FORBIDDEN` | 403 | 无权限 |
| `VALIDATION_ERROR` | 400 | 参数错误 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `CONFLICT` | 409 | 状态冲突，如任务生成中不可取消 |
| `UPLOAD_LIMIT_EXCEEDED` | 400 | 批量上传超过限制 |
| `MODEL_CHANNEL_UNAVAILABLE` | 503 | 模型通道不可用 |
| `EXECUTION_CONFIRMATION_REQUIRED` | 409 | 缺少有效的付费执行确认 |
| `EXECUTION_SNAPSHOT_STALE` | 409 | Prompt、参考图、通道或参数变化，执行快照已失效 |
| `CHANNEL_CAPABILITY_MISMATCH` | 400 | 请求不符合当前通道能力 Schema |
| `PROMPT_PROFILE_NOT_FOUND` | 404 | 当前 Provider、Model 与任务 Profile 没有可用 Prompt Profile |
| `PROMPT_PROFILE_INCOMPATIBLE` | 409 | Prompt Profile 与内容方案、参考资产或能力版本不兼容 |
| `CONTENT_RECONFIRMATION_REQUIRED` | 409 | 通道能力变化影响镜头、资产或语义，必须返回阶段 3 重新确认 |
| `CHANNEL_QUEUE_BUSY` | 503 | 通道排队繁忙，任务进入重试等待或由用户决定切换 |
| `RESULT_SPEC_MISMATCH` | 422 | 实际张数、尺寸、比例或格式与执行快照不一致 |
| `GENERATION_TIMEOUT` | 504 | 生成超时 |
| `BUDGET_EXCEEDED` | 402 | 预算不足或超限 |
| `REFERENCE_ORDER_INVALID` | 400 | 参考图位置缺失、重复或不连续 |
| `PREFLIGHT_EXPIRED` | 409 | Preflight 已过期，必须重新执行 |
| `GROUP_PREFLIGHT_FAILED` | 409 | 任务组存在未通过 Preflight 的子任务 |
| `GROUP_SUBMIT_CONFLICT` | 409 | 任务组子任务不完整、状态不一致或已提交 |
| `INTERNAL_ERROR` | 500 | 未预期错误 |

## 3. 认证与账号

### `POST /auth/login`

请求：

```json
{
  "account": "zhangsan",
  "password": "******"
}
```

响应：

```json
{
  "data": {
    "user": {
      "id": "user_1",
      "name": "张三",
      "roles": ["operator"]
    }
  }
}
```

### `POST /auth/logout`

退出登录，清理会话。

### `GET /me`

返回当前用户、角色、权限点和菜单入口。

### `GET /admin/users`

管理员查询账号列表。支持 `keyword`、`role`、`status`、`page`、`page_size`。

### `POST /admin/users`

管理员创建账号。

```json
{
  "name": "张三",
  "login_account": "zhangsan",
  "initial_password": "******",
  "department": "运营",
  "role_ids": ["role_operator"],
  "status": "active"
}
```

### `PATCH /admin/users/{user_id}`

编辑部门、角色、状态、备注。

### `POST /admin/users/{user_id}/reset-password`

管理员重置密码。

## 4. 商品资产与上传

### `POST /assets/upload`

上传单个图片文件，保存到私有对象存储，返回素材文件元数据。

请求：`multipart/form-data`

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `file` | 是 | 图片 |
| `asset_type` | 是 | 素材类型 |
| `product_asset_id` | 否 | 已有商品 ID |

响应：

```json
{
  "data": {
    "asset_file": {
      "id": "asset_file_1",
      "asset_type": "product_original",
      "filename": "AR308978.png",
      "thumbnail_url": "/api/files/asset_file_1/thumbnail"
    }
  }
}
```

### `POST /assets/batch-staging`

轻量批量上传。默认上限 5 张，超出返回 `UPLOAD_LIMIT_EXCEEDED`。只进入暂存区，不直接提交生成。

请求：`multipart/form-data`

响应：

```json
{
  "data": {
    "staging_id": "stg_1",
    "items": [
      {
        "file_id": "asset_file_1",
        "filename": "top.png",
        "suggested_asset_type": "top_garment",
        "asset_type": null
      }
    ]
  }
}
```

### `PATCH /assets/batch-staging/{staging_id}`

更新暂存区素材类型、商品分组和删除项。

### `POST /assets/batch-staging/{staging_id}/commit`

确认入库，创建或更新商品资产。

### `POST /assets/scan-local-directory`

目录扫描只用于本地/内网 demo 或本机版，不应作为公网正式功能依赖。

请求：

```json
{
  "dir_path": "/local/path"
}
```

### `POST /product-assets`

手动创建商品资产。

### `GET /product-assets`

商品资产列表。支持商品名、品类、风格、归档状态、创建时间筛选。

### `GET /product-assets/{product_asset_id}`

商品详情，返回原图、套图白底图、参考图、通过图、废弃图、历史任务、成本和审核记录。

### `POST /product-assets/{product_asset_id}/extract-info`

基于商品原图或套图白底图自动识别商品信息。

请求：

```json
{
  "asset_file_id": "asset_file_1"
}
```

响应：

```json
{
  "data": {
    "category": "吊带睡裙",
    "color": "藏青色",
    "fabric": "仿真丝缎面",
    "selling_points": "V 领黑色睫毛蕾丝，垂坠顺滑",
    "forbidden_changes": ["不改颜色", "不改蕾丝位置", "不改版型"],
    "confidence": 0.86,
    "needs_manual_confirm": false
  }
}
```

### `POST /product-assets/compose-outfit`

上下装合成套图白底图。

```json
{
  "top_asset_file_id": "asset_top",
  "bottom_asset_file_id": "asset_bottom",
  "product_asset_id": "product_1"
}
```

## 4A. 模特资源库

P0 只做虚拟/授权模特参考库，不做任意联网抓取真人图片。

### `GET /model-profiles`

查询模特资源列表。支持 `keyword`、`model_type`、`license_status`、`style_tag`、`age_feel`、`category`、`task_profile`、`status`、`page`、`page_size`。

返回字段包含：参考图、模特名称、模特类型、授权状态、风格标签、年龄感、三庭五眼评分、头身比例、适用品类、使用次数、平均审美分、通过率、状态。

### `POST /model-profiles`

新增模特资源。仅设计/美工和管理员可用。

```json
{
  "name": "高级感轻熟模特 A",
  "model_type": "virtual",
  "license_status": "approved",
  "style_tags": ["高级", "轻熟"],
  "age_feel": "轻熟",
  "facial_features": {
    "face_shape": "鹅蛋脸",
    "three_part_five_eye_score": 4.6
  },
  "body_ratio": "高挑",
  "head_body_ratio": "8头身",
  "applicable_categories": ["针织衫", "连衣裙"],
  "applicable_task_profiles": ["main_image", "tryon_three_view", "reference2video"],
  "reference_assets": [
    {"asset_id": "asset_model_1", "role": "model", "position": 1}
  ],
  "source_note": "内部授权虚拟模特素材"
}
```

### `PATCH /model-profiles/{model_profile_id}`

编辑模特标签、授权状态、适用品类、启用状态。

### `POST /model-profiles/recommend`

根据商品和任务上下文推荐 2-3 个候选模特。

```json
{
  "product_asset_id": "product_1",
  "media_type": "image",
  "task_profile": "main_image",
  "style": "高级感",
  "scene": "室内影棚",
  "target_audience": "轻熟",
  "ratio": "3:4"
}
```

## 5. 任务组、生成任务与付费执行

图片和视频都先创建任务组。多选图片 Profile 时，一个任务组包含多个子任务；单图片或单视频使用一个子任务。子任务状态是执行 SSOT，任务组响应中的 `aggregate_status` 由子任务派生。

API 对应的数据对象为 `generation_task_groups`、`generation_tasks`、`generation_preflights`、`generation_execution_snapshots`、`generation_attempts` 和 `generation_results`。

### `POST /generation-task-groups`

创建任务组和子任务草稿。该接口不调用 AI Skill 或付费模型。

```json
{
  "product_asset_id": "product_1",
  "media_type": "image",
  "task_profiles": ["main_image", "scene_image", "detail_image"],
  "input_assets": [
    {"asset_id": "asset_file_1", "role": "product", "position": 1}
  ],
  "style_preset": "甜美网红风",
  "scene_preset": "室内",
  "action_preset": "自然站姿",
  "model_profile_id": "model_profile_1",
  "model_profile_selection_mode": "system_recommended",
  "template_id": "tpl_main_sweet",
  "free_description": "更偏室内高级感，保留衣服颜色"
}
```

响应返回一个任务组、按 `group_order` 排序的子任务和 `next_action: analyze_context`。`task_profiles` 不得重复；组内 `group_order` 从 1 开始连续生成。

```json
{
  "data": {
    "group": {
      "id": "group_1",
      "group_no": "G-20260714-001",
      "media_type": "image",
      "aggregate_status": "draft"
    },
    "tasks": [
      {"id": "task_main", "task_profile": "main_image", "group_order": 1, "status": "draft"},
      {"id": "task_scene", "task_profile": "scene_image", "group_order": 2, "status": "draft"},
      {"id": "task_detail", "task_profile": "detail_image", "group_order": 3, "status": "draft"}
    ],
    "next_action": "analyze_context"
  },
  "request_id": "req_1"
}
```

### `PATCH /generation-task-groups/{group_id}`

编辑尚未 Submit 的任务组共享内容或子任务列表。删除已生成结果的子任务不允许通过该接口完成。修改已确认的上游内容时，服务端按失效规则废弃下游快照。

### `POST /generation-task-groups/{group_id}/analyze-context`

由 Workflow Engine 调用 `visual-understanding`。图片任务分析商品事实；视频任务分析来源图片、角色冲突和运动风险。接口返回分析草稿、置信度、冲突和 `workflow_node_run_id`，不自动确认内容。

```json
{
  "data": {
    "analysis": {
      "product_facts": {
        "category": "睡衣套装",
        "color": "绿色",
        "fabric": "缎面",
        "forbidden_changes": ["不改颜色", "不改上下装结构"]
      },
      "source_facts": {},
      "confidence": 0.92,
      "conflicts": []
    },
    "workflow_node_run_id": "node_run_1",
    "next_action": "confirm_context"
  },
  "request_id": "req_2"
}
```

### `POST /generation-task-groups/{group_id}/confirm-context`

确认商品或来源事实，生成任务组级不可变上下文快照。

```json
{
  "product_facts": {
    "category": "睡衣套装",
    "color": "绿色",
    "fabric": "缎面",
    "forbidden_changes": ["不改颜色", "不改上下装结构"]
  },
  "source_assets": [
    {"asset_id": "asset_file_1", "role": "product", "position": 1}
  ]
}
```

图片任务确认后子任务进入 `pending_prompt_confirmation`。视频任务在素材无冲突时从 `assets_ready` 进入 `pending_prompt_confirmation`；存在冲突时保持 `asset_conflict`。

响应返回 `context_snapshot_id`、版本、确认人、确认时间和 `next_action: prepare_content`。

### `POST /generation-task-groups/{group_id}/prepare-content`

由 Workflow Engine 按子任务调用 `creative-planning` 和 `prompt-composer`，返回每个子任务的内容方案、Prompt 草稿、负面约束、参考图建议和节点运行 ID。视频任务必须读取管理员配置的默认通道，并使用其 `provider + model + task_profile + version` Prompt Profile 初始化 Prompt；该动作不调用生图或生视频 Provider。

```json
{
  "data": {
    "tasks": [
      {
        "task_id": "task_video",
        "content_plan_snapshot_id": "video_plan_1",
        "content_plan": {
          "narrative": "稳定展示商品主体并突出面料质感",
          "duration_seconds": 8,
          "shots": [
            {"order": 1, "focus": "商品主体", "action": "轻微转身", "camera": "缓慢推进"},
            {"order": 2, "focus": "面料细节", "action": "自然停留", "camera": "近景收束"}
          ]
        },
        "default_channel": {"channel_id": "channel_vidu", "model_id": "vidu-q3"},
        "prompt_profile": {
          "profile_id": "profile_vidu_q3_ref_v1",
          "code": "vidu-q3.reference2video",
          "version": "1.0.0"
        },
        "prompt_draft": "@图片1 作为首要商品主体……",
        "negative_prompt_draft": "禁止改变服装颜色、图案、版型……",
        "reference_assets": [
          {"asset_id": "asset_product", "role": "product", "business_role": "attract", "visual_role": "product", "position": 1}
        ],
        "workflow_node_run_ids": ["node_plan_1", "node_prompt_1"]
      }
    ],
    "next_action": "confirm_prompts"
  },
  "request_id": "req_3"
}
```

### `POST /generation-task-groups/{group_id}/confirm-prompts`

一次确认任务组中全部子任务的内容和 Prompt，生成同一个 `confirmation_batch_id` 下的独立 Prompt 快照。请求必须包含任务组全部有效子任务。

```json
{
  "tasks": [
    {
      "task_id": "task_main",
      "content_plan": {"shot": "正面商品主图"},
      "prompt": "成年模特展示绿色小爱心缎面睡衣套装……",
      "negative_prompt": "禁止改变服装颜色、图案、版型……",
      "reference_assets": [
        {"asset_id": "asset_product", "role": "product", "position": 1},
        {"asset_id": "asset_model", "role": "model", "position": 2}
      ]
    }
  ]
}
```

`position` 从 1 开始，并在同一子任务的参考图清单内唯一且连续。服务端按 `position` 升序保存和序列化。修改上下文、Prompt 或参考资产后，既有 Preflight 和执行确认全部失效。

响应返回 `confirmation_batch_id`、逐子任务 `content_plan_snapshot_id`、默认通道 `prompt_snapshot_id`、Prompt Profile、版本和 `next_action: select_channel`。视频镜头数量按时长和内容复杂度生成：5s 默认 1 镜头、8s 默认 1-2 镜头、15/16s 默认 2-3 镜头，不固定三段。

### `GET /model-channels?media_type=image|video&task_profile={profile}`

返回当前任务可用通道、推荐原因、健康度、预计排队情况和能力版本。普通用户看不到密钥或内部鉴权配置。

```json
{
  "data": [
    {
      "channel_id": "channel_agnes_image",
      "channel_name": "Agnes Image",
      "is_default": true,
      "models": [{"model_id": "agnes-image-2.1-flash", "name": "Agnes Image 2.1 Flash"}],
      "capability_version": "2026-07-13",
      "prompt_profile": {"code": "agnes-image.main_image", "version": "1.0.0"},
      "health": "healthy",
      "estimated_wait_ms": 30000,
      "recommendation_reason": "支持当前任务组全部 Profile"
    }
  ],
  "request_id": "req_4"
}
```

### `GET /model-channels/{channel_id}/capabilities?task_profile={profile}`

返回动态参数 Schema、参考图限制、支持的比例/分辨率/时长/张数、参数依赖和成本规则。

```json
{
  "data": {
    "channel_id": "channel_agnes_image",
    "capability_version": "2026-07-13",
    "media_types": ["image"],
    "task_profiles": ["main_image", "scene_image", "detail_image"],
    "prompt_profile": {
      "profile_id": "profile_agnes_main_v1",
      "code": "agnes-image.main_image",
      "version": "1.0.0",
      "compatible": true
    },
    "parameter_schema": {
      "schema_version": 1,
      "fields": [
        {
          "key": "ratio",
          "label": "比例",
          "type": "enum",
          "required": true,
          "default": "4:5",
          "options": ["1:1", "4:5"]
        },
        {
          "key": "image_count",
          "label": "张数",
          "type": "integer",
          "required": true,
          "default": 1,
          "min": 1,
          "max": 4,
          "step": 1,
          "unit": "张",
          "visible_when": null
        }
      ]
    },
    "reference_constraints": {
      "min": 1,
      "max": 2,
      "max_bytes_each": 10485760,
      "allowed_roles": ["product", "model", "style", "scene", "detail", "pose"],
      "ordered": true
    }
  }
}
```

一期动态字段只允许 `string`、`enum`、`integer`、`number`、`boolean` 类型，并支持 `required/default/options/min/max/step/unit/visible_when`。前端按 `fields` 数组顺序渲染，不允许 Provider 下发任意组件代码。

### `POST /generation-task-groups/{group_id}/compile-prompts-for-channel`

阶段 4 选择或切换通道时调用。服务端读取已确认内容方案和参考资产，按目标 `provider + model + task_profile` Prompt Profile 重新编译逐子任务 Prompt，并返回与阶段 3 已确认 Prompt 的差异。该接口不调用付费 Provider。

```json
{
  "model_channel_id": "channel_vidu",
  "model_id": "vidu-q3",
  "capability_version": "2026-07-16",
  "base_confirmation_batch_id": "prompt_batch_3",
  "idempotency_key": "group_1:channel_vidu:prompt_batch_3"
}
```

```json
{
  "data": {
    "compilation_batch_id": "compile_batch_4",
    "model_channel_id": "channel_vidu",
    "model_id": "vidu-q3",
    "capability_version": "2026-07-16",
    "compatibility_status": "syntax_only",
    "requires_content_reconfirmation": false,
    "tasks": [
      {
        "task_id": "task_video",
        "compiled_prompt_snapshot_id": "prompt_snapshot_vidu_4",
        "prompt_profile": {
          "profile_id": "profile_vidu_q3_ref_v1",
          "code": "vidu-q3.reference2video",
          "version": "1.0.0"
        },
        "compiled_prompt": "@图片1 作为商品主体，镜头缓慢推进……",
        "diff": {
          "summary": "增加 Vidu 图片强调与规划切镜语法，内容语义未变化",
          "changed_sections": ["image_binding", "shot_syntax"]
        },
        "warnings": []
      }
    ],
    "next_action": "preflight"
  },
  "request_id": "req_compile_4"
}
```

`compatibility_status` 固定为：

- `unchanged`：通道和 Profile 未变化，可继续阶段 4。
- `syntax_only`：仅 Provider 语法或图片映射变化，保留阶段 3 内容确认；前端展示差异后继续阶段 4。
- `content_revision_required`：能力差异影响镜头数量、参考资产、动作幅度或内容语义；不创建可用于 Preflight 的编译快照，返回 `requires_content_reconfirmation=true`，前端必须引导返回阶段 3。

找不到可用 Profile 返回 `PROMPT_PROFILE_NOT_FOUND`；Profile 与能力版本不兼容返回 `PROMPT_PROFILE_INCOMPATIBLE`。前端不得静默沿用上一通道 Prompt。

编译请求按 `group_id + idempotency_key` 幂等。同一键且输入指纹一致时返回原有效编译批次；同一键但通道、模型、能力版本或基础确认批次不同则返回 `CONFLICT`。

### `POST /generation-task-groups/{group_id}/preflight`

对任务组全部子任务执行无付费预检。服务端为每个子任务创建独立 Preflight 记录，并返回组级汇总；默认 10 分钟过期。

```json
{
  "model_channel_id": "channel_agnes_image",
  "model_id": "agnes-image-2.1-flash",
  "capability_version": "2026-07-13",
  "prompt_compilation_batch_id": "compile_batch_agnes_4",
  "parameters": {
    "ratio": "4:5",
    "image_count": 4,
    "quality": "standard"
  },
  "fallback_policy": {
    "mode": "stop_and_ask",
    "max_attempts": 1,
    "fallback_channel_id": null,
    "triggers": []
  }
}
```

请求中的参数和兜底策略为组级共享配置；Prompt 快照、有序参考资产和最终通道编译结果由服务端读取当前有效版本。视频任务必须具有与目标通道、模型、任务 Profile 和能力版本一致的编译批次。响应返回逐子任务校验、脱敏请求预览、健康快照、预计成本/耗时和组汇总，不创建 Provider 任务。

```json
{
  "data": {
    "preflight_batch_id": "preflight_batch_3",
    "valid": true,
    "expires_at": "2026-07-14T20:10:00+08:00",
    "summary": {
      "estimated_total_cost": {"amount": 9.6, "currency": "CNY"},
      "estimated_duration_range_ms": {"min": 120000, "max": 300000},
      "channel_health": "healthy",
      "queue_depth": 2
    },
    "tasks": [
      {
        "task_id": "task_main",
        "preflight_id": "preflight_main_3",
        "valid": true,
        "request_fingerprint": "sha256:main",
        "request_preview": {
          "model": "agnes-image-2.1-flash",
          "ratio": "4:5",
          "image_count": 4,
          "reference_assets": [
            {"asset_id": "asset_product", "role": "product", "position": 1},
            {"asset_id": "asset_model", "role": "model", "position": 2}
          ]
        },
        "estimated_cost": {"amount": 3.2, "currency": "CNY"},
        "estimated_duration_range_ms": {"min": 40000, "max": 100000},
        "warnings": [],
        "errors": []
      }
    ]
  }
}
```

任一子任务 `valid = false` 时组级 `valid = false`，`confirm-execution` 必须返回 `GROUP_PREFLIGHT_FAILED`。Preflight 过期，或内容方案、最终编译 Prompt、Prompt Profile、参考图、通道、参数、能力版本、兜底策略任一变化后，原 Preflight 必须失效并重新执行。

### `POST /generation-task-groups/{group_id}/confirm-execution`

用户确认整组有效 Preflight 后，为每个子任务生成同一个 `confirmation_batch_id` 下的执行快照。

```json
{
  "preflight_batch_id": "preflight_batch_3",
  "confirmed": true
}
```

响应返回 `confirmation_batch_id`、逐子任务 `execution_snapshot_id` 和用户确认摘要。该接口不创建 Provider 任务。

```json
{
  "data": {
    "confirmation_batch_id": "confirmation_batch_3",
    "tasks": [
      {"task_id": "task_main", "execution_snapshot_id": "execution_main_3"}
    ],
    "confirmed_at": "2026-07-14T20:02:00+08:00",
    "next_action": "submit"
  },
  "request_id": "req_5"
}
```

### `POST /generation-task-groups/{group_id}/submit`

只有携带仍有效的组级执行确认才允许提交。服务端在单个数据库事务内校验并创建所有初始 attempt、写入全部队列任务和更新子任务状态；全量成功或全部回滚。

```json
{
  "confirmation_batch_id": "confirmation_batch_3",
  "idempotency_key": "group_1:confirmation_batch_3"
}
```

Submit 必须验证：任务组完整性、全部内容方案和 Prompt 快照有效、最终通道编译批次与 Prompt Profile 匹配、全部 Preflight 未过期且已确认、能力版本未失效、预算允许、幂等键有效。重复幂等键返回首次提交结果，不重复创建 attempt 或计费；同一键对应不同确认批次时返回 `GROUP_SUBMIT_CONFLICT`。通道临时不可用时，仅能执行用户已确认且已完成目标 Profile 重新编译与 Preflight 的兜底策略，否则拒绝提交并要求重新 Preflight。

```json
{
  "data": {
    "group_id": "group_1",
    "aggregate_status": "queued",
    "tasks": [
      {"task_id": "task_main", "status": "queued", "attempt_id": "attempt_main_1"},
      {"task_id": "task_scene", "status": "queued", "attempt_id": "attempt_scene_1"},
      {"task_id": "task_detail", "status": "queued", "attempt_id": "attempt_detail_1"}
    ],
    "submitted_at": "2026-07-14T20:03:00+08:00"
  },
  "request_id": "req_6"
}
```

### `GET /generation-task-groups/{group_id}`

返回任务组、派生 `aggregate_status`、五步确认状态、组级成本汇总和按 `group_order` 排序的子任务。

### `GET /generation-tasks`

任务列表。支持 `task_group_id`、`status`、`media_type`、`task_profile`、风格、场景、模型通道、模板、创建人、创建时间筛选。

### `GET /generation-tasks/{task_id}`

任务详情，返回输入素材、快照、Prompt、图片或视频结果、审核记录、成本和时间线。

### `GET /generation-tasks/{task_id}/results`

返回统一 `GenerationResult` 列表，支持 `source_type`、`review_status`、`validation_status` 筛选。

### `POST /generation-tasks/{task_id}/cancel`

草稿、待确认、排队中可取消；生成中取消需要 Worker 和 Provider 支持。

### `POST /generation-tasks/{task_id}/retry`

创建新的生成尝试。若 Prompt、参考图、通道或参数变化，必须重新确认 Prompt、重新预检并生成新的执行快照。

```json
{
  "reason": "颜色不准，按审核意见重试",
  "execution_snapshot_id": "execution_snapshot_4",
  "retry_mode": "changed_config"
}
```

### `GET /generation-tasks/{task_id}/attempts`

返回每次提交、排队、重试、通道切换和失败的独立记录。旧资产复用时必须返回 `source_type: reused`，不得作为新尝试成功结果。

### `POST /generation-tasks/{task_id}/reuse-asset`

用户显式把历史资产或结果作为本任务结果复用。

```json
{
  "source_asset_file_id": "asset_history_1",
  "source_result_id": null,
  "reason": "复用已审核通过的同款主图"
}
```

服务端创建 `source_type = reused`、`generation_attempt_id = null`、`cost_amount = 0` 的结果记录，不创建 Provider 成功 attempt。

### `GET /generation-tasks/{task_id}/events`

查询任务时间线，用于详情页和状态追踪。

## 6. 统一生成结果与审核

### `GET /generation-results/{result_id}`

返回图片或视频结果详情、来源血缘、规格校验、生成 attempt、成本和审核记录。

### `POST /generation-results/{result_id}/aesthetic-review`

审美评分。

```json
{
  "score": 4,
  "dimension_scores": {
    "subject_accuracy": 4,
    "style_consistency": 5,
    "composition": 4,
    "texture": 4,
    "commercial_usability": 4
  },
  "labels": ["color_inaccurate"],
  "comment": "整体可用，颜色略偏亮"
}
```

### `POST /generation-results/{result_id}/listing-review`

上架审核。

```json
{
  "conclusion": "approved",
  "labels": [],
  "comment": "可归档"
}
```

### `POST /generation-results/{result_id}/archive`

归档通过的图片或视频结果，进入商品素材资产。`validation_status = spec_mismatch` 的结果禁止自动归档，必须先有人工审核结论。

### `POST /generation-results/{result_id}/revise-region`

仅图片结果支持局部重生成；视频结果调用返回 `CHANNEL_CAPABILITY_MISMATCH`。

```json
{
  "region_point": { "x": 0.52, "y": 0.71 },
  "region_label": "脚部",
  "issue_description": "脚趾融合",
  "revision_goal": "只修复脚部，保持人物、服装和背景不变"
}
```

## 7. Prompt 模板

### `GET /prompt-templates`

支持模板类型、任务 Profile、风格、场景、启用状态筛选。

### `POST /prompt-templates`

设计/美工或管理员创建模板。

### `PATCH /prompt-templates/{template_id}`

编辑全局模板，必须生成新版本。

### `GET /prompt-templates/{template_id}/versions`

查看版本历史和引用任务。

### `POST /prompt/preview`

根据已确认商品事实、拍摄内容和参考资产生成任务级 Prompt 预览。比例、分辨率、张数、时长和通道参数由执行配置接口管理，不以 Prompt 预览接口作为提交依据。

该接口用于独立预览和图片模板调试。正式视频五步流程必须使用 `prepare-content` 获取默认通道初始化 Prompt，并在阶段 4 使用 `compile-prompts-for-channel` 获取最终通道编译结果；不得用本接口替代通道 Profile 编译。

```json
{
  "product_asset_id": "product_1",
  "media_type": "image",
  "task_profile": "main_image",
  "style_preset": "甜美网红风",
  "scene_preset": "室内",
  "reference_assets": [
    {"asset_id": "asset_product", "role": "product", "position": 1},
    {"asset_id": "asset_model", "role": "model", "position": 2}
  ],
  "template_id": "tpl_main_sweet",
  "free_description": "更偏高级感"
}
```

## 8. 模型通道

业务侧读取接口使用 `GET /model-channels` 和 `GET /model-channels/{channel_id}/capabilities`；以下接口仅供管理员维护通道配置。

### `GET /admin/model-channels`

管理员查询模型通道。

### `POST /admin/model-channels`

新增模型通道。API Key 只保存 secret 引用，不返回明文。

### `PATCH /admin/model-channels/{channel_id}`

启停通道、调整预算、超时、重试和成本规则。

### `POST /admin/model-channels/{channel_id}/test`

使用测试 Prompt 和测试图片验证通道可用性。

## 9. AI 助手

### `POST /assistant/sessions`

创建任务上下文内的轻量助手会话。

### `POST /assistant/sessions/{session_id}/messages`

发送消息。助手只能输出建议，不能自动提交生成、不能修改全局模板、不能改变审核结论。

```json
{
  "message": "更偏室内高级感，保留衣服颜色"
}
```

响应：

```json
{
  "data": {
    "reply": "建议加强室内自然光和高级居家场景...",
    "suggested_actions": [
      {
        "type": "apply_to_task_prompt",
        "label": "应用到本次 Prompt",
        "payload": {
          "append_text": "室内高级居家场景，自然柔光，保留商品原始颜色"
        }
      }
    ]
  }
}
```

### `POST /assistant/actions/{action_id}/apply`

用户确认后应用建议。

## 10. 数据复盘

### `GET /dashboard/summary`

首页指标：本周任务数、上架通过率、平均生成耗时、模型消耗、待办数。

### `GET /analytics/tasks`

任务效率、质量、成本、资产沉淀指标。支持时间、任务类型、风格、场景、模型通道、模板、员工筛选。

## 11. Demo API 参考

现有 demo API 仍可用于理解已跑通链路：

| Demo API | 用途 | 正式产品对应 |
| --- | --- | --- |
| `/api/lark/workflow-record` | 读取飞书记录和提示词 | 正式任务详情/Prompt 预览 |
| `/api/workflow/run` | 上传并写飞书后生成 | 正式素材上传 + 任务创建 + 队列 |
| `/api/workflow/generate-from-record` | 从飞书记录生图 | 正式 Worker 调用模型通道 |
| `/api/workflow/revise-generated` | 局部重生成 | 正式生成图局部修复 |
| `/api/relay/generate` | 直调中转站 | 正式 Generation Gateway |
| `/api/vision/name-images` | 图片命名 | 正式商品信息识别的一部分 |

## 12. Demo 爆款视频复刻 API

### `POST /api/vidu/trending-replicate/analyze`

请求为 `multipart/form-data`：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `video` / `videoUrl` | 二选一 | mp4/mov 文件或可直接访问的视频 URL |
| `assets` | 是 | 1-7 张素材的 JSON 清单，包含 `fileKey/url/role/name` |
| `assetFile{n}` | 按清单 | 本地参考图片文件 |
| `goal` | 否 | 用户的复刻目标 |
| `settings` | 否 | 现有工作台设置，用于调用多模态分析模型 |

返回 `sessionId`、视频元数据、关键帧、分镜、爆点、替换策略、风险和最终 Prompt。

### `POST /api/vidu/trending-replicate`

```json
{
  "sessionId": "tr-xxx",
  "prompt": "复刻原视频镜头结构...",
  "aspectRatio": "9:16",
  "resolution": "1080p",
  "removeAudio": false,
  "videoChannelId": "default-vidu",
  "settings": {},
  "dryRun": false
}
```

服务端将会话中的本地文件转换为 Vidu 支持的 Data URI，检查完整 JSON 请求体不超过 19MB，再调用 `POST /ent/v2/trending-replicate`。任务查询继续使用 `/api/vidu/creations/{taskId}`。

## 13. 后端内部 Skill 执行契约

浏览器不调用 `/skills/run`。Workflow Engine 在 `analyze-context`、`prepare-content`、质量评估和重试建议阶段使用以下内部包络，并将每次执行写入 `workflow_node_runs`。

```json
{
  "skill": "prompt-composer",
  "version": "1.0.0",
  "task_group_id": "group_1",
  "task_id": "task_main",
  "input": {},
  "context": {
    "context_snapshot_id": "context_1",
    "prompt_template_version_id": "ptv_1",
    "content_plan_snapshot_id": "video_plan_1",
    "model_channel_id": "channel_vidu",
    "model_id": "vidu-q3",
    "prompt_profile": "vidu-q3.reference2video@1.0.0",
    "reference_assets": [
      {"asset_id": "asset_product", "role": "product", "business_role": "attract", "visual_role": "product", "position": 1}
    ],
    "task_profile": "reference2video"
  },
  "options": {
    "locale": "zh-CN",
    "idempotency_key": "task_main:prompt-composer:1"
  }
}
```

统一输出：

```json
{
  "status": "succeeded",
  "output": {},
  "warnings": [],
  "diagnostics": {},
  "metrics": {
    "duration_ms": 1200,
    "input_tokens": 0,
    "output_tokens": 0,
    "estimated_cost": 0
  },
  "trace_id": "trace_1"
}
```

约束：Skill 只输出结构化建议，不确认业务数据、不选择通道、不提交 Provider、不自动重试。Workflow Engine 校验输出后写入新快照或节点记录；同一幂等键不得重复产生业务副作用。
