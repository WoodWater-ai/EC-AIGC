// src/components/CreateImageTask/right/ImageSettingsSection.tsx
// 右栏"任务参数"卡片(对齐 demo 主版):通道实例/能力/模型 3 级选择器 + 能力参数 schema 动态表单
import React, { useEffect } from 'react';
import { useTaskParams } from '../../createTask/useTaskParams';
import { ParamSchemaForm } from '../../common/ParamSchemaForm';
import { UnsupportedNotice } from './UnsupportedNotice';
import { messages } from '../../../labels/createImageTask';

export interface TaskParamsSnapshot {
  channelId: string | null;
  channelType: string | null;
  capability: string | null;
  modelId: string | null;
}

/** ratio 由 useCreateImageTaskState 内部维护;本节不再展示。
 *  在 ImageTypeSelector 顶部 banner 加一句话提示"比例由图片类型决定 + 上方头部显示",
 *  让用户感知到 ratio 实际由 schema 与 image-set 联动,而不是孤立选择。
 */
export interface ImageSettingsSectionProps {
  /** 已废弃:由 useTaskParams.isSupported 真实判定(基于 Vidu 能力 schema);
   *  保留仅为不破坏调用方,实际不再使用。 */
  isSupported?: boolean;
  /** 选中状态变化时通知父组件,父组件用于 submit payload 的 channelInstanceId/modelId */
  onParamsChange?: (snapshot: TaskParamsSnapshot) => void;
}

export const ImageSettingsSection: React.FC<ImageSettingsSectionProps> = ({
  onParamsChange,
}) => {
  // 通道实例 / 能力 / 模型 三级联动 — 与 demo 创建图片任务 "任务参数"一致
  const tp = useTaskParams('IMAGE', null);

  // 选中状态变化时通知父组件
  useEffect(() => {
    onParamsChange?.({
      channelId: tp.channelId,
      channelType: tp.channelType,
      capability: tp.capability,
      modelId: tp.modelId,
    });
  }, [tp.channelId, tp.channelType, tp.capability, tp.modelId, onParamsChange]);

  return (
    <div
      id="image-settings-section"
      className="bg-white border border-slate-200 rounded-lg p-5"
    >
      <p className="text-[11px] font-bold text-primary">执行参数</p>
      <h2 className="text-base font-black mt-1">
        {messages.header.title.replace('新建多类型图片任务', '任务参数与输出规格')}
      </h2>

      {/* ① 通道实例 chips(对齐 demo) */}
      <div className="mt-4">
        <label className="block text-xs font-bold text-slate-700 mb-1.5">
          通道实例{tp.locked && ' 🔒'}
        </label>
        <div className="flex flex-wrap gap-2">
          {tp.instances.map((inst) => (
            <button
              key={inst.id}
              type="button"
              disabled={tp.locked}
              onClick={() => tp.setChannelId(inst.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 ${
                tp.channelId === inst.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : tp.locked
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400'
              }`}
            >
              {inst.channelName}
              <span className="text-[9px] px-1 rounded bg-slate-200 text-slate-700">{inst.channelType}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ② 能力 chips */}
      {tp.channelType && (
        <div className="mt-3">
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            能力{tp.locked && ' 🔒'}
          </label>
          <div className="flex flex-wrap gap-2">
            {tp.capabilitiesInChannel.map((cap) => (
              <button
                key={cap.code}
                type="button"
                disabled={tp.locked}
                onClick={() => tp.setCapability(cap.code)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1 ${
                  tp.capability === cap.code
                    ? 'bg-blue-600 text-white border-blue-600'
                    : tp.locked
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400'
                }`}
              >
                {cap.label}
                {cap.isAsync && (
                  <span className="text-[9px] px-1 rounded bg-purple-100 text-purple-700">async</span>
                )}
              </button>
            ))}
            {tp.capabilitiesInChannel.length === 0 && (
              <div className="text-xs text-slate-400 py-1">
                该实例未开通该类型能力,请在系统配置 → 模型通道统管开通,或换其他实例
              </div>
            )}
          </div>
        </div>
      )}

      {/* ③ 模型 select */}
      {tp.capability && (
        <div className="mt-3">
          <label className="block text-xs font-bold text-slate-700 mb-1.5">模型</label>
          <select
            value={tp.modelId ?? ''}
            onChange={(e) => tp.setModelId(e.target.value || null)}
            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
          >
            <option value="">
              {tp.modelsInGroup.length > 0
                ? `默认模型 (${tp.modelsInGroup[0].model})`
                : '未配默认模型 (手填)'}
            </option>
            {tp.modelsInGroup.map((m) => (
              <option key={m.model} value={m.model}>{m.model}</option>
            ))}
          </select>
        </div>
      )}

      {/* ④ 比例由选择的图片类型 + 模型能力共同决定,此处不再展示 */}
      <p className="mt-3 text-[10px] text-slate-400">
        输出比例与图片尺寸由当前所选图片类型 + 模型能力自动匹配,顶部状态栏实时显示。
      </p>

      {/* ⑤ 能力参数 schema 动态表单(对齐 demo 的 `ParamSchemaForm`) */}
      {tp.schema && (
        <div className="mt-4">
          <label className="block text-xs font-bold text-slate-700 mb-2">能力参数</label>
          <ParamSchemaForm
            schema={tp.schema}
            value={tp.schemaParams}
            onChange={tp.setSchemaParams}
            recommendValues={tp.recommendValues}
          />
        </div>
      )}

      {/* 由 useTaskParams.isSupported 真实判定(基于 Vidu 能力 schema + 当前 schemaParams),
          取代之前用写死 model.capability 的旧判定 */}
      <UnsupportedNotice show={!tp.isSupported} />
    </div>
  );
};