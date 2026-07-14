# Task 1 Brief — slots.ts 类型与元数据

> 来源:`EC-AIGC/docs/superpowers/plans/2026-07-14-transit-picker-resource-confirm.md` Task 1

## 目标

新增 `src/components/createTask/slots.ts`(slot 类型 + 元数据)及其单测。这是整个改造计划的**底层基础**,Task 2/4/5 都会消费它。

## Files

- Create: `EC-AIGC/src/components/createTask/slots.ts`
- Create: `EC-AIGC/src/components/createTask/slots.test.ts`

## 完整代码(slots.test.ts)

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

## 完整代码(slots.ts)

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

## 执行步骤(TDD)

1. 先创建 `slots.test.ts`(含上面完整代码)
2. 跑测试 → 期望 FAIL(模块不存在):
   ```
   cd EC-AIGC && npx tsx src/components/createTask/slots.test.ts
   ```
3. 创建 `slots.ts`(含上面完整代码)
4. 再跑测试 → 期望 PASS(5 个 test 全过)
5. 不做 git commit(项目根非 git 仓库,plan Task 1 Step 5 的 commit 命令保留为"提示用户手工执行")

## 验证清单

- 5 个 test 全过
- tsc 类型检查:`cd EC-AIGC && npm run lint` PASS
- 无 console 错误

## Global Constraints(适用本任务)

1. 不要 `any` —— SlotKey / SlotRef / SlotMeta 必须显式定义
2. slot 常量集中于 slots.ts,不在其它文件重声明
3. 不引入新依赖 —— 不写 package.json
4. 不自动 commit —— commit 命令保留供用户手工执行
5. 测试用 `node:test + node:assert/strict`,沿用 buildSubmitPayload.test.ts 的 import 模式
6. 项目根非 git 仓库 —— commit 步骤保留命令形式供用户在 EC-AIGC/ 子目录自行执行