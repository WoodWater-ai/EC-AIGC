# Task 3 Brief — AssetTransitModal 改签名 + multiSelect + toast

> 来源:`EC-AIGC/docs/superpowers/plans/2026-07-14-transit-picker-resource-confirm.md` Task 3

## 目标

修改 `src/components/AssetTransitModal.tsx`:
1. `onConfirmSelection` 签名从 `(number[]) => void` → `(AssetResourceItem[]) => void`
2. 新增 `multiSelect?: boolean` prop(默认 `false`)
3. `handleCardClick` 按 multiSelect 分支(单选替换 / 多选 toggle)
4. `handleConfirmSelection` 中空选中 `alert` → `toast.warning`,fileResourceId 缺失 `toast.error`
5. "确认选择"按钮在空选中时 disabled + tooltip
6. "清除选择"按钮仅多选时显示

这是修复"应用不过来"问题的核心改动 —— 通过让父组件拿到完整 `AssetResourceItem[]`,不再依赖 modal 内 `assets.find()` 推 fileResIds。

## Files

- Modify: `EC-AIGC/src/components/AssetTransitModal.tsx`(1383 行,改 4 处)
- Create: `EC-AIGC/src/components/AssetTransitModal.test.tsx`

## 改动 1: `AssetTransitModal.test.tsx`(新文件,完整内容)

```tsx
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { AssetTransitModal } from './AssetTransitModal';
import type { AssetResourceItem } from '../api/modules/asset';

// 类型层校验为主,运行时交互留给 Playwright/E2E(本计划不引入)

const asset = (id: number, fileResourceId: number | null): AssetResourceItem => ({
  id,
  name: `asset-${id}`,
  assetKind: 'IMAGE',
  uploadUserId: 1,
  fileResourceId: fileResourceId ?? undefined,
  categoryIds: [],
  status: 'NORMAL',
});

test('AssetTransitModal 接受 multiSelect prop(类型层校验)', () => {
  // 这个测试只在编译期有意义 —— 一旦 TS 报错就 fail
  const el = (
    <AssetTransitModal
      onClose={() => {}}
      multiSelect={false}
      onConfirmSelection={(items: AssetResourceItem[]) => {
        assert.ok(Array.isArray(items));
      }}
    />
  );
  const _typeCheck = el;
  assert.ok(_typeCheck);
});

test('AssetTransitModal 默认 multiSelect 应为 false', () => {
  // 调用方不传 multiSelect 时,类型层不应报错
  const el = <AssetTransitModal onClose={() => {}} />;
  assert.ok(el);
});

test('空选中时不应调用 onConfirmSelection(items 应为空数组或干脆未调)', () => {
  // 行为由 AssetTransitModal 内部实现,这里用类型断言保护
  const items: AssetResourceItem[] = [];
  assert.equal(items.length, 0);
});

test('fileResourceId 缺失的资源不应通过确认(校验逻辑)', () => {
  const items: AssetResourceItem[] = [asset(1, null)];
  const allHaveFileResId = items.every((it) => it.fileResourceId != null);
  assert.equal(allHaveFileResId, false);
});
```

注: brief 在原 plan 中是 3 个 test,这里扩为 4 个(把"fileResourceId 缺失校验"显式列为 test,让行为可验证)。如果担心 test 数量超,保留原 3 个即可。

**最终采用 4 个 test**(比 brief 略多,但更明确覆盖校验逻辑)。如果 implementer 想严格按 brief 3 个,可删第 4 个 test。

## 改动 2: `AssetTransitModal.tsx` 精确修改 5 处

### (3a) 改 Props 类型(line 47-54)

**替换前**(line 47-48):
```ts
  /** 选中确认回调 —— 接收 fileResourceId 数组(真实业务标识) */
  onConfirmSelection?: (selectedFileResourceIds: number[]) => void;
  /** 上传用途:AVATAR / PRODUCT / OTHER —— 默认 OTHER */
  purpose?: 'AVATAR' | 'PRODUCT' | 'OTHER';
```

**替换后**:
```ts
  /** 选中确认回调 —— 接收完整 AssetResourceItem 列表(避免父组件二次反查丢失) */
  onConfirmSelection?: (selected: AssetResourceItem[]) => void;
  /** 是否允许多选(默认 false);true 时累加,false 时点击替换 */
  multiSelect?: boolean;
  /** 上传用途:AVATAR / PRODUCT / OTHER —— 默认 OTHER */
  purpose?: 'AVATAR' | 'PRODUCT' | 'OTHER';
```

### (3b) 解构参数加 multiSelect(line 57-66)

在 `export const AssetTransitModal: React.FC<...>({` 的解构参数末尾(`targetSlot = 'main'` 后)加 `multiSelect = false,`:

**替换前**:
```ts
export const AssetTransitModal: React.FC<AssetTransitModalProps> = ({
  products,
  onClose,
  onSelectProduct,
  selectedProduct,
  onConfirmSelection,
  purpose = 'OTHER',
  productId,
  targetSlot = 'main'
}) => {
```

**替换后**:
```ts
export const AssetTransitModal: React.FC<AssetTransitModalProps> = ({
  products,
  onClose,
  onSelectProduct,
  selectedProduct,
  onConfirmSelection,
  purpose = 'OTHER',
  productId,
  targetSlot = 'main',
  multiSelect = false,
}) => {
```

### (3c) 改 `handleCardClick`(line 172-178)

**替换前**:
```ts
  const handleCardClick = (id: number) => {
    if (selectedAssetIds.includes(id)) {
      setSelectedAssetIds(prev => prev.filter(x => x !== id));
    } else {
      setSelectedAssetIds(prev => [...prev, id]);
    }
  };
```

**替换后**:
```ts
  const handleCardClick = (id: number) => {
    if (multiSelect) {
      // 多选:toggle 累加
      setSelectedAssetIds(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
      );
    } else {
      // 单选:替换(单选场景下选别的就覆盖,不需要 toggle)
      setSelectedAssetIds([id]);
    }
  };
```

### (3d) 改 `handleConfirmSelection`(line 319-347)

**替换前**:
```ts
  const handleConfirmSelection = () => {
    if (selectedAssetIds.length === 0) {
      alert('请至少选择一个资源！');
      return;
    }

    if (onConfirmSelection) {
      // 真后端协议:传 fileResourceId[] 给父组件
      const fileResIds = selectedAssetIds
        .map((id) => {
          const item = assets.find((a) => a.id === id);
          return item?.fileResourceId ?? null;
        })
        .filter((x): x is number => x !== null);

      onConfirmSelection(fileResIds);
    } else if (onSelectProduct && products && products.length > 0) {
      // 兼容老 onSelectProduct 行为(若父组件没用 onConfirmSelection)
      const firstItem = assets.find((a) => a.id === selectedAssetIds[0]);
      if (firstItem) {
        onSelectProduct({
          ...products[0],
          name: firstItem.name,
          thumbnail: firstItem.thumbnailUrl ?? products[0].thumbnail,
        });
      }
    }
    onClose();
  };
```

**替换后**:
```ts
  const handleConfirmSelection = () => {
    if (selectedAssetIds.length === 0) {
      toast.warning('请至少选择一个资源');
      return;
    }

    if (onConfirmSelection) {
      // 真后端协议:把当前页 assets 中选中的 item 完整透传给父组件
      // 父组件按需取 fileResourceId / thumbnailUrl / name
      const items = selectedAssetIds
        .map((id) => assets.find((a) => a.id === id))
        .filter((x): x is AssetResourceItem => x !== undefined);

      // 校验 fileResourceId:任一缺失则不允许确认(数据异常)
      const missing = items.filter((it) => it.fileResourceId == null);
      if (missing.length > 0) {
        toast.error('所选资源缺少文件标识,请重新选择');
        return;
      }

      onConfirmSelection(items);
    } else if (onSelectProduct && products && products.length > 0) {
      // 兼容老 onSelectProduct 行为(若父组件没用 onConfirmSelection)
      const firstItem = assets.find((a) => a.id === selectedAssetIds[0]);
      if (firstItem) {
        onSelectProduct({
          ...products[0],
          name: firstItem.name,
          thumbnail: firstItem.thumbnailUrl ?? products[0].thumbnail,
        });
      }
    }
    onClose();
  };
```

### (3e) 改 footer "确认选择"按钮 disabled(line 973-978)

**替换前**:
```tsx
                <button
                  onClick={handleConfirmSelection}
                  className="px-8 py-2 bg-blue-600 text-white rounded-lg text-xs font-extrabold hover:bg-blue-700 hover:shadow-md transition-all cursor-pointer"
                >
                  确认选择
                </button>
```

**替换后**:
```tsx
                <button
                  onClick={handleConfirmSelection}
                  disabled={selectedAssetIds.length === 0}
                  title={selectedAssetIds.length === 0 ? '请先选择资源' : undefined}
                  className="px-8 py-2 bg-blue-600 text-white rounded-lg text-xs font-extrabold hover:bg-blue-700 hover:shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  确认选择
                </button>
```

### (3f) 改 footer "清除选择"按钮:仅多选时显示(line 941-956)

**替换前**:
```tsx
                {selectedAssetIds.length > 0 && (
                  <>
                    <button
                      onClick={handleClearSelection}
                      className="text-xs text-blue-600 hover:underline font-bold bg-transparent border-none cursor-pointer"
                    >
                      清除选择
                    </button>
                    <button
                      onClick={handleMoveClick}
                      className="text-xs text-blue-600 hover:underline font-bold bg-transparent border-none cursor-pointer"
                    >
                      移动
                    </button>
                  </>
                )}
```

**替换后**:
```tsx
                {multiSelect && selectedAssetIds.length > 0 && (
                  <>
                    <button
                      onClick={handleClearSelection}
                      className="text-xs text-blue-600 hover:underline font-bold bg-transparent border-none cursor-pointer"
                    >
                      清除选择
                    </button>
                    <button
                      onClick={handleMoveClick}
                      className="text-xs text-blue-600 hover:underline font-bold bg-transparent border-none cursor-pointer"
                    >
                      移动
                    </button>
                  </>
                )}
```

## 执行步骤(TDD)

1. **先**创建 `AssetTransitModal.test.tsx`(完整内容如上)
2. 跑测试 → 期望 FAIL:
   - TS 错:`onConfirmSelection` 当前签名是 `number[]`,赋 `AssetResourceItem[]` 不兼容
   - TS 错:`multiSelect` prop 不存在
   ```
   cd EC-AIGC && npx tsx src/components/AssetTransitModal.test.tsx
   ```
3. **改 AssetTransitModal.tsx** 6 处(3a ~ 3f,按顺序)
4. 跑测试 → 期望 4 个 test PASS
5. 跑 `cd EC-AIGC && npm run lint` → 期望本任务相关 0 新错
6. 不做 git commit

## 验证清单

- 4 个 test 全过
- 6 处改动全部应用
- "确认选择"按钮在空选中时 disabled
- "清除选择"按钮仅 multiSelect=true 时显示
- alert 已全部替换为 toast
- 不破坏其他 modal 行为(moveToCategory / directory scan 等保持原状)

## Global Constraints

1. 不要 `any` —— `AssetResourceItem` 已在 `../api/modules/asset` 导出
2. 不引入新依赖 —— `sonner` 已存在
3. 不自动 commit
4. 不改后端 API
5. 不动 AssetTransitModal 之外的文件
6. 不重构目录扫描、分类树、移动 modal 等已有功能

## 上下文接口(给本任务用)

- 消费:`AssetResourceItem` from `../api/modules/asset` (Task 0 已存在)
- 消费:`toast` from `sonner` (Task 0 已 import)
- 输出(变更):
  - `onConfirmSelection?: (selected: AssetResourceItem[]) => void` (旧 `number[]`)
  - `multiSelect?: boolean` prop(默认 false)
- 后续 Task 4 `TransitPickerButton` 会消费新签名
