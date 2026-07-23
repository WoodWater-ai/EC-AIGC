export type ReferenceSlot = 'detail' | 'style' | 'scene' | 'pose' | 'model';

export interface Ref {
  slot: ReferenceSlot;
  analysis?: { promptHint?: string };
}

const SLOT_ORDER: ReferenceSlot[] = ['detail', 'style', 'scene', 'pose', 'model'];

export function extractReferenceInsights(
  refs: Partial<Record<ReferenceSlot, Ref | undefined>>,
): string[] {
  const out: string[] = [];
  for (const slot of SLOT_ORDER) {
    const r = refs[slot];
    const hint = r?.analysis?.promptHint?.trim();
    if (hint) out.push(hint);
  }
  return out;
}
