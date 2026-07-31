# Video Prompt Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the image detail drawer more focused and make video Prompt authoring follow the image-task workflow.

**Architecture:** Keep the existing single-component video task state model. Add one boolean that distinguishes a user-entered master Prompt from generated storyboard prompts, and render compact product facts from the existing `ProductAsset` data.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vite.

---

### Task 1: Refine the task detail drawer

**Files:**
- Modify: `src/components/TaskDetailsDrawer.tsx:128`

- [ ] **Step 1: Reduce the desktop drawer cap**

Replace `max-w-6xl` on the drawer section with `max-w-[980px]`; retain `w-full` so narrow viewports use all available width.

- [ ] **Step 2: Verify type checking**

Run: `npm run lint`

Expected: `tsc --noEmit` exits with code 0.

### Task 2: Make video Prompt generation progressive

**Files:**
- Modify: `src/components/CreateVideoTaskV2.tsx:98-306`

- [ ] **Step 1: Add derived-storyboard state**

Add `segmentsGenerated`; master Prompt remains the only required Prompt input. Reset the boolean when duration or source inputs change.

- [ ] **Step 2: Generate editable storyboard prompts on demand**

Implement a `generatePrompts` handler that fills an empty master Prompt using the current product/source, then fills only missing duration-derived segments. Preserve existing segment edits.

- [ ] **Step 3: Replace the always-visible segment UI**

Show `本次视频 Prompt` first with a `生成提示词` action. Render an open `分镜提示词` details section only after `segmentsGenerated` is true, then retain negative constraints and the confirmation action.

- [ ] **Step 4: Move product facts to the lower-left input column**

Add a display-only product-facts panel after the input cards. It presents name, category, colors, material, and selling points from `ProductAsset.specs`, with an explicit unlinked state.

- [ ] **Step 5: Remove Prompt from the paid-execution request summary**

Remove the `Prompt` request line passed by both image and video task pages. Keep source/reference and parameter lines.

### Task 3: Verify visual and build behavior

**Files:**
- Verify: `src/components/CreateVideoTaskV2.tsx`
- Verify: `src/components/TaskDetailsDrawer.tsx`

- [ ] **Step 1: Run automated checks**

Run: `npm test && npm run lint && npm run build`

Expected: all commands exit with code 0.

- [ ] **Step 2: Run browser verification**

Open the video task and verify only the master Prompt is initially visible; click `生成提示词` and verify the duration-derived editable shots appear. Open a task detail and verify the drawer width is constrained on desktop and fills narrow screens.
