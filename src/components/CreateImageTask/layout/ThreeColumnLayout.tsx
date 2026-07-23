// src/components/CreateImageTask/layout/ThreeColumnLayout.tsx
import React from 'react';

export interface ThreeColumnLayoutProps {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
}

/**
 * 三栏栅格:左 300px(素材) + 中 1fr(任务/商品事实/Prompt) + 右 380px(模型/规格)
 * mobile 单栏堆叠(xl 断点 1280+ 切三栏)
 */
export const ThreeColumnLayout: React.FC<ThreeColumnLayoutProps> = ({ left, center, right }) => (
  <main className="flex-1 overflow-y-auto p-5 grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_380px] gap-5">
    <section className="space-y-4">{left}</section>
    <section className="space-y-5">{center}</section>
    <section className="space-y-4">{right}</section>
  </main>
);
