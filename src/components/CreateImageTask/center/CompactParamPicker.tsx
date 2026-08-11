import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface CompactParamOption {
  value: string;
  label: string;
  description?: string;
}

interface CompactParamPickerProps {
  label: string;
  value: string;
  options: CompactParamOption[];
  icon: React.ReactNode;
  disabled?: boolean;
  placeholder?: string;
  widthClassName?: string;
  onChange: (value: string) => void;
}

export const CompactParamPicker: React.FC<CompactParamPickerProps> = ({
  label,
  value,
  options,
  icon,
  disabled = false,
  placeholder = '请选择',
  widthClassName = 'w-[148px]',
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const unavailable = options.length === 0;
  const pickerDisabled = disabled || unavailable;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className={`relative min-w-0 max-w-full ${widthClassName}`}>
      <button
        type="button"
        disabled={pickerDisabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={(selected?.label ?? value) || undefined}
        onClick={() => setOpen((current) => !current)}
        className={`flex h-9 w-full items-center gap-2 rounded-md border bg-white py-1 pl-1 pr-2 text-left transition ${
          open
            ? 'border-primary ring-2 ring-primary/10'
            : 'border-slate-200 hover:border-primary/50 hover:bg-primary/5'
        } disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-100 bg-slate-50 text-slate-500">
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate">
          <span className="mr-1 text-[10px] font-bold text-slate-400">{label}</span>
          <span className="text-[11px] font-bold text-slate-700">
            {(selected?.label ?? value) || (unavailable ? '暂无可用项' : placeholder)}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !pickerDisabled && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 z-40 mt-2 max-h-80 w-[240px] max-w-[min(240px,calc(100vw-32px))] overflow-y-auto rounded-md border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10"
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                type="button"
                role="option"
                aria-selected={active}
                key={option.value || '__empty'}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded p-1.5 text-left transition ${
                  active ? 'bg-primary/10' : 'hover:bg-slate-50'
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-slate-100 bg-slate-50 text-slate-500">
                  {icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-slate-800">
                    {option.label}
                  </span>
                  {option.description && (
                    <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                      {option.description}
                    </span>
                  )}
                </span>
                {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
