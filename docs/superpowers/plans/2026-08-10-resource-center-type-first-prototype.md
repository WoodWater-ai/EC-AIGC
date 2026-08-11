# Resource Center Ownership-First Prototype Implementation Plan

> **For agentic workers:** Execute this plan inline in the current design repository. Do not modify the production frontend or backend.

**Goal:** Update the V2.5 HTML prototype so resource discovery is split by product/general ownership first, with image/video as a filter, while preserving upload and directory-scan workflows.

**Architecture:** Keep the existing single-file prototype and its query-string state model. Replace only the resource-center CSS, HTML, and JavaScript state handlers; reuse existing mock assets and the current image-task underlay.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Lucide icons, Playwright visual verification.

---

### Task 1: Replace the resource-center information architecture

**Files:**
- Modify: `设计/v2.5-ERP商品创作闭环/ERP商品创作闭环-设计稿.html`

- [x] Use horizontal `产品素材 / 通用素材` as the only top-level tabs.
- [x] Move `图片 / 视频` into the filter rail.
- [x] Remove public/personal as separate navigation; keep `我上传的` as a general-asset filter.
- [x] Keep storage capacity visible at the bottom of the left rail.
- [x] Render product scope as ERP category navigation plus SPU-grouped SKU collection cards.
- [x] Render general scope as a direct asset grid without an empty category tree.
- [x] Keep both `本地上传` and `目录扫描` visible.

### Task 2: Make SKU composition and detail states interactive

**Files:**
- Modify: `设计/v2.5-ERP商品创作闭环/ERP商品创作闭环-设计稿.html`

- [x] Make SKU cards selectable without opening the collection.
- [x] Enable `搭配合成` after at least two SKU cards are selected.
- [x] Render the composition workspace with each SKU's current white-background image, direction controls, preview, and shared-file explanation.
- [x] Keep a separate SKU detail state for selecting an individual image resource.
- [x] Persist `media`, `tab`, and `view` in the URL (`tab=product|general`).

### Task 3: Verify the prototype

**Files:**
- Verify: `设计/v2.5-ERP商品创作闭环/ERP商品创作闭环-设计稿.html`

- [x] Serve `/Users/jay/Documents/GitHub/EC-AIGC` locally.
- [x] Open the default product list, SKU detail, composition, general image, general video, and product video states.
- [x] Confirm there are no functional console errors, blank assets, clipped controls, or overlapping labels at desktop and narrower desktop widths.
- [x] Capture screenshots under `output/playwright/` for review.
