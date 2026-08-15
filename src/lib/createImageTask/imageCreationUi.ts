import type { ReferenceSlot } from './extractReferenceInsights';

export interface ReferenceAsset {
  id?: string | number;
  fileResourceId?: string | number;
  originalUrl?: string;
  thumbnailUrl?: string;
  name?: string;
  analysis?: { promptHint?: string };
}

export interface TaggedReference {
  key: string;
  ref: ReferenceAsset;
  roles: ReferenceSlot[];
}

const ROLE_ORDER: ReferenceSlot[] = ['model', 'detail', 'style', 'scene', 'pose'];

export const referenceKey = (ref: ReferenceAsset) => String(
  ref.id ?? ref.fileResourceId ?? ref.originalUrl ?? ref.thumbnailUrl ?? ref.name ?? '',
);

export function groupReferenceSlots(
  orderedRefs: Array<{ slot: ReferenceSlot; ref: ReferenceAsset }>,
): TaggedReference[] {
  const grouped = new Map<string, TaggedReference>();
  orderedRefs.forEach(({ slot, ref }) => {
    const key = referenceKey(ref) || `${slot}-${grouped.size}`;
    const current = grouped.get(key);
    if (current) {
      if (!current.roles.includes(slot)) current.roles.push(slot);
      return;
    }
    grouped.set(key, { key, ref, roles: [slot] });
  });
  return [...grouped.values()].map((item) => ({
    ...item,
    roles: ROLE_ORDER.filter((role) => item.roles.includes(role)),
  }));
}

export const sameReferenceAsset = (left: ReferenceAsset | undefined, right: ReferenceAsset) =>
  Boolean(left && referenceKey(left) === referenceKey(right));
