# Prompt 内容驱动生成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除 Prompt 分类 Tab 的勾选机制，改为根据最终 Prompt 是否为空自动决定提交类型。

**Architecture:** 在 `promptWorkspace.ts` 提供纯函数，按固定的三个 UI 类型读取“覆盖值优先、默认值兜底”的最终 Prompt，并派生非空类型。状态 Hook 复用该派生结果完成校验、数量汇总和提交；组件只负责 Tab 切换和编辑。

**Tech Stack:** React 19、TypeScript、Node test runner、Tailwind CSS。

---

### Task 1: Prompt 生成类型规则

**Files:**
- Modify: `src/lib/createImageTask/promptWorkspace.ts`
- Test: `src/lib/createImageTask/__tests__/promptWorkspace.test.ts`

- [x] **Step 1: 写失败测试**

验证覆盖值优先、空白 Prompt 被排除，以及类型顺序固定为场景主图、细节图、三视图。

- [x] **Step 2: 运行测试确认失败**

Run: `npm test -- src/lib/createImageTask/__tests__/promptWorkspace.test.ts`

- [x] **Step 3: 实现纯函数**

新增 `getEffectivePrompt` 和 `derivePromptTypes`，不引入新的状态。

- [x] **Step 4: 运行测试确认通过**

Run: `npm test -- src/lib/createImageTask/__tests__/promptWorkspace.test.ts`

### Task 2: 纯 Tab 工作区

**Files:**
- Modify: `src/components/CreateImageTask/center/PromptWorkspace.tsx`
- Test: `src/components/CreateImageTask/center/PromptWorkspace.test.tsx`

- [x] **Step 1: 写失败测试**

断言页面只有三个 Tab，没有加入/取消生成按钮、复选图标和 `overflow-x-auto`。

- [x] **Step 2: 运行测试确认失败**

Run: `npm test -- src/components/CreateImageTask/center/PromptWorkspace.test.tsx`

- [x] **Step 3: 实现等宽 Tab**

移除 `selectedTypes`、`onToggleType` 和禁用状态；Tab 使用 `role=tablist` 与三个等宽按钮。

- [x] **Step 4: 运行测试确认通过**

Run: `npm test -- src/components/CreateImageTask/center/PromptWorkspace.test.tsx`

### Task 3: 状态、复用与提交接入

**Files:**
- Modify: `src/hooks/useCreateImageTaskState.ts`
- Modify: `src/components/CreateImageTask/CreateImageTask.tsx`

- [x] **Step 1: 将默认 Prompt 限定为场景主图**

新任务的细节图和三视图默认值保持空字符串；模板或用户输入仍写入覆盖值。

- [x] **Step 2: 用派生类型替代手工选中状态**

校验、模型张数上限、总张数、确认弹窗和提交载荷统一复用 `derivePromptTypes` 结果。

- [x] **Step 3: 清理旧切换调用**

模板抽屉、做同款和历史任务恢复只切换当前 Tab 并写入 Prompt，不再调用 `toggleType`。

- [x] **Step 4: 验证类型检查**

Run: `npm run lint`

### Task 4: 回归验证

**Files:**
- Verify only

- [x] **Step 1: 运行完整测试**

Run: `npm test`

- [x] **Step 2: 运行生产构建**

Run: `npm run build`

- [x] **Step 3: 检查补丁格式**

Run: `git diff --check`

- [ ] **Step 4: 浏览器验证（后端 8090 未启动，登录后页面暂不可达）**

确认三个 Tab 无勾选框和滚动条；清空场景主图后右侧数量归零；填写细节图后只汇总细节图。
