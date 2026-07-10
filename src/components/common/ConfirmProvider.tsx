import React, { createContext, useCallback, useContext, useState } from 'react';
import { X } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export const useConfirm = (): ((opts: ConfirmOptions) => Promise<boolean>) => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx.confirm;
};

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<{
    open: boolean;
    options: ConfirmOptions | null;
    resolver: ((v: boolean) => void) | null;
  }>({ open: false, options: null, resolver: null });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, options, resolver: resolve });
    });
  }, []);

  const handleClose = (result: boolean) => {
    if (state.resolver) state.resolver(result);
    setState({ open: false, options: null, resolver: null });
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state.open && state.options && (
        <ConfirmDialog
          title={state.options.title}
          message={state.options.message}
          confirmText={state.options.confirmText}
          cancelText={state.options.cancelText}
          danger={state.options.danger}
          onConfirm={() => handleClose(true)}
          onCancel={() => handleClose(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
};

const ConfirmDialog: React.FC<ConfirmOptions & { onConfirm: () => void; onCancel: () => void }> = ({
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-[#0B1C30]/40 backdrop-blur-xs"
        onClick={onCancel}
      />
      <div className="relative bg-white rounded-xl shadow-2xl w-[420px] max-w-[90vw] p-5 z-10">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <button
            onClick={onCancel}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="text-xs text-slate-600 leading-relaxed mb-5">{message}</div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white font-semibold text-xs rounded-lg shadow-sm ${
              danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmProvider;
