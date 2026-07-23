# 子任务缩略图点击放大预览 — 设计文档

- **日期**:2026-07-21
- **范围**:前端 `EC-AIGC`
- **涉及文件**:`src/components/TaskList.tsx`、新增 `src/components/ImagePreviewModal.tsx`

## 背景

任务列表(`TaskList.tsx`)中,展开父任务后会以 `ChildTaskChip`(`TaskList.tsx:29–123`)形式展示各子任务,每个 chip 显示一张 40×40 缩略图(取子任务产出图 `ChannelAsyncTaskImage.imageUrl` + 腾讯云 CI `imageMogr2/thumbnail/64x64` 实时缩放,当前只显示第一张)。目前缩略图不可点击,用户无法放大查看清晰原图。

## 目标

点击子任务缩略图后,弹出简洁预览弹层,支持查看该子任务的**全部产出图**并左右切换。

## 非目标(YAGNI)

- 不做滚轮缩放 / 拖拽平移 / 1:1 缩放等重型查看器交互。
- 不引入任何第三方 lightbox / 图片查看库。
- 不改动父任务已有的结果图预览弹层(`TaskList.tsx:691–741`)。

## 组件划分

新增独立、可复用组件 **`ImagePreviewModal`**(单一职责:给定一组图 URL,做居中大图预览 + 多图切换)。`ChildTaskChip` 只负责"点击时把图列表交出去",弹层只负责"展示"。

### `ImagePreviewModal` props

```ts
interface PreviewImage {
  url: string;      // 原图 URL(不带 imageMogr2 缩略参数)
  label?: string;   // 可选:批次序号 / 版本,用于角标或计数说明
}

interface ImagePreviewModalProps {
  images: PreviewImage[];
  initialIndex?: number;   // 默认 0
  onClose: () => void;
}
```

- 复用现有弹层样式:`fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn`,与 `TaskList.tsx:691` 现有预览弹层风格一致。
- 大图约束:`max-w-[90vw] max-h-[85vh] object-contain`,避免超大图撑破屏幕。
- 图 img 沿用现有约定:`referrerPolicy="no-referrer"`、`loading="lazy"`。

## 交互

- 点击 chip 缩略图 → 打开弹层,居中显示**原图**(用 `imageUrl` 原图,不加 `imageMogr2/thumbnail`)。
- 多图(`images.length > 1`)时:
  - 大图两侧显示左右箭头(lucide `ChevronLeft` / `ChevronRight`)。
  - 底部显示小缩略图条,当前项高亮。
  - 显示 `当前/总数` 计数。
- 单图时:隐藏箭头与缩略图条。
- 关闭:点击遮罩、右上角 ✕、或按 `ESC`。
- 键盘:`←` / `→` 切换图片,`Esc` 关闭;组件卸载/关闭时移除监听,避免泄漏。
- 只有 `status === 'SUCCESS'` 且有图时缩略图可点击(加 `cursor-zoom-in`);无图 / pending 保持现状。

## 数据流

- `ChildTaskChip` 目前只取 `firstImg`。改为持有该子任务的完整 `images` 列表(`ChannelAsyncTaskImage[]`),缩略图仍只显示第一张。
- 点击时,把 `images.map(i => ({ url: i.imageUrl, label: 批次序号/版本 }))` 交给 `TaskList` 顶层的弹层状态。
- 在 `TaskList` 顶层新增 `previewImages` state(与现有 `previewTask` / `feedbackTask` state 并列),由 `TaskList` 渲染 `<ImagePreviewModal>`。
  - 提到顶层的原因:避免遮罩层被表格行的 `overflow` / `z-index` 裁剪,与现有弹层保持同一层级。
- `ChildTaskChip` 通过回调(如 `onPreview(images, index)`)把点击事件冒泡到 `TaskList`。

## 边界与错误处理

- 图 URL 为空 / 加载失败:大图区显示占位(复用现有 placeholder 图标模式,`onError` 兜底)。
- 图列表为空:chip 不响应点击。
- 组件卸载 / 关闭时移除键盘事件监听。

## 测试

该前端项目未见测试框架配置,以手动验证为主:

- 单图:无箭头 / 无缩略图条,能打开与关闭。
- 多图:箭头、底部缩略图条、计数正确;左右切换与键盘方向键一致。
- 关闭途径:遮罩点击、✕、ESC 均生效。
- 非 SUCCESS / 无图子任务:缩略图不可点击。
