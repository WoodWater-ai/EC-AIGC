import React, { useMemo } from 'react';
import { Edit, Trash2, Shield } from 'lucide-react';
import type { PermissionPoint } from '../../types';

interface PermissionPointTableProps {
  points: PermissionPoint[];
  loading: boolean;
  onEdit: (point: PermissionPoint) => void;
  onDelete: (id: string) => void;
}

export const PermissionPointTable: React.FC<PermissionPointTableProps> = ({
  points,
  loading,
  onEdit,
  onDelete,
}) => {
  const grouped = useMemo(() => {
    const map = new Map<string, PermissionPoint[]>();
    for (const p of points) {
      const key = p.module || '未分组';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [points]);

  if (loading) {
    return (
      <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 font-bold">
        加载中...
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 font-bold">
        <Shield className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        暂无权限点，点击右上角 [+ 新建权限点] 添加
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map(([module, items]) => (
        <div
          key={module}
          className="bg-white rounded-xl border border-slate-200/60 overflow-hidden shadow-xs"
        >
          <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-700">{module}</span>
            <span className="text-[10px] text-slate-400 font-mono">
              ({items.length} 个权限点)
            </span>
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/30 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="py-3 px-5 w-44">权限点编码</th>
                <th className="py-3 px-5 w-40">权限点名称</th>
                <th className="py-3 px-5">权限描述</th>
                <th className="py-3 px-5 w-32 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
              {items.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="py-3 px-5 font-mono text-blue-600 font-bold">
                    {p.code}
                  </td>
                  <td className="py-3 px-5 font-bold text-slate-800">{p.name}</td>
                  <td className="py-3 px-5 text-slate-400">
                    {p.description || '—'}
                  </td>
                  <td className="py-3 px-5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => onEdit(p)}
                        className="text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        编辑
                      </button>
                      <button
                        onClick={() => onDelete(p.id)}
                        className="text-rose-500 hover:text-rose-700 flex items-center gap-0.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

export default PermissionPointTable;
