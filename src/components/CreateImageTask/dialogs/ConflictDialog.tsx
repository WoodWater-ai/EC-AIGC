// src/components/CreateImageTask/dialogs/ConflictDialog.tsx
import React from 'react';
import { DialogFrame } from './DialogFrame';
import { messages } from '../../../labels/createImageTask';

export interface ConflictDialogProps {
  open: boolean;
  /** 需要填入 desc 的字段名列表，如 ["比例", "尺寸"] */
  fields: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConflictDialog: React.FC<ConflictDialogProps> = ({
  open, fields, onConfirm, onCancel,
}) => {
  return (
    <DialogFrame
      open={open}
      title={messages.conflict.title}
      onClose={onCancel}
      footer={
        <>
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {messages.conflict.cancel}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 text-xs rounded bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            {messages.conflict.confirm}
          </button>
        </>
      }
    >
      <p>{messages.conflict.desc.replace('{fields}', fields.join('、'))}</p>
    </DialogFrame>
  );
};
