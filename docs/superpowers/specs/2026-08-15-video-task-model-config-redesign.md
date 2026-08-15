# CreateVideoTask 模型配置样式与位置统一设计

> 日期：2026-08-15
> 状态：方案已确认
> 范围：EC-AIGC 前端 SPA。`CreateVideoTask.tsx` 模型配置卡片升级 + `TaskParamsPanel.tsx` 视频演示分支升级 + `CompactParamPicker` 提到公共目录。后端、types.ts、`CreateImageTask` 不动。

## 1. 背景

`CreateVideoTask.tsx` 在 4 种视频模式(首帧图生 / 智能多帧 / 爆款复刻 / 电商复刻)下都通过 `renderVideoModelConfig` 渲染模型配置。当前问题：

1. 顶部 chips summary 是新视觉(参考 `模型参数选择.png`),仅展示不交互
2. 展开后 `TaskParamsPanel` 视频演示分支使用裸 `<select>`(老样式),与 chips 视觉割裂
3. chips 与下方 picker 视觉/交互不统一
4. 首帧图生 / 爆款复刻 / 电商复刻 模式下模型配置卡片位置在「提示词卡片」之后,不符合产品期望

`CreateImageTask` 已经采用 `<CompactParamPicker>`(图标 + label + 弹出 listbox)作为最新视觉方案,需要把同样体验带到视频任务页。

## 2. 已确认原则

1. **4 种视频模式都升级样式**(样式一致),**位置可选**:智能多帧位置不动(原位合适);其他 3 种(首帧图生 / 爆款复刻 / 电商复刻)挪到「视频模式卡片」与「提示词卡片」之间。
2. **chips summary 取消**:不再保留顶部只读 chips;新卡片直接展示 picker,与 `CreateImageTask` 形态对齐。
3. **公共组件提取**:`CompactParamPicker` 从 `CreateImageTask/center/` 提到 `components/common/`,两处共用。
4. **TaskParamsPanel 视频演示分支升级**:通道 / 能力 / 模型 三处 `<select>` 全部换成 `<CompactParamPicker>`,与 default 分支视觉一致。
5. **后端契约不变**:不动 API、不动 types.ts、不动 `CreateImageTask` 任何代码(仅修改一处 import 路径)。
6. **不动 TaskParamsPanel 的 default 分支**(`presentation === 'default'` 走 CreateImageTask,完全保留)。

## 3. 架构与文件改动

| 文件 | 动作 |
| --- | --- |
| `EC-AIGC/src/components/common/CompactParamPicker.tsx` | 新增(从 CreateImageTask 搬过来) |
| `EC-AIGC/src/components/CreateImageTask/center/CompactParamPicker.tsx` | 删除 |
| `EC-AIGC/src/components/CreateImageTask/right/ImageSettingsSection.tsx` | 修改 import 路径(`'./center/CompactParamPicker'` → `'../../common/CompactParamPicker'`) |
| `EC-AIGC/src/components/createTask/TaskParamsPanel.tsx` | 修改 `presentation === 'videoDemo'` 分支,通道 / 能力 / 模型 三处 `<select>` 全部换成 `<CompactParamPicker>` |
| `EC-AIGC/src/components/CreateVideoTask.tsx` | 重写 `renderVideoModelConfig`;挪位置;chips summary 取消 |

### 3.1 CompactParamPicker 公共化

`CompactParamPicker` 组件本体零改动,仅搬位置。`CompactParamOption` / `CompactParamPickerProps` 接口保持完全一致。

迁移影响面:2 个文件:
- 新增 `components/common/CompactParamPicker.tsx`
- 删除 `components/CreateImageTask/center/CompactParamPicker.tsx`
- `CreateImageTask/right/ImageSettingsSection.tsx` 修改 import 路径

### 3.2 TaskParamsPanel 视频演示分支升级

替换前 / 后对照(以 `presentation === 'videoDemo'` 分支为准):

| 位置 | 现状 | 替换 |
| --- | --- | --- |
| 通道 | 行 165-176:`<select>` + `<option>` | `<CompactParamPicker icon={<Route/>} label="模型通道" />` |
| 能力 | 行 200-227:`<select>`(visibleCapabilities) | `<CompactParamPicker icon={<Layers/>} label="能力" />` |
| 模型 | 行 239-268:`<select>`(modelOptions + 默认模型占位) | `<CompactParamPicker icon={<Cpu/>} label="模型" />` |

保留要点:
- `tp.locked` 锁定(传 `disabled={tp.locked}`)
- 「默认模型 (xxx)」占位选项(走 CompactParamPicker 的 placeholder 机制)
- 能力 `cap.isAsync` 角标(走 CompactParamPicker 的 `description` 字段)
- 空状态文案「该实例未开通该类型能力...」

### 3.3 CreateVideoTask 模型配置卡片重写

**新卡片形态**(镜像 ImageSettingsSection 行 117-149):

```tsx
<div className="rounded-lg border border-slate-200 bg-white p-4">
  <p className="text-[11px] font-bold text-primary">模型配置</p>
  <h2 className="mt-1 font-black">本次任务通道与模型</h2>
  <div className="mt-3 flex flex-wrap gap-3">
    <CompactParamPicker label="模型通道" value={tp.channelId} options={...} />
    <CompactParamPicker label="模型" value={tp.modelId} options={...} />
    {inlineSchemaFields.map((field) => (
      <CompactParamPicker label={field.label} value={...} options={...} icon={fieldIcon(field)} />
    ))}
  </div>
</div>
```

`inlineSchemaFields` 包含从 schema 推导的字段(参照 `ImageSettingsSection.tsx:29` 的 `INLINE_FIELD_KEYS` + 视频专有字段 `duration / audio`);实现时根据实际 schema 决定哪些字段走 inline picker,其余走高级设置。

**位置**:

| 模式 | 当前 renderVideoModelConfig 位置 | 新位置 |
| --- | --- | --- |
| `FIRST_FRAME` | 行 1604(提示词卡片后) | 模式卡片后、提示词卡片前 |
| `MULTI_FRAME` | 行 1425(顶部合适) | **不动** |
| `SOLUTION_TRENDING_REPL` | 行 1604(同 FIRST_FRAME) | 模式卡片后、提示词卡片前 |
| `SOLUTION_AD_VIDEO_EDIT` | 行 1604(同 FIRST_FRAME) | 模式卡片后、提示词卡片前 |

**取消**:
- `renderVideoModelConfig` 旧实现(行 983-1052)删除
- chips summary 整个 `<details>` 块删除
- 顶部 chips array 与 `<span>` 元素删除

### 3.4 视觉风格参考

参照 `ImageSettingsSection.tsx:117-149`:
- 单卡片白底 `rounded-lg border border-slate-200 bg-white`
- 顶部小标题 `text-[11px] font-bold text-primary`(可选二级标题 `font-black`)
- picker 横向 `flex flex-wrap gap-3`,间距紧凑
- 不用 `p-5 space-y-5`,改 `p-4`
- picker 宽度走 `widthClassName`,视频模型通道 picker 用 `w-[220px]`,其余按字段类型

## 4. 数据流与状态

```
useTaskParams(group, prefill, fixedCapability, prefillPending)
  ↓ tp.{channelId, channelType, capability, modelId, modelOptions, capabilitiesInChannel, schemaParams, ...}
  ↓
VideoModelConfigCard (新组件 / CreateVideoTask 内联)
  ├─ <CompactParamPicker label="模型通道" value={tp.channelId} options={visibleInstances} onChange={tp.setChannelId} />
  ├─ <CompactParamPicker label="模型" value={tp.modelId} options={modelOptions} onChange={tp.setModelId} />
  └─ inline schema fields(时长/分辨率/比例/音频/...):
        <CompactParamPicker label={field.label} value={...} options={...} onChange={(v) => tp.setSchemaParams(...)} />
```

state 不变,只换渲染形式。所有 setter(`tp.setChannelId / tp.setCapability / tp.setModelId / tp.setSchemaParams`)继续透传。

## 5. 错误处理

- `tp.unavailableReason`:卡片顶部红框提示(参考 `ImageSettingsSection.tsx:111-115`)
- `tp.fallbackReason`:卡片顶部琥珀框提示
- `tp.initializing`:卡片顶部蓝框提示「正在解析默认通道和模型…」
- `tp.locked`:所有 picker `disabled={true}`

## 6. 测试与验收

### 6.1 单元测试

不新增单测。`CompactParamPicker` 接口不变(只搬位置);`TaskParamsPanel` 与 `CreateVideoTask` 已是手动验收级别。

### 6.2 手动验收

1. 启动前端 dev server,进「首帧图生视频」
2. 视觉对齐:模式卡片 → 模型配置卡片(新 picker 风格)→ 提示词卡片 → 提交前检查
3. picker 正常显示:模型通道 / 模型 / 时长 / 分辨率 / 比例 / 音频(图标 + label + 当前值 + 箭头)
4. 切换模型通道 → 模型 picker 自动更新选项
5. 切换模型 → 时长 / 分辨率 / 比例 / 音频 picker 自动更新选项
6. 切到「爆款复刻」/「电商复刻」→ 模型配置卡片位置在模式与提示词之间
7. 切到「智能多帧」→ 模型配置卡片位置不动(原有位置合适)
8. CreateImageTask 走 default 分支不受影响(开图片任务比对视觉)
9. 屏幕宽度变窄,picker 自动换行不挤压
10. 锁定状态 `tp.locked = true` 时 picker 不可点

## 7. 风险与不做的事

### 风险

1. **`TaskParamsPanel` 已超过 700 行**,本轮仅动 videoDemo 分支;default 分支零修改
2. **CreateImageTask 跨任务引用**:迁移 `CompactParamPicker` 时务必保证 `ImageSettingsSection.tsx` 的 import 路径同步更新,否则图片任务会编译失败
3. **位置变更影响 DOM 顺序**:行 1604 移动到提示词卡片之前需要保证 JSX 顺序与组件语义一致

### 不做

- ❌ 不重构 `useTaskParams` 内部
- ❌ 不动后端 / types.ts / API 契约
- ❌ 不动 `TaskParamsPanel` 的 default 分支
- ❌ 不写新单测(手动验收覆盖)
- ❌ 不动 chips summary(整个删除,不再恢复)

## 10. 文件清单

| 文件 | 动作 |
| --- | --- |
| `EC-AIGC/src/components/common/CompactParamPicker.tsx` | 新增 |
| `EC-AIGC/src/components/CreateImageTask/center/CompactParamPicker.tsx` | 删除 |
| `EC-AIGC/src/components/CreateImageTask/right/ImageSettingsSection.tsx` | 修改(仅 import 路径) |
| `EC-AIGC/src/components/createTask/TaskParamsPanel.tsx` | 修改(videoDemo 分支) |
| `EC-AIGC/src/components/CreateVideoTask.tsx` | 修改(模型配置卡片 + 位置) |