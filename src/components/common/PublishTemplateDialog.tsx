import React, { useEffect, useState } from 'react';
import { DialogFrame } from '../CreateImageTask/dialogs/DialogFrame';

interface PublishTemplateDialogProps {
  open: boolean;
  defaultName: string;
  onClose: () => void;
  onConfirm: (templateName: string) => Promise<void>;
}

/**
 * 统一的“设为模板”命名弹窗，复用创建任务 DialogFrame 的遮罩、动效和主题样式。
 */
export const PublishTemplateDialog: React.FC<PublishTemplateDialogProps> = ({
  open,
  defaultName,
  onClose,
  onConfirm,
}) => {
  const [name, setName] = useState(defaultName);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setName(defaultName);
  }, [defaultName, open]);

  const submit = async () => {
    const value = name.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(value);
    } catch {
      // 请求层已经展示具体错误，保留弹窗供用户修改后重试。
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogFrame
      open={open}
      title="设为模板"
      onClose={submitting ? () => undefined : onClose}
      footer={
        <>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!name.trim() || submitting}
            onClick={() => void submit()}
            className="h-9 rounded-lg bg-primary px-4 text-xs font-bold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? '发布中…' : '发布到模板营地'}
          </button>
        </>
      }
    >
      <p className="mb-3 text-slate-500">
        模板会保留可复用的创作参数；图片任务不会携带原商品和主体素材。
      </p>
      <label className="block">
        <span className="mb-1.5 block font-bold text-slate-700">模板名称</span>
        <input
          autoFocus
          maxLength={128}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit();
          }}
          placeholder="请输入模板名称"
          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/10"
        />
        <span className="mt-1 block text-right text-[10px] text-slate-400">{name.length}/128</span>
      </label>
    </DialogFrame>
  );
};
