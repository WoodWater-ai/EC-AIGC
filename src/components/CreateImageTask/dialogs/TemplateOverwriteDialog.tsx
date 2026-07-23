// src/components/CreateImageTask/dialogs/TemplateOverwriteDialog.tsx
import React from 'react';
import { DialogFrame } from './DialogFrame';
import { messages } from '../../../labels/createImageTask';

export interface TemplateOverwriteDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TemplateOverwriteDialog: React.FC<TemplateOverwriteDialogProps> = ({
  open, onConfirm, onCancel,
}) => {
  return (
    <DialogFrame
      open={open}
      title={messages.overwrite.title}
      onClose={onCancel}
      footer={
        <>
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {messages.overwrite.cancel}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 text-xs rounded bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            {messages.overwrite.confirm}
          </button>
        </>
      }
    >
      <p>{messages.overwrite.desc}</p>
    </DialogFrame>
  );
};
