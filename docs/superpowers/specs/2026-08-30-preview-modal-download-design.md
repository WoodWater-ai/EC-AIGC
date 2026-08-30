# 预览弹层:下载当前资源 — Design Spec

- **日期**:2026-08-30
- **项目**:EC-AIGC
- **状态**:Design(待实施)
- **主文件**:`EC-AIGC/src/components/ImagePreviewModal.tsx`、`EC-AIGC/src/components/VideoPreviewModal.tsx`
- **依赖**:复用 `EC-AIGC/src/utils/downloadFile.ts`(已存在,无新依赖)
- **新 npm 包**:无

## 1. 背景与痛点

资源中心与创作助手等场景下,用户经常需要查看某张图/视频的细节再保存。但当前 `ImagePreviewModal` / `VideoPreviewModal` 只提供 ESC / ←/→ / 关闭,**没有下载入口**。用户必须:
1. 关闭预览
2. 回到列表
3. 找到对应卡片右键 → "图片存储为..."

流程割裂,常见运营场景(把生成图存到本地做二次编辑)效率低下。

需求:在预览弹层右上角(关闭按钮左边)加一个下载按钮,点击后下载**当前显示**的图/视频。

## 2. 目标

- 预览弹层右上角出现下载按钮,与关闭按钮并列(关闭按钮左边)。
- 点击后下载当前 `index` 对应的资源(`images[index]` / `videos[index]`)。
- 文件名优先用调用方传入的 `filename`,否则从 URL 路径推导,最后兜底 `preview-N.<ext>`。
- CORS / 网络失败时 fallback 到新标签页打开(对齐 AssistantPage 的成熟模式)。
- 不引入快捷键。

## 3. 非目标 (YAGNI)

- 批量下载(预览场景单图/单视频)
- 进度条 / 暂停 / 取消(浏览器原生 UX 足够)
- 键盘快捷键(`D` 触发下载)
- 旋转 / 缩放 / 标记等查看增强
- 跨会话记忆

## 4. 设计

### 4.1 改动范围

| 文件 | 性质 | 内容 |
|---|---|---|
| `src/components/ImagePreviewModal.tsx` | 修改 | 接口扩展 + 下载按钮 + handler + 模块级 `resolveFilename` helper |
| `src/components/VideoPreviewModal.tsx` | 修改 | 同上 |

不新建文件;不修改 Resource Center ;不复用 `downloadAssets.ts`(单文件不需要批量协调器);复用 `downloadFile.ts`。

### 4.2 接口扩展

```ts
// ImagePreviewModal.tsx
export interface PreviewImage {
  url: string;
  label?: string;
  /** 新增:调用方显式指定下载文件名(无扩展名时建议带) */
  filename?: string;
}

// VideoPreviewModal.tsx
export interface PreviewVideo {
  url: string;
  poster?: string | null;
  label?: string;
  /** 新增 */
  filename?: string;
}
```

向后兼容:现有所有调用点不传 `filename`,走 URL 推导 / `preview-N.<ext>` 兜底。

### 4.3 文件名解析(模块级 helper)

```ts
/** filename 优先 → URL 路径最后一段 → preview-N.<ext> */
function resolveFilename(
  item: { url: string; filename?: string },
  index: number,
  ext: 'jpg' | 'mp4',
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

放在两个组件文件各自的模块顶层(互不复用,各自维护)。两份实现相同,避免跨跨文件 helper 增加文件依赖。

### 4.4 UI 位置与样式

顶部右上角,与现有的关闭按钮并列。两个文件对称实现,各自硬编码自己的扩展名与按钮 title 文案(每个文件单一用途,不需要 `kind` 变量):

```tsx
{/* 现有(保留) */}
<button
  onClick={onClose}
  className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
  aria-label="关闭"
>
  <span className="material-symbols-outlined text-lg">close</span>
</button>

{/* 新增(下载按钮) */}
<button
  onClick={() => void handleDownloadCurrent()}
  disabled={isDownloading || !current}
  className="absolute -top-2 right-10 z-10 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-slate-500 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
  aria-label="下载"
  title="下载当前图片"   // VideoPreviewModal 改为 "下载当前视频"
>
  <span className="material-symbols-outlined text-lg">download</span>
</button>
```

关键差异:`-right-2`(关闭按钮)→ `right-10`(下载按钮),8px 圆按钮 + 24px 间距 ≈ 64px 偏移,视觉上左右各占一位,关闭按钮位置不动。

### 4.5 下载 handler

```ts
const [isDownloading, setIsDownloading] = useState(false);

// ImagePreviewModal:扩展名传 'jpg';VideoPreviewModal 传 'mp4'
const DEFAULT_EXT: 'jpg' | 'mp4' = 'jpg';   // VideoPreviewModal 改为 'mp4'

const handleDownloadCurrent = async () => {
  if (!current) return;
  const filename = resolveFilename(current, index, DEFAULT_EXT);
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
};
```

`triggerBrowserDownload` / `fetchAsBlob` 从 `../utils/downloadFile` 导入,与 Resource Center 改造后的 `AssistantPage` 共用同一组工具。

### 4.6 状态 & 生命周期

- `isDownloading`:本地 `useState`,仅用于按钮 `disabled` 视觉反馈。无外部状态。
- `URL.revokeObjectURL` 延迟 1s(对齐 AssistantPage / `downloadAssets.ts` 模式,避免部分浏览器下载未启动就 revoke)。
- `index` 变化时 `useCallback` 重建 handler;不主动重置 `isDownloading`(React 自动 re-render 时,新 handler 引用新 index)。

## 5. 错误处理与边界

| 场景 | 行为 |
|---|---|
| `current === null`(空数组) | 组件早返回 null,按钮不渲染 |
| 显式 `filename` 优先 | 直接使用 |
| URL 解析失败(`new URL` 抛错,或 pathname 最后一段为空) | 兜底 `preview-N.<ext>` |
| `fetchAsBlob` 抛错(CORS / 网络 / 4xx-5xx) | 新标签页打开(`triggerBrowserDownload(url, name, true)`) |
| 下载中重复点击 | 按钮 `disabled`(`isDownloading=true`) |
| 切换图片 / 视频(`index` 变化) | 按钮立即可用;`filename` 按新 `index` 重新计算 |
| 单图 / 单视频 | 按钮仍显示(当前唯一那张) |
| 视频文件大,fetch 慢 | 按钮短暂 disabled;无进度条(浏览器原生下载 UX) |
| 关闭按钮 | 位置 / 行为完全不变 |

无 toast(成功由浏览器下载弹窗反馈;失败自动转新标签页,无需提示)。

无单元测试 —— DOM 交互 + `URL.createObjectURL` 在 node:test 无法验证,沿用 `mergeImages.test.ts` / `downloadFile.test.ts` 的项目既定模式(签名校验仅,DOM 行为留给浏览器集成)。

## 6. 手工冒烟(开发模式)

| 操作 | 预期 |
|---|---|
| 打开任意图片预览 | 右上角出现下载按钮(关闭按钮左边) |
| 单图预览:点击下载 | 浏览器保存当前图片,文件名取 URL 路径最后一段 |
| 多图预览:`1/5` → `3/5` 切换 → 点下载 | 拿到 `3/5` 对应那张 |
| 显式传 `filename` 时 | 文件名使用传入值 |
| URL 解析失败(非法 URL) | 文件名兜底 `preview-N.jpg` |
| CORS 阻止的 URL | 新标签页打开而非下载 |
| 视频预览:点击下载 | 浏览器保存视频文件 |
| 关闭按钮 | 位置 / 行为完全不变 |
| ESC / ← / → 键盘 | 正常 |

## 7. 后续可能的扩展(本设计不实现)

- 快捷键 `D` 触发下载
- 视频下载进度条
- 批量下载(把整个 `images[]` 一键导出 ZIP)
- 下载审计日志