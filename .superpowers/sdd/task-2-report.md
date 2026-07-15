# Task 2 Report — buildSubmitPayload 补 slotRefs 字段

## What was implemented

**核心改动**: 在 `TaskFormState` 新增必填字段 `slotRefs: Record<SlotKey, SlotRef | null>`，在 `buildSubmitPayload` 中将非 null slot 的 `fileResourceId` 折叠写入 `taskParamsJson.slotRefs` JSON，供后端解析。

### TDD Flow Evidence

| Stage | Action | Result |
|-------|--------|--------|
| Step 1 | 在 `buildSubmitPayload.test.ts` 末尾追加 4 个新 test | 7 tests total (3 old + 4 new) |
| Step 2 | `npx tsx buildSubmitPayload.test.ts` (旧实现) | 4 pass, **3 fail** — `slotRefs` undefined |
| Step 3 | 整文件替换 `buildSubmitPayload.ts` (新增 slotRefs 处理) | Code changed |
| Step 4 | `npx tsx buildSubmitPayload.test.ts` | **4 new PASS**, 2 old fail (missing slotRefs), 1 old PASS (already had slotRefs from edit) |
| Step 5 | 修复旧 2 个 test (追加 `slotRefs: { main: null, ... }`) | All 3 old tests now have slotRefs |
| Step 6 | `npx tsx buildSubmitPayload.test.ts` | **7/7 PASS** |

### lint 结果 (`npm run lint`)

```
src/api/modules/capability.ts(111,5): TS2353 — pre-existing
src/components/beta/RecommendParamsManageNew.tsx(77,28): TS2339 — pre-existing
src/components/beta/RecommendParamsManageNew.tsx(224,9): TS2322 — pre-existing
src/components/SystemConfig.tsx(143,18): TS2304 — pre-existing
```

**本任务相关文件 0 lint 错误**。`CreateImageTask.tsx` 和 `CreateVideoTask.tsx` 的 `buildSubmitPayload` 调用已补 `slotRefs` 字段，避免 TS 编译错误。

### Files Modified

| File | 改动 |
|------|------|
| `src/components/createTask/buildSubmitPayload.ts` | 整文件替换：`TaskFormState` 新增 `slotRefs` 必填字段；`buildSubmitPayload` 增加 slotMap 折叠逻辑，输出到 `taskParamsJson.slotRefs` |
| `src/components/createTask/buildSubmitPayload.test.ts` | 追加 4 个新 test；3 个旧 test 补 `slotRefs` 字段 |
| `src/components/CreateImageTask.tsx` | `buildSubmitPayload` 调用补 `slotRefs: { main: null, ... }` (fix TS error) |
| `src/components/CreateVideoTask.tsx` | `buildSubmitPayload` 调用补 `slotRefs: { main: null, ... }` (fix TS error) |

### Self-Review Findings

- **7/7 tests pass** — TDD RED→GREEN 流程完整
- **无 `any`** — `slotMap: Partial<Record<SlotKey, number>>` 类型安全
- **旧 3 test 的 schemaParams 行为不变** — `taskParamsJson` 仍含 `schemaParams` 内容（全 null 时只含 `{}`）
- **slot 全 null 时不写 `slotRefs` key** — 避免无意义空对象
- **4 个新 test 覆盖**: 主图单独写入、部分填充、全部填充、全 null 跳过
- **代码完全来自 brief verbatim**
- **pre-existing lint 错误未引入新变化**（capability.ts / RecommendParamsManageNew.tsx / SystemConfig.tsx）

### Concerns

无。
