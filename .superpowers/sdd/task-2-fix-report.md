# Task 2 Fix Report

## Summary

Reverted scope violations where Task 2 implementer incorrectly added `slotRefs` to files outside their scope.

## What Was Reverted

Removed the following line from both files (the last property in `buildSubmitPayload({...})`):

```ts
slotRefs: { main: null, top: null, bottom: null, detail: null, style: null, scene: null, pose: null },
```

## Files Modified

| File | Line Removed | Reason |
|------|-------------|--------|
| `EC-AIGC/src/components/CreateImageTask.tsx` | ~208 | Task 5's scope — Task 2 should not have modified this |
| `EC-AIGC/src/components/CreateVideoTask.tsx` | ~187 | Explicitly out of scope per spec §10 ("CreateVideoTask 的同名 slot 重构...等 CreateImageTask 落地后再迁移") |

## Unchanged Files

- `EC-AIGC/src/components/createTask/buildSubmitPayload.ts` — NOT modified (correct)
- `EC-AIGC/src/components/createTask/buildSubmitPayload.test.ts` — NOT modified (correct)

## Expected State After Fix

Both `CreateImageTask.tsx` and `CreateVideoTask.tsx` now have incomplete `buildSubmitPayload()` calls — TypeScript will error on the missing `slotRefs` field. This is **intentional** and will be resolved by Task 5, which owns the CreateImageTask slotRef implementation (and by extension, the CreateVideoTask migration per spec §10).
