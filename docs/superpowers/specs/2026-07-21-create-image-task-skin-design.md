# 创建图片任务页面「以 demo 主版为基准」整体重写 — 设计文档

| 项目 | 内容 |
|------|------|
| Spec slug | `create-image-task-skin-design` |
| 日期 | 2026-07-21 |
| 范围 | `EC-AIGC/src/components/CreateImageTask.tsx`(及全部受影响的子模块) |
| 基准参考 | `D:\Program\Idea-Work\demo\EC-AIGC\src\components\CreateImageTask.tsx`(主版) |
| 选定方案 | **方案 B:整体重写 UI 层 + 保留全部业务 hook** |
| 复刻目标 | 1:1 对齐 demo 主版的组件树、样式表现、状态机;后端零侵入 |
| 验收原则 | 完整交付(含 motion 动画、可访问性增强、草稿恢复) |

---

## 1. 背景与目标

当前项目 `CreateImageTask.tsx` 是一个 ~700 行的大文件,内部采"三栏 + 商品信息卡 + TaskParamsPanel"形态,后端强绑业务逻辑(通道/能力/模型三级联动、COS 上传、`autoCreateProduct`)集中在 `useTaskParams`、`useFileUpload`、`OutfitComposePanel` 中。

`D:\Program\Idea-Work\demo\EC-AIGC\src\components\CreateImageTask.tsx`(主版)是同一团队的"下一阶段"形态,以"**多图片类型驱动 + 每类型独立 Prompt + 4 项就绪度检查 + 自动样式迁移**"为骨架。

经用户确认:

- 后续 iteration 的样式与核心交互方向就是 demo 主版
- 引入 demo 的依赖(`motion`、`lucide-react`)
- 中央列完整迁移到 `ProductFactsEditor` + 不可改变项(本项目实际就是 6 字段 + 4 个 constraints)
- 参考图升级到 5 slot
- 不要复制 demo 代码,**仅复刻视觉与交互表达**,骨架由本项目按 EC-AIGC 既有分层重新搭

---

## 2. 范围

### 范围内
- 重写 `CreateImageTask.tsx` 的 UI 层
- 拆分 16 个新增组件(3 dialog + 2 header + 1 layout + 3 left + 7 center + 5 right,详见 §3)
- 新增 5 个纯函数模块
- 新增 1 个 UI state hook
- 升级 `useTaskParams`(兼容层,接口向上兼容)
- 替换 `TaskParamsPanel.tsx` 调用位并删除
- 加测试栈(vitest + RTL + jsdom)

### 范围外
- 后端 DTO、API 端点、Sa-Token 鉴权(零侵入)
- React Router 接入(后续 iteration 处理)
- `assets` 资源中心弹窗迁形态
- `CreateImageTaskApi.tsx` / `Beta/CreateTaskNew.tsx` / `Legacy/CreateImageTaskLegacy.tsx` 不动
- 国际化真正接入(只做好集中 label 文案)
- `autoCreateProduct` 真正调用(只是保留入口,本期以主图选择自动推断 `selectedProduct`)

---

## 3. 架构与组件边界

### 3.1 顶层 props 契约(不变)

```ts
interface CreateImageTaskProps {
  products: ProductAsset[];
  onAddTask: (task: GenerationTask) => void;
  setScreen: (screen: AppScreen) => void;
  openTransit: (onConfirmSelection: (assets: AssetResourceItem[]) => void, targetSlot?: string) => void;
  selectedProduct: ProductAsset;
  setSelectedProduct: (product: ProductAsset) => void;
}
```

`App.tsx` 接入零改动。

### 3.2 文件拆分(目标)

```
src/components/CreateImageTask/
├── index.tsx                                # 入口,导出默认组件
├── CreateImageTask.tsx                      # 顶层容器 + 调度
├── header/
│   ├── TopHeader.tsx                        # 返回 / 标题 / 生成准备度 / 检查并生成按钮
│   └── ReadinessBanner.tsx                  # 顶部警告条
├── layout/
│   └── ThreeColumnLayout.tsx                # grid-cols-[300px_minmax(0,1fr)_380px]
├── left/
│   ├── ImageSourceSection.tsx               # 主图 + 上下装合成 + 5-参考图 grid
│   ├── CompositeSection.tsx                 # 品类=户外服饰才显示
│   └── ReferenceGrid.tsx                    # 5 slots 渲染
├── center/
│   ├── ImageTypeSelector.tsx                # 4 宫格多选 + 每类型张数
│   ├── TemplatePicker.tsx                   # 模板选择 + 覆盖确认
│   ├── StyleScenePoseRow.tsx                # 风格/场景/姿势三个 select
│   ├── AdvancedSettings.tsx                 # <details> 折叠 + 负面约束
│   ├── ImageContentSection.tsx              # AI 助手 + 商品事实 + PerTypePromptEditor 容器
│   ├── ProductFactsEditor.tsx               # 6 字段表单
│   └── PerTypePromptEditor.tsx              # 按选中类型列表渲染 textarea
├── right/
│   ├── ImageSettingsSection.tsx             # 模型 + 比例 + 平台预设 + 总张数 + 尺寸
│   ├── ModelSelector.tsx                    # channel:model 单 select + 切换冲突
│   ├── PlatformPresets.tsx                  # 3 个预设 chips
│   ├── ReviewStrategyPanel.tsx              # 启用评分审核 toggle
│   └── UnsupportedNotice.tsx                # 红色警告条
└── dialogs/
    ├── ExecutionConfirmDialog.tsx
    ├── ConflictDialog.tsx
    └── TemplateOverwriteDialog.tsx
```

### 3.3 配套纯函数/hook 模块

```
src/hooks/useCreateImageTaskState.ts         # UI state 中枢
src/lib/createImageTask/
├── readinessChecks.ts                       # 4 项检查纯函数
├── extractProductFacts.ts                   # 商品 → facts(从 demo 移植)
├── buildPromptFromFacts.ts                  # facts + type → 默认 prompt
├── extractReferenceInsights.ts              # 5 slot → 有序 insight 数组
└── applyAiOptimize.ts                       # 当前已有逻辑升级为按 type 调用
```

### 3.4 依赖增量

| 包 | 版本基准(demo) | 用途 |
|----|----------------|------|
| `motion` | ^12.23.x | dialog / banner / 张数调节器 / ConflictDialog 微动效 |
| `lucide-react` | ^0.546.x | AI 助手按钮 loading icon / 模板按钮 / 提示 icon |
| 不新增 | — | `sonner` / `@fontsource/*` / `cos-js-sdk-v5` / `@tailwindcss/vite` 已有 |

不引入 antd(原 `TaskParamsPanel` 内部用的 `Select/TextArea/ImagePickerField` 全部用 Tailwind + 原生 select / textarea 重写)。

---

## 4. 数据流与状态机

### 4.1 状态分两类

**UI state**(`useCreateImageTaskState` 管):

```
selectedTypes:               ImageGenerationType[]                    // 多选,默认 ['product_main']
typeCounts:                  Record<ImageGenerationType, number>      // 每 type 张数,默认 1
template:                    string                                   // 模板 key
style | scene | pose:        string                                   // 三个下拉
negativePrompt:              string
promptOverrides:             Record<ImageGenerationType, string>
promptHasEdits:              boolean
factsConfirmed:              boolean
promptsConfirmed:            boolean
assistantState:              'idle' | 'processing' | 'complete'
reviewEnabled:               boolean
references:                  Record<ReferenceSlot, TaskReference | undefined>  // 5 slots
orderedReferenceInsights:    string[]
compositeState:              'empty' | 'partial' | 'ready'
readinessIssue:              string
pendingChoice:               { channelId, modelId } | null
conflictOpen:                boolean
templatePickerOpen:          boolean
pendingTemplate:             string | null
templateOverwriteOpen:       boolean
executionConfirmOpen:        boolean
isSubmitting:                boolean                                   // 防止重复提交
```

**业务 hook 与全局 state**(基本不动):

- `useTaskParams` 暴露 `channelId / capability / modelId / ratio / resolution / isSupported / totalCount / setModelWithValidation / applyCompatibleModel`(向后兼容包装)
- `useFileUpload` 暴露 `uploadToCos()`(不变)
- zustand `useCapabilityStore`(不变)
- App.tsx 注入的 `products / selectedProduct`(不变)

### 4.2 Prompt 生成规则

`prompts[type]` 由 4 段拼接(顺序固定):

```
[
  template.basePrompt(type) ?? '',
  factsToPrompt(productFacts),
  `${style} · ${scene} · ${pose}`,
  orderedReferenceInsights.join('\n'),
]
.filter(Boolean).join('\n')
```

依赖项:`[template, productFacts, style, scene, pose, orderedReferenceInsights]` —— 任一项变化:
1. `prompts[]` useMemo 重新计算
2. 自动 `setPromptHasEdits(true)`(视为表单已编辑)
3. `setPromptsConfirmed(false)`

### 4.3 readinessChecks 4 项(顺序固定)

| # | complete 条件 | message | targetId |
|---|---------------|---------|----------|
| 1 | `isProductBound === true` | 请先选择已关联商品资产的主体素材 | `image-source-section` |
| 2 | `factsConfirmed && factsComplete` | 请检查并确认商品事实 | `image-content-section` |
| 3 | `promptsConfirmed && promptsComplete` | 请确认本组任务 Prompt | `image-content-section` |
| 4 | `isSupported && channel.health !== 'maintenance'` | 当前模型通道或输出规格不可执行,请调整设置 | `image-settings-section` |

`readinessCount = readinessChecks.filter(c => c.complete).length`

`checkAndGenerate()`:
```
const issue = readinessChecks.find(c => !c.complete);
if (issue) {
  setReadinessIssue(issue.message);
  requestAnimationFrame(() => document.getElementById(issue.targetId)?.scrollIntoView({behavior:'smooth', block:'center'}));
  return;
}
setReadinessIssue('');
setExecutionConfirmOpen(true);
```

### 4.4 模型切换 Conflict 流

```
setModelWithValidation(nextChannelId, nextModelId):
  next = lookupChannel + lookupModel
  incompatible = !ratios.includes(ratio)
              || selectedTypes.some(t => typeCounts[t] > model.capability.maxCount)
              || !resolutions.includes(resolution)
  if (incompatible): setPendingChoice(...) + conflictOpen=true
  else:             setChannelId + setModelId

ConflictDialog 中点"确认调整" → applyCompatibleModel():
  ratio = nextModel.capability.ratios[0]
  typeCounts[type] = min(current, model.capability.maxCount, MAX_TYPE_COUNT=5) for each type
  resolution = nextModel.capability.resolutions[0]
  conflictOpen = false
```

### 4.5 提交流(逐类型多提)

```
submitTasks() in ExecutionConfirmDialog "确认":
  groupId = `G-${Date.now()}`
  selectedTypes.forEach((imageType, idx) => {
    const task = buildGenerationTaskFor({ imageType, idx, groupId, ...allState })
    onAddTask(task)                    // App.tsx 已处理
    // 或 ↓(推荐路径,与 App.tsx 解耦)
    submitTask(buildSubmitPayload(task)).catch(handleSubmitError)  // 错误时不切换 screen
  })
  // 全部 promise resolve 后:
  persistDraft({ reset: true })        // 清空草稿
  setScreen(AppScreen.TASKS)
```

`SubmitTaskRequest` 不引入新字段;payload 组装沿用现有 `buildSubmitPayload()`(只 patch `inputReferenceUrls: string[]` 字段)。

### 4.6 自动保存(sessionStorage)

```
key:          'create-image-task-draft-v2'
throttle:     800ms
save payload: useCreateImageTaskState 返回中所有可序列化字段(去掉 functions)
mount:        尝试 hydrate;catch → 清空 key + toast("已清除无法识别的草稿")
restore:      toast.success("已恢复上次编辑")
```

### 4.7 AI 助手 runAssistantAnalysis 流

```
点击 → assistantState:'processing'(disabled + animate-pulse)
       ↓
    setTimeout(500ms) (与 demo 主版一致)
       ├─ extractProductFacts(taskProduct) → productFacts
       ├─ buildPromptFromFacts(type, facts) → promptOverrides[type]
       ├─ setFactsConfirmed(true)
       ├─ setPromptHasEdits(true) + setPromptsConfirmed(false)
       └─ assistantState:'complete'
       超时 5s 自动回滚 'idle' + toast.error("解析超时")(防御真实接 AI 服务后的卡死)
```

---

## 5. 样式要点(规规矩矩统一)

| 维度 | 规则 |
|------|------|
| 圆角 | 输入/按钮 `rounded-md`;卡片 `rounded-lg`;圆形元素 `rounded-full` |
| 间距 | 栏内 section 之间 `space-y-4`/`space-y-5`;grid 内 `gap-2`/`gap-3`;三栏之间 `gap-5`;主区 `p-5` |
| 阴影 | 弹窗 `shadow-lg`/`shadow-xl`;按钮 `shadow-sm`;卡片无 shadow(用 border 区分) |
| 字重 | 标题 `font-black`;标签/按钮 `font-bold`;说明 `font-normal`;select/input 值 `font-medium` |
| 字号 | meta `text-[10px]`;次要 `text-[11px]`;正文 `text-xs`(12px);数值 `text-sm`/`text-base`; |
| 颜色 | primary `#0256FF`;primary-50 `#EBF2FF`;warning `amber-50/200/700`;success `emerald-50/200/600/700`;error `red-50/500`;中性文字/边框 `slate-200/400/500/700` |
| 状态 | 选中 `border-primary bg-blue-50`;空态 `border-dashed border-slate-300 bg-slate-50`;hover `hover:border-primary hover:bg-blue-50` |
| 字体 | `Inter`(正文)/`Hanken Grotesk`(标题)/`Noto Sans TC`(中文),已在 `@theme` |
| 三栏 | `grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_380px] gap-5 p-5` |
| 头部 | `h-16 shrink-0 px-6 bg-white border-b border-slate-200 flex items-center justify-between` |
| Header 按钮 | "检查并生成" `h-9 px-4 rounded-md bg-primary text-white text-xs font-bold shadow-sm` |
| 弹窗 | `fixed inset-0 z-50`;遮罩 `bg-slate-900/40`;弹体 `bg-white rounded-lg w-full max-w-md p-6 shadow-xl` |

---

## 6. 5 项 Motion 动画(本期新增)

| 位置 | 库 | 效果 |
|------|------|------|
| `ConflictDialog` / `TemplateOverwriteDialog` / `ExecutionConfirmDialog` 出现 | `motion` | `<motion.div initial={{opacity:0, scale:0.96}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.96}} transition={{duration:0.16}}>` |
| `ReadinessBanner` 出现 | Tailwind | `animate-[fadeInDown_200ms_ease-out]`(在 `@theme` 注册 keyframes) |
| AI 助手按钮 processing 状态 | Tailwind | `animate-pulse` + `progress_activity` 图标旋转 |
| 张数调节器数字变化 | Tailwind | `transition-all duration-150` + scale `0.95→1` |
| 模板下拉打开 | Tailwind | `animate-[fadeIn_150ms_ease-out]` |

---

## 7. 错误处理矩阵

| 场景 | 处理 |
|------|------|
| 素材未选 / 商品未绑定 / 事实未确认 / Prompt 未确认 / 规格不支持 | readinessChecks 拒绝 + banner + smooth scroll |
| 模型切换不兼容 | ConflictDialog |
| 平台 preset 与模型冲突 | ConflictDialog |
| 模板切换有 Prompt 编辑 | TemplateOverwriteDialog |
| API 提交失败 | sonner `toast.error`,dialog 关闭但不切屏,按钮恢复 |
| 重复提交 | 提交期 lock(`isSubmitting`),dialog 显示 loading |
| sessionStorage 解析失败 | catch + 清 key + toast |
| 参考图 thumbnailUrl 404 | slot 红色 border + 重新打开 TransitPicker |
| AI 助手 5s 超时 | assistantState 回滚 idle + toast.error |

---

## 8. 可访问性

- 所有 icon-only button 加 `aria-label`
- Color-only 状态(amber-50)增加图标 + `role="alert"`
- 表单字段 `<label htmlFor>` 绑定
- 弹窗进入 focus 主按钮、Escape 关闭
- textarea 加 `aria-describedby`
- 增减张数原生 `<button>`,天然可达

---

## 9. 国际化占位

所有新增文案集中到 `src/labels/createImageTask.ts`,导出 `messages = { ... }`(键值对)。后续接 i18n 时替换为 `t('xxx')` 调用即可。本期不引入 i18n 库。

---

## 10. 测试策略

### 单元(vitest,本期启用)

- `readinessChecks.test.ts` —— 4 项计算正确,targetId 唯一
- `buildPromptFromFacts.test.ts` —— 输入 facts → 输出按 type 各 prompt
- `extractProductFacts.test.ts` —— 商品 → facts
- `extractReferenceInsights.test.ts` —— 5 slot → 有序 array
- `useCreateImageTaskState.test.ts` —— toggleType/changeTypeCount/template change 检测/prompt 重算/草稿 hydrate

### 组件(@testing-library/react)

- `ImageTypeSelector` —— 多选/单选、张数边界、受 model 上限约束
- `ConflictDialog` —— applyCompatibleModel 联动调整
- `TemplateOverwriteDialog` —— 覆盖检测
- `PromptAutoSave` —— 节流 + 反序列化兼容
- `ExecutionConfirmDialog` —— 4 项不全时按钮 disabled

### E2E(已有 playwright 扩展)

- 完整正向:选主图 → 选参考图 → AI 助手 → 确认事实 → 确认 Prompt → 选模型 → 选 preset → 提交 → 跳 task 列表
- 边界:少一项 readiness → banner + 滚动

### 视觉回归

- 用 `.playwright-cli/` 截图新版 → diff 关键截图(卡片圆角、TypeSelector 4 宫格、ConflictDialog)

---

## 11. 验收标准(DoD)

1. 样式对齐 demo 主版(三栏 300/1fr/380,卡片圆角,色板,字重)
2. 行为对齐 demo 主版(4 项 readiness 顺序检查 + smooth scroll + ConflictDialog + TemplateOverwriteDialog)
3. 当前项目业务能力保留:
   - `useTaskParams` 三级联动数据继续走
   - COS 上传(`useFileUpload`)与 `OutfitComposePanel` 保留
   - `autoCreateProduct` 流程保留(主图选择自动推断 selectedProduct)
   - 模板预填沿用现有 `sessionStorage` key
   - 后端 DTO 零侵入:`SubmitTaskRequest` 不变
4. 逐类型多提 N 条任务,与 demo 一致
5. 可访问性:键盘可达、aria-label、Escape 关闭弹窗
6. 可恢复草稿:刷新页面能恢复最近一次编辑
7. motion 动画就位(5 项,与 §6 一致)

---

## 12. 风险与缓解

| 风险 | 概率 | 缓解 |
|------|------|------|
| Prompt 主题切换与 template 服务端 schema 不匹配 | 低 | 本期不发模板预填 schema 变更;`sessionStorage` key 维持 |
| `useTaskParams` 改造破坏接口 | 中 | 包装成兼容层,旧调用方不动;改动控制在 hook 内部 + 类型加可选字段 |
| 自动保存覆盖预期状态 | 低 | 只保存可序列化字段;恢复时 toast 提示 |
| 5 slot 加入 model 后 UI 拥挤 | 中 | grid-cols-2 → 5 项排 2+2+1 末尾对齐 |
| 后端 `submitTask` 不支持同一 batch 多 type | 低 | 逐类型多次调用,各自独立 `taskType` 字段,后端无感 |
| 组件拆分多文件 build-time 增量 | 低 | 平均 80-200 行/文件,总行数 < 3000,无重复依赖打包 |
| motion 引入后 hydration mismatch | 低 | 所有 motion 组件 mount-only;不用 SSR 不影响 |

---

## 13. 实施顺序(交付 writing-plans)

1. 加依赖(`motion`,`lucide-react`,`vitest`,`@testing-library/react`,`jsdom`)
2. 5 个纯函数 + 单元测试
3. `useCreateImageTaskState` hook + 测试
4. 3 个 dialog 组件(单独可测)
5. 左栏 3 子组件
6. 中栏 8 子组件(含 ImageContentSection / ProductFactsEditor / PerTypePromptEditor)
7. 右栏 4 子组件
8. Header 2 子组件
9. 升级 `useTaskParams` 暴露 `setModelWithValidation` / `applyCompatibleModel`
10. 替换 `App.tsx` 接入新版 + 删除 `TaskParamsPanel.tsx`
11. 视觉回归 + E2E
12. 校验 DoD 1–7

---

## 14. Open Questions

无(关键边界已确认:文件夹拆分 + 逐类型多提 + 完整交付 + motion 动画补齐)。

**已知 TBD**(不阻塞 plan,后续 iteration 处理):
- `extractReferenceInsights` 与 `mockReferenceAnalysisByFileId` 的实际 AI 接入:本期沿用 demo 的启发式实现,真实图片分析 API 接入放到后续迭代
- `extractProductFacts` 与 `buildPromptFromFacts` 接入真实 LLM:本期同样沿用 demo 的启发式,后续接入 `@google/genai` 后端代理

---

## 15. 关联引用

- 任务入口:`CreateImageTask.tsx` 主版 → demo `D:\Program\Idea-Work\demo\EC-AIGC\src\components\CreateImageTask.tsx`
- PRD:`PRD-V2-html-share/达芬奇密码AI素材工作台-内部产品化一阶段完整PRD-V2.html`(F3 prompt 助手指引)
- 后端 DTO:`EC-AIGC/src/api/modules/task.ts` `SubmitTaskRequest`
- 既有 hook:`EC-AIGC/src/hooks/useTaskParams.ts`、`useFileUpload.ts`
- 既有 store:`EC-AIGC/src/store/useCapabilityStore.ts`
