import React, { useEffect, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import {
  addRole,
  updateRole,
  type RoleInfo,
  type RoleFormPayload,
} from '../../api/roleMenu';
import { useConfirm } from '../common/ConfirmProvider';

export interface RoleEditDrawerProps {
  open: boolean;
  editingRole: RoleInfo | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  roleName: string;
  roleCode: string;
  description: string;
  sort: number;
  scope: 'CURRENT_DOMAIN' | 'SUB_DOMAIN';
  status: 'NORMAL' | 'DISABLED';
}

const EMPTY_FORM: FormState = {
  roleName: '',
  roleCode: '',
  description: '',
  sort: 0,
  scope: 'CURRENT_DOMAIN',
  status: 'NORMAL',
};

const ROLE_CODE_PATTERN = /^[A-Z0-9_]+$/;

export const RoleEditDrawer: React.FC<RoleEditDrawerProps> = ({
  open,
  editingRole,
  onClose,
  onSaved,
}) => {
  const confirm = useConfirm();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingRole) {
      setForm({
        roleName: editingRole.roleName ?? '',
        roleCode: editingRole.roleCode ?? '',
        description: editingRole.description ?? '',
        sort: 0,
        scope: editingRole.scope ?? 'CURRENT_DOMAIN',
        status: editingRole.status ?? 'NORMAL',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [open, editingRole]);

  if (!open) return null;

  const isEdit = !!editingRole;

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.roleName.trim()) next.roleName = '角色名称不能为空';
    else if (form.roleName.length > 20) next.roleName = '不能超过 20 个字符';

    if (!isEdit) {
      if (!form.roleCode.trim()) next.roleCode = '角色编码不能为空';
      else if (form.roleCode.length > 30) next.roleCode = '不能超过 30 个字符';
      else if (!ROLE_CODE_PATTERN.test(form.roleCode)) {
        next.roleCode = '仅支持大写字母、数字、下划线';
      }
    }

    if (form.description.length > 200) next.description = '不能超过 200 个字符';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const ok = await confirm({
      title: isEdit ? '保存角色' : '新建角色',
      message: isEdit
        ? `将更新「${form.roleName}」角色的配置,确认?`
        : `将创建新角色「${form.roleName}」,确认?`,
      confirmText: '保存',
    });
    if (!ok) return;

    setSaving(true);
    try {
      const payload: RoleFormPayload = {
        roleName: form.roleName.trim(),
        roleCode: form.roleCode.trim(),
        description: form.description.trim() || undefined,
        sort: form.sort,
        scope: form.scope,
        status: form.status,
      };
      if (isEdit && editingRole) {
        await updateRole({ id: editingRole.id, ...payload });
      } else {
        await addRole(payload);
      }
      onSaved();
      onClose();
    } catch {
      // http interceptor already toasts the error; keep drawer open
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-[#0B1C30]/50 backdrop-blur-xs cursor-pointer" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-[560px] bg-white shadow-2xl flex flex-col z-50">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              {isEdit ? `编辑角色: ${editingRole?.roleName ?? ''}` : '新建角色'}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              填写角色的基本信息。菜单权限请在「配置权限」中设置。
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <Field
            label="角色名称"
            required
            error={errors.roleName}
            input={
              <input
                type="text"
                value={form.roleName}
                onChange={(e) => setField('roleName', e.target.value)}
                maxLength={20}
                placeholder="例如:内容审核员"
                className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              />
            }
          />

          <Field
            label="角色编码"
            required={!isEdit}
            error={errors.roleCode}
            hint={isEdit ? '编码不可修改' : '创建后不可修改,仅支持大写字母/数字/下划线'}
            input={
              <input
                type="text"
                value={form.roleCode}
                onChange={(e) => setField('roleCode', e.target.value.toUpperCase())}
                disabled={isEdit}
                maxLength={30}
                placeholder="例如:CONTENT_REVIEWER"
                className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500"
              />
            }
          />

          <Field
            label="描述"
            error={errors.description}
            input={
              <textarea
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                maxLength={200}
                rows={2}
                placeholder="可选,简要说明该角色的职责"
                className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white resize-none"
              />
            }
          />

          <Field
            label="排序"
            input={
              <input
                type="number"
                value={form.sort}
                onChange={(e) => setField('sort', Number(e.target.value) || 0)}
                className="w-32 bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              />
            }
          />

          <Field
            label="作用域"
            required
            input={
              <Segmented
                value={form.scope}
                onChange={(v) => setField('scope', v as FormState['scope'])}
                options={[
                  { value: 'CURRENT_DOMAIN', label: '当前域' },
                  { value: 'SUB_DOMAIN', label: '子域' },
                ]}
              />
            }
          />

          <Field
            label="状态"
            required
            input={
              <Segmented
                value={form.status}
                onChange={(v) => setField('status', v as FormState['status'])}
                options={[
                  { value: 'NORMAL', label: '启用' },
                  { value: 'DISABLED', label: '停用' },
                ]}
              />
            }
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex justify-between items-center shrink-0">
          {Object.keys(errors).length > 0 ? (
            <span className="text-[10px] text-rose-500 font-semibold flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              请修正表单中标红的字段
            </span>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && (
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  input: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, required, hint, error, input }) => (
  <div className="space-y-1.5">
    <div className="flex items-baseline justify-between">
      <label className="text-[11px] font-semibold text-slate-700">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
    </div>
    {input}
    {error && <p className="text-[10px] text-rose-500 font-semibold">{error}</p>}
  </div>
);

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}

function Segmented<T extends string>({ value, onChange, options }: SegmentedProps<T>) {
  return (
    <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/60">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              active ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default RoleEditDrawer;
