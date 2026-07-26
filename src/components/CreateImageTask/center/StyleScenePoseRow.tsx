// src/components/CreateImageTask/center/StyleScenePoseRow.tsx
import React from 'react';
import type { DictOption } from '../../../api/modules/dict';

export interface StyleScenePoseRowProps {
  // 数据
  styleOptions: DictOption[];
  sceneOptions: DictOption[];
  poseOptions:  DictOption[];
  // 加载态(来自 useDictOptions.loading)
  loadingStyle?: boolean;
  loadingScene?: boolean;
  loadingPose?:  boolean;
  // 值与变更
  style: string; scene: string; pose: string;
  onStyleChange: (v: string) => void;
  onSceneChange: (v: string) => void;
  onPoseChange:  (v: string) => void;
}

interface RenderSelectArgs {
  label: string;
  value: string;
  options: DictOption[];
  loading?: boolean;
  onChange: (v: string) => void;
}

function renderSelect({ label, value, options, loading, onChange }: RenderSelectArgs) {
  const isEmpty = !loading && options.length === 0;
  const disabled = loading || isEmpty;
  // 本组件 value 语义 = 中文 itemName(toDictOptions 的 opt.value 是 itemCode 英文枚举,
  // 这里取 opt.label 即 itemName 作为 select value,保证提交到 prompt 拼接的是中文)
  const valueInOptions = options.some((o) => o.label === value);
  const placeholder = loading
    ? '加载中…'
    : isEmpty
      ? '暂无数据,请联系管理员'
      : null;

  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-700">{label}</span>
      <select
        className="mt-1.5 w-full h-9 px-2 rounded border border-slate-200 bg-white text-xs font-bold disabled:bg-slate-50 disabled:text-slate-400"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {placeholder !== null && <option value="">{placeholder}</option>}
        {value && !valueInOptions && (
          <option value={value}>{value} (已不在字典中)</option>
        )}
        {options.map((opt) => (
          <option key={opt.id} value={opt.label}>{opt.label}</option>
        ))}
      </select>
    </label>
  );
}

export const StyleScenePoseRow: React.FC<StyleScenePoseRowProps> = ({
  styleOptions, sceneOptions, poseOptions,
  loadingStyle, loadingScene, loadingPose,
  style, scene, pose,
  onStyleChange, onSceneChange, onPoseChange,
}) => (
  <div className="grid md:grid-cols-3 gap-3">
    {renderSelect({ label: '风格', value: style, options: styleOptions, loading: loadingStyle, onChange: onStyleChange })}
    {renderSelect({ label: '场景', value: scene, options: sceneOptions, loading: loadingScene, onChange: onSceneChange })}
    {renderSelect({ label: '姿势', value: pose,  options: poseOptions,  loading: loadingPose,  onChange: onPoseChange })}
  </div>
);
