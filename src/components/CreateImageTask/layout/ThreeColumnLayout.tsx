// src/components/CreateImageTask/layout/ThreeColumnLayout.tsx
import React from 'react';

export interface ThreeColumnLayoutProps {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
}

/**
 * 三栏栅格:对齐 demo 的紧凑工作台比例。
 * mobile 单栏堆叠(xl 断点 1280+ 切三栏)
 */
export const ThreeColumnLayout: React.FC<ThreeColumnLayoutProps> = ({ left, center, right }) => (
  <main className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[260px_minmax(480px,1fr)_300px]">
    <section className="min-w-0 space-y-3">{left}</section>
    <section className="min-w-0">{center}</section>
    <section className="min-w-0 space-y-3">{right}</section>
  </main>
);
