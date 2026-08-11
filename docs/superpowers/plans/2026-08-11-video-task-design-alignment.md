# Video Task Design Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the real video task page with the approved video design's three-column information hierarchy while retaining real product, asset, parameter, and submit behavior.

**Architecture:** Keep `CreateVideoTask` as the state owner and preserve `ProductPickerCard`, `AssetTransitModal`, `TaskParamsPanel`, and `MultiFrameTimeline`. Move mode selection into the central creation flow, add a read-only interactive summary of multiframe inputs on the left, and replace the always-expanded parameter form with compact model chips that disclose the existing form on demand.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vite.

---

### Task 1: Restore the design's creation-flow hierarchy

**Files:**
- Modify: `src/components/CreateVideoTask.tsx`

- [x] Remove the page-level mode navigation and add the grouped four-mode selector as the first central panel.
- [x] Keep `switchMode` and all current mode-specific assets unchanged, so changing mode never clears the selected product or incompatible drafts unexpectedly.
- [x] Keep the right panel as the real pre-submit state instead of copying the design prototype's completed-result mock.

### Task 2: Align multiframe and prompt panels

**Files:**
- Modify: `src/components/CreateVideoTask.tsx`

- [x] Add a multiframe left-column input summary showing the selected START image and ordered keyframes, with the existing picker/timeline remaining the editing authority.
- [x] Render the multiframe global-rule explanation, optional global instruction, and model configuration together before the timeline.
- [x] Render compact model, duration, resolution, ratio, and audio chips under ordinary prompts; disclose the unchanged `TaskParamsPanel` only when configuration must be edited.
- [x] Update first-frame prompt guidance to request movement, camera, timing, and product fidelity rather than image visual tags.

### Task 3: Verify visual structure and build

**Files:**
- Verify: `src/components/CreateVideoTask.tsx`

- [x] Run `npm run lint` and `npm run build` from `EC-AIGCweb`.
- [x] Load the approved design file and verify the local frontend responds at `3002`; the existing login boundary remains the only block to browser automation of the authenticated task route.
