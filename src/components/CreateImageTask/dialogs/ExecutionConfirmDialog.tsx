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
  onSubmit: () => void;
  onCancel: () => void;
}

export const ExecutionConfirmDialog: React.FC<ExecutionConfirmDialogProps> = ({
  open, isSubmitting, summary, onSubmit, onCancel,
}) => {
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
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-xs font-bold text-white bg-primary rounded disabled:opacity-50"
          >
            {isSubmitting ? '提交中…' : messages.executeConfirm.submit}
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
        </div>
      ) : (
        <div className="text-slate-600 text-xs">请确认本次生成。</div>
      )}
    </DialogFrame>
  );
};
