# Video Task Multiframe Rule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the real video-task frontend and backend with the approved four-mode workflow, and make the server the authority for smart-multiframe prompt assembly.

**Architecture:** Keep the existing `CreateVideoTask`, `MultiFrameTimeline`, `TaskParamsPanel`, and Vidu multiframe invocation pipeline. The browser submits only user-authored segment changes plus an optional global instruction; `GenerationTaskServiceImpl` compiles shared product, continuity, safety, and negative constraints into every persisted segment prompt before dispatch.

**Tech Stack:** React, TypeScript, Tailwind CSS, Spring Boot, Java, Fastjson2, Maven.

---

### Task 1: Add the explicit multiframe instruction contract

**Files:**
- Modify: `src/types.ts`
- Modify: `/Users/jay/Documents/GitHub/dafenqi/dafenqi-ai/src/main/java/com/dafenqi/ai/web/model/request/task/VideoTaskSubmitRequest.java`

- [x] Add optional `globalInstruction?: string` beside `negativePrompt` to the browser submission type.
- [x] Add optional `globalInstruction` to `VideoTaskSubmitRequest`, constrained to 1,000 characters, without changing persistence or database schema.

### Task 2: Update the video task UI without changing its asset or product flow

**Files:**
- Modify: `src/components/CreateVideoTask.tsx`

- [x] Render two mode groups in the existing top navigation: image-to-video (`FIRST_FRAME`, `MULTI_FRAME`) and video replication (`TRENDING_REPLICATE`, `ECOMMERCE_REPLICATE`).
- [x] Preserve the existing shared product picker and mode-specific assets when switching modes.
- [x] For `MULTI_FRAME`, render model parameters above the timeline, state that common constraints are server-applied, and expose a collapsed optional `补充全局要求` textarea (500 characters).
- [x] Submit that value only for `MULTI_FRAME`; submit the required non-prompt task summary for that mode so the browser never becomes the authority for default prompt text.
- [x] Keep first-frame and replication prompts free of style/scene/pose tags and retain the existing `TaskParamsPanel` configuration path.

### Task 3: Compile multiframe prompts on the server and persist the effective snapshot

**Files:**
- Modify: `/Users/jay/Documents/GitHub/dafenqi/dafenqi-ai/src/main/java/com/dafenqi/ai/service/task/impl/GenerationTaskServiceImpl.java`
- Create: `/Users/jay/Documents/GitHub/dafenqi/dafenqi-ai/src/test/java/com/dafenqi/ai/service/task/impl/GenerationTaskServiceImplMultiFramePromptTest.java`

- [x] Build one server-owned shared multiframe constraint block from product facts, keyframe continuity, product fidelity, safety, normalized negative constraints, and optional global instruction.
- [x] Set `GenerationTaskDO.taskPrompt` from the server-owned block and append it to each ordered segment prompt together with that segment's change description.
- [x] Store those final segment prompts in existing `taskParamsJson.multi_frame_segments`; retain the existing worker and Vidu invocation contract unchanged.
- [x] Reject a multiframe request only if its final compiled segment prompt exceeds the existing 5,000-character limit.
- [x] Add focused coverage for supplied and blank segment instructions, including a single occurrence of the user global instruction.

### Task 4: Verify

**Files:**
- Verify: `EC-AIGCweb/src/components/CreateVideoTask.tsx`
- Verify: `dafenqi-ai/src/main/java/com/dafenqi/ai/service/task/impl/GenerationTaskServiceImpl.java`

- [x] Run `npm run lint` and `npm run build` in `EC-AIGCweb`.
- [x] Run targeted and full `mvn test` in `dafenqi-ai`.
- [x] Verify both local services respond (`3002` / `8090`) and the browser loads the frontend. Full task-page interaction remains subject to the existing login session.
