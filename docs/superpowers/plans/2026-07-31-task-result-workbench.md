# 批次任务结果工作台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将任务详情改造成按图片类型工作的批次结果工作台，并用本地飞书缓存中的真实试穿图替换错误和空缺的 mock 结果。

**Architecture:** 保持 `App.tsx` 顶层状态和 `GenerationTask` mock 模型不变。`TaskList` 继续负责批次聚合，新增共享的图片预览层；`TaskDetailsDrawer` 从五标签页改为左侧类型导航和右侧当前类型工作区。真实图片复制进本项目静态目录，mock 只引用项目内 URL 并保留飞书来源元数据。

**Tech Stack:** React 19、TypeScript、Vite 6、Tailwind CSS 4、现有 Material Symbols。

---

## 文件结构

- 新增：`public/mock-assets/results/sleepdress-three-view.png`、`sleepdress-bedroom.png`、`sleepdress-three-view-bedroom.png`、`sleepdress-lace-detail.png`，可由 Vite 静态提供的真实 mock 图。
- 新增：`src/components/ImagePreviewDialog.tsx`，列表和详情共用的图片放大预览层。
- 修改：`src/types.ts`，为结果增加只读的 mock 来源追踪字段。
- 修改：`src/mockData.ts`，将混用商品名的 `G-20260702-001` 替换为真实睡裙批次和完整结果集。
- 修改：`src/components/TaskList.tsx`，为二级行的结果缩略图接入预览层。
- 修改：`src/components/TaskDetailsDrawer.tsx`，移除五标签页，重构为图片类型导航和结果工作区。

## Task 1: 导入可复现的真实结果素材

**Files:**
- Create: `public/mock-assets/results/sleepdress-three-view.png`
- Create: `public/mock-assets/results/sleepdress-bedroom.png`
- Create: `public/mock-assets/results/sleepdress-three-view-bedroom.png`
- Create: `public/mock-assets/results/sleepdress-lace-detail.png`

- [ ] **Step 1: 复制已核对的飞书本地缓存到项目静态目录**

```bash
mkdir -p public/mock-assets/results
cp '/Users/jay/Desktop/02-projects/AIGC/开发/aigc-workbench/public/generated/lark-existing/recvkTkZ6L8rlL/item/1782441429457_0.png' public/mock-assets/results/sleepdress-three-view.png
cp '/Users/jay/Desktop/02-projects/AIGC/开发/aigc-workbench/public/generated/lark-existing/recvkTkZ6L8rlL/item/1782444082176_0.png' public/mock-assets/results/sleepdress-bedroom.png
cp '/Users/jay/Desktop/02-projects/AIGC/开发/aigc-workbench/public/generated/lark-existing/recvkTkZ6L8rlL/item/1782444142221_0.png' public/mock-assets/results/sleepdress-three-view-bedroom.png
cp '/Users/jay/Desktop/02-projects/AIGC/开发/aigc-workbench/public/generated/lark-existing/recvkTkZ6L8rlL/item/1782444206149_0.png' public/mock-assets/results/sleepdress-lace-detail.png
```

- [ ] **Step 2: 核对文件存在且图像可读**

Run: `sips -g pixelWidth -g pixelHeight public/mock-assets/results/*.png`

Expected: 四个 PNG 均返回非零的像素宽高。

## Task 2: 为结果增加来源追踪

**Files:**
- Modify: `src/types.ts:102-113`

- [ ] **Step 1: 扩展结果类型，不改变正式 API 必填约束**

在 `GeneratedImageResult` 的 `listingReview` 后加入：

```ts
  /** mock 导入溯源；正式接口由后端资产/结果 ID 承载。 */
  sourceRecordId?: string;
  sourceFileName?: string;
```

- [ ] **Step 2: 运行类型检查**

Run: `npm run lint`

Expected: `tsc --noEmit` 退出码为 0。

## Task 3: 重建睡裙批次的真实 mock 数据

**Files:**
- Modify: `src/mockData.ts:421-565`

- [ ] **Step 1: 定义可复用的来源常量，避免在多个结果中拼写路径**

在 `mockTasks` 前添加：

```ts
const sleepdressResultSource = {
  recordId: 'recvkTkZ6L8rlL',
  productName: '雾蓝紫碎花蕾丝睡裙',
  productImg: '/mock-assets/lark/sleepdress-pure.jpg',
} as const;
```

- [ ] **Step 2: 用同一商品、同一批次和三种图片类型替换 `G-20260702-001` 的现有三条任务**

批次固定使用 `groupId: 'G-20260702-001'`、`submittedAt: '2026-07-02 14:05'`，任务顺序为：

```ts
{ id: 'T-1002', groupOrder: 1, imageType: 'on_model', status: 'archived' }
{ id: 'T-1000', groupOrder: 2, imageType: 'scene_detail', status: 'rejected' }
{ id: 'T-0996', groupOrder: 3, imageType: 'detail_closeup', status: 'candidate' }
```

三个任务的 `productName`、`productImg`、`taskPrompt` 和 `negativePrompt` 必须均为睡裙上下文，不能保留“精华保湿乳”“包装”或“品牌文字”描述。

- [ ] **Step 3: 填入所有真实结果，并将打回图保留为有图状态**

`T-1002.results` 包含两张三视图结果；`T-1000.results` 包含卧室场景图，标记为 `rejected` 并写入 mock 审核意见；`T-0996.results` 包含领口细节图，标记为 `candidate`。每个结果按下例填入来源：

```ts
{
  id: 'T-1000-result-1',
  url: '/mock-assets/results/sleepdress-bedroom.png',
  version: 1,
  reviewStage: 'rejected',
  sourceRecordId: sleepdressResultSource.recordId,
  sourceFileName: '1782444082176_0.png',
  aestheticReview: {
    reviewer: '陈美晴 · 设计/美工',
    timestamp: '2026-07-02 14:28',
    rating: 3,
    tags: ['构图问题', '商业可用'],
    comment: 'mock 审核：场景留白偏多，需提升商品主体在画面中的占比。',
    decision: 'rejected',
  },
}
```

- [ ] **Step 4: 为可编辑结果保留完整版本上下文**

为 `T-0996` 的候选结果填写 `revisionContext`，其中 `basePrompt` 与任务的 `taskPrompt` 相同，`negativePrompt` 与任务一致，`fidelityRules` 至少包含“保持睡裙款式、蕾丝花型和雾蓝紫颜色不变”。

- [ ] **Step 5: 运行类型检查和生产构建**

Run: `npm run lint && npm run build`

Expected: 两条命令均退出码为 0。

## Task 4: 实现共用图片放大预览层

**Files:**
- Create: `src/components/ImagePreviewDialog.tsx`

- [ ] **Step 1: 创建明确的输入边界**

```ts
export interface PreviewImage {
  id: string;
  url: string;
  alt: string;
}

interface ImagePreviewDialogProps {
  images: PreviewImage[];
  initialImageId: string;
  onClose: () => void;
}
```

- [ ] **Step 2: 实现预览交互**

组件内部维护当前索引与缩放级别。点击遮罩或关闭图标关闭；左右按钮在 `images.length > 1` 时切换图片；缩放只在 1、1.5、2 三档间切换；所有按钮都提供中文 `aria-label`。主体图片使用：

```tsx
<img
  src={current.url}
  alt={current.alt}
  className="max-h-[78vh] max-w-full object-contain transition-transform"
  style={{ transform: `scale(${zoom})` }}
/>
```

- [ ] **Step 3: 验证小屏不溢出**

Run: `npm run lint && npm run build`

Expected: 两条命令均退出码为 0；在浏览器 390px 宽度下，图片、切换按钮和关闭按钮都在视口内。

## Task 5: 为列表缩略图接入预览

**Files:**
- Modify: `src/components/TaskList.tsx:1-112`

- [ ] **Step 1: 引入预览层和本地预览状态**

```ts
import { ImagePreviewDialog, type PreviewImage } from './ImagePreviewDialog';
import { TaskDetailsDrawer } from './TaskDetailsDrawer';

const [preview, setPreview] = useState<{ images: PreviewImage[]; imageId: string } | null>(null);
```

同时删除 `TaskDrawerTab` 导入和 `drawerTab` state；将 `openDrawer` 改为 `(group: TaskGroupView, taskId?: string) => void`，并将抽屉调用改为：

```tsx
<TaskDetailsDrawer
  tasks={selectedGroup.tasks}
  products={products}
  initialTaskId={selectedTaskId}
  onClose={() => setSelectedGroup(null)}
  onUpdateTask={onUpdateTask}
  onCreateVideo={onCreateVideo}
/>
```

- [ ] **Step 2: 让二级行缩略图成为可访问按钮**

将二级行内的 `<img>` 包在 `button` 中。点击时以该任务的 `results`（或单个 `resultUrl`）构建 `PreviewImage[]` 并调用：

```ts
setPreview({
  images: taskResults.map((result) => ({ id: result.id, url: result.url, alt: `${formatImageType(task)} v${result.version}` })),
  imageId: result.id,
});
```

缩略图容器的点击必须 `event.stopPropagation()`，防止打开预览时同时改变批次选择。

- [ ] **Step 3: 在组件末尾渲染预览层**

```tsx
{preview && (
  <ImagePreviewDialog
    images={preview.images}
    initialImageId={preview.imageId}
    onClose={() => setPreview(null)}
  />
)}
```

- [ ] **Step 4: 手工验证列表行为**

Run: `npm run dev -- --port 3003`

Expected: 展开“雾蓝紫碎花蕾丝睡裙”批次，点击任一缩略图只打开预览，点击二级行详情仍打开批次抽屉并选中该类型。

## Task 6: 将详情抽屉重构为结果工作台

**Files:**
- Modify: `src/components/TaskDetailsDrawer.tsx:1-360`

- [ ] **Step 1: 删除五标签页状态和类型**

移除 `TaskDrawerTab`、`initialTab`、`activeTab`、`tabItems` 和所有按标签分支的 JSX。保留 `activeTaskId`，作为唯一的当前图片类型选择状态；抽屉 Props 仅保留 `initialTaskId?: string`，以匹配 Task 5 的调用方。

- [ ] **Step 2: 定义当前类型的派生数据，确保全部结果可见**

```ts
const activeResults = useMemo(
  () => activeTask ? resolveResults(activeTask) : [],
  [activeTask],
);

const activePreviewImages = activeResults.map((result) => ({
  id: result.id,
  url: result.url,
  alt: `${taskImageType(activeTask)} v${result.version}`,
}));
```

结果网格只渲染 `activeResults.map(...)`，禁止使用 `slice`；不再渲染“切换为当前类型”。

- [ ] **Step 3: 替换抽屉主体为两栏布局**

```tsx
<main className="flex min-h-0 flex-1 overflow-hidden">
  <aside className="w-56 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3">
    {displayTasks.map((task) => (
      <button key={task.id} onClick={() => setActiveTaskId(task.id)}>{/* 类型、状态、产物数 */}</button>
    ))}
  </aside>
  <div className="min-w-0 flex-1 overflow-y-auto p-6">{/* 当前类型工作区 */}</div>
</main>
```

左栏按钮需使用 `activeTaskId === task.id` 区分选中态，并显示 `taskImageType(task)`、`taskStatus(task)` 和 `resolveResults(task).length`。

- [ ] **Step 4: 在当前类型工作区实现结果卡与打回信息**

每张结果卡图片改为按钮，点击打开 `ImagePreviewDialog`。当 `reviewStage === 'rejected'` 时渲染审核意见：

```tsx
{result.aestheticReview?.decision === 'rejected' && (
  <p className="mt-2 text-[11px] leading-5 text-red-700">
    打回意见：{result.aestheticReview.comment}
  </p>
)}
```

打回卡继续显示“二次编辑”和“评分与审核”操作；空状态仅用于确实没有 `activeResults` 的任务。

- [ ] **Step 5: 将输入、最终 Prompt 和审核记录压缩为当前类型的可折叠面板**

在结果网格下添加两个原生 `details` 区块：

```tsx
<details className="border border-slate-200 bg-white p-4" open>
  <summary className="cursor-pointer text-xs font-black">本次输入与最终提示词</summary>
  {/* 商品图、参考素材、taskPrompt、negativePrompt、模型、关键参数 */}
</details>
<details className="border border-slate-200 bg-white p-4">
  <summary className="cursor-pointer text-xs font-black">审核与版本记录</summary>
  {/* revisionContext.turns 和 aestheticReview */}
</details>
```

Prompt 的显示值固定为 `activeTask.taskPrompt ?? activeTask.params?.prompt ?? '未记录最终 Prompt'`，不能再显示模板提示词替代。

- [ ] **Step 6: 保留且复核二次编辑上下文链**

保留 `buildRevisionContext` 与 `createEditVersion`。在编辑弹窗的“已继承上下文”中按时间显示原始 Prompt、负面约束、保真规则、历史编辑和审核意见；提交编辑后仍将新结果追加至原任务 `results`，并设置 `parentImageId`。

- [ ] **Step 7: 运行类型检查和生产构建**

Run: `npm run lint && npm run build`

Expected: 两条命令均退出码为 0。

## Task 7: 浏览器验收

**Files:**
- Verify: `src/components/TaskList.tsx`
- Verify: `src/components/TaskDetailsDrawer.tsx`
- Verify: `src/components/ImagePreviewDialog.tsx`

- [ ] **Step 1: 在桌面宽度验证批次与结果工作台**

Run: `npm run dev -- --port 3003`

Expected: 任务列表只显示一条睡裙批次；展开有三种图片类型；详情抽屉没有旧标签页和“切换为当前类型”；当前类型展示全部结果。

- [ ] **Step 2: 验证预览和打回**

Expected: 列表及详情的缩略图均能打开预览；预览可切换、缩放和关闭；场景图显示打回意见但仍有图片与“二次编辑”。

- [ ] **Step 3: 验证二次编辑继承**

Expected: 从打回图打开二次编辑弹窗时能看到原始 Prompt、负面约束和审核意见；提交后当前类型新增候选版本，且该版本持有父结果 ID 和上一轮上下文。

- [ ] **Step 4: 检查最终工作区状态**

Run: `npm run lint && npm run build && git diff --check`

Expected: 全部退出码为 0。按项目约定不自动创建 Git commit。
