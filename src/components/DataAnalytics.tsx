import React, { useState } from 'react';
import {
  Calendar,
  RefreshCw,
  Bolt,
  CheckCircle,
  TrendingUp,
  CreditCard,
  Briefcase,
  AlertCircle,
  Clock,
  Award,
  ChevronDown,
  FileBarChart
} from 'lucide-react';

export const DataAnalytics: React.FC = () => {
  // Filters State
  const [timeRange, setTimeRange] = useState('最近7天');
  const [assetType, setAssetType] = useState<'all' | 'image' | 'video'>('all');
  const [taskType, setTaskType] = useState('全部任务');
  const [modelChannel, setModelChannel] = useState('DaVinci-V4');

  // Interactive line-chart toggles
  const [trendUnit, setTrendUnit] = useState<'week' | 'month'>('week');

  const handleResetFilters = () => {
    setTimeRange('最近7天');
    setAssetType('all');
    setTaskType('全部任务');
    setModelChannel('DaVinci-V4');
  };

  // Metrics depending slightly on filters for realism
  const isImageFiltered = assetType === 'image';
  const isVideoFiltered = assetType === 'video';

  const efficiencyMetrics = {
    totalTasks: isImageFiltered ? 1248 : isVideoFiltered ? 382 : 1630,
    todayCompleted: isImageFiltered ? 112 : isVideoFiltered ? 30 : 142,
    dailyCapacityImg: isVideoFiltered ? '0' : '2,450',
    deliveryRate: '99.8%'
  };

  const qualityMetrics = {
    aestheticRatio: '92.4%',
    passRate: '89.4%',
    firstPassRate: '78.5%',
    rejectRate: '10.6%'
  };

  const costMetrics = {
    totalSpentPts: '1,245,600 Pts',
    todaySpentPts: '45,200 Pts',
    unitCostImgPts: '12.4 Pts',
    unitCostVideoPts: '120.0 Pts',
    percentage: 76.5
  };

  const assetMetrics = {
    archivedAssets: 8940,
    spuCoverage: '94.5%',
    curatedRatio: '85.2%',
    wasteRatio: '2.4%'
  };

  // Top 5 Template Rankings
  const leaderboard = [
    { rank: '01', title: '秋季女装上新场景', rate: '96.5% 通过', usage: '12,450 次', pct: 96.5 },
    { rank: '02', title: '极简白底图生成', rate: '94.2% 通过', usage: '8,320 次', pct: 94.2 },
    { rank: '03', title: '家居氛围感背景', rate: '88.7% 通过', usage: '5,102 次', pct: 88.7 },
    { rank: '04', title: '盛夏户外阳光与椰影', rate: '85.4% 通过', usage: '3,940 次', pct: 85.4 },
    { rank: '05', title: '赛博虚拟炫彩展架', rate: '82.1% 通过', usage: '2,450 次', pct: 82.1 },
  ];

  return (
    <div className="space-y-6" id="data-analytics-dashboard">
      
      {/* 1. Global Filters Section */}
      <section className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-5">
          {/* Time range selector */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">时间范围</span>
            <div className="relative">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="appearance-none pr-8 bg-transparent text-xs font-bold text-slate-700 outline-none border-0 p-0 cursor-pointer"
              >
                <option value="最近7天">最近7天</option>
                <option value="最近30天">最近30天</option>
                <option value="最近90天">最近90天</option>
              </select>
            </div>
          </div>

          <div className="w-px h-8 bg-slate-200/80 hidden sm:block" />

          {/* Asset Type Buttons */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">素材类型</span>
            <div className="flex bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/30">
              <button
                onClick={() => setAssetType('all')}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
                  assetType === 'all'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => setAssetType('image')}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
                  assetType === 'image'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                图片
              </button>
              <button
                onClick={() => setAssetType('video')}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
                  assetType === 'video'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                视频
              </button>
            </div>
          </div>

          <div className="w-px h-8 bg-slate-200/80 hidden sm:block" />

          {/* Task Type selector */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">任务类型</span>
            <div className="relative">
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="appearance-none pr-8 bg-transparent text-xs font-bold text-slate-700 outline-none border-0 p-0 cursor-pointer"
              >
                <option value="全部任务">全部任务</option>
                <option value="商品生成">商品生成</option>
                <option value="人像写真">人像写真</option>
                <option value="场景重绘">场景重绘</option>
              </select>
            </div>
          </div>

          <div className="w-px h-8 bg-slate-200/80 hidden sm:block" />

          {/* Model Channel Selector */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">模型通道</span>
            <div className="relative">
              <select
                value={modelChannel}
                onChange={(e) => setModelChannel(e.target.value)}
                className="appearance-none pr-8 bg-transparent text-xs font-bold text-slate-700 outline-none border-0 p-0 cursor-pointer"
              >
                <option value="DaVinci-V4">DaVinci-V4</option>
                <option value="SD XL">SD XL</option>
                <option value="Midjourney Proxy">Midjourney Proxy</option>
              </select>
            </div>
          </div>
        </div>

        {/* Reset Filters Trigger */}
        <button
          onClick={handleResetFilters}
          className="text-xs text-blue-600 font-bold hover:text-blue-700 flex items-center gap-1.5 px-3 py-1.5 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          重置筛选
        </button>
      </section>

      {/* 2. Bento Horizontal Grid of Four Core KPI Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        
        {/* Card 1: 生成效率口径 (Generation Efficiency) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-xs hover:border-blue-400/60 hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Bolt className="w-4 h-4 shrink-0 fill-current" />
            </div>
            <h3 className="text-xs font-bold text-slate-800">生成效率口径</h3>
          </div>
          <div className="grid grid-cols-2 gap-y-4 gap-x-2">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block leading-none mb-1">累计生成任务</span>
              <span className="text-lg font-extrabold text-slate-800 font-display">{efficiencyMetrics.totalTasks.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block leading-none mb-1">今日完成任务</span>
              <span className="text-lg font-extrabold text-slate-800 font-display">{efficiencyMetrics.todayCompleted}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block leading-none mb-1">日均生图能力</span>
              <span className="text-lg font-extrabold text-blue-600 font-display">{efficiencyMetrics.dailyCapacityImg} 张</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block leading-none mb-1">任务准时交付率</span>
              <span className="text-lg font-extrabold text-blue-600 font-display">{efficiencyMetrics.deliveryRate}</span>
            </div>
          </div>
        </div>

        {/* Card 2: 品质过审口径 (Quality Audit) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-xs hover:border-emerald-400/60 hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle className="w-4 h-4 shrink-0" />
            </div>
            <h3 className="text-xs font-bold text-slate-800">品质过审口径</h3>
          </div>
          <div className="grid grid-cols-2 gap-y-4 gap-x-2">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block leading-none mb-1">AI 预判高审美</span>
              <span className="text-lg font-extrabold text-slate-800 font-display">{qualityMetrics.aestheticRatio}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block leading-none mb-1">人工审核过审率</span>
              <span className="text-lg font-extrabold text-emerald-500 font-display">{qualityMetrics.passRate}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block leading-none mb-1">一次性过审率</span>
              <span className="text-lg font-extrabold text-emerald-500 font-display">{qualityMetrics.firstPassRate}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block leading-none mb-1">打回重绘率</span>
              <span className="text-lg font-extrabold text-rose-500 font-display">{qualityMetrics.rejectRate}</span>
            </div>
          </div>
        </div>

        {/* Card 3: 算力能效口径 (Compute Power Efficiency) */}
        <div className="bg-[#112233] text-white rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-sm transition-all">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-slate-800 text-blue-400 rounded-lg">
              <CreditCard className="w-4 h-4 shrink-0" />
            </div>
            <h3 className="text-xs font-bold text-slate-200">算力能效口径</h3>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block leading-none mb-1 uppercase tracking-wide">单图消耗</span>
                <span className="text-xs font-bold text-blue-300 font-mono">{costMetrics.unitCostImgPts}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block leading-none mb-1 uppercase tracking-wide">单视频消耗</span>
                <span className="text-xs font-bold text-blue-300 font-mono">{costMetrics.unitCostVideoPts}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold block leading-none mb-1 uppercase tracking-wide">累计消耗算力点数</span>
              <span className="text-lg font-extrabold text-white font-display block">{costMetrics.totalSpentPts}</span>
              
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${costMetrics.percentage}%` }} />
                </div>
                <span className="text-[9px] text-slate-400 font-mono font-bold leading-none">{costMetrics.percentage}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: 商用沉淀口径 (Commercial Accumulation) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-xs hover:border-slate-400/60 hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg">
              <Briefcase className="w-4 h-4 shrink-0" />
            </div>
            <h3 className="text-xs font-bold text-slate-800">商用沉淀口径</h3>
          </div>
          <div className="grid grid-cols-2 gap-y-4 gap-x-2">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block leading-none mb-1">累计沉淀入库</span>
              <span className="text-lg font-extrabold text-slate-800 font-display">{assetMetrics.archivedAssets.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block leading-none mb-1">商品 SPU 覆盖</span>
              <span className="text-lg font-extrabold text-slate-800 font-display">{assetMetrics.spuCoverage}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block leading-none mb-1">精选素材商用率</span>
              <span className="text-lg font-extrabold text-blue-600 font-display">{assetMetrics.curatedRatio}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block leading-none mb-1">废弃素材占比</span>
              <span className="text-lg font-extrabold text-slate-400 font-display">{assetMetrics.wasteRatio}</span>
            </div>
          </div>
        </div>

      </section>

      {/* 3. Charts Section Row 1 */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: 任务量与成本趋势 Line Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200/60 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-extrabold text-slate-800">任务量与成本趋势</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">展示各时段内总体生成任务量与费用产出对比</p>
            </div>
            {/* Week / Month Toggle */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/40">
              <button
                onClick={() => setTrendUnit('week')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                  trendUnit === 'week' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                周
              </button>
              <button
                onClick={() => setTrendUnit('month')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                  trendUnit === 'month' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                月
              </button>
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="h-64 w-full relative pt-2">
            <svg viewBox="0 0 600 240" className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="taskGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              <line x1="40" y1="30" x2="560" y2="30" stroke="#F1F5F9" strokeWidth="1" />
              <line x1="40" y1="80" x2="560" y2="80" stroke="#F1F5F9" strokeWidth="1" />
              <line x1="40" y1="130" x2="560" y2="130" stroke="#F1F5F9" strokeWidth="1" />
              <line x1="40" y1="180" x2="560" y2="180" stroke="#F1F5F9" strokeWidth="1" />
              <line x1="40" y1="210" x2="560" y2="210" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round" />

              {/* Coordinate scale */}
              <text x="12" y="34" fill="#94A3B8" fontSize="9" fontWeight="bold" fontFamily="monospace">3,000</text>
              <text x="12" y="84" fill="#94A3B8" fontSize="9" fontWeight="bold" fontFamily="monospace">2,000</text>
              <text x="12" y="134" fill="#94A3B8" fontSize="9" fontWeight="bold" fontFamily="monospace">1,000</text>
              <text x="12" y="184" fill="#94A3B8" fontSize="9" fontWeight="bold" fontFamily="monospace">500</text>
              <text x="25" y="214" fill="#94A3B8" fontSize="9" fontWeight="bold" fontFamily="monospace">0</text>

              {/* X Axis dates labels */}
              {trendUnit === 'week' ? (
                <>
                  <text x="40" y="228" fill="#94A3B8" fontSize="9" fontWeight="bold" textAnchor="middle">10.01</text>
                  <text x="126" y="228" fill="#94A3B8" fontSize="9" fontWeight="bold" textAnchor="middle">10.02</text>
                  <text x="212" y="228" fill="#94A3B8" fontSize="9" fontWeight="bold" textAnchor="middle">10.03</text>
                  <text x="298" y="228" fill="#94A3B8" fontSize="9" fontWeight="bold" textAnchor="middle">10.04</text>
                  <text x="384" y="228" fill="#94A3B8" fontSize="9" fontWeight="bold" textAnchor="middle">10.05</text>
                  <text x="470" y="228" fill="#94A3B8" fontSize="9" fontWeight="bold" textAnchor="middle">10.06</text>
                  <text x="556" y="228" fill="#94A3B8" fontSize="9" fontWeight="bold" textAnchor="middle">10.07</text>
                </>
              ) : (
                <>
                  <text x="40" y="228" fill="#94A3B8" fontSize="9" fontWeight="bold" textAnchor="middle">上旬</text>
                  <text x="298" y="228" fill="#94A3B8" fontSize="9" fontWeight="bold" textAnchor="middle">中旬</text>
                  <text x="556" y="228" fill="#94A3B8" fontSize="9" fontWeight="bold" textAnchor="middle">下旬</text>
                </>
              )}

              {/* Dataset 1: 任务量 (Task Count Solid Line & Area Fill) */}
              <path
                d="M 40 180 Q 126 120, 212 150 T 384 110 T 556 60 L 556 210 L 40 210 Z"
                fill="url(#taskGrad)"
              />
              <path
                d="M 40 180 Q 126 120, 212 150 T 384 110 T 556 60"
                fill="none"
                stroke="#2563EB"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Dataset 2: 成本 (Cost Dashed Line) */}
              <path
                d="M 40 200 Q 126 180, 212 190 T 384 170 T 556 150"
                fill="none"
                stroke="#0D9488"
                strokeWidth="2"
                strokeDasharray="5, 4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data points for Dataset 1 */}
              <circle cx="40" cy="180" r="3.5" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
              <circle cx="126" cy="140" r="3.5" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
              <circle cx="212" cy="150" r="3.5" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
              <circle cx="298" cy="120" r="3.5" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
              <circle cx="384" cy="130" r="3.5" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
              <circle cx="470" cy="90" r="3.5" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
              <circle cx="556" cy="100" r="3.5" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />

              {/* Data points for Dataset 2 */}
              <circle cx="40" cy="200" r="2.5" fill="#FFFFFF" stroke="#0D9488" strokeWidth="1.5" />
              <circle cx="126" cy="183" r="2.5" fill="#FFFFFF" stroke="#0D9488" strokeWidth="1.5" />
              <circle cx="212" cy="190" r="2.5" fill="#FFFFFF" stroke="#0D9488" strokeWidth="1.5" />
              <circle cx="298" cy="175" r="2.5" fill="#FFFFFF" stroke="#0D9488" strokeWidth="1.5" />
              <circle cx="384" cy="180" r="2.5" fill="#FFFFFF" stroke="#0D9488" strokeWidth="1.5" />
              <circle cx="470" cy="160" r="2.5" fill="#FFFFFF" stroke="#0D9488" strokeWidth="1.5" />
              <circle cx="556" cy="165" r="2.5" fill="#FFFFFF" stroke="#0D9488" strokeWidth="1.5" />
            </svg>
          </div>

          {/* Legend Area */}
          <div className="flex items-center justify-end gap-5 text-[10px] text-slate-400 font-bold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
              <span>任务量</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-teal-600 inline-block" />
              <span>成本 (¥)</span>
            </div>
          </div>
        </div>

        {/* Right: 生成失败原因分布 (1 col) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-extrabold text-slate-800">生成失败原因分布</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">多维特征归纳失败任务的核心问题</p>
          </div>

          {/* Ring Doughnut Chart using custom HTML/CSS */}
          <div className="flex justify-center items-center py-4 relative">
            <div className="w-36 h-36 relative flex items-center justify-center">
              {/* SVG circular progress representation of failure counts */}
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                {/* Gray back circle */}
                <circle cx="50" cy="50" r="40" fill="none" stroke="#F1F5F9" strokeWidth="8" />
                {/* 1. 主体跑偏: 45% (Red) */}
                <circle cx="50" cy="50" r="40" fill="none" stroke="#FF4D4F" strokeWidth="10" strokeDasharray="113 138" strokeDashoffset="0" />
                {/* 2. 肢体崩坏: 30% (Orange) */}
                <circle cx="50" cy="50" r="40" fill="none" stroke="#FF9900" strokeWidth="10" strokeDasharray="75.4 175.6" strokeDashoffset="-113" />
                {/* 3. 细节缺失: 15% (Green) */}
                <circle cx="50" cy="50" r="40" fill="none" stroke="#52C41A" strokeWidth="10" strokeDasharray="37.7 213.3" strokeDashoffset="-188.4" />
                {/* 4. 其他: 10% (Gray) */}
                <circle cx="50" cy="50" r="40" fill="none" stroke="#c2c6d8" strokeWidth="10" strokeDasharray="25.1 225.9" strokeDashoffset="-226.1" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-black text-slate-800 font-display">FAIL</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">诊断比率</span>
              </div>
            </div>
          </div>

          {/* Failure Reasons list */}
          <div className="space-y-1.5 text-[11px] font-semibold text-slate-600">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FF4D4F]" />
                主体跑偏
              </span>
              <span className="font-mono font-bold">45%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FF9900]" />
                肢体崩坏
              </span>
              <span className="font-mono font-bold">30%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#52C41A]" />
                细节缺失
              </span>
              <span className="font-mono font-bold">15%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#c2c6d8]" />
                其他
              </span>
              <span className="font-mono font-bold">10%</span>
            </div>
          </div>
        </div>

      </section>

      {/* 4. Charts Section Row 2 */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: 视频生成耗时分布 Doughnut Chart (1 col) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <h3 className="text-xs font-extrabold text-slate-800">视频生成耗时分布</h3>
              <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-500" />
                平均耗时: 4.2s
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">统计单次生成任务从排队到完成的延迟耗时段</p>
          </div>

          {/* Arc circle using pure SVG */}
          <div className="flex justify-center items-center py-5 relative">
            <div className="w-32 h-32 relative flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#F1F5F9" strokeWidth="6" />
                {/* < 2s (45%) (Green) */}
                <circle cx="50" cy="50" r="40" fill="none" stroke="#52C41A" strokeWidth="8" strokeDasharray="113 138" strokeDashoffset="0" />
                {/* 2s - 5s (35%) (Blue) */}
                <circle cx="50" cy="50" r="40" fill="none" stroke="#1D6FFF" strokeWidth="8" strokeDasharray="87.9 163.1" strokeDashoffset="-113" />
                {/* 5s - 10s (15%) (Teal) */}
                <circle cx="50" cy="50" r="40" fill="none" stroke="#00687b" strokeWidth="8" strokeDasharray="37.7 213.3" strokeDashoffset="-200.9" />
                {/* > 10s (5%) (Orange) */}
                <circle cx="50" cy="50" r="40" fill="none" stroke="#FF9900" strokeWidth="8" strokeDasharray="12.6 238.4" strokeDashoffset="-238.6" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-slate-800 font-display">TIME</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">区间配比</span>
              </div>
            </div>
          </div>

          {/* Time bracket ranges */}
          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#52C41A]" />
              &lt; 2s (45%)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#1D6FFF]" />
              2s - 5s (35%)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00687b]" />
              5s - 10s (15%)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FF9900]" />
              &gt; 10s (5%)
            </div>
          </div>
        </div>

        {/* Right: 模板效果排行榜 Top 5 (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200/60 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-extrabold text-slate-800">模板效果排行榜 Top 5</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">根据生成任务通过率与整体产出效率综合排行</p>
            </div>
            <button className="text-[10px] text-blue-600 font-bold hover:underline">
              查看全部
            </button>
          </div>

          {/* Leaderboard rows with progress bars */}
          <div className="space-y-4 pt-1">
            {leaderboard.map((item) => (
              <div key={item.rank} className="flex items-center gap-4">
                <span className="w-5 text-xs font-black text-blue-600 font-mono text-center">
                  {item.rank}
                </span>
                
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-700">{item.title}</span>
                    <span className="text-emerald-500">{item.rate}</span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full rounded-full"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>

                <span className="text-[10px] text-slate-400 font-bold font-mono min-w-[70px] text-right shrink-0">
                  {item.usage}
                </span>
              </div>
            ))}
          </div>
        </div>

      </section>

    </div>
  );
};
