// src/components/CreateImageTask/dialogs/DialogFrame.tsx
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface DialogFrameProps {
  open: boolean;
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  /** 测宽:w-full max-w-md → w-full max-w-lg */
  maxWidthClassName?: string;
}

export const DialogFrame: React.FC<DialogFrameProps> = ({
  open, title, onClose, children, footer, maxWidthClassName,
}) => {
  const primaryRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    primaryRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`relative bg-white rounded-lg w-full p-6 shadow-xl ${maxWidthClassName ?? 'max-w-md'}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.16 }}
          >
            <h2 className="text-base font-black text-slate-800">{title}</h2>
            <div className="mt-3 text-xs text-slate-600 leading-5">{children}</div>
            <div className="mt-5 flex justify-end gap-2">
              {footer}
              {/* 把第一个 button 设为 primary 用于 autoFocus(Escape 关闭) */}
              <span ref={primaryRef as any} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
