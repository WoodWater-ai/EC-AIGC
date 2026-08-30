# 资源中心:批量下载选中素材 — Design Spec

- **日期**:2026-08-30
- **项目**:EC-AIGC
- **状态**:Design(待实施计划)
- **主文件**:`EC-AIGC/src/components/AssetTransitModal.tsx`
- **新增模块**:`EC-AIGC/src/utils/downloadFile.ts`、`EC-AIGC/src/utils/downloadAssets.ts`
- **依赖**:无新 npm 包

## 1. 背景与痛点

资源中心(`AssetTransitModal`)支持在 通用素材 / 产品素材 / 模特素材 三个 tab 下浏览、可视化预览、合并、关联产品、移动分类、删除等动作,但**没有"下载到本地"的入口**。运营/设计同学要把素材导出来做二次编辑(抠图、做稿、对接外部渠道)时,只能在卡片上右键 → "图片存储为..." 单张保存,批量场景效率极低。

需求:选中若干素材后,在弹框底部(footer)出现 **下载** 按钮,点击后依次下载每个素材的 `originalUrl`(原图 / 原视频)。

## 2. 目标

- 选中素材后,弹框底部出现 **下载** 按钮,与合并 / 关联产品 等同级操作并列。
- 仅"本人上传的资源"可下载(对齐现有删除 / 设为模特 的本人校验模式),不新增 RBAC 权限。
- 逐项下载原图 / 原视频,文件名保留 `asset.name` 原值,浏览器自动处理重名。
- 单项失败不阻塞整批,完成后汇总提示成功数 + 失败明细。

## 3. 非目标 (YAGNI)

- 后端签名下载接口 / 直链生成(`/v1/admin/asset/download-url`)
- ZIP 打包批量下载(浏览器端打包大文件性能 + 内存问题严重)
- 下载进度条 / 暂停 / 取消(浏览器下载弹窗已是天然进度展示)
- 跨会话记忆下载历史
- 模特素材 tab 的下载支持(详见 §5 边界)
- 引入第三方下载库(file-saver / streamSaver)

## 4. 设计

### 4.1 改动范围

| 文件 | 性质 | 说明 |
|---|---|---|
| `src/utils/downloadFile.ts` | **新增**(从 AssistantPage 抽取) | 复用 AssistantPage 现有模式,作为共享工具 |
| `src/utils/downloadAssets.ts` | 新增 | 顺序批量下载 + 失败收集 |
| `src/utils/downloadFile.test.ts` | 新增 | 工具函数单元测试 |
| `src/utils/downloadAssets.test.ts` | 新增 | 批量下载单元测试 |
| `src/components/Assistant/AssistantPage.tsx` | **重构**(小) | 移除内联的 `triggerBrowserDownload` / `downloadFileName` / `downloadOriginalResult`,改为从 `utils/downloadFile` 导入;**行为不变** |
| `src/components/AssetTransitModal.tsx` | 修改 | 新增 canDownloadSelected + 下载按钮 + 状态 |

**关键发现**:`Assistant/AssistantPage.tsx` 第 185-236 行已有同模式的实现(`triggerBrowserDownload(url, fileName, openInNewTab)` + `downloadOriginalResult(result)`),目前内联在该组件文件、未对外共享。本特性把这段代码**抽取**到共享工具,AssistantPage 改为引用 —— 一举两得,既满足本次需求又消除重复。

不改动后端 API;复用现有 `AssetResourceItem.originalUrl`(后端 v2 新增,见 `src/api/modules/asset.ts:46`)。

### 4.2 下载机制选择

`originalUrl` 指向腾讯云 COS(跨域)。浏览器原生 `<a download href="...">` 仅在同源 URL 或响应头携带 `Content-Disposition: attachment` 时触发下载。COS 公共 GET 默认不带该头。

**采用**:`fetch(originalUrl, { mode: 'cors' })` → `Response.blob()` → `URL.createObjectURL(blob)` → 动态 `<a download={name}>` → `click()` → `URL.revokeObjectURL()` → 移除 `<a>`。

- 优点:跨域兼容性强(只要 COS 配了 `Access-Control-Allow-Origin`)
- 优点:文件名完全可控(不依赖响应头)
- 代价:每文件一次 fetch;需 200ms 间隔规避 Chrome >~5/秒 下载限速

### 4.3 UI 位置与样式

`AssetTransitModal.tsx` 第 2286-2415 行 footer,在 **关联产品** 按钮(第 2366-2374 行)之后、闭合 `{currentSelectionCount > 0 && (...)}` 条件块之前,插入下载按钮:

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

视觉与合并 / 关联产品 完全一致(蓝色文字 + 下划线 + Material Symbols 前缀图标)。

### 4.4 触发条件

```ts
const canDownloadSelected =
  selectedAssetIds.length > 0
  && selectedItems.length === selectedAssetIds.length  // 防悬空引用
  && selectedItems.every((item) => Boolean(item.originalUrl));
```

**不限制上传者** —— 任何 tab 下选中即下载,只要资源有 `originalUrl`。理由:产品素材 / 模特素材 在 `toGeneratedTransitAsset` / `toInputTransitAsset` / `modelProfileToTransitAsset` 里均把 `uploadUserId` 硬编码为 `''`,本人校验在数据层不可达;而产品 / 模特资产本身就是按 SKU 归属或共享模特库概念,个人上传者校验语义不适用。

实际可见性:
- **通用素材 tab**:选中本人上传的资源 + 选中已关联产品的资源(本人已上传过)+ 选中其他用户公开资源(允许) —— 只要有 `originalUrl` 即可
- **产品素材 + focusedProduct**:同样只校验 `originalUrl`,不限上传者(查看的是当前 SKU 的素材)
- **产品素材 + 未聚焦 SKU**:隐藏(选择是按 SKU,非 asset —— SKU 列表天然没有 asset 级别选择)
- **模特素材 tab**:同样只校验 `originalUrl`,不限上传者(模特库是共享库)

不新增 RBAC 权限。复用已有的 `useAuth().hasPermission`。

### 4.5 新增模块 API

**`src/utils/downloadFile.ts`**(从 AssistantPage 抽取并公开)

```ts
/** 从 mime 推断文件扩展名(无点号),失败时返回 fallback */
export function inferExtensionFromMime(mime: string, fallback?: string): string;

/** 触发浏览器保存:url 可以是 blob URL 或跨域 URL(openInNewTab=true 时仅打开) */
export function triggerBrowserDownload(url: string, fileName: string, openInNewTab?: boolean): void;

/**
 * fetch URL → 转 Blob(失败抛 Error)。
 * 与 triggerBrowserDownload 配套使用:
 *   fetchAsBlob(url).then(b => triggerBrowserDownload(URL.createObjectURL(b), name))
 */
export async function fetchAsBlob(url: string): Promise<Blob>;
```

抽取的 AssistantPage 内部细节保留:
- `triggerBrowserDownload` 创建 `<a>` 后 `document.body.appendChild` + `click()` + `remove()`(同原实现)
- `triggerBrowserDownload` 第三个参数 `openInNewTab` 保留兼容 —— 当 fetch 失败时用此参数回退到 `<a target=_blank>` (这是 AssistantPage 现成的 CORS 失败降级策略)
- `URL.revokeObjectURL` 由调用方在 `setTimeout(..., 1000)` 后执行(原实现延迟 1s revoke,避免部分浏览器下载未启动就 revoke)
- `inferExtensionFromMime` 与 AssistantPage 第 185-206 行的 `downloadFileName` 同等效果,但只暴露扩展名推断;具体命名由调用方决定(资源中心用 `asset.name`,创作助手用现有命名规则)

**`src/utils/downloadAssets.ts`**

```ts
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
  /** 每项完成回调(idx 是项的索引,失败也回调) */
  onItemComplete?: (idx: number) => void;
}

export async function downloadAssetsSequentially(
  items: Array<{ id: string; name: string; originalUrl?: string }>,
  opts?: DownloadBatchOptions,
): Promise<DownloadBatchResult>;
```

行为:
- 缺 `originalUrl` → 记 failed,reason = `缺少原图地址`,继续
- `fetchAsBlob` 抛错(CORS / 网络 / 4xx-5xx)→ 记 failed,reason = `err.message`,继续
- 其他抛错(罕见,如 `triggerBrowserDownload` 内部)→ 同上
- 调用 `onItemComplete` 后等待 `delayMs`,再继续下一项
- 全程不抛错;调用方仅消费返回的 `DownloadBatchResult`

### 4.6 Modal 接线

```ts
const [isDownloading, setIsDownloading] = useState(false);
const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number }>(
  { current: 0, total: 0 },
);

const handleDownloadSelected = async () => {
  if (!canDownloadSelected || isDownloading) return;
  const snapshot = selectedItems;  // 防并发选择变化
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

## 5. 错误处理与边界

| 场景 | 行为 |
|---|---|
| 资源缺 `originalUrl` | 记 failed,reason = `缺少原图地址`,批处理继续 |
| fetch 失败(CORS / 网络 / 4xx-5xx) | 记 failed,reason = `err.message`,批处理继续 |
| 空选择 | `canDownloadSelected` = false,按钮禁用 |
| 混合本人 + 他人 | `canDownloadSelected` = false,按钮禁用 |
| 下载中重新选择 | 当前批次以 snapshot 跑完,按钮状态反映新选择 |
| 下载中组件卸载 | `URL.createObjectURL` 短生命周期泄漏,v1 接受,不主动 abort |
| 文件名含路径分隔符或空字符串 | 浏览器通常会清洗;我们原样传 `asset.name` |
| fetch 返回非 2xx | `Response.blob()` 在非 2xx 仍返回 blob(体可能为错误 JSON);由调用方 `fetch` 的 `ok` 检查决定,我们采用 `response.ok` 失败抛错路径 |
| 文件名去重 | 浏览器自动 `name (1).jpg` 处理,无需前端命名 |

不自动重试失败项 —— 用户重新选择后再次点击 下载。

## 6. 测试

### 6.1 单元测试(vitest)

Vitest + React Testing Library 是 `EC-AIGC` 的既有 TODO(见 `EC-AIGC/CLAUDE.md` 的"已知 TODO"清单),本特性**不阻塞** Vitest 的接入 —— 实施计划可独立完成工具函数实现,Vitest 接入可放在另一个独立 ticket。本节列出工具函数的测试用例,Vitest 接入时按本节实现即可。

**`downloadFile.test.ts`**:
- `inferExtensionFromMime('image/jpeg')` → `'jpg'`
- `inferExtensionFromMime('video/mp4')` → `'mp4'`
- `inferExtensionFromMime('application/octet-stream', 'bin')` → `'bin'`
- `fetchAsBlob` 网络成功 → 返回 Blob;网络失败 → 抛错
- `saveBlobAsDownload` 调用 `URL.createObjectURL` + 临时 `<a>` 的 `click()` + `URL.revokeObjectURL` + 移除节点

**`downloadAssets.test.ts`**:
- 全成功 → `success = N`,`failed = []`
- 部分失败(模拟其中一项 fetch reject) → `success + failed.length = N`,其余项仍处理
- 缺 `originalUrl` → 记 failed,reason = `缺少原图地址`,批处理继续
- 顺序保持:`onItemComplete` 回调 idx 按 0,1,2 升序
- `delayMs: 0` 时不延迟(测试用)
- 全失败仍返回干净的 result 对象,不抛错

### 6.2 手动冒烟(开发模式)

| 操作 | 预期 |
|---|---|
| 通用素材:选 2 张本人图片 → 点下载 | 磁盘收到 2 个文件,toast "2 个资源已开始下载" |
| 通用素材:选 1 张本人 + 1 张他人图片 → 点下载 | 收到 2 个文件(不限上传者) |
| 通用素材:选 1 个本人视频 → 点下载 | 收到 1 个视频文件 |
| 产品素材 已聚焦 SKU:选任意素材(含他人上传) → 点下载 | 收到对应文件(不限上传者) |
| 模特素材 tab:选中任意模特资源 → 点下载 | 收到对应文件(不限上传者) |
| 产品素材 未聚焦 SKU(选择的是 SKU 而非 asset) | 按钮不出现 |
| 断网中途点下载 | toast 显示部分成功 + 失败数 |
| 取消选中后按钮立即禁用 | 是 |

## 7. 后续可能的扩展(本设计不实现)

- 模特素材 tab 的下载(需要先解决 `uploadUserId` 映射问题)
- ZIP 打包下载(超过 10 个文件的场景)
- 后端签名下载接口(可控失效时间,防盗链)
- 下载审计日志(谁在什么时候下载了什么)