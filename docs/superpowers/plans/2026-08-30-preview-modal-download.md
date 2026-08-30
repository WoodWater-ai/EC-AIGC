# 预览弹层:下载当前资源 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `ImagePreviewModal` / `VideoPreviewModal` 右上角加下载按钮,点击后下载当前显示的图/视频,文件名优先用调用方传入值,否则从 URL 路径推导,最后兜底 `preview-N.<ext>`;CORS 失败时 fallback 到新标签页打开。

**Architecture:** 两个组件文件对称实现,各自新增模块级 `resolveFilename` helper(避免跨文件依赖)、一个 `isDownloading` 状态、一个 `handleDownloadCurrent` handler,以及顶部右上角的下载按钮。复用 `src/utils/downloadFile.ts` 已有的 `triggerBrowserDownload` + `fetchAsBlob`,沿用 AssistantPage 的 fetch+blob+新标签页降级模式。

**Tech Stack:** React 19 + Vite 6 + TypeScript 5.8 + Tailwind 4;`node:test`(通过 `tsx --test`)做单元测试;**无新 npm 包、无新文件、无新测试**(DOM 依赖沿用项目既定模式跳过)。

## Global Constraints

- **不自动 `git` 操作**(用户明确指示 commit / push 由人工执行);本计划中的 `git commit` 由人工或 IDE 完成
- **类型检查**:`cd EC-AIGC && npm run lint`(是 `tsc --noEmit`,无 ESLint)
- **测试运行**:`cd EC-AIGC && npm test`(脚本是 `tsx --test "src/**/*.test.ts" "src/**/*.test.tsx"`)
- **不新增 npm 依赖**;不修改 `package.json`
- **样式** Tailwind 4 CSS-first(`@theme`),不创建 `tailwind.config.js`
- **DOM 依赖代码的测试**:沿用 `EC-AIGC/src/utils/mergeImages.test.ts` / `EC-AIGC/src/utils/downloadFile.test.ts` 既定模式(签名校验,不写 DOM 行为测试)
- **按钮视觉**:与各文件现有关闭按钮一致(8px 圆 + 半透白底 + shadow + 灰图标 + Material Symbols `download`),唯一差异是 `-right-2` → `right-10`
- **CORS 失败降级**:`fetchAsBlob` 抛错时调 `triggerBrowserDownload(url, filename, true)`,浏览器新标签页打开
- **`URL.revokeObjectURL` 延迟 1s**,避免部分浏览器下载未启动就 revoke(对齐 AssistantPage / `downloadAssets.ts` 既有模式)

## File Structure

| 文件 | 角色 |
|---|---|
| `src/components/ImagePreviewModal.tsx` | 图片预览弹层;新增 `filename?` 字段、模块级 `resolveFilename`、下载按钮、`handleDownloadCurrent` |
| `src/components/VideoPreviewModal.tsx` | 视频预览弹层;同上,扩展名改为 `mp4` |

两个文件互不依赖,各自维护自己的 `resolveFilename`(避免跨文件 helper 增加耦合)。两者复用 `src/utils/downloadFile.ts`(已存在,无需修改)。

---

### Task 1: `ImagePreviewModal.tsx` 新增下载当前图片

**Files:**
- Modify: `EC-AIGC/src/components/ImagePreviewModal.tsx`(接口 + 模块级 helper + state + handler + 按钮 JSX)

**Interfaces:**
- Consumes: `triggerBrowserDownload`, `fetchAsBlob` from `../utils/downloadFile`(已存在,无需修改)
- Produces:
  ```ts
  // 在文件内新增模块级函数(非 export)
  function resolveFilename(
    item: { url: string; filename?: string },
    index: number,
    ext: 'jpg',
  ): string;

  // 接口扩展
  export interface PreviewImage {
    url: string;
    label?: string;
    filename?: string;  // 新增
  }
  ```

- [ ] **Step 1: 接口扩展 `PreviewImage`**

在 `src/components/ImagePreviewModal.tsx` 第 3-8 行的 `PreviewImage` 接口中,`label?: string;` 之后新增:

```ts
/** 调用方显式指定的下载文件名(含扩展名) */
filename?: string;
```

完整接口形如:

```ts
export interface PreviewImage {
  url: string;
  label?: string;
  filename?: string;
}
```

- [ ] **Step 2: 顶部 import 加入 `downloadFile` 工具**

在文件第 1 行(`import React, { useCallback, useEffect, useState } from 'react';`)之后,新增:

```ts
import { fetchAsBlob, triggerBrowserDownload } from '../utils/downloadFile';
```

- [ ] **Step 3: 新增模块级 `resolveFilename` helper**

在 `PreviewImage` 接口定义之后、组件定义之前(约第 10 行后),新增:

```ts
function resolveFilename(
  item: { url: string; filename?: string },
  index: number,
  ext: 'jpg',
): string {
  if (item.filename) return item.filename;
  try {
    const last = new URL(item.url).pathname.split('/').pop();
    if (last) return last;
  } catch {
    /* fallthrough */
  }
  return `preview-${index + 1}.${ext}`;
}
```

- [ ] **Step 4: 新增 state + handler**

在 `ImagePreviewModal` 组件函数体内(约第 27 行 `safeInitial` 计算之后,`useState(safeInitial)` 附近),新增:

```ts
const [isDownloading, setIsDownloading] = useState(false);

const handleDownloadCurrent = useCallback(async () => {
  if (!current) return;
  const filename = resolveFilename(current, index, 'jpg');
  setIsDownloading(true);
  try {
    try {
      const blob = await fetchAsBlob(current.url);
      const blobUrl = URL.createObjectURL(blob);
      try {
        triggerBrowserDownload(blobUrl, filename);
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      }
    } catch {
      // CORS / 网络失败 → 新标签页打开作为降级(对齐 AssistantPage)
      triggerBrowserDownload(current.url, filename, true);
    }
  } finally {
    setIsDownloading(false);
  }
}, [current, index]);
```

> 关键依赖:`current` 与 `index` 是组件中已有的局部变量(第 31-32 行 `const total = images.length; const current = images[index];`),`useCallback` 的依赖列表覆盖了它们。

- [ ] **Step 5: 在关闭按钮左边插入下载按钮**

现有关闭按钮(约第 67-73 行):

```tsx
<button
  onClick={onClose}
  className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
  aria-label="关闭"
>
  <span className="material-symbols-outlined text-lg">close</span>
</button>
```

在它**之前**(保持关闭按钮是最后一个绝对定位元素),插入:

```tsx
<button
  onClick={() => void handleDownloadCurrent()}
  disabled={isDownloading || !current}
  className="absolute -top-2 right-10 z-10 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-slate-500 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
  aria-label="下载"
  title="下载当前图片"
>
  <span className="material-symbols-outlined text-lg">download</span>
</button>
```

- [ ] **Step 6: 类型检查**

Run: `cd EC-AIGC && npm run lint`
Expected: 无错误。

- [ ] **Step 7: 跑全部测试(确保未引入回归)**

Run: `cd EC-AIGC && npm test`
Expected: 167/167 通过(无新增测试,本任务未触及任何 *.test.ts 文件)。

- [ ] **Step 8: 手动冒烟(开发模式)**

| 操作 | 预期 |
|---|---|
| 打开任意图片预览(资源中心点缩略图 / 创作助手点预览) | 右上角出现下载按钮(关闭按钮左边) |
| 单图预览:点下载 | 浏览器保存当前图片,文件名取 URL 路径最后一段 |
| 多图预览:←/→ 切换到第 3 张 → 点下载 | 拿到第 3 张 |
| `filename` 显式传入 | 文件名使用传入值 |
| 关闭按钮 / ESC / ← / → | 行为完全不变 |

- [ ] **Step 9: Commit(由人工或 IDE 执行)**

```bash
git add EC-AIGC/src/components/ImagePreviewModal.tsx
git commit -m "feat(preview): add download button to ImagePreviewModal"
```

---

### Task 2: `VideoPreviewModal.tsx` 新增下载当前视频

**Files:**
- Modify: `EC-AIGC/src/components/VideoPreviewModal.tsx`(接口 + 模块级 helper + state + handler + 按钮 JSX)

**Interfaces:**
- Consumes: `triggerBrowserDownload`, `fetchAsBlob` from `../utils/downloadFile`(已存在,无需修改)
- Produces: 与 Task 1 对称,扩展名改为 `'mp4'`

- [ ] **Step 1: 接口扩展 `PreviewVideo`**

在 `src/components/VideoPreviewModal.tsx` 第 3-10 行的 `PreviewVideo` 接口中,`label?: string;` 之后新增:

```ts
/** 调用方显式指定的下载文件名(含扩展名) */
filename?: string;
```

完整接口形如:

```ts
export interface PreviewVideo {
  url: string;
  poster?: string | null;
  label?: string;
  filename?: string;
}
```

- [ ] **Step 2: 顶部 import 加入 `downloadFile` 工具**

在文件第 1 行(`import React, { useCallback, useEffect, useState } from 'react';`)之后,新增:

```ts
import { fetchAsBlob, triggerBrowserDownload } from '../utils/downloadFile';
```

- [ ] **Step 3: 新增模块级 `resolveFilename` helper**

在 `PreviewVideo` 接口定义之后、组件定义之前(约第 12 行后),新增:

```ts
function resolveFilename(
  item: { url: string; filename?: string },
  index: number,
  ext: 'mp4',
): string {
  if (item.filename) return item.filename;
  try {
    const last = new URL(item.url).pathname.split('/').pop();
    if (last) return last;
  } catch {
    /* fallthrough */
  }
  return `preview-${index + 1}.${ext}`;
}
```

- [ ] **Step 4: 新增 state + handler**

在 `VideoPreviewModal` 组件函数体内(约第 31 行 `safeInitial` 计算之后),新增:

```ts
const [isDownloading, setIsDownloading] = useState(false);

const handleDownloadCurrent = useCallback(async () => {
  if (!current) return;
  const filename = resolveFilename(current, index, 'mp4');
  setIsDownloading(true);
  try {
    try {
      const blob = await fetchAsBlob(current.url);
      const blobUrl = URL.createObjectURL(blob);
      try {
        triggerBrowserDownload(blobUrl, filename);
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      }
    } catch {
      // CORS / 网络失败 → 新标签页打开作为降级(对齐 AssistantPage)
      triggerBrowserDownload(current.url, filename, true);
    }
  } finally {
    setIsDownloading(false);
  }
}, [current, index]);
```

- [ ] **Step 5: 在关闭按钮左边插入下载按钮**

现有关闭按钮(约第 67-73 行):

```tsx
<button
  onClick={onClose}
  className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
  aria-label="关闭"
>
  <span className="material-symbols-outlined text-lg">close</span>
</button>
```

在它**之前**,插入:

```tsx
<button
  onClick={() => void handleDownloadCurrent()}
  disabled={isDownloading || !current}
  className="absolute -top-2 right-10 z-10 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-slate-500 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
  aria-label="下载"
  title="下载当前视频"
>
  <span className="material-symbols-outlined text-lg">download</span>
</button>
```

- [ ] **Step 6: 类型检查**

Run: `cd EC-AIGC && npm run lint`
Expected: 无错误。

- [ ] **Step 7: 跑全部测试**

Run: `cd EC-AIGC && npm test`
Expected: 167/167 通过(本任务未触及任何 *.test.ts 文件)。

- [ ] **Step 8: 手动冒烟(开发模式)**

| 操作 | 预期 |
|---|---|
| 打开任意视频预览 | 右上角出现下载按钮 |
| 单视频:点下载 | 浏览器保存当前视频 |
| 多视频:←/→ 切换 → 点下载 | 拿到对应那个视频 |
| `filename` 显式传入 | 文件名使用传入值 |
| 关闭按钮 / ESC / ← / → | 行为完全不变 |

- [ ] **Step 9: Commit(由人工或 IDE 执行)**

```bash
git add EC-AIGC/src/components/VideoPreviewModal.tsx
git commit -m "feat(preview): add download button to VideoPreviewModal"
```

---

## Self-Review Notes

**Spec coverage:**

| Spec § | 任务 |
|---|---|
| §4.1 改动范围 | Task 1 + Task 2 |
| §4.2 接口扩展 | Task 1 Step 1; Task 2 Step 1 |
| §4.3 `resolveFilename` helper | Task 1 Step 3; Task 2 Step 3 |
| §4.4 UI 位置与样式 | Task 1 Step 5; Task 2 Step 5 |
| §4.5 下载 handler | Task 1 Step 4; Task 2 Step 4 |
| §4.6 状态与生命周期 | Task 1 Step 4; Task 2 Step 4(`useState` + `useCallback`) |
| §5 错误处理与边界 | 通过 `every`、`fetchAsBlob` 的 try/catch、`isDownloading` 状态、`disabled` 全面覆盖 |
| §6 手工冒烟 | Task 1 Step 8; Task 2 Step 8 |
| §7 后续扩展 | 不实现,符合 spec |

**Placeholder scan:** 无 TBD / TODO / "implement later" / "similar to Task N"。

**Type consistency:**
- `PreviewImage.filename?: string` 在 Task 1 定义;Task 1 内部消费。`PreviewVideo.filename?: string` 在 Task 2 定义;Task 2 内部消费。互不引用。
- `resolveFilename(item, index, ext)` 签名两个文件完全一致,仅 `ext` 字面量不同(`'jpg'` vs `'mp4'`)。
- `handleDownloadCurrent` 依赖列表 `[current, index]` 相同。
- `downloadFile.ts` 中的 `triggerBrowserDownload(url, fileName, openInNewTab?)` / `fetchAsBlob(url)` 在两个 Task 中调用方式一致。

无遗留。