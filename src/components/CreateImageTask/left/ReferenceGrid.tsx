import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import type { ReferenceSlot } from '../../../lib/createImageTask/extractReferenceInsights';
import {
  groupReferenceSlots,
  type ReferenceAsset,
  type TaggedReference,
} from '../../../lib/createImageTask/imageCreationUi';

export interface ReferenceRef extends ReferenceAsset {
  slot?: ReferenceSlot;
}

export interface ReferenceGridProps {
  orderedRefs: { slot: ReferenceSlot; ref: ReferenceRef }[];
  openSlotPicker: (slot: ReferenceSlot) => void;
  onRolesChange: (reference: TaggedReference, roles: ReferenceSlot[]) => void;
  onRemove: (reference: TaggedReference) => void;
}

const ROLE_OPTIONS: Array<{ id: ReferenceSlot; label: string; icon: string }> = [
  { id: 'model', label: '模特', icon: 'face_3' },
  { id: 'detail', label: '细节', icon: 'zoom_in' },
  { id: 'style', label: '风格', icon: 'palette' },
  { id: 'scene', label: '场景', icon: 'landscape' },
  { id: 'pose', label: '姿势', icon: 'accessibility_new' },
];

const roleLabel = (role: ReferenceSlot) =>
  ROLE_OPTIONS.find((item) => item.id === role)?.label ?? role;

interface RolePickerProps {
  referenceNumber: number;
  value: ReferenceSlot[];
  roleOwners: Partial<Record<ReferenceSlot, number>>;
  onChange: (roles: ReferenceSlot[]) => void;
}

const RolePicker: React.FC<RolePickerProps> = ({ referenceNumber, value, roleOwners, onChange }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const toggleRole = (role: ReferenceSlot) => {
    const next = value.includes(role)
      ? value.filter((item) => item !== role)
      : [...value, role];
    if (next.length > 0) onChange(next);
  };

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex h-7 w-full items-center justify-between gap-1 border px-2 text-[10px] font-bold ${
          open ? 'border-primary bg-blue-50 text-primary' : 'border-slate-200 bg-white text-slate-600 hover:border-primary/60'
        }`}
      >
        <span className="truncate">{value.map(roleLabel).join('、')}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={`参考图 ${referenceNumber} 标签`}
          className="absolute left-0 z-40 mt-1 w-36 border border-slate-200 bg-white p-1 shadow-xl"
        >
          {ROLE_OPTIONS.map((role) => {
            const active = value.includes(role.id);
            const owner = roleOwners[role.id];
            const occupiedByAnother = !active && owner !== undefined && owner !== referenceNumber;
            return (
              <button
                type="button"
                key={role.id}
                onClick={() => toggleRole(role.id)}
                title={occupiedByAnother ? `当前属于参考图 ${owner}，选择后将自动转移` : undefined}
                className={`flex h-8 w-full items-center gap-2 px-2 text-left text-[11px] ${
                  active ? 'bg-orange-50 font-bold text-[#c84d38]' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className={`grid h-4 w-4 place-items-center border ${active ? 'border-[#df5b43] bg-[#df5b43] text-white' : 'border-slate-300'}`}>
                  {active && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="material-symbols-outlined text-sm">{role.icon}</span>
                <span className="min-w-0 flex-1">{role.label}</span>
                {occupiedByAnother && (
                  <span className="shrink-0 text-[9px] font-medium text-slate-400">图 {owner}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const ReferenceGrid: React.FC<ReferenceGridProps> = ({
  orderedRefs,
  openSlotPicker,
  onRolesChange,
  onRemove,
}) => {
  const groupedReferences = groupReferenceSlots(orderedRefs);
  const usedRoles = new Set(groupedReferences.flatMap((reference) => reference.roles));
  const roleOwners = groupedReferences.reduce<Partial<Record<ReferenceSlot, number>>>(
    (owners, reference, index) => {
      reference.roles.forEach((role) => { owners[role] = index + 1; });
      return owners;
    },
    {},
  );
  const nextRole = (['model', 'detail', 'style', 'scene', 'pose'] as ReferenceSlot[])
    .find((role) => !usedRoles.has(role));

  return (
    <section id="reference-grid" className="border border-[#dfe3e8] bg-white p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-bold text-[#df5b43]">补充依据</p>
          <h2 className="mt-0.5 text-xs font-black">参考图</h2>
        </div>
        <span className="bg-slate-100 px-1.5 py-1 text-[9px] font-bold text-slate-500">
          {groupedReferences.length} / 5
        </span>
      </div>

      {groupedReferences.length === 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(['model', 'detail', 'style'] as ReferenceSlot[]).map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => openSlotPicker(slot)}
              className="flex aspect-[4/3] flex-col items-center justify-center gap-1 border border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-primary hover:text-primary"
            >
              <span className="material-symbols-outlined text-xl">
                {slot === 'model' ? 'face_3' : 'zoom_in'}
              </span>
              <span className="text-[10px] font-bold">添加{roleLabel(slot)}参考</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {groupedReferences.map((reference, index) => (
            <div key={reference.key} className="group min-w-0">
              <div className="relative aspect-[4/3] overflow-hidden border border-slate-200 bg-slate-50">
                {reference.ref.thumbnailUrl || reference.ref.originalUrl ? (
                  <img
                    src={reference.ref.thumbnailUrl ?? reference.ref.originalUrl}
                    alt={reference.ref.name ?? `参考图 ${index + 1}`}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="material-symbols-outlined grid h-full place-items-center text-slate-400">image</span>
                )}
                <span className="absolute left-1 top-1 bg-slate-900/75 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  参考图 {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(reference)}
                  className="absolute right-1 top-1 grid h-5 w-5 place-items-center bg-slate-900/75 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  title={`移除参考图 ${index + 1}`}
                  aria-label={`移除参考图 ${index + 1}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="mt-1.5">
                <RolePicker
                  referenceNumber={index + 1}
                  value={reference.roles}
                  roleOwners={roleOwners}
                  onChange={(roles) => onRolesChange(reference, roles)}
                />
              </div>
            </div>
          ))}
          {nextRole && (
            <button
              type="button"
              onClick={() => openSlotPicker(nextRole)}
              className="flex aspect-[4/3] min-w-0 flex-col items-center justify-center gap-1 border border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-primary hover:text-primary"
            >
              <Plus className="h-5 w-5" />
              <span className="text-[10px] font-bold">添加参考</span>
            </button>
          )}
        </div>
      )}
      <p className="mt-2 text-[9px] leading-4 text-slate-400">
        每张图片可多选标签；同一标签仅归属一张图，重复选择会自动转移。
      </p>
    </section>
  );
};
