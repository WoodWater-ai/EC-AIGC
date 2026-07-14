import React, { useState } from 'react';
import { SLOT_META, type SlotKey, type SlotRef } from '../createTask/slots';
import { AssetTransitModal } from '../AssetTransitModal';
import { AssetImage } from '../AssetImage';
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
  /** 已选时缩略图下方的文件名;默认取 value.name */
  selectedLabel?: string;
  /** 占位态 icon(Material Symbols 名) */
  icon?: string;
  /** 尺寸:sm(参考图小方格) | md(上下装大块) | lg(主图) */
  size?: 'sm' | 'md' | 'lg';
  /** 样式变体:主图 dashed box vs 普通卡 */
  variant?: 'primary' | 'secondary';

  /** 是否允许多选(默认 false) */
  multiSelect?: boolean;
  /** 禁用 */
  disabled?: boolean;
  /** 是否允许 × 清除按钮(默认 true) */
  clearable?: boolean;
  /** 缩略图最大宽度(传给 AssetImage,走 COS thumbnail 压缩);默认 200 */
  maxWidth?: number;
}

/** 把 AssetResourceItem 拍扁成 SlotRef —— 父组件写值唯一入口 */
export function toSlotRef(item: AssetResourceItem): SlotRef {
  return {
    fileResourceId: item.fileResourceId!,
    thumbnailUrl: item.thumbnailUrl ?? item.originalUrl,
    originalUrl: item.originalUrl,
    name: item.name,
  };
}

/**
 * 通用素材选择按钮
 *
 * 状态:
 *   - 未选:占位 icon + 文字(placeholder),点击 → 弹资源中心
 *   - 已选:缩略图 + 文件名,点击缩略图 → 重选,hover 出现 × 按钮 → 清除
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
  size = 'md',
  variant = 'secondary',
  multiSelect = false,
  disabled = false,
  clearable = true,
  maxWidth = 200,
}) => {
  const [open, setOpen] = useState(false);
  const meta = SLOT_META[slot];

  const fallbackPlaceholder = `添加${meta.label}`;
  const fallbackIcon = icon ?? (
    slot === 'main' ? 'cloud_upload'
    : slot === 'top' ? 'checkroom'
    : slot === 'bottom' ? 'accessibility_new'
    : slot === 'style' ? 'palette'
    : 'add'
  );

  // 容器尺寸(给缩略图撑开父容器)
  const containerClass =
    size === 'sm'
      ? 'w-full aspect-square'
      : size === 'lg'
        ? 'w-full min-h-[120px]'
        : 'w-20 h-24 lg:w-24 lg:h-28';

  const handleConfirm = (items: AssetResourceItem[]) => {
    if (items.length === 0) return;
    // 单选/多选业务上都取首个(本版本所有 slot 业务只取首个);
    // 未来若需要整批,父组件按 items 全量处理即可
    onChange(toSlotRef(items[0]));
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发父 button 的 onClick
    onChange(null);
  };

  // ============ 已选态:缩略图 + 点击重选 + hover × 清除 ============
  if (value !== null) {
    return (
      <>
        <div
          data-slot={slot}
          data-testid={`transit-picker-${slot}`}
          className={`relative group overflow-hidden rounded-lg cursor-pointer ${containerClass} ${variant === 'primary' ? 'border-2 border-blue-400' : 'border border-slate-200'}`}
          onClick={() => !disabled && setOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (!disabled) setOpen(true);
            }
          }}
          title={selectedLabel ?? value.name ?? '已选择资源'}
        >
          {/* 缩略图背景 */}
          <AssetImage
            urls={[value.thumbnailUrl]}
            alt={value.name ?? ''}
            maxWidth={maxWidth}
            className="w-full h-full"
            aspectRatio="auto"
            fallback={null}
          />

          {/* 底部文件名遮罩 */}
          {(value.name || selectedLabel) && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 pointer-events-none">
              <span className="text-[9px] lg:text-[10px] text-white font-bold truncate block">
                {selectedLabel ?? value.name}
              </span>
            </div>
          )}

          {/* hover × 清除按钮(右上角) */}
          {clearable && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title="清除选择"
              data-testid={`transit-picker-clear-${slot}`}
            >
              <span className="material-symbols-outlined text-[14px] leading-none">close</span>
            </button>
          )}
        </div>

        {open && (
          <AssetTransitModal
            multiSelect={multiSelect}
            onClose={() => setOpen(false)}
            onConfirmSelection={handleConfirm}
          />
        )}
      </>
    );
  }

  // ============ 未选态:占位 icon + 文字 ============
  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        data-slot={slot}
        data-testid={`transit-picker-${slot}`}
        className={`flex flex-col items-center justify-center rounded-lg cursor-pointer transition-colors ${containerClass} ${variant === 'primary' ? 'border-2 border-dashed border-blue-250 bg-blue-50/50 hover:bg-blue-50' : 'border border-dashed border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
        title={placeholder ?? fallbackPlaceholder}
      >
        <span className="material-symbols-outlined text-xl mb-1">{fallbackIcon}</span>
        <span className="text-[9px] lg:text-[10px] font-bold">{placeholder ?? fallbackPlaceholder}</span>
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
