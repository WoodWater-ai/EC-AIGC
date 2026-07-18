import { useState } from 'react';
import { Film, X, Upload } from 'lucide-react';
import { AssetTransitModal } from '../../../AssetTransitModal';

export interface VideoPickerFieldProps {
  field: {
    key: string;
    label: string;
    required?: boolean;
    placeholder?: string;
    helpText?: string;
  };
  value?: string;
  onChange: (value: string | null) => void;
}

export default function VideoPickerField({ field, value, onChange }: VideoPickerFieldProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">
        {field.label}{field.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {value ? (
        <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50">
          <div className="w-16 h-16 rounded bg-slate-200 flex items-center justify-center shrink-0">
            <Film className="w-6 h-6 text-slate-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{value.split('/').pop()}</div>
            <div className="text-xs text-slate-500">{value}</div>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="p-1.5 hover:bg-slate-200 rounded shrink-0"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-violet-400 hover:bg-violet-50 transition"
        >
          <Upload className="w-4 h-4 text-slate-500" />
          <span className="text-sm text-slate-600">选择视频 (mp4/mov)</span>
        </button>
      )}

      {field.helpText && <p className="text-xs text-slate-500">{field.helpText}</p>}

      {modalOpen && (
        <AssetTransitModal
          assetKind="VIDEO"
          onClose={() => setModalOpen(false)}
          onConfirmSelection={(items) => {
            const url = items[0]?.originalUrl ?? items[0]?.url ?? null;
            onChange(url);
            setModalOpen(false);
          }}
          multiSelect={false}
        />
      )}
    </div>
  );
}
