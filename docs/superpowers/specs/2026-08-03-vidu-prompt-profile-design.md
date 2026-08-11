# Vidu Prompt Profile 与参考素材编译设计

日期：2026-08-03；状态：待评审；读者：前端、后端、Workflow / Provider Adapter 工程师
范围：图片生成、首帧生视频、多参考生视频、Vidu 爆款复刻的 Prompt 编译与参考素材传递

## 1. 结论

当前图片任务页的“AI 建议”只在浏览器中拼接文本，参考图没有进入最终生成请求。因此，不能用“Prompt 中提到第 N 张参考图”替代真正的多模态输入。

本方案的核心是：浏览器只提交有序的素材 ID、角色和标签；后端将它们冻结为任务快照；Workflow 生成通道共性内容；目标 Provider 的 Prompt Profile 最后编译为 Provider 专有 Prompt 与图片数组。浏览器不直接调用 Vidu，也不上传 Base64 到 Vidu。

```text
素材选择 + 标签 + 用户创意
  -> 任务组上下文快照
  -> 通道共性内容方案 / 用户确认 Prompt
  -> Vidu Prompt Profile 编译
  -> Preflight / 执行快照
  -> Vidu Adapter: video_url + images[] + compiled prompt
```

该分层遵守现有约束：Vidu 专有图片编号、镜头语法和音频规则只存在于后端 `channel_prompt_profiles`，不得写进模板中心的通用模板或浏览器拼接逻辑。

## 2. 范围与边界

### 2.1 本次覆盖

| 业务能力 | Profile / 模式 | 关键输入 |
| --- | --- | --- |
| 图片生成 | `image.ecommerce-reference` | 商品主体、多参考图、风格/场景/姿势标签 |
| 首帧生视频 | `vidu-q3.img2video` | 一张首帧、动作/镜头/节奏 |
| 多参考生视频 | `vidu-q3.reference2video` | 首帧加商品/人物/场景/风格/动作参考 |
| 爆款复刻 | `vidu-q3.trending-replicate` | 源视频、多张替换图、复刻范围、音频设置 |

`image.ecommerce-reference` 是通道无关的图片内容 Profile。本文不假定 Vidu 的图片生成接口；最终由被选中的图片 Provider Adapter 按自身能力绑定参考图。

### 2.2 不做

- 前端直连 `https://api.vidu.cn`、持有 Vidu Token 或传送 Base64。
- 让用户手工填写“图 1 / 图 2”的编号。
- 用 URL、文件名或展示顺序代替素材 ID 和执行快照。
- 将 Vidu 专有语法写进通用视频模板。

## 3. 需先确认的契约缺口

当前正式 API 契约的 `TaskProfile` 枚举只列出 `img2video` 与 `reference2video`，但 PRD 和现有前端类型已经包含 `trending_replicate`。Vidu 的复刻接口又需要源视频和与普通参考生视频不同的参数。

实施前应将 `trending_replicate` 补入正式 `TaskProfile`、模型能力和 Prompt Profile 映射；不要把它伪装成 `reference2video`，否则通道能力、Preflight、执行快照和成本核验无法准确表达源视频与音频选项。

该改动属于正式 API 契约变更，需要由前后端共同评审后更新 `docs/product/API-CONTRACT-V2.3.md`，本文件不直接替代正式契约。

## 4. 统一输入模型

### 4.1 参考素材

浏览器和 API 使用的最小模型如下。`position` 在同一任务中从 1 开始连续且唯一；用户调整角色、顺序、标签或素材时，已有内容方案、Prompt 编译、Preflight 和执行确认全部失效。

```ts
type ReferenceRole =
  | 'first_frame'
  | 'product'
  | 'model'
  | 'garment'
  | 'scene'
  | 'style'
  | 'pose'
  | 'detail';

interface OrderedReferenceAsset {
  assetId: string;
  role: ReferenceRole;
  position: number;
}

interface VisualTags {
  styleId?: string;
  sceneId?: string;
  poseId?: string;
}
```

前端可额外保存缩略图、名称、资源来源和 `fileResourceId` 以供展示，但提交、快照和 Provider 调用只以服务端可解析的 `assetId` 为准。

### 4.2 角色优先级

| 角色 | 控制对象 | 优先级 | 说明 |
| --- | --- | ---: | --- |
| `product` / `garment` | 颜色、图案、材质、版型、结构、可见品牌 | 1 | 与其他输入冲突时优先保真 |
| `first_frame` | 开场构图、人物位置、场景、初始光线 | 2 | 仅视频模式使用，必须唯一 |
| `model` | 外貌、体型、发型、人物气质 | 3 | 不覆盖商品事实 |
| `scene` | 场地、布景、光线环境 | 4 | 仅在明确替换场景时强约束 |
| `style` | 色调、摄影语言、质感 | 5 | 不改变实体商品 |
| `pose` | 起始姿态、动作幅度、构图 | 6 | 不得导致商品被遮挡 |
| `detail` | 局部工艺、配件、纹理 | 7 | 只补充指定局部 |

这里的优先级用于冲突消解和 Prompt 编译，不等于 `images[]` 的固定位置。Provider 图片数组位置必须由每个 Profile 的 `image_mapping_rules` 输出。

### 4.3 标签与用户可编辑字段

标签以 ID 持久化，再由标签字典映射为描述文本；不要只把中文标签拼进 Prompt。字段分为三类：

| 类别 | 字段 | 编辑权限 |
| --- | --- | --- |
| 预制且不可编辑 | 图片绑定、素材编号、优先级、商品保真、负面约束、Provider 语法 | 系统 / Profile |
| 结构化可编辑 | 风格、场景、姿势、动作、镜头、节奏、替换目标、比例、分辨率、质量、是否去音频 | 用户控件 |
| 自由文本可编辑 | `user_instruction`，如“更高级、镜头推进更慢” | 用户 |

标签更新后的 Profile 编译输入示例：

```json
{
  "visual_tags": {
    "style_id": "QUIET_LUXURY",
    "scene_id": "QUIET_WINDOW",
    "pose_id": "NATURAL_STAND"
  },
  "user_instruction": "突出缎面垂感，镜头推进要克制",
  "locked_attributes": ["不改颜色", "不改蕾丝位置", "不改版型"]
}
```

## 5. Prompt 编译约定

每个 Profile 由以下片段组成。`系统片段` 和 `参考图绑定` 不向用户提供自由编辑入口；AI 建议只生成新的候选 `用户创意` 或通道共性内容，必须由用户确认后覆盖。

```text
最终 Prompt =
  系统片段
  + 参考图绑定片段
  + 标签编译片段
  + 商品 / 来源事实片段
  + 用户创意片段
  + 保真与负面约束片段
```

编译器必须满足：

1. 只为实际存在的参考图生成绑定行，不输出空占位符。
2. `图 N` 取 Provider 最终 `images[]` 的索引，而不是界面槽位编号。
3. 用户手工编辑过 Prompt 时，素材或标签变化只返回候选建议，不得静默覆盖。
4. 执行时 Adapter 只能读取执行快照内冻结的 `compiled_prompt` 与有序参考资产。

## 6. Profile 模板

### 6.1 图片生成：`image.ecommerce-reference`

适用于商品主图、场景图、细节图和模特上身图。`image_type` 决定预制镜头句，其他内容共享。

**预制骨架**

```text
【任务目标】
为电商生成 {{image_type_instruction}}。主体为“{{product_name}}”，画面真实、清晰、可用于商品展示。

【参考图绑定】
{{image_reference_bindings}}

【视觉参数】
摄影风格：{{style_prompt}}。
场景：{{scene_prompt}}。
姿势或构图：{{pose_prompt}}。

【商品事实与保真】
商品事实：{{product_facts}}。
必须保持：{{locked_attributes}}。
不得新增未提供的商品、文字、Logo 或配饰；不得改变商品颜色、图案、版型、材质和关键工艺。

【用户创意补充】
{{user_instruction}}
```

**`image_type_instruction` 映射**

| 图片类型 | 预制句 |
| --- | --- |
| `main_image` | 商品完整居中，背景低干扰，轮廓、材质和细节清晰可辨。 |
| `scene_image` | 商品为画面中心，场景仅服务于氛围、尺度和使用感。 |
| `detail_image` | 微距聚焦 {{detail_focus}}，背景干净虚化，细节必须可核验。 |
| `tryon_three_view` | 相同人物、光线和机位展示正面、侧面、背面；手部不得遮挡商品关键结构。 |

**参考图绑定示例**

```text
图1为商品主体，仅用于锁定颜色、图案、材质、版型、结构和可见品牌信息。
图2为模特参考，仅用于锁定人物外貌、体型和发型，不得改变图1商品。
图3为场景参考，仅用于锁定空间、布景和光线。
```

### 6.2 首帧生视频：`vidu-q3.img2video`

约束：仅一张 `first_frame`，也是 Provider `images[0]`。如用户需要额外人物、场景或姿势控制，前端必须切换为 `reference2video`，不能在本模式悄悄附加参考图。

**预制骨架**

```text
【首帧锚定】
图1为唯一首帧和商品主体基准。首帧中的人物、商品、构图、光线和场景必须稳定延续。

【视频运动】
动作：{{motion_prompt}}。
镜头：{{camera_prompt}}。
节奏：{{rhythm_prompt}}。
目标时长：{{duration_seconds}} 秒。

【视觉与保真】
风格：{{style_prompt}}。场景：{{scene_prompt}}。姿势：{{pose_prompt}}。
保持商品颜色、图案、材质、版型和关键细节不变；运动自然连续，避免服装漂移、人物变形、闪烁、镜头跳变和错误文字。

【用户创意补充】
{{user_instruction}}
```

### 6.3 多参考生视频：`vidu-q3.reference2video`

约束：恰好一张 `first_frame`，至少一张额外参考图；数组数量、允许角色和时长由当前通道 capability 决定。

**预制骨架**

```text
【参考图职责】
{{video_reference_bindings}}

【优先级】
商品真实性优先于人物、场景和风格。人物与商品冲突时以商品参考为准；未指定替换的画面元素保持自然一致。

【视频创作参数】
风格：{{style_prompt}}。
场景：{{scene_prompt}}。
姿势：{{pose_prompt}}。
动作：{{motion_prompt}}。
镜头：{{camera_prompt}}。
节奏：{{rhythm_prompt}}。

【稳定性约束】
人物身份、服装和商品在全片中保持一致。避免身份漂移、服装变化、商品变形、闪烁、跳帧、错误文字和不连续动作。

【用户创意补充】
{{user_instruction}}
```

**参考图绑定示例**

```text
图1为首帧，锁定开场构图、人物位置、场景和初始光线。
图2为商品参考，锁定商品颜色、图案、材质、版型和细节。
图3为人物参考，锁定人物外貌、体型、发型和整体气质。
图4为姿势参考，仅锁定起始姿态和动作幅度。
```

### 6.4 爆款复刻：`vidu-q3.trending-replicate`

源视频负责镜头、人物动作、剪辑节奏、叙事结构和时长；图片负责替换明确指定的主体。该 Profile 与用户提供的 Vidu `POST /ent/v2/trending-replicate` 对齐。

**预制骨架**

```text
【复刻范围】
以原视频为唯一的镜头、运镜、人物动作、剪辑节奏、时长和叙事结构依据。
除下方明确指定的替换内容外，其他画面保持原视频逻辑不变。

【图片绑定】
{{trending_reference_bindings}}

【替换规则】
将原视频中的 {{replacement_targets}} 替换为对应参考图内容。
商品真实性优先于原视频中的原商品；人物身份以人物参考图为准；仅在存在场景参考图且用户选择替换场景时替换场景。
不得改变原视频的镜头语言、动作节奏、剪辑结构和未指定替换的主体。

【标签参数】
风格倾向：{{style_prompt}}。
场景倾向：{{scene_prompt}}。
动作限制：{{pose_prompt}}。

【质量约束】
人物、服装和商品在全片中保持一致；避免身份漂移、服装变化、商品变形、闪烁、跳帧、错误文字和不连续动作。

【用户创意补充】
{{user_instruction}}
```

**动态图片绑定规则**

图片数组不使用固定的“图 1 永远是场景”规则。由编译器按本次实际选择的替换目标产生。示例：

```text
图1：商品替换图。替换原视频中的商品，锁定颜色、图案、材质、版型和细节。
图2：人物替换图。替换原视频中的人物外貌、体型、发型和气质。
图3：场景替换图。仅替换场景布景与光线，保留原视频镜头与节奏。
```

若用户只上传商品和人物，Prompt 只能生成图 1、图 2 两行，不得出现不存在的场景图。

## 7. Vidu Trending Replicate Adapter

### 7.1 请求映射

Adapter 从执行快照读取输入，绝不读取浏览器临时状态。最终调用：

```http
POST https://api.vidu.cn/ent/v2/trending-replicate
Content-Type: application/json
Authorization: Token {server-side-secret}
```

```json
{
  "video_url": "{{provider_accessible_source_video_url}}",
  "images": [
    "{{provider_accessible_reference_url_1}}",
    "{{provider_accessible_reference_url_2}}"
  ],
  "prompt": "{{execution_snapshot.compiled_prompt}}",
  "quality": "{{fast_or_standard}}",
  "aspect_ratio": "{{1:1|16:9|9:16|4:3|3:4}}",
  "resolution": "{{540p|720p|1080p}}",
  "remove_audio": false,
  "callback_url": "{{backend_public_https_callback_url}}"
}
```

映射规则：

| Vidu 字段 | 执行快照来源 | 校验 |
| --- | --- | --- |
| `video_url` | 已授权的源视频资产 | MP4/MOV，5-180 秒 |
| `images` | 按 Profile 映射后的有序参考资产 | 1-7 张，PNG/JPEG/JPG/WebP，单图不超过 50 MB，比例 1:4-4:1 |
| `prompt` | `compiled_prompt` | 最多 2000 字符 |
| `quality` | 动态参数 | `fast` 或 `standard`，默认 `standard` |
| `aspect_ratio` | 动态参数 | Vidu 枚举之一，默认 `16:9` |
| `resolution` | 动态参数 | `540p`、`720p`、`1080p`，默认 `1080p` |
| `remove_audio` | 动态参数 | `true` 删除，`false` 保留原音 |
| `callback_url` | 后端配置 | 公网 HTTPS，浏览器不可传入 |

### 7.2 URL 与 Base64 策略

优先给 Vidu 传由对象存储生成的、可被 Provider 读取的短期 URL。只有 Provider 无法访问 URL 时，Adapter 才将服务端私有文件转为 `data:video/mp4;base64,...` 或 `data:image/png;base64,...`。

浏览器不得参与该转换。现有 demo 契约还限制内部转发 JSON 不超过 19 MB，即使 Vidu 本身允许更大的文件，也必须在 Preflight 提前拒绝或改用可访问 URL，不能等到 Submit 失败。

### 7.3 回调与状态映射

| Vidu 回调状态 | 内部处理 |
| --- | --- |
| `processing` | 更新 attempt 为 `generating`，记录 Provider task ID 和原始状态 |
| `success` | 下载结果至私有存储，创建 `generation_result`，进入既定审核状态 |
| `failed` | 写入脱敏失败原因，任务进入 `generation_failed` 或既定重试策略 |

回调必须校验请求来源或签名（以 Vidu 实际回调安全能力为准），并以 Provider task ID 幂等处理。重复 `success` 回调不得重复创建结果或计费记录。

## 8. 前后端实施分工

### 前端

1. 参考图状态保存真实 `assetId`、`role`、`position`，缩略图只用于展示。
2. 资源选择后可由 `analyze-context` 返回标签建议；用户确认标签或点击 AI 建议后调用 `prepare-content`，展示候选而非静默覆盖手工 Prompt。
3. 点击“生成”时提交全部子任务的有序 `reference_assets`；确认 Prompt 后按正式五阶段进入通道编译、Preflight、费用确认和 Submit。
4. 依据 capability 的 `reference_constraints` 限制实际可送入的数量和角色。UI 有五个槽位不代表可将五张都提交。
5. 执行确认弹窗展示“图 N - 角色 - 素材名称”的请求摘要，任务详情展示执行快照中的参考图，便于复盘。

### 后端与 Workflow

1. 扩展/确认 `trending_replicate` 的正式任务 Profile、能力 Schema 和 Profile Registry 映射。
2. 保存上下文快照、通道共性内容方案快照、Prompt 快照、编译批次、Preflight 与执行快照；所有快照存储 `{asset_id, role, position}`。
3. `analyze-context` 读取主体和参考图，产出商品事实、冲突和风格/场景/姿势标签建议。
4. `prepare-content` 根据最新素材、标签、任务类型与用户创意产出候选 Prompt；手工编辑后的 Prompt 只能返回候选更新。
5. Vidu 编译器按照本文件的 Profile 骨架、标签字典和图片映射规则编译 Prompt；Adapter 仅转换执行快照为 Vidu 请求。
6. Preflight 校验参考图数量、角色、顺序、文件限制、Prompt 长度、源视频时长、callback URL 和内部请求体大小。

## 9. 验收标准

1. 图片页上传风格、场景、姿势参考图后，AI 建议的候选 Prompt 包含对应实际素材的绑定描述；生成请求快照包含同一组 `asset_id/role/position`。
2. 删除或替换任一参考图、修改角色/顺序、切换标签或修改 Prompt 后，旧编译批次、Preflight 和执行确认均失效。
3. 手工编辑的 Prompt 在素材或标签变化后只显示“AI 新建议”，必须点“覆盖为 AI 建议”才更新。
4. `img2video` 仅允许一张首帧；`reference2video` 必须有且仅有一张首帧和至少一张额外参考图。
5. 爆款复刻向 Vidu 发送的 `images[]` 与执行确认弹窗中的“图 N”完全一致；无场景图时 Prompt 不出现“图 N 为场景”。
6. Vidu 复刻缺少源视频、缺少替换图、图片数不在 1-7、视频时长不在 5-180 秒、Prompt 超过 2000 字符或文件不符合限制时，Preflight 阻断并返回具体原因。
7. Vidu `processing/success/failed` 回调可幂等更新内部 attempt，重复回调不重复创建生成结果或计费。
8. 前端代码、通用模板和非 Vidu Provider 的最终 Prompt 中均不出现 Vidu 专有图片编号或复刻语法。

## 10. 交付顺序

1. 评审并更新正式契约中的 `trending_replicate` Profile 与能力字段。
2. 后端实现 Prompt Profile Registry、内容编译器、快照失效与 Vidu Adapter Preflight。
3. 前端将图片任务的本地 mock AI 建议替换为任务组 API 调用，并将参考图状态改为真实素材 ID。
4. 接入视频首帧、多参考与爆款复刻 Profile，展示 Profile 名称、版本、图片绑定和预检摘要。
5. 完成 Provider Sandbox 联调、回调幂等测试和端到端验收。

## 11. 依据

- 用户提供的 Vidu `POST /ent/v2/trending-replicate` 接口、字段限制与图片编号建议。
- `docs/product/API-CONTRACT-V2.3.md`：任务组五阶段、参考图顺序、Prompt 确认、Preflight 与 Vidu demo Adapter 约束。
- `docs/product/BACKEND-TECHNICAL-SPEC-V2.3.md`：Prompt Profile Registry、内容方案快照和执行快照规则。
- `docs/product/PRD-V2.3.md`：Vidu 专有规则不得进入通用模板，及 `trending_replicate` 业务 Profile 定义。
