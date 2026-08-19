// src/components/CreateImageTask/dialogs/ExecutionConfirmDialog.tsx
import React from 'react';
import { DialogFrame } from './DialogFrame';
import { messages } from '../../../labels/createImageTask';
import type { ImageGenerationType } from '../../../lib/createImageTask/readinessChecks';

export interface ExecutionConfirmDialogProps {
  open: boolean;
  isSubmitting?: boolean;
  /** 任务摘要 — 弹窗主体显示 */
  summary?: {
    productName: string;
    templateName: string;
    selectedTypes: ImageGenerationType[];
    typeCounts: Record<ImageGenerationType, number>;
    totalCount: number;
    ratio: string;
    resolution: string;
  };
  /** [2026-08-19] 预估消耗(CNY,后端 preflight 接口返回);null 表示不在本地定价表中 */
  estimatedCost?: number | null;
  /** [2026-08-19] preflight 加载状态(用于弹窗内 loading 占位) */
  isPreflighting?: boolean;
  /** 提交并跳转任务列表 */
  onSubmit: () => void;
  /** [2026-08-15] 仅提交:关闭弹框但不跳转,右侧结果面板轮询展示 */
  onSubmitOnly?: () => void;
  onCancel: () => void;
}

export const ExecutionConfirmDialog: React.FC<ExecutionConfirmDialogProps> = ({
  open, isSubmitting, summary, estimatedCost, isPreflighting,
  onSubmit, onSubmitOnly, onCancel,
}) => {
  /**
   * 预估消耗展示文案:
   * - isPreflighting: loading
   * - estimatedCost 有效数字:显示 CNY
   * - estimatedCost == null(后端不在定价表中):显示 "以实际 credits 为准"
   * - estimatedCost == 0:显示 "免费"
   */
  const renderEstimatedCost = (): string => {
    if (isPreflighting) return '加载中…';
    if (estimatedCost == null) return '以实际 credits 为准';
    if (estimatedCost === 0) return '免费';
    return `CNY ${estimatedCost.toFixed(2)}`;
  };
  return (
    <DialogFrame
      open={open}
      title={messages.executeConfirm.title}
      onClose={isSubmitting ? onCancel : onCancel}
      maxWidthClassName="max-w-lg"
      footer={
        <>
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded disabled:opacity-50"
          >
            {messages.executeConfirm.cancel}
          </button>
          {onSubmitOnly && (
            <button
              onClick={onSubmitOnly}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-xs font-bold text-primary border border-primary/40 rounded hover:bg-primary/5 disabled:opacity-50"
            >
              {isSubmitting ? '提交中…' : '仅提交'}
            </button>
          )}
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-xs font-bold text-white bg-primary rounded disabled:opacity-50"
          >
            {isSubmitting ? '提交中…' : '提交并跳转'}
          </button>
        </>
      }
    >
      {summary ? (
        <div className="space-y-2 text-slate-700">
          <div className="flex justify-between"><span>商品名称</span><span className="font-bold">{summary.productName}</span></div>
          <div className="flex justify-between"><span>模板</span><span className="font-bold">{summary.templateName}</span></div>
          <div className="flex justify-between">
            <span>生成图片类型</span>
            <span className="font-bold">
              {summary.selectedTypes.map((t) => `${messages.type[t]} × ${summary.typeCounts[t]}`).join('、')}
            </span>
          </div>
          <div className="flex justify-between"><span>总张数</span><span className="font-bold">{summary.totalCount} 张</span></div>
          <div className="flex justify-between"><span>规格</span><span className="font-bold">{summary.ratio} / {summary.resolution}</span></div>
          <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
            <span className="font-bold">预估消耗</span>
            <span className="font-bold text-primary">{renderEstimatedCost()}</span>
          </div>
        </div>
      ) : (
        <div className="text-slate-600 text-xs">请确认本次生成。</div>
      )}
    </DialogFrame>
  );
};
