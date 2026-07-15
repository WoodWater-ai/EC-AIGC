# Task 4 Brief — TransitPickerButton 公共组件

> 来源:`EC-AIGC/docs/superpowers/plans/2026-07-14-transit-picker-resource-confirm.md` Task 4

## 目标

新增 `src/components/common/TransitPickerButton.tsx`:7 个 slot 复用的"点击 → 弹资源中心 → 确认 → 写值"公共组件。Task 5 在 CreateImageTask 中替换 7 处 slot JSX 时会使用此组件。

## Files

- Create: `EC-AIGC/src/components/common/TransitPickerButton.tsx`
- Create: `EC-AIGC/src/components/common/TransitPickerButton.test.tsx`

## 完整代码(TransitPickerButton.test.tsx)

```tsx
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { TransitPickerButton, toSlotRef } from './TransitPickerButton';
import type { SlotRef } from '../createTask/slots';

// 类型层测试为主;运行时交互留给 Playwright/E2E(本计划不引入)

test('TransitPickerButton 接受最小 props', () => {
  const slot = 'top' as const;
  const value: SlotRef | null = null;
  const onChange = (_next: SlotRef | null) => {};
  const _typeCheck = <TransitPickerButton slot={slot} value={value} onChange={onChange} />;
  assert.ok(_typeCheck);
});

test('TransitPickerButton multiSelect prop 默认 false', () => {
  const _ = <TransitPickerButton slot="main" value={null} onChange={() => {}} />;
  assert.ok(_);
});

test('toSlotRef(item) → SlotRef 映射(fileResourceId 必填)', () => {
  const item = {
    id: 1,
    name: 'test',
    assetKind: 'IMAGE' as const,
    uploadUserId: 1,
    fileResourceId: 99,
    categoryIds: [],
    status: 'NORMAL' as const,
  };
  const ref: SlotRef = toSlotRef(item);
  assert.equal(ref.fileResourceId, 99);
  assert.equal(ref.name, 'test');
});

test('toSlotRef 优先用 thumbnailUrl,fallback 到 originalUrl', () => {
  const item1 = {
    id: 1, name: 'a', assetKind: 'IMAGE' as const, uploadUserId: 1,
    fileResourceId: 1, categoryIds: [], status: 'NORMAL' as const,
    thumbnailUrl: 'thumb-a',
  };
  const item2 = {
    id: 2, name: 'b', assetKind: 'IMAGE' as const, uploadUserId: 1,
    fileResourceId: 2, categoryIds: [], status: 'NORMAL' as const,
    originalUrl: 'orig-b',
  };
  assert.equal(toSlotRef(item1).thumbnailUrl, 'thumb-a');
  assert.equal(toSlotRef(item2).thumbnailUrl, 'orig-b');
});
```

## 完整代码(TransitPickerButton.tsx)

```tsx
import React, { useState } from 'react';
import { SLOT_META, type SlotKey, type SlotRef } from '../createTask/slots';
import { AssetTransitModal } from '../AssetTransitModal';
import type { AssetResourceItem } from '../../api/modules/asset';

export interface TransitPickerButtonProps {
  /** slot 标识 —— 唯一身份 */
  slot: SlotKey;

  /** 当前 slot 的资源引用;null = 未选 */
  value: SlotRef | null;
  /** 选中 / 替换 / 清除(value=null) */
  onChange: (next: SlotRef | null) => void;

  /** 占位文字,如"添加上衣";默认取 SLOT_META[slot].label + 前缀 */
  placeholder?: string;
  /** 已选时的标签,如"已添加上衣";默认 "已添加{label}" */
  selectedLabel?: string;
  /** 占位态 icon(Material Symbols 名) */
  icon?: string;
  /** 已选态 icon(默认 'check_circle') */
  selectedIcon?: string;
  /** 尺寸:sm(参考图小方格) | md(上下装大块) | lg(主图) */
  size?: 'sm' | 'md' | 'lg';
  /** 样式变体:主图 dashed box vs 普通卡 */
  variant?: 'primary' | 'secondary';

  /** 是否允许多选(默认 false) */
  multiSelect?: boolean;
  /** 禁用 */
  disabled?: boolean;
}

/** 把 AssetResourceItem 拍扁成 SlotRef —— 父组件写值唯一入口 */
export function toSlotRef(item: AssetResourceItem): SlotRef {
  return {
    fileResourceId: item.fileResourceId!,
    thumbnailUrl: item.thumbnailUrl ?? item.originalUrl,
    name: item.name,
  };
}

/**
 * 通用素材选择按钮:点击 → 弹资源中心 → 选中确认 → onChange
 *
 * 7 个 slot 都通过此组件复用同一份"点击 → 弹 modal → 写值"逻辑。
 * 内部持有自己的 open 状态,每个 button 各挂一个 AssetTransitModal 实例。
 */
export const TransitPickerButton: React.FC<TransitPickerButtonProps> = ({
  slot,
  value,
  onChange,
  placeholder,
  selectedLabel,
  icon,
  selectedIcon = 'check_circle',
  size = 'md',
  variant = 'secondary',
  multiSelect = false,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const meta = SLOT_META[slot];

  const fallbackPlaceholder = `添加${meta.label}`;
  const fallbackSelectedLabel = `已添加${meta.label}`;
  const fallbackIcon = icon ?? (
    slot === 'main' ? 'cloud_upload'
    : slot === 'top' ? 'checkroom'
    : slot === 'bottom' ? 'accessibility_new'
    : slot === 'style' ? 'palette'
    : 'add'
  );

  const handleConfirm = (items: AssetResourceItem[]) => {
    if (items.length === 0) return;
    // 单选/多选业务上都取首个(本版本所有 slot 业务只取首个);
    // 未来若需要整批,父组件按 items 全量处理即可
    onChange(toSlotRef(items[0]));
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        data-slot={slot}
        data-testid={`transit-picker-${slot}`}
        className="outline-none focus:ring-2 focus:ring-blue-400"
        title={value ? (selectedLabel ?? fallbackSelectedLabel) : (placeholder ?? fallbackPlaceholder)}
      >
        {value !== null ? (
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined">{selectedIcon}</span>
            <span>{selectedLabel ?? fallbackSelectedLabel}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined">{fallbackIcon}</span>
            <span>{placeholder ?? fallbackPlaceholder}</span>
          </span>
        )}
      </button>

      {open && (
        <AssetTransitModal
          multiSelect={multiSelect}
          onClose={() => setOpen(false)}
          onConfirmSelection={handleConfirm}
        />
      )}
    </>
  );
};

// 公开 size / variant 给父组件类名工具
export const TRANSIT_PICKER_SIZES = {
  sm: 'aspect-square w-full',
  md: 'w-20 h-24 lg:w-24 lg:h-28',
  lg: 'min-h-[120px] w-full',
} as const;
```

## 执行步骤(TDD)

1. **先**创建 `TransitPickerButton.test.tsx`(完整内容如上)
2. 跑测试 → 期望 FAIL(module not found):
   ```
   cd EC-AIGC && npx tsx src/components/common/TransitPickerButton.test.tsx
   ```
   - 若 `tsx` runner 因 Vite `import.meta.env` 报错(项目级 pre-existing 限制),改为 `npm run lint` 验证 TS 编译
3. 创建 `TransitPickerButton.tsx`(完整内容如上)
4. 跑 `npm run lint` → 期望 0 新错
5. 跑 `npx tsx src/components/common/TransitPickerButton.test.tsx`(或 `npm test`)→ 期望通过
6. 不做 git commit

## 验证清单

- 4 个 test 全过(若 tsx runner 受 Vite 限制,至少 `npm run lint` PASS,test 编译通过)
- 无 `any`
- 不引入新依赖
- 文件位置正确:`src/components/common/TransitPickerButton.tsx`(在 common/ 目录)
- `toSlotRef` 导出便于父组件复用

## Global Constraints

1. 不要 `any` —— `toSlotRef` 用 `item.fileResourceId!` 非空断言(因 Task 3 已在校验)
2. slot 常量走 `SLOT_META`(从 slots.ts 导入)
3. 不引入新依赖
4. 不自动 commit
5. 测试用 `node:test + node:assert/strict`
6. 不动 AssetTransitModal.tsx(Task 3 已交付)
7. 不动 slots.ts(Task 1 已交付)
8. 项目级 tsx runner 限制(import.meta.env)已知,接受"用 tsc 验证 + 测试通过"组合验证

## 上下文接口(给本任务用)

- 消费:`SlotKey / SlotRef / SLOT_META` from `../createTask/slots`(Task 1)
- 消费:`AssetTransitModal` from `../AssetTransitModal`(Task 3 已改签名)
- 消费:`AssetResourceItem` from `../../api/modules/asset`
- 输出:`TransitPickerButton` 组件 + `toSlotRef` 工具函数
- 后续 Task 5 在 CreateImageTask 7 处 JSX 使用
