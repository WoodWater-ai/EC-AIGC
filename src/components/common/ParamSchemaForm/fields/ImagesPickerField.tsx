// [新增 2026-07-13 F1 补强] 多图 URL 字段
// Vidu SOLUTION 4 端点必填 1~7 张图(ImageComposition 场景)
// [v2.0 修订] 移除 antd,改用 Tailwind + lucide-react + sonner(项目 UI 库)
// [v2.1 2026-07-17 F1 补强] 改为卡片网格模式(参考 TransitPickerButton),
//                          移除 URL 输入框,缩略图走 COS imageMogr2
import React, { useState } from 'react';
import { Plus, X, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { FieldDef } from '../../../../api/modules/capability';
import { AssetTransitModal } from '../../../AssetTransitModal';
import { AssetImage } from '../../../AssetImage';

export interface ImagesPickerFieldProps {
  field: FieldDef;
  value: any;
  onChange: (v: any) => void;
  error?: string;
  readOnly?: boolean;
  isRecommended?: boolean;
}

export function ImagesPickerField({
  field, value, onChange, error, readOnly, isRecommended,
}: ImagesPickerFieldProps) {
  const list: string[] = Array.isArray(value) ? value : [];
  const min = field.minCount ?? 0;
  const max = field.maxCount ?? 7;

  // pickerIdx: null 表示未打开;>= 0 表示要替换该索引位置
  const [pickerIdx, setPickerIdx] = useState<number | null>(null);

  const handlePicked = (items: Array<{ originalUrl?: string; url?: string }>) => {
    const picked = items[0]?.originalUrl ?? items[0]?.url;
    if (!picked) {
      setPickerIdx(null);
      return;
    }
    if (pickerIdx === null) {
      // 不应到达这里(只在 openPicker 时设置 pickerIdx)
      return;
    }
    if (pickerIdx >= list.length) {
      // 追加(超出 list 时)
      if (list.length >= max) {
        toast.warning(`最多 ${max} 张图`);
      } else {
        onChange([...list, picked]);
      }
    } else {
      // 替换
      onChange(list.map((u, i) => (i === pickerIdx ? picked : u)));
    }
    setPickerIdx(null);
  };

  const remove = (idx: number) => {
    if (readOnly) return;
    onChange(list.filter((_, i) => i !== idx));
  };

  // 渲染单个槽位(已选/未选两种态)
  const renderSlot = (url: string | undefined, idx: number) => {
    const isFilled = !!url;
    return (
      <div
        key={idx}
        data-slot-idx={idx}
        className={`relative group overflow-hidden rounded-lg border-2 ${
          isFilled ? 'border-slate-200' : 'border-dashed border-slate-300 bg-slate-50'
        }`}
      >
        {isFilled ? (
          <>
            {/* 缩略图:AssetImage 内部已用 withCosThumbnail 走 COS 压缩 */}
            <AssetImage
              urls={[url]}
              alt={`图片 #${idx + 1}`}
              maxWidth={200}
              aspectRatio="square"
              className="w-full"
            />
            {/* hover 时显示替换/删除操作层 */}
            {!readOnly && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setPickerIdx(idx)}
                  className="px-2 py-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded"
                  title="重新选择"
                >
                  替换
                </button>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="px-2 py-1 text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded"
                  title="删除"
                >
                  删除
                </button>
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            disabled={readOnly}
            onClick={() => setPickerIdx(idx)}
            className="w-full aspect-square flex flex-col items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <ImageIcon className="w-8 h-8 mb-1" />
            <span className="text-[10px] font-bold">选择图片 #{idx + 1}</span>
          </button>
        )}
        {/* 角标:序号 */}
        <span className="absolute top-1 left-1 bg-black/50 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
          #{idx + 1}
        </span>
      </div>
    );
  };

  // 槽位列表(已选 + 未选直到 max)
  const slots: Array<string | undefined> = [...list];
  while (slots.length < max) slots.push(undefined);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-slate-700">
          {field.label}
          {field.required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
        {isRecommended && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">模板推荐</span>
        )}
        <span className={`text-[10px] px-1.5 py-0.5 rounded ml-auto ${
          list.length < min ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
        }`}>
          {list.length} / {min}~{max} 张
        </span>
      </div>

      {/* 卡片网格:每行 4 个槽位 */}
      <div className="grid grid-cols-4 gap-2">
        {slots.map((url, idx) => renderSlot(url, idx))}
      </div>

      {field.helpText && <div className="text-[11px] text-slate-500">{field.helpText}</div>}
      {error && <div className="text-[11px] text-rose-500">{error}</div>}

      {/* 选择器 modal */}
      {pickerIdx !== null && (
        <AssetTransitModal
          assetKind="IMAGE"
          multiSelect={false}
          onClose={() => setPickerIdx(null)}
          onConfirmSelection={handlePicked}
        />
      )}
    </div>
  );
}