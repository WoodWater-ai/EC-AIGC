# Task 2 Brief — buildSubmitPayload 补 slotRefs 字段

> 来源:`EC-AIGC/docs/superpowers/plans/2026-07-14-transit-picker-resource-confirm.md` Task 2

## 目标

`buildSubmitPayload.ts` 新增 `slotRefs: Record<SlotKey, SlotRef | null>` 字段,把 7 个 slot fileResourceId 通过 fallback 路径(`taskParamsJson.slotRefs` JSON)带出。这是修复"提交时 slot 数据丢失"的核心改动。

后端 `SubmitTaskRequest`(`src/api/modules/task.ts`)暂无独立 slot 字段,本任务**不修改后端 DTO**,全部 slot 走 `taskParamsJson.slotRefs` JSON。

## Files

- Modify: `EC-AIGC/src/components/createTask/buildSubmitPayload.ts`
- Modify: `EC-AIGC/src/components/createTask/buildSubmitPayload.test.ts`

## 改动 1: `buildSubmitPayload.test.ts` 末尾追加 4 个新 test

精确位置:在文件最末尾(现有第 3 个 test 之后)追加。**不要修改**已有 3 个 test,它们在 Step 5 会单独补 `slotRefs` 字段。

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

## 改动 2: `buildSubmitPayload.ts` 完整新内容

**整文件**替换为:

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

## 改动 3: 修复已有 3 个 test 的 breaking

旧 3 个 test 调用 `buildSubmitPayload({...})` 缺少 `slotRefs` 字段,TypeScript 编译会失败。**逐个**在每个 `buildSubmitPayload({...})` 调用的最后一个属性后追加:

```ts
slotRefs: { main: null, top: null, bottom: null, detail: null, style: null, scene: null, pose: null },
```

## 执行步骤(TDD)

1. **先**在 `buildSubmitPayload.test.ts` 末尾追加 4 个新 test(不改旧 3 个)
2. 跑测试 → 期望 FAIL(TS 编译失败,缺 slotRefs):
   ```
   cd EC-AIGC && npx tsx src/components/createTask/buildSubmitPayload.test.ts
   ```
3. 替换 `buildSubmitPayload.ts` 整文件内容
4. 跑测试 → 期望 4 个新 test 通过,旧 3 个 FAIL(TS 缺 slotRefs)
5. **修复旧 3 个 test**,逐个加 `slotRefs` 字段
6. 跑测试 → 期望 7 个 test 全过
7. 跑 `cd EC-AIGC && npm run lint` → 期望本任务相关 0 错(已有 pre-existing 错不归本任务)
8. 不做 git commit(项目根非 git 仓库)

## 验证清单

- 7 个 test 全过(`5+4=9`?实际是 3 旧 + 4 新 = 7)
- 本任务相关 0 lint 错
- 没有 `any`
- 旧 3 test 的 schemaParams 行为不变(`taskParamsJson` 仍含 schemaParams 内容)

## Global Constraints

1. 不要 `any`
2. slot key 走 `SLOT_KEYS` 常量
3. 不引入新依赖
4. 不自动 commit
5. 测试用 `node:test + node:assert/strict`
6. 不改后端 DTO
7. 后端契约 fallback:`taskParamsJson.slotRefs` JSON 串
8. 项目根非 git 仓库

## 上下文接口(给本任务用)

- 消费:`SlotKey / SlotRef` from `./slots`(Task 1 已交付)
- 输出:`TaskFormState.slotRefs` 必填字段,`SubmitTaskRequest.taskParamsJson` 包含 `slotRefs: { ... }` key
- 后续 Task 5 会消费 `TaskFormState.slotRefs` 字段
