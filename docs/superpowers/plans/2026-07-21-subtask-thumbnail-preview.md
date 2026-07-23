# 子任务缩略图点击放大预览 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让任务列表中子任务(`ChildTaskChip`)的缩略图可点击,弹出简洁预览弹层,支持查看该子任务全部产出图并左右切换。

**Architecture:** 新增独立、无第三方依赖的 `ImagePreviewModal` 组件(单一职责:一组图 URL 的居中大图预览 + 多图切换)。`ChildTaskChip` 点击缩略图时,通过 `onPreview(images, index)` 回调把图列表冒泡到 `TaskList` 顶层;`TaskList` 新增 `previewImages` state 并渲染弹层,与现有 `previewTask`/`feedbackTask` 弹层同层级,避免被表格行 `overflow`/`z-index` 裁剪。

**Tech Stack:** React 19 + TypeScript 5.8 + Tailwind 4(CSS-first,`@theme`);图标用 `material-symbols-outlined`(与 `TaskList.tsx` 现有约定一致,**不引入 lucide**);无测试框架(手动验证)。

## Global Constraints

- Tailwind 4 CSS-first,**不要**创建 `tailwind.config.js`;自定义 token 走 `src/index.css` 的 `@theme{}`。
- 图标统一用 `material-symbols-outlined`(`TaskList.tsx` 现有约定),不引入 lucide 或其他图标库。
- 所有 `<img>` 沿用现有约定:`referrerPolicy="no-referrer"`、`loading="lazy"`。
- 大图原图 URL 用 `ChannelAsyncTaskImage.imageUrl`,**不加** `imageMogr2/thumbnail` 缩略参数。
- 弹层复用现有样式:`fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn`。
- 不引入任何第三方 lightbox / 图片查看库;不做滚轮缩放/拖拽平移。
- `npm run lint`(= `tsc --noEmit`)必须通过。

---

### Task 1: 新增 `ImagePreviewModal` 组件

**Files:**
- Create: `EC-AIGC/src/components/ImagePreviewModal.tsx`

**Interfaces:**
- Consumes: 无(纯展示组件)。
- Produces:
  ```ts
  export interface PreviewImage {
    url: string;      // 原图完整 URL(不带 imageMogr2 缩略参数)
    label?: string;   // 可选:批次/版本说明,展示在计数旁
  }
  export interface ImagePreviewModalProps {
    images: PreviewImage[];
    initialIndex?: number;   // 默认 0
    onClose: () => void;
  }
  export const ImagePreviewModal: React.FC<ImagePreviewModalProps>;
  ```

- [ ] **Step 1: 创建组件文件**

创建 `EC-AIGC/src/components/ImagePreviewModal.tsx`,完整内容如下:

```tsx
import React, { useCallback, useEffect, useState } from 'react';

export interface PreviewImage {
  /** 原图完整 URL(不带 imageMogr2 缩略参数) */
  url: string;
  /** 可选:批次/版本说明,展示在计数旁 */
  label?: string;
}

export interface ImagePreviewModalProps {
  images: PreviewImage[];
  initialIndex?: number;
  onClose: () => void;
}

/**
 * 简洁图片预览弹层:居中大图 + 多图左右切换。
 *  - 无第三方依赖,复用现有 fixed overlay 样式
 *  - 单图时隐藏箭头与缩略图条
 *  - 支持 ESC 关闭、← / → 切换、点击遮罩关闭
 */
export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  images,
  initialIndex = 0,
  onClose,
}) => {
  const safeInitial = Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0));
  const [index, setIndex] = useState(safeInitial);
  const [errored, setErrored] = useState(false);

  const total = images.length;
  const current = images[index];

  const goPrev = useCallback(() => {
    setErrored(false);
    setIndex((i) => (i - 1 + total) % total);
  }, [total]);

  const goNext = useCallback(() => {
    setErrored(false);
    setIndex((i) => (i + 1) % total);
  }, [total]);

  // 键盘:ESC 关闭,← / → 切换
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && total > 1) goPrev();
      else if (e.key === 'ArrowRight' && total > 1) goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goPrev, goNext, total]);

  if (total === 0) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
          aria-label="关闭"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        {/* 大图区 */}
        <div className="relative flex items-center justify-center">
          {total > 1 && (
            <button
              onClick={goPrev}
              className="absolute left-2 z-10 w-9 h-9 rounded-full bg-white/80 shadow-md flex items-center justify-center text-slate-600 hover:bg-white cursor-pointer"
              aria-label="上一张"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
          )}

          {current && !errored ? (
            <img
              src={current.url}
              alt={current.label ?? `image-${index}`}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl bg-white"
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={() => setErrored(true)}
            />
          ) : (
            <div className="w-[60vw] max-w-lg aspect-square rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
              <span className="material-symbols-outlined text-6xl">broken_image</span>
            </div>
          )}

          {total > 1 && (
            <button
              onClick={goNext}
              className="absolute right-2 z-10 w-9 h-9 rounded-full bg-white/80 shadow-md flex items-center justify-center text-slate-600 hover:bg-white cursor-pointer"
              aria-label="下一张"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          )}
        </div>

        {/* 计数 + label */}
        <div className="text-xs text-white/90 font-mono flex items-center gap-2">
          <span>{index + 1} / {total}</span>
          {current?.label && <span className="opacity-70">· {current.label}</span>}
        </div>

        {/* 底部缩略图条(多图时) */}
        {total > 1 && (
          <div className="flex gap-1.5 max-w-[90vw] overflow-x-auto p-1">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => { setErrored(false); setIndex(i); }}
                className={`w-12 h-12 rounded overflow-hidden border-2 shrink-0 cursor-pointer ${
                  i === index ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
                aria-label={`查看第 ${i + 1} 张`}
              >
                <img
                  src={img.url}
                  alt={img.label ?? `thumb-${i}`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: 类型检查通过**

Run: `npm run lint`(在 `EC-AIGC/` 目录)
Expected: PASS(无类型错误)。若报 `animate-fadeIn`/`bg-primary`/`backdrop-blur-xs` 等类未定义 —— 忽略,这些是 Tailwind 运行时工具类,`tsc` 不校验 className。

---

### Task 2: `ChildTaskChip` 缩略图可点击并冒泡图列表

**Files:**
- Modify: `EC-AIGC/src/components/TaskList.tsx`(`ChildTaskChipProps` 约 29–32 行;`ChildTaskChip` 约 48–123 行)

**Interfaces:**
- Consumes: `PreviewImage`(Task 1)。
- Produces: `ChildTaskChipProps` 新增 `onPreview: (images: PreviewImage[], index: number) => void`。

- [ ] **Step 1: 引入类型 import**

在 `TaskList.tsx` 顶部,把 `TaskDetailsDrawer` import(第 12 行)后新增一行:

```tsx
import { ImagePreviewModal, PreviewImage } from './ImagePreviewModal';
```

- [ ] **Step 2: 扩展 `ChildTaskChipProps`**

把(约 29–32 行):

```tsx
interface ChildTaskChipProps {
  child: ChannelAsyncTask;
  onRetry: (id: string) => void;
}
```

改为:

```tsx
interface ChildTaskChipProps {
  child: ChannelAsyncTask;
  onRetry: (id: string) => void;
  /** [2026-07-21] 点击缩略图放大预览:把该子任务全部产出图冒泡到 TaskList 顶层 */
  onPreview: (images: PreviewImage[], index: number) => void;
}
```

- [ ] **Step 3: 组件签名接收 `onPreview`,构造 preview 图列表**

把(第 48 行):

```tsx
const ChildTaskChip: React.FC<ChildTaskChipProps> = ({ child, onRetry }) => {
```

改为:

```tsx
const ChildTaskChip: React.FC<ChildTaskChipProps> = ({ child, onRetry, onPreview }) => {
```

然后在 `const thumbUrl = buildThumbUrl(firstImg?.imageUrl, 64);`(第 60 行)之后新增:

```tsx
  // [2026-07-21] 放大预览用原图(不加缩略参数);label 用 batchIdx + version
  const previewImages: PreviewImage[] = imgs
    .filter((im) => !!im.imageUrl)
    .map((im) => ({
      url: im.imageUrl,
      label: im.version ? `batchIdx=${im.batchIdx} · ${im.version}` : `batchIdx=${im.batchIdx}`,
    }));
  const canPreview = previewImages.length > 0;
```

- [ ] **Step 4: 缩略图 `<img>` 包一层可点击容器**

把当前缩略图三元(第 69–83 行)的 `thumbUrl ? (...) : (...)` 整体保持不变,但在其外层加点击处理。具体:把第 68–83 行

```tsx
        {/* 缩略图(64x64,SUCCESS 且有图才显示) */}
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={`batchIdx=${child.batchIdx}`}
            className="w-10 h-10 rounded object-cover border border-black/10"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-black/5 flex items-center justify-center">
            <span className="material-symbols-outlined text-sm opacity-50">
              {child.status === 'SUCCESS' ? 'image' : 'pending'}
            </span>
          </div>
        )}
```

替换为:

```tsx
        {/* 缩略图(64x64,SUCCESS 且有图才显示;可点击放大) */}
        {thumbUrl ? (
          <button
            type="button"
            onClick={() => canPreview && onPreview(previewImages, 0)}
            className="w-10 h-10 rounded overflow-hidden border border-black/10 cursor-zoom-in p-0 block"
            aria-label={`放大预览 batchIdx=${child.batchIdx}`}
          >
            <img
              src={thumbUrl}
              alt={`batchIdx=${child.batchIdx}`}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          </button>
        ) : (
          <div className="w-10 h-10 rounded bg-black/5 flex items-center justify-center">
            <span className="material-symbols-outlined text-sm opacity-50">
              {child.status === 'SUCCESS' ? 'image' : 'pending'}
            </span>
          </div>
        )}
```

> 说明:`thumbUrl` 非空即代表有 `firstImg?.imageUrl`,故 `canPreview` 恒为 true;保留 `canPreview &&` 作为防御性守卫。

- [ ] **Step 5: 类型检查**

Run: `npm run lint`(`EC-AIGC/` 目录)
Expected: 报错 `Property 'onPreview' is missing`(在第 627 行 `<ChildTaskChip .../>` 调用处)—— 预期如此,Task 3 补齐。此步仅确认组件内部无类型错误(除该调用点外)。

---

### Task 3: `TaskList` 顶层接入 preview 状态与弹层

**Files:**
- Modify: `EC-AIGC/src/components/TaskList.tsx`(state 约 141–144 行;`<ChildTaskChip>` 调用约 627–633 行;弹层渲染约 800 行前)

**Interfaces:**
- Consumes: `ImagePreviewModal`、`PreviewImage`(Task 1);`ChildTaskChip.onPreview`(Task 2)。
- Produces: 无(终点)。

- [ ] **Step 1: 新增 preview state**

在 `const [feedbackTask, setFeedbackTask] = ...`(第 142 行)之后新增:

```tsx
  // [2026-07-21] 子任务缩略图放大预览
  const [previewImages, setPreviewImages] = useState<PreviewImage[] | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
```

- [ ] **Step 2: 给 `<ChildTaskChip>` 传 `onPreview`**

把(约 627–633 行):

```tsx
                            {children.map((c) => (
                              <ChildTaskChip
                                key={c.id}
                                child={c}
                                onRetry={handleRetryChild}
                              />
                            ))}
```

改为:

```tsx
                            {children.map((c) => (
                              <ChildTaskChip
                                key={c.id}
                                child={c}
                                onRetry={handleRetryChild}
                                onPreview={(imgs, idx) => {
                                  setPreviewImages(imgs);
                                  setPreviewIndex(idx);
                                }}
                              />
                            ))}
```

- [ ] **Step 3: 渲染 `ImagePreviewModal`**

在 `TaskDetailsDrawer` 渲染块(第 789–800 行)之后、组件根 `</div>`(第 802 行)之前,新增:

```tsx
      {/* 5. [2026-07-21] 子任务缩略图放大预览 */}
      {previewImages && (
        <ImagePreviewModal
          images={previewImages}
          initialIndex={previewIndex}
          onClose={() => setPreviewImages(null)}
        />
      )}
```

- [ ] **Step 4: 类型检查通过**

Run: `npm run lint`(`EC-AIGC/` 目录)
Expected: PASS(无类型错误)。

- [ ] **Step 5: 手动验证**

Run: `npm run dev`,浏览器打开任务列表 → 展开一个含 SUCCESS 子任务的父任务。逐项验证:

1. 单图子任务:点缩略图弹层打开,无左右箭头、无底部缩略图条,计数显示 `1 / 1`。
2. 多图子任务:显示左右箭头、底部缩略图条、计数 `n / N`;点箭头/缩略图/按 `←``→` 切换正确,当前缩略图高亮。
3. 关闭:点遮罩、点右上 ✕、按 `ESC` 均能关闭。
4. 非 SUCCESS / 无图子任务:缩略图为占位图标,不可点击、无 `cursor-zoom-in`。
5. 大图超大时不撑破屏幕(`object-contain` 生效,受 `90vw/85vh` 约束)。
6. 图加载失败:大图区显示 `broken_image` 占位。

---

## Self-Review

**1. Spec coverage:**
- 简洁预览弹层、复用现有 overlay 样式 → Task 1 ✓
- 多图左右切换 + 底部缩略图条 + 计数 → Task 1 ✓
- ESC / ←→ / 遮罩 / ✕ 关闭 → Task 1 ✓
- 单图隐藏箭头与缩略图条 → Task 1 ✓
- 大图 `max-w-[90vw] max-h-[85vh] object-contain` → Task 1 ✓
- 原图 URL(不加缩略参数)→ Task 2 Step 3 ✓
- 只有 SUCCESS 且有图可点击 + `cursor-zoom-in` → Task 2 Step 4 ✓
- 弹层状态提到 TaskList 顶层 → Task 3 ✓
- 加载失败/空占位 → Task 1(onError → broken_image)✓
- 键盘监听在卸载/关闭时移除 → Task 1(useEffect cleanup)✓

**2. Placeholder scan:** 无 TBD/TODO;每个改动步骤都给了完整代码。✓

**3. Type consistency:** `PreviewImage`/`ImagePreviewModalProps` 在 Task 1 定义,Task 2/3 一致引用;`onPreview: (images: PreviewImage[], index: number) => void` 签名在 Task 2 定义、Task 3 调用一致。✓

**偏差记录:** spec 提到 lucide `ChevronLeft/ChevronRight`,但 `TaskList.tsx` 全程用 `material-symbols-outlined`,为保持一致性改用 `chevron_left`/`chevron_right`/`close`/`broken_image`,不引入 lucide。
