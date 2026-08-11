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
  <main className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto bg-[#f4f6f8] p-3 lg:grid-cols-[264px_minmax(0,1fr)_320px] lg:items-stretch lg:overflow-hidden lg:p-4">
    <section className="min-w-0 space-y-3 lg:overflow-y-auto lg:pr-1">{left}</section>
    <section className="min-w-0 space-y-3 lg:overflow-y-auto lg:px-1">{center}</section>
    <aside className="min-w-0 lg:min-h-0">{right}</aside>
  </main>
);
