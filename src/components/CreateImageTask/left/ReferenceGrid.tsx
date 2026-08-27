import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import { AssetImage } from '../../AssetImage';
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
  /** 新图入场关联 key;匹配时该图 RolePicker 首次强制打开 */
  forceOpenRoleKey?: string | null;
  /** RolePicker 自行关闭后通知父组件清 key */
  onForceOpenConsumed?: () => void;
}

type ReferenceGroup = 'model' | 'common';

const ROLE_OPTIONS: Array<{ id: ReferenceSlot; label: string; icon: string }> = [
  { id: 'model', label: '模特', icon: 'face_3' },
  { id: 'pose', label: '姿势', icon: 'accessibility_new' },
  { id: 'scene', label: '场景', icon: 'landscape' },
  { id: 'detail', label: '细节', icon: 'zoom_in' },
];

const GROUP_CONFIG: Record<ReferenceGroup, {
  title: string;
  roles: ReferenceSlot[];
  addLabel: string;
}> = {
  model: {
    title: '模特库',
    roles: ['model', 'pose'],
    addLabel: '添加模特',
  },
  common: {
    title: '通用素材库',
    roles: ['scene', 'detail'],
    addLabel: '添加场景 / 细节',
  },
};

const REFERENCE_ROLE_COUNT = ROLE_OPTIONS.length;

const roleLabel = (role: ReferenceSlot) =>
  ROLE_OPTIONS.find((item) => item.id === role)?.label ?? role;

interface RolePickerProps {
  /** 内部索引(1 起),用于槽位互斥 owner 比较;与 `referenceNumber` 对应统一为 1 起 */
  referenceNumber: number;
  value: ReferenceSlot[];
  roleOwners: Partial<Record<ReferenceSlot, number>>;
  allowedRoles: ReferenceSlot[];
  onChange: (roles: ReferenceSlot[]) => void;
  /** 首次渲染时是否强制打开(用于新图入场联动);只生效一次 */
  defaultOpen?: boolean;
  /** open 状态变化回调;父组件用于消费 forceOpen 完毕后清 key */
  onOpenChange?: (open: boolean) => void;
}

const RolePicker: React.FC<RolePickerProps> = ({
  referenceNumber,
  value,
  roleOwners,
  allowedRoles,
  onChange,
  defaultOpen = false,
  onOpenChange,
}) => {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  const rootRef = useRef<HTMLDivElement>(null);
  const visibleRoles = allowedRoles.filter((role) => value.includes(role));

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      onOpenChange?.(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [onOpenChange]);

  const toggleRole = (role: ReferenceSlot) => {
    const nextVisible = visibleRoles.includes(role)
      ? visibleRoles.filter((item) => item !== role)
      : [...visibleRoles, role];
    // 任务提交要求每张参考图至少有一个角色,不能通过下拉清空最后一个标签。
    if (nextVisible.length === 0) return;
    const hiddenRoles = value.filter((item) => !allowedRoles.includes(item));
    onChange([...hiddenRoles, ...nextVisible]);
  };

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => {
          const next = !current;
          onOpenChange?.(next);
          return next;
        })}
        className={`flex h-7 w-full items-center justify-between gap-1 border px-2 text-[10px] font-bold ${
          open ? 'border-primary bg-blue-50 text-primary' : 'border-slate-200 bg-white text-slate-600 hover:border-primary/60'
        }`}
      >
        <span className="truncate">{visibleRoles.map(roleLabel).join('、') || '选择标签'}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={`图 ${referenceNumber + 1} 标签`}
          className="absolute left-0 z-40 mt-1 w-36 border border-slate-200 bg-white p-1 shadow-xl"
        >
          {ROLE_OPTIONS.filter((role) => allowedRoles.includes(role.id)).map((role) => {
            const active = visibleRoles.includes(role.id);
            const owner = roleOwners[role.id];
            const occupiedByAnother = !active && owner !== undefined && owner !== referenceNumber;
            const displayOwner = owner !== undefined ? owner + 1 : undefined;
            return (
              <button
                type="button"
                key={role.id}
                disabled={occupiedByAnother}
                aria-disabled={occupiedByAnother}
                onClick={() => toggleRole(role.id)}
                title={occupiedByAnother
                  ? `已被图 ${displayOwner} 占用,如需换归属请先到该图取消勾选`
                  : undefined}
                className={`flex h-8 w-full items-center gap-2 px-2 text-left text-[11px] ${
                  active
                    ? 'bg-orange-50 font-bold text-[#c84d38]'
                    : occupiedByAnother
                      ? 'cursor-not-allowed text-slate-300'
                      : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className={`grid h-4 w-4 place-items-center border ${active ? 'border-[#df5b43] bg-[#df5b43] text-white' : 'border-slate-300'}`}>
                  {active && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="material-symbols-outlined text-sm">{role.icon}</span>
                <span className="min-w-0 flex-1">{role.label}</span>
                {occupiedByAnother && displayOwner !== undefined && (
                  <span className="shrink-0 text-[9px] font-medium text-slate-400">图 {displayOwner}</span>
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
  forceOpenRoleKey,
  onForceOpenConsumed,
}) => {
  const groupedReferences = groupReferenceSlots(orderedRefs);
  const roleOwners = groupedReferences.reduce<Partial<Record<ReferenceSlot, number>>>(
    (owners, reference, index) => {
      reference.roles.forEach((role) => { owners[role] = index + 1; });
      return owners;
    },
    {},
  );
  const groupRefs: Record<ReferenceGroup, TaggedReference[]> = {
    model: groupedReferences.filter((reference) => reference.roles.some((role) => GROUP_CONFIG.model.roles.includes(role))),
    common: groupedReferences.filter((reference) =>
      reference.roles.some((role) => GROUP_CONFIG.common.roles.includes(role))
      // 兼容历史任务中的风格参考图:不再展示风格标签,但不让旧图片从素材区消失。
      || (reference.roles.includes('style') && !reference.roles.some((role) => GROUP_CONFIG.model.roles.includes(role))),
    ),
  };
  const globalIndex = new Map(groupedReferences.map((reference, index) => [reference.key, index]));

  const renderGroup = (group: ReferenceGroup) => {
    const config = GROUP_CONFIG[group];
    const references = groupRefs[group];
    const nextRole = config.roles.find((role) => roleOwners[role] === undefined);
    const canAdd = nextRole !== undefined && groupedReferences.length < REFERENCE_ROLE_COUNT;
    return (
      <section key={group} className="mt-3 border border-slate-200 bg-slate-50/40 p-2.5 first:mt-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 text-[11px] font-black text-slate-800">{config.title}</h3>
          <button
            type="button"
            onClick={() => nextRole && openSlotPicker(nextRole)}
            disabled={!canAdd}
            className="shrink-0 border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="mr-0.5 inline h-3 w-3" />
            {config.addLabel}
          </button>
        </div>

        {references.length > 0 ? (
          <div className="mt-2 grid grid-cols-1 gap-3">
            {references.map((reference) => {
              const index = globalIndex.get(reference.key) ?? 0;
              return (
                <div key={`${group}-${reference.key}`} className="group min-w-0">
                  <div className="relative aspect-[4/3] flex items-center justify-center overflow-hidden border border-slate-200 bg-white">
                    {reference.ref.originalUrl || reference.ref.thumbnailUrl ? (
                      <AssetImage
                        urls={[reference.ref.originalUrl, reference.ref.thumbnailUrl]}
                        alt={reference.ref.name ?? `图 ${index + 2}`}
                        assetKind="IMAGE"
                        aspectRatio="auto"
                        objectFit="contain"
                        maxWidth={960}
                        className="h-full w-full"
                      />
                    ) : (
                      <span className="material-symbols-outlined grid h-full place-items-center text-slate-400">image</span>
                    )}
                    <span className="absolute left-1 top-1 bg-slate-900/75 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      图 {index + 2}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemove(reference)}
                      className="absolute right-1 top-1 grid h-5 w-5 place-items-center bg-slate-900/75 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      title={`移除图 ${index + 2}`}
                      aria-label={`移除图 ${index + 2}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="mt-1.5">
                    <RolePicker
                      referenceNumber={index + 1}
                      value={reference.roles}
                      roleOwners={roleOwners}
                      allowedRoles={config.roles}
                      onChange={(roles) => onRolesChange(reference, roles)}
                      defaultOpen={reference.key === forceOpenRoleKey}
                      onOpenChange={(open) => {
                        if (!open && reference.key === forceOpenRoleKey) onForceOpenConsumed?.();
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => nextRole && openSlotPicker(nextRole)}
            disabled={!canAdd}
            className="mt-2 flex h-20 w-full items-center justify-center gap-1 border border-dashed border-slate-300 bg-white text-[10px] font-bold text-slate-400 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            {config.addLabel}
          </button>
        )}
      </section>
    );
  };

  return (
    <section id="reference-grid" className="border border-[#dfe3e8] bg-white p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-black">参考图</h2>
        <span className="bg-slate-100 px-1.5 py-1 text-[9px] font-bold text-slate-500">
          {groupedReferences.length} / {REFERENCE_ROLE_COUNT}
        </span>
      </div>

      <div className="mt-3 space-y-3">
        {renderGroup('model')}
        {renderGroup('common')}
      </div>
    </section>
  );
};
