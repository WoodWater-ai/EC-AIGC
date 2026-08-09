# ERP Image Task Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved full-screen ERP image-task workflow to the real-API frontend without changing backend contracts.

**Architecture:** Keep `useCreateImageTaskState` and the existing task submission DTO as the single source of truth. Add pure adapters for canonical style linkage and grouped reference-image roles, then reshape existing modular components around those adapters. A reference image with several UI tags is submitted through the existing role slots by reusing the same asset ID for each selected role.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS 4, Node test runner, Vite 6.

---

### Task 1: Canonical style and reference-role adapters

**Files:**
- Create: `src/lib/createImageTask/imageCreationUi.ts`
- Test: `src/lib/createImageTask/__tests__/imageCreationUi.test.ts`

- [ ] **Step 1: Write failing tests for canonical styles, linkage, and grouped references**

```ts
test('only the nine canonical styles remain visible', () => {
  assert.equal(filterCanonicalStyles(options).length, 9);
});

test('style linkage filters scene and pose options', () => {
  assert.deepEqual(getLinkedOptionCodes('QUIET_LUXURY', 'scene'), ['QUIET_WINDOW', 'LIGHT_HOME', 'DARK_HOME']);
});

test('same asset used in several slots becomes one card with several roles', () => {
  assert.deepEqual(groupReferenceSlots(input)[0].roles, ['model', 'style']);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails because the helper does not exist**

Run: `npx tsx --test src/lib/createImageTask/__tests__/imageCreationUi.test.ts`

Expected: FAIL with module-not-found for `../imageCreationUi`.

- [ ] **Step 3: Implement the pure adapters**

```ts
export const CANONICAL_STYLE_CODES = [
  'SWEET_CREAMY', 'QUIET_LUXURY', 'VINTAGE_HOME', 'EASTERN_MATURE',
  'NEW_CHINESE_MINIMAL', 'DOPAMINE_PLAYFUL', 'DARK_GOTHIC',
  'SWEET_COOL_STREET', 'FRENCH_FEMININE',
] as const;

export function groupReferenceSlots(
  refs: Array<{ slot: ReferenceSlot; ref: ReferenceAsset }>,
): TaggedReference[];
```

- [ ] **Step 4: Re-run the focused test**

Expected: all adapter tests PASS.

### Task 2: Reference images and ERP product facts

**Files:**
- Modify: `src/components/CreateImageTask/left/ReferenceGrid.tsx`
- Modify: `src/components/CreateImageTask/center/ProductFactsEditor.tsx`
- Modify: `src/components/CreateImageTask/CreateImageTask.tsx`

- [ ] **Step 1: Replace five fixed visible slots with grouped reference cards**

The empty state exposes Model and Detail first. Added images render once and expose a five-option multi-select role menu. Role changes call the parent adapter, which updates existing `REFERENCE_*` slots with the same asset ID.

- [ ] **Step 2: Keep ERP identity read-only and add local SEO name**

```tsx
<h3>{erpName || '待匹配 ERP 商品'}</h3>
<p>{erpCategory || '未获取 ERP 分类'}</p>
<input value={seoName} onChange={(event) => onSeoNameChange(event.target.value)} />
```

Only color, material/pattern, fit/structure, selling points, and SEO name are editable. The backend `productFacts` request remains the existing six-field DTO.

- [ ] **Step 3: Wire reference locks**

Derive reference sources from grouped roles. Style, scene, or pose controls become disabled when a corresponding reference exists and display `参考图 N` as the locked value.

### Task 3: Prompt composer and result column

**Files:**
- Modify: `src/components/CreateImageTask/layout/ThreeColumnLayout.tsx`
- Modify: `src/components/CreateImageTask/center/ImageContentSection.tsx`
- Modify: `src/components/CreateImageTask/center/PerTypePromptEditor.tsx`
- Modify: `src/components/CreateImageTask/center/StyleScenePoseRow.tsx`
- Modify: `src/components/CreateImageTask/right/ImageSettingsSection.tsx`
- Create: `src/components/CreateImageTask/right/ImageResultPanel.tsx`
- Modify: `src/components/CreateImageTask/CreateImageTask.tsx`

- [ ] **Step 1: Apply the approved full-screen three-column proportions**

Use `290px minmax(540px, 1fr) 330px` at desktop widths, with independent vertical scrolling per column.

- [ ] **Step 2: Preserve type counts and build one prompt composer**

Keep each selected type's `+/-` quantity control. Prompt textareas remain per type, while style, scene, pose, model, and schema parameters move into the shared footer beneath the textareas.

- [ ] **Step 3: Compact execution settings**

Keep `useTaskParams`, `ParamSchemaForm`, validation, and `onParamsChange`. Remove repeated channel/capability explanation from the visible page; show the effective model and schema controls in the prompt footer.

- [ ] **Step 4: Add the result column**

Render task summary, selected type count, image count, output parameters, and the existing `checkAndGenerate` action. Submission continues through the existing execution-confirmation dialog.

- [ ] **Step 5: Remove the visible advanced negative-constraint section**

Keep the existing negative prompt state and payload default, but do not expose a second advanced-settings management surface.

### Task 4: Verification

**Files:**
- Verify: all files above

- [ ] **Step 1: Run focused and full tests**

Run: `npx tsx --test src/lib/createImageTask/__tests__/imageCreationUi.test.ts`

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Run type checking and production build**

Run: `npm run lint`

Run: `npm run build`

Expected: both commands exit 0.

- [ ] **Step 3: Verify the running page on port 3002**

Check that the page is full-screen, reference tags lock duplicate prompt controls, image-type quantities remain editable, and the page has no horizontal overflow at 1440x900 and 1280x800.

- [ ] **Step 4: Review the diff scope**

Confirm that no backend, environment, package, CI, or video-task files changed. Do not commit automatically.
