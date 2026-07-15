# 视频工作台与模板中心实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复智能模板中心在 mock 阶段的 500，并将视频任务改为与图片任务一致的三栏工作台，支持空白新建、审核通过图片承接和爆款复刻。

**Architecture:** 视频页统一为一个工作台，只有入口上下文不同：普通“新建视频任务”没有预填素材；图片结果的“创建视频”才携带已审核通过的首帧和上下文。工作台内通过“图片生视频 / 爆款复刻”切换两种业务流程，但两者均使用输入素材、任务配置、模型能力三个区域，避免两套交互范式并存。

**Tech Stack:** React 19、TypeScript、Vite、Tailwind 4、现有 `useState` mock 数据与 `AssetTransitModal`。

---

## 结论与边界

### 先修的问题

1. 智能模板中心仍直接调用 `/v1/admin/prompt-template/*` 和字典接口；当前默认 `VITE_USE_MOCK !== 'false'`，没有后端时会稳定返回 500。
2. `CREATE_VIDEO_TASK` 只有一个 `videoSourceTask` 状态。审核结果进入后它会保留；之后从“新建视频任务”进入时没有清空，所以默认呈现“从审核通过图片创建视频”。
3. 当前视频页是“两栏 + 多张卡片”的专用页，输入、任务配置、模型能力和结果关系不清晰；它没有复用图片任务的三栏工作台结构。

### 本轮不做

- 不接真实后端、数据库、真实视频分析或生成接口。
- 不改素材库本身；只复用现有资源中心选择能力。
- 不向用户展示 seed、推理步数、guidance 等技术参数。
- 不恢复“两段审核”。图片版本继续采用一次“评分与审核”，通过后才可创建视频。

### 入口规则（必须保持）

| 入口 | 初始素材 | 标题 | 用户可做的事 |
| --- | --- | --- | --- |
| 新建视频任务 | 空 | 新建视频任务 | 从资源中心自主选择首帧、参考图、商品与模特 |
| 审核通过图片的“创建视频” | 已通过图片及图片任务上下文 | 从审核通过图片创建视频 | 保留预填信息，也可清空或替换素材 |
| 爆款复刻 | 空 | 新建视频任务 / 爆款复刻 | 上传或填写爆款视频地址，再选择替换素材 |

不能用 `selectedProduct.thumbnail` 作为新建视频任务的隐式首帧。没有选择首帧时，提交按钮必须不可用。

## 目标界面

### 公共框架

```text
页头：返回 | 视频任务工作台 | [图片生视频] [爆款复刻]                 提交视频任务

左栏：输入素材                 中栏：任务配置                    右栏：模型能力
首帧 / 参考图片组              模式、时长、比例、分辨率          通道、模型版本
商品、模特                     分镜 Prompt、负面约束             可用规格、成本、健康状态
资源中心入口                   AI 助手抽屉                       模特选择 + 资源中心入口
```

这与图片任务的职责对齐：左栏回答“用什么素材”，中栏回答“想生成什么”，右栏回答“当前模型能否生成、成本如何”。

### 图片生视频

- 使用分段按钮：`img2video`、`reference2video`。
- `img2video`：必须有一张首帧；首帧卡从空的“大加号”开始，点击打开资源中心。
- `reference2video`：首帧仍是必选；另有可多选的参考图片组，展示缩略图、名称、来源、角色、移除和替换。图片角色只允许业务语义：`风格`、`动作/镜头`、`场景`。
- 左栏的商品和模特均由资源中心选择。模特交互与图片页一致：可推荐、手选或“不使用模特”，不再展示“模特上下文”字段。
- 中栏的时长选项来自模型业务能力。切换时长只补充缺失分镜；用户已经编辑的分镜文本不覆盖。
- 右栏只显示通道、模型版本、比例、时长、分辨率、运动幅度、参考图上限、成本、额度、健康状态和限制提示。

### 爆款复刻

保留第一版的业务链路，但改造成同一三栏工作台，而不是另一个完全不同的页面：

1. 左栏：选择爆款视频来源（本地视频或视频直链）；通过资源中心选择替换商品、模特和场景素材，允许多选并给每张素材标注角色。
2. 中栏：填写复刻目标，点击“分析分镜与爆点”后显示关键帧、镜头时间轴、爆点逻辑、替换策略和风险；用户确认后编辑复刻 Prompt 与时长驱动的分镜。
3. 右栏：复用视频模型能力与模特选择；分析完成后显示原视频与生成结果对照，以及任务摘要。第一版的“检查请求”和“任务 ID 查询”属于通道调试能力，不放在普通创作流；mock 阶段仅保留任务状态和结果预览。

## 文件调整

| 文件 | 调整职责 |
| --- | --- |
| `src/mockData.ts` | 增加五类模板 Demo、模板下拉枚举、爆款复刻 Demo 分析结果与视频素材样例。 |
| `src/components/TemplateCenter.tsx` | mock 模式读取本地五类模板和枚举；创建、编辑、停用只更新组件内状态；修复 `platformFormat` 的保存与列表展示。 |
| `src/api/hooks/useDict.ts` | mock 模式返回本地字典，避免模板抽屉继续请求后端。 |
| `src/components/CreateVideoTask.tsx` | 重构为三栏视频工作台，接收明确的入口上下文，支持图片生视频与爆款复刻。 |
| `src/types.ts` | 定义视频入口上下文、视频输入素材、参考图角色、爆款拆解和视频任务快照的明确类型。 |
| `src/App.tsx` | 将“新建视频”与“从结果创建视频”拆成两个明确操作；进入普通新建时清空视频上下文。 |
| `src/components/TaskList.tsx`、`src/components/Sidebar.tsx`、`src/components/Header.tsx` | 所有普通“新建视频”入口统一使用空白上下文。 |
| `src/components/TaskDetailsDrawer.tsx` | 仅“审核通过”的图片版本传递 `approved-image` 上下文，包含图片、商品、风格、Prompt、模特和模型快照。 |

## 实施任务

### Task 1：为模板中心补齐 mock 数据源

**Files:**

- Modify: `src/mockData.ts`
- Modify: `src/api/hooks/useDict.ts`
- Modify: `src/components/TemplateCenter.tsx`

- [ ] 定义 `mockTemplates: TemplateDTO[]`，每个 `TemplateKind` 至少 2 条。五类必须是：图片任务、风格场景、视频 Prompt、平台规格、负面约束。
- [ ] 定义 `mockTemplateDicts: Record<string, DictItem[]>`，覆盖模板中心的十类枚举。枚举项应保留当前图片页的五种风格，并包含 `4:5`、`9:16`、`platformUsage` 与独立的 `platformFormat`。
- [ ] 在 `useDict` 内按 `isMockRuntime` 分流：mock 返回 `mockTemplateDicts[categoryCode] ?? []`，真实模式继续调用 `dictApi.listItemsByCode`。
- [ ] 在 `TemplateCenter` 内按 `isMockRuntime` 分流：列表查询从 `mockTemplates` 依次按 `templateKind`、状态和关键字筛选；新增、编辑、批量停用仅更新本地 `useState` 数据。
- [ ] Tab 数量必须来自全部本地模板集合，不能再对未激活 Tab 固定显示 `0`。
- [ ] 修复平台规格三个字段流：抽屉格式控件读写 `platformFormat`；保存 payload 包含 `platformFormat`；`PlatformSpecRow` 的文件格式列显示 `tpl.platformFormat`，不是 `tpl.platformUsage`。

**验收:** 进入智能模板中心、切换五个 Tab、打开任一抽屉均不产生 500；创建/编辑/停用只在当前浏览器状态生效；平台用途和文件格式互不覆盖。

### Task 2：拆开视频入口语义

**Files:**

- Modify: `src/types.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/TaskList.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/TaskDetailsDrawer.tsx`

- [ ] 新增 `VideoTaskEntryContext` 联合类型：`{ kind: 'blank' }` 与 `{ kind: 'approved-image'; taskId; resultId; imageUrl; productId?; productName; prompt; style?; scene?; modelProfileId?; modelSnapshot? }`。
- [ ] App 顶层以 `videoEntryContext` 替换裸 `videoSourceTask`；普通新建入口统一执行 `setVideoEntryContext({ kind: 'blank' })` 后跳转。
- [ ] `TaskDetailsDrawer` 仅为 `reviewStage === 'approved'` 的图片结果构造 `approved-image` 上下文。该路径保留当前预填能力。
- [ ] `CreateVideoTask` 只在收到 `approved-image` 时展示“从审核通过图片创建视频”；收到 `blank` 时标题为“新建视频任务”，首帧、商品和模特均为空。
- [ ] 返回任务列表或从任一普通入口再进视频页时，不得残留上一条审核图片的数据。

**验收:** 先从审核通过图片进入视频页，再返回并点击“新建视频任务”，页面重新呈现空的大加号，不出现上一条任务的图片或 Prompt。

### Task 3：建立视频输入素材区（左栏）

**Files:**

- Modify: `src/types.ts`
- Modify: `src/components/CreateVideoTask.tsx`
- Reuse: `src/components/AssetTransitModal.tsx`

- [ ] 定义 `VideoInputAsset`，字段包括 `id`、`name`、`url`、`source`、`role`；角色为 `first-frame | style | action | scene | product | model`。
- [ ] 普通新建的首帧以空状态显示虚线大加号，点击打开资源中心；选择后展示缩略图、名称、来源、替换和移除。
- [ ] `reference2video` 展示独立“参考图片组”，支持多选、参考图上限校验、缩略图排列、角色下拉和逐项移除。`img2video` 隐藏参考图组，不清除已填数据，方便用户切回。
- [ ] 资源中心调用时传入明确 `targetSlot`：`video-first-frame`、`video-reference`、`video-product`、`video-model`、`replicate-source`、`replicate-assets`，使初始化筛选与选择回调可区分。
- [ ] 商品信息根据用户选中的商品素材初始化；没有可匹配商品时显示“未关联商品”，允许继续以图片为主创建任务。

**验收:** 空白新建可从资源中心选择一张首帧；切换参考图生视频后可一次选择多张图，达到当前模型上限时禁止再加并给出业务提示。

### Task 4：实现图片生视频的中栏与右栏

**Files:**

- Modify: `src/components/CreateVideoTask.tsx`
- Reuse: `src/mockData.ts`

- [ ] 将当前页面布局改为 `300px / minmax(0, 1fr) / 380px` 三栏，复用 `CreateImageTask` 的表面样式、标题层级和卡片间距。
- [ ] 中栏实现“图片生视频 / 爆款复刻”一级标签；图片生视频内再使用 `img2video / reference2video` 分段控制。
- [ ] 中栏放置比例、时长、分辨率、运动幅度、任务 Prompt、负面约束和时长驱动分镜。分镜的 key 以时长和区段为准；切换时只创建不存在的建议文本，已编辑文本保持原值。
- [ ] 右栏放模型通道、具体模型、支持规格、成本、健康状态、额度和风险提示。所有选项只从 `mockModelChannels` 的业务能力读取。
- [ ] 右栏放与图片页一致的“模特选择”：推荐卡、手选资源中心、不使用模特；不出现“模特上下文”输入或技术参数。
- [ ] 提交校验至少包含：首帧已选、规格被当前模型支持、`reference2video` 已选至少一张参考图、通道非维护状态。

**验收:** 用户可以在同一屏完成素材选择、Prompt 编辑、模型规格校验和提交；切换 5/8/15 秒时分镜建议改变，但已写内容不丢失。

### Task 5：把爆款复刻纳入同一工作台

**Files:**

- Modify: `src/types.ts`
- Modify: `src/mockData.ts`
- Modify: `src/components/CreateVideoTask.tsx`

- Reference only: `/Users/jay/Desktop/02-projects/AIGC/开发/aigc-workbench/src/components/TrendingReplicateGenerator.tsx`

- [ ] 定义 `TrendingReplicateDraft`：原视频来源、替换素材列表、复刻目标、拆解结果、生成 Prompt、状态。拆解结果至少含关键帧、镜头列表、爆点逻辑、替换策略、风险。
- [ ] 爆款复刻左栏提供“本地视频 / 视频直链”切换和替换素材组。替换素材从资源中心选择，最多 7 张；每张指定为商品、模特或场景，且至少一张商品图才可分析。
- [ ] 中栏提供“复刻目标”和“分析分镜与爆点”。mock 点击后使用 `mockTrendingReplicateAnalysis` 填充关键帧、镜头、爆点逻辑、替换策略、风险与可编辑复刻 Prompt。
- [ ] 分析完成后仍使用公共的时长、比例、分辨率、运动幅度和负面约束；用户可编辑 Prompt 和分镜后提交。
- [ ] 右栏保留公共模型能力与模特选择，在下方展示原视频和 mock 生成视频的对照预览及任务摘要。不要把“已有 Vidu 任务 ID”“请求载荷检查”等通道调试字段放进创作页面。

**验收:** 爆款复刻从空白素材开始，用户可导入一个视频、选择替换商品图、点击分析、查看拆解、编辑 Prompt 并生成一条 mock 视频任务；原视频和结果视频能够对照显示。

### Task 6：验证与回归

**Files:**

- Verify: `src/components/TemplateCenter.tsx`
- Verify: `src/components/CreateVideoTask.tsx`
- Verify: `src/App.tsx`

- [ ] 运行 `npm run lint`，预期 TypeScript 无错误。
- [ ] 运行 `npm run build`，预期 Vite 构建成功。
- [ ] 手工走完模板中心：五个 Tab、抽屉字段、格式和用途独立保存、无 500。
- [ ] 手工走完视频入口回归：审核图片创建视频有预填；所有普通新建入口为空；返回再进也不残留预填。
- [ ] 手工走完图片生视频：首帧、参考图组、资源中心、模特、时长分镜和模型冲突提示。
- [ ] 手工走完爆款复刻：视频来源、替换素材、分析结果、Prompt 编辑、生成结果对照。

## 方案取舍

- 采用同一个视频工作台，而不是将爆款复刻做成独立页面。用户只需理解一次三栏布局和资源中心选择方式。
- 保留“审核通过图片创建视频”作为快捷入口，但它是预填，不是视频页的默认模式。这样既保证工作流闭环，也不会剥夺用户自主建视频任务的能力。
- 爆款复刻保留“拆解创意结构和替换素材”的核心价值；去掉第一版面向通道调试的 Seed、任务 ID、请求检查等字段，符合当前业务操作层的设计原则。
- 模板中心改为完整 mock 分流，而不是只吞掉错误。否则模板列表虽不报错，下拉枚举仍会继续发出失败请求。

## 验收清单

- [ ] 智能模板中心不再出现 `Request failed with status code 500`。
- [ ] 普通“新建视频任务”首次进入为空，首帧为大加号。
- [ ] 审核通过图片创建视频能够预填，且可被用户替换。
- [ ] 视频页保持图片页的三栏布局。
- [ ] `reference2video` 能展示多张参考图片及其角色。
- [ ] 视频和图片都能通过资源中心选择模特。
- [ ] 爆款复刻包含导入视频、替换素材、AI 拆解、Prompt 编辑和结果对照。
- [ ] 平台规格的“用途”和“文件格式”独立读写和展示。
