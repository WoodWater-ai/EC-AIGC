# Task 5 Report — CreateImageTask 改造(13 state → slotRefs + 7 处 JSX)

## What Was Implemented

Applied all 14 modifications to `CreateImageTask.tsx` in order:

1. **Mod 1** — Updated imports: replaced `AssetTransitModal` import with `TransitPickerButton` + `SlotKey/SlotRef` types; added `useCallback`.
2. **Mod 2** — Replaced lines 31-79: removed `isInternalTransitOpen`, `transitTargetSlot`, all 7 FileResId states, and `handleTransitConfirmSelection`; replaced with `slotRefs` Record + `setSlotRef` callback.
3. **Mod 3** — Removed the 6 boolean slot states (`topClothingUploaded`, `bottomClothingUploaded`, `detailRefUploaded`, `styleRefParsed`, `sceneRefUploaded`, `poseRefUploaded`); kept `hasCompositePreviewed`.
4. **Mod 5** — Updated `handleCompositePreview` validation: replaced `!topClothingUploaded || !bottomClothingUploaded` with `!slotRefs.top || !slotRefs.bottom`.
5. **Mod 6** — Added `slotRefs` to `buildSubmitPayload` call in `handleSubmitTask`.
6. **Mod 7** — Replaced main image upload JSX with `TransitPickerButton` (slot="main").
7. **Mod 8** — Replaced top clothing slot JSX with `TransitPickerButton` (slot="top").
8. **Mod 9** — Replaced bottom clothing slot JSX with `TransitPickerButton` (slot="bottom").
9. **Mod 10** — Replaced detail slot JSX with `TransitPickerButton` (slot="detail").
10. **Mod 11** — Replaced style slot JSX with `TransitPickerButton` (slot="style").
11. **Mod 12** — Replaced scene slot JSX with `TransitPickerButton` (slot="scene").
12. **Mod 13** — Replaced pose slot JSX with `TransitPickerButton` (slot="pose").
13. **Mod 14** — Removed the bottom `{isInternalTransitOpen && (<AssetTransitModal .../>)}` block entirely.

## Test Results

- **Lint (CreateImageTask.tsx)**: PASS — 0 errors in CreateImageTask.tsx
- **buildSubmitPayload tests**: 7/7 PASS

## Grep Evidence

- **Old state names removed**: grep for `mainFileResId|topClothingFileResId|bottomClothingFileResId|detailFileResId|styleFileResId|sceneFileResId|poseFileResId|topClothingUploaded|bottomClothingUploaded|detailRefUploaded|styleRefParsed|sceneRefUploaded|poseRefUploaded|isInternalTransitOpen|transitTargetSlot|handleTransitConfirmSelection` → **0 matches**
- **TransitPickerButton instances**: grep for `slot="(main|top|bottom|detail|style|scene|pose)"` → **7 matches** (main, top, bottom, detail, style, scene, pose)

## Files Modified

- `EC-AIGC/src/components/CreateImageTask.tsx` — all 14 modifications applied

## Self-Review Findings

- All 14 modifications applied in correct order
- `handleCompositePreview` correctly uses `slotRefs.top / .bottom` for validation
- `handleSubmitTask` correctly passes `slotRefs` to `buildSubmitPayload`
- `AssetTransitModal` import and instance fully removed
- `isInternalTransitOpen` / `transitTargetSlot` / `handleTransitConfirmSelection` all gone
- `hasCompositePreviewed` correctly preserved (separate from the 6 slot booleans)
- Visual slot behavior preserved — outer dashed-border containers retained with `TransitPickerButton` providing the click interaction internally
- Pre-existing lint errors in other files (`capability.ts`, `RecommendParamsManageNew.tsx`, `CreateVideoTask.tsx`, `SystemConfig.tsx`) are unrelated to this task

## Pre-Existing Lint Errors (Unrelated to This Task)

The following errors existed before this task and were NOT introduced or fixed by Task 5:
- `src/api/modules/capability.ts(111,5)` — `queryKey` property issue
- `src/components/beta/RecommendParamsManageNew.tsx(77,28)` — `reload` property issue
- `src/components/beta/RecommendParamsManageNew.tsx(224,9)` — type mismatch
- `src/components/CreateVideoTask.tsx(171,40)` — `slotRefs` missing in payload (suggests CreateVideoTask also needs Task 5 treatment, outside scope)
- `src/components/SystemConfig.tsx(143,18)` — `ModelChannelQueryRequest` not found

## Concerns

None. All 14 modifications applied cleanly, tests pass, and verification checks confirm correctness.
