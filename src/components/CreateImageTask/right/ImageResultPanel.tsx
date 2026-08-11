import React from 'react';
import { Images, Sparkles } from 'lucide-react';
import type { ImageGenerationType } from '../../../lib/createImageTask/readinessChecks';
import type { TaskParamsSnapshot } from './ImageSettingsSection';

interface ImageResultPanelProps {
  selectedTypes: ImageGenerationType[];
  totalCount: number;
  params: TaskParamsSnapshot;
  onGenerate: () => void;
}

const outputSpec = (params: TaskParamsSnapshot) => {
  const ratio = params.schemaParams?.aspect_ratio;
  const resolution = params.schemaParams?.resolution;
  return [ratio, resolution].filter(Boolean).join(' · ') || '等待模型参数';
};

export const ImageResultPanel: React.FC<ImageResultPanelProps> = ({
  selectedTypes,
  totalCount,
  params,
  onGenerate,
}) => (
  <section id="image-result-panel" className="flex min-h-[540px] h-full flex-col overflow-hidden rounded-[7px] border border-[#dfe3e8] bg-white">
    <div className="flex items-center justify-between border-b border-[#e5e8ed] px-3 py-3">
      <h2 className="text-xs font-black">本次生成结果</h2>
      <span className="bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-700">
        待生成 · {totalCount} 张
      </span>
    </div>

    <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400">
        <Images className="h-6 w-6" />
      </span>
      <p className="mt-3 text-xs font-black text-slate-700">结果将在这里显示</p>
      <p className="mt-2 max-w-56 text-[10px] leading-5 text-slate-400">
        提交后可离开页面，任务会在后台继续；任务列表会自动恢复进度与最终结果。
      </p>

      <dl className="mt-5 w-full border-y border-slate-100 py-3 text-left text-[10px]">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-400">图片类型</dt>
          <dd className="font-bold text-slate-700">{selectedTypes.length} 类</dd>
        </div>
        <div className="mt-2 flex justify-between gap-3">
          <dt className="text-slate-400">生成数量</dt>
          <dd className="font-bold text-slate-700">{totalCount} 张</dd>
        </div>
        <div className="mt-2 flex justify-between gap-3">
          <dt className="text-slate-400">模型</dt>
          <dd className="max-w-40 truncate font-bold text-slate-700" title={params.modelId ?? ''}>
            {params.modelId || '等待默认路由'}
          </dd>
        </div>
        <div className="mt-2 flex justify-between gap-3">
          <dt className="text-slate-400">输出规格</dt>
          <dd className="font-bold text-slate-700">{outputSpec(params)}</dd>
        </div>
      </dl>
    </div>

    <div className="border-t border-[#e5e8ed] p-3">
      <button
        type="button"
        onClick={onGenerate}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#df5b43] text-xs font-bold text-white hover:bg-[#cb4d37]"
      >
        <Sparkles className="h-4 w-4" />
        检查并生成 {totalCount} 张
      </button>
      <p className="mt-2 text-center text-[9px] leading-4 text-slate-400">
        提交前会展示完整校验、耗时与失败处理策略。
      </p>
    </div>
  </section>
);
