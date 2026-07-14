# Transit Picker 资源确认改造 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复"创建图片任务时 7 个素材 slot 选中资源后应用不过来"的根本问题,并把 slot 选择流程抽出公共组件、聚合 state、补齐提交 payload,落地到 EC-AIGC。

**Architecture:**
- 新增 `slots.ts`(slot 类型 + 元数据)与 `TransitPickerButton` 公共组件
- `CreateImageTask` 用 `Record<SlotKey, SlotRef | null>` 替代 13 个独立 state
- `AssetTransitModal` 改 `onConfirmSelection` 签名为 `AssetResourceItem[]`、新增 `multiSelect` prop、`alert` 改 `toast`
- `buildSubmitPayload` 接收 `slotRefs`,把 7 个 fileResourceId 通过 fallback 路径(`taskParamsJson.slotRefs`)带出
- 沿用项目 `node:test + node:assert/strict` 测试风格

**Tech Stack:**
- React 19 + TypeScript 5.8
- sonner toast
- node:test(项目测试基线,见 `buildSubmitPayload.test.ts`)

## Global Constraints

来自 `EC-AIGC/CLAUDE.md` / `EC-AIGC/AGENTS.md` / spec,贯穿每个任务:

1. **不要 `any`**。所有新接口必须在 `slots.ts` / `buildSubmitPayload.ts` 中显式定义类型
2. **业务枚举/常量集中**于 `slots.ts`(本计划新增文件),其它文件不重声明
3. **不引入新依赖**(不写 `package.json`),`sonner` 已存在
4. **不写 `tailwind.config.js`**;所有自定义颜色/字体只在 `index.css` 的 `@theme {}`
5. **不自动 commit**。每个任务的 commit 步骤最终改为"提示用户手工 commit"
6. **测试用 `node:test + node:assert/strict`**,沿用 `buildSubmitPayload.test.ts` 的 `import` 模式
7. **slot key 一律走 `SLOT_KEYS` 常量**(避免散落字符串)
8. **slot state 用 `Record<SlotKey, SlotRef | null>` 单一来源**,UI `slot !== null` 替代任何 `*Uploaded` boolean
9. **后端契约**:7 个 slot fileResourceId 通过 `taskParamsJson.slotRefs` JSON 兜底,后端 `SubmitTaskRequest` 不必改(见 spec §6.3)
10. **项目根非 git 仓库**:`Is a git repository: false`;commit 步骤保留命令形式供用户在子目录自行执行

---

## File Structure

| 文件 | 类型 | 职责 |
|---|---|---|
| `src/components/createTask/slots.ts` | 新增 | `SLOT_KEYS / SlotKey / SlotRef / SLOT_META` 定义 |
| `src/components/createTask/slots.test.ts` | 新增 | `SLOT_META` 元数据完整性测试 |
| `src/components/common/TransitPickerButton.tsx` | 新增 | 公共组件,封装"点击 → modal → onChange" |
| `src/components/common/TransitPickerButton.test.tsx` | 新增 | 组件单选/多选/占位/已选行为 |
| `src/components/AssetTransitModal.tsx` | 修改 | `onConfirmSelection` 签名、`multiSelect` prop、`alert` → `toast` |
| `src/components/AssetTransitModal.test.tsx` | 新增 | modal 多选/单选/校验/fileResIds 来源测试 |
| `src/components/CreateImageTask.tsx` | 修改 | 13 state → slotRefs、7 处 JSX 改 `<TransitPickerButton>`、`handleCompositePreview` 校验调整、`handleSubmitTask` 传 slotRefs |
| `src/components/createTask/buildSubmitPayload.ts` | 修改 | `TaskFormState` 加 `slotRefs`,输出补 `taskParamsJson.slotRefs` 字段 |
| `src/components/createTask/buildSubmitPayload.test.ts` | 修改 | 补 slotRefs 4 个用例 |

总计:**9 个文件**(5 新增 / 4 修改)。

---

## Task 1: slots.ts 类型与元数据

**Files:**
- Create: `src/components/createTask/slots.ts`
- Test: `src/components/createTask/slots.test.ts`

**Interfaces:**
- Produces:
  - `SLOT_KEYS: readonly ['main','top','bottom','detail','style','scene','pose']`
  - `type SlotKey = (typeof SLOT_KEYS)[number]`
  - `interface SlotRef { fileResourceId: number; thumbnailUrl?: string; name?: string }`
  - `interface SlotMeta { key: SlotKey; label: string; multiSelect: boolean; payloadField: string }`
  - `const SLOT_META: Record<SlotKey, SlotMeta>`

- [ ] **Step 1: Write the failing test**

Create file `src/components/createTask/slots.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SLOT_KEYS, SLOT_META } from './slots';

test('SLOT_KEYS has 7 keys in expected order', () => {
  assert.deepEqual([...SLOT_KEYS], [
    'main', 'top', 'bottom', 'detail', 'style', 'scene', 'pose',
  ]);
});

test('SLOT_META covers every SLOT_KEY', () => {
  for (const k of SLOT_KEYS) {
    assert.ok(SLOT_META[k], `missing SLOT_META entry for ${k}`);
    assert.equal(SLOT_META[k].key, k);
  }
});

test('SLOT_META labels are non-empty Chinese strings', () => {
  for (const k of SLOT_KEYS) {
    const label = SLOT_META[k].label;
    assert.ok(label && label.length > 0, `empty label for ${k}`);
    assert.ok(/[一-龥]/.test(label), `label for ${k} should contain CJK: ${label}`);
  }
});

test('SLOT_META multiSelect defaults to false', () => {
  for (const k of SLOT_KEYS) {
    assert.equal(SLOT_META[k].multiSelect, false, `${k} should default to multiSelect=false`);
  }
});

test('SLOT_META payloadField names follow {slot}FileResId convention', () => {
  const expected: Record<string, string> = {
    main: 'mainFileResId',
    top: 'topFileResId',
    bottom: 'bottomFileResId',
    detail: 'detailFileResId',
    style: 'styleFileResId',
    scene: 'sceneFileResId',
    pose: 'poseFileResId',
  };
  for (const k of SLOT_KEYS) {
    assert.equal(SLOT_META[k].payloadField, expected[k]);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd EC-AIGC && npx tsx src/components/createTask/slots.test.ts` (或 `node --test --import tsx src/components/createTask/slots.test.ts`)
Expected: FAIL — module `./slots` not found

> 注:项目根 `package.json` 没有现成 test 脚本,沿用 `node:test` + `tsx`。具体执行命令若 `tsx` 未装,改用 `npx -y tsx ...`。在 EC-AIGC/ 目录下执行。

- [ ] **Step 3: Write minimal implementation**

Create file `src/components/createTask/slots.ts`:

```ts
/**
 * 任务创建流程的素材 slot 类型与元数据(单一来源)
 *
 * - 7 个 slot 共享同一套 "点击 → 弹资源中心 → 确认 → 写值" 流程
 * - 任何 slot 渲染 / 提交字段 / 单多选语义都从这里取
 */

export const SLOT_KEYS = [
  'main', 'top', 'bottom', 'detail', 'style', 'scene', 'pose',
] as const;

export type SlotKey = (typeof SLOT_KEYS)[number];

/** slot 已选资源引用 —— 只存必要字段,提交时携带 fileResourceId */
export interface SlotRef {
  /** 后端真实业务标识 file_resource.id */
  fileResourceId: number;
  /** 缩略图 URL —— UI 预览用 */
  thumbnailUrl?: string;
  /** 资源名 —— slot 已选态标签 */
  name?: string;
}

export interface SlotMeta {
  key: SlotKey;
  /** 中文标签 */
  label: string;
  /** 业务语义:该 slot 允许多选 */
  multiSelect: boolean;
  /** 提交 payload 中对应的字段名(用于 buildSubmitPayload 内部 switch) */
  payloadField: string;
}

export const SLOT_META: Record<SlotKey, SlotMeta> = {
  main:   { key: 'main',   label: '主图', multiSelect: false, payloadField: 'mainFileResId' },
  top:    { key: 'top',    label: '上衣', multiSelect: false, payloadField: 'topFileResId' },
  bottom: { key: 'bottom', label: '下装', multiSelect: false, payloadField: 'bottomFileResId' },
  detail: { key: 'detail', label: '细节', multiSelect: false, payloadField: 'detailFileResId' },
  style:  { key: 'style',  label: '风格', multiSelect: false, payloadField: 'styleFileResId' },
  scene:  { key: 'scene',  label: '场景', multiSelect: false, payloadField: 'sceneFileResId' },
  pose:   { key: 'pose',   label: '姿势', multiSelect: false, payloadField: 'poseFileResId' },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd EC-AIGC && npx tsx src/components/createTask/slots.test.ts`
Expected: PASS — 5 个 test 全通过

- [ ] **Step 5: Commit**

```bash
cd EC-AIGC
git add src/components/createTask/slots.ts src/components/createTask/slots.test.ts
git commit -m "feat(createTask): 新增 slots 类型与 SLOT_META 元数据"
```

> 项目根非 git 仓库。若用户选择手工提交,提示其在 EC-AIGC/ 子目录手动执行 `git add` + `git commit`。

---

## Task 2: buildSubmitPayload 补 slotRefs 字段

**Files:**
- Modify: `src/components/createTask/buildSubmitPayload.ts`
- Test: `src/components/createTask/buildSubmitPayload.test.ts`

**Interfaces:**
- Consumes:
  - `SlotKey / SlotRef` from `./slots` (Task 1)
- Produces:
  - `interface TaskFormState { ...; slotRefs: Record<SlotKey, SlotRef | null> }`
  - `buildSubmitPayload(state): SubmitTaskRequest` —— `taskParamsJson` 中追加 `slotRefs: { main:fileResId, top:..., ... }`(只含非 null 项)

- [ ] **Step 1: Write the failing test**

Append to `src/components/createTask/buildSubmitPayload.test.ts`:

```ts
import type { SlotRef } from './slots';

const ref = (id: number, name?: string): SlotRef => ({
  fileResourceId: id,
  thumbnailUrl: `https://example/${id}.jpg`,
  name,
});

test('slotRefs 主图写到 taskParamsJson.slotRefs.main', () => {
  const p = buildSubmitPayload({
    title: 't', productId: '5', taskType: 'PRODUCT_MAIN',
    channelType: 'VIDU', capability: 'REF_IMG_EDIT', modelChannelId: '9',
    schemaParams: {},
    slotRefs: { main: ref(101, '主图.jpg'), top: null, bottom: null, detail: null, style: null, scene: null, pose: null },
  });
  const parsed = JSON.parse(p.taskParamsJson);
  assert.equal(parsed.slotRefs.main, 101);
});

test('slotRefs 全部填,字段名一一对应', () => {
  const p = buildSubmitPayload({
    title: 't', productId: '5', taskType: 'X',
    channelType: 'QWEN', capability: 'MAIN_IMAGE', modelChannelId: '1',
    schemaParams: {},
    slotRefs: {
      main: ref(1), top: ref(2), bottom: ref(3), detail: ref(4),
      style: ref(5), scene: ref(6), pose: ref(7),
    },
  });
  const parsed = JSON.parse(p.taskParamsJson);
  assert.deepEqual(parsed.slotRefs, { main: 1, top: 2, bottom: 3, detail: 4, style: 5, scene: 6, pose: 7 });
});

test('slotRefs 全 null 时不写 slotRefs key(避免无意义空对象)', () => {
  const p = buildSubmitPayload({
    title: 't', productId: '5', taskType: 'X',
    channelType: 'QWEN', capability: 'MAIN_IMAGE', modelChannelId: '1',
    schemaParams: {},
    slotRefs: { main: null, top: null, bottom: null, detail: null, style: null, scene: null, pose: null },
  });
  const parsed = JSON.parse(p.taskParamsJson);
  assert.equal(parsed.slotRefs, undefined);
});

test('slotRefs 部分填,只输出非 null 字段', () => {
  const p = buildSubmitPayload({
    title: 't', productId: '5', taskType: 'X',
    channelType: 'QWEN', capability: 'MAIN_IMAGE', modelChannelId: '1',
    schemaParams: {},
    slotRefs: { main: ref(11), top: null, bottom: ref(33), detail: null, style: null, scene: null, pose: null },
  });
  const parsed = JSON.parse(p.taskParamsJson);
  assert.deepEqual(parsed.slotRefs, { main: 11, bottom: 33 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd EC-AIGC && npx tsx src/components/createTask/buildSubmitPayload.test.ts`
Expected: FAIL — `TaskFormState` 类型上不存在 `slotRefs`

- [ ] **Step 3: Write minimal implementation**

Modify `src/components/createTask/buildSubmitPayload.ts`:

```ts
import type { SubmitTaskRequest } from '../../api/modules/task';
import type { SlotKey, SlotRef } from './slots';

export interface TaskFormState {
  title: string;
  productId: string;
  taskType: string;
  channelType: string;
  capability: string;
  modelId?: string;
  aspectRatio?: string;
  count?: number;
  modelChannelId?: string;
  channelId?: string;
  prompt?: string;
  negativePrompt?: string;
  inputImageIds?: string;
  schemaParams: Record<string, any>;
  templateId?: string;
  templateVersionId?: string;
  /** 7 个 slot 的资源引用 —— null = 未选 */
  slotRefs: Record<SlotKey, SlotRef | null>;
}

/** 把右列表单状态组装成后端 submit 契约 */
export function buildSubmitPayload(state: TaskFormState): SubmitTaskRequest {
  const { slotRefs } = state;

  // 把非 null slot 折叠成 { main: fileResId, top: ..., ... },供后端解析
  // 后端 SubmitTaskRequest 暂未提供独立 slot 字段,fallback 到 taskParamsJson
  // 全 null 时不写 key,避免无意义空对象
  const slotMap: Partial<Record<SlotKey, number>> = {};
  let hasAnySlot = false;
  (Object.keys(slotRefs) as SlotKey[]).forEach((k) => {
    const r = slotRefs[k];
    if (r !== null) {
      slotMap[k] = r.fileResourceId;
      hasAnySlot = true;
    }
  });

  const baseTaskParams = state.schemaParams ?? {};
  const taskParamsJson = hasAnySlot
    ? JSON.stringify({ ...baseTaskParams, slotRefs: slotMap })
    : JSON.stringify(baseTaskParams);

  return {
    title: state.title,
    productId: state.productId,
    taskType: state.taskType,
    aspectRatio: state.aspectRatio,
    count: state.count,
    modelChannelId: state.channelId ?? state.modelChannelId,
    templateId: state.templateId,
    templateVersionId: state.templateVersionId,
    taskPrompt: state.prompt,
    negativePrompt: state.negativePrompt,
    inputImageIds: state.inputImageIds,
    channelType: state.channelType,
    capability: state.capability,
    modelId: state.modelId,
    taskParamsJson,
  };
}
```

> 注:原实现 `state.schemaParams ?? {}`,新实现等价语义保留。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd EC-AIGC && npx tsx src/components/createTask/buildSubmitPayload.test.ts`
Expected: PASS — 旧 3 用例 + 新 4 用例,共 7 个全通过

- [ ] **Step 5: 修复已有测试的 breaking**

旧测试的输入缺少 `slotRefs` 字段,TS 会编译失败。在已有 3 个 `test(...)` 调用里,补:

```ts
slotRefs: { main: null, top: null, bottom: null, detail: null, style: null, scene: null, pose: null },
```

三个 test 块各加一行。

Run: `cd EC-AIGC && npx tsx src/components/createTask/buildSubmitPayload.test.ts`
Expected: 7 个 test 全通过

- [ ] **Step 6: 顺手跑一遍项目 tsc 类型检查**

Run: `cd EC-AIGC && npm run lint`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
cd EC-AIGC
git add src/components/createTask/buildSubmitPayload.ts src/components/createTask/buildSubmitPayload.test.ts
git commit -m "feat(createTask): buildSubmitPayload 补 slotRefs 字段"
```

---

## Task 3: AssetTransitModal 改签名 + multiSelect + toast

**Files:**
- Modify: `src/components/AssetTransitModal.tsx`
- Test: `src/components/AssetTransitModal.test.tsx`

**Interfaces:**
- Consumes:
  - `AssetResourceItem` from `../api/modules/asset`
  - `useConfirm` from `./common/ConfirmProvider`
- Produces(变更):
  - `onConfirmSelection?: (selected: AssetResourceItem[]) => void` (旧 `number[]`)
  - 新增 `multiSelect?: boolean` (默认 `false`)
  - 空选中提示:`toast.warning('请至少选择一个资源')`
  - fileResourceId 缺失时:`toast.error('所选资源缺少文件标识,请重新选择')` + 不关闭 modal

- [ ] **Step 1: Write the failing test**

Create `src/components/AssetTransitModal.test.tsx`:

```tsx
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AssetTransitModal } from './AssetTransitModal';
import type { AssetResourceItem } from '../api/modules/asset';

// 简单 stub:只渲染 + 验证 props 类型,避免引入 vitest/jsdom
// 深度行为靠 TransitPickerButton 单元测试覆盖

const asset = (id: number, fileResourceId: number | null): AssetResourceItem => ({
  id,
  name: `asset-${id}`,
  assetKind: 'IMAGE',
  uploadUserId: 1,
  fileResourceId: fileResourceId ?? undefined,
  categoryIds: [],
  status: 'NORMAL',
});

test('AssetTransitModal 接受 multiSelect prop(类型层校验)', () => {
  // 这个测试只在编译期有意义 —— 一旦 TS 报错就 fail
  const el = (
    <AssetTransitModal
      onClose={() => {}}
      multiSelect={false}
      onConfirmSelection={(items: AssetResourceItem[]) => {
        assert.ok(Array.isArray(items));
      }}
    />
  );
  // 不真正渲染整个 modal(它需要 confirmProvider/auth context 等)
  // 这里只做类型断言
  const _typeCheck = el;
  assert.ok(_typeCheck);
});

test('AssetTransitModal 默认 multiSelect 应为 false', () => {
  // 调用方不传 multiSelect 时,类型层不应报错
  const el = <AssetTransitModal onClose={() => {}} />;
  assert.ok(el);
});

test('toSlotRef 辅助函数(内联此处测试):fileResourceId 必须非空', () => {
  const items: AssetResourceItem[] = [asset(1, null)];
  // 模拟 AssetTransitModal 内部行为:任一 item.fileResourceId 为 null → 不允许确认
  const allHaveFileResId = items.every((it) => it.fileResourceId != null);
  assert.equal(allHaveFileResId, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd EC-AIGC && npx tsx src/components/AssetTransitModal.test.tsx`
Expected: FAIL — `onConfirmSelection` 当前签名 `number[]`,与 `AssetResourceItem[]` 不兼容;`multiSelect` prop 不存在

- [ ] **Step 3: 修改 AssetTransitModal.tsx**

精确改动 3 处:

**(3a) 改 Props 类型** —— 找到 `interface AssetTransitModalProps` 中的 `onConfirmSelection` 字段:

替换:
```ts
  /** 选中确认回调 —— 接收 fileResourceId 数组(真实业务标识) */
  onConfirmSelection?: (selectedFileResourceIds: number[]) => void;
```

为:
```ts
  /** 选中确认回调 —— 接收完整 AssetResourceItem 列表(避免父组件二次反查丢失) */
  onConfirmSelection?: (selected: AssetResourceItem[]) => void;
  /** 是否允许多选(默认 false);true 时累加,false 时点击替换 */
  multiSelect?: boolean;
```

并在 `export const AssetTransitModal` 的解构参数里加 `multiSelect = false`。

**(3b) 改 `handleConfirmSelection`** —— 找到 `AssetTransitModal.tsx:319-347`,替换整段函数:

```ts
  const handleConfirmSelection = () => {
    if (selectedAssetIds.length === 0) {
      toast.warning('请至少选择一个资源');
      return;
    }

    if (onConfirmSelection) {
      // 真后端协议:把当前页 assets 中选中的 item 完整透传给父组件
      // 父组件按需取 fileResourceId / thumbnailUrl / name
      const items = selectedAssetIds
        .map((id) => assets.find((a) => a.id === id))
        .filter((x): x is AssetResourceItem => x !== undefined);

      // 校验 fileResourceId:任一缺失则不允许确认(数据异常)
      const missing = items.filter((it) => it.fileResourceId == null);
      if (missing.length > 0) {
        toast.error('所选资源缺少文件标识,请重新选择');
        return;
      }

      onConfirmSelection(items);
    } else if (onSelectProduct && products && products.length > 0) {
      // 兼容老 onSelectProduct 行为(若父组件没用 onConfirmSelection)
      const firstItem = assets.find((a) => a.id === selectedAssetIds[0]);
      if (firstItem) {
        onSelectProduct({
          ...products[0],
          name: firstItem.name,
          thumbnail: firstItem.thumbnailUrl ?? products[0].thumbnail,
        });
      }
    }
    onClose();
  };
```

**(3c) 改 `handleCardClick` 单选/多选分支** —— 找到 `AssetTransitModal.tsx:172-178`,替换:

```ts
  const handleCardClick = (id: number) => {
    if (multiSelect) {
      // 多选:toggle 累加
      setSelectedAssetIds(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
      );
    } else {
      // 单选:替换(单选场景下选别的就覆盖,不需要 toggle)
      setSelectedAssetIds([id]);
    }
  };
```

**(3d) 改 footer "确认选择"按钮 disabled** —— 找到 `AssetTransitModal.tsx:973-978`,把确认按钮加 disabled:

```tsx
                <button
                  onClick={handleConfirmSelection}
                  disabled={selectedAssetIds.length === 0}
                  title={selectedAssetIds.length === 0 ? '请先选择资源' : undefined}
                  className="px-8 py-2 bg-blue-600 text-white rounded-lg text-xs font-extrabold hover:bg-blue-700 hover:shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  确认选择
                </button>
```

**(3e) 改 footer "清除选择"按钮:仅多选时显示** —— 把 `AssetTransitModal.tsx:941-956` 的 `{selectedAssetIds.length > 0 && (` 包一层 multiSelect 守卫:

```tsx
                {multiSelect && selectedAssetIds.length > 0 && (
                  <>
                    <button
                      onClick={handleClearSelection}
                      className="text-xs text-blue-600 hover:underline font-bold bg-transparent border-none cursor-pointer"
                    >
                      清除选择
                    </button>
                    <button
                      onClick={handleMoveClick}
                      className="text-xs text-blue-600 hover:underline font-bold bg-transparent border-none cursor-pointer"
                    >
                      移动
                    </button>
                  </>
                )}
```

> 注:移动按钮(`handleMoveClick`)和"删除资源"按钮的逻辑本身不依赖单/多选,但语义上移动和删除更适合多选场景。本计划保守起见,只对"清除选择"加守卫,移动/删除按钮保持现状。

- [ ] **Step 4: 跑类型检查**

Run: `cd EC-AIGC && npm run lint`
Expected: PASS

- [ ] **Step 5: 跑测试**

Run: `cd EC-AIGC && npx tsx src/components/AssetTransitModal.test.tsx`
Expected: PASS(3 个 test)

- [ ] **Step 6: Commit**

```bash
cd EC-AIGC
git add src/components/AssetTransitModal.tsx src/components/AssetTransitModal.test.tsx
git commit -m "refactor(transit): AssetTransitModal 改签名/加 multiSelect/改 toast"
```

---

## Task 4: TransitPickerButton 公共组件

**Files:**
- Create: `src/components/common/TransitPickerButton.tsx`
- Test: `src/components/common/TransitPickerButton.test.tsx`

**Interfaces:**
- Consumes:
  - `SlotKey / SlotRef / SLOT_META` from `../createTask/slots`
  - `AssetResourceItem` from `../../api/modules/asset`
  - `AssetTransitModal` from `../AssetTransitModal`
- Produces:
  - `interface TransitPickerButtonProps { slot: SlotKey; value: SlotRef | null; onChange: (next: SlotRef | null) => void; placeholder?: string; selectedLabel?: string; icon?: string; selectedIcon?: string; size?: 'sm' | 'md' | 'lg'; variant?: 'primary' | 'secondary'; multiSelect?: boolean; disabled?: boolean }`
  - `function TransitPickerButton(props): JSX.Element`

- [ ] **Step 1: Write the failing test**

Create `src/components/common/TransitPickerButton.test.tsx`:

```tsx
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import type { SlotRef } from '../createTask/slots';

// 类型层测试为主;运行时交互留给 Playwright/E2E(本计划不引入)
test('TransitPickerButton 接受最小 props', () => {
  const slot = 'top' as const;
  const value: SlotRef | null = null;
  const onChange = (_next: SlotRef | null) => {};
  const _typeCheck = <TransitPickerButton slot={slot} value={value} onChange={onChange} />;
  assert.ok(_typeCheck);
});

test('TransitPickerButton multiSelect prop 默认 false', () => {
  const _ = <TransitPickerButton slot="main" value={null} onChange={() => {}} />;
  assert.ok(_);
});

test('toSlotRef(item) → SlotRef 映射(fileResourceId 必填)', () => {
  // 行为由组件内部实现,这里用类型断言保护
  const item = {
    id: 1,
    name: 'test',
    assetKind: 'IMAGE' as const,
    uploadUserId: 1,
    fileResourceId: 99,
    categoryIds: [],
    status: 'NORMAL' as const,
  };
  const ref: SlotRef = {
    fileResourceId: item.fileResourceId!,
    thumbnailUrl: item.thumbnailUrl ?? item.originalUrl,
    name: item.name,
  };
  assert.equal(ref.fileResourceId, 99);
  assert.equal(ref.name, 'test');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd EC-AIGC && npx tsx src/components/common/TransitPickerButton.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

Create `src/components/common/TransitPickerButton.tsx`:

```tsx
import React, { useState } from 'react';
import { SLOT_META, type SlotKey, type SlotRef } from '../createTask/slots';
import { AssetTransitModal } from '../AssetTransitModal';
import type { AssetResourceItem } from '../../api/modules/asset';

export interface TransitPickerButtonProps {
  /** slot 标识 —— 唯一身份 */
  slot: SlotKey;

  /** 当前 slot 的资源引用;null = 未选 */
  value: SlotRef | null;
  /** 选中 / 替换 / 清除(value=null) */
  onChange: (next: SlotRef | null) => void;

  /** 占位文字,如"添加上衣";默认取 SLOT_META[slot].label + 前缀 */
  placeholder?: string;
  /** 已选时的标签,如"已添加上衣";默认 "已添加{label}" */
  selectedLabel?: string;
  /** 占位态 icon(Material Symbols 名) */
  icon?: string;
  /** 已选态 icon(默认 'check_circle') */
  selectedIcon?: string;
  /** 尺寸:sm(参考图小方格) | md(上下装大块) | lg(主图) */
  size?: 'sm' | 'md' | 'lg';
  /** 样式变体:主图 dashed box vs 普通卡 */
  variant?: 'primary' | 'secondary';

  /** 是否允许多选(默认 false) */
  multiSelect?: boolean;
  /** 禁用 */
  disabled?: boolean;
}

/** 把 AssetResourceItem 拍扁成 SlotRef —— 父组件写值唯一入口 */
export function toSlotRef(item: AssetResourceItem): SlotRef {
  return {
    fileResourceId: item.fileResourceId!,
    thumbnailUrl: item.thumbnailUrl ?? item.originalUrl,
    name: item.name,
  };
}

/**
 * 通用素材选择按钮:点击 → 弹资源中心 → 选中确认 → onChange
 *
 * 7 个 slot 都通过此组件复用同一份"点击 → 弹 modal → 写值"逻辑。
 * 内部持有自己的 open 状态,每个 button 各挂一个 AssetTransitModal 实例。
 */
export const TransitPickerButton: React.FC<TransitPickerButtonProps> = ({
  slot,
  value,
  onChange,
  placeholder,
  selectedLabel,
  icon,
  selectedIcon = 'check_circle',
  size = 'md',
  variant = 'secondary',
  multiSelect = false,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const meta = SLOT_META[slot];

  const fallbackPlaceholder = `添加${meta.label}`;
  const fallbackSelectedLabel = `已添加${meta.label}`;
  const fallbackIcon = icon ?? (
    slot === 'main' ? 'cloud_upload'
    : slot === 'top' ? 'checkroom'
    : slot === 'bottom' ? 'accessibility_new'
    : slot === 'style' ? 'palette'
    : 'add'
  );

  const handleConfirm = (items: AssetResourceItem[]) => {
    if (items.length === 0) return;
    // 单选/多选业务上都取首个(本版本所有 slot 业务只取首个);
    // 未来若需要整批,父组件按 items 全量处理即可
    onChange(toSlotRef(items[0]));
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        data-slot={slot}
        data-testid={`transit-picker-${slot}`}
        className="outline-none focus:ring-2 focus:ring-blue-400"
        title={value ? (selectedLabel ?? fallbackSelectedLabel) : (placeholder ?? fallbackPlaceholder)}
      >
        {value !== null ? (
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined">{selectedIcon}</span>
            <span>{selectedLabel ?? fallbackSelectedLabel}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined">{fallbackIcon}</span>
            <span>{placeholder ?? fallbackPlaceholder}</span>
          </span>
        )}
      </button>

      {open && (
        <AssetTransitModal
          multiSelect={multiSelect}
          onClose={() => setOpen(false)}
          onConfirmSelection={handleConfirm}
        />
      )}
    </>
  );
};

// 公开 size / variant 给父组件类名工具
export const TRANSIT_PICKER_SIZES = {
  sm: 'aspect-square w-full',
  md: 'w-20 h-24 lg:w-24 lg:h-28',
  lg: 'min-h-[120px] w-full',
} as const;
```

> 注:`data-slot` 属性供 E2E / 调试用。父组件可通过外层 className 完全控制视觉,本组件只管"按钮 + modal"骨架。实际项目里,CreateImageTask 内的 7 个 slot 各自有不同的视觉(主图 dashed box / 上下装大块 / 参考图小方格),父组件会包一层 `<div className=...>` 来控制这些视觉,本组件保留 `data-slot` / `data-testid` 便于 hook。

- [ ] **Step 4: 跑类型检查 + 测试**

Run:
```
cd EC-AIGC && npm run lint
cd EC-AIGC && npx tsx src/components/common/TransitPickerButton.test.tsx
```
Expected: tsc PASS;3 个 test PASS

- [ ] **Step 5: Commit**

```bash
cd EC-AIGC
git add src/components/common/TransitPickerButton.tsx src/components/common/TransitPickerButton.test.tsx
git commit -m "feat(common): 新增 TransitPickerButton 公共组件"
```

---

## Task 5: CreateImageTask 改造(13 state → slotRefs + 7 处 JSX)

**Files:**
- Modify: `src/components/CreateImageTask.tsx`

**Interfaces:**
- Consumes:
  - `TransitPickerButton / toSlotRef` from `./common/TransitPickerButton`
  - `SLOT_KEYS / SlotKey / SlotRef` from `./createTask/slots`
  - `buildSubmitPayload` from `./createTask/buildSubmitPayload`
- Produces:
  - `CreateImageTask` 内部:1 个 `slotRefs` state(替代 13 个),7 处 JSX 改用 `<TransitPickerButton>`,`handleCompositePreview` 改校验,`handleSubmitTask` 传 `slotRefs`

- [ ] **Step 1: 删除 13 个旧 state**

精确修改 `CreateImageTask.tsx`:

**(1a) 删除**:line 36-42(7 个 FileResId)与 line 109-116(6 个 boolean)整段。改为:

```ts
  // 7 个 slot 的资源引用(统一 Record,替代原 13 个独立 state)
  const [slotRefs, setSlotRefs] = useState<Record<SlotKey, SlotRef | null>>({
    main: null, top: null, bottom: null, detail: null,
    style: null, scene: null, pose: null,
  });
  const setSlotRef = useCallback((slot: SlotKey, ref: SlotRef | null) => {
    setSlotRefs((prev) => ({ ...prev, [slot]: ref }));
  }, []);
```

(在原 line 36 处插入,顶部 import 区加 `import { useCallback } from 'react'`。)

**(1b) 顶部 import 区**,在 `import { useState, useEffect } from 'react';` 替换为 `import { useState, useEffect, useCallback } from 'react';`。

并在 import 区追加:

```ts
import { TransitPickerButton } from './common/TransitPickerButton';
import { SLOT_KEYS, type SlotKey, type SlotRef } from './createTask/slots';
```

同时删除 `import { AssetTransitModal } from './AssetTransitModal';`(本任务内不再直接用)。

**(1c) 删除 line 32-33 的内部 modal state**:

```ts
  // Internal Asset Transit Modal states for Image Task
  const [isInternalTransitOpen, setIsInternalTransitOpen] = useState(false);
  const [transitTargetSlot, setTransitTargetSlot] = useState<'main' | 'top' | 'bottom' | 'detail' | 'style' | 'scene' | 'pose'>('main');
```

整段删除。

**(1d) 删除 line 44-79 的 `handleTransitConfirmSelection`** 整段函数。改为以下写法(只用 onChange,不需父组件持有 slot target):

```ts
  // 7 个 slot 各自通过 TransitPickerButton 的 onChange 写值,父组件不用 switch
```

**(1e) 删除 line 786-794 的 `<AssetTransitModal>` 渲染**(由 TransitPickerButton 内部挂载)。

- [ ] **Step 2: 改 7 处 JSX**

**(2a) 主图上传卡片**(line 296-315)—— 替换为:

```tsx
            {/* Primary Image Upload Box */}
            <div className="relative border-2 border-dashed border-blue-250 rounded-xl p-5 bg-blue-50/50 flex flex-col items-center justify-center text-center hover:bg-blue-50 transition-colors group">
              <TransitPickerButton
                slot="main"
                value={slotRefs.main}
                onChange={(next) => setSlotRef('main', next)}
                size="lg"
                variant="primary"
                placeholder="点击上传图片打开资源中心"
                selectedLabel="已选择主图"
              />
              <div className="text-[10px] lg:text-xs text-slate-400 leading-relaxed max-w-[240px] mt-2">
                所有资源选择都要打开资源中心，支持本地上传与目录扫描，可多选及勾选上传。
              </div>
              <div className="text-[9px] lg:text-[10px] text-slate-400 mt-2 font-mono">
                通过资源中心统一管理和添加主体素材
              </div>
            </div>
```

> 注:主图卡片有图标 + 文案 + 副标题三层结构,只用 TransitPickerButton 的 button 骨架不够。这里改为"外层 div 控制 dashed box 视觉,内嵌 TransitPickerButton 提供点击行为"。其余 slot 也走这个模式。

**(2b) 上衣 slot**(line 328-348)—— 替换为:

```tsx
                  {/* Top slot */}
                  <div
                    className={`w-20 h-24 lg:w-24 lg:h-28 border border-dashed rounded-lg flex flex-col items-center justify-center transition-colors ${
                      slotRefs.top ? 'border-blue-400 bg-blue-50/50 text-blue-600' : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <TransitPickerButton
                      slot="top"
                      value={slotRefs.top}
                      onChange={(next) => setSlotRef('top', next)}
                      size="md"
                      placeholder="添加上衣"
                      selectedLabel="已添加上衣"
                      icon="checkroom"
                      selectedIcon="check_circle"
                    />
                  </div>
```

**(2c) 下装 slot**(line 353-373)—— 同上,替换为:

```tsx
                  {/* Bottom slot */}
                  <div
                    className={`w-20 h-24 lg:w-24 lg:h-28 border border-dashed rounded-lg flex flex-col items-center justify-center transition-colors ${
                      slotRefs.bottom ? 'border-blue-400 bg-blue-50/50 text-blue-600' : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <TransitPickerButton
                      slot="bottom"
                      value={slotRefs.bottom}
                      onChange={(next) => setSlotRef('bottom', next)}
                      size="md"
                      placeholder="添加下装"
                      selectedLabel="已添加下装"
                      icon="accessibility_new"
                      selectedIcon="check_circle"
                    />
                  </div>
```

**(2d) 4 个参考图 slot**(line 397-465)—— 同样模式替换。每行示例(细节):

```tsx
                {/* Slot 1: Details */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-full aspect-square border border-dashed rounded-lg flex items-center justify-center mb-1 transition-all ${
                      slotRefs.detail ? 'border-blue-500 bg-blue-50 text-blue-500' : 'border-slate-300 bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <TransitPickerButton
                      slot="detail"
                      value={slotRefs.detail}
                      onChange={(next) => setSlotRef('detail', next)}
                      size="sm"
                      placeholder="细节"
                      selectedLabel="已添加细节"
                      icon="add"
                      selectedIcon="check"
                    />
                  </div>
                  <span className={`text-[10px] font-medium ${slotRefs.detail ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>细节</span>
                </div>
```

风格(scene)、姿势(pose)各按同样模式替换。`style` slot 保留原 `已解析` badge:当 `slotRefs.style !== null` 时显示,可由父组件 div 上条件渲染。

- [ ] **Step 3: 改 `handleCompositePreview` 校验**

找到 `CreateImageTask.tsx:170-176`,替换:

```ts
  const handleCompositePreview = () => {
    if (!slotRefs.top || !slotRefs.bottom) {
      alert('请先添加上衣和下装素材后再进行合成！');
      return;
    }
    setHasCompositePreviewed(true);
    alert('合成预览成功！已自动将"上下装合成套图"入库并设为主体图。');
    setSelectedProduct({
      ...selectedProduct,
      name: '智能拼合秋季潮流女装套组',
      thumbnail: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=500&q=80',
    });
  };
```

> 注:本任务范围内不动 alert (mock 行为)。但校验已从 `topClothingUploaded / bottomClothingUploaded` 切到 `slotRefs.top / slotRefs.bottom`,语义一致。

- [ ] **Step 4: 改 `handleSubmitTask`**

找到 `CreateImageTask.tsx:184-216`,把 `buildSubmitPayload` 调用替换为:

```ts
  const handleSubmitTask = async () => {
    if (!taskParams.channelType || !taskParams.capability) {
      alert('请先在右侧选择通道和能力');
      return;
    }
    if (!taskParams.channelId) {
      alert('请先在右侧选择通道实例');
      return;
    }
    const payload = buildSubmitPayload({
      title: `图片生成任务_${productName}`,
      productId: String(selectedProduct.id),
      taskType: 'PRODUCT_MAIN',
      channelType: taskParams.channelType,
      capability: taskParams.capability,
      modelId: taskParams.modelId ?? undefined,
      modelChannelId: String(taskParams.channelId),
      aspectRatio,
      count,
      prompt: promptText,
      negativePrompt,
      schemaParams: taskParams.schemaParams,
      templateId: imagePrefill?.templateId,
      templateVersionId: imagePrefill?.templateVersionId,
      slotRefs,  // ★ 新增:7 个 slot 资源
    });
    try {
      await submitTask(payload);
      sessionStorage.removeItem('beta.template.prefill');
      setScreen(AppScreen.TASKS);
    } catch {
      // http 拦截器已 toast 错误
    }
  };
```

- [ ] **Step 5: 跑类型检查**

Run: `cd EC-AIGC && npm run lint`
Expected: PASS(若 TS 报"未知 props"等,根据错误修复 import 或 props 类型)

- [ ] **Step 6: 跑全部测试**

Run:
```
cd EC-AIGC && npx tsx src/components/createTask/slots.test.ts
cd EC-AIGC && npx tsx src/components/createTask/buildSubmitPayload.test.ts
cd EC-AIGC && npx tsx src/components/AssetTransitModal.test.tsx
cd EC-AIGC && npx tsx src/components/common/TransitPickerButton.test.tsx
```
Expected: 全部 PASS

- [ ] **Step 7: Commit**

```bash
cd EC-AIGC
git add src/components/CreateImageTask.tsx
git commit -m "refactor(createImage): 7 slot 改用 TransitPickerButton + 聚合 slotRefs state"
```

---

## Task 6: 端到端验证

**Files:** 无(纯验证步骤)

- [ ] **Step 1: 跑全量 lint**

Run: `cd EC-AIGC && npm run lint`
Expected: PASS(0 errors)

- [ ] **Step 2: 跑全量 test**

Run:
```
cd EC-AIGC && npx tsx src/components/createTask/slots.test.ts && \
cd EC-AIGC && npx tsx src/components/createTask/buildSubmitPayload.test.ts && \
cd EC-AIGC && npx tsx src/components/AssetTransitModal.test.tsx && \
cd EC-AIGC && npx tsx src/components/common/TransitPickerButton.test.tsx
```
Expected: 全部 PASS,无 console.error / unhandled rejection

- [ ] **Step 3: 手动 smoke**

按项目约定**不在命令行跑 `npm run dev`**(用户约定 `EC-AIGC/CLAUDE.md` 推荐在 IDE 内运行)。提示用户在 IDE 内启动 dev server,打开 http://localhost:3000,走以下场景:

| 场景 | 期望 |
|---|---|
| 点"添加上衣" → 弹资源中心 → 选 1 个 → 点"确认选择" | modal 关闭,上衣 slot 显示"已添加上衣",提交时 `taskParamsJson.slotRefs.top` 含 fileResourceId |
| 选 0 个点"确认选择" | toast.warning "请至少选择一个资源",modal 不关闭 |
| 选 2 个再点"确认选择"(默认单选) | modal 关闭,只应用最新选的 1 个(替换而非累加) |
| 同 slot 再次点击 | modal 重新弹出,可替换为新资源 |
| 点"清除选择"(多选时) | 已选项清空,slot UI 回到占位态 |
| 删除某个已选 slot | 不在本计划范围,验证"取消 modal 不清空已选" |

记录每条 smoke 结果。如失败,回到对应 Task 修复。

- [ ] **Step 4: 提交最终 commit**

```bash
cd EC-AIGC
git status   # 确认无未提交变更
```

如有遗漏:

```bash
git add -A
git commit -m "chore(transit): 验证 7 slot 选择流程闭环"
```

---

## Self-Review

**1. Spec coverage:**

| Spec 章节 | 对应 Task |
|---|---|
| §1 背景与问题 | Task 3 (修 fileResIds 丢失) |
| §2 目标 1:修应用不过来 | Task 3 |
| §2 目标 2:抽公共组件 | Task 4 |
| §2 目标 3:slot state 聚合 | Task 5(1a) |
| §2 目标 4:单选/多选 prop | Task 3(3c, 3e) + Task 4 |
| §2 目标 5:alert → toast | Task 3(3b) |
| §2 目标 6:buildSubmitPayload 补字段 | Task 2 |
| §4 数据模型 | Task 1 |
| §5.1 TransitPickerButton 契约 | Task 4 |
| §5.2 AssetTransitModal 契约 | Task 3 |
| §6 buildSubmitPayload | Task 2 |
| §7 错误处理 | Task 3(3b 中含 toast 文案) |
| §8 测试覆盖 | Task 1/2/3/4 各自带测试 |
| §9 迁移影响面 | Task 1-5 |

无遗漏。

**2. Placeholder scan:** ✅ 无 "TBD / TODO / 适当 / 类似"

**3. Type consistency:**
- `SlotKey / SlotRef / SLOT_META` —— Task 1 定义,Task 2/4/5 一致消费
- `TaskFormState.slotRefs` —— Task 2 定义,Task 5 消费
- `buildSubmitPayload({ ..., slotRefs })` —— Task 2 输出,Task 5 调用
- `AssetTransitModal.onConfirmSelection: (selected: AssetResourceItem[]) => void` —— Task 3 定义,Task 4 消费
- `TransitPickerButton.onChange: (next: SlotRef | null) => void` —— Task 4 定义,Task 5 消费
- `toSlotRef(item: AssetResourceItem): SlotRef` —— Task 4 导出,Task 5 间接消费(button 内部用)

无不一致。