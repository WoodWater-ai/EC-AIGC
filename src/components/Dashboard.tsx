import React, { useState } from 'react';
import { GenerationTask, ProductAsset, AppScreen } from '../types';

interface DashboardProps {
  tasks: GenerationTask[];
  products: ProductAsset[];
  setScreen: (screen: AppScreen) => void;
  setSelectedProduct: (product: ProductAsset) => void;
  openProductDrawer: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  tasks,
  products,
  setScreen,
  setSelectedProduct,
  openProductDrawer
}) => {
  // Find current running tasks
  const runningTasks = tasks.filter(t => t.status === 'running');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const failedTasks = tasks.filter(t => t.status === 'failed');

  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month'>('week');

  // Multi-grain statistics metrics based on wireframe/PRD requirements
  const metricsData = {
    day: {
      timeLabel: '今日',
      images: { val: '45', unit: '张', change: '较昨日 -8%', isUp: false, sub: 'GPU 算力负载正常' },
      videos: { val: '12', unit: '段', change: '较昨日 +15%', isUp: true, sub: '算力排队无明显延时' },
      imgCost: { val: '￥1.20', unit: '/张', change: '较昨日 +5%', isUp: true, sub: '折合算力 12 Pts' },
      videoCost: { val: '￥4.50', unit: '/条', change: '较昨日 -2%', isUp: false, sub: '折合算力 45 Pts' }
    },
    week: {
      timeLabel: '本周',
      images: { val: '312', unit: '张', change: '较上周 +12%', isUp: true, sub: '达芬奇通道利用率 88%' },
      videos: { val: '84', unit: '段', change: '较上周 +24%', isUp: true, sub: '算力首帧加速提升' },
      imgCost: { val: '￥0.95', unit: '/张', change: '较上周 -14%', isUp: false, sub: '高复用性模板降低摊销' },
      videoCost: { val: '￥3.80', unit: '/条', change: '较上周 -8%', isUp: false, sub: '排版脚本复用减少算力' }
    },
    month: {
      timeLabel: '本月',
      images: { val: '1,280', unit: '张', change: '较上月 +35%', isUp: true, sub: '主图审核通过率 98.2%' },
      videos: { val: '320', unit: '段', change: '较上月 +42%', isUp: true, sub: '视频画质合格率 95%' },
      imgCost: { val: '￥0.82', unit: '/张', change: '较上月 -18%', isUp: false, sub: '首批模板库量产优势' },
      videoCost: { val: '￥3.20', unit: '/条', change: '较上月 -12%', isUp: false, sub: '自研 3.5 算力成本优化' }
    }
  };

  const activeMetrics = metricsData[timeFilter];

  // Todo Items
  const todoItems = [
    { id: 'todo-1', title: '审核“MW Series 7”生成宣传海报', desc: '陈美晴 提交 · 等待二审确认', priority: 'high', type: 'audit' },
    { id: 'todo-2', title: '补充“轻便防风羽绒服”侧面去背底图', desc: '运营 提报 · 素材分辨率不足', priority: 'medium', type: 'upload' },
    { id: 'todo-3', title: '复制修复“极地防寒羽绒服_动态飞雪”超时任务', desc: '系统建议 · 调降为中等画质重试', priority: 'low', type: 'fix' },
  ];

  return (
    <div className="space-y-6">
      {/* Time Grain Selector and Analytics Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs gap-4">
        <div>
          <h2 className="text-sm font-extrabold text-[#0B1C30] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-xl font-bold">monitoring</span>
            智能生成多维数据看板
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            根据日、周、月统计口径动态计算图片/视频生成数以及可用折合单价成本，契合财务与效能双重闭环审计。
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 self-end sm:self-auto">
          {(['day', 'week', 'month'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                timeFilter === filter
                  ? 'bg-white text-[#0B1C30] shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {filter === 'day' ? '按日统计' : filter === 'week' ? '按周统计' : '按月统计'}
            </button>
          ))}
        </div>
      </div>

      {/* Bento Grid Metrics Header (Dynamic Cost and Volumetric Stats) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Image Generation Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">{activeMetrics.timeLabel}图片生成数</span>
            <h3 className="text-3xl font-extrabold font-display text-slate-800 mt-1">{activeMetrics.images.val} <span className="text-sm font-normal text-slate-500">{activeMetrics.images.unit}</span></h3>
            <span className={`text-[10px] font-bold flex items-center gap-1 mt-1.5 ${activeMetrics.images.isUp ? 'text-success' : 'text-rose-500'}`}>
              <span className="material-symbols-outlined text-xs">{activeMetrics.images.isUp ? 'trending_up' : 'trending_down'}</span>
              {activeMetrics.images.change}
            </span>
            <span className="text-[9px] text-slate-400 block mt-1 font-medium">{activeMetrics.images.sub}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">photo_library</span>
          </div>
        </div>

        {/* Card 2: Video Generation Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">{activeMetrics.timeLabel}视频生成数</span>
            <h3 className="text-3xl font-extrabold font-display text-slate-800 mt-1">{activeMetrics.videos.val} <span className="text-sm font-normal text-slate-500">{activeMetrics.videos.unit}</span></h3>
            <span className={`text-[10px] font-bold flex items-center gap-1 mt-1.5 ${activeMetrics.videos.isUp ? 'text-success' : 'text-rose-500'}`}>
              <span className="material-symbols-outlined text-xs">{activeMetrics.videos.isUp ? 'trending_up' : 'trending_down'}</span>
              {activeMetrics.videos.change}
            </span>
            <span className="text-[9px] text-slate-400 block mt-1 font-medium">{activeMetrics.videos.sub}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-success flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">video_library</span>
          </div>
        </div>

        {/* Card 3: Cost Per Usable Image */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">单图可用成本</span>
            <h3 className="text-3xl font-extrabold font-display text-slate-800 mt-1">{activeMetrics.imgCost.val} <span className="text-sm font-normal text-slate-500">{activeMetrics.imgCost.unit}</span></h3>
            <span className={`text-[10px] font-bold flex items-center gap-1 mt-1.5 ${!activeMetrics.imgCost.isUp ? 'text-success' : 'text-rose-500'}`}>
              <span className="material-symbols-outlined text-xs">{!activeMetrics.imgCost.isUp ? 'trending_down' : 'trending_up'}</span>
              {activeMetrics.imgCost.change} (可用效能)
            </span>
            <span className="text-[9px] text-slate-400 block mt-1 font-medium">{activeMetrics.imgCost.sub}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-warning flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">payments</span>
          </div>
        </div>

        {/* Card 4: Cost Per Usable Video */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">单条视频可用成本</span>
            <h3 className="text-3xl font-extrabold font-display text-slate-800 mt-1">{activeMetrics.videoCost.val} <span className="text-sm font-normal text-slate-500">{activeMetrics.videoCost.unit}</span></h3>
            <span className={`text-[10px] font-bold flex items-center gap-1 mt-1.5 ${!activeMetrics.videoCost.isUp ? 'text-success' : 'text-rose-500'}`}>
              <span className="material-symbols-outlined text-xs">{!activeMetrics.videoCost.isUp ? 'trending_down' : 'trending_up'}</span>
              {activeMetrics.videoCost.change} (算法调优)
            </span>
            <span className="text-[9px] text-slate-400 block mt-1 font-medium">{activeMetrics.videoCost.sub}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">universal_currency_alt</span>
          </div>
        </div>
      </div>

      {/* Main Core Viewport: 2/3 Dashboard + 1/3 Action Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2/3: Active Task & Recent Assets */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active Generation Task Monitor */}
          {runningTasks.length > 0 && (
            <div className="bg-gradient-to-r from-slate-900 via-[#0B1C30] to-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10" />
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono">DaVinci GPU Core 实时渲染中</span>
                </div>
                <span className="text-xs bg-primary/20 text-primary border border-primary/30 px-2.5 py-0.5 rounded-full font-semibold">
                  批次生图进度
                </span>
              </div>

              {runningTasks.map(task => (
                <div key={task.id} className="flex flex-col md:flex-row gap-5 items-center">
                  <div className="relative group shrink-0">
                    <img
                      src={task.productImg}
                      alt={task.productName}
                      className="w-20 h-20 rounded-xl object-cover border border-slate-700/60"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-100">
                      <span className="material-symbols-outlined text-white text-xl animate-spin">sync</span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <h4 className="text-sm font-bold text-white truncate">{task.name}</h4>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                          <span>关联产品: {task.productName}</span>
                          <span className="text-slate-600">|</span>
                          <span>选用模板: {task.templateName}</span>
                        </p>
                      </div>
                      <span className="text-lg font-bold font-mono text-primary text-right">{task.progress}%</span>
                    </div>

                    {/* Progress Bar with Glow */}
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-2 relative">
                      <div
                        className="bg-gradient-to-r from-primary to-blue-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center mt-3 text-[11px] text-slate-400 font-mono">
                      <span>已用时 12s · 预估剩余 6s</span>
                      <span>线路通道: {task.modelChannel}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent Approved / Generated Assets Grid */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-base font-bold text-[#0B1C30]">最近产出高保真广告素材</h3>
                <p className="text-xs text-slate-400 mt-1">此处展示已审核通过、并自动完成智能排版的素材。可随时加入资源中心。</p>
              </div>
              <button
                onClick={() => setScreen(AppScreen.TASKS)}
                className="text-xs text-primary font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                查看全部 <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </button>
            </div>

            {/* Assets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {products.slice(0, 4).map((product) => (
                <div
                  key={product.id}
                  onClick={() => {
                    setSelectedProduct(product);
                    openProductDrawer();
                  }}
                  className="group bg-slate-50 hover:bg-white rounded-xl p-3 border border-slate-100 hover:border-slate-200 transition-all cursor-pointer card-hover flex gap-3.5"
                >
                  <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-slate-200 relative">
                    <img
                      src={product.thumbnail}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute top-1 left-1 text-[8px] px-1.5 py-0.5 rounded-md bg-black/60 text-white backdrop-blur-xs font-semibold">
                      {product.category}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#0B1C30] truncate group-hover:text-primary transition-colors">{product.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {product.sku}</p>
                    </div>
                    
                    <div className="flex items-center justify-between text-[10px] mt-1.5">
                      <span className="text-slate-500 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">folder</span> {product.imageCount}张素材 / {product.videoCount}段视频
                      </span>
                      <span className="text-primary font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                        详细 <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1/3: Action Hub & To-Do List */}
        <div className="space-y-6">
          
          {/* Action Hub - ToDo List */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-[#0B1C30] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-lg text-primary">playlist_add_check</span>
                协作待办与提案
              </h3>
              <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">
                3 件待处理
              </span>
            </div>

            <div className="space-y-3">
              {todoItems.map((todo) => (
                <div key={todo.id} className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/60 border border-slate-100 transition-colors">
                  <div className="flex gap-2.5">
                    <span className={`material-symbols-outlined text-lg shrink-0 ${
                      todo.priority === 'high' ? 'text-danger' : todo.priority === 'medium' ? 'text-warning' : 'text-slate-400'
                    }`}>
                      {todo.type === 'audit' ? 'gavel' : todo.type === 'upload' ? 'cloud_upload' : 'build'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 leading-tight mb-0.5">{todo.title}</p>
                      <p className="text-[10px] text-slate-400">{todo.desc}</p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-1.5 mt-2.5">
                    <button className="px-2 py-1 text-[10px] text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-md font-medium transition-all cursor-pointer">
                      忽略
                    </button>
                    <button className="px-2.5 py-1 text-[10px] bg-primary-light text-primary hover:bg-primary/20 rounded-md font-bold transition-all cursor-pointer">
                      立即處理
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Prompt / Creative Suggestions Card */}
          <div className="bg-gradient-to-br from-[#EBF2FF] to-white rounded-2xl p-5 border border-blue-100/80 shadow-sm relative overflow-hidden">
            <div className="absolute -bottom-10 -right-10 w-28 h-28 bg-primary/5 rounded-full blur-xl" />
            <h3 className="text-sm font-bold text-primary flex items-center gap-1.5 mb-2">
              <span className="material-symbols-outlined text-lg">lightbulb_circle</span>
              达芬奇 AI 灵感库
            </h3>
            <p className="text-xs text-slate-500 leading-normal mb-3.5">
              检测到本周“美妆护肤”类别需求大增。系统为您自动推荐“极简北欧冷淡风大理石”模板，点击下方即可一键应用于“臻颜精华乳”。
            </p>
            <button
              onClick={() => setScreen(AppScreen.CREATE_IMAGE_TASK)}
              className="w-full py-2 bg-primary text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-primary-hover active:scale-98 cursor-pointer transition-all duration-150"
            >
              一键采用并开始
              <span className="material-symbols-outlined text-xs">chevron_right</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
