# 资源中心:批量下载选中素材 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在资源中心 (`AssetTransitModal`) 的 footer 增加"下载"按钮,选中素材后点击依次保存原图/原视频到本地;同时把 `AssistantPage` 内联的下载封装抽取为共享工具,消除重复。

**Architecture:**
- 新增 `src/utils/downloadFile.ts` —— 共享下载原语(`triggerBrowserDownload` / `fetchAsBlob` / `inferExtensionFromMime`),从 `AssistantPage` 抽取
- 新增 `src/utils/downloadAssets.ts` —— 顺序批量下载协调器,内含失败汇总 + 项间延迟
- 修改 `src/components/AssetTransitModal.tsx` —— 新增 `canDownloadSelected` 派生值 + 下载按钮 + 状态/进度
- 重构 `src/components/Assistant/AssistantPage.tsx` —— 移除内联 `triggerBrowserDownload` / `downloadOriginalResult`,改从共享工具导入

**Tech Stack:** React 19 + Vite 6 + TypeScript 5.8 + Tailwind 4;`node:test`(通过 `tsx --test`)做单元测试;**无新 npm 包**。

## Global Constraints

- **路径全部用 POSIX 风格**(Windows 下 `EC-AIGC/` 仓库用 Git Bash,`tsx` 等工具路径以 `/` 传)
- **测试运行**:`cd EC-AIGC && npm test`(脚本是 `tsx --test "src/**/*.test.ts" "src/**/*.test.tsx"`)
- **类型检查**:`cd EC-AIGC && npm run lint`(是 `tsc --noEmit`,无 ESLint)
- **禁止自动 `git` / `mvn` 命令**(工作区 `CLAUDE.md` 第 1 条);本计划中的 `git commit` 由人工或 IDE 完成
- **不新增 npm 依赖**;不修改 `package.json`
- **样式** Tailwind 4 CSS-first(`@theme`),不创建 `tailwind.config.js`
- **按钮 UI** 严格对齐 `AssetTransitModal.tsx` 已有的合并 / 关联产品 / 设为封面 按钮视觉(蓝色文字 + 下划线 + Material Symbols 前缀)
- **下载文件名** 保留 `asset.name` 原值,浏览器自动去重
- **失败处理** 单项失败不中断整批,统一收集到 `failed[]` 由调用方 toast 反馈

---

## File Structure

| 文件 | 角色 |
|---|---|
| `src/utils/downloadFile.ts` | 共享下载原语:inferExtensionFromMime / triggerBrowserDownload / fetchAsBlob |
| `src/utils/downloadFile.test.ts` | downloadFile 单元测试 |
| `src/utils/downloadAssets.ts` | 顺序批量下载:downloadAssetsSequentially + 类型 |
| `src/utils/downloadAssets.test.ts` | downloadAssets 单元测试 |
| `src/components/AssetTransitModal.tsx` | 资源中心弹框;新增下载按钮 + 状态 + handler |
| `src/components/Assistant/AssistantPage.tsx` | 创作助手;改用共享 downloadFile,移除内联副本 |

`downloadAssets.ts` 只依赖 `downloadFile.ts`(`fetchAsBlob` + `triggerBrowserDownload`)。
`AssetTransitModal.tsx` 依赖 `downloadAssets.ts`。
`AssistantPage.tsx` 依赖 `downloadFile.ts`(从 `downloadAssets.ts` **不**消费)。

---

### Task 1: 抽取共享下载工具 `src/utils/downloadFile.ts`

**Files:**
- Create: `EC-AIGC/src/utils/downloadFile.ts`
- Create: `EC-AIGC/src/utils/downloadFile.test.ts`

**Interfaces:**
- Consumes: 标准 Web API(`fetch` / `URL` / `document` / `Blob`)
- Produces:
  ```ts
  export function inferExtensionFromMime(mime: string, fallback?: string): string;
  export function triggerBrowserDownload(url: string, fileName: string, openInNewTab?: boolean): void;
  export async function fetchAsBlob(url: string): Promise<Blob>;
  ```

**参考实现**:`Assistant/AssistantPage.tsx` 第 185-235 行的 `downloadFileName` 内部 `mimeExtensions` 映射、`triggerBrowserDownload` 函数体、`downloadOriginalResult` 中的 `fetch → response.ok 检查 → blob` 模式。

- [ ] **Step 1: 写失败的测试 `src/utils/downloadFile.test.ts`**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  inferExtensionFromMime,
  triggerBrowserDownload,
  fetchAsBlob,
} from './downloadFile';

test('inferExtensionFromMime: image/jpeg -> jpg', () => {
  assert.equal(inferExtensionFromMime('image/jpeg'), 'jpg');
});

test('inferExtensionFromMime: video/mp4 -> mp4', () => {
  assert.equal(inferExtensionFromMime('video/mp4'), 'mp4');
});

test('inferExtensionFromMime: 未知 mime 返回 fallback', () => {
  assert.equal(inferExtensionFromMime('application/octet-stream', 'bin'), 'bin');
  assert.equal(inferExtensionFromMime('application/octet-stream', undefined), 'unknown');
});

test('triggerBrowserDownload: 创建 a 元素并触发 click', () => {
  const created: HTMLAnchorElement[] = [];
  const realCreate = document.createElement.bind(document);
  document.createElement = ((tag: string) => {
    const el = realCreate(tag);
    if (tag === 'a') {
      created.push(el as HTMLAnchorElement);
      const origClick = el.click.bind(el);
      (el as HTMLAnchorElement).click = () => {
        (el as HTMLAnchorElement & { _clicked: boolean })._clicked = true;
        origClick();
      };
    }
    return el;
  }) as typeof document.createElement;
  try {
    triggerBrowserDownload('blob:abc', 'test.png');
    assert.equal(created.length, 1);
    const a = created[0];
    assert.equal(a.href, 'blob:abc');
    assert.equal(a.download, 'test.png');
    assert.equal((a as HTMLAnchorElement & { _clicked?: boolean })._clicked, true);
    // appendChild + remove 都跑过
    assert.ok(a.parentNode === null || a.isConnected === false);
  } finally {
    document.createElement = realCreate;
  }
});

test('triggerBrowserDownload: openInNewTab=true 时设置 target=_blank', () => {
  const realCreate = document.createElement.bind(document);
  let captured: HTMLAnchorElement | null = null;
  document.createElement = ((tag: string) => {
    const el = realCreate(tag);
    if (tag === 'a' && !captured) captured = el as HTMLAnchorElement;
    return el;
  }) as typeof document.createElement;
  try {
    triggerBrowserDownload('https://example.com/x.jpg', 'x.jpg', true);
    assert.equal(captured!.target, '_blank');
    assert.equal(captured!.rel, 'noreferrer');
  } finally {
    document.createElement = realCreate;
  }
});

test('fetchAsBlob: 网络成功返回 Blob', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(new Blob(['hello'], { type: 'text/plain' }), {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })) as typeof fetch;
  try {
    const blob = await fetchAsBlob('https://example.com/test');
    assert.equal(blob.type, 'text/plain');
    assert.equal(blob.size, 5);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchAsBlob: HTTP 404 抛错', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response('not found', { status: 404, statusText: 'Not Found' })) as typeof fetch;
  try {
    await assert.rejects(
      () => fetchAsBlob('https://example.com/missing'),
      /HTTP 404/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd EC-AIGC && npm test -- src/utils/downloadFile.test.ts`
Expected: FAIL —— `./downloadFile` 模块不存在。

- [ ] **Step 3: 创建 `src/utils/downloadFile.ts`**

```ts
/** mime → 常用文件扩展名(无点号) */
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

/**
 * 从 mime 推断文件扩展名(无点号)。
 * 命中 MIME_EXTENSIONS 返回小写扩展名;否则返回 fallback,fallback 缺省时返回 'unknown'。
 */
export function inferExtensionFromMime(mime: string, fallback?: string): string {
  return MIME_EXTENSIONS[mime] ?? fallback ?? 'unknown';
}

/**
 * 触发浏览器保存。url 可以是 blob URL 或普通 URL。
 * openInNewTab=true 时退化为新标签页打开(用于 fetch 失败后的降级)。
 */
export function triggerBrowserDownload(
  url: string,
  fileName: string,
  openInNewTab = false,
): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  if (openInNewTab) {
    link.target = '_blank';
    link.rel = 'noreferrer';
  }
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * GET URL → Blob。响应非 2xx 抛错(含状态码)。
 * 不处理超时/重试,留给调用方。
 */
export async function fetchAsBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.blob();
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd EC-AIGC && npm test -- src/utils/downloadFile.test.ts`
Expected: 7 passed.

- [ ] **Step 5: 类型检查**

Run: `cd EC-AIGC && npm run lint`
Expected: 无错误(`downloadFile.ts` 本身无 React 依赖)。

- [ ] **Step 6: Commit(由人工或 IDE 执行)**

```bash
git add EC-AIGC/src/utils/downloadFile.ts EC-AIGC/src/utils/downloadFile.test.ts
git commit -m "feat(utils): extract downloadFile utilities from AssistantPage"
```

---

### Task 2: 重构 `AssistantPage.tsx` 使用共享 downloadFile

**Files:**
- Modify: `EC-AIGC/src/components/Assistant/AssistantPage.tsx`(删除第 185-235 行的内联 `downloadFileName` 中的 `mimeExtensions` 表与 `triggerBrowserDownload` / `downloadOriginalResult`;改从 `./utils/downloadFile` 导入)

**Interfaces:**
- Consumes: `triggerBrowserDownload`、`fetchAsBlob`、`inferExtensionFromMime` from `./utils/downloadFile`
- Produces: 现有 `AssistantPage` 行为不变;`handleDownload` / `downloadOriginalResult` / `downloadFileName` 仍在该文件,但内部调用共享工具

- [ ] **Step 1: 在 `AssistantPage.tsx` 顶部加入 import**

在文件最顶端(其他 `import` 之后)添加:

```ts
import { triggerBrowserDownload, fetchAsBlob, inferExtensionFromMime } from '../../utils/downloadFile';
```

- [ ] **Step 2: 重写 `downloadFileName`,复用共享的扩展名推断**

把第 185-206 行的 `downloadFileName` 替换为:

```ts
const downloadFileName = (result: AssistantGenerationResult, mimeType?: string) => {
  const pathExtension = (() => {
    try {
      return new URL(result.url).pathname.match(/\.([a-zA-Z0-9]{2,5})$/)?.[1]?.toLowerCase();
    } catch {
      return undefined;
    }
  })();
  const extension = (mimeType && inferExtensionFromMime(mimeType, undefined) !== 'unknown'
    ? inferExtensionFromMime(mimeType)
    : undefined) ?? pathExtension ?? (result.resultKind === 'IMAGE' ? 'png' : 'mp4');
  return `创作助手-${result.resultKind === 'IMAGE' ? '原图' : '视频'}-${result.id}.${extension}`;
};
```

> 关键点:`inferExtensionFromMime` 返回 `unknown` 时降级回 URL path 推断,再回退到 `png`/`mp4`。等价于原实现的优先级。

- [ ] **Step 3: 重写 `downloadOriginalResult`,删除内联 `triggerBrowserDownload`**

把第 208-236 行(`triggerBrowserDownload` + `downloadOriginalResult`)整段替换为:

```ts
const downloadOriginalResult = async (result: AssistantGenerationResult) => {
  try {
    const blob = await fetchAsBlob(result.url);
    const blobUrl = URL.createObjectURL(blob);
    try {
      triggerBrowserDownload(blobUrl, downloadFileName(result, blob.type));
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    }
  } catch {
    // COS 未开放跨域读取时,退回浏览器原始地址下载;始终使用 result.url,不使用封面或缩略图。
    triggerBrowserDownload(result.url, downloadFileName(result), true);
  }
};
```

- [ ] **Step 4: 类型检查**

Run: `cd EC-AIGC && npm run lint`
Expected: 无错误。

- [ ] **Step 5: 运行所有测试**

Run: `cd EC-AIGC && npm test`
Expected: 全部通过(包括 `downloadFile.test.ts` 与项目现有测试)。

- [ ] **Step 6: 手动回归冒烟(开发模式)**

打开创作助手,生成一张图片 → 点"下载原图" → 浏览器弹出保存对话框,文件名形如 `创作助手-原图-xxx.png`,文件可正常打开。

- [ ] **Step 7: Commit**

```bash
git add EC-AIGC/src/components/Assistant/AssistantPage.tsx
git commit -m "refactor(Assistant): use shared downloadFile utilities"
```

---

### Task 3: 新增 `src/utils/downloadAssets.ts` 顺序批量下载

**Files:**
- Create: `EC-AIGC/src/utils/downloadAssets.ts`
- Create: `EC-AIGC/src/utils/downloadAssets.test.ts`

**Interfaces:**
- Consumes: `fetchAsBlob` + `triggerBrowserDownload` from `./downloadFile`
- Produces:
  ```ts
  export interface DownloadFailure { id: string; name: string; reason: string; }
  export interface DownloadBatchResult { success: number; failed: DownloadFailure[]; }
  export interface DownloadBatchOptions {
    delayMs?: number;
    onItemComplete?: (idx: number) => void;
  }
  export async function downloadAssetsSequentially(
    items: Array<{ id: string; name: string; originalUrl?: string }>,
    opts?: DownloadBatchOptions,
  ): Promise<DownloadBatchResult>;
  ```

- [ ] **Step 1: 写失败的测试 `src/utils/downloadAssets.test.ts`**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { downloadAssetsSequentially } from './downloadAssets';

const sample = [
  { id: '1', name: 'a.jpg', originalUrl: 'https://x.test/a.jpg' },
  { id: '2', name: 'b.jpg', originalUrl: 'https://x.test/b.jpg' },
];

test('全成功:success 等于项数,failed 为空', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(new Blob(['x'], { type: 'image/jpeg' }), { status: 200 })) as typeof fetch;
  try {
    const result = await downloadAssetsSequentially(sample, { delayMs: 0 });
    assert.equal(result.success, 2);
    assert.deepEqual(result.failed, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('缺 originalUrl 记 failed(原因=缺少原图地址),批处理继续', async () => {
  const items = [
    { id: '1', name: 'no-url.jpg' },
    { id: '2', name: 'has.jpg', originalUrl: 'https://x.test/has.jpg' },
  ];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(new Blob(['x'], { type: 'image/jpeg' }), { status: 200 })) as typeof fetch;
  try {
    const result = await downloadAssetsSequentially(items, { delayMs: 0 });
    assert.equal(result.success, 1);
    assert.equal(result.failed.length, 1);
    assert.equal(result.failed[0].id, '1');
    assert.equal(result.failed[0].name, 'no-url.jpg');
    assert.equal(result.failed[0].reason, '缺少原图地址');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetch 失败记 failed(原因=err.message),批处理继续', async () => {
  const items = [
    { id: '1', name: 'a.jpg', originalUrl: 'https://x.test/a.jpg' },
    { id: '2', name: 'b.jpg', originalUrl: 'https://x.test/b.jpg' },
  ];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('a.jpg')) throw new Error('HTTP 500');
    return new Response(new Blob(['x']), { status: 200 });
  }) as typeof fetch;
  try {
    const result = await downloadAssetsSequentially(items, { delayMs: 0 });
    assert.equal(result.success, 1);
    assert.equal(result.failed.length, 1);
    assert.equal(result.failed[0].id, '1');
    assert.match(result.failed[0].reason, /HTTP 500/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('onItemComplete 按 idx 升序回调', async () => {
  const calls: number[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(new Blob(['x']), { status: 200 })) as typeof fetch;
  try {
    await downloadAssetsSequentially(sample, {
      delayMs: 0,
      onItemComplete: (idx) => calls.push(idx),
    });
    assert.deepEqual(calls, [0, 1]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('全失败仍返回干净 result,不抛错', async () => {
  const items = [
    { id: '1', name: 'a.jpg' },
    { id: '2', name: 'b.jpg', originalUrl: 'https://x.test/b.jpg' },
  ];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error('boom'); }) as typeof fetch;
  try {
    const result = await downloadAssetsSequentially(items, { delayMs: 0 });
    assert.equal(result.success, 0);
    assert.equal(result.failed.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd EC-AIGC && npm test -- src/utils/downloadAssets.test.ts`
Expected: FAIL —— `./downloadAssets` 模块不存在。

- [ ] **Step 3: 创建 `src/utils/downloadAssets.ts`**

```ts
import { fetchAsBlob, triggerBrowserDownload } from './downloadFile';

export interface DownloadFailure {
  id: string;
  name: string;
  reason: string;
}

export interface DownloadBatchResult {
  success: number;
  failed: DownloadFailure[];
}

export interface DownloadBatchOptions {
  /** 项间延迟毫秒,默认 200(规避 Chrome 多下载限速) */
  delayMs?: number;
  /** 每项完成回调(无论成功失败) */
  onItemComplete?: (idx: number) => void;
}

const wait = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms);
});

/**
 * 顺序下载一批资源。失败项不影响后续项。
 * - 缺 originalUrl:failed,reason='缺少原图地址'
 * - fetchAsBlob 抛错:failed,reason=err.message
 * - 全程不抛错
 */
export async function downloadAssetsSequentially(
  items: Array<{ id: string; name: string; originalUrl?: string }>,
  opts?: DownloadBatchOptions,
): Promise<DownloadBatchResult> {
  const delayMs = opts?.delayMs ?? 200;
  const result: DownloadBatchResult = { success: 0, failed: [] };
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    if (!item.originalUrl) {
      result.failed.push({ id: item.id, name: item.name, reason: '缺少原图地址' });
    } else {
      try {
        const blob = await fetchAsBlob(item.originalUrl);
        const blobUrl = URL.createObjectURL(blob);
        try {
          triggerBrowserDownload(blobUrl, item.name);
        } finally {
          // 延迟 revoke,避免部分浏览器下载未启动
          window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        }
        result.success += 1;
      } catch (err) {
        result.failed.push({
          id: item.id,
          name: item.name,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }
    opts?.onItemComplete?.(idx);
    if (idx < items.length - 1 && delayMs > 0) {
      await wait(delayMs);
    }
  }
  return result;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd EC-AIGC && npm test -- src/utils/downloadAssets.test.ts`
Expected: 5 passed.

- [ ] **Step 5: 类型检查**

Run: `cd EC-AIGC && npm run lint`
Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
git add EC-AIGC/src/utils/downloadAssets.ts EC-AIGC/src/utils/downloadAssets.test.ts
git commit -m "feat(utils): add downloadAssetsSequentially batch helper"
```

---

### Task 4: 在 `AssetTransitModal.tsx` 中接入下载按钮

**Files:**
- Modify: `EC-AIGC/src/components/AssetTransitModal.tsx`(约 2286-2415 行 footer 区)

**Interfaces:**
- Consumes: `downloadAssetsSequentially` + `DownloadBatchResult` from `../utils/downloadAssets`;`toast` from `sonner`(已在文件内导入)
- Produces(组件内新增):
  ```ts
  const canDownloadSelected = /* 见下方 */;
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number }>(
    { current: 0, total: 0 },
  );
  const handleDownloadSelected = async () => { /* 见下方 */ };
  ```

- [ ] **Step 1: 顶部 import 加入 `downloadAssetsSequentially`**

`AssetTransitModal.tsx` 第 1-28 行的 import 区,新增:

```ts
import { downloadAssetsSequentially } from '../utils/downloadAssets';
```

- [ ] **Step 2: 新增派生值 `canDownloadSelected`**

紧接现有的 `canDeleteSelected`(第 638-645 行附近)之后,新增:

```ts
const canDownloadSelected =
  selectedAssetIds.length > 0
  && selectedItems.length === selectedAssetIds.length
  && selectedItems.every((item) =>
    String(item.uploadUserId) === currentUserId && Boolean(item.originalUrl),
  );
```

> 与 `canDeleteSelected` 同模式但去掉了 `!asset.productId`(下载允许本人已关联产品的资源)。`selectedItems` 已在该文件第 646-648 行定义。

- [ ] **Step 3: 新增状态与 handler(放在 `handleClearSelection` 附近,第 711-717 行附近)**

```ts
const [isDownloading, setIsDownloading] = useState(false);
const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number }>(
  { current: 0, total: 0 },
);

const handleDownloadSelected = async () => {
  if (!canDownloadSelected || isDownloading) return;
  const snapshot = selectedItems; // 防并发选择变化
  setIsDownloading(true);
  setDownloadProgress({ current: 0, total: snapshot.length });
  try {
    const result = await downloadAssetsSequentially(snapshot, {
      onItemComplete: (idx) => setDownloadProgress({ current: idx + 1, total: snapshot.length }),
    });
    if (result.failed.length === 0) {
      toast.success(`${result.success} 个资源已开始下载`);
    } else {
      toast.warning(`${result.success} 个已下载,${result.failed.length} 个失败`);
    }
  } finally {
    setIsDownloading(false);
  }
};
```

- [ ] **Step 4: 在 footer 关联产品按钮之后插入下载按钮**

`AssetTransitModal.tsx` 第 2366-2374 行,**关联产品** 按钮之后、`</>` 闭合之前(在 `{currentSelectionCount > 0 && (...)}` 块内),插入:

```tsx
{canDownloadSelected && (
  <button
    type="button"
    onClick={() => void handleDownloadSelected()}
    disabled={isDownloading}
    className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
  >
    <span className="material-symbols-outlined text-sm">download</span>
    {isDownloading
      ? `下载中 ${downloadProgress.current}/${downloadProgress.total}`
      : '下载'}
  </button>
)}
```

> 与合并 / 关联产品 视觉一致(蓝色文字 + 下划线 + Material Symbols 前缀)。

- [ ] **Step 5: 类型检查**

Run: `cd EC-AIGC && npm run lint`
Expected: 无错误。

- [ ] **Step 6: 跑全部测试**

Run: `cd EC-AIGC && npm test`
Expected: 全部通过。

- [ ] **Step 7: 手动冒烟**

| 操作 | 预期 |
|---|---|
| 通用素材 tab,选 2 张本人图片 → 点"下载" | 浏览器依次保存 2 个文件,toast "2 个资源已开始下载";按钮文字变化为 `下载中 1/2` → `下载中 2/2` → 恢复"下载" |
| 通用素材 tab,选 1 张本人 + 1 张他人 | 按钮不出现 |
| 通用素材 tab,选 1 个本人视频 → 点"下载" | 保存 1 个视频文件 |
| 产品素材 已聚焦 SKU,选本人上传素材 → 点"下载" | 保存对应文件 |
| 模特素材 tab,选中任意素材 | 按钮不出现(本人校验不通过) |
| 断网时点"下载" | toast 显示 "0 个已下载,N 个失败" |

- [ ] **Step 8: Commit**

```bash
git add EC-AIGC/src/components/AssetTransitModal.tsx
git commit -m "feat(ResourceCenter): add batch download for selected assets"
```

---

## Self-Review Notes

**Spec coverage check:**

| Spec § | 任务 |
|---|---|
| §4.1 改动范围 | Task 1-4 完整覆盖(含 AssistantPage 重构) |
| §4.2 下载机制 | Task 1 (`fetchAsBlob` + `triggerBrowserDownload`) |
| §4.3 UI 位置与样式 | Task 4 Step 4 |
| §4.4 触发条件 | Task 4 Step 2 |
| §4.5 新增模块 API | Task 1 (downloadFile)、Task 3 (downloadAssets) |
| §4.6 Modal 接线 | Task 4 Step 3 |
| §5 错误处理与边界 | Task 3 (failed[] + 缺失 url) + Task 4 (snapshot 防并发) |
| §6.1 单元测试 | Task 1 / Task 3 的 test 文件 |
| §6.2 手动冒烟 | Task 4 Step 7 |

**Placeholder scan:** 无 TBD / TODO / "implement later" / "similar to Task N"。

**Type consistency:**
- `downloadAssetsSequentially(items, opts?)` 在 Task 3 定义,Task 4 Step 3 调用 — 签名一致
- `DownloadFailure` / `DownloadBatchResult` 在 Task 3 定义,Task 4 Step 3 消费 — 一致
- `canDownloadSelected` 在 Task 4 Step 2 定义,Step 4 消费 — 一致
- `isDownloading` / `downloadProgress` 在 Task 4 Step 3 定义,Step 4 消费 — 一致

无遗留。