# Transit Picker 资源确认改造设计

- 日期: 2026-07-14
- 作者: brainstorming
- 范围: EC-AIGC 前端,创建图片任务流的素材 slot 选择
- 状态: 设计已通过用户 review,待 writing-plans

---

## 1. 背景与问题

### 1.1 现状

`CreateImageTask.tsx` 提供 7 个素材 slot:

- `main`(主图,点击上传卡片)
- `top`(上下装合成套图 — 上衣)
- `bottom`(上下装合成套图 — 下装)
- `detail / style / scene / pose`(参考图,各 1 个)

每个 slot 各自一份独立 state:

- 7 个 `*FileResId: number | null`
- 6 个 `*Uploaded / *RefParsed: boolean`
- 共 13 个 state,分散在 `CreateImageTask.tsx:36-42` 和 `:109-116`

slot 点击 → `setTransitTargetSlot('xxx')` → 打开共享的 `<AssetTransitModal>`(`CreateImageTask.tsx:786-794`)。modal 内多选卡片后点"确认选择",回调 `handleTransitConfirmSelection`(`CreateImageTask.tsx:44-79`)按 `transitTargetSlot` switch 分发写值。

### 1.2 症状

用户报告:点击"添加上衣 / 添加下装"等 slot → 在资源中心选中资源 → 点"确认选择" → **资源没有应用过来**。

排查 `AssetTransitModal.tsx:319-347` 的 `handleConfirmSelection`:

```ts
const fileResIds = selectedAssetIds
  .map((id) => {
    const item = assets.find((a) => a.id === id);  // ← 当前页 assets
    return item?.fileResourceId ?? null;
  })
  .filter((x): x is number => x !== null);
```

任何以下情形都会让父组件拿到空数组:

1. 用户选的卡片不在当前页(分页外 / 切换分类后)
2. 后端返回的 `AssetResourceItem.fileResourceId` 为 null
3. refetch 时 `assets` 已替换,旧 ID 找不到对应 item

`CreateImageTask.tsx:45` 的 `if (selectedFileResourceIds.length === 0) return` 静默吞掉异常,UI 无任何反馈。

### 1.3 附带问题

- `handleConfirmSelection` 空选中用 `alert()`(`AssetTransitModal.tsx:321`),与项目其余 `sonner` toast 风格不一致
- 7 个 slot 全部"业务单选"但 modal 强制多选;`handleTransitConfirmSelection` 取 `selectedFileResourceIds[0]` 是隐式行为
- `transitTargetSlot` 只在父组件 useState 持有,modal 内是装饰,无任何行为差异
- 7 个独立 state 让 `CreateImageTask.tsx` 顶部声明冗长
- `buildSubmitPayload.ts:23-40` 完全没消费 slot 的 fileResourceId,**提交时 7 个 slot 的素材数据丢失**(只走了一个笼统的 `inputImageIds` 字段)

---

## 2. 目标

1. **修复应用不过来的根本问题**:不再依赖 modal 当前页 `assets.find()` 推 fileResIds
2. **抽出 `TransitPickerButton` 公共组件**,让 7 个 slot 复用同一份"点击 → 弹 modal → 写值"逻辑,未来增 slot 不重写
3. **slot state 聚合**为 `Record<SlotKey, SlotRef | null>`,替代 13 个分散 state
4. **单选/多选语义化**:`multiSelect` prop 默认 false,单选点击替换,多选时累加且按钮强制至少 1 个
5. **`alert` → `toast`**,与项目 `sonner` 风格统一
6. **`buildSubmitPayload` 补 slot 字段**,提交时主图 / 上下装 / 参考图全部携带

---

## 3. 设计概览

```
+-------------------------------------------------------------+
|                    CreateImageTask.tsx                      |
|                                                             |
|  +-----------------------------------------------------+   |
|  | useSlotResources()                                 |   |
|  |   → slotRefs: Record<SlotKey, SlotRef | null>       |   |
|  |   → setSlot(slot, ref) / clearSlot(slot)            |   |
|  +-----------------------------------------------------+   |
|                          │                                  |
|                          ▼                                  |
|  +-----------------------------------------------------+   |
|  | <TransitPickerButton> (×7)                         |   |
|  |   slot="main"  | value | onChange | multi=false   |   |
|  |   slot="top"   | ...                               |   |
|  |   slot="bottom"| ...                               |   |
|  |   slot="detail"| ...                               |   |
|  |   slot="style" | ...                               |   |
|  |   slot="scene" | ...                               |   |
|  |   slot="pose"  | ...                               |   |
|  +-----------------------------------------------------+   |
|                          │                                  |
|                          ▼                                  |
|  +-----------------------------------------------------+   |
|  | <AssetTransitModal multiSelect={..}                |   |
|  |   onConfirmSelection={(items) => ...}>             |   |
|  +-----------------------------------------------------+   |
|                          │                                  |
|                          ▼                                  |
|  buildSubmitPayload({ ..., slotRefs })                      |
+-------------------------------------------------------------+
```

每个 `<TransitPickerButton>` 各自持有 `open` state,内部挂自己的 `<AssetTransitModal>`(单实例,共享全局 portal)。

---

## 4. 数据模型

### 4.1 `src/components/createTask/slots.ts`(新增)

```ts
import type { TaskFormState } from './buildSubmitPayload';

export const SLOT_KEYS = [
  'main', 'top', 'bottom', 'detail', 'style', 'scene', 'pose',
] as const;

export type SlotKey = (typeof SLOT_KEYS)[number];

export interface SlotRef {
  /** 后端真实业务标识 —— 提交时携带 */
  fileResourceId: number;
  /** 缩略图 URL —— UI 预览用;不持久化 */
  thumbnailUrl?: string;
  /** 资源名 —— slot 已选态标签用 */
  name?: string;
}

export interface SlotMeta {
  key: SlotKey;
  /** 中文标签 */
  label: string;
  /** 业务语义:该 slot 允许多选 */
  multiSelect: boolean;
  /** 该 slot 在提交 payload 中对应的字段名 */
  payloadField: keyof TaskFormState['slotRefs'];
}

export const SLOT_META: Record<SlotKey, SlotMeta> = {
  main:   { key: 'main',   label: '主图',  multiSelect: false, payloadField: 'mainFileResId' },
  top:    { key: 'top',    label: '上衣',  multiSelect: false, payloadField: 'topFileResId' },
  bottom: { key: 'bottom', label: '下装',  multiSelect: false, payloadField: 'bottomFileResId' },
  detail: { key: 'detail', label: '细节',  multiSelect: false, payloadField: 'detailFileResId' },
  style:  { key: 'style',  label: '风格',  multiSelect: false, payloadField: 'styleFileResId' },
  scene:  { key: 'scene',  label: '场景',  multiSelect: false, payloadField: 'sceneFileResId' },
  pose:   { key: 'pose',   label: '姿势',  multiSelect: false, payloadField: 'poseFileResId' },
};
```

### 4.2 `CreateImageTask` 顶层 state 重构

**删除**(13 个):
- 7 个 `*FileResId: number | null`(`mainFileResId / topClothingFileResId / bottomClothingFileResId / detailFileResId / styleFileResId / sceneFileResId / poseFileResId`)
- 6 个 `*Uploaded / *RefParsed: boolean`(`topClothingUploaded / bottomClothingUploaded / detailRefUploaded / styleRefParsed / sceneRefUploaded / poseRefUploaded`)

**新增**(1 个):

```ts
const [slotRefs, setSlotRefs] = useState<Record<SlotKey, SlotRef | null>>({
  main: null, top: null, bottom: null, detail: null,
  style: null, scene: null, pose: null,
});

const setSlotRef = useCallback((slot: SlotKey, ref: SlotRef | null) => {
  setSlotRefs((prev) => ({ ...prev, [slot]: ref }));
}, []);
```

**保留**:
- `hasCompositePreviewed`(合成预览标记,mock 行为)
- `isUploading`(主图上传中状态)

**JSX 适配**:7 处 `topClothingUploaded ? '已添加上衣' : '添加上衣'` 全部改为 `slotRefs.top ? '已添加上衣' : '添加上衣'`。

---

## 5. 组件契约

### 5.1 `<TransitPickerButton>`(新增)

**位置**: `src/components/common/TransitPickerButton.tsx`

**Props**:

```ts
export interface TransitPickerButtonProps {
  /** slot 标识 —— 唯一身份 */
  slot: SlotKey;

  /** 当前 slot 的资源引用;null = 未选 */
  value: SlotRef | null;
  /** 选中 / 替换 / 清除(value=null) */
  onChange: (next: SlotRef | null) => void;

  /** ----- 视觉配置 ----- */
  /** 占位文字,如"添加上衣" */
  placeholder?: string;
  /** 已选时的标签,如"已添加上衣" */
  selectedLabel?: string;
  /** 占位态 icon(Material Symbols 名,默认 slotMeta.icon) */
  icon?: string;
  /** 已选态 icon(默认 'check_circle') */
  selectedIcon?: string;
  /** 尺寸:sm(参考图) | md(上下装) | lg(主图) */
  size?: 'sm' | 'md' | 'lg';
  /** 样式变体:主图 dashed box vs 普通卡 */
  variant?: 'primary' | 'secondary';

  /** ----- 行为配置 ----- */
  /** 是否允许多选(默认 false) */
  multiSelect?: boolean;
  /** 禁用 */
  disabled?: boolean;
}
```

**内部行为**:
- 点击 → `setOpen(true)` → 渲染 `<AssetTransitModal multiSelect={multiSelect} onConfirmSelection={...} onClose={...} />`
- `onConfirmSelection(items: AssetResourceItem[])`:
  - `items.length === 0` → 不关 modal,等待用户选择
  - `multiSelect === false` → 取 `items[0]` → `onChange(toSlotRef(items[0]))`
  - `multiSelect === true` → 若 `items.length >= 1` → `onChange(toSlotRef(items[0]))`(本版本所有 slot 业务只取首个;未来若要整批传,可改 `onChange(items.map(toSlotRef))` 由父组件决定)
  - 关 modal
- `toSlotRef(item)` 把 `AssetResourceItem` 映射到 `SlotRef`,**所有依赖一次解析**,不依赖 modal 内 `assets` 数组

### 5.2 `<AssetTransitModal>` 契约变更

**Props 变更**(`src/components/AssetTransitModal.tsx`):

```ts
// 旧
onConfirmSelection?: (selectedFileResourceIds: number[]) => void;

// 新
onConfirmSelection?: (selected: AssetResourceItem[]) => void;
multiSelect?: boolean;  // ★ 新增,默认 false
mode?: 'picker' | 'manager';  // ★ 新增,默认 'picker'
```

**两种模式对比**:

| 模式 | 触发场景 | 行为 |
|---|---|---|
| `picker`(默认) | 从 task slot 弹出的资源选择(7 个 slot 走 TransitPickerButton) | 单选点击替换,确认选择可用 |
| `manager` | 从菜单资源中心入口直接打开(无业务上下文) | 强制多选,确认选择置灰 + tooltip,只走"移动/删除/清除"三联管理操作 |

`mode='manager'` 隐式 `multiSelect=true`;`mode='picker'` 时 `multiSelect` 由调用方显式控制。

**内部行为变更**:

1. `handleCardClick(id)` 按 `effectiveMultiSelect` 分支(由 `mode` + `multiSelect` 推导):
   - `effectiveMultiSelect === false`:`setSelectedAssetIds([id])`(替换,不累加)
   - `effectiveMultiSelect === true`:保持 toggle 逻辑
2. `handleConfirmSelection`:
   - 拿到 `selectedAssetIds` 后,`assets.find()` 仍用于**校验** fileResourceId 是否存在;若任一为 null → `toast.error('所选资源缺少文件标识,请重新选择')` + 不关闭 modal
   - 校验通过 → 直接传 `selected.map(id => assets.find(a => a.id === id)!).filter(Boolean)` 给 `onConfirmSelection`
   - **`mode === 'manager'` 时,`onConfirmSelection` 仍正常调用,允许父组件兜底 console.log**
3. 空选中:`alert('请至少选择一个资源！')` → `toast.warning('请至少选择一个资源')`
4. **三联按钮(清除选择 / 移动 / 删除资源)**:守卫改为 `selectedAssetIds.length > 0`,**不再受 `multiSelect` 限制**——只要有选中就出现,单选/多选通用
5. "确认选择"按钮:
   - `mode === 'manager'`:始终 disabled + `title="管理型入口,不需要选择资源"`(不依赖 `selectedAssetIds.length`)
   - `mode === 'picker'` 且 `selectedAssetIds.length === 0`:disabled + `title="请先选择资源"`
   - 其他情况:可用

**`effectiveMultiSelect` 推导逻辑**:

```ts
const effectiveMultiSelect = mode === 'manager' ? true : multiSelect;
```

`mode='manager'` 时强制多选,调用方传入的 `multiSelect` 被忽略(向下兼容);`mode='picker'` 时尊重调用方传入的 `multiSelect` 值。

---

## 6. `buildSubmitPayload` 扩展

### 6.1 `TaskFormState` 新增字段

```ts
// src/components/createTask/buildSubmitPayload.ts
import type { SlotKey, SlotRef } from './slots';

export interface TaskFormState {
  // ... 现有字段
  slotRefs: Record<SlotKey, SlotRef | null>;
}
```

### 6.2 输出映射

```ts
export function buildSubmitPayload(state: TaskFormState): SubmitTaskRequest {
  const { slotRefs } = state;

  const mainFileResId = slotRefs.main?.fileResourceId?.toString() ?? null;
  const topFileResId = slotRefs.top?.fileResourceId?.toString() ?? null;
  const bottomFileResId = slotRefs.bottom?.fileResourceId?.toString() ?? null;
  const referenceImageIds = [
    slotRefs.detail?.fileResourceId,
    slotRefs.style?.fileResourceId,
    slotRefs.scene?.fileResourceId,
    slotRefs.pose?.fileResourceId,
  ]
    .filter((x): x is number => x !== null && x !== undefined)
    .map(String)
    .join(',') || null;

  return {
    // ... 现有字段
    inputImageIds: mainFileResId,
    topFileResId,
    bottomFileResId,
    referenceImageIds,
  };
}
```

### 6.3 后端契约确认(实施前置)

实施前需要确认后端 `SubmitTaskRequest` DTO 是否已有 `topFileResId / bottomFileResId / referenceImageIds` 字段:

- 若有 → 直接对齐
- 若无 → fallback:7 个 slot fileResourceId 拼成 JSON 塞入 `taskParamsJson` 的 `slotRefs` key,由后端解析

**该确认项写到 writing-plans 阶段的"前置任务"**。

---

## 7. 错误处理

| 场景 | 行为 | 文案 |
|---|---|---|
| 用户未选资源,点"确认选择" | toast.warning + 不关 modal | "请至少选择一个资源" |
| 所选资源 `fileResourceId === null` | toast.error + 不关 modal | "所选资源缺少文件标识,请重新选择" |
| modal 内 refetch 失败 | setQueryError + UI "加载失败,点击重试"(沿用现有) | — |
| 单选点其他卡片 | 静默替换 | — |
| 多选取消最后一个 | "确认选择"按钮 disabled + tooltip "请先选择资源" | — |

**toast 风格约定**(对齐项目 `sonner`):
- `toast.success(...)` — 已成功
- `toast.warning(...)` — 用户操作需补充信息(替代 alert)
- `toast.error(...)` — 系统错误

---

## 8. 测试覆盖

| 文件 | 类型 | 覆盖点 |
|---|---|---|
| `src/components/createTask/slots.test.ts` | 单元 | `SLOT_META` 完整性、key 唯一性、payloadField 命名一致 |
| `src/components/common/TransitPickerButton.test.tsx` | 组件 | 单/多选切换、占位/已选态、onChange 回调、空值清除、modal 关闭 |
| `src/components/createTask/buildSubmitPayload.test.ts`(扩展) | 单元 | slotRefs → payload 映射、空 slot 行为、所有 slot 全填正确性 |
| `AssetTransitModal.test.tsx`(新增) | 组件 | multiSelect 单/多选行为、toast 提示、fileResIds 不依赖当前页 assets |

> 项目 `EC-AIGC/AGENTS.md:64-67` 暂不强制写测试,但已有 `buildSubmitPayload.test.ts` 沿用 vitest 模式,新增测试一并 vitest,延续现有风格。

---

## 9. 迁移影响面

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `src/components/common/TransitPickerButton.tsx` | 新增 | 公共组件 |
| `src/components/common/TransitPickerButton.test.tsx` | 新增 | 组件测试 |
| `src/components/createTask/slots.ts` | 新增 | slot 类型与元数据 |
| `src/components/createTask/slots.test.ts` | 新增 | slot 元数据测试 |
| `src/components/AssetTransitModal.tsx` | 改 | `onConfirmSelection` 签名、`multiSelect` prop、`alert` → `toast` |
| `src/components/AssetTransitModal.test.tsx` | 新增 | modal 多选/单选行为测试 |
| `src/components/CreateImageTask.tsx` | 改 | 13 state → 1 record、7 处 slot JSX 改 `<TransitPickerButton>`、`handleCompositePreview` 改 `slotRefs.top/bottom` 校验、`handleSubmitTask` 传 `slotRefs` 给 `buildSubmitPayload` |
| `src/components/createTask/buildSubmitPayload.ts` | 改 | `TaskFormState` 加 `slotRefs`、输出补 4 字段 |
| `src/components/createTask/buildSubmitPayload.test.ts` | 改 | 补 slotRefs 测试用例 |

**9 个文件改动**(其中 5 个新增、4 个修改)。

---

## 10. 不在范围

- `CreateVideoTask.tsx` 的同名 slot 重构(等 CreateImageTask 落地后再迁移,避免一次性改动面过大)
- `TaskDetailsDrawer.tsx` 的"历史任务回放"是否复用 `<TransitPickerButton>`(后续单独评估)
- `ProductAssetLibrary.tsx` 的素材库独立管理 modal(独立功能,不在本次范围)
- 合成预览逻辑 `handleCompositePreview`(mock 行为,不重构)
- 后端 `SubmitTaskRequest` DTO 改造(若缺失字段,本次 fallback 用 `taskParamsJson` 兜底,不强行改后端)

---

## 11. 设计自审

- [x] 占位符:无 TBD / TODO
- [x] 内部一致性:slot state 重构与组件契约、buildSubmitPayload 字段映射一致
- [x] 范围聚焦:仅 EC-AIGC 内,符合 `AGENTS.md` "本目录直接改"约定
- [x] 模糊点消除:
  - `multiSelect=true` 时业务只取首个 → 已在 5.1 写明
  - 后端契约缺失 → fallback 已在 6.3 写明
  - `hasCompositePreviewed` / `isUploading` 保留独立 state → 已在 4.2 写明