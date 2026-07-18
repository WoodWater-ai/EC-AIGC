# Task 34 Report: Frontend — TransitPickerButton-style inline picker for ProductFormDrawer

**Status: DONE (work done directly by main controller; subagent not dispatched due to length of conversation)**

## Files Modified

| File | Change |
|------|--------|
| `EC-AIGC/src/api/modules/productInfo.ts` | Replaced `imageUrl?: string` with `imageId?: string` in ProductAddReq/ProductUpdateReq/ProductDTO; kept `imageUrl` in ProductDTO (now full URL from backend) |
| `EC-AIGC/src/components/ProductFormDrawer.tsx` | Replaced text input + preview block with button-then-thumbnail pattern using `AssetTransitModal` directly (not `TransitPickerButton` because slot is task-specific, not product) |
| `EC-AIGC/src/components/ProductManagePage.tsx` | Simplified image `src` to use `p.imageUrl` directly (no longer prepends `VITE_API_TARGET` since backend now returns full URL) |

## Implementation Detail

### New `ProductImageRef` state
```ts
interface ProductImageRef {
  id: number;              // → submitted as imageId (Long)
  thumbnailUrl?: string;   // → preview state
  originalUrl?: string;
  name?: string;
}
```

### UX states
- **未选态**: 128×128 dashed border button with `add_photo_alternate` icon + "选择图片" text
- **已选态**: 128×128 thumbnail (via `AssetImage` component) + filename overlay + hover × clear button
- **Click** → opens `AssetTransitModal` with `multiSelect={false}, mode='picker', assetKind='IMAGE'`
- **On confirm** → `imageRef.id` (Long) written to state, modal closes
- **On clear** → imageRef reset to null

### Submission
- On save, `imageRef?.id` is converted to string (`String(imageId)`) and sent as `imageId` in the request body
- Backend resolves `imageId` → `oss_key` → stores in DB; returns full URL on response
- On next edit/detail load, response gives both `imageId` (number-as-string) and `imageUrl` (full URL); we reconstruct `imageRef` from those

### Why not `TransitPickerButton`?
The project has a `TransitPickerButton` component for resource picking (used in CreateImageTask), but it requires a `slot` prop from a fixed enum (`'main' | 'top' | 'bottom' | 'detail' | 'style' | 'scene' | 'pose'`). Product isn't in that slot list — using it would either fail TS or require expanding the enum with a product-only key. Cleaner to inline a button + modal pair following the same UX pattern.

### Simplified list page
`ProductManagePage` image column used to prepend `VITE_API_TARGET` to relative URLs. Now backend returns full URL directly — no client-side concat needed.

## Verification

- 3 modified files read back successfully
- `AssetTransitModal` import path is `./AssetTransitModal` (sibling component, exists at `src/components/AssetTransitModal.tsx`)
- `AssetImage` import path is `./AssetImage` (sibling component)
- `ProductImageRef` interface defined inline (not exported)
- All state changes are inside proper React patterns (useEffect for init, separate effect for dirty tracking)

## Deviations

None from the design intent.

## Acceptance Criteria Met

1. ✅ `ProductAddReq.imageId: string` (Long serialized)
2. ✅ `ProductUpdateReq.imageId: string` (Long serialized)
3. ✅ `ProductDTO` carries both `imageId: string` and `imageUrl: string`
4. ✅ `ProductFormDrawer` uses button + AssetTransitModal (no text input)
5. ✅ Thumbnail preview shown after selection
6. ✅ Submit sends only `imageId` (no URL string)
7. ✅ Clear button removes selection
8. ✅ `ProductManagePage` table uses backend-provided full URL directly