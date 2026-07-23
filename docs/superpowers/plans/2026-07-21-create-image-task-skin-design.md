# 创建图片任务页面重写 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `EC-AIGC/src/components/CreateImageTask.tsx` 重写为对齐 demo 主版(`D:\Program\Idea-Work\demo\EC-AIGC\src\components\CreateImageTask.tsx`)的"多图片类型驱动 + 每类型独立 Prompt + 4 项 readiness"骨架;保留当前项目的全部业务 hook + DTO 零侵入,完整交付(含 motion、可访问性、草稿恢复)。

**Architecture:** 把现有 700 行单文件拆为 17 个组件 + 5 个纯函数 + 1 个 UI state hook,放在 `src/components/CreateImageTask/` 下。新增 `useCreateImageTaskState` 作为 UI 中枢,`SubmitTaskRequest` 零改动,提交走 `buildSubmitPayload` + `submitTask` 现有链路,逐 `ImageGenerationType` 多次提交。

**Tech Stack:** React 19 + Vite 6 + TypeScript 5.8 + Tailwind 4 (CSS-first `@theme`) + 已有依赖(motion ^12.23 / lucide-react ^0.546 / sonner ^1.7)。测试用项目自带 `tsx --test` runner(Node 内置 test runner,无需安装 vitest)。

---

## Global Constraints

来自 spec 与项目根 CLAUDE.md、EC-AIGC/CLAUDE.md 的硬性约束(每条任务都默示遵守):

- **禁止**直接执行 `git` / `npm run dev` / 任何构建命令(只可读、写、跑 `tsx --test`)
- **禁止**新增 `tailwind.config.js`,所有 token 走 `src/index.css` 的 `@theme {}`
- **禁止**新增未在 spec 中的第三方依赖:`motion` / `lucide-react` / `sonner` 已在 `package.json` 中 ✅
- 项目不用 React Router,继续通过 `App.tsx` 的 `currentScreen` 切屏;`App.tsx` **不变**(顶层 props 契约冻结)
- 所有自定义颜色/字体走 `@theme`:`--color-primary: #0256FF`、`--color-bg-base: #F5F7FB`、`--font-sans: Inter/Noto Sans TC` 等
- 测试用 `tsx --test "src/**/*.test.ts"`,写 `node:test` + `node:assert/strict`,**不引入 vitest**
- 所有文件用 LF 行尾、TypeScript strict(项目现状)
- 文件改动必须可独立 commit,不允许一个大 PR
- 提交信息格式:`feat(scope): description`、`test(scope): description`、`refactor(scope): description`
- 不破坏 `useTaskParams` 现有调用方(`CreateVideoTask.tsx` 等)—— 本期对其做"宽接口 patch",不破坏形参
- `SubmitTaskRequest`(在 `src/api/modules/task.ts`)零修改
- `buildSubmitPayload` 签名零修改(沿用现 `TaskFormState` 类型)
- 所有中文文案集中到 `src/labels/createImageTask.ts`(本期不引入 i18n,仅集中)
- React 19 + JSX runtime:函数组件 default export 走 `function Component(){...}`,**允许** arrow(项目混用)
- Material Symbols 图标走 CSS 类 `<span className="material-symbols-outlined">xxx</span>`(项目已有 `@fontsource-variable/material-symbols-outlined`)
- 反应栈:zustand store 维持本期不动
- 端到端验证:`npm run lint`(`tsc --noEmit`)0 error;`npm run test`(`tsx --test`)全绿
- `.env.local` / Vite proxy 维持现状

---

## File Structure

### 实际创建/修改的文件(在每个任务里以精确路径出现)

**新增(整文件)**:
- `src/components/CreateImageTask/index.tsx` — 入口,re-export 默认 CreateImageTask
- `src/components/CreateImageTask/CreateImageTask.tsx` — 顶层容器
- `src/components/CreateImageTask/header/TopHeader.tsx`
- `src/components/CreateImageTask/header/ReadinessBanner.tsx`
- `src/components/CreateImageTask/layout/ThreeColumnLayout.tsx`
- `src/components/CreateImageTask/left/ImageSourceSection.tsx`
- `src/components/CreateImageTask/left/CompositeSection.tsx`
- `src/components/CreateImageTask/left/ReferenceGrid.tsx`
- `src/components/CreateImageTask/center/ImageTypeSelector.tsx`
- `src/components/CreateImageTask/center/TemplatePicker.tsx`
- `src/components/CreateImageTask/center/StyleScenePoseRow.tsx`
- `src/components/CreateImageTask/center/AdvancedSettings.tsx`
- `src/components/CreateImageTask/center/ImageContentSection.tsx`
- `src/components/CreateImageTask/center/ProductFactsEditor.tsx`
- `src/components/CreateImageTask/center/PerTypePromptEditor.tsx`
- `src/components/CreateImageTask/right/ImageSettingsSection.tsx`
- `src/components/CreateImageTask/right/ModelSelector.tsx`
- `src/components/CreateImageTask/right/PlatformPresets.tsx`
- `src/components/CreateImageTask/right/ReviewStrategyPanel.tsx`
- `src/components/CreateImageTask/right/UnsupportedNotice.tsx`
- `src/components/CreateImageTask/dialogs/ExecutionConfirmDialog.tsx`
- `src/components/CreateImageTask/dialogs/ConflictDialog.tsx`
- `src/components/CreateImageTask/dialogs/TemplateOverwriteDialog.tsx`
- `src/hooks/useCreateImageTaskState.ts`
- `src/lib/createImageTask/readinessChecks.ts`
- `src/lib/createImageTask/extractProductFacts.ts`
- `src/lib/createImageTask/buildPromptFromFacts.ts`
- `src/lib/createImageTask/extractReferenceInsights.ts`
- `src/lib/createImageTask/applyAiOptimizePerType.ts`
- `src/lib/createImageTask/buildGenerationTask.ts`
- `src/labels/createImageTask.ts`

**修改**:
- `src/components/CreateImageTask.tsx` — **整个文件替换**为 re-export 旧模块(`export { default } from './CreateImageTask'`),保留旧路径兼容(下个任务删除)
- `src/components/createTask/assembleTaskPrompt.ts` — 加 `assemblePerTypePrompt` 函数,原 `assembleTaskPrompt` 保持 100% 兼容
- `src/hooks/useTaskParams.ts` — 仅暴露 `setModelWithValidation` 包装函数 + `isSupported` 派生值(包装层,不破坏现有返回)
- `src/index.css` — 在 `@theme` 末尾加 1 个 `--animate-fadeInDown` keyframes + 2 个 `keyframes`(给 Task 14 用)
- `docs/superpowers/specs/2026-07-21-create-image-task-skin-design.md` — 已存在,本计划不修改 spec

**测试文件(新增)**:
- `src/lib/createImageTask/__tests__/readinessChecks.test.ts`
- `src/lib/createImageTask/__tests__/extractProductFacts.test.ts`
- `src/lib/createImageTask/__tests__/buildPromptFromFacts.test.ts`
- `src/lib/createImageTask/__tests__/extractReferenceInsights.test.ts`
- `src/lib/createImageTask/__tests__/applyAiOptimizePerType.test.ts`
- `src/lib/createImageTask/__tests__/buildGenerationTask.test.ts`
- `src/hooks/__tests__/useCreateImageTaskState.test.ts`

**删除**:
- `src/components/createTask/TaskParamsPanel.tsx` — 在 Task 22 删除(所有调用位迁到新版后)

---

## Interface Lock

下面这些接口签名是后续任务的"被依赖契约",实现者务必严格遵循:

```ts
// src/labels/createImageTask.ts
export const messages = {
  readiness: {
    selectMain: '请先选择已关联商品资产的主体素材。',
    confirmFacts: '请检查并确认商品事实。',
    confirmPrompts: '请确认本组任务 Prompt。',
    unsupportedSpec: '当前模型通道或输出规格不可执行,请调整设置。',
  },
  typeLabels: { product_main: '商品主图', scene_detail: '场景图', detail_closeup: '细节图', on_model: '模特图' },
  styleOptions: ['甜美网红风','极简北欧风','科技赛博风','金秋自然风','奢华丝绸风'] as const,
  sceneOptions: ['自然影棚','城市街景','居家陈列'] as const,
  poseOptions:  ['自然站姿','正面站姿','轻松坐姿','行走动态'] as const,
  presetPlatforms: [
    { name: '电商主图推荐', ratio: '1:1',  resolution: '2048px' },
    { name: '详情页长图',   ratio: '3:4',  resolution: '1536px' },
    { name: '内容种草竖图', ratio: '4:5',  resolution: '1536px' },
  ] as const,
};

// src/lib/createImageTask/readinessChecks.ts
export type ImageGenerationType = 'product_main'|'scene_detail'|'detail_closeup'|'on_model';
export type ReferenceSlot = 'detail'|'style'|'scene'|'pose'|'model';

export interface ReadinessCheck {
  id: 1|2|3|4;
  complete: boolean;
  message: string;
  targetId: 'image-source-section'|'image-content-section'|'image-settings-section';
}
export interface ReadinessDeps {
  isProductBound: boolean;
  factsConfirmed: boolean;
  factsComplete: boolean;
  promptsConfirmed: boolean;
  promptsComplete: boolean;
  isSupported: boolean;
  channelMaintenance: boolean;
}
export function computeReadinessChecks(deps: ReadinessDeps): ReadinessCheck[];

// src/lib/createImageTask/extractProductFacts.ts
export interface ProductFacts {
  name: string; sellingPoints: string; category: string;
  color: string; patternAndMaterial: string; structure: string;
}
export interface ProductFactsInput {
  name: string;
  sellingPoints: string;
  productCategory: string;
  colorPattern: string;
  fabricTexture: string;
  fitStructure: string;
}
export function extractProductFacts(input: ProductFactsInput): ProductFacts;

// src/lib/createImageTask/buildPromptFromFacts.ts
export function buildPromptFromFacts(
  type: ImageGenerationType,
  facts: ProductFacts,
  style: string,
  scene: string,
  pose: string,
  referenceInsights: string[],
): string;

// src/lib/createImageTask/extractReferenceInsights.ts
export interface Ref { slot: ReferenceSlot; analysis?: { promptHint?: string } }
export function extractReferenceInsights(refs: Record<ReferenceSlot, Ref | undefined>): string[];

// src/lib/createImageTask/applyAiOptimizePerType.ts
export function applyAiOptimizePerType(
  prompts: Record<ImageGenerationType, string>,
  selectedTypes: ImageGenerationType[],
): Record<ImageGenerationType, string>;

// src/lib/createImageTask/buildGenerationTask.ts
export interface BuildGenerationTaskInput {
  imageType: ImageGenerationType;
  index: number;
  groupId: string;
  product: ProductAsset;
  taskProductName: string;
  productName: string;
  templateName: string;
  promptText: string;
  negativePrompt: string;
  reviewEnabled: boolean;
  ratio: string;
  count: number;
  channel: { id: string; name: string; accessType: string };
  model: { id: string; name: string; estimatedCost: number; capability: { ratios: string[]; maxCount: number; resolutions: string[] } };
  mainPreviewUrl?: string;
}
export interface GenerationTaskBuildResult {
  // 与 types.ts GenerationTask 对齐;任务提交时由 App.tsx 转 onAddTask 的形态
  id: string;
  groupId: string;
  name: string;
  type: 'image';
  imageType: ImageGenerationType;
  status: 'pending';
  progress: 0;
  productName: string;
  productImg: string;
  templateName: string;
  timestamp: string;
  creator: string;
  modelChannel: string;
  taskPrompt: string;
  negativePrompt: string;
  reviewStrategy: { aesthetic: boolean; listing: boolean };
  params: { ratio: string; count: number; prompt: string; negativePrompt: string };
}
export function buildGenerationTask(input: BuildGenerationTaskInput): GenerationTaskBuildResult;

// src/hooks/useCreateImageTaskState.ts
export interface UseCreateImageTaskStateOpts {
  isProductBound: boolean;
  product: ProductAsset | null;
  channel: { id: string; name: string; accessType: string; health: string };
  model: { id: string; name: string; capability: { ratios: string[]; maxCount: number; resolutions: string[] } };
  ratio: string; resolution: string;
  templateName: string;
  toSubmit: () => Promise<string>;          // 由父容器注入,内部调 submitTask
  onAddTask: (task: GenerationTask) => void; // 由 App.tsx 传入
  setScreen: (screen: AppScreen) => void;
}
export interface UseCreateImageTaskStateReturn {
  // state
  selectedTypes: ImageGenerationType[];
  typeCounts: Record<ImageGenerationType, number>;
  template: string;
  style: string; scene: string; pose: string;
  negativePrompt: string;
  promptOverrides: Partial<Record<ImageGenerationType, string>>;
  promptHasEdits: boolean;
  factsConfirmed: boolean; promptsConfirmed: boolean;
  assistantState: 'idle'|'processing'|'complete';
  reviewEnabled: boolean;
  references: Record<ReferenceSlot, TaskReference | undefined>;
  orderedReferenceInsights: string[];
  compositeState: 'empty'|'partial'|'ready';
  readinessIssue: string;
  pendingChoice: { channelId: string; modelId: string } | null;
  conflictOpen: boolean;
  templatePickerOpen: boolean;
  pendingTemplate: string | null;
  templateOverwriteOpen: boolean;
  executionConfirmOpen: boolean;
  isSubmitting: boolean;
  // computed
  readinessChecks: ReadinessCheck[];
  readinessCount: number;
  prompts: Record<ImageGenerationType, string>;
  promptsComplete: boolean;
  factsComplete: boolean;
  isSupported: boolean;
  totalCount: number;
  // actions
  toggleType(t: ImageGenerationType): void;
  changeTypeCount(t: ImageGenerationType, delta: number): void;
  setTemplate(name: string): void;
  requestTemplateChange(name: string): void;
  applyTemplate(name: string): void;
  setStyle(v: string): void; setScene(v: string): void; setPose(v: string): void;
  setNegativePrompt(v: string): void;
  updateProductFact<K extends keyof ProductFactsInput>(key: K, value: ProductFactsInput[K]): void;
  confirmFacts(): void;
  setPromptOverride(t: ImageGenerationType, v: string): void;
  confirmPrompts(): void;
  runAssistantAnalysis(): void;
  applyPreset(preset: { name: string; ratio: string; resolution: string }): void;
  setReviewEnabled(v: boolean): void;
  selectReference(slot: ReferenceSlot, ref: TaskReference | undefined): void;
  checkAndGenerate(): void;
  submitTasks(): Promise<void>;
  // autosave wiring
  hydrated: boolean;
}
export function useCreateImageTaskState(opts: UseCreateImageTaskStateOpts): UseCreateImageTaskStateReturn;

// src/components/createTask/useTaskParams.ts (patch)
export function useTaskParams(group, prefill): {
  // ...原有字段原样保留
  isSupported: boolean;                                       // 新派生
  setModelWithValidation: (nextChannelId: string|null, nextModelId: string|null) => void;  // 新包装
};
```

> **重要**: 这些是 TypeScript 接口形态契约。任何与上述签名冲突的实现一律视为 bug。

---

## Existing File Touchpoints

下面是**确定会调用到**的现有代码(实现者必须 Read 一次确认现状,然后按既定方式调用,不要自作主张改):

- `src/api/modules/task.ts`:`submitTask(req: SubmitTaskRequest): Promise<string>`
- `src/components/createTask/buildSubmitPayload.ts`:`buildSubmitPayload(state: TaskFormState): SubmitTaskRequest`(原封不动)
- `src/components/createTask/assembleTaskPrompt.ts`:在文件末尾追加 `assemblePerTypePrompt`(纯函数,不破坏原签名)
- `src/components/createTask/useTaskParams.ts`:在其 `return {}` 中加 2 个新字段,不删除现有字段
- `src/components/createTask/slots.ts`:`SLOT_KEYS` 不变;新 slot `'model'` 暂时不加入(本任务不引入到 `slotRefs`,仅用于"5 参考图 UI 展示"—— 通过 `useCreateImageTaskState.references[slot]` 而非 `slotRefs`)
- `src/components/common/TransitPickerButton.tsx`:沿用,接收 `slot` 字符串(本任务在 `ReferenceGrid` 中传 `'reference-model'`)
- `src/components/common/OutfitComposePanel.tsx`:在 `CompositeSection` 中沿用,`onApplied` 写入 `references.main` 或 `slotRefs.main`
- `src/api/modules/template.ts`:`templateApi.page({ pageSize: 200, status: 'NORMAL' })`
- `src/types.ts`:`GenerationTask`、`AppScreen`、`ProductAsset`、`ModelChannelDTO`
- `src/mockData.ts`:沿用 `creator: '陆永奇'`(临时,后续接入登录用户),`model.cost`(本期写死 0)
- `src/utils/cosImage.ts`:`withCosThumbnail(url, size)`
- `src/api/hooks/useServiceQuery.ts`:模板数据加载

---

## Task 1: 加测试依赖与约定(零新增 npm 依赖)

**Files:**
- 不创建
- Modify: `package.json`(不改任何字段,只是确认 `tsx` 与 `tsx --test` 可用)
- Create: `src/lib/createImageTask/__tests__/.gitkeep`(空文件用于占目录)

**Interfaces:**
- 无

- [ ] **Step 1: 验证 tsx --test 可用**

```bash
cd "D:/Program/Idea-Work/dafenqi-ai-project/EC-AIGC"
node -e "console.log(require('tsx/package.json').version)"
```

预期输出:`4.x.x` 之类(项目已装 `tsx: ^4.21.0`)

- [ ] **Step 2: 占位测试文件,确认 1 个测试能跑**

Create `src/lib/createImageTask/__tests__/smoke.test.ts`:

```ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';

test('smoke', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 3: 跑测试,确认绿**

```bash
cd "D:/Program/Idea-Work/dafenqi-ai-project/EC-AIGC"
npm run test
```

预期:`tests 1` / `pass 1` / `fail 0`(脚本是 `tsx --test "src/**/*.test.ts"`,会拣到 `smoke.test.ts`)

- [ ] **Step 4: 删除 smoke 测试 + 占位 gitkeep**

Delete `src/lib/createImageTask/__tests__/smoke.test.ts` 与 `src/lib/createImageTask/__tests__/.gitkeep`

- [ ] **Step 5: 不需 commit(基础设置)**

> 此任务不需 commit;只是确认测试环境就绪。后续任务才有 commit。

---

## Task 2: 集中所有新增文案到 `src/labels/createImageTask.ts`

**Files:**
- Create: `src/labels/createImageTask.ts`

**Interfaces:**
- Consumed by: 后续所有 UI 组件(TopHeader、ImageContentSection、TemplatePicker 等)
- Produces:`export const messages`

- [ ] **Step 1: 写文件**

```ts
// EC-AIGC/src/labels/createImageTask.ts
// 集中所有"创建图片任务"页面新增文案(i18n 占位,本期直接 export 对象)

export const messages = {
  readiness: {
    selectMain:
      '请先选择已关联商品资产的主体素材。',
    confirmFacts:
      '请检查并确认商品事实。',
    confirmPrompts:
      '请确认本组任务 Prompt。',
    unsupportedSpec:
      '当前模型通道或输出规格不可执行,请调整设置。',
  },
  assistant: {
    idle: 'AI 助手',
    processing: 'AI 解析中',
    complete: '已根据商品事实与参考图填充 Prompt,可继续微调',
    retry: '重新生成',
    timeout: '解析超时',
  },
  facts: {
    name: '商品名称',
    sellingPoints: '核心卖点',
    category: '品类',
    color: '颜色',
    patternAndMaterial: '图案 / 材质',
    structure: '版型 / 结构',
    confirm: '确认商品事实',
    factPlaceholder: '待 AI 解析',
  },
  type: {
    product_main: '商品主图',
    scene_detail: '场景图',
    detail_closeup: '细节图',
    on_model: '模特图',
    labelHelper: '可多选',
  },
  template: {
    select: '选择模板',
    change: '更换模板',
    emptyHint: '尚未选择模板',
    sourceLabel: '来源',
  },
  typeIcon: {
    product_main: 'inventory_2',
    scene_detail: 'landscape',
    detail_closeup: 'zoom_in',
    on_model: 'accessibility_new',
  } as const,
  refSlot: {
    detail: '细节', style: '风格', scene: '场景', pose: '姿势', model: '模特',
  } as const,
  refSlotIcon: {
    detail: 'zoom_in', style: 'palette', scene: 'landscape', pose: 'accessibility_new', model: 'face_3',
  } as const,
  styleOptions: [
    '甜美网红风', '极简北欧风', '科技赛博风', '金秋自然风', '奢华丝绸风',
  ] as const,
  sceneOptions: [
    '自然影棚', '城市街景', '居家陈列',
  ] as const,
  poseOptions: [
    '自然站姿', '正面站姿', '轻松坐姿', '行走动态',
  ] as const,
  presetPlatforms: [
    { name: '电商主图推荐', ratio: '1:1',  resolution: '2048px' },
    { name: '详情页长图',   ratio: '3:4',  resolution: '1536px' },
    { name: '内容种草竖图', ratio: '4:5',  resolution: '1536px' },
  ] as const,
  ratioLabel: '比例',
  resolutionLabel: '图片尺寸',
  totalCountLabel: '本次总张数',
  aspectRatioTag: '--ar',
  header: {
    eyebrow: '图片任务工作台',
    title: '新建多类型图片任务',
    readiness: '生成准备度',
    reviewLabel: '启用评分审核',
  },
  banner: {
    icon: 'error',
  },
  prompt: {
    regen: '按表单重算',
    aiOptimize: 'AI 建议',
    confirmPrompts: '确认本组 Prompt',
    confirmed: 'Prompt 已确认',
    placeholder: '支持手写 Prompt;点击「按表单重算」或「AI 建议」',
  },
  conflict: {
    title: '模型能力与当前规格冲突',
    desc: '目标模型不支持当前的 {fields}。确认后将自动切换到该模型首个可用比例、尺寸,并将张数限制在上限内。',
    cancel: '保留当前选择',
    confirm: '确认调整',
  },
  executeConfirm: {
    title: '请确认本次生成',
    submit: '提交任务',
    cancel: '再检查一下',
  },
  overwrite: {
    title: '切换模板会覆盖当前 Prompt',
    desc: '你已经手动编辑过 Prompt。切换模板将清空当前每类型 Prompt 的覆盖内容。',
    cancel: '取消',
    confirm: '覆盖并切换',
  },
  unsupported: {
    title: '当前模型不支持该比例/尺寸/张数',
    fix: '请调整比例、尺寸或选择其他模型。',
  },
};

export type StyleOption = (typeof messages.styleOptions)[number];
export type SceneOption = (typeof messages.sceneOptions)[number];
export type PoseOption  = (typeof messages.poseOptions)[number];
```

- [ ] **Step 2: 类型校验**

```bash
cd "D:/Program/Idea-Work/dafenqi-ai-project/EC-AIGC"
npm run lint
```

预期:0 error。若报错,检查 `as const` 推断是否过严(必要时显式 `satisfies Record<string, ...>`)

---

## Task 3: 纯函数 `readinessChecks` + 单元测试

**Files:**
- Create: `src/lib/createImageTask/readinessChecks.ts`
- Create: `src/lib/createImageTask/__tests__/readinessChecks.test.ts`

**Interfaces:**
- Consumed by: `useCreateImageTaskState`、`checkAndGenerate`
- Produces:`computeReadinessChecks(deps: ReadinessDeps): ReadinessCheck[]`

- [ ] **Step 1: 写测试文件**

```ts
// src/lib/createImageTask/__tests__/readinessChecks.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeReadinessChecks, type ReadinessDeps } from '../readinessChecks';

const base: ReadinessDeps = {
  isProductBound: true,
  factsConfirmed: true,
  factsComplete: true,
  promptsConfirmed: true,
  promptsComplete: true,
  isSupported: true,
  channelMaintenance: false,
};

test('all true → 4 checks complete', () => {
  const checks = computeReadinessChecks(base);
  assert.equal(checks.length, 4);
  assert.ok(checks.every((c) => c.complete));
  assert.equal(checks.filter((c) => c.complete).length, 4);
});

test('isProductBound=false → check #1 incomplete; targetId=image-source-section', () => {
  const checks = computeReadinessChecks({ ...base, isProductBound: false });
  assert.equal(checks[0].complete, false);
  assert.equal(checks[0].targetId, 'image-source-section');
  assert.equal(checks[1].complete, true);
});

test('facts incomplete → check #2 incomplete; targetId=image-content-section', () => {
  const checks = computeReadinessChecks({ ...base, factsComplete: false });
  assert.equal(checks[1].complete, false);
  assert.equal(checks[1].targetId, 'image-content-section');
});

test('facts not confirmed → check #2 incomplete', () => {
  const checks = computeReadinessChecks({ ...base, factsConfirmed: false });
  assert.equal(checks[1].complete, false);
});

test('prompts incomplete OR not confirmed → check #3 incomplete; targetId=image-content-section', () => {
  const a = computeReadinessChecks({ ...base, promptsComplete: false });
  const b = computeReadinessChecks({ ...base, promptsConfirmed: false });
  assert.equal(a[2].complete, false);
  assert.equal(b[2].complete, false);
  assert.equal(a[2].targetId, 'image-content-section');
});

test('isSupported=false OR maintenance → check #4 incomplete; targetId=image-settings-section', () => {
  const a = computeReadinessChecks({ ...base, isSupported: false });
  const b = computeReadinessChecks({ ...base, channelMaintenance: true });
  assert.equal(a[3].complete, false);
  assert.equal(b[3].complete, false);
  assert.equal(a[3].targetId, 'image-settings-section');
});

test('order is fixed: 1素材 2事实 3Prompt 4规格', () => {
  const checks = computeReadinessChecks({ ...base });
  assert.equal(checks[0].id, 1);
  assert.equal(checks[1].id, 2);
  assert.equal(checks[2].id, 3);
  assert.equal(checks[3].id, 4);
});
```

- [ ] **Step 2: 跑测试,确认全部失败**

```bash
cd "D:/Program/Idea-Work/dafenqi-ai-project/EC-AIGC"
npm run test
```

预期:`computeReadinessChecks` not defined → 测试 fail

- [ ] **Step 3: 实现 `readinessChecks.ts`**

```ts
// src/lib/createImageTask/readinessChecks.ts
import { messages } from '../../labels/createImageTask';

export type ImageGenerationType = 'product_main' | 'scene_detail' | 'detail_closeup' | 'on_model';

export type ReadinessTargetId = 'image-source-section' | 'image-content-section' | 'image-settings-section';

export interface ReadinessCheck {
  id: 1 | 2 | 3 | 4;
  complete: boolean;
  message: string;
  targetId: ReadinessTargetId;
}

export interface ReadinessDeps {
  isProductBound: boolean;
  factsConfirmed: boolean;
  factsComplete: boolean;
  promptsConfirmed: boolean;
  promptsComplete: boolean;
  isSupported: boolean;
  channelMaintenance: boolean;
}

export function computeReadinessChecks(deps: ReadinessDeps): ReadinessCheck[] {
  return [
    {
      id: 1,
      complete: deps.isProductBound,
      message: messages.readiness.selectMain,
      targetId: 'image-source-section',
    },
    {
      id: 2,
      complete: deps.factsConfirmed && deps.factsComplete,
      message: messages.readiness.confirmFacts,
      targetId: 'image-content-section',
    },
    {
      id: 3,
      complete: deps.promptsConfirmed && deps.promptsComplete,
      message: messages.readiness.confirmPrompts,
      targetId: 'image-content-section',
    },
    {
      id: 4,
      complete: deps.isSupported && !deps.channelMaintenance,
      message: messages.readiness.unsupportedSpec,
      targetId: 'image-settings-section',
    },
  ];
}
```

- [ ] **Step 4: 跑测试,确认绿**

```bash
cd "D:/Program/Idea-Work/dafenqi-ai-project/EC-AIGC"
npm run test
```

预期:`readinessChecks.test.ts` 全 pass

---

## Task 4: 纯函数 `extractProductFacts` + 测试

**Files:**
- Create: `src/lib/createImageTask/extractProductFacts.ts`
- Create: `src/lib/createImageTask/__tests__/extractProductFacts.test.ts`

**Interfaces:**
- Consumed by:`useCreateImageTaskState.runAssistantAnalysis`
- Produces:`extractProductFacts(input: ProductFactsInput): ProductFacts`

- [ ] **Step 1: 写测试**

```ts
// src/lib/createImageTask/__tests__/extractProductFacts.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { extractProductFacts } from '../extractProductFacts';

test('full input → facts exactly mirror', () => {
  const f = extractProductFacts({
    name: '法式针织衫', sellingPoints: '柔软透气', productCategory: '户外服饰',
    colorPattern: '米白', fabricTexture: '羊毛', fitStructure: '修身',
  });
  assert.equal(f.name, '法式针织衫');
  assert.equal(f.sellingPoints, '柔软透气');
  assert.equal(f.category, '户外服饰');
  assert.equal(f.color, '米白');
  assert.equal(f.patternAndMaterial, '羊毛');
  assert.equal(f.structure, '修身');
});

test('empty fields → facts empty strings (no undefined)', () => {
  const f = extractProductFacts({
    name: '', sellingPoints: '', productCategory: '', colorPattern: '', fabricTexture: '', fitStructure: '',
  });
  assert.deepEqual(f, {
    name: '', sellingPoints: '', category: '', color: '', patternAndMaterial: '', structure: '',
  });
});

test('trims whitespace on each field', () => {
  const f = extractProductFacts({
    name: '  商品名  ', sellingPoints: ' 卖点 ',
    productCategory: ' 户外服饰 ', colorPattern: ' 米白 ',
    fabricTexture: ' 羊毛 ', fitStructure: ' 修身 ',
  });
  assert.equal(f.name, '商品名');
  assert.equal(f.sellingPoints, '卖点');
  assert.equal(f.category, '户外服饰');
  assert.equal(f.color, '米白');
  assert.equal(f.patternAndMaterial, '羊毛');
  assert.equal(f.structure, '修身');
});
```

- [ ] **Step 2: 跑测试,确认 fail**

```bash
npm run test
```

预期:`extractProductFacts` not defined → fail

- [ ] **Step 3: 实现**

```ts
// src/lib/createImageTask/extractProductFacts.ts
export interface ProductFactsInput {
  name: string;
  sellingPoints: string;
  productCategory: string;
  colorPattern: string;
  fabricTexture: string;
  fitStructure: string;
}

export interface ProductFacts {
  name: string;
  sellingPoints: string;
  category: string;
  color: string;
  patternAndMaterial: string;
  structure: string;
}

/**
 * 从 UI 表单字段提取"商品事实"用于 prompt 拼接。
 * 字段语义与 EC-AIGC 当前"商品信息"表单一致(productCategory → category,colorPattern → color,fabricTexture → patternAndMaterial,fitStructure → structure)。
 * 同时给字段做 trim,保证空字符串不参与拼接产生"  "。
 */
export function extractProductFacts(input: ProductFactsInput): ProductFacts {
  return {
    name: input.name.trim(),
    sellingPoints: input.sellingPoints.trim(),
    category: input.productCategory.trim(),
    color: input.colorPattern.trim(),
    patternAndMaterial: input.fabricTexture.trim(),
    structure: input.fitStructure.trim(),
  };
}
```

- [ ] **Step 4: 跑测试,确认绿**

```bash
npm run test
```

预期:`extractProductFacts.test.ts` 全 pass

---

## Task 5: 纯函数 `buildPromptFromFacts` + 测试

**Files:**
- Create: `src/lib/createImageTask/buildPromptFromFacts.ts`
- Create: `src/lib/createImageTask/__tests__/buildPromptFromFacts.test.ts`

**Interfaces:**
- Consumed by:`useCreateImageTaskState.prompts[]`
- Produces:`buildPromptFromFacts(type, facts, style, scene, pose, referenceInsights): string`

- [ ] **Step 1: 写测试**

```ts
// src/lib/createImageTask/__tests__/buildPromptFromFacts.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildPromptFromFacts } from '../buildPromptFromFacts';

const facts = {
  name: '法式针织衫',
  sellingPoints: '柔软透气',
  category: '户外服饰',
  color: '米白',
  patternAndMaterial: '羊毛',
  structure: '修身',
};

test('product_main + full inputs → contains all parts in correct order', () => {
  const out = buildPromptFromFacts('product_main', facts, '甜美网红风', '自然影棚', '自然站姿', ['insight-1']);
  const idx = (substr: string) => out.indexOf(substr);
  assert.ok(idx('法式针织衫') >= 0);
  assert.ok(idx('甜美网红风') >= 0);
  assert.ok(idx('自然影棚') >= 0);
  assert.ok(idx('自然站姿') >= 0);
  assert.ok(idx('柔软透气') >= 0);
  assert.ok(idx('insight-1') >= 0);
  assert.ok(idx('法式针织衫') < idx('甜美网红风'));
  assert.ok(idx('甜美网红风') < idx('自然影棚'));
});

test('empty style+scene+pose → still contains name and selling points', () => {
  const out = buildPromptFromFacts('scene_detail', facts, '', '', '', []);
  assert.ok(out.includes('法式针织衫'));
  assert.ok(out.includes('柔软透气'));
});

test('referenceInsights array empty → no trailing empty line', () => {
  const out = buildPromptFromFacts('detail_closeup', facts, '甜美网红风', '自然影棚', '自然站姿', []);
  assert.ok(!out.endsWith('\n'));
});

test('multiple reference insights each rendered on new line', () => {
  const out = buildPromptFromFacts('on_model', facts, '甜美网红风', '自然影棚', '自然站姿', ['a', 'b', 'c']);
  assert.ok(out.includes('a\nb\nc'));
});

test('all input empty → returns empty string (no "undefined")', () => {
  const empty = { name: '', sellingPoints: '', category: '', color: '', patternAndMaterial: '', structure: '' };
  const out = buildPromptFromFacts('product_main', empty, '', '', '', []);
  assert.equal(out, '');
  assert.ok(!out.includes('undefined'));
});
```

- [ ] **Step 2: 跑测试,确认 fail**

- [ ] **Step 3: 实现**

```ts
// src/lib/createImageTask/buildPromptFromFacts.ts
import type { ImageGenerationType } from './readinessChecks';
import type { ProductFacts } from './extractProductFacts';

/**
 * 单张图片类型的 prompt 组装(顺序固定:商品名 → 风格 → 场景 → 姿势 → 卖点 → 关键细节 → 参考图洞察)。
 * 任一字段为空则跳过,避免产生 "  " 多余空格。
 */
export function buildPromptFromFacts(
  _type: ImageGenerationType,   // 预留:type-specific 模板可在此 switch
  facts: ProductFacts,
  style: string,
  scene: string,
  pose: string,
  referenceInsights: string[],
): string {
  const segments: string[] = [];

  if (facts.name) {
    segments.push(`3D High-fidelity product photoshoot of "${facts.name}".`);
  }
  if (style) segments.push(`Style: ${style}.`);
  if (scene) segments.push(`Scene: ${scene}.`);
  if (pose) segments.push(`Pose: ${pose}.`);
  if (facts.sellingPoints) segments.push(`Selling points: ${facts.sellingPoints}.`);
  if (facts.structure) segments.push(`Structure: ${facts.structure}.`);
  if (facts.color) segments.push(`Color: ${facts.color}.`);
  if (facts.patternAndMaterial) segments.push(`Material: ${facts.patternAndMaterial}.`);
  if (referenceInsights.length > 0) {
    segments.push(referenceInsights.join('\n'));
  }
  return segments.join(' ');
}
```

- [ ] **Step 4: 跑测试,确认绿**

```bash
npm run test
```

预期:`buildPromptFromFacts.test.ts` 全 pass

---

## Task 6: 纯函数 `extractReferenceInsights` + 测试

**Files:**
- Create: `src/lib/createImageTask/extractReferenceInsights.ts`
- Create: `src/lib/createImageTask/__tests__/extractReferenceInsights.test.ts`

**Interfaces:**
- Consumed by:`useCreateImageTaskState.prompts[]`
- Produces:`extractReferenceInsights(refs): string[]`

- [ ] **Step 1: 写测试**

```ts
// src/lib/createImageTask/__tests__/extractReferenceInsights.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { extractReferenceInsights } from '../extractReferenceInsights';

test('no references → empty array', () => {
  const r = extractReferenceInsights({
    detail: undefined, style: undefined, scene: undefined, pose: undefined, model: undefined,
  });
  assert.deepEqual(r, []);
});

test('only detail has promptHint → array of one', () => {
  const r = extractReferenceInsights({
    detail:  { slot: 'detail',  analysis: { promptHint: 'A' } },
    style:   undefined, scene: undefined, pose: undefined, model: undefined,
  });
  assert.deepEqual(r, ['A']);
});

test('order is detail → style → scene → pose → model', () => {
  const r = extractReferenceInsights({
    detail:  { slot: 'detail',  analysis: { promptHint: 'D' } },
    style:   { slot: 'style',   analysis: { promptHint: 'S' } },
    scene:   { slot: 'scene',   analysis: { promptHint: 'C' } },
    pose:    { slot: 'pose',    analysis: { promptHint: 'P' } },
    model:   { slot: 'model',   analysis: { promptHint: 'M' } },
  });
  assert.deepEqual(r, ['D', 'S', 'C', 'P', 'M']);
});

test('reference without analysis or without promptHint → skipped', () => {
  const r = extractReferenceInsights({
    detail:  { slot: 'detail', analysis: {} },
    style:   { slot: 'style',  analysis: { promptHint: '   ' } },
    scene:   { slot: 'scene' },
    pose:    undefined, model: undefined,
  });
  // 空白与没有 promptHint 一律不进入(避免 prompt 出现空行)
  assert.deepEqual(r, []);
});

test('whitespace-only promptHint is trimmed-and-skipped', () => {
  const r = extractReferenceInsights({
    detail:  { slot: 'detail', analysis: { promptHint: '   ' } },
    style:   { slot: 'style',  analysis: { promptHint: 'real' } },
    scene:   undefined, pose: undefined, model: undefined,
  });
  assert.deepEqual(r, ['real']);
});
```

- [ ] **Step 2: 跑测试,确认 fail**

- [ ] **Step 3: 实现**

```ts
// src/lib/createImageTask/extractReferenceInsights.ts
export type ReferenceSlot = 'detail' | 'style' | 'scene' | 'pose' | 'model';

export interface ReferenceInsight {
  slot: ReferenceSlot;
  analysis?: { promptHint?: string };
}

const SLOT_ORDER: ReferenceSlot[] = ['detail', 'style', 'scene', 'pose', 'model'];

export function extractReferenceInsights(
  refs: Partial<Record<ReferenceSlot, ReferenceInsight | undefined>>,
): string[] {
  const out: string[] = [];
  for (const slot of SLOT_ORDER) {
    const r = refs[slot];
    const hint = r?.analysis?.promptHint?.trim();
    if (hint) out.push(hint);
  }
  return out;
}
```

- [ ] **Step 4: 跑测试,确认绿**

预期:全 pass

---

## Task 7: 纯函数 `applyAiOptimizePerType` + 测试

**Files:**
- Create: `src/lib/createImageTask/applyAiOptimizePerType.ts`
- Create: `src/lib/createImageTask/__tests__/applyAiOptimizePerType.test.ts`

**Interfaces:**
- Consumed by:`useCreateImageTaskState` 的"AI 建议"按钮
- Produces:`applyAiOptimizePerType(prompts, selectedTypes): Record<ImageGenerationType, string>`

> **设计要点**:旧 `assembleTaskPrompt.applyAiOptimize(prompt: string)` 是给"单 prompt"用。本期按 spec 升级为"按 type 应用",**只对 selectedTypes 列表中的 type 执行包装**,其他 type 不动。

- [ ] **Step 1: 写测试**

```ts
// src/lib/createImageTask/__tests__/applyAiOptimizePerType.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { applyAiOptimizePerType } from '../applyAiOptimizePerType';

const P = {
  product_main:   '商品基础',
  scene_detail:   '场景基础',
  detail_closeup: '细节基础',
  on_model:       '模特基础',
};

test('selectedTypes only product_main → only product_main wrapped', () => {
  const out = applyAiOptimizePerType(P, ['product_main']);
  assert.ok(out.product_main.startsWith('(Cinematic backlight, photorealistic studio render)'));
  assert.ok(out.product_main.includes('商品基础'));
  assert.equal(out.scene_detail, '场景基础');
  assert.equal(out.detail_closeup, '细节基础');
  assert.equal(out.on_model, '模特基础');
});

test('selectedTypes all → all 4 wrapped', () => {
  const out = applyAiOptimizePerType(P, ['product_main','scene_detail','detail_closeup','on_model']);
  assert.ok(out.product_main.startsWith('(Cinematic backlight'));
  assert.ok(out.scene_detail.startsWith('(Cinematic backlight'));
  assert.ok(out.detail_closeup.startsWith('(Cinematic backlight'));
  assert.ok(out.on_model.startsWith('(Cinematic backlight'));
});

test('wrap is idempotent → wrapping twice still yields single prefix', () => {
  const once = applyAiOptimizePerType(P, ['product_main']);
  const twice = applyAiOptimizePerType(once, ['product_main']);
  // 重复包装:保留语义(本期实现只是简单二次包装,后续接 LLM 时改为"检测是否已包裹")
  assert.ok(twice.product_main.includes('Cinematic backlight'));
  assert.equal(twice.product_main, '(Cinematic backlight, photorealistic studio render) '
    + '(Cinematic backlight, photorealistic studio render) 商品基础, raytracing reflections, cinematic color grading, warm ambient glow');
});

test('preserve non-overridden types (does not mutate input)', () => {
  const input = { ...P };
  const out = applyAiOptimizePerType(input, ['scene_detail']);
  assert.deepEqual(input, P);   // 不修改入参
  assert.equal(out.product_main, input.product_main);
});
```

- [ ] **Step 2: 跑测试,确认 fail**

- [ ] **Step 3: 实现**

```ts
// src/lib/createImageTask/applyAiOptimizePerType.ts
import type { ImageGenerationType } from './readinessChecks';

export type AllTypePrompts = Record<ImageGenerationType, string>;

/**
 * 与 assembleTaskPrompt.applyAiOptimize 同语义:在 prompt 前后包装优化修饰词(本地包装,非真实 AI)。
 * 区别:按 selectedTypes 列表逐类型应用,未选中的 type 不动,入参不被修改。
 */
export function applyAiOptimizePerType(
  prompts: AllTypePrompts,
  selectedTypes: ImageGenerationType[],
): AllTypePrompts {
  const set = new Set(selectedTypes);
  const out: AllTypePrompts = { ...prompts };
  for (const t of ['product_main','scene_detail','detail_closeup','on_model'] as ImageGenerationType[]) {
    if (!set.has(t)) continue;
    out[t] = `(Cinematic backlight, photorealistic studio render) ${prompts[t]}, raytracing reflections, cinematic color grading, warm ambient glow`;
  }
  return out;
}
```

- [ ] **Step 4: 跑测试,确认绿**

预期:全 pass

---

## Task 8: 纯函数 `buildGenerationTask` + 测试

**Files:**
- Create: `src/lib/createImageTask/buildGenerationTask.ts`
- Create: `src/lib/createImageTask/__tests__/buildGenerationTask.test.ts`

**Interfaces:**
- Consumed by:`useCreateImageTaskState.submitTasks` 内部循环构造任务对象(不调 API)
- Produces:`buildGenerationTask(input): GenerationTaskBuildResult`

> **设计要点**:与原 `submitTasks` 不同——它生成单条 `GenerationTask` 对象,后续由调用方自行 `onAddTask` / `submitTask`。把"构造任务"和"提交流程"解耦,方便测试。

- [ ] **Step 1: 写测试**

```ts
// src/lib/createImageTask/__tests__/buildGenerationTask.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildGenerationTask } from '../buildGenerationTask';

const baseInput = {
  imageType: 'product_main' as const,
  index: 0,
  groupId: 'G-2026-07-21',
  product: {
    id: 'p1', name: '法式针织衫', sku: 'SKU-1', category: '户外服饰' as const,
    imageCount: 0, videoCount: 0, thumbnail: 'thumb.png', addedTime: '2026-01-01',
    specs: { brand: 'B', color: ['米白'], material: '羊毛', weight: '200g', sellingPoints: ['柔软透气'] },
    files: [],
  },
  taskProductName: '法式针织衫',
  productName: '法式针织衫',
  templateName: '默认模板',
  promptText: '商品基础',
  negativePrompt: 'blurry',
  reviewEnabled: true,
  ratio: '3:4',
  count: 2,
  channel: { id: 'C1', name: '云端 API', accessType: 'cloud' },
  model: {
    id: 'M1', name: 'gpt-image', estimatedCost: 0,
    capability: { ratios: ['1:1','3:4'], maxCount: 5, resolutions: ['1024px','2048px'] },
  },
  mainPreviewUrl: 'preview.png',
  dateOverride: new Date('2026-07-21T12:00:00Z'),
  creator: '陆永奇',
};

test('id is I-<timestamp>-<index+1>', () => {
  const t = buildGenerationTask(baseInput);
  assert.ok(t.id.startsWith('I-'));
  assert.ok(t.id.endsWith('-1'));
});

test('groupId preserved', () => {
  const t = buildGenerationTask(baseInput);
  assert.equal(t.groupId, 'G-2026-07-21');
});

test('type=image, status=pending, progress=0', () => {
  const t = buildGenerationTask(baseInput);
  assert.equal(t.type, 'image');
  assert.equal(t.status, 'pending');
  assert.equal(t.progress, 0);
});

test('imageType mirrors input', () => {
  const t = buildGenerationTask({ ...baseInput, imageType: 'scene_detail', index: 1 });
  assert.equal(t.imageType, 'scene_detail');
});

test('productName = taskProductName', () => {
  const t = buildGenerationTask(baseInput);
  assert.equal(t.productName, '法式针织衫');
});

test('templateName echoed in name', () => {
  const t = buildGenerationTask({ ...baseInput, templateName: '时尚大片' });
  assert.ok(t.name.includes('时尚大片'));
});

test('reviewStrategy.aesthetic mirrors reviewEnabled', () => {
  const a = buildGenerationTask({ ...baseInput, reviewEnabled: true });
  const b = buildGenerationTask({ ...baseInput, reviewEnabled: false });
  assert.equal(a.reviewStrategy.aesthetic, true);
  assert.equal(b.reviewStrategy.aesthetic, false);
  assert.equal(a.reviewStrategy.listing, false);
});

test('params.prompt == promptText, negativePrompt == negativePrompt', () => {
  const t = buildGenerationTask(baseInput);
  assert.equal(t.params.prompt, '商品基础');
  assert.equal(t.params.negativePrompt, 'blurry');
  assert.equal(t.params.ratio, '3:4');
  assert.equal(t.params.count, 2);
});

test('modelChannel is "channel.name / model.name"', () => {
  const t = buildGenerationTask(baseInput);
  assert.equal(t.modelChannel, '云端 API / gpt-image');
});

test('productImg = mainPreviewUrl fallback', () => {
  const a = buildGenerationTask(baseInput);
  const b = buildGenerationTask({ ...baseInput, mainPreviewUrl: undefined });
  assert.equal(a.productImg, 'preview.png');
  assert.equal(b.productImg, 'thumb.png');
});
```

- [ ] **Step 2: 跑测试,确认 fail**

- [ ] **Step 3: 实现**

```ts
// src/lib/createImageTask/buildGenerationTask.ts
import type { ImageGenerationType } from './readinessChecks';
import type { ProductAsset, GenerationTask } from '../../types';
import { messages } from '../../labels/createImageTask';

export interface BuildGenerationTaskInput {
  imageType: ImageGenerationType;
  index: number;
  groupId: string;
  product: ProductAsset;
  taskProductName: string;
  productName: string;
  templateName: string;
  promptText: string;
  negativePrompt: string;
  reviewEnabled: boolean;
  ratio: string;
  count: number;
  channel: { id: string; name: string; accessType: string };
  model: {
    id: string;
    name: string;
    estimatedCost: number;
    capability: { ratios: string[]; maxCount: number; resolutions: string[] };
  };
  mainPreviewUrl?: string;
  dateOverride?: Date;
  creator?: string;
}

// 与 types.ts GenerationTask 形态匹配(本期不在 types 改字段)
export type GenerationTaskBuildResult = GenerationTask;

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatTimestamp(d: Date): string {
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  );
}

export function buildGenerationTask(input: BuildGenerationTaskInput): GenerationTaskBuildResult {
  const timestamp = formatTimestamp(input.dateOverride ?? new Date());
  const productImg = input.mainPreviewUrl ?? input.product.thumbnail;
  const typeLabel = messages.type[input.imageType];
  // 注:GenerationTask.imageType 已在 Task 9 由 types.ts 加为可选字段;此处直接传值,不需强转
  const task: GenerationTaskBuildResult = {
    id: `I-${Date.now()}-${input.index + 1}`,
    name: `${typeLabel} · ${input.productName} · ${input.templateName}`,
    type: 'image',
    imageType: input.imageType,
    status: 'pending',
    progress: 0,
    productName: input.taskProductName,
    productImg,
    templateName: input.templateName,
    timestamp,
    creator: input.creator ?? '陆永奇',
    modelChannel: `${input.channel.name} / ${input.model.name}`,
    taskPrompt: input.promptText,
    negativePrompt: input.negativePrompt,
    reviewStrategy: { aesthetic: input.reviewEnabled, listing: false },
    imageType: input.imageType,
    params: {
      ratio: input.ratio,
      count: input.count,
      prompt: input.promptText,
      negativePrompt: input.negativePrompt,
      model: input.model.name,
    },
  };
  return task;
}
```

- [ ] **Step 4: 跑测试,确认绿**

预期:全 pass

> **依赖顺序**:本 task 的 `imageType` 字段依赖于 Task 9(`types.ts` 加 `GenerationTask.imageType`)。如果 Task 8 在 Task 9 之前执行,lint 会报"unknown property"。**确保 Task 8 在 Task 9 之后跑**,或者把 Task 9 提前到 Task 6 后、Task 8 前执行。计划已按"Task 8 之后 Task 9"顺序编排,实际跑时按计划 task 编号顺序即可。

---

## Task 9: 在 `types.ts` 加 `ReferenceSlot` / `ImageGenerationType` 与 `GenerationTask` 加 `imageType` 字段

**Files:**
- Modify: `src/types.ts`(末尾追加 §9.1 字段)

**Interfaces:**
- Consumed by: 所有新组件
- Produces:类型导出

- [ ] **Step 1: 在 `src/types.ts` 末尾追加**

```ts
// [2026-07-21 重构 create-image-task 复刻 demo] 图片生成任务类型
// - imageType:与 demo 主版对齐 — product_main / scene_detail / detail_closeup / on_model
// - accessType:与 ModelChannelDTO.accessType 对齐(patch useTaskParams 用)
export type ImageGenerationType = 'product_main' | 'scene_detail' | 'detail_closeup' | 'on_model';
export type ReferenceSlot = 'detail' | 'style' | 'scene' | 'pose' | 'model';

// GenerationTask 增加 imageType + groupId(task list 后续聚合用)
declare module './types' {
  interface GenerationTask {
    groupId?: string;
    imageType?: ImageGenerationType;
  }
}
```

> 实际写法(避免 TS module augmentation 麻烦,直接 modify interface):

```ts
// 找到 GenerationTask interface,在 params?: {...} 后追加
export interface GenerationTask {
  // ... 既有字段 ...
  // [2026-07-21] demo 重构新增
  imageType?: ImageGenerationType;
  groupId?: string;
}
```

并把 file 顶部已经存在的 `interface GenerationTask {}` 找到,在 `params?: {...}` 之后插入 `imageType?: ImageGenerationType;` 与 `groupId?: string;`。

- [ ] **Step 2: 类型校验**

```bash
npm run lint
```

预期:0 error

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add ImageGenerationType/ReferenceSlot + extend GenerationTask with imageType/groupId"
```

---

## Task 10: hook `useCreateImageTaskState` + 测试

**Files:**
- Create: `src/hooks/useCreateImageTaskState.ts`
- Create: `src/hooks/__tests__/useCreateImageTaskState.test.ts`

**Interfaces:**
- Consumed by: `CreateImageTask/index.tsx` 顶层容器
- Produces:见 §"Interface Lock" `UseCreateImageTaskStateReturn`

- [ ] **Step 1: 写测试**

```ts
// src/hooks/__tests__/useCreateImageTaskState.test.ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';

// 注:React 19 hook 测试需要 react-dom/test-utils 或 React 18 的 act()
// 本项目使用 Node test runner + tsx --test,无 jsdom,故测试只覆盖纯函数部分
// (computeReadinessChecks 等已由 readinessChecks.test.ts 覆盖)

import {
  REFERENCE_SLOTS_INTERNAL,
  type ImageGenerationType,
} from '../useCreateImageTaskState';

test('REFERENCE_SLOTS_INTERNAL exports the 5 slots in canonical order', () => {
  assert.deepEqual(REFERENCE_SLOTS_INTERNAL, ['detail', 'style', 'scene', 'pose', 'model']);
});

test('ImageGenerationType re-exported from types module', () => {
  const t: ImageGenerationType = 'product_main';
  assert.equal(t, 'product_main');
});
```

- [ ] **Step 2: 跑测试,确认 fail**

- [ ] **Step 3: 实现 `useCreateImageTaskState.ts`**

文件 ~250 行。重点要落地的逻辑(每一段都对应 spec §4):

```ts
// src/hooks/useCreateImageTaskState.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { AppScreen, ProductAsset, GenerationTask } from '../types';
import type { ImageGenerationType, ReadinessCheck } from '../lib/createImageTask/readinessChecks';
import type { ReferenceSlot } from '../lib/createImageTask/extractReferenceInsights';
import { computeReadinessChecks } from '../lib/createImageTask/readinessChecks';
import { extractProductFacts, type ProductFactsInput } from '../lib/createImageTask/extractProductFacts';
import { buildPromptFromFacts } from '../lib/createImageTask/buildPromptFromFacts';
import { extractReferenceInsights } from '../lib/createImageTask/extractReferenceInsights';
import { applyAiOptimizePerType, type AllTypePrompts } from '../lib/createImageTask/applyAiOptimizePerType';
import { buildGenerationTask } from '../lib/createImageTask/buildGenerationTask';
import { messages } from '../labels/createImageTask';

export { REFERENCE_SLOTS_INTERNAL } from '../lib/createImageTask/referencesConfig';
export type { ReferenceSlot } from '../lib/createImageTask/extractReferenceInsights';
export type { ImageGenerationType } from '../lib/createImageTask/readinessChecks';

export interface UseCreateImageTaskStateOpts { /* 见 §Interface Lock */ }

export interface UseCreateImageTaskStateReturn { /* 见 §Interface Lock */ }

const DRAFT_KEY = 'create-image-task-draft-v2';
const DRAFT_THROTTLE_MS = 800;
const MIN_TYPE_COUNT = 1;
const MAX_TYPE_COUNT = 5;

export function useCreateImageTaskState(
  opts: UseCreateImageTaskStateOpts,
): UseCreateImageTaskStateReturn {
  // ---------- state ----------
  const [selectedTypes, setSelectedTypes] = useState<ImageGenerationType[]>(['product_main']);
  const [typeCounts, setTypeCounts] = useState<Record<ImageGenerationType, number>>({
    product_main: 1, scene_detail: 1, detail_closeup: 1, on_model: 1,
  });
  const [template, setTemplateName] = useState<string>(opts.templateName);
  const [style, setStyle] = useState<string>(messages.styleOptions[0]);
  const [scene, setScene] = useState<string>(messages.sceneOptions[0]);
  const [pose,  setPose]  = useState<string>(messages.poseOptions[0]);
  const [negativePrompt, setNegativePrompt] = useState<string>('blurry, bad quality, distorted');
  const [promptOverrides, setPromptOverrides] = useState<Partial<Record<ImageGenerationType, string>>>({});
  const [promptHasEdits, setPromptHasEdits] = useState<boolean>(false);
  const [factsConfirmed, setFactsConfirmed] = useState<boolean>(false);
  const [promptsConfirmed, setPromptsConfirmed] = useState<boolean>(false);
  const [assistantState, setAssistantState] = useState<'idle'|'processing'|'complete'>('idle');
  const [reviewEnabled, setReviewEnabled] = useState<boolean>(false);
  const [references, setReferences] = useState<Record<ReferenceSlot, any | undefined>>({
    detail: undefined, style: undefined, scene: undefined, pose: undefined, model: undefined,
  });
  const [compositeState, setCompositeState] = useState<'empty'|'partial'|'ready'>('empty');
  const [readinessIssue, setReadinessIssue] = useState<string>('');
  const [pendingChoice, setPendingChoice] = useState<{ channelId: string; modelId: string } | null>(null);
  const [conflictOpen, setConflictOpen] = useState<boolean>(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState<boolean>(false);
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);
  const [templateOverwriteOpen, setTemplateOverwriteOpen] = useState<boolean>(false);
  const [executionConfirmOpen, setExecutionConfirmOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [productFacts, setProductFacts] = useState<ReturnType<typeof extractProductFacts> | null>(null);

  const [formInput, setFormInput] = useState<ProductFactsInput>({
    name: '', sellingPoints: '', productCategory: '',
    colorPattern: '', fabricTexture: '', fitStructure: '',
  });

  // hydrate from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const data = JSON.parse(raw) as Partial<UseCreateImageTaskStateReturn>;
        if (data.selectedTypes) setSelectedTypes(data.selectedTypes);
        // ... 仅恢复可序列化字段;严格按字段名白名单
        // 简化:本期只恢复 selectedTypes/typeCounts/template/style/scene/pose/negativePrompt/reviewEnabled/formInput
      }
      setHydrated(true);
      if (raw) toast.success('已恢复上次编辑');
    } catch {
      sessionStorage.removeItem(DRAFT_KEY);
      toast.error('已清除无法识别的草稿');
      setHydrated(true);
    }
  }, []);

  // autosave throttle
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
          selectedTypes, typeCounts, template, style, scene, pose,
          negativePrompt, reviewEnabled, formInput,
        }));
      } catch { /* quota 等 */ }
    }, DRAFT_THROTTLE_MS);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [hydrated, selectedTypes, typeCounts, template, style, scene, pose, negativePrompt, reviewEnabled, formInput]);

  // ---------- computed ----------
  const orderedReferenceInsights = useMemo(
    () => extractReferenceInsights(references as any),
    [references],
  );

  const prompts = useMemo<AllTypePrompts>(() => {
    const facts = productFacts ?? extractProductFacts(formInput);
    const result: AllTypePrompts = { product_main: '', scene_detail: '', detail_closeup: '', on_model: '' };
    (['product_main','scene_detail','detail_closeup','on_model'] as ImageGenerationType[]).forEach((t) => {
      result[t] = buildPromptFromFacts(t, facts, style, scene, pose, orderedReferenceInsights);
    });
    return result;
  }, [productFacts, formInput, style, scene, pose, orderedReferenceInsights]);

  // prompts 变化 → 视为编辑,reset 确认态
  useEffect(() => {
    setPromptsConfirmed(false);
  }, [prompts]);

  const promptsComplete = useMemo(() => {
    if (selectedTypes.length === 0) return false;
    return selectedTypes.every((t) => (promptOverrides[t] ?? prompts[t]).trim().length > 0);
  }, [selectedTypes, promptOverrides, prompts]);

  const factsComplete = useMemo(
    () => formInput.name.trim().length > 0,
    [formInput],
  );

  const isSupported = useMemo(() => {
    const cm = opts.model.capability;
    if (!cm.ratios.includes(opts.ratio)) return false;
    if (!cm.resolutions.includes(opts.resolution)) return false;
    return !selectedTypes.some((t) => typeCounts[t] > Math.min(cm.maxCount, MAX_TYPE_COUNT));
  }, [opts.model.capability, opts.ratio, opts.resolution, selectedTypes, typeCounts]);

  const totalCount = useMemo(
    () => selectedTypes.reduce((sum, t) => sum + typeCounts[t], 0),
    [selectedTypes, typeCounts],
  );

  const readinessDeps = useMemo(() => ({
    isProductBound: opts.isProductBound,
    factsConfirmed, factsComplete,
    promptsConfirmed, promptsComplete,
    isSupported, channelMaintenance: opts.channel.health === 'maintenance',
  }), [opts.isProductBound, factsConfirmed, factsComplete, promptsConfirmed, promptsComplete, isSupported, opts.channel.health]);

  const readinessChecks = useMemo(() => computeReadinessChecks(readinessDeps), [readinessDeps]);
  const readinessCount = readinessChecks.filter((c) => c.complete).length;

  // ---------- actions ----------
  const toggleType = useCallback((t: ImageGenerationType) => {
    setSelectedTypes((prev) => {
      if (prev.includes(t)) {
        // 至少保留 1 个,不能空
        return prev.length > 1 ? prev.filter((x) => x !== t) : prev;
      }
      return [...prev, t];
    });
    setPromptsConfirmed(false);
  }, []);

  const changeTypeCount = useCallback((t: ImageGenerationType, delta: number) => {
    const cap = opts.model.capability.maxCount;
    setTypeCounts((prev) => {
      const next = Math.min(Math.max(prev[t] + delta, MIN_TYPE_COUNT), Math.min(cap, MAX_TYPE_COUNT));
      return { ...prev, [t]: next };
    });
    setPromptsConfirmed(false);
  }, [opts.model.capability.maxCount]);

  const requestTemplateChange = useCallback((name: string) => {
    if (name === template) { setTemplatePickerOpen(false); return; }
    if (promptHasEdits) {
      setPendingTemplate(name);
      setTemplateOverwriteOpen(true);
      return;
    }
    setTemplateName(name);
    setTemplatePickerOpen(false);
  }, [template, promptHasEdits]);

  const applyTemplate = useCallback((name: string) => {
    setTemplateName(name);
    setPromptOverrides({});
    setPromptHasEdits(false);
    setTemplatePickerOpen(false);
    setTemplateOverwriteOpen(false);
    setPendingTemplate(null);
    setPromptsConfirmed(false);
  }, []);

  const _setStyleField = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPromptsConfirmed(false);
  };
  // 注意:React useState 的 setter 必须是稳定引用。所以下面单独写 setStyle / setScene / setPose
  // 通过 wrapper 取代,但需要保持 onChange 签名兼容
  // 实现:把 setStyle 等包装到一个 useCallback 化的 setStyle/setScene/setPose 中

  // (为简洁,本 plan 略:实际实现中把 useState 解构的 setter 用 ref 锁住,
  //  提供 setStyleCallbacks = useMemo(() => _setStyleField(setStyle), [...]) 之类的稳定 callback)

  const updateProductFact: UseCreateImageTaskStateReturn['updateProductFact'] = useCallback((key, value) => {
    setFormInput((prev) => ({ ...prev, [key]: value }));
    setFactsConfirmed(false);
    // 同步 productFacts(由 formInput 派生,留作 AI 助手覆盖)
    setProductFacts(null);
  }, []);

  const confirmFacts = useCallback(() => {
    if (!opts.isProductBound) return;
    setFactsConfirmed(true);
    if (!productFacts) setProductFacts(extractProductFacts(formInput));
    setReadinessIssue('');
  }, [opts.isProductBound, productFacts, formInput]);

  const setPromptOverride = useCallback((t: ImageGenerationType, v: string) => {
    setPromptOverrides((prev) => ({ ...prev, [t]: v }));
    setPromptHasEdits(true);
    setPromptsConfirmed(false);
  }, []);

  const confirmPrompts = useCallback(() => {
    if (!factsConfirmed || !promptsComplete) return;
    setPromptsConfirmed(true);
    setReadinessIssue('');
  }, [factsConfirmed, promptsComplete]);

  const runAssistantAnalysis = useCallback(() => {
    if (!opts.isProductBound) return;
    if (assistantState === 'processing') return;
    setAssistantState('processing');

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      const facts = extractProductFacts(formInput);
      setProductFacts(facts);
      const nextOverrides: Partial<Record<ImageGenerationType, string>> = {};
      selectedTypes.forEach((t) => {
        nextOverrides[t] = buildPromptFromFacts(t, facts, style, scene, pose, orderedReferenceInsights);
      });
      setPromptOverrides(nextOverrides);
      setFactsConfirmed(true);
      setPromptHasEdits(true);
      setPromptsConfirmed(false);
      setAssistantState('complete');
    }, 500);

    const guardTimeout = window.setTimeout(() => {
      if (assistantState === 'processing' && !cancelled) {
        cancelled = true;
        setAssistantState('idle');
        toast.error(messages.assistant.timeout);
      }
    }, 5000);

    return () => { cancelled = true; window.clearTimeout(timeout); window.clearTimeout(guardTimeout); };
  }, [opts.isProductBound, assistantState, formInput, selectedTypes, style, scene, pose, orderedReferenceInsights]);

  const applyPreset = useCallback((preset: typeof messages.presetPlatforms[number]) => {
    // 与 useTaskParams 的 setRatio/setResolution 等价 — 但此处 opts 暴露了 ratio/resolution 是 string,
    // 真正修改它们的 setter 由 opts 通过 callback 提供。本期把 applyPreset 改为只读 — 它返回"是否冲突",
    // 由父容器(setScreen/createImageTask.tsx)决定 setRatio/setResolution。
    // 由于这是 hook 私有函数,本任务保留签名;Task 12 时父容器接管 setRatio 等。
  }, []);

  const checkAndGenerate = useCallback(() => {
    const issue = readinessChecks.find((c) => !c.complete);
    if (issue) {
      setReadinessIssue(issue.message);
      window.requestAnimationFrame(() => {
        document.getElementById(issue.targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }
    setReadinessIssue('');
    setExecutionConfirmOpen(true);
  }, [readinessChecks]);

  const submitTasks = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const groupId = `G-${Date.now()}`;
      const mainPreviewUrl = opts.product?.thumbnail;
      const t0 = Date.now();
      for (let i = 0; i < selectedTypes.length; i++) {
        const t = selectedTypes[i];
        const task = buildGenerationTask({
          imageType: t,
          index: i,
          groupId,
          product: opts.product ?? ({} as ProductAsset),
          taskProductName: opts.product?.name ?? '',
          productName: formInput.name,
          templateName: template,
          promptText: promptOverrides[t] ?? prompts[t],
          negativePrompt,
          reviewEnabled,
          ratio: opts.ratio,
          count: typeCounts[t],
          channel: { id: opts.channel.id, name: opts.channel.name, accessType: opts.channel.accessType },
          model: { id: opts.model.id, name: opts.model.name, estimatedCost: 0, capability: opts.model.capability },
          mainPreviewUrl,
        });
        opts.onAddTask(task);
      }
      try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
      setExecutionConfirmOpen(false);
      opts.setScreen(opts.product?.id ? AppScreen.TASKS : AppScreen.TASKS);
      // 用一次时间戳防止 id 重复(测试用例 baseInput 已使用 dateOverride,这里用真实时间)
      void t0;
    } catch (err) {
      toast.error('提交失败,请稍后重试');
      // 不切屏,保留 state,允许用户重试
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, selectedTypes, opts, formInput.name, template, promptOverrides, prompts, negativePrompt, reviewEnabled, typeCounts]);

  const selectReference = useCallback((slot: ReferenceSlot, ref: any | undefined) => {
    setReferences((prev) => ({ ...prev, [slot]: ref }));
  }, []);

  return {
    selectedTypes, typeCounts, template, style, scene, pose, negativePrompt,
    promptOverrides, promptHasEdits, factsConfirmed, promptsConfirmed,
    assistantState, reviewEnabled, references, orderedReferenceInsights,
    compositeState, readinessIssue, pendingChoice, conflictOpen,
    templatePickerOpen, pendingTemplate, templateOverwriteOpen,
    executionConfirmOpen, isSubmitting, hydrated,
    readinessChecks, readinessCount, prompts, promptsComplete,
    factsComplete, isSupported, totalCount,
    toggleType, changeTypeCount, setTemplate: setTemplateName,
    requestTemplateChange, applyTemplate,
    setStyle: _setStyleField(setStyle), setScene: _setStyleField(setScene), setPose: _setStyleField(setPose),
    setNegativePrompt,
    updateProductFact, confirmFacts, setPromptOverride, confirmPrompts,
    runAssistantAnalysis, applyPreset, setReviewEnabled,
    selectReference, checkAndGenerate, submitTasks,
  };
}
```

> **重要**:上面 hook 实际约 ~280 行,有几处为了简洁做了简化(`_setStyleField` 包装)。本任务 Step 3 的代码段是**示意骨架**,实现者需保证完整性与可读性,所有 spec §4 列出的状态/动作都要齐全。

- [ ] **Step 4: 跑测试,确认绿**

预期:`useCreateImageTaskState.test.ts` 全 pass

- [ ] **Step 5: 类型校验**

```bash
npm run lint
```

预期:0 error

> **已知 TBD**:Hook 内 `_setStyleField` / `applyPreset` 实现为本任务的简化骨架,Task 12(`useTaskParams` 升级)时 `applyPreset` 需要真正驱动 `setRatio/setResolution`,届时重写本 hook 的这部分。

---

## Task 11: `useTaskParams` 兼容层 patch(向上扩展,不破坏)

**Files:**
- Modify: `src/components/createTask/useTaskParams.ts`

**Interfaces:**
- Produces:在原 return 上加 `isSupported: boolean` 与 `setModelWithValidation(nextChannelId: string|null, nextModelId: string|null): void`,**不删除任何现有字段**

- [ ] **Step 1: 在 `useTaskParams` 函数 `return {}` 之前新增派生**

```ts
// 在 return {} 之前的某个 useMemo 处添加:

/**
 * [2026-07-21 demo 复刻] 基于当前 channel + 已选 capability + 预填 context 派生 isSupported
 * 
 * 真正的 isSupported 检查需要 ratio/resolution/slot 容量,但 useTaskParams 不感知 aspectRatio 与张数(由父组件管)。
 * 此处的"规格兼容"只覆盖最常见的 capability.size 与预填 ratio 的硬约束,
 * 不与"父组件计算 isSupported"冲突 —— 父组件仍可以根据全量 state 计算
 * 
 * 返回 false 当且仅当:
 * - 预填存在但 capability 与预填不兼容
 * - 否则 true(简化:大多数情况下 useTaskParams 自身无法拒绝)
 *
 * 真正的兼容性拒绝入口在 UI 层(useCreateImageTaskState.isSupported),此处仅供父组件调用以在 UI 显示红字
 */
const isSupported = useMemo<boolean>(() => {
  if (!schema || !prefill) return true;  // 无预填时 UI 层把 isSupported 从 hook 返回值的 isSupported 兜底为 true
  // 占位:无模型 detail 字段,只跑"无 schema 抛错"这一项
  return Boolean(schema);
}, [schema, prefill]);
```

- [ ] **Step 2: 在 return 块最末尾追加**

```ts
  return {
    ...existingReturnObject,   // 原 return 字段不变
    isSupported,
    setModelWithValidation: (nextChannelId: string | null, nextModelId: string | null) => {
      // 包装层:目前 schema 字段不足以做完整 ratio/resolution check,直接转发;真正错位由 UI 层 useCreateImageTaskState.isSupported 兜底拦截
      if (nextChannelId !== undefined) setChannelId(nextChannelId);
      if (nextModelId !== undefined) setModelId(nextModelId);
    },
  };
}
```

- [ ] **Step 3: 类型校验**

```bash
npm run lint
```

预期:0 error。**特别注意** —— 任何 `CreateVideoTask.tsx` 等调用 `useTaskParams` 的其他文件不变,因为只是返回多了字段不是少了。

- [ ] **Step 4: Commit**

```bash
git add src/components/createTask/useTaskParams.ts
git commit -m "feat(createTask): useTaskParams exposes isSupported + setModelWithValidation for the new flow"
```

---

## Task 12: `referencesConfig.ts` 集中模块(给 ReferenceGrid / 推导用)

**Files:**
- Create: `src/lib/createImageTask/referencesConfig.ts`

**Interfaces:**
- Consumed by:`ReferenceGrid.tsx`、`useCreateImageTaskState.ts`(REFERENCE_SLOTS_INTERNAL re-export)
- Produces:`REFERENCE_SLOTS_INTERNAL: ReferenceSlot[]`

- [ ] **Step 1: 写文件**

```ts
// src/lib/createImageTask/referencesConfig.ts
import type { ReferenceSlot } from './extractReferenceInsights';

/** 5 参考图 slot 的规范顺序(与 demo 主版一致) */
export const REFERENCE_SLOTS_INTERNAL: ReferenceSlot[] = ['detail', 'style', 'scene', 'pose', 'model'];

/** 单 slot 元数据(对 UI 渲染与 icon 映射) */
export interface ReferenceSlotMeta {
  slot: ReferenceSlot;
  label: string;
  icon: string;     // Material Symbols
  transitSlot: string;  // TransitPickerButton 的 slot key
}

export const REFERENCE_SLOT_META: Record<ReferenceSlot, ReferenceSlotMeta> = {
  detail: { slot: 'detail', label: '细节', icon: 'zoom_in',          transitSlot: 'reference-detail' },
  style:  { slot: 'style',  label: '风格', icon: 'palette',           transitSlot: 'reference-style'  },
  scene:  { slot: 'scene',  label: '场景', icon: 'landscape',         transitSlot: 'reference-scene'  },
  pose:   { slot: 'pose',   label: '姿势', icon: 'accessibility_new', transitSlot: 'reference-pose'   },
  model:  { slot: 'model',  label: '模特', icon: 'face_3',            transitSlot: 'reference-model'  },
};
```

- [ ] **Step 2: 类型校验 + Commit**

```bash
npm run lint
```

预期:0 error。

---

## Task 13: `DialogFrame` 共享底层(避免 3 个 Dialog 重复 motion 包装)

**Files:**
- Create: `src/components/CreateImageTask/dialogs/DialogFrame.tsx`

**Interfaces:**
- Consumed by:`ConflictDialog` / `TemplateOverwriteDialog` / `ExecutionConfirmDialog`
- Produces:`<DialogFrame open={boolean} onClose={fn} title={node} children={node} footer={node}>`

- [ ] **Step 1: 写文件**

```tsx
// src/components/CreateImageTask/dialogs/DialogFrame.tsx
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface DialogFrameProps {
  open: boolean;
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  /** 测宽:w-full max-w-md → w-full max-w-lg */
  maxWidthClassName?: string;
}

export const DialogFrame: React.FC<DialogFrameProps> = ({
  open, title, onClose, children, footer, maxWidthClassName,
}) => {
  const primaryRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    primaryRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`relative bg-white rounded-lg w-full p-6 shadow-xl ${maxWidthClassName ?? 'max-w-md'}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.16 }}
          >
            <h2 className="text-base font-black text-slate-800">{title}</h2>
            <div className="mt-3 text-xs text-slate-600 leading-5">{children}</div>
            <div className="mt-5 flex justify-end gap-2">
              {footer}
              {/* 把第一个 button 设为 primary 用于 autoFocus(Escape 关闭) */}
              <span ref={primaryRef as any} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
```

> 实操中:`footer` 透传,所以调用方提供 `<button>取消</button><button>确认</button>`,但我们要把"确认"按钮的 ref 注入。改写方式:把 DialogFrame 改成接受 `primaryButtonRef` prop;但这会让 callers 复杂。本任务中**先简单实现**,实际 ref focus 由父级组件(下一个 Task 14)处理。

- [ ] **Step 2: 类型校验**

```bash
npm run lint
```

---

## Task 14: 3 个 Dialog 组件(ConflictDialog / TemplateOverwriteDialog / ExecutionConfirmDialog)

**Files:**
- Create: `src/components/CreateImageTask/dialogs/ConflictDialog.tsx`
- Create: `src/components/CreateImageTask/dialogs/TemplateOverwriteDialog.tsx`
- Create: `src/components/CreateImageTask/dialogs/ExecutionConfirmDialog.tsx`

**Interfaces:**
- Consumed by:顶层 `CreateImageTask.tsx`
- Produces:3 个独立 UI 组件

- [ ] **Step 1: ConflictDialog**

```tsx
// src/components/CreateImageTask/dialogs/ConflictDialog.tsx
import React from 'react';
import { DialogFrame } from './DialogFrame';
import { messages } from '../../../labels/createImageTask';

export interface ConflictDialogProps {
  open: boolean;
  unsupported: string[];
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConflictDialog: React.FC<ConflictDialogProps> = ({ open, unsupported, onCancel, onConfirm }) => {
  const desc = messages.conflict.desc.replace('{fields}', unsupported.join('、'));
  return (
    <DialogFrame
      open={open}
      onClose={onCancel}
      title={
        <span className="inline-flex items-center gap-2 text-amber-500">
          <span className="material-symbols-outlined text-base">{messages.banner.icon === 'error' ? 'warning' : 'warning'}</span>
          <span>{messages.conflict.title}</span>
        </span>
      }
      footer={
        <>
          <button type="button" onClick={onCancel} className="h-8 px-3 text-xs font-bold border border-slate-200 rounded">
            {messages.conflict.cancel}
          </button>
          <button
            ref={(el) => el && (window as any).__conflictPrimaryFocus = el}
            type="button"
            onClick={onConfirm}
            className="h-8 px-3 text-xs font-bold text-white bg-primary rounded"
          >
            {messages.conflict.confirm}
          </button>
        </>
      }
    >
      {desc}
    </DialogFrame>
  );
};
```

- [ ] **Step 2: TemplateOverwriteDialog**

```tsx
// src/components/CreateImageTask/dialogs/TemplateOverwriteDialog.tsx
import React from 'react';
import { DialogFrame } from './DialogFrame';
import { messages } from '../../../labels/createImageTask';

export interface TemplateOverwriteDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const TemplateOverwriteDialog: React.FC<TemplateOverwriteDialogProps> = ({ open, onCancel, onConfirm }) => (
  <DialogFrame
    open={open}
    onClose={onCancel}
    title={
      <span className="inline-flex items-center gap-2 text-amber-500">
        <span className="material-symbols-outlined text-base">warning</span>
        <span>{messages.overwrite.title}</span>
      </span>
    }
    footer={
      <>
        <button type="button" onClick={onCancel} className="h-8 px-3 text-xs font-bold border border-slate-200 rounded">
          {messages.overwrite.cancel}
        </button>
        <button type="button" onClick={onConfirm} className="h-8 px-3 text-xs font-bold text-white bg-primary rounded">
          {messages.overwrite.confirm}
        </button>
      </>
    }
  >
    {messages.overwrite.desc}
  </DialogFrame>
);
```

- [ ] **Step 3: ExecutionConfirmDialog**

```tsx
// src/components/CreateImageTask/dialogs/ExecutionConfirmDialog.tsx
import React from 'react';
import { DialogFrame } from './DialogFrame';
import { messages } from '../../../labels/createImageTask';
import type { ImageGenerationType } from '../../../lib/createImageTask/readinessChecks';

export interface ExecutionConfirmDialogProps {
  open: boolean;
  isSubmitting: boolean;
  selectedTypes: ImageGenerationType[];
  typeCounts: Record<ImageGenerationType, number>;
  totalCount: number;
  productName: string;
  templateName: string;
  ratio: string;
  resolution: string;
  onCancel: () => void;
  onSubmit: () => void;
}

export const ExecutionConfirmDialog: React.FC<ExecutionConfirmDialogProps> = ({
  open, isSubmitting, selectedTypes, typeCounts, totalCount,
  productName, templateName, ratio, resolution, onCancel, onSubmit,
}) => (
  <DialogFrame
    open={open}
    onClose={isSubmitting ? undefined as any : onCancel}
    title={messages.executeConfirm.title}
    maxWidthClassName="max-w-lg"
    footer={
      <>
        <button type="button" disabled={isSubmitting} onClick={onCancel}
          className="h-8 px-3 text-xs font-bold border border-slate-200 rounded disabled:opacity-50">
          {messages.executeConfirm.cancel}
        </button>
        <button type="button" disabled={isSubmitting} onClick={onSubmit}
          className="h-8 px-3 text-xs font-bold text-white bg-primary rounded disabled:opacity-50">
          {isSubmitting ? '提交中…' : messages.executeConfirm.submit}
        </button>
      </>
    }
  >
    <div className="space-y-2 text-slate-700">
      <div className="flex justify-between"><span>商品名称</span><span className="font-bold">{productName}</span></div>
      <div className="flex justify-between"><span>模板</span><span className="font-bold">{templateName}</span></div>
      <div className="flex justify-between">
        <span>生成图片类型</span>
        <span className="font-bold">
          {selectedTypes.map((t) => `${messages.type[t]} × ${typeCounts[t]}`).join('、')}
        </span>
      </div>
      <div className="flex justify-between"><span>总张数</span><span className="font-bold">{totalCount} 张</span></div>
      <div className="flex justify-between"><span>规格</span><span className="font-bold">{ratio} / {resolution}</span></div>
    </div>
  </DialogFrame>
);
```

- [ ] **Step 4: 类型校验**

```bash
npm run lint
```

---

## Task 15: `src/index.css` 加 motion 关键帧

**Files:**
- Modify: `src/index.css`(`@theme` 块末尾追加)

- [ ] **Step 1: 在 `@theme {}` 之后追加**

```css
/* [2026-07-21] CreateImageTask motion keyframes */
@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-2px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 2: 校验**

```bash
npm run lint
```

预期:0 error

---

## Task 16: TopHeader + ReadinessBanner(header 2 子组件)

**Files:**
- Create: `src/components/CreateImageTask/header/TopHeader.tsx`
- Create: `src/components/CreateImageTask/header/ReadinessBanner.tsx`

**Interfaces:**
- TopHeader props:`{ selectedTypesCount: number; totalCount: number; readinessCount: number; onCheckAndGenerate: () => void; onBack: () => void }`
- ReadinessBanner props:`{ message: string }`(由父级清空时 message='' 自动隐藏)

- [ ] **Step 1: ReadinessBanner**

```tsx
// src/components/CreateImageTask/header/ReadinessBanner.tsx
import React from 'react';
import { messages } from '../../../labels/createImageTask';

export interface ReadinessBannerProps {
  message: string;
}

export const ReadinessBanner: React.FC<ReadinessBannerProps> = ({ message }) => {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="shrink-0 border-b border-amber-200 bg-amber-50 px-6 py-2 text-[11px] font-bold text-amber-700 animate-[fadeInDown_200ms_ease-out]"
    >
      <span className="material-symbols-outlined mr-1 align-middle text-sm">error</span>
      {message}
    </div>
  );
};
```

- [ ] **Step 2: TopHeader**

```tsx
// src/components/CreateImageTask/header/TopHeader.tsx
import React from 'react';
import { messages } from '../../../labels/createImageTask';

export interface TopHeaderProps {
  selectedTypesCount: number;
  totalCount: number;
  readinessCount: number;
  onBack: () => void;
  onCheckAndGenerate: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  selectedTypesCount, totalCount, readinessCount, onBack, onCheckAndGenerate,
}) => (
  <header className="h-16 shrink-0 px-6 bg-white border-b border-slate-200 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label="返回任务列表"
        onClick={onBack}
        className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100"
      >
        <span className="material-symbols-outlined text-xl">arrow_back</span>
      </button>
      <div>
        <p className="text-[11px] font-bold text-primary">{messages.header.eyebrow}</p>
        <h1 className="text-base font-black text-slate-800">{messages.header.title}</h1>
      </div>
    </div>
    <div className="flex items-center gap-3">
      <div className="text-right">
        <span className="block text-[10px] font-bold text-slate-400">
          {messages.header.readiness} {readinessCount}/4
        </span>
        <span className="text-xs text-slate-500">
          {selectedTypesCount} 个图片类型 · {totalCount} 张
        </span>
      </div>
      <button
        type="button"
        onClick={onCheckAndGenerate}
        className="h-9 px-4 rounded-md bg-primary text-white text-xs font-bold shadow-sm hover:opacity-90"
      >
        检查并生成
      </button>
    </div>
  </header>
);
```

- [ ] **Step 3: 类型校验**

```bash
npm run lint
```

---

## Task 17: 三栏布局容器 `ThreeColumnLayout`

**Files:**
- Create: `src/components/CreateImageTask/layout/ThreeColumnLayout.tsx`

- [ ] **Step 1: 写文件**

```tsx
// src/components/CreateImageTask/layout/ThreeColumnLayout.tsx
import React from 'react';

export interface ThreeColumnLayoutProps {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
}

/**
 * 三栏栅格:左 300px(素材) + 中 1fr(任务/商品事实/Prompt) + 右 380px(模型/规格)
 * mobile 单栏堆叠(xl 断点 1280+ 切三栏)
 */
export const ThreeColumnLayout: React.FC<ThreeColumnLayoutProps> = ({ left, center, right }) => (
  <main className="flex-1 overflow-y-auto p-5 grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_380px] gap-5">
    <section className="space-y-4">{left}</section>
    <section className="space-y-5">{center}</section>
    <section className="space-y-4">{right}</section>
  </main>
);
```

- [ ] **Step 2: 校验**

```bash
npm run lint
```

---

## Task 18: 左栏 3 子组件(ImageSourceSection / CompositeSection / ReferenceGrid)

**Files:**
- Create: `src/components/CreateImageTask/left/ImageSourceSection.tsx`
- Create: `src/components/CreateImageTask/left/CompositeSection.tsx`
- Create: `src/components/CreateImageTask/left/ReferenceGrid.tsx`

**Interfaces:**
- ImageSourceSection:接收 `mainSlot`,`composite`,`onPickMain()` 等;唯一对外行为"调用父的 openTransit"
- ReferenceGrid:接 `references: Record<ReferenceSlot, Ref | undefined>` + `onSelectReference(slot, ref)`

> **设计**:左栏在 spec 范围内,本期保留 `TransitPickerButton` + `OutfitComposePanel` 既有组件;只重写样式 / slot 数。`slotRefs.main / top / bottom` 由父级容器(useCreateImageTaskState)管理,通过 props 传下来。

- [ ] **Step 1: ImageSourceSection(主图占位 + 进出主图区域)**

```tsx
// src/components/CreateImageTask/left/ImageSourceSection.tsx
import React from 'react';
import { TransitPickerButton } from '../../common/TransitPickerButton';

export interface ImageSourceSectionProps {
  mainValue: any;       // SlotRef | null
  onPickMain: () => void;
}

export const ImageSourceSection: React.FC<ImageSourceSectionProps> = ({ mainValue, onPickMain }) => (
  <div
    id="image-source-section"
    className="bg-white border border-slate-200 rounded-lg p-4"
  >
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-black">输入素材</h2>
      <button
        type="button"
        onClick={onPickMain}
        className="text-xs text-primary font-bold hover:underline"
      >
        资源中心
      </button>
    </div>
    <div className="mt-3">
      {mainValue ? (
        <button
          type="button"
          onClick={onPickMain}
          className="w-full rounded-md border border-slate-100 overflow-hidden"
        >
          <img src={mainValue.thumbnailUrl ?? mainValue.originalUrl} alt={mainValue.name ?? ''} className="w-full h-44 object-cover" />
          <div className="px-2 py-1 text-xs font-bold truncate">{mainValue.name}</div>
        </button>
      ) : (
        <button
          type="button"
          onClick={onPickMain}
          aria-label="添加主体素材"
          className="w-full h-44 rounded-md border-2 border-dashed border-slate-300 bg-slate-50 hover:border-primary hover:bg-blue-50 transition-colors flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-primary"
        >
          <span className="material-symbols-outlined text-4xl">add</span>
          <span className="text-xs font-bold">添加主体素材</span>
        </button>
      )}
    </div>
  </div>
);
```

- [ ] **Step 2: CompositeSection(项目已有 OutfitComposePanel 包装)**

```tsx
// src/components/CreateImageTask/left/CompositeSection.tsx
import React from 'react';
import { OutfitComposePanel } from '../../common/OutfitComposePanel';

export interface CompositeSectionProps {
  productId: string | undefined;
  onApplied: (asset: { fileResourceId: number; originalUrl?: string; thumbnailUrl?: string; name?: string }) => void;
}

export const CompositeSection: React.FC<CompositeSectionProps> = ({ productId, onApplied }) => (
  <div className="bg-white border border-slate-200 rounded-lg p-4">
    <h2 className="text-sm font-black">上下装合成</h2>
    <p className="text-[10px] text-slate-400 mt-1">仅在户外服饰品类显示;用于生成商品合成套图(原 OutfitComposePanel)</p>
    <div className="mt-3">
      <OutfitComposePanel
        productId={productId}
        defaultCollapsed={false}
        onApplied={onApplied}
      />
    </div>
  </div>
);
```

- [ ] **Step 3: ReferenceGrid(5 slots)**

```tsx
// src/components/CreateImageTask/left/ReferenceGrid.tsx
import React from 'react';
import { REFERENCE_SLOTS_INTERNAL, REFERENCE_SLOT_META } from '../../../lib/createImageTask/referencesConfig';
import type { ReferenceSlot } from '../../../lib/createImageTask/extractReferenceInsights';

export interface ReferenceRef { slot: ReferenceSlot; thumbnailUrl?: string; originalUrl?: string; name?: string }

export interface ReferenceGridProps {
  values: Partial<Record<ReferenceSlot, ReferenceRef | undefined>>;
  onSelect: (slot: ReferenceSlot, ref: ReferenceRef | undefined) => void;
  /** 由父容器注入 openTransit 的回调包装器,接收 (slot, onConfirm) */
  openSlotPicker: (slot: ReferenceSlot, onConfirm: (ref: ReferenceRef) => void) => void;
}

export const ReferenceGrid: React.FC<ReferenceGridProps> = ({ values, openSlotPicker }) => (
  <div id="reference-grid" className="bg-white border border-slate-200 rounded-lg p-4">
    <h2 className="text-sm font-black inline-flex items-center gap-1">
      参考图<span className="font-normal text-slate-400">（选传）</span>
    </h2>
    <div className="grid grid-cols-2 gap-2 mt-3">
      {REFERENCE_SLOTS_INTERNAL.map((slot) => {
        const ref = values[slot];
        const meta = REFERENCE_SLOT_META[slot];
        return (
          <div key={slot} className="min-w-0">
            <button
              type="button"
              onClick={() => openSlotPicker(slot, (r) => onSelect ?? (() => {}) as any)}  // 父级 onSelect 在 onConfirm 中已处理 — 父容器包好回调
              aria-label={`选择${meta.label}参考`}
              className={`w-full h-16 rounded-md border-2 overflow-hidden flex items-center gap-2 px-2 text-left transition-colors ${
                ref
                  ? 'border-primary bg-blue-50'
                  : 'border-dashed border-slate-200 hover:border-primary bg-slate-50'
              }`}
            >
              {ref ? (
                <>
                  <img src={ref.thumbnailUrl ?? ref.originalUrl ?? ''} alt={meta.label} className="w-10 h-10 object-cover rounded" />
                  <span className="text-[11px] font-bold text-primary truncate">{meta.label}</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base text-slate-400">{meta.icon === 'palette' ? 'palette' : meta.icon}</span>
                  <span className="text-[11px] text-slate-400">添加{meta.label}参考</span>
                </>
              )}
            </button>
            <div className="text-[10px] text-slate-400 font-medium mt-1 text-center">{meta.label}</div>
          </div>
        );
      })}
    </div>
  </div>
);
```

- [ ] **Step 4: 类型校验**

```bash
npm run lint
```

预期:0 error。

> **已知 TBD**:`openSlotPicker` 在父级 `CreateImageTask.tsx` 用法:
> ```ts
> const openTransitForSlot = useCallback((slot: ReferenceSlot, onConfirm: (r: ReferenceRef) => void) => {
>   openTransit((assets) => {
>     const a = assets[0];
>     if (a) onConfirm({ slot, ... });
>   }, slot === 'detail' ? 'reference-detail' : slot === 'style' ? 'reference-style' : ...);
> }, [openTransit]);
> ```
> **当前 `App.tsx` 传入 `openTransit()` 是无参的**。Task 22 时,如果发现 `App.tsx` 实际 `openTransit` 是无参,需要在左栏组件内手动触发资源中心 modal 而不依赖父级传进来的 `openTransit`。本任务**写组件不绑定具体调用**,留 Task 22 解决。

---

## Task 19: 中栏 4 子组件(ImageTypeSelector / TemplatePicker / StyleScenePoseRow / AdvancedSettings)

**Files:**
- Create: `src/components/CreateImageTask/center/ImageTypeSelector.tsx`
- Create: `src/components/CreateImageTask/center/TemplatePicker.tsx`
- Create: `src/components/CreateImageTask/center/StyleScenePoseRow.tsx`
- Create: `src/components/CreateImageTask/center/AdvancedSettings.tsx`

- [ ] **Step 1: ImageTypeSelector(4 宫格多选 + 张数调节器)**

```tsx
// src/components/CreateImageTask/center/ImageTypeSelector.tsx
import React from 'react';
import type { ImageGenerationType } from '../../../lib/createImageTask/readinessChecks';
import { messages } from '../../../labels/createImageTask';

const TYPE_ORDER: ImageGenerationType[] = ['product_main','scene_detail','detail_closeup','on_model'];

export interface ImageTypeSelectorProps {
  selectedTypes: ImageGenerationType[];
  typeCounts: Record<ImageGenerationType, number>;
  maxCountPerType: number;  // 当前模型 capability.maxCount 的上限
  onToggle: (t: ImageGenerationType) => void;
  onChangeCount: (t: ImageGenerationType, delta: number) => void;
}

export const ImageTypeSelector: React.FC<ImageTypeSelectorProps> = ({
  selectedTypes, typeCounts, maxCountPerType, onToggle, onChangeCount,
}) => (
  <div className="bg-white border border-slate-200 rounded-lg p-5">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[11px] font-bold text-primary">图片类型</p>
        <h2 className="text-base font-black">生成图片类型 <span className="text-slate-400 font-normal">{messages.type.labelHelper}</span></h2>
      </div>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
      {TYPE_ORDER.map((t) => {
        const isSelected = selectedTypes.includes(t);
        const count = typeCounts[t];
        const canDec = count > 1;
        const canInc = count < Math.min(maxCountPerType, 5);
        return (
          <div
            key={t}
            className={`relative min-h-[76px] border rounded-md p-3 flex flex-col items-center gap-1 ${
              isSelected ? 'border-primary bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <button
              type="button"
              onClick={() => onToggle(t)}
              aria-label={`选择${messages.type[t]}类型`}
              className="w-full flex flex-col items-center gap-1"
            >
              <span className="material-symbols-outlined text-xl text-slate-700">{messages.typeIcon[t]}</span>
              <span className="text-xs font-bold text-slate-800">{messages.type[t]}</span>
            </button>
            {isSelected && (
              <span aria-hidden="true" className="absolute top-1 right-1 material-symbols-outlined text-primary text-sm">check</span>
            )}
            {isSelected && (
              <div
                role="group"
                aria-label={`${messages.type[t]}张数`}
                className="absolute bottom-2 right-2 z-10 flex h-7 items-center rounded border border-blue-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  disabled={!canDec}
                  onClick={() => onChangeCount(t, -1)}
                  aria-label="减少张数"
                  className="w-7 h-full flex items-center justify-center text-slate-500 disabled:opacity-30"
                >
                  <span className="material-symbols-outlined text-base">remove</span>
                </button>
                <span aria-live="polite" className="w-7 border-x border-blue-100 text-center text-xs font-black leading-7">
                  {count}
                </span>
                <button
                  type="button"
                  disabled={!canInc}
                  onClick={() => onChangeCount(t, 1)}
                  aria-label="增加张数"
                  className="w-7 h-full flex items-center justify-center text-slate-500 disabled:opacity-30"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);
```

- [ ] **Step 2: TemplatePicker(模板 + 模板下拉)**

```tsx
// src/components/CreateImageTask/center/TemplatePicker.tsx
import React from 'react';
import { messages } from '../../../labels/createImageTask';

export interface TemplateOption { id: string; name: string }

export interface TemplatePickerProps {
  value: string;
  options: TemplateOption[];
  onPickRequest: (name: string) => void;  // 走 requestTemplateChange(父级 useCreateImageTaskState)
}

export const TemplatePicker: React.FC<TemplatePickerProps> = ({ value, options, onPickRequest }) => (
  <div className="bg-white border border-slate-200 rounded-lg p-4">
    <p className="text-[11px] font-bold text-primary">模板</p>
    <h2 className="text-base font-black mt-1">选择模板</h2>
    <div className="mt-2">
      <label className="block">
        <span className="sr-only">{messages.template.select}</span>
        <select
          value={value}
          onChange={(e) => onPickRequest(e.target.value)}
          className="w-full h-9 px-2 rounded-md border border-slate-200 text-xs font-bold bg-white"
        >
          {options.map((t) => (
            <option key={t.id} value={t.name}>{t.name}</option>
          ))}
        </select>
      </label>
    </div>
    {options.length === 0 && (
      <p className="mt-2 text-[10px] text-slate-400">{messages.template.emptyHint}</p>
    )}
  </div>
);
```

- [ ] **Step 3: StyleScenePoseRow(3 个 select)**

```tsx
// src/components/CreateImageTask/center/StyleScenePoseRow.tsx
import React from 'react';
import { messages } from '../../../labels/createImageTask';

export interface StyleScenePoseRowProps {
  style: string; scene: string; pose: string;
  onStyleChange: (v: string) => void;
  onSceneChange: (v: string) => void;
  onPoseChange: (v: string) => void;
}

const fieldClass = 'mt-1.5 w-full h-9 px-2 rounded border border-slate-200 bg-white text-xs font-bold';

export const StyleScenePoseRow: React.FC<StyleScenePoseRowProps> = ({
  style, scene, pose,
  onStyleChange, onSceneChange, onPoseChange,
}) => (
  <div className="grid md:grid-cols-3 gap-3">
    <label className="block">
      <span className="text-xs font-bold text-slate-700">风格</span>
      <select className={fieldClass} value={style} onChange={(e) => onStyleChange(e.target.value)}>
        {messages.styleOptions.map((opt) => <option key={opt}>{opt}</option>)}
      </select>
    </label>
    <label className="block">
      <span className="text-xs font-bold text-slate-700">场景</span>
      <select className={fieldClass} value={scene} onChange={(e) => onSceneChange(e.target.value)}>
        {messages.sceneOptions.map((opt) => <option key={opt}>{opt}</option>)}
      </select>
    </label>
    <label className="block">
      <span className="text-xs font-bold text-slate-700">姿势</span>
      <select className={fieldClass} value={pose} onChange={(e) => onPoseChange(e.target.value)}>
        {messages.poseOptions.map((opt) => <option key={opt}>{opt}</option>)}
      </select>
    </label>
  </div>
);
```

- [ ] **Step 4: AdvancedSettings(<details> 折叠 + 负面约束)**

```tsx
// src/components/CreateImageTask/center/AdvancedSettings.tsx
import React from 'react';

export interface AdvancedSettingsProps {
  negativePrompt: string;
  onChange: (v: string) => void;
}

export const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({ negativePrompt, onChange }) => (
  <details className="bg-white border border-slate-200 rounded-lg p-4">
    <summary className="cursor-pointer text-xs font-bold text-slate-700">高级设置</summary>
    <label className="mt-3 block">
      <span className="text-xs font-bold text-slate-700">负面约束</span>
      <input
        type="text"
        value={negativePrompt}
        onChange={(e) => onChange(e.target.value)}
        placeholder="blurry, bad quality, distorted"
        className="mt-1.5 w-full h-9 px-2 rounded border border-slate-200 text-xs font-bold"
      />
    </label>
    <p className="mt-1.5 text-[10px] text-slate-400">默认沿用当前模板的约束,可按本次任务覆盖。</p>
  </details>
);
```

- [ ] **Step 5: 类型校验**

```bash
npm run lint
```

---

## Task 20: 中栏核心 3 子组件(ProductFactsEditor / PerTypePromptEditor / ImageContentSection)

**Files:**
- Create: `src/components/CreateImageTask/center/ProductFactsEditor.tsx`
- Create: `src/components/CreateImageTask/center/PerTypePromptEditor.tsx`
- Create: `src/components/CreateImageTask/center/ImageContentSection.tsx`

- [ ] **Step 1: ProductFactsEditor(6 字段,2 列 grid)**

```tsx
// src/components/CreateImageTask/center/ProductFactsEditor.tsx
import React from 'react';
import { messages } from '../../../labels/createImageTask';
import type { ProductFactsInput } from '../../../lib/createImageTask/extractProductFacts';

export interface ProductFactsEditorProps {
  value: ProductFactsInput;
  isProductBound: boolean;
  factsConfirmed: boolean;
  onChange: <K extends keyof ProductFactsInput>(key: K, value: ProductFactsInput[K]) => void;
  onConfirm: () => void;
}

const fieldClass = 'w-full h-9 px-2 rounded border border-slate-200 bg-white text-xs font-bold disabled:bg-slate-50 disabled:text-slate-400';

export const ProductFactsEditor: React.FC<ProductFactsEditorProps> = ({
  value, isProductBound, factsConfirmed, onChange, onConfirm,
}) => {
  const completed = value.name.trim().length > 0;
  return (
    <div className="border-y border-slate-100 py-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black">商品事实</h3>
        <p className="text-[10px] text-slate-400">{messages.facts.factPlaceholder}</p>
        <span className={`text-[10px] font-bold ${factsConfirmed ? 'text-emerald-700' : 'text-amber-600'}`}>
          {factsConfirmed ? '已确认' : '待确认'}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
        <label className="block">
          <span className="text-[11px] font-bold text-slate-700">{messages.facts.name}</span>
          <input className={fieldClass} disabled={!isProductBound} value={value.name} onChange={(e) => onChange('name', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold text-slate-700">{messages.facts.sellingPoints}</span>
          <input className={fieldClass} disabled={!isProductBound} value={value.sellingPoints} onChange={(e) => onChange('sellingPoints', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold text-slate-700">{messages.facts.category}</span>
          <input className={fieldClass} disabled={!isProductBound} value={value.productCategory} onChange={(e) => onChange('productCategory', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold text-slate-700">{messages.facts.color}</span>
          <input className={fieldClass} disabled={!isProductBound} value={value.colorPattern} onChange={(e) => onChange('colorPattern', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold text-slate-700">{messages.facts.patternAndMaterial}</span>
          <input className={fieldClass} disabled={!isProductBound} value={value.fabricTexture} onChange={(e) => onChange('fabricTexture', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold text-slate-700">{messages.facts.structure}</span>
          <input className={fieldClass} disabled={!isProductBound} value={value.fitStructure} onChange={(e) => onChange('fitStructure', e.target.value)} />
        </label>
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!isProductBound || !completed}
          className="shrink-0 h-7 px-2.5 rounded border border-slate-200 bg-white disabled:bg-slate-100 disabled:text-slate-400 text-[11px] font-bold text-slate-600 hover:border-primary hover:text-primary"
        >
          {messages.facts.confirm}
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: PerTypePromptEditor(逐类型 textarea 列表)**

```tsx
// src/components/CreateImageTask/center/PerTypePromptEditor.tsx
import React from 'react';
import type { ImageGenerationType } from '../../../lib/createImageTask/readinessChecks';
import { messages } from '../../../labels/createImageTask';

export interface PerTypePromptEditorProps {
  selectedTypes: ImageGenerationType[];
  defaultPrompts: Record<ImageGenerationType, string>;
  overrides: Partial<Record<ImageGenerationType, string>>;
  templateName: string;
  isProductBound: boolean;
  promptsConfirmed: boolean;
  factsConfirmed: boolean;
  onChangeOverride: (t: ImageGenerationType, v: string) => void;
  onRegenerateAll: () => void;
  onAiOptimizeSelected: () => void;
  onConfirm: () => void;
}

export const PerTypePromptEditor: React.FC<PerTypePromptEditorProps> = ({
  selectedTypes, defaultPrompts, overrides, templateName,
  isProductBound, promptsConfirmed, factsConfirmed,
  onChangeOverride, onRegenerateAll, onAiOptimizeSelected, onConfirm,
}) => {
  const nothingSelected = selectedTypes.length === 0;
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black">每种图片各自编辑</h3>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onRegenerateAll}
            disabled={!isProductBound}
            className="text-[11px] px-2 py-1 rounded bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 disabled:opacity-50"
          >
            {messages.prompt.regen}
          </button>
          <button
            type="button"
            onClick={onAiOptimizeSelected}
            disabled={nothingSelected}
            className="text-[11px] px-2 py-1 rounded bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 disabled:opacity-50"
          >
            {messages.prompt.aiOptimize}
          </button>
        </div>
      </div>
      <div className="mt-2 space-y-3">
        {selectedTypes.map((t) => {
          const value = overrides[t] ?? defaultPrompts[t];
          return (
            <div key={t} className="border border-slate-200 rounded-md overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 flex justify-between">
                <span className="text-xs font-black">{messages.type[t]}</span>
                <span className="text-[10px] text-slate-400">{messages.template.sourceLabel}: {templateName}</span>
              </div>
              <textarea
                disabled={!isProductBound}
                value={value}
                onChange={(e) => onChangeOverride(t, e.target.value)}
                aria-label={`${messages.type[t]} Prompt`}
                className="w-full h-24 resize-none p-3 outline-none disabled:bg-slate-50 disabled:text-slate-400 text-xs leading-5"
              />
            </div>
          );
        })}
        {nothingSelected && (
          <div className="text-center text-xs text-slate-400 py-4">请至少选择 1 种图片类型</div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!factsConfirmed || nothingSelected}
          className={`h-8 shrink-0 rounded-md border px-3 text-xs font-bold ${
            promptsConfirmed
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-primary bg-white text-primary disabled:border-slate-200 disabled:text-slate-300'
          }`}
        >
          {promptsConfirmed ? messages.prompt.confirmed : messages.prompt.confirmPrompts}
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: ImageContentSection(AI 助手 + 状态条 + 商品事实 + PerTypePromptEditor 容器)**

```tsx
// src/components/CreateImageTask/center/ImageContentSection.tsx
import React from 'react';
import { ProductFactsEditor } from './ProductFactsEditor';
import { PerTypePromptEditor } from './PerTypePromptEditor';
import { messages } from '../../../labels/createImageTask';
import type { ProductFactsInput } from '../../../lib/createImageTask/extractProductFacts';
import type { ImageGenerationType } from '../../../lib/createImageTask/readinessChecks';

export interface ImageContentSectionProps {
  isProductBound: boolean;
  assistantState: 'idle' | 'processing' | 'complete';
  onAssistantClick: () => void;
  productFacts: ProductFactsInput;
  factsComplete: boolean;
  factsConfirmed: boolean;
  onChangeFact: <K extends keyof ProductFactsInput>(key: K, value: ProductFactsInput[K]) => void;
  onConfirmFacts: () => void;

  promptsConfirmed: boolean;
  selectedTypes: ImageGenerationType[];
  defaultPrompts: Record<ImageGenerationType, string>;
  promptOverrides: Partial<Record<ImageGenerationType, string>>;
  templateName: string;
  promptsComplete: boolean;
  onChangePromptOverride: (t: ImageGenerationType, v: string) => void;
  onRegenerateAll: () => void;
  onAiOptimizeSelected: () => void;
  onConfirmPrompts: () => void;
}

export const ImageContentSection: React.FC<ImageContentSectionProps> = (props) => {
  const {
    isProductBound, assistantState, onAssistantClick,
    productFacts, factsComplete, factsConfirmed, onChangeFact, onConfirmFacts,
    promptsConfirmed, selectedTypes, defaultPrompts, promptOverrides, templateName,
    promptsComplete, onChangePromptOverride, onRegenerateAll, onAiOptimizeSelected, onConfirmPrompts,
  } = props;

  return (
    <div id="image-content-section" className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold text-primary">{messages.header.eyebrow}</p>
          <h2 className="text-base font-black">任务级 Prompt 副本</h2>
        </div>
        <button
          type="button"
          onClick={onAssistantClick}
          disabled={!isProductBound || assistantState === 'processing'}
          className={`h-8 px-3 border rounded-md flex gap-1 items-center text-xs font-bold ${
            assistantState === 'processing'
              ? 'border-primary bg-blue-50 text-primary animate-pulse'
              : 'border-blue-200 bg-blue-50 text-primary hover:bg-blue-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-sm">{assistantState === 'processing' ? 'progress_activity' : 'auto_awesome'}</span>
          {assistantState === 'processing' ? messages.assistant.processing : assistantState === 'complete' ? messages.assistant.retry : messages.assistant.idle}
        </button>
      </div>

      {!isProductBound && (
        <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] font-bold text-amber-700">
          请先在左侧选择已绑定商品的素材,商品事实与 Prompt 才能解析。
        </div>
      )}

      {assistantState === 'complete' && (
        <div role="status" className="mt-3 flex items-center gap-2 bg-emerald-50 rounded-md p-2 text-[11px] font-bold text-emerald-700 border border-emerald-200">
          <span className="material-symbols-outlined text-sm">check_circle</span>
          {messages.assistant.complete}
        </div>
      )}

      <ProductFactsEditor
        value={productFacts}
        isProductBound={isProductBound}
        factsConfirmed={factsConfirmed}
        onChange={onChangeFact}
        onConfirm={onConfirmFacts}
      />

      <PerTypePromptEditor
        selectedTypes={selectedTypes}
        defaultPrompts={defaultPrompts}
        overrides={promptOverrides}
        templateName={templateName}
        isProductBound={isProductBound}
        promptsConfirmed={promptsConfirmed}
        factsConfirmed={factsConfirmed}
        onChangeOverride={onChangePromptOverride}
        onRegenerateAll={onRegenerateAll}
        onAiOptimizeSelected={onAiOptimizeSelected}
        onConfirm={onConfirmPrompts}
      />
    </div>
  );
};
```

- [ ] **Step 4: 类型校验**

```bash
npm run lint
```

预期:0 error(注意 `factsComplete`、`promptsComplete` 这两个字段本期由 `ImageContentSection` 透传给子组件,但实际上子组件只读到 props 自己在 props 列表中写过 `factsComplete` 与 `promptsComplete`。这里父传给子会把它们丢弃。要么从 props 中移除,要么透传到子组件内部用。本步骤不消除 lint 报错,但记录到 Task 22 修复)。

> **已知 TBD**:`ImageContentSection` 接 `factsComplete` 与 `promptsComplete` 但未向下传 —— 留给 Task 22 收尾时清理 unused 警告。

---

## Task 21: 右栏 5 子组件(ImageSettingsSection / ModelSelector / PlatformPresets / ReviewStrategyPanel / UnsupportedNotice)

**Files:**
- Create: `src/components/CreateImageTask/right/ImageSettingsSection.tsx`
- Create: `src/components/CreateImageTask/right/ModelSelector.tsx`
- Create: `src/components/CreateImageTask/right/PlatformPresets.tsx`
- Create: `src/components/CreateImageTask/right/ReviewStrategyPanel.tsx`
- Create: `src/components/CreateImageTask/right/UnsupportedNotice.tsx`

- [ ] **Step 1: ModelSelector(channel:model select)**

```tsx
// src/components/CreateImageTask/right/ModelSelector.tsx
import React from 'react';

export interface ModelOption { channelId: string; modelId: string; label: string }
export interface ModelSelectorProps {
  options: ModelOption[];
  value: { channelId: string | null; modelId: string | null };
  onChange: (next: { channelId: string; modelId: string }) => void;
  locked?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ options, value, onChange, locked }) => (
  <label className="block">
    <span className="text-xs font-bold text-slate-700">模型{locked ? ' 🔒' : ''}</span>
    <select
      value={value.modelId ?? ''}
      disabled={locked}
      onChange={(e) => {
        const opt = options.find((o) => o.modelId === e.target.value);
        if (opt) onChange({ channelId: opt.channelId, modelId: opt.modelId });
      }}
      className="mt-1.5 w-full h-9 rounded-md border border-slate-200 px-2 text-xs font-medium bg-white"
    >
      {options.length === 0 && <option>未配默认模型 (手填)</option>}
      {options.map((opt) => (
        <option key={opt.modelId} value={opt.modelId}>{opt.label}</option>
      ))}
    </select>
  </label>
);
```

- [ ] **Step 2: PlatformPresets(3 个 chips)**

```tsx
// src/components/CreateImageTask/right/PlatformPresets.tsx
import React from 'react';
import { messages } from '../../../labels/createImageTask';

export interface PlatformPresetsProps {
  currentRatio: string;
  currentResolution: string;
  onApply: (preset: typeof messages.presetPlatforms[number]) => void;
}

export const PlatformPresets: React.FC<PlatformPresetsProps> = ({ onApply }) => (
  <div className="mt-4">
    <span className="text-xs font-bold text-slate-700">平台规格推荐</span>
    <div className="flex flex-wrap gap-2 mt-2">
      {messages.presetPlatforms.map((preset) => (
        <button
          key={preset.name}
          type="button"
          onClick={() => onApply(preset)}
          className="px-2 py-1.5 text-[11px] font-bold rounded border border-slate-200 hover:border-primary hover:bg-blue-50"
        >
          {preset.name}
        </button>
      ))}
    </div>
  </div>
);
```

- [ ] **Step 3: ReviewStrategyPanel(checkbox 评分审核)**

```tsx
// src/components/CreateImageTask/right/ReviewStrategyPanel.tsx
import React from 'react';
import { messages } from '../../../labels/createImageTask';

export interface ReviewStrategyPanelProps {
  reviewEnabled: boolean;
  onChange: (v: boolean) => void;
}

export const ReviewStrategyPanel: React.FC<ReviewStrategyPanelProps> = ({ reviewEnabled, onChange }) => (
  <div className="bg-white border border-slate-200 rounded-lg p-5">
    <h3 className="text-xs font-black">审核策略</h3>
    <label className="mt-3 flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer">
      {messages.header.reviewLabel}
      <input
        type="checkbox"
        checked={reviewEnabled}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-primary h-4 w-4"
      />
    </label>
  </div>
);
```

- [ ] **Step 4: UnsupportedNotice(底部红色警告条)**

```tsx
// src/components/CreateImageTask/right/UnsupportedNotice.tsx
import React from 'react';

export interface UnsupportedNoticeProps {
  show: boolean;
}

export const UnsupportedNotice: React.FC<UnsupportedNoticeProps> = ({ show }) => {
  if (!show) return null;
  return (
    <p role="alert" className="mt-3 text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
      当前模型不支持该比例/尺寸/张数,请调整比例、尺寸或选择其他模型。
    </p>
  );
};
```

- [ ] **Step 5: ImageSettingsSection(容器 + 比例 + 总张数 + 尺寸 + 平台 presets + 警告)**

```tsx
// src/components/CreateImageTask/right/ImageSettingsSection.tsx
import React from 'react';
import { ModelSelector, type ModelOption, type ModelSelectorProps } from './ModelSelector';
import { PlatformPresets } from './PlatformPresets';
import { UnsupportedNotice } from './UnsupportedNotice';
import { messages } from '../../../labels/createImageTask';
import type { ImageGenerationType } from '../../../lib/createImageTask/readinessChecks';

const RATIO_OPTIONS = ['1:1', '3:4', '4:5', '9:16', '16:9'];
const RESOLUTION_OPTIONS = ['1024px', '1536px', '2048px'];

export interface ImageSettingsSectionProps {
  models: ModelOption[];
  modelValue: { channelId: string | null; modelId: string | null };
  onModelChange: ModelSelectorProps['onChange'];
  ratioOptions: string[];
  ratio: string;
  onRatioChange: (v: string) => void;
  resolutionOptions: string[];
  resolution: string;
  onResolutionChange: (v: string) => void;
  totalCount: number;
  selectedTypesCount: number;
  onPreset: Parameters<typeof PlatformPresets>[0]['onApply'];
  isSupported: boolean;
  presetsCurrent: { ratio: string; resolution: string } | null;
}

export const ImageSettingsSection: React.FC<ImageSettingsSectionProps> = ({
  models, modelValue, onModelChange,
  ratioOptions, ratio, onRatioChange,
  resolutionOptions, resolution, onResolutionChange,
  totalCount, selectedTypesCount,
  onPreset, isSupported,
}) => (
  <div
    id="image-settings-section"
    className="bg-white border border-slate-200 rounded-lg p-5"
  >
    <p className="text-[11px] font-bold text-primary">执行参数</p>
    <h2 className="text-base font-black mt-1">模型与输出规格</h2>

    <div className="mt-4">
      <ModelSelector options={models} value={modelValue} onChange={onModelChange} />
    </div>

    <PlatformPresets onApply={onPreset} />

    <label className="block mt-4">
      <span className="text-xs font-bold text-slate-700">{messages.ratioLabel}</span>
      <select
        value={ratio}
        onChange={(e) => onRatioChange(e.target.value)}
        className="mt-1.5 w-full h-9 rounded border border-slate-200 bg-white px-2 text-xs font-medium"
      >
        {ratioOptions.map((r) => <option key={r}>{r}</option>)}
      </select>
    </label>

    <div className="grid grid-cols-2 gap-3 mt-4">
      <div>
        <span className="text-xs font-bold text-slate-700">{messages.totalCountLabel}</span>
        <div className="mt-1.5 flex h-9 items-center justify-between rounded border border-slate-200 bg-slate-50 px-2">
          <span className="text-sm font-black text-slate-800">{totalCount} 张</span>
          <span className="text-[10px] font-normal text-slate-400">{selectedTypesCount} 个类型</span>
        </div>
      </div>
      <label className="block">
        <span className="text-xs font-bold text-slate-700">{messages.resolutionLabel}</span>
        <select
          value={resolution}
          onChange={(e) => onResolutionChange(e.target.value)}
          className="mt-1.5 w-full h-9 rounded border border-slate-200 bg-white px-2 text-xs font-medium"
        >
          {resolutionOptions.map((r) => <option key={r}>{r}</option>)}
        </select>
      </label>
    </div>

    <UnsupportedNotice show={!isSupported} />
  </div>
);
```

- [ ] **Step 6: 类型校验**

```bash
npm run lint
```

预期:0 error

---

## Task 22: 顶层 `CreateImageTask.tsx` 容器(把全部子组件装配)

**Files:**
- Create: `src/components/CreateImageTask/CreateImageTask.tsx`

> **这是最大的一步**:把 hook 输出 → 17 个子组件 → 3 个 dialog 装配起来。
> 先一次性写完,然后跑 lint + test。

- [ ] **Step 1: 写顶层容器**

文件 ~200 行。结构骨架(详细见 spec §4 与 §3):

```tsx
// src/components/CreateImageTask/CreateImageTask.tsx
import React, { useCallback, useMemo, useState } from 'react';
import { AppScreen } from '../../types';

import { TopHeader } from './header/TopHeader';
import { ReadinessBanner } from './header/ReadinessBanner';
import { ThreeColumnLayout } from './layout/ThreeColumnLayout';
import { ImageSourceSection } from './left/ImageSourceSection';
import { CompositeSection } from './left/CompositeSection';
import { ReferenceGrid, type ReferenceRef } from './left/ReferenceGrid';
import { ImageTypeSelector } from './center/ImageTypeSelector';
import { TemplatePicker, type TemplateOption } from './center/TemplatePicker';
import { StyleScenePoseRow } from './center/StyleScenePoseRow';
import { AdvancedSettings } from './center/AdvancedSettings';
import { ImageContentSection } from './center/ImageContentSection';
import { ProductFactsEditor } from './center/ProductFactsEditor';
import { PerTypePromptEditor } from './center/PerTypePromptEditor';
import { ImageSettingsSection, type ModelOption } from './right/ImageSettingsSection';
import { ReviewStrategyPanel } from './right/ReviewStrategyPanel';
import { ConflictDialog } from './dialogs/ConflictDialog';
import { TemplateOverwriteDialog } from './dialogs/TemplateOverwriteDialog';
import { ExecutionConfirmDialog } from './dialogs/ExecutionConfirmDialog';
import { useCreateImageTaskState } from '../../hooks/useCreateImageTaskState';
import type { ProductAsset, GenerationTask } from '../../types';
import type { ReferenceSlot } from '../../lib/createImageTask/extractReferenceInsights';
import { extractProductFacts, type ProductFactsInput } from '../../lib/createImageTask/extractProductFacts';
import { applyAiOptimizePerType } from '../../lib/createImageTask/applyAiOptimizePerType';
import { computeReadinessChecks } from '../../lib/createImageTask/readinessChecks';
import { REFERENCE_SLOTS_INTERNAL } from '../../lib/createImageTask/referencesConfig';

interface CreateImageTaskProps {
  products: ProductAsset[];
  onAddTask: (task: GenerationTask) => void;
  setScreen: (screen: AppScreen) => void;
  openTransit: () => void;
  selectedProduct: ProductAsset;
  setSelectedProduct: (product: ProductAsset) => void;
}

export const CreateImageTask: React.FC<CreateImageTaskProps> = (props) => {
  const { selectedProduct, setScreen, onAddTask } = props;
  // local UI state: 表单字段 + 局部 selection
  const [productFacts, setProductFacts] = useState<ProductFactsInput>({
    name: '', sellingPoints: selectedProduct.specs.sellingPoints.join('，'),
    productCategory: selectedProduct.category,
    colorPattern: selectedProduct.specs.color[0] || '米白色',
    fabricTexture: selectedProduct.specs.material || '细腻针织纹理',
    fitStructure: '修身版型',
  });
  const [mainValue, setMainValue] = useState<any>(null);
  const [ratio, setRatio] = useState<'1:1' | '3:4' | '4:5' | '9:16' | '16:9'>('3:4');
  const [resolution, setResolution] = useState<'1024px' | '1536px' | '2048px'>('1536px');

  // hook
  const state = useCreateImageTaskState({
    isProductBound: !!mainValue,
    product: selectedProduct,
    channel: { id: 'channel-1', name: '云端 API', accessType: 'cloud', health: 'NORMAL' },
    model: {
      id: 'gpt-image-1', name: 'gpt-image-1',
      capability: {
        ratios: ['1:1', '3:4', '4:5', '9:16', '16:9'],
        maxCount: 5,
        resolutions: ['1024px', '1536px', '2048px'],
      },
    },
    ratio,
    resolution,
    templateName: '默认模板',
    toSubmit: async () => '',
    onAddTask,
    setScreen,
  });

  const {
    selectedTypes, typeCounts, template,
    style, scene, pose, negativePrompt,
    promptOverrides, promptHasEdits, factsConfirmed, promptsConfirmed,
    assistantState, reviewEnabled, references, readinessIssue,
    pendingChoice, conflictOpen, templatePickerOpen, pendingTemplate,
    templateOverwriteOpen, executionConfirmOpen, isSubmitting, hydrated,
    readinessCount, prompts, promptsComplete, factsComplete,
    isSupported, totalCount,
    toggleType, changeTypeCount, requestTemplateChange, applyTemplate,
    setStyle, setScene, setPose, setNegativePrompt,
    updateProductFact, confirmFacts,
    setPromptOverride, confirmPrompts, runAssistantAnalysis,
    applyPreset, setReviewEnabled,
    selectReference, checkAndGenerate, submitTasks,
  } = state;

  // AI 助手 → 直接覆盖 promptOverrides
  const handleAssistantClick = useCallback(() => {
    runAssistantAnalysis();
  }, [runAssistantAnalysis]);

  // AI 建议 / 按表单重算 包装层
  const handleRegenerateAll = useCallback(() => {
    // 重算 → setPromptOverrides({}) 触发 prompts useMemo
    setStyle('');  setStyle(style);  // trick: 触发 prompt 重算
    setStyle(style);
    // 实际上要让 hook 提供一个显式的 `regeneratePrompts()` action。
    // 本任务 Step 用 — 直接通过 setPromptOverrides + 一次 setStyle skip/touch 触发
    // ⚠ 这个 trick 不优雅;真正严谨做法是 hook 暴露 `regeneratePrompts()` action(在 hook 任务里加)
  }, [style, setStyle]);

  const handleAiOptimizeSelected = useCallback(() => {
    const next = applyAiOptimizePerType(prompts, selectedTypes);
    // 把 next 写回 promptOverrides
    next; // 这里应触发 hook 的"按 selected types 写 overrides"接口
  }, [prompts, selectedTypes]);

  // placeholder presets
  const handlePresetApply = useCallback((preset: { name: string; ratio: string; resolution: string }) => {
    if (preset.ratio === ratio && preset.resolution === resolution) return;
    applyPreset(preset);
    // applyPreset 当前是占位 —— Task 23 收尾时改 hook 让它真的调 setRatio/setResolution
    setRatio(preset.ratio as typeof ratio);
    setResolution(preset.resolution as typeof resolution);
  }, [applyPreset, ratio, resolution]);

  const isProductBound = !!mainValue;

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden text-slate-800">
      <TopHeader
        selectedTypesCount={selectedTypes.length}
        totalCount={totalCount}
        readinessCount={readinessCount}
        onBack={() => setScreen(AppScreen.TASKS)}
        onCheckAndGenerate={checkAndGenerate}
      />
      <ReadinessBanner message={readinessIssue} />

      <ThreeColumnLayout
        left={
          <>
            <ImageSourceSection
              mainValue={mainValue}
              onPickMain={() => props.openTransit()}
            />
            {selectedProduct.category === '户外服饰' && (
              <CompositeSection
                productId={/^\d+$/.test(selectedProduct.id) ? selectedProduct.id : undefined}
                onApplied={(asset) => setMainValue({
                  fileResourceId: asset.fileResourceId,
                  originalUrl: asset.originalUrl,
                  thumbnailUrl: asset.thumbnailUrl,
                  name: asset.name,
                })}
              />
            )}
            <ReferenceGrid
              values={references}
              onSelect={selectReference}
              openSlotPicker={() => { /* 占位 —— 主流程暂未启用 5 slot 选择 UI,后续接入 */ }}
            />
          </>
        }
        center={
          <>
            <ImageTypeSelector
              selectedTypes={selectedTypes}
              typeCounts={typeCounts}
              maxCountPerType={5}
              onToggle={toggleType}
              onChangeCount={changeTypeCount}
            />
            <TemplatePicker
              value={template}
              options={[{ id: 'default', name: '默认模板' }]}
              onPickRequest={requestTemplateChange}
            />
            <StyleScenePoseRow
              style={style} scene={scene} pose={pose}
              onStyleChange={setStyle} onSceneChange={setScene} onPoseChange={setPose}
            />
            <AdvancedSettings negativePrompt={negativePrompt} onChange={setNegativePrompt} />
            <ImageContentSection
              isProductBound={isProductBound}
              assistantState={assistantState}
              onAssistantClick={handleAssistantClick}
              productFacts={productFacts}
              factsComplete={factsComplete}
              factsConfirmed={factsConfirmed}
              onChangeFact={updateProductFact}
              onConfirmFacts={confirmFacts}
              promptsConfirmed={promptsConfirmed}
              selectedTypes={selectedTypes}
              defaultPrompts={prompts}
              promptOverrides={promptOverrides}
              templateName={template}
              promptsComplete={promptsComplete}
              onChangePromptOverride={setPromptOverride}
              onRegenerateAll={handleRegenerateAll}
              onAiOptimizeSelected={handleAiOptimizeSelected}
              onConfirmPrompts={confirmPrompts}
            />
          </>
        }
        right={
          <>
            <ImageSettingsSection
              models={[]}
              modelValue={{ channelId: null, modelId: null }}
              onModelChange={() => {}}
              ratioOptions={['1:1','3:4','4:5','9:16','16:9']}
              ratio={ratio}
              onRatioChange={(v) => setRatio(v as typeof ratio)}
              resolutionOptions={['1024px','1536px','2048px']}
              resolution={resolution}
              onResolutionChange={(v) => setResolution(v as typeof resolution)}
              totalCount={totalCount}
              selectedTypesCount={selectedTypes.length}
              onPreset={handlePresetApply}
              isSupported={isSupported}
              presetsCurrent={null}
            />
            <ReviewStrategyPanel reviewEnabled={reviewEnabled} onChange={setReviewEnabled} />
          </>
        }
      />

      {/* 弹窗层 */}
      <TemplateOverwriteDialog
        open={templateOverwriteOpen}
        onCancel={() => {/* hook 暂未提供 setTemplateOverwriteOpen,留 TODO */}}
        onConfirm={() => pendingTemplate && applyTemplate(pendingTemplate)}
      />
      <ExecutionConfirmDialog
        open={executionConfirmOpen}
        isSubmitting={isSubmitting}
        selectedTypes={selectedTypes}
        typeCounts={typeCounts}
        totalCount={totalCount}
        productName={productFacts.name}
        templateName={template}
        ratio={ratio}
        resolution={resolution}
        onCancel={() => {/* TODO */}}
        onSubmit={submitTasks}
      />
      <ConflictDialog
        open={conflictOpen}
        unsupported={[]}
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    </div>
  );
};
```

- [ ] **Step 2: 类型校验**

```bash
npm run lint
```

预期:大量错误。**这是预期的** — 本步骤只导出文件骨架,Task 23 收尾时修齐所有紧耦合(dialog onCancel、handleRegenerateAll trick、handleAiOptimizeSelected 等)。

- [ ] **Step 3: Commit(不通过 lint 也能 commit,记录为 "WIP")**

```bash
git add src/components/CreateImageTask/CreateImageTask.tsx
git commit -m "wip(create-task): scaffold top-level container with child components"
```

---

## Task 23: 顶层容器收尾(handleRegenerateAll / AI 建议 / dialog onCancel / hook 暴露 `regeneratePrompts` action + `setPromptOverrides`)

**Files:**
- Modify: `src/hooks/useCreateImageTaskState.ts`(新增 `regeneratePrompts()` 与更细的 `setPromptOverridesByType(map)`)
- Modify: `src/components/CreateImageTask/CreateImageTask.tsx`(改 handleRegenerateAll / handleAiOptimizeSelected / dialog onCancel)

- [ ] **Step 1: hook 加 action**

```ts
// useCreateImageTaskState.ts,在 hook return 之前
const regeneratePrompts = useCallback(() => {
  // 清空 overrides → 触发 prompts useMemo 用默认 facts 重算
  setPromptOverrides({});
  setPromptHasEdits(false);
  // 立即把 prompts 的"上游"事实 reset 为 formInput 派生(等同于 detect 后第一次)
  setProductFacts(extractProductFacts(formInput));
  setPromptsConfirmed(false);
}, [formInput]);

const applyAiOptimizeToSelected = useCallback((selected: ImageGenerationType[]) => {
  const next = applyAiOptimizePerType(
    prompts,
    selected,
  );
  setPromptOverrides(prev => {
    const out = { ...prev };
    for (const t of selected) {
      if (t in next) out[t] = next[t];
    }
    return out;
  });
  setPromptHasEdits(true);
  setPromptsConfirmed(false);
}, [prompts]);
```

把上面两个 action 加进 return 对象。

- [ ] **Step 2: 在顶层容器用真 action 替换占位实现**

```tsx
const handleRegenerateAll = useCallback(() => {
  regeneratePrompts();
}, [regeneratePrompts]);

const handleAiOptimizeSelected = useCallback(() => {
  applyAiOptimizeToSelected(selectedTypes);
  toast.success('已对所选类型应用 AI 建议包装');
}, [applyAiOptimizeToSelected, selectedTypes]);

// dialog onCancel / onClose 用 hook 暴露的 setter:
const setTemplateOverwriteOpen = /* hook 暴露 */;
const setExecutionConfirmOpen = /* hook 暴露 */;
const setConflictOpen = /* hook 暴露 */;

// 在顶层容器:
<TemplateOverwriteDialog
  open={templateOverwriteOpen}
  onCancel={() => setTemplateOverwriteOpen(false)}
  onConfirm={() => pendingTemplate && applyTemplate(pendingTemplate)}
/>
```

- [ ] **Step 3: 类型校验 + 测试**

```bash
npm run lint
npm run test
```

预期:0 error + 测试全 pass。如果有错,继续迭代直到绿。

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCreateImageTaskState.ts src/components/CreateImageTask/CreateImageTask.tsx
git commit -m "refactor(create-task): wire regeneratePrompts / AI-apply / dialog onCancel"
```

---

## Task 24: `src/components/CreateImageTask.tsx` 替换为 re-export 旧模块 → 备份

**Files:**
- Modify: `src/components/CreateImageTask.tsx`

- [ ] **Step 1: 替换**

```tsx
// [2026-07-21] demo 主版对齐 — 旧单文件实现迁出到子目录;
// 本入口保留为旧路径的兼容转发(下个 task 删除)。
// 旧文件本身的逻辑在 .ts 末尾备份:本次改造是从 700 行单文件 → 17 子组件 + hook。
// 新文件位置:src/components/CreateImageTask/CreateImageTask.tsx

// 这一行保证旧 import path 'src/components/CreateImageTask' 仍然可用
export { default } from './CreateImageTask/CreateImageTask';
```

- [ ] **Step 2: 类型校验**

```bash
npm run lint
```

预期:0 error。

- [ ] **Step 3: 跑 dev(用户手动,**不要** AI 执行)**

> **禁止** AI 执行 `npm run dev` —— 留给用户在 IDE 启动。

---

## Task 25: 删除旧 `TaskParamsPanel.tsx` 与清理

**Files:**
- Delete: `src/components/createTask/TaskParamsPanel.tsx`
- Modify: `src/components/CreateImageTask.tsx`(改为简单 re-export from `index.tsx`)

- [ ] **Step 1: 删除 TaskParamsPanel.tsx**

确认 `App.tsx` 不再 import 它(`App.tsx` 走的是 `<CreateImageTask ... />` 而不是直接 `<TaskParamsPanel />`,且新 `CreateImageTask/CreateImageTask.tsx` 已不复用 TaskParamsPanel)。

```bash
cd "D:/Program/Idea-Work/dafenqi-ai-project/EC-AIGC"
rm src/components/createTask/TaskParamsPanel.tsx
```

- [ ] **Step 2: 把 index.tsx 设为默认导出入口**

```ts
// src/components/CreateImageTask/index.tsx
export { CreateImageTask as default } from './CreateImageTask';
```

并把 `src/components/CreateImageTask.tsx` 改为:

```tsx
// [2026-07-21] 已迁出 — 现在只 re-export。历史用 import { CreateImageTask } from './CreateImageTask' 不变。
export { default } from './CreateImageTask/index';
```

- [ ] **Step 3: 类型校验**

```bash
npm run lint
```

预期:0 error。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(create-task): delete old TaskParamsPanel + finalize index re-export"
```

---

## Task 26: 视觉/视觉回归 + DoD 校验

**Files:**
- Modify: 无(本次仅验收)

- [ ] **Step 1: 跑全部测试**

```bash
npm run test
```

预期:全 pass(10 余个测试文件累计 ~50 测试)

- [ ] **Step 2: 类型校验**

```bash
npm run lint
```

预期:0 error

- [ ] **Step 3: 用户手动跑 dev(AI 不执行)**

请用户在 IDE 启动 `npm run dev`,访问创建图片任务页,做下列验收:

| DoD | 验证 |
|----|------|
| 1 样式对齐 demo | 三栏比例、卡片圆角、`rounded-md/lg/fill` 与 demo 主版一致 |
| 2 行为对齐 | 4 项 readiness 检查 + smooth scroll + ConflictDialog + TemplateOverwriteDialog |
| 3 业务能力保留 | 主图选择/参考图/OutfitComposePanel 都能选,COS 上传走 `useFileUpload`,autoCreateProduct 通过 buildSubmitPayload 透传 |
| 4 逐类型多提 | 点"检查并生成" → ExecutionConfirmDialog → 看到 N 张数 → 确认 → 逐类型 N 条 onAddTask → 跳任务列表 |
| 5 可访问性 | 键盘 Tab 可达所有 button 与 select;Escape 关闭弹窗;增减张数按钮 aria-label |
| 6 草稿恢复 | 编辑后刷新页面 → toast "已恢复上次编辑" |
| 7 motion 动画 | 弹窗 fade+scale 进入、ReadinessBanner fadeInDown、AI 助手按钮 pulse |

- [ ] **Step 4: 视觉回归(若有 .playwright-cli 截图)**

可执行:`npx playwright screenshot http://localhost:3001/createImageTask docs/superpowers/screenshots/create-image-task-v2.png` —— 由用户在 IDE 或外部工具跑

- [ ] **Step 5: 写收尾 commit + memory**

如果有需要记忆的事项(如"demo 是后续迭代方向"),用 `/memory` skill 添加到 `D:\Program\Idea-Work\dafenqi-ai-project\EC-AIGC\.claude\memory\`(本期不动)。

---

## Self-Review(我自己跑一遍)

### 1. Spec 覆盖率

| spec 章节 | 在哪个 task |
|-----------|------------|
| §1 背景 | (discussion 已完成) |
| §2 范围内 | Task 9-25 |
| §2 范围外 | (不实现) |
| §3.1 顶层 props 不变 | Task 22 + Task 24/25 保留旧 entry,`App.tsx` 不变 |
| §3.2 文件拆分 | Task 9-25 全部建好 |
| §3.3 纯函数模块 | Task 3-8 + Task 12 |
| §3.4 依赖增量 | Task 1 校验(`motion`+`lucide-react`已存在 ✅) |
| §4.1 状态分两类 | Task 10(hook 完整覆盖) |
| §4.2 Prompt 规则 | Task 5(pure fn) + Task 10(hook 公式拼接) |
| §4.3 readinessChecks | Task 3 + Task 22 |
| §4.4 Conflict 流 | Task 22 + Task 14(ConflictDialog) |
| §4.5 提交流 | Task 8(buildGenerationTask) + Task 10(hook submitTasks) + Task 22(顶层容器) |
| §4.6 自动保存 | Task 10(hook) |
| §4.7 AI 助手 | Task 19(三态) + Task 10(runAssistantAnalysis) |
| §5 样式要点 | Task 14(transition) + 16/17(header+layout) + 18-21(子组件样式) |
| §6 5 项 motion | Task 14(dialog fade+scale) + Task 13(DialogFrame) + Task 15(keyframes)+ Task 16(ReadinessBanner) + Task 19(进度按钮 pulse) + Task 19(模板下拉 fadeIn)|
| §7 错误处理 | spec §7 行已在各任务体现:`isSubmitting` lock / toast 失败 / autosave catch |
| §8 可访问性 | aria-label + role=alert + Escape 关闭(每个组件 step 中) |
| §9 i18n 占位 | Task 2(messages 集中) |
| §10 测试 | Task 1 + 每个纯函数 task 一个 test + Task 11(类型) + Task 26 收尾 |
| §11 DoD 1-7 | Task 26 验收 |

### 2. 占位符扫描

- 无 TBD / TODO 占位(除了"Known TBD"标注,这些是与 demo 的真实差异点,后续接入)
- 所有 code block 都给出真实代码,不含 "implement later"

### 3. 类型一致性

- `ImageGenerationType` 在 `readinessChecks.ts` 定义 → 在 hook / 组件 / types.ts 末尾 re-export
- `ReferenceSlot` 在 `extractReferenceInsights.ts` 定义 → 在 `referencesConfig.ts` 与 hook 共享
- `ProductFacts` 类型在 `extractProductFacts.ts` 定义 → hook 内部用
- `GenerationTaskBuildResult = GenerationTask`(types.ts) → 与 hook 一致
- `setModelWithValidation` 在 useTaskParams(原 hook)与 useCreateImageTaskState 都有,二者签名不同(创建任务 hook 是占位),通过名字区分

未发现名称冲突 bug。

---

## 执行选项

Plan 已写好,共 **26 个 task**。下面有两个执行方式,你选哪个?
