# Image Prompt Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate output-type cards and multi-editor stack with a three-tab Prompt workspace, a template drawer, and per-type count inside execution parameters.

**Architecture:** Keep the existing task payload and server enums. New UI maps both legacy main-image template types to `scene_detail`, while a focused workspace component owns presentation and the page owns active type, template loading, and parameter prefill.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, lucide-react, node:test, existing service/query hooks.

---

### Task 1: Lock the three-category mapping

**Files:**
- Create: `src/lib/createImageTask/promptWorkspace.ts`
- Create: `src/lib/createImageTask/__tests__/promptWorkspace.test.ts`
- Modify: `src/labels/createImageTask.ts`

- [ ] Write tests asserting the visible order is `scene_detail`, `detail_closeup`, `model_triple_view`, and both `PRODUCT_MAIN` and `SCENE_DETAIL` template types map to `scene_detail`.
- [ ] Run `npm test -- --test-name-pattern='prompt workspace'` and verify the mapping tests fail.
- [ ] Implement `PROMPT_WORKSPACE_TYPES`, `toWorkspaceType`, and category labels without changing server DTO types.
- [ ] Run the focused tests and verify they pass.

### Task 2: Build the consolidated Prompt workspace

**Files:**
- Create: `src/components/CreateImageTask/center/PromptWorkspace.tsx`
- Create: `src/components/CreateImageTask/center/PromptWorkspace.test.tsx`
- Modify: `src/components/CreateImageTask/center/ImageContentSection.tsx`

- [ ] Write static-render tests for three Tabs, one active textarea, a template button, creative tags, and absence of “按表单重算”.
- [ ] Run the focused component test and verify it fails before the component exists.
- [ ] Implement controlled active type, separate Tab switch and enable controls, a 220px minimum textarea, template trigger, and an undo icon visible only for a modified Prompt.
- [ ] Reduce `ImageContentSection` to the single workspace container and necessary operational states.
- [ ] Run the component tests and verify they pass.

### Task 3: Add the template queue drawer

**Files:**
- Create: `src/components/CreateImageTask/center/PromptTemplateDrawer.tsx`
- Create: `src/components/CreateImageTask/center/PromptTemplateDrawer.test.tsx`

- [ ] Write static-render tests that filter `PRODUCT_MAIN` and `SCENE_DETAIL` into 场景主图 and display Prompt/parameter summaries.
- [ ] Run the focused drawer test and verify it fails.
- [ ] Implement a right-side drawer with loading, empty, and selection-pending states; expose `onSelect(templateId)` and `onClose()`.
- [ ] Run the drawer tests and verify they pass.

### Task 4: Integrate template application and count placement

**Files:**
- Modify: `src/components/CreateImageTask/CreateImageTask.tsx`
- Modify: `src/components/CreateImageTask/right/ImageSettingsSection.tsx`
- Modify: `src/hooks/useCreateImageTaskState.ts`
- Modify: `src/components/CreateImageTask/right/ImageResultPanel.tsx`

- [ ] Change the default selected type to `scene_detail` and map legacy `PRODUCT_MAIN` template prefill to `scene_detail`.
- [ ] Add page state for active type, drawer visibility, selected inline template context, and selection progress.
- [ ] Fetch the image template camp with `useServiceQuery`, then fetch `reuseContext` only after a drawer selection.
- [ ] Apply only Prompt, count, style, scene, pose and execution prefill; do not change product, subject asset or references.
- [ ] Add current-type count control as the first field in `ImageSettingsSection`; remove count from the Prompt header.
- [ ] Change new result labels for `SCENE_DETAIL`/`scene_detail` to 场景主图 while retaining legacy `PRODUCT_MAIN` display compatibility.
- [ ] Run all related component and state tests.

### Task 5: Remove superseded UI and verify the workflow

**Files:**
- Modify: `src/components/CreateImageTask/CreateImageTask.tsx`
- Remove from imports/usages only: `ImageTypeSelector`, `PerTypePromptEditor`, `TemplatePicker`

- [ ] Remove the old output-type cards, stacked Prompt editors, visible “按表单重算” action, helper subtitles, selected-type summary and persistent assistant-success banner.
- [ ] Run `npm run lint`, `npm test`, `npm run build`, and `git diff --check`.
- [ ] In the browser, verify Tab switching, type enablement, 220px Prompt height, count under execution parameters, drawer filtering, template application, and no material/reference replacement.
- [ ] Capture desktop and mobile screenshots and verify no overlap or clipped controls.

No automatic commit is included because the project `AGENTS.md` requires manual commits.
