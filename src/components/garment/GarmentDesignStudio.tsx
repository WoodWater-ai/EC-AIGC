import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AssetImage } from '../AssetImage';
import { assetApi, type AssetResourceItem } from '../../api/modules/asset';
import { useFileUpload } from '../../hooks/useFileUpload';
import {
  GARMENT_PREVIEW_BASE_WIDTH_RATIO,
  GARMENT_PREVIEW_BACKGROUND_COLOR,
  renderGarmentPreview,
  resolveGarmentPlacement,
} from '../../utils/renderGarmentPreview';
import { GarmentRenderDialog } from './GarmentRenderDialog';
import { TryonDialog } from './TryonDialog';
import { PublicationDialog } from './PublicationDialog';
import type { GarmentBlock } from '../../api/modules/garmentBlock';
import type { GarmentCategory } from '../../api/modules/garmentCategory';
import {
  garmentDesignApi,
  type GarmentAvailablePart,
  type GarmentDesign,
  type GarmentDesignPartInstance,
} from '../../api/modules/garmentDesign';

interface GarmentDesignStudioProps {
  categories: GarmentCategory[];
  blocks: GarmentBlock[];
  canRender: boolean;
  canTryon: boolean;
  canPublish: boolean;
  canExportPublication: boolean;
}

const DESIGN_DRAFT_KEY = 'garment-design-workspace-draft-v1';
const DEFAULT_PREVIEW_COLOR = '#F3F0EA';

interface GarmentPreviewState {
  selection: Record<string, string>;
  color: string;
}

export function GarmentDesignStudio({ categories, blocks, canRender, canTryon, canPublish, canExportPublication }: GarmentDesignStudioProps) {
  const { upload: uploadPreview } = useFileUpload({ purpose: 'OTHER' });
  const [designs, setDesigns] = useState<GarmentDesign[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [designId, setDesignId] = useState('');
  const [baseVersionId, setBaseVersionId] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState(`DESIGN_${Date.now()}`);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const availableBlocks = blocks.filter((item) => item.categoryId === categoryId && item.currentVersionId);
  const [blockVersionId, setBlockVersionId] = useState(availableBlocks[0]?.currentVersionId ?? '');
  const [availableParts, setAvailableParts] = useState<GarmentAvailablePart[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [color, setColor] = useState(DEFAULT_PREVIEW_COLOR);
  const [colorText, setColorText] = useState(DEFAULT_PREVIEW_COLOR);
  const [previewHistory, setPreviewHistory] = useState<GarmentPreviewState[]>([
    { selection: {}, color: DEFAULT_PREVIEW_COLOR },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [pendingInstances, setPendingInstances] = useState<GarmentDesignPartInstance[]>([]);
  const [assets, setAssets] = useState<Record<string, AssetResourceItem>>({});
  const [draftAvailable, setDraftAvailable] = useState(() => Boolean(localStorage.getItem(DESIGN_DRAFT_KEY)));
  const [renderDesign, setRenderDesign] = useState<GarmentDesign>();
  const [tryonDesign, setTryonDesign] = useState<GarmentDesign>();
  const [publishDesign, setPublishDesign] = useState<GarmentDesign>();

  const resetPreviewState = (nextSelection: Record<string, string>, nextColor: string) => {
    const normalizedColor = nextColor.toUpperCase();
    setSelection(nextSelection);
    setColor(normalizedColor);
    setColorText(normalizedColor);
    setPreviewHistory([{ selection: nextSelection, color: normalizedColor }]);
    setHistoryIndex(0);
  };

  const resetSelection = (next: Record<string, string>) => {
    resetPreviewState(next, color);
  };

  const commitSelection = (updater: (current: Record<string, string>) => Record<string, string>) => {
    setSelection((current) => {
      const next = updater(current);
      setPreviewHistory((history) => [
        ...history.slice(0, historyIndex + 1),
        { selection: next, color },
      ]);
      setHistoryIndex((index) => index + 1);
      return next;
    });
  };

  const commitColor = (nextColor: string) => {
    const normalized = nextColor.toUpperCase();
    setColorText(normalized);
    if (normalized === color) return;
    setColor(normalized);
    setPreviewHistory((history) => [
      ...history.slice(0, historyIndex + 1),
      { selection, color: normalized },
    ]);
    setHistoryIndex((index) => index + 1);
  };

  const commitColorText = () => {
    const normalized = colorText.trim().toUpperCase();
    if (/^#[0-9A-F]{6}$/.test(normalized)) {
      commitColor(normalized);
      return;
    }
    setColorText(color);
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    setSelection(previewHistory[nextIndex].selection);
    setColor(previewHistory[nextIndex].color);
    setColorText(previewHistory[nextIndex].color);
  };

  const redo = () => {
    if (historyIndex >= previewHistory.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    setSelection(previewHistory[nextIndex].selection);
    setColor(previewHistory[nextIndex].color);
    setColorText(previewHistory[nextIndex].color);
  };

  const loadDesigns = useCallback(async () => {
    setLoading(true);
    try {
      const page = await garmentDesignApi.page({ pageNum: 1, pageSize: 100, status: 'NORMAL' });
      setDesigns(page.list);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '结构化设计加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDesigns(); }, [loadDesigns]);

  useEffect(() => {
    if (!categories.some((item) => item.id === categoryId)) {
      setCategoryId(categories[0]?.id ?? '');
    }
  }, [categories, categoryId]);

  useEffect(() => {
    const valid = blocks.some((item) => item.categoryId === categoryId && item.currentVersionId === blockVersionId);
    if (!valid) {
      setBlockVersionId(blocks.find((item) => item.categoryId === categoryId && item.currentVersionId)?.currentVersionId ?? '');
      resetSelection({});
    }
  }, [blockVersionId, blocks, categoryId]);

  useEffect(() => {
    if (!editorOpen || !categoryId || !blockVersionId) {
      setAvailableParts([]);
      return;
    }
    let active = true;
    void garmentDesignApi.availableParts({ categoryId, blockVersionId, viewCode: 'FRONT' }).then(async (parts) => {
      if (!active) return;
      setAvailableParts(parts);
      if (pendingInstances.length > 0) {
        const restored: Record<string, string> = {};
        for (const instance of pendingInstances) {
          if (parts.some((part) => part.templateVersionId === instance.partTemplateVersionId)) {
            restored[instance.slotDefinitionId] = instance.partTemplateVersionId;
          }
        }
        resetSelection(restored);
        setPendingInstances([]);
      }
      const previewIds = [...new Set(parts.map((item) => item.previewAssetId).filter(Boolean))];
      const resolved = await Promise.all(previewIds.map(async (id) => {
        try { return await assetApi.get(id); } catch { return undefined; }
      }));
      if (active) setAssets(Object.fromEntries(resolved.filter((item): item is AssetResourceItem => Boolean(item)).map((item) => [item.id, item])));
    }).catch((error) => {
      if (active) toast.error(error instanceof Error ? error.message : '可用组件加载失败');
    });
    return () => { active = false; };
  }, [blockVersionId, categoryId, editorOpen, pendingInstances]);

  useEffect(() => {
    if (!editorOpen) return;
    localStorage.setItem(DESIGN_DRAFT_KEY, JSON.stringify({
      designId,
      baseVersionId,
      name,
      code,
      categoryId,
      blockVersionId,
      selection,
      color,
      savedAt: Date.now(),
    }));
    setDraftAvailable(true);
  }, [baseVersionId, blockVersionId, categoryId, code, color, designId, editorOpen, name, selection]);

  const category = categories.find((item) => item.id === categoryId);
  const slots = category?.slots ?? [];
  const selectedParts = useMemo(() => Object.entries(selection).map(([slotId, versionId]) => {
    const slot = slots.find((item) => item.id === slotId);
    const part = availableParts.find((item) => item.templateVersionId === versionId);
    return slot && part ? { slot, part } : undefined;
  }).filter((item): item is NonNullable<typeof item> => Boolean(item)).sort((a, b) => a.part.layerOrder - b.part.layerOrder), [availableParts, selection, slots]);
  const missingRequired = slots.filter((slot) => slot.required && !selection[slot.id]);

  const startNew = () => {
    const firstCategory = categories[0];
    const firstBlock = blocks.find((item) => item.categoryId === firstCategory?.id && item.currentVersionId);
    setDesignId('');
    setBaseVersionId('');
    setName('');
    setCode(`DESIGN_${Date.now()}`);
    setCategoryId(firstCategory?.id ?? '');
    setBlockVersionId(firstBlock?.currentVersionId ?? '');
    resetPreviewState({}, DEFAULT_PREVIEW_COLOR);
    setPendingInstances([]);
    setEditorOpen(true);
  };

  const editDesign = async (design: GarmentDesign) => {
    try {
      const detail = await garmentDesignApi.detail(design.id);
      const current = detail.currentVersion;
      setDesignId(detail.id);
      setBaseVersionId(current?.id ?? '');
      setName(detail.name);
      setCode(detail.designCode);
      setCategoryId(detail.categoryId);
      setBlockVersionId(current?.blockVersionId ?? blocks.find((item) => item.categoryId === detail.categoryId && item.currentVersionId)?.currentVersionId ?? '');
      setPendingInstances(current?.parts ?? []);
      resetPreviewState(
        {},
        typeof current?.color?.hexPreview === 'string' ? current.color.hexPreview : DEFAULT_PREVIEW_COLOR,
      );
      setEditorOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '设计详情加载失败');
    }
  };

  const save = async () => {
    if (!name.trim() || !categoryId || !blockVersionId || missingRequired.length > 0 || selectedParts.length === 0) return;
    setSaving(true);
    let createdPreviewAssetId = '';
    let currentDesignId = designId;
    let versionSaveStarted = false;
    try {
      const previewLayers = selectedParts.map(({ part }) => {
        const asset = assets[part.previewAssetId];
        const url = asset?.originalUrl ?? asset?.thumbnailUrl;
        if (!url) throw new Error(`组件 ${part.name} 缺少可访问预览图`);
        const placement = resolveGarmentPlacement(part);
        return {
          url,
          ...placement,
        };
      });
      const preview = await renderGarmentPreview(previewLayers, GARMENT_PREVIEW_BACKGROUND_COLOR);
      const previewFile = new File([preview.blob], `garment-design-preview-${Date.now()}.png`, { type: 'image/png' });
      const uploaded = await uploadPreview(previewFile);
      createdPreviewAssetId = await assetApi.create({
        fileResourceId: uploaded.fileResourceId,
        fileMd5: uploaded.fileMd5,
        name: `${name.trim()} · 结构化预览`,
        assetKind: 'IMAGE',
        assetType: 'GARMENT_DESIGN_PREVIEW',
        description: '由版型、组件版本和已验证绑定即时合成的可重建预览',
        tags: 'garment-design-preview',
      });
      if (!currentDesignId) {
        currentDesignId = await garmentDesignApi.add({
          categoryId,
          designCode: code.trim().toUpperCase(),
          name: name.trim(),
        });
        // 主档创建与版本固化是两个接口；立即保存主档 ID，版本失败重试时不得重复创建空主档。
        setDesignId(currentDesignId);
      }
      versionSaveStarted = true;
      const versionId = await garmentDesignApi.saveVersion({
        designId: currentDesignId,
        blockVersionId,
        baseVersionId: baseVersionId || undefined,
        previewAssetId: createdPreviewAssetId,
        color: { hexPreview: color },
        parts: selectedParts.map(({ slot, part }) => ({
          slotDefinitionId: slot.id,
          partTemplateVersionId: part.templateVersionId,
          partBindingId: part.bindingId,
          instanceIndex: 0,
          transform: { mode: 'USE_VERIFIED_BINDING' },
          layerOrder: part.layerOrder,
        })),
      });
      setDesignId(currentDesignId);
      setBaseVersionId(versionId);
      toast.success(`结构化设计版本已固化：${versionId}`);
      await loadDesigns();
      localStorage.removeItem(DESIGN_DRAFT_KEY);
      setDraftAvailable(false);
      setEditorOpen(false);
    } catch (error) {
      if (versionSaveStarted && currentDesignId && createdPreviewAssetId) {
        try {
          // 请求超时并不等于服务端回滚；先按预览资产反查，避免删除已被不可变版本引用的资产。
          const detail = await garmentDesignApi.detail(currentDesignId);
          const committed = detail.versions?.find((version) => version.previewAssetId === createdPreviewAssetId);
          if (committed) {
            setBaseVersionId(committed.id);
            toast.success(`结构化设计版本已固化：${committed.id}`);
            await loadDesigns();
            localStorage.removeItem(DESIGN_DRAFT_KEY);
            setDraftAvailable(false);
            setEditorOpen(false);
            return;
          }
        } catch {
          // 无法确认提交结果时保留资产，交由后续重试或只读孤儿清理流程处理。
        }
      }
      if (createdPreviewAssetId && !versionSaveStarted) {
        try { await assetApi.delete(createdPreviewAssetId); } catch { /* orphan cleanup job remains the fallback */ }
      }
      const message = error instanceof Error ? error.message : '设计版本保存失败';
      toast.error(versionSaveStarted
        ? `${message}；主档与预览资产已保留，请重试，避免破坏可能已提交的版本`
        : message);
    } finally {
      setSaving(false);
    }
  };

  const restoreDraft = () => {
    try {
      const raw = localStorage.getItem(DESIGN_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        designId?: string;
        baseVersionId?: string;
        name?: string;
        code?: string;
        categoryId?: string;
        blockVersionId?: string;
        selection?: Record<string, string>;
        color?: string;
      };
      setDesignId(draft.designId ?? '');
      setBaseVersionId(draft.baseVersionId ?? '');
      setName(draft.name ?? '');
      setCode(draft.code ?? `DESIGN_${Date.now()}`);
      setCategoryId(draft.categoryId ?? categories[0]?.id ?? '');
      setBlockVersionId(draft.blockVersionId ?? '');
      resetPreviewState(draft.selection ?? {}, draft.color ?? DEFAULT_PREVIEW_COLOR);
      setPendingInstances([]);
      setEditorOpen(true);
    } catch {
      localStorage.removeItem(DESIGN_DRAFT_KEY);
      setDraftAvailable(false);
      toast.error('本地设计草稿已损坏，已清除');
    }
  };

  const discardDraft = () => {
    localStorage.removeItem(DESIGN_DRAFT_KEY);
    setDraftAvailable(false);
  };

  if (editorOpen) {
    return (
      <div className="grid min-h-[680px] gap-4 xl:grid-cols-[260px_minmax(420px,1fr)_360px]">
        <aside className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <button type="button" onClick={() => setEditorOpen(false)} className="mb-5 flex items-center gap-1 text-xs font-bold text-stone-500"><span className="material-symbols-outlined text-base">arrow_back</span>返回设计列表</button>
          <div className="space-y-4">
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-stone-600">设计名称</span><input value={name} onChange={(event) => setName(event.target.value)} className="form-input" /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-stone-600">设计编码</span><input disabled={Boolean(designId)} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} className="form-input font-mono disabled:bg-stone-100" /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-stone-600">品类</span><select disabled={Boolean(designId)} value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="form-input disabled:bg-stone-100">{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-stone-600">精确版型版本</span><select value={blockVersionId} onChange={(event) => { setBlockVersionId(event.target.value); resetSelection({}); }} className="form-input">{availableBlocks.map((item) => <option key={item.id} value={item.currentVersionId}>{item.name} · {item.code}</option>)}</select></label>
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-stone-600">颜色快照</span><span className="grid grid-cols-[52px_1fr] gap-2"><input aria-label="颜色选择器" type="color" value={color} onChange={(event) => commitColor(event.target.value)} className="h-11 w-full rounded-lg border border-stone-200 bg-white p-1" /><input aria-label="颜色 HEX" value={colorText} maxLength={7} spellCheck={false} onChange={(event) => setColorText(event.target.value.toUpperCase())} onBlur={commitColorText} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} className={`form-input font-mono uppercase ${/^#[0-9A-F]{6}$/.test(colorText) ? '' : 'border-rose-300 text-rose-700'}`} /></span><span className="mt-1 block text-[10px] text-stone-400">输入 #RRGGBB；离开输入框后更新预览并写入撤销历史</span></label>
          </div>
          <div className="mt-5 rounded-lg bg-stone-50 p-3 text-xs leading-5 text-stone-500">每次保存都会生成新的不可变版本；历史版本继续引用当时的版型、组件版本与绑定，不随组件库更新漂移。</div>
        </aside>

        <section className="flex flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-primary">Structured preview</p><h2 className="mt-1 font-bold text-stone-900">正面结构化预览</h2></div><div className="flex items-center gap-1"><button type="button" disabled={historyIndex <= 0} onClick={undo} className="rounded p-2 text-stone-500 hover:bg-stone-100 disabled:opacity-30" title="撤销"><span className="material-symbols-outlined text-lg">undo</span></button><button type="button" disabled={historyIndex >= previewHistory.length - 1} onClick={redo} className="rounded p-2 text-stone-500 hover:bg-stone-100 disabled:opacity-30" title="重做"><span className="material-symbols-outlined text-lg">redo</span></button><span className="rounded bg-stone-100 px-2 py-1 font-mono text-[10px] text-stone-500">{selectedParts.length} PARTS</span></div></div>
          <div style={{ backgroundColor: GARMENT_PREVIEW_BACKGROUND_COLOR }} className="relative mt-5 aspect-square w-full overflow-hidden rounded-xl border border-stone-200">
            <div className="pointer-events-none absolute right-3 top-3 z-50 flex items-center gap-2 rounded-full border border-stone-200 bg-white/95 px-3 py-1.5 text-[10px] font-bold text-stone-600 shadow-sm"><span style={{ backgroundColor: color }} className="h-3 w-3 rounded-full border border-black/10" />目标色 {color}</div>
            <div style={{ width: `${GARMENT_PREVIEW_BASE_WIDTH_RATIO * 100}%` }} className="pointer-events-none absolute left-1/2 top-1/2 h-[78%] -translate-x-1/2 -translate-y-1/2 rounded-[45%_45%_18%_18%] border border-dashed border-stone-400/60" />
            {selectedParts.map(({ slot, part }) => {
              const asset = assets[part.previewAssetId];
              const placement = resolveGarmentPlacement(part);
              return <div key={slot.id} style={{ zIndex: part.layerOrder, width: `${GARMENT_PREVIEW_BASE_WIDTH_RATIO * 100}%`, left: `${(placement.targetAnchorX + placement.translateX) * 100}%`, top: `${(placement.targetAnchorY + placement.translateY) * 100}%`, transform: `translate(${-placement.sourceAnchorX * 100}%, ${-placement.sourceAnchorY * 100}%)` }} className="absolute"><div style={{ transform: `scale(${placement.scale})`, transformOrigin: `${placement.sourceAnchorX * 100}% ${placement.sourceAnchorY * 100}%` }}><AssetImage urls={[asset?.originalUrl, asset?.thumbnailUrl]} alt={part.name} aspectRatio="auto" objectFit="contain" /></div></div>;
            })}
            {selectedParts.length === 0 && <div className="relative z-10 text-center text-stone-400"><span className="material-symbols-outlined text-5xl">checkroom</span><p className="mt-2 text-xs">从右侧槽位选择组件</p></div>}
          </div>
          <p className="mt-2 text-[10px] leading-4 text-stone-400">画布与 AI 输入均为 1:1；虚线仅是编辑辅助轮廓，不写入固化图片。目标色作为受控生成指令保存，当前组件预览保留原材质，不伪装成精确染色效果。</p>
          <div className="mt-4 flex items-center justify-between gap-3"><div className={`text-xs ${missingRequired.length ? 'text-rose-600' : 'text-emerald-700'}`}>{missingRequired.length ? `缺少必选：${missingRequired.map((item) => item.name).join('、')}` : '必选槽位已完整'}</div><button type="button" disabled={saving || missingRequired.length > 0 || selectedParts.length === 0 || !blockVersionId} onClick={() => void save()} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">{saving ? '固化中…' : baseVersionId ? '保存为新版本' : '创建并固化版本'}</button></div>
        </section>

        <aside className="max-h-[760px] space-y-4 overflow-y-auto rounded-xl border border-stone-200 bg-[#fbfaf8] p-4 shadow-sm">
          <div><p className="text-[10px] font-bold uppercase tracking-widest text-primary">Part slots</p><h2 className="mt-1 font-bold text-stone-900">组件槽位</h2></div>
          {slots.map((slot) => {
            const options = availableParts.filter((part) => part.slotCode === slot.slotCode);
            return <section key={slot.id} className="rounded-xl border border-stone-200 bg-white p-3"><div className="flex items-center justify-between"><b className="text-xs text-stone-800">{slot.name}</b><span className={`text-[9px] font-bold ${slot.required ? 'text-rose-600' : 'text-stone-400'}`}>{slot.required ? '必选' : '可选'}</span></div><div className="mt-2 grid grid-cols-2 gap-2">{options.map((part) => { const asset = assets[part.previewAssetId]; const selected = selection[slot.id] === part.templateVersionId; return <button key={part.templateVersionId} type="button" onClick={() => commitSelection((current) => ({ ...current, [slot.id]: part.templateVersionId }))} className={`overflow-hidden rounded-lg border text-left ${selected ? 'border-primary ring-2 ring-primary/15' : 'border-stone-200'}`}><div className="aspect-square bg-stone-50"><AssetImage urls={[asset?.originalUrl, asset?.thumbnailUrl]} alt={part.name} className="h-full" aspectRatio="auto" objectFit="contain" /></div><div className="p-2"><div className="truncate text-[10px] font-bold text-stone-700">{part.name}</div><div className="mt-1 text-[8px] font-bold text-stone-400">{part.bindingScope === 'EXACT_BLOCK' ? '精确版型适配' : '版型族适配'}</div></div></button>; })}</div>{options.length === 0 && <p className="mt-2 rounded bg-stone-50 p-2 text-[10px] leading-4 text-stone-400">当前版型暂无已验证的 {slot.name} 组件</p>}{!slot.required && selection[slot.id] && <button type="button" onClick={() => commitSelection((current) => { const next = { ...current }; delete next[slot.id]; return next; })} className="mt-2 text-[10px] font-bold text-stone-400">清除此槽位</button>}</section>;
          })}
        </aside>
      </div>
    );
  }

  return (
    <div>
      {draftAvailable && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"><span><b>检测到未保存的本地设计草稿</b><span className="ml-2 text-amber-700">可恢复版型、组件选择和颜色，正式版本仍以服务端为准。</span></span><div className="flex gap-2"><button type="button" onClick={discardDraft} className="rounded border border-amber-300 bg-white px-3 py-1.5 font-bold">丢弃</button><button type="button" onClick={restoreDraft} className="rounded bg-amber-700 px-3 py-1.5 font-bold text-white">恢复草稿</button></div></div>}
      <div className="mb-5 flex items-center justify-between"><div><h2 className="text-base font-bold text-stone-900">我的结构化设计</h2><p className="mt-1 text-xs text-stone-500">版型、组件和调整参数均按精确版本保存</p></div><button type="button" onClick={startNew} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white">新建设计</button></div>
      {loading ? <div className="flex min-h-72 items-center justify-center text-sm text-stone-400">正在加载设计…</div> : designs.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white text-stone-400"><span className="material-symbols-outlined text-5xl">apparel</span><div className="mt-3 text-sm font-bold text-stone-600">还没有结构化设计</div><div className="mt-1 text-xs">从一个已发布版型开始组合主体、领口、袖口和纽扣</div></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{designs.map((design) => <article key={design.id} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"><div className="flex items-start justify-between"><div><h3 className="font-bold text-stone-900">{design.name}</h3><p className="mt-1 font-mono text-[10px] text-stone-400">{design.designCode}</p></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">{design.currentVersion ? `v${design.currentVersion.versionNo}` : '未固化'}</span></div><div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-lg bg-stone-50 p-3 text-xs"><span className="block text-[9px] font-bold text-stone-400">内容哈希</span><span className="mt-1 block truncate font-mono text-[9px] text-stone-600">{design.currentVersion?.contentHash ?? '-'}</span></div><div className="rounded-lg bg-stone-50 p-3 text-xs"><span className="block text-[9px] font-bold text-stone-400">成衣状态</span><span className="mt-1 block font-bold text-stone-600">{design.approvedGarmentId ? '内部已定稿' : '待生成'}</span></div></div><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => void editDesign(design)} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-bold text-stone-600 hover:bg-stone-50">编辑并建新版本</button>{canRender && <button type="button" disabled={!design.currentVersionId} onClick={() => setRenderDesign(design)} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-40">AI 生成成衣图</button>}{canTryon && design.approvedGarmentId && <button type="button" onClick={() => setTryonDesign(design)} className="col-span-2 rounded-lg border border-primary bg-primary/5 px-3 py-2 text-xs font-bold text-primary">授权模特一键上身</button>}{canPublish && design.approvedGarmentId && <button type="button" onClick={() => setPublishDesign(design)} className="col-span-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">成衣发布审核与加标导出</button>}</div></article>)}</div>}
      {renderDesign && <GarmentRenderDialog design={renderDesign} onClose={() => setRenderDesign(undefined)} onLocked={() => void loadDesigns()} />}
      {tryonDesign?.approvedGarmentId && <TryonDialog designId={tryonDesign.id} designName={tryonDesign.name} approvedGarmentId={tryonDesign.approvedGarmentId} canPublish={canPublish} canExportPublication={canExportPublication} onClose={() => setTryonDesign(undefined)} />}
      {publishDesign?.approvedGarmentId && <PublicationDialog targetType="APPROVED_GARMENT" targetId={publishDesign.approvedGarmentId} title={publishDesign.name} canExport={canExportPublication} onClose={() => setPublishDesign(undefined)} />}
    </div>
  );
}
