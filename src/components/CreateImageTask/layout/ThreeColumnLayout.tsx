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
  <main className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 xl:grid-cols-[290px_minmax(540px,1fr)_330px] xl:overflow-hidden">
    <section className="min-w-0 space-y-3 xl:overflow-y-auto xl:pr-1">{left}</section>
    <section className="min-w-0 xl:overflow-y-auto xl:pr-1">{center}</section>
    <section className="min-w-0 space-y-3 xl:overflow-y-auto">{right}</section>
  </main>
);
