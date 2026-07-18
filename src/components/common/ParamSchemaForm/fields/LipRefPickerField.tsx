import { useState } from 'react';
import { User, X, Upload } from 'lucide-react';
import { AssetTransitModal } from '../../../AssetTransitModal';

export interface LipRefPickerFieldProps {
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

export default function LipRefPickerField({ field, value, onChange }: LipRefPickerFieldProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">
        {field.label}{field.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {value ? (
        <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50">
          <img
            src={value}
            alt=""
            className="w-16 h-16 rounded object-cover shrink-0"
          />
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
          <User className="w-4 h-4 text-slate-500" />
          <span className="text-sm text-slate-600">选择参考人脸图 (jpg/png/webp)</span>
        </button>
      )}

      {field.helpText && <p className="text-xs text-slate-500">{field.helpText}</p>}

      {modalOpen && (
        <AssetTransitModal
          assetKind="IMAGE"
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
