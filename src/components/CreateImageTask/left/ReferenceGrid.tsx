// src/components/CreateImageTask/left/ReferenceGrid.tsx
// 左栏-参考图区:5 个固定槽位(细节/风格/场景/姿势/模特)
// - 徽标 = 槽位视觉序号 1..5
// - 点击已选 slot → 触发 openSlotPicker 替换图
// - 点击空槽 → 触发 openSlotPicker 添加新参考图(assignNextOrder 自动分配 slot)
// - 拖动调整 slot 顺序
// - 右侧 "+" 卡片点击 = 调 openSlotPicker 添加,但 5 张满了自动隐藏
import React, { useMemo, useState } from 'react';
import { REFERENCE_SLOTS_INTERNAL, REFERENCE_SLOT_META } from '../../../lib/createImageTask/referencesConfig';
import type { ReferenceSlot } from '../../../lib/createImageTask/extractReferenceInsights';

export interface ReferenceRef {
  slot: ReferenceSlot;
  thumbnailUrl?: string;
  originalUrl?: string;
  name?: string;
  analysis?: { promptHint?: string };
}

export interface ReferenceGridProps {
  /** 已选参考图的有序数组(按 referenceOrder 升序) */
  orderedRefs: { slot: ReferenceSlot; ref: ReferenceRef }[];
  /** 拖拽移动 */
  onMove: (fromSlot: ReferenceSlot, toIndex: number) => void;
  /** 由父容器注入的 picker 打开回调 */
  openSlotPicker: (slot: ReferenceSlot) => void;
}

export const ReferenceGrid: React.FC<ReferenceGridProps> = ({
  orderedRefs, onMove, openSlotPicker,
}) => {
  const [dragSlot, setDragSlot] = useState<ReferenceSlot | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  /**
   * 视觉渲染顺序 —— 关键设计:
   *
   * 5 个 slot 固定为 detail/style/scene/pose/model(后台标识符永远不变)。
   * 但视觉上按"已选紧凑 + 空槽尾部"原则渲染:
   *   - 第 1..N 位 = orderedRefs(已选,按 referenceOrder 升序)
   *   - 第 N+1..5 位 = REFERENCE_SLOTS 中未选的那些 slot(按原顺序)
   *
   * 这样刚选的图自动冒泡到前面空位置。
   *
   * 徽标 = 在 orderedRefs 中的 idx + 2(主图固定 1)。
   */
  const renderList = useMemo(() => {
    const used = new Set(orderedRefs.map((r) => r.slot));
    return [
      ...orderedRefs.map((r, idx) => ({
        kind: 'filled' as const,
        slot: r.slot as ReferenceSlot,
        ref: r.ref,
        order: idx + 2,
      })),
      ...REFERENCE_SLOTS_INTERNAL
        .filter((s) => !used.has(s))
        .map((slot) => ({
          kind: 'empty' as const,
          slot,
          ref: null,
          order: undefined as number | undefined,
        })),
    ];
  }, [orderedRefs]);

  // 拖到位置 targetIndex(在渲染列表 0..4 中)
  // hook.onMove 期望"在已选序列中的位置 0..N-1"
  const handleDrop = (targetIndex: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const fromSlot = (e.dataTransfer.getData('text/plain') || dragSlot) as ReferenceSlot | null;
    if (!fromSlot) return;
    // 计算 targetIndex 在 已选序列 中的目标位置
    // 先累计"前 N 个渲染项里已选的有几个"
    let toIndex = 0;
    for (let i = 0; i < targetIndex; i++) {
      const cell = renderList[i];
      if (cell.kind === 'filled') toIndex += 1;
    }
    // 若 targetIndex 落在已选卡片上(toIndex = 该卡片位置),或落在空槽
    // (toIndex = 已选数量,即插入末尾)。两种情况都正确。
    onMove(fromSlot, toIndex);
    setDragSlot(null);
    setDragOverIndex(null);
  };

  const handleDragStart = (slot: ReferenceSlot) => (e: React.DragEvent<HTMLDivElement>) => {
    setDragSlot(slot);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', slot);
  };
  const handleDragEnd = () => {
    setDragSlot(null);
    setDragOverIndex(null);
  };
  const handleDragOver = (targetIndex: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== targetIndex) setDragOverIndex(targetIndex);
  };

  return (
    <div id="reference-grid" className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black">
          参考图 <span className="font-normal text-slate-400">(选传)</span>
        </h2>
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
          {orderedRefs.length} / {REFERENCE_SLOTS_INTERNAL.length}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-slate-400">
        5 张图可拖动排序;空槽排在已选图后面,新选图自动靠前冒泡
      </p>

      <div className="grid grid-cols-2 gap-2 mt-3">
        {renderList.map((item, index) => {
          const slotLabel = REFERENCE_SLOT_META[item.slot].label;
          const showOrder = item.kind === 'filled';
          return (
            <div key={item.slot} className="relative">
              {dragSlot !== null && dragOverIndex === index && (
                <div
                  aria-hidden="true"
                  className="absolute -left-1 top-0 bottom-0 w-1 rounded-full bg-primary z-10 pointer-events-none"
                />
              )}

              {item.kind === 'filled' ? (
                <div
                  draggable
                  onDragStart={handleDragStart(item.slot)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver(index)}
                  onDrop={handleDrop(index)}
                  onDragLeave={() => setDragOverIndex(null)}
                  className={`cursor-grab active:cursor-grabbing ${
                    dragSlot === item.slot ? 'opacity-50' : ''
                  }`}
                  title={`${(item as any).ref?.name ?? ''}(${slotLabel}参考 · 拖动调整)`}
                >
                  <button
                    type="button"
                    onClick={() => openSlotPicker(item.slot)}
                    aria-label={`更换${slotLabel}参考`}
                    className="relative w-full h-16 rounded-md border-2 overflow-hidden flex items-center gap-2 px-2 text-left transition-colors border-primary bg-blue-50"
                  >
                    {(item as any).ref?.thumbnailUrl || (item as any).ref?.originalUrl ? (
                      <img
                        src={(item as any).ref.thumbnailUrl ?? (item as any).ref.originalUrl ?? ''}
                        alt={(item as any).ref.name ?? slotLabel}
                        className="w-10 h-10 rounded object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-2xl text-slate-400">image</span>
                    )}
                    <span
                      className="min-w-0 text-[11px] font-bold text-primary truncate"
                      title={(item as any).ref.name ?? ''}
                    >
                      {(item as any).ref.name ?? slotLabel}
                    </span>
                    {showOrder && (
                      <span
                        aria-hidden="true"
                        className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shadow-sm"
                      >
                        {(item as any).order}
                      </span>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openSlotPicker(item.slot)}
                  aria-label={`添加${slotLabel}参考`}
                  className="w-full h-16 rounded-md border-2 border-dashed border-slate-200 hover:border-primary bg-slate-50 hover:bg-blue-50 transition-colors flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-primary"
                >
                  <span className="material-symbols-outlined text-2xl">add</span>
                  <span className="text-[10px] font-bold">添加参考</span>
                </button>
              )}

              {/* 卡片下方:slot 中文标签(已选/空槽都显示,固定 detail/style/...) */}
              <div className="mt-1 flex items-center text-[10px] font-bold">
                <span className={item.kind === 'filled' ? 'text-primary' : 'text-slate-400'}>
                  {slotLabel}参考
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};