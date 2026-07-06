import { useState } from 'react';
import { AppScreen, GenerationTask, AdTemplate, ProductAsset, SystemUser, SystemNotification, ModelChannel } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { TaskList } from './components/TaskList';
import { CreateImageTask } from './components/CreateImageTask';
import { CreateVideoTask } from './components/CreateVideoTask';
import { TemplateCenter } from './components/TemplateCenter';
import { ProductAssetLibrary } from './components/ProductAssetLibrary';
import { DataAnalytics } from './components/DataAnalytics';
import { SystemConfig } from './components/SystemConfig';
import { AssetTransitModal } from './components/AssetTransitModal';

import {
  mockTasks,
  mockProducts,
  mockTemplates,
  mockModelChannels,
  mockUsers,
  mockNotifications
} from './mockData';

export default function App() {
  // Navigation Router state
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.DASHBOARD);

  // Core local states
  const [tasks, setTasks] = useState<GenerationTask[]>(mockTasks);
  const [products, setProducts] = useState<ProductAsset[]>(mockProducts);
  const [templates, setTemplates] = useState<AdTemplate[]>(mockTemplates);
  const [channels, setChannels] = useState<ModelChannel[]>(mockModelChannels);
  const [users, setUsers] = useState<SystemUser[]>(mockUsers);
  const [currentUser, setCurrentUser] = useState<SystemUser>(mockUsers[0]);
  const [notifications, setNotifications] = useState<SystemNotification[]>(mockNotifications);

  // Chosen contextual states (Shared between views)
  const [selectedProduct, setSelectedProduct] = useState<ProductAsset>(mockProducts[0]);
  const [isProductDrawerOpen, setIsProductDrawerOpen] = useState(false);
  const [isTransitOpen, setIsTransitOpen] = useState(false);

  // State Mutators
  const handleAddTask = (newTask: GenerationTask) => {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === newTask.id);
      if (idx > -1) {
        // Update
        const updated = [...prev];
        updated[idx] = newTask;
        return updated;
      }
      return [newTask, ...prev];
    });
  };

  const handleUpdateTask = (updatedTask: GenerationTask) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
  };

  const handleAddTemplate = (newTemp: AdTemplate) => {
    setTemplates(prev => [newTemp, ...prev]);
  };

  const handleUpdateTemplate = (updatedTemp: AdTemplate) => {
    setTemplates(prev => prev.map(t => t.id === updatedTemp.id ? updatedTemp : t));
  };

  const handleToggleChannel = (id: string) => {
    setChannels(prev => prev.map(ch => ch.id === id ? { ...ch, status: ch.status === 'active' ? 'inactive' : 'active' } : ch));
  };

  const handleUpdateUserRole = (userId: string, newRole: any) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    if (currentUser.id === userId) {
      setCurrentUser(prev => ({ ...prev, role: newRole }));
    }
  };

  const handleMarkAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // Render Core content wrapper switcher
  const renderScreenContent = () => {
    switch (currentScreen) {
      case AppScreen.DASHBOARD:
        return (
          <Dashboard
            tasks={tasks}
            products={products}
            setScreen={setCurrentScreen}
            setSelectedProduct={setSelectedProduct}
            openProductDrawer={() => setIsProductDrawerOpen(true)}
          />
        );
      case AppScreen.TASKS:
        return (
          <TaskList
            tasks={tasks}
            products={products}
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            setScreen={setCurrentScreen}
          />
        );
      case AppScreen.CREATE_IMAGE_TASK:
        return (
          <div className="p-4 text-center text-slate-400">已在独立窗口打开</div>
        );
      case AppScreen.CREATE_VIDEO_TASK:
        return (
          <div className="p-4 text-center text-slate-400">已在独立窗口打开</div>
        );
      case AppScreen.TEMPLATES:
        return (
          <TemplateCenter
            templates={templates}
            onAddTemplate={handleAddTemplate}
            onUpdateTemplate={handleUpdateTemplate}
            setScreen={setCurrentScreen}
          />
        );
      case AppScreen.ASSETS:
        return (
          <ProductAssetLibrary
            products={products}
            selectedProduct={selectedProduct}
            setSelectedProduct={setSelectedProduct}
            isDrawerOpen={isProductDrawerOpen}
            setIsDrawerOpen={setIsProductDrawerOpen}
            setScreen={setCurrentScreen}
          />
        );
      case AppScreen.ANALYTICS:
        return <DataAnalytics />;
      case AppScreen.SYSTEM_CONFIG:
        return (
          <SystemConfig
            channels={channels}
            users={users}
            onToggleChannel={handleToggleChannel}
            onUpdateUserRole={handleUpdateUserRole}
          />
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2">construction</span>
            页面正在施工中
          </div>
        );
    }
  };

  if (currentScreen === AppScreen.CREATE_IMAGE_TASK) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-white">
        <CreateImageTask
          products={products}
          templates={templates}
          onAddTask={handleAddTask}
          setScreen={setCurrentScreen}
          openTransit={() => setIsTransitOpen(true)}
          selectedProduct={selectedProduct}
          setSelectedProduct={setSelectedProduct}
        />
        {isTransitOpen && (
          <AssetTransitModal
            products={products}
            selectedProduct={selectedProduct}
            onSelectProduct={setSelectedProduct}
            onClose={() => setIsTransitOpen(false)}
          />
        )}
      </div>
    );
  }

  if (currentScreen === AppScreen.CREATE_VIDEO_TASK) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-white">
        <CreateVideoTask
          products={products}
          templates={templates}
          onAddTask={handleAddTask}
          setScreen={setCurrentScreen}
          openTransit={() => setIsTransitOpen(true)}
          selectedProduct={selectedProduct}
          setSelectedProduct={setSelectedProduct}
        />
        {isTransitOpen && (
          <AssetTransitModal
            products={products}
            selectedProduct={selectedProduct}
            onSelectProduct={setSelectedProduct}
            onClose={() => setIsTransitOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg-base font-sans antialiased text-[#0B1C30]" id="app-root-container">
      
      {/* 1. Sidebar Nav */}
      <Sidebar
        currentScreen={currentScreen}
        setScreen={setCurrentScreen}
        users={users}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        openTransit={() => setIsTransitOpen(true)}
      />

      {/* 2. Main Area (Header + Scrollable Body) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Header toolbar */}
        <Header
          currentScreen={currentScreen}
          setScreen={setCurrentScreen}
          currentUser={currentUser}
          notifications={notifications}
          markAllAsRead={handleMarkAllNotificationsAsRead}
        />

        {/* Scrollable Workspace panel */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8" id="main-content-scroll">
          {renderScreenContent()}
        </main>
      </div>

      {/* 3. Global Modal Overlay: Asset Transit Station */}
      {isTransitOpen && (
        <AssetTransitModal
          products={products}
          selectedProduct={selectedProduct}
          onSelectProduct={setSelectedProduct}
          onClose={() => setIsTransitOpen(false)}
        />
      )}

    </div>
  );
}
