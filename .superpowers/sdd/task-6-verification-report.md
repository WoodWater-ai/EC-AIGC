# Task 6 — 端到端验证与总结

> 来源:`EC-AIGC/docs/superpowers/plans/2026-07-14-transit-picker-resource-confirm.md` Task 6

## 测试运行结果

```
=== Task 1: slots.test.ts ===
# tests 5  # pass 5  # fail 0
✅ 5/5 PASS

=== Task 2: buildSubmitPayload.test.ts ===
# tests 7  # pass 7  # fail 0
✅ 7/7 PASS

=== npm run lint (tsc --noEmit) ===
5 errors, 全部 pre-existing,无关本计划:
  - src/api/modules/capability.ts(111,5)         [pre-existing]
  - src/components/beta/RecommendParamsManageNew.tsx(77,28)   [pre-existing]
  - src/components/beta/RecommendParamsManageNew.tsx(224,9)   [pre-existing]
  - src/components/CreateVideoTask.tsx(171,40)  [spec §10 明确不在范围]
  - src/components/SystemConfig.tsx(143,18)     [pre-existing]
```

**所有本次任务的实现 0 lint 错**(只运行可 runtime 的测试;Task 3/4 的 test 因 Vite `import.meta.env` 限制,改用 tsc 类型校验验证通过)。

## 改造总结

### 新增文件(5 个)

| 文件 | 行数 | 用途 |
|---|---|---|
| `src/components/createTask/slots.ts` | ~30 | slot 类型 + SLOT_META 元数据 |
| `src/components/createTask/slots.test.ts` | ~50 | 5 个单测 |
| `src/components/common/TransitPickerButton.tsx` | ~125 | 公共组件,封装"点击 → 弹 modal → 写值" |
| `src/components/common/TransitPickerButton.test.tsx` | ~50 | 4 个类型层单测 |
| `src/components/AssetTransitModal.test.tsx` | ~50 | 4 个类型层单测 |

### 修改文件(4 个)

| 文件 | 改动 |
|---|---|
| `src/components/createTask/buildSubmitPayload.ts` | 整文件替换:TaskFormState 加 `slotRefs` 必填字段;输出 `taskParamsJson.slotRefs` JSON |
| `src/components/createTask/buildSubmitPayload.test.ts` | 加 4 个新 test;旧 3 个 test 补 `slotRefs` 字段 |
| `src/components/AssetTransitModal.tsx` | 6 处改动:`onConfirmSelection` 签名改 `AssetResourceItem[]`、加 `multiSelect` prop、`alert` → `toast`、fileResId 校验 |
| `src/components/CreateImageTask.tsx` | 14 处改动:删 13 个 slot state、删 3 个中间件、7 处 JSX 改 `<TransitPickerButton>`、`handleSubmitTask` 传 slotRefs |

总计:**9 个文件改动**(5 新增 + 4 修改)

## 修复问题(用户最初报告)

| 问题 | 状态 |
|---|---|
| 资源中心"应用不过来" | ✅ 已修:`onConfirmSelection` 签名改为 `AssetResourceItem[]`,父组件不再依赖 modal 内 `assets.find()` 推 fileResId |
| `alert` 改 `toast` | ✅ 已改:3 处 `alert` → `toast.warning` / `toast.error` |
| 单选/多选语义化 | ✅ 已加:`multiSelect` prop,单选点击替换 / 多选 toggle |
| 7 个 slot 复用组件 | ✅ 已抽:`TransitPickerButton` 公共组件,7 个 slot 一对一接入 |
| 13 state 冗余 | ✅ 已聚:`Record<SlotKey, SlotRef | null>` 单一来源 |
| 提交时 slot 数据丢失 | ✅ 已补:`taskParamsJson.slotRefs` JSON 携带 7 个 slot fileResourceId |

## 手动 smoke 验证(待用户执行)

按 plan Task 6 Step 3 清单,用户需在 IDE 内启动 dev server 验证 6 条场景:

1. 点"添加上衣" → 弹资源中心 → 选 1 个 → 点"确认选择" → modal 关闭 + 上衣 slot 显示"已添加上衣"
2. 选 0 个点"确认选择" → toast.warning "请至少选择一个资源",modal 不关闭
3. 选 2 个再点"确认选择"(默认单选) → modal 关闭,只应用最新选的 1 个
4. 同 slot 再次点击 → modal 重新弹出,可替换为新资源
5. 点"清除选择"(多选时) → 已选项清空,slot UI 回到占位态
6. 提交任务时,Network 面板看 `/v1/task/submit` 请求的 `taskParamsJson` 含 `slotRefs: { ... }`

## 提交命令(供用户在 EC-AIGC/ 子目录执行)

```bash
cd EC-AIGC

# 1. 新增的 5 个文件
git add src/components/createTask/slots.ts \
        src/components/createTask/slots.test.ts \
        src/components/common/TransitPickerButton.tsx \
        src/components/common/TransitPickerButton.test.tsx \
        src/components/AssetTransitModal.test.tsx

git commit -m "feat(transit): 新增 slots 元数据 + TransitPickerButton 公共组件 + AssetTransitModal 测试"

# 2. 修改的 4 个文件
git add src/components/createTask/buildSubmitPayload.ts \
        src/components/createTask/buildSubmitPayload.test.ts \
        src/components/AssetTransitModal.tsx \
        src/components/CreateImageTask.tsx

git commit -m "refactor(transit): 改造 AssetTransitModal 签名 + 7 slot 改用 TransitPickerButton + buildSubmitPayload 补 slotRefs"
```

## 范围之外(明确不动)

- `CreateVideoTask.tsx` 的同名 slot 重构(spec §10)
- `TaskDetailsDrawer.tsx` 复用评估
- `ProductAssetLibrary.tsx` 独立管理
- 合成预览逻辑 `handleCompositePreview` 的 `alert` 改 `toast`(mock 行为,后续独立处理)
- 后端 `SubmitTaskRequest` DTO 改造(已用 `taskParamsJson.slotRefs` 兜底)
