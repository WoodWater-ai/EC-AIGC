import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Image as ImageIcon, LockKeyhole } from 'lucide-react';
import type { DictOption } from '../../../api/modules/dict';
import { withCosThumbnail } from '../../../utils/cosImage';

export interface StyleScenePoseRowProps {
  styleOptions: DictOption[];
  sceneOptions: DictOption[];
  poseOptions: DictOption[];
  loadingStyle?: boolean;
  loadingScene?: boolean;
  loadingPose?: boolean;
  style: string;
  scene: string;
  pose: string;
  onStyleChange: (value: string) => void;
  onSceneChange: (value: string) => void;
  onPoseChange: (value: string) => void;
  lockedByReference?: Partial<Record<PickerKind, string>>;
}

type PickerKind = 'style' | 'scene' | 'pose';

const ASSET_ROOT = '/mock-assets/tag-icons';

const DEMO_IMAGE_BY_CODE: Record<string, string> = {
  SWEET_CREAMY: `${ASSET_ROOT}/style-sweet-creamy.png`,
  QUIET_LUXURY: `${ASSET_ROOT}/style-quiet-luxury.png`,
  VINTAGE_HOME: `${ASSET_ROOT}/style-vintage-home.png`,
  EASTERN_MATURE: `${ASSET_ROOT}/style-eastern-mature.png`,
  NEW_CHINESE_MINIMAL: `${ASSET_ROOT}/style-new-chinese-minimal.png`,
  DOPAMINE_PLAYFUL: `${ASSET_ROOT}/style-dopamine-playful.png`,
  DARK_GOTHIC: `${ASSET_ROOT}/style-dark-gothic.png`,
  SWEET_COOL_STREET: `${ASSET_ROOT}/style-sweet-cool-street.png`,
  FRENCH_FEMININE: `${ASSET_ROOT}/style-french-feminine.png`,
  SWEET_INFLUENCER: `${ASSET_ROOT}/style-sweet-creamy.png`,
  PURE_DESIRE: `${ASSET_ROOT}/style-french-feminine.png`,
  MATURE: `${ASSET_ROOT}/style-eastern-mature.png`,
  CHINESE_TRADITIONAL: `${ASSET_ROOT}/style-new-chinese-minimal.png`,

  CREAMY_BEDROOM: `${ASSET_ROOT}/scene-creamy-bedroom.png`,
  QUIET_WINDOW: `${ASSET_ROOT}/scene-quiet-window.png`,
  VINTAGE_WOOD: `${ASSET_ROOT}/scene-vintage-wood.png`,
  LIGHT_HOME: `${ASSET_ROOT}/scene-light-home.png`,
  CHINESE_MINIMAL: `${ASSET_ROOT}/scene-chinese-minimal.png`,
  COLORFUL_ROOM: `${ASSET_ROOT}/scene-colorful-room.png`,
  DARK_HOME: `${ASSET_ROOT}/scene-dark-home.png`,
  WHITE_STUDIO: `${ASSET_ROOT}/scene-white-studio.png`,
  INDOOR: `${ASSET_ROOT}/scene-light-home.png`,
  OUTDOOR: `${ASSET_ROOT}/scene-vintage-wood.png`,

  NATURAL_STAND: `${ASSET_ROOT}/pose-natural-stand.svg`,
  THREE_QUARTER: `${ASSET_ROOT}/pose-three-quarter.svg`,
  BED_EDGE_SIT: `${ASSET_ROOT}/pose-bed-edge-sit.svg`,
  WINDOW_WALK: `${ASSET_ROOT}/pose-window-walk.svg`,
  SLEEVE_ADJUST: `${ASSET_ROOT}/pose-sleeve-adjust.svg`,
  TURN_BACK: `${ASSET_ROOT}/pose-turn-back.svg`,
  LOOK_BACK: `${ASSET_ROOT}/pose-look-back.svg`,
  ACTION_POSE: `${ASSET_ROOT}/pose-natural-stand.svg`,
};

const FALLBACK_IMAGES: Record<PickerKind, string[]> = {
  style: [
    `${ASSET_ROOT}/style-sweet-creamy.png`,
    `${ASSET_ROOT}/style-quiet-luxury.png`,
    `${ASSET_ROOT}/style-vintage-home.png`,
    `${ASSET_ROOT}/style-eastern-mature.png`,
    `${ASSET_ROOT}/style-new-chinese-minimal.png`,
  ],
  scene: [
    `${ASSET_ROOT}/scene-creamy-bedroom.png`,
    `${ASSET_ROOT}/scene-quiet-window.png`,
    `${ASSET_ROOT}/scene-vintage-wood.png`,
    `${ASSET_ROOT}/scene-light-home.png`,
    `${ASSET_ROOT}/scene-white-studio.png`,
  ],
  pose: [
    `${ASSET_ROOT}/pose-natural-stand.svg`,
    `${ASSET_ROOT}/pose-three-quarter.svg`,
    `${ASSET_ROOT}/pose-bed-edge-sit.svg`,
    `${ASSET_ROOT}/pose-window-walk.svg`,
    `${ASSET_ROOT}/pose-sleeve-adjust.svg`,
  ],
};

function optionImage(option: DictOption, kind: PickerKind, index: number): string {
  return option.imageUrl
    ?? DEMO_IMAGE_BY_CODE[option.value]
    ?? FALLBACK_IMAGES[kind][index % FALLBACK_IMAGES[kind].length];
}

interface VisualTagPickerProps {
  kind: PickerKind;
  label: string;
  value: string;
  options: DictOption[];
  loading?: boolean;
  onChange: (value: string) => void;
  lockedLabel?: string;
}

function VisualTagPicker({
  kind,
  label,
  value,
  options,
  loading,
  onChange,
  lockedLabel,
}: VisualTagPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const decoratedOptions = useMemo(
    () => options.map((option, index) => ({
      ...option,
      resolvedImageUrl: optionImage(option, kind, index),
    })),
    [kind, options],
  );
  const selected = decoratedOptions.find((option) => option.label === value);
  const isEmpty = !loading && decoratedOptions.length === 0;
  const disabled = Boolean(loading || isEmpty || lockedLabel);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        title={lockedLabel ? `${label}已由${lockedLabel}接管` : undefined}
        className={`flex h-9 max-w-[220px] items-center gap-2 rounded-md border bg-white py-1 pl-1 pr-2 text-left transition ${
          open
            ? 'border-primary ring-2 ring-primary/10'
            : 'border-slate-200 hover:border-primary/50 hover:bg-primary/5'
        } disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`}
      >
        {selected ? (
          <img
            src={withCosThumbnail(selected.resolvedImageUrl, 64) ?? selected.resolvedImageUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-7 w-7 shrink-0 rounded border border-slate-100 bg-slate-50 object-contain p-0.5"
          />
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-slate-100">
            <ImageIcon className="h-4 w-4 text-slate-400" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="mr-1 text-[10px] font-bold text-slate-400">{label}</span>
          <span className="text-[11px] font-bold text-slate-700">
            {lockedLabel || (loading ? '加载中…' : isEmpty ? '暂无可用字典项' : selected?.label || value || '不设置')}
          </span>
        </span>
        {lockedLabel
          ? <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          : <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />}
      </button>

      {open && !disabled && (
        <div className="absolute left-0 z-40 mt-2 max-h-80 w-[280px] overflow-y-auto rounded-md border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10">
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2.5 rounded p-1.5 text-left transition ${
              value === '' ? 'bg-primary/10' : 'hover:bg-slate-50'
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-slate-100 bg-slate-50">
              <ImageIcon className="h-4 w-4 text-slate-300" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-slate-800">不设置</span>
              <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                保持{label}为空
              </span>
            </span>
            {value === '' && <Check className="h-4 w-4 shrink-0 text-primary" />}
          </button>
          {decoratedOptions.map((option) => {
            const active = option.label === value;
            return (
              <button
                type="button"
                key={option.id}
                onClick={() => {
                  onChange(option.label);
                  setOpen(false);
                }}
                  className={`flex w-full items-center gap-2.5 rounded p-1.5 text-left transition ${
                  active ? 'bg-primary/10' : 'hover:bg-slate-50'
                }`}
              >
                <img
                  src={withCosThumbnail(option.resolvedImageUrl, 112) ?? option.resolvedImageUrl}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 shrink-0 rounded border border-slate-100 bg-slate-50 object-contain p-0.5"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-slate-800">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                    {option.description || `选择${option.label}作为${label}参考`}
                  </span>
                </span>
                {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const StyleScenePoseRow: React.FC<StyleScenePoseRowProps> = ({
  styleOptions,
  sceneOptions,
  poseOptions,
  loadingStyle,
  loadingScene,
  loadingPose,
  style,
  scene,
  pose,
  onStyleChange,
  onSceneChange,
  onPoseChange,
  lockedByReference,
}) => (
  <div className="contents">
    <VisualTagPicker
      kind="style"
      label="风格"
      value={style}
      options={styleOptions}
      loading={loadingStyle}
      onChange={onStyleChange}
      lockedLabel={lockedByReference?.style}
    />
    <VisualTagPicker
      kind="scene"
      label="场景"
      value={scene}
      options={sceneOptions}
      loading={loadingScene}
      onChange={onSceneChange}
      lockedLabel={lockedByReference?.scene}
    />
    <VisualTagPicker
      kind="pose"
      label="姿势"
      value={pose}
      options={poseOptions}
      loading={loadingPose}
      onChange={onPoseChange}
      lockedLabel={lockedByReference?.pose}
    />
  </div>
);
