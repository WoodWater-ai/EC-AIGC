// src/components/CreateImageTask/center/StyleScenePoseRow.tsx
import React from 'react';
import { messages } from '../../../labels/createImageTask';

export interface StyleScenePoseRowProps {
  style: string; scene: string; pose: string;
  onStyleChange: (v: string) => void;
  onSceneChange: (v: string) => void;
  onPoseChange: (v: string) => void;
}

const fieldClass = 'mt-1.5 w-full h-9 px-2 rounded border border-slate-200 bg-white text-xs font-bold';

export const StyleScenePoseRow: React.FC<StyleScenePoseRowProps> = ({
  style, scene, pose,
  onStyleChange, onSceneChange, onPoseChange,
}) => (
  <div className="grid md:grid-cols-3 gap-3">
    <label className="block">
      <span className="text-xs font-bold text-slate-700">风格</span>
      <select className={fieldClass} value={style} onChange={(e) => onStyleChange(e.target.value)}>
        {messages.styleOptions.map((opt) => <option key={opt}>{opt}</option>)}
      </select>
    </label>
    <label className="block">
      <span className="text-xs font-bold text-slate-700">场景</span>
      <select className={fieldClass} value={scene} onChange={(e) => onSceneChange(e.target.value)}>
        {messages.sceneOptions.map((opt) => <option key={opt}>{opt}</option>)}
      </select>
    </label>
    <label className="block">
      <span className="text-xs font-bold text-slate-700">姿势</span>
      <select className={fieldClass} value={pose} onChange={(e) => onPoseChange(e.target.value)}>
        {messages.poseOptions.map((opt) => <option key={opt}>{opt}</option>)}
      </select>
    </label>
  </div>
);
