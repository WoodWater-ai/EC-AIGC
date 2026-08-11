# Resource Center Scope And Model Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the V2.5 PRD, static HTML prototype, and production React frontend so the resource center uses product, general, and model scopes; defaults general assets to personal visibility; supports product/model conversion where existing APIs allow it; and renders a compact 9:16 SKU grid.

**Architecture:** Keep the existing single-file HTML prototype, query-string state model, mock assets, and vanilla JavaScript handlers. Update the formal PRD first, validate the resource-center and system-config prototype, then apply the approved interaction and layout to the existing `AssetTransitModal` React component. Reuse current resource, product-library, and model-profile APIs; do not modify the backend, database schema, environment files, or production configuration. Do not ship a client-only system setting when no persistence API exists.

**Tech Stack:** Markdown, static HTML, CSS, vanilla JavaScript, React 19, TypeScript, Tailwind CSS 4, Lucide icons, Agent Browser visual verification.

**Project Rule:** Do not commit automatically. The repository `AGENTS.md` requires the user to perform commits manually.

---

### Task 1: Replace Obsolete Resource Rules In The V2.5 PRD

**Files:**
- Modify: `docs/product/PRD-V2.5.md`
- Reference: `docs/superpowers/specs/2026-08-11-resource-center-scope-model-design.md`

- [x] **Step 1: Replace scope statements in the overview and scope table**

Replace every statement that defines `产品素材、公共素材、我的素材` with the approved three scopes:

```markdown
- 图片任务资源中心弹窗提供“产品素材、通用素材、模特素材”三个横向入口。

| 资源中心弹窗 | 产品素材、通用素材、模特素材 | 在图片任务内选择、上传或转换素材 | 维护商品主数据、ERP 分类和完整模特档案 |
```

Keep the boundary that the resource center is a task-scoped picker, not a new standalone navigation module.

- [x] **Step 2: Rewrite section 6.8.1 scope and visibility rules**

Use this normative content:

```markdown
弹窗一级入口：

- `产品素材`：关联唯一 SKU，始终在团队内共享。
- `通用素材`：未关联 SKU，可见范围由系统配置决定，默认仅本人可见。
- `模特素材`：复用独立模特库的数据、发布状态和权限，只在资源弹窗提供选择入口。

系统配置增加“通用素材可见范围”，枚举为 `个人 / 团队`，默认 `个人`。切换为团队后，工作空间成员可查看团队范围内的通用素材；切回个人后按上传人隔离。产品素材始终团队共享，不受该开关影响。资源中心只读取配置结果，不在弹窗内修改配置。
```

Delete the paragraph that requires separate public and personal category/list states.

- [x] **Step 3: Rewrite SKU list, filters, and conversion rules**

Add these exact requirements under the SKU product list and general asset sections:

```markdown
- SKU 封面使用当前白底图，比例 9:16；宽屏每行 5 个，较窄桌面每行 4 个。
- 多规格 SPU 显示轻量分组标题，同 SPU 的 SKU 连续排列；单规格商品直接进入 SKU 网格。
- 产品素材一级筛选只保留“全部、最近使用”。
- 通用素材一级筛选只保留“全部、最近使用”。
- 通用素材按风格、场景、细节、姿势筛选：风格、场景、姿势支持树形子标签多选；细节当前没有子标签，使用扁平多选。
- 通用素材执行“设为产品素材”时必须选择一个有效 ERP SKU；成功后素材从通用素材移出并进入对应产品素材集合，底层文件不复制。
- 通用图片执行“设为模特”时沿用线上默认名称、标签、适用范围和确认流程，不新增性别、年龄或脸部锚点表单；成功后从通用素材移出并进入模特素材。
```

- [x] **Step 4: Update API requirements, risks, acceptance cases, and version registration**

Replace obsolete visibility/API lines with:

```markdown
- 通用素材可见范围配置查询与更新接口，默认值为个人。
- 通用素材转产品的 ERP SKU 选择、唯一 `productId` 更新和原子归集语义。
- 通用图片转模特的导入状态与通用素材列表移除语义。
```

Add these acceptance cases and update the version registration summary to name the three new scopes:

```markdown
- GIVEN 通用素材范围保持默认个人，WHEN 用户打开通用素材，THEN 只显示本人未关联产品的素材，不显示团队成员筛选。
- GIVEN 管理员把通用素材范围设为团队，WHEN 工作空间成员打开通用素材，THEN 可查看团队范围素材，产品素材共享规则不变。
- GIVEN 用户展开风格、场景或姿势筛选，WHEN 选择多个子标签，THEN 同维度按 OR、跨维度按 AND 筛选；细节只显示扁平多选项。
- GIVEN 用户对通用素材执行“设为产品素材”，WHEN 选择并确认一个有效 ERP SKU，THEN 素材移出通用素材并进入该 SKU 的产品素材，文件不复制。
- GIVEN 用户对本人通用图片执行“设为模特”，WHEN 确认转换，THEN 不要求补充档案字段，素材移出通用素材并进入模特素材。
- GIVEN 当前素材为视频，WHEN 用户查看可用操作，THEN 不显示或禁用“设为模特”。
- GIVEN 视口为 1440×900，WHEN 产品列表加载，THEN 9:16 SKU 卡片每行显示 5 个；视口为 1280×720 时每行显示 4 个。
```

- [x] **Step 5: Verify that obsolete terminology is gone**

Run:

```bash
rg -n "产品素材、公共素材、我的素材|公共/个人素材|公共素材或我的素材" docs/product/PRD-V2.5.md
```

Expected: no output.

Run:

```bash
rg -n "通用素材可见范围|设为产品素材|设为模特|细节.*没有子标签|9:16" docs/product/PRD-V2.5.md
```

Expected: each approved rule appears at least once in the relevant solution and acceptance sections.

### Task 2: Add The General Asset Visibility Setting To The Prototype

**Files:**
- Modify: `设计/v2.5-ERP商品创作闭环/ERP商品创作闭环-设计稿.html`

- [x] **Step 1: Make the existing system-config navigation item open a prototype page**

Change the sidebar item and prototype switcher to include `data-go="config"`:

```html
<button class="menu-item" data-go="config"><i data-lucide="settings"></i>系统配置模块</button>
<button data-go="config">系统配置</button>
```

Add `config` to `pageNames`:

```js
const pageNames = {
  products: '产品管理',
  library: '商品素材库',
  resource: '资源中心弹窗',
  image: '图片创作',
  video: '视频创作',
  config: '系统配置',
};
```

- [x] **Step 2: Add a focused system-config page**

Insert this page before the resource-center page:

```html
<main class="page" data-page="config">
  <div class="page-inner config-page">
    <div class="page-head">
      <div><h1>系统配置</h1><p>工作空间级规则，仅管理员可修改</p></div>
    </div>
    <section class="config-section">
      <div class="config-section-head">
        <div><h2>资源中心</h2><p>控制未关联产品的通用素材可见范围</p></div>
      </div>
      <div class="config-row">
        <div><strong>通用素材可见范围</strong><small>产品素材始终团队共享，不受此设置影响</small></div>
        <div class="config-segmented" data-general-scope>
          <button class="active" data-general-scope-value="personal">个人</button>
          <button data-general-scope-value="team">团队</button>
        </div>
      </div>
    </section>
  </div>
</main>
```

- [x] **Step 3: Add stable styles and a small interactive state**

Add:

```css
.config-page { max-width: 980px; }
.config-section { overflow: hidden; border: 1px solid var(--border); border-radius: 7px; background: white; }
.config-section-head { padding: 18px 20px; border-bottom: 1px solid var(--border); }
.config-section-head h2 { margin: 0; font-size: 16px; }
.config-section-head p { margin: 5px 0 0; color: var(--muted); font-size: 11px; }
.config-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 20px; }
.config-row strong { display: block; font-size: 13px; }
.config-row small { display: block; margin-top: 5px; color: var(--muted); font-size: 10px; }
.config-segmented { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; padding: 3px; border: 1px solid var(--border); border-radius: 6px; background: #f2efeb; }
.config-segmented button { width: 88px; height: 34px; border: 0; border-radius: 4px; color: var(--muted); background: transparent; font-size: 11px; font-weight: 800; }
.config-segmented button.active { color: var(--text); background: white; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
```

Add this state before the global click handler:

```js
let generalAssetScope = 'personal';

function setGeneralAssetScope(scope) {
  generalAssetScope = scope === 'team' ? 'team' : 'personal';
  document.querySelectorAll('[data-general-scope-value]').forEach((button) => {
    button.classList.toggle('active', button.dataset.generalScopeValue === generalAssetScope);
  });
  const copy = document.querySelector('[data-general-scope-copy]');
  if (copy) copy.textContent = generalAssetScope === 'team'
    ? '显示团队未关联产品的通用素材。'
    : '仅显示我上传或生成、且尚未关联产品的素材。';
}
```

Handle `[data-general-scope-value]` clicks by calling `setGeneralAssetScope(button.dataset.generalScopeValue)`. Initialize with `setGeneralAssetScope('personal')`.

- [x] **Step 4: Verify the config state**

Open:

```text
http://127.0.0.1:4173/设计/v2.5-ERP商品创作闭环/ERP商品创作闭环-设计稿.html?page=config
```

Expected: `个人` is selected by default; clicking `团队` changes the active segment without reloading or modifying production configuration.

### Task 3: Rebuild The Product SKU Grid And Primary Filters

**Files:**
- Modify: `设计/v2.5-ERP商品创作闭环/ERP商品创作闭环-设计稿.html`

- [x] **Step 1: Add the model scope to the top tabs**

Use this tab markup:

```html
<div class="resource-scope-tabs" role="tablist" aria-label="素材归属">
  <button class="active" role="tab" data-resource-tab="product"><i data-lucide="package"></i>产品素材 <span class="count">248</span></button>
  <button role="tab" data-resource-tab="general"><i data-lucide="shapes"></i>通用素材 <span class="count">31</span></button>
  <button role="tab" data-resource-tab="model"><i data-lucide="user-round"></i>模特素材 <span class="count">12</span></button>
</div>
```

Update `setResourceTab()` so the allowed values are `product`, `general`, and `model`. Force `currentResourceMedia = 'image'` for the model tab and hide the media filter there.

- [x] **Step 2: Reduce product primary filters**

Replace the product filter chips with:

```html
<div class="filter-chips">
  <button class="active">全部</button>
  <button>最近使用</button>
</div>
```

Keep ERP category, media type, search, sort, product upload, directory scan, and composition controls outside this chip group.

- [x] **Step 3: Convert SKU cards to a 9:16, 5/4-column layout**

Use these layout constraints:

```css
.sku-collection-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.sku-cover { height: auto; aspect-ratio: 9 / 16; }
.sku-cover img { object-fit: contain; }
@media (max-width: 1260px) {
  .sku-collection-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
```

Keep the current larger typography and standard `查看素材` button. Do not restore 7-9px action text.

- [x] **Step 4: Make single-spec products compact**

Render multi-spec SPUs with a header and contiguous cards. Add one `单规格商品` grid containing independent SKU cards without one header per product. Preserve the existing shoe placeholder and add at least three more mock single-spec SKU cards using existing assets so the 5-column behavior is visible.

- [x] **Step 5: Verify product selection behavior**

At `1440x900`, confirm five cards fit in a row. At `1280x720`, confirm four cards fit in a row. Select one SKU and verify upload/scan enable; select a second SKU and verify composition enables while upload/scan disable.

### Task 4: Add General Asset Tag Filters And Conversion Flow

**Files:**
- Modify: `设计/v2.5-ERP商品创作闭环/ERP商品创作闭环-设计稿.html`

- [x] **Step 1: Remove team-member material from the default state**

Use personal-scope copy and remove the team-member filter and mock assets:

```html
<p class="resource-scope-note" data-general-scope-copy>仅显示我上传或生成、且尚未关联产品的素材。</p>
```

The default general list must not display another uploader's name.

- [x] **Step 2: Reduce general primary filters and add four dropdowns**

Use:

```html
<div class="filter-chips">
  <button class="active">全部</button>
  <button>最近使用</button>
</div>
<div class="resource-dimension-filters">
  <button data-resource-dimension="style">风格 <span data-dimension-count="style"></span><i data-lucide="chevron-down"></i></button>
  <button data-resource-dimension="scene">场景 <span data-dimension-count="scene"></span><i data-lucide="chevron-down"></i></button>
  <button data-resource-dimension="detail">细节 <span data-dimension-count="detail"></span><i data-lucide="chevron-down"></i></button>
  <button data-resource-dimension="pose">姿势 <span data-dimension-count="pose"></span><i data-lucide="chevron-down"></i></button>
  <div class="resource-dimension-menu" data-dimension-menu></div>
</div>
```

Use this option shape and state:

```js
const resourceDimensionOptions = {
  style: [
    { label: '甜美', children: ['奶油甜妹卧室', '法式浪漫精致'] },
    { label: '质感', children: ['静奢深睡品质感', '复古田园居家', '东方雅致轻熟'] },
    { label: '个性', children: ['甜酷街头感', '暗黑哥特氛围', '多巴胺俏皮', '新中式极简'] },
  ],
  scene: [
    { label: '室内', children: ['奶油卧室', '窗边安静居家', '浅色现代家居', '深色质感家居'] },
    { label: '室外', children: ['新中式庭院', '复古木质庭院'] },
  ],
  detail: ['领口', '袖口', '面料', '图案', '纽扣'],
  pose: [
    { label: '站姿', children: ['自然站姿', '三分之二侧身', '窗边行走'] },
    { label: '坐姿与动作', children: ['床边坐姿', '回眸', '整理袖口'] },
  ],
};

const selectedResourceDimensions = {
  style: new Set(), scene: new Set(), detail: new Set(), pose: new Set(),
};
```

For `detail`, render one checkbox row per string. For the other three dimensions, render a group label followed by child checkbox rows. Checkbox clicks toggle the matching Set and update `[data-dimension-count]` to `已选 N` or an empty string.

- [x] **Step 3: Add selection-bound transformation actions**

In the general image footer, show these actions when exactly one eligible image is selected:

```html
<button class="btn" data-set-product><i data-lucide="package-plus"></i>设为产品素材</button>
<button class="btn" data-set-model><i data-lucide="user-round-plus"></i>设为模特</button>
```

Hide `设为模特` for video. Disable both actions when no asset or more than one asset is selected. Preserve `确认使用` for picker mode.

- [x] **Step 4: Add the ERP SKU picker overlay**

Create an in-modal overlay with search, ERP category filter, 9:16 SKU cards, single selection, cancel, and confirm. Use these exact state attributes:

```html
<div class="resource-flow-overlay" data-resource-flow="product" hidden>
  <section class="resource-flow-dialog">
    <header><h3>选择关联产品</h3><button data-resource-flow-close><i data-lucide="x"></i></button></header>
    <div class="resource-flow-search"><input class="control" placeholder="搜索 ERP 商品名称、SPU 或 SKU"></div>
    <div class="resource-flow-skus">
      <button class="resource-flow-sku" data-flow-sku="TEST1-GRN-M">
        <img src="../../dist/mock-assets/source/green-pajama-top.jpg" alt="">
        <strong>青柠格纹家居服上衣</strong>
        <small>绿色 / M · TEST1-GRN-M</small>
      </button>
      <button class="resource-flow-sku" data-flow-sku="PANTS-L">
        <img src="../../dist/mock-assets/source/green-pajama-pants.jpg" alt="">
        <strong>青柠格纹家居长裤</strong>
        <small>绿色 / L · PANTS-L</small>
      </button>
    </div>
    <footer><span>一个素材只能关联一个 SKU</span><button class="btn" data-resource-flow-close>取消</button><button class="btn primary" data-product-convert-confirm disabled>确认关联</button></footer>
  </section>
</div>
```

After selecting a SKU and confirming, close the overlay, clear the selected general asset, and display `已移入 SKU TEST1-GRN-M 的产品素材` in `[data-resource-status]`.

- [x] **Step 5: Add model conversion confirmation**

Use a confirmation overlay with this content and no extra form fields:

```html
<h3>设为模特</h3>
<p>素材将移入模特素材，名称默认使用当前素材名称。后续可在模特库编辑档案。</p>
<button class="btn" data-resource-flow-close>取消</button>
<button class="btn primary" data-model-convert-confirm>确认移入</button>
```

On confirmation, clear selection and show `已移入模特素材` in the footer status.

### Task 5: Add The Model Material Tab

**Files:**
- Modify: `设计/v2.5-ERP商品创作闭环/ERP商品创作闭环-设计稿.html`

- [x] **Step 1: Add model-side filters and panel**

Add `data-resource-side-panel="model"` with `全部模特、已发布、草稿` filters. Add this panel and repeat the card pattern with `model-sweet.jpg`, `model-pure.jpg`, and `pose-tryon.jpg`:

```html
<div data-resource-tab-panel="model" hidden>
  <div class="resource-workspace-head">
    <div><h3>模特素材</h3><p>选择已发布模特；档案维护仍在模特库完成</p></div>
    <button class="btn"><i data-lucide="external-link"></i>打开模特库</button>
  </div>
  <div class="resource-workspace-scroll">
    <div class="resource-asset-grid-v3 model-grid">
      <article class="resource-asset" data-resource-select>
        <div class="resource-asset-visual"><img src="../../dist/mock-assets/reference/model-senior.jpg" alt=""></div>
        <div class="resource-asset-body"><strong>知性成熟模特</strong><small>已发布 · 适合主图与场景图</small><div class="resource-asset-tags"><span>成熟</span><span>自然</span></div></div>
      </article>
    </div>
  </div>
</div>
```

- [x] **Step 2: Preserve model library boundaries in the UI**

The model panel header must provide `打开模特库` rather than inline profile editing:

```html
<div class="resource-workspace-head">
  <div><h3>模特素材</h3><p>选择已发布模特；档案维护仍在模特库完成</p></div>
  <button class="btn"><i data-lucide="external-link"></i>打开模特库</button>
</div>
```

Do not add gender, age, face anchor, or rights declaration forms to the resource center.

- [x] **Step 3: Update footer selection semantics**

When the model tab is active, count selected model cards, show `已选择 N 个模特素材`, and enable `确认使用`. Product composition and product conversion actions must remain hidden.

### Task 6: Verify Every Approved Prototype State

**Files:**
- Verify: `设计/v2.5-ERP商品创作闭环/ERP商品创作闭环-设计稿.html`
- Capture: `output/resource-center-v6/*.png`

- [x] **Step 1: Start or reuse the local static server**

Serve `/Users/jay/Documents/GitHub/EC-AIGC` on an available local port. Reuse `4173` if it is already serving the directory.

- [x] **Step 2: Verify required URL states with Agent Browser**

Open and capture:

```text
?page=config
?page=resource&tab=product&media=image&view=products
?page=resource&tab=product&media=image&view=combine
?page=resource&tab=general&media=image&view=products
?page=resource&tab=general&media=video&view=products
?page=resource&tab=model&media=image&view=products
```

Expected: no blank panels, no console errors, and correct tab/filter states.

- [x] **Step 3: Verify conversion interactions**

Select one general image, open the ERP SKU picker, choose one SKU, and confirm. Reopen general image state, select one image, open model confirmation, and confirm. Verify the visible status messages and cleared selections.

- [x] **Step 4: Verify responsive layout**

Capture product, general, model, and config states at `1440x900` and `1280x720`. Confirm:

- Product grid uses five and four columns respectively.
- 9:16 cards do not overlap group headers or the footer.
- Tag dropdown text and checkboxes fit within the dialog.
- Conversion overlays fit inside the resource modal.
- All action buttons retain at least 10px text and stable height.

- [x] **Step 5: Run final terminology and status checks**

Run:

```bash
rg -n "公共素材|我的素材|ERP 分类只读|唯一分类" 设计/v2.5-ERP商品创作闭环/ERP商品创作闭环-设计稿.html docs/product/PRD-V2.5.md
```

Expected: no obsolete resource-center terminology.

Run:

```bash
git status --short -- docs/product/PRD-V2.5.md docs/superpowers/specs/2026-08-11-resource-center-scope-model-design.md docs/superpowers/plans/2026-08-11-resource-center-scope-model-prototype.md 设计/v2.5-ERP商品创作闭环/ERP商品创作闭环-设计稿.html output/resource-center-v6
```

Expected: only the approved documentation, prototype, and verification artifacts appear; do not commit automatically.

### Task 7: Apply The Approved Layout To The Production Frontend

**Files:**
- Modify: `/Users/jay/Documents/GitHub/dafenqi/EC-AIGCweb/src/components/AssetTransitModal.tsx`
- Modify: `/Users/jay/Documents/GitHub/dafenqi/EC-AIGCweb/src/components/CreateImageTask/CreateImageTask.tsx`

- [x] **Step 1: Update resource ownership navigation and defaults**

Use `产品素材 / 通用素材 / 模特素材` in that order. The management entry and the image-task non-model picker default to product materials; unrelated business pickers keep their existing upload-material default.

- [x] **Step 2: Add the SKU-first product view**

Reuse the product-info and product-library APIs. Render 9:16 SKU cards, keep SKUs from the same SPU together, keep single-spec products compact, add ERP category filtering, and preserve upload and directory scan for one selected SKU.

- [x] **Step 3: Reduce general-material filters and preserve current operations**

Keep `全部 / 最近使用`, add the four approved tag dimensions, default to the signed-in user's unbound resources, remove model-library resources from the general list, and preserve upload, directory scan, move, delete, image merge, and set-as-model operations.

- [x] **Step 4: Keep the model library as the source of model material**

Load published model profiles through the existing model-profile API and keep profile creation and editing outside the resource center.

- [x] **Step 5: Verify the production frontend**

Run `npm run lint`, `npm test`, and `npm run build` from `/Users/jay/Documents/GitHub/dafenqi/EC-AIGCweb`.

Result: TypeScript passed, 79 tests passed, and the Vite production build passed. The authenticated resource-center view could not be manually exercised because both isolated and in-app browser sessions opened the login page; no credentials or authentication state were read or changed.

### Task 8: Complete Required Backend Contracts

These items remain open because the approved frontend-only scope forbids fake client-side persistence or backend changes.

- [ ] Expose a current-user/team query scope for general materials so personal mode is filtered before pagination.
- [ ] Add persisted `个人 / 团队` resource-scope configuration APIs for the system-config page.
- [ ] Expose an atomic general-material-to-product binding API with one valid ERP SKU.
- [ ] Add the multi-SKU material-reference contract used after outfit composition; the file must be stored once and referenced by every participating SKU.
- [ ] Add server-supported product recent-use and ERP category pagination/filtering for large product libraries.
