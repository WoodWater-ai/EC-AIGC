import React, { useState, useRef } from 'react';
import { ProductAsset } from '../types';

export interface TransitAsset {
  id: string;
  name: string;
  url: string;
  category: '全部图片' | '已上传图片' | '最新编辑' | '商品图库';
  tag: string; // e.g. "商品原图", "白底图", "风格参考"
  date: string;
}

interface AssetTransitModalProps {
  products: ProductAsset[];
  onClose: () => void;
  onSelectProduct?: (product: ProductAsset) => void;
  selectedProduct?: ProductAsset;
  onConfirmSelection?: (selectedUrls: string[]) => void;
  targetSlot?: string;
}

// Scanned folder mocked files map
const folderMockFiles: Record<string, { name: string; url: string; tag: string }[]> = {
  '/assets/brand_wear/': [
    { name: 'Model_Autumn_Coat_01.jpg', url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=500&q=80', tag: '商品原图' },
    { name: 'Fleece_Sweater_Detail.jpg', url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=500&q=80', tag: '商品原图' },
    { name: 'Casual_Pants_Beige.jpg', url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=500&q=80', tag: '白底图' },
    { name: 'Autumn_Vibe_Lookbook.jpg', url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=500&q=80', tag: '风格参考' }
  ],
  '/assets/skincare_line/': [
    { name: 'Organic_Serum_Green.png', url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=500&q=80', tag: '白底图' },
    { name: 'Hydration_Cream_Pot.jpg', url: 'https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?auto=format&fit=crop&w=500&q=80', tag: '商品原图' },
    { name: 'Skincare_Glow_Essence.jpg', url: 'https://images.unsplash.com/photo-1608248597481-496100c8c836?auto=format&fit=crop&w=500&q=80', tag: '商品原图' }
  ],
  '/assets/tech_watches/': [
    { name: 'Smart_Band_Active.jpg', url: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?auto=format&fit=crop&w=500&q=80', tag: '商品原图' },
    { name: 'Titanium_Case_Macro.jpg', url: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=400&q=80', tag: '风格参考' }
  ],
  '/assets/luxury_jewelry/': [
    { name: 'Gold_Ring_Diamond.jpg', url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=500&q=80', tag: '白底图' },
    { name: 'Silver_Necklace_Display.jpg', url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=500&q=80', tag: '商品原图' }
  ]
};

export const AssetTransitModal: React.FC<AssetTransitModalProps> = ({
  products,
  onClose,
  onSelectProduct,
  selectedProduct,
  onConfirmSelection,
  targetSlot = 'main'
}) => {
  const [activeNav, setActiveNav] = useState<'全部图片' | '已上传图片' | '最新编辑' | '商品图库'>('全部图片');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');

  // Local assets matching the prototype
  const [assets, setAssets] = useState<TransitAsset[]>([
    {
      id: 'ta1',
      name: 'MW_Series_7_Silver.jpg',
      url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCUV_M9m78EPGiJsk8SksM9F1eQT_pDSxsoPobZrIAJXIP1WiZ6OS6mD6qTmy__1staNUOhUUzM2Kl569mAx02RsQi41SQyJZ949ZEIYY313fN2ifWHO7DtBQk5lESZWNucVpx5h9mkd8OZIdkV4GO-mqyq4Bu-XgveqUce50rvBGmirhcQrtG85mpwAbaOh3y-kAVVTynZJnoNQu9QyJYx-3NL1OA4Cw8OhgGqIUaKRbs1KeZxQggY',
      category: '商品图库',
      tag: '商品原图',
      date: '2023-11-24'
    },
    {
      id: 'ta2',
      name: 'Skincare_Collection_A.png',
      url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB2GNJdWM7mTReEcL1U4UKK9pLWFkFqbPL-H25g3TWwcGbG0mEAafJEJuIjyOVvrLsqzgI9ekLLXeRlmyZ9f8dzjlIdmvdbQxj2gqqW4l6CjwT8eQvkQnNGr77tuiKxQBEeMbzCJFDOqJw6S4moG98xkl7xhNbN-BNqTOSw5T2d2eZDEGEYJWDKSgPJF6V1aHG_iTojfqDsz5XzU9cYVAYztDJ00erRSJgp8l-plaSzjmDPwAdbhHNt',
      category: '已上传图片',
      tag: '白底图',
      date: '2023-11-23'
    },
    {
      id: 'ta3',
      name: 'Concept_UI_Device.jpg',
      url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBs9GAGYGGDD3WdvTtkEaIKLItrTfzE1qVFLYV_uXHB1OPx6hwUn5V0HfwRlW-q0tyuXsaGfDY324XofzNGZJA-Hndzc2fHXU2XAOg8xVVSDqkI-ihdhKLuHnnGlc2rcC7FAfZXLTjkEiAVe4NVSkmenTJ_Ru_Fly4hP7I2ccdTCjg6ogm4Bmo-8NQ2D3WPttv8N3b8zigmhZA70BSnBySNnFevgO9Mx8CDrSYGjy-c2EQkCOYQoNOg',
      category: '最新编辑',
      tag: '风格参考',
      date: '2023-11-23'
    },
    {
      id: 'ta4',
      name: 'Interior_Furn_02.png',
      url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAL8BL7B508lmbaob7sE1xAkzipIvZ4d-fLkl55GcdgvnapfvTqmLtWyjXdvne8ljl013dv6ELcYq_0nIAD692idYejWuV4GA7SWuwxh2icKBQE8W0SLZvZxBqSFey28x7T5ebCBE4YPjUeTbQert8sgxQaU5YJaMXjCO2qJdX-iEQJFJZakBBhcxdCrFziUsiiLk6LPWgOa5_j-Fi7nQlzDZ3YQ8m3O8EdNPBhwjFULnjiqX3SoZ-8',
      category: '商品图库',
      tag: '商品原图',
      date: '2023-11-22'
    },
    {
      id: 'ta5',
      name: 'Texture_Tech_01.jpg',
      url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAvbzOUFydR_-NWPrpgFtXaJ9Rlr6aOwsW-Y_OwPkY626vvV34KrNkdS6IsZWMxTy6ZOtK9PU-S5WXPLs6ozo0yPy0glPBxWLgx9IxqsbctP9FxdCYf5F_BQLnDtr7jP7cjUk_xhLQbh7miC42cR1Rgyb5zKUaeGQHUsPAcDiX5j-SNi7MnCcK66b9iShMib2i2rEEMIxS5vjOfsJuNQh86Li8y2BcxxyG5VQcvyOdLIRF038Kzrk10',
      category: '最新编辑',
      tag: '风格参考',
      date: '2023-11-22'
    },
    {
      id: 'ta6',
      name: 'Jewelry_Set_Silver.png',
      url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAXDPJnVzfXmolJYMd37Y_EPyzCwfK_kMl7DSqroTd_Gukz5pTHEgShVT99lNqWamWCsdg4Ls_EXIHWvxHffI0diU-pzlpj0pOXv3Fmm_moP9P7qUth0DBYUgJJSiukV60UrWtMBHQqawVTGQYS6wTbVXD1LUKi0HSTirWcPLs9Taz73HvP07KRkaPJL7cXZFDReUwZXkGqfOm4MD89M2wLwOOAqo5ioi33k_lxNmOWuUbQ18IpAa6Z',
      category: '已上传图片',
      tag: '白底图',
      date: '2023-11-21'
    }
  ]);

  // Selected asset list
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(['ta1', 'ta3', 'ta4', 'ta5', 'ta6']);

  // Directory Scan Drawer overlay state
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [scanPath, setScanPath] = useState('/assets/brand_wear/');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedFiles, setScannedFiles] = useState<{ name: string; url: string; tag: string; checked: boolean }[]>([]);
  const [hasScanned, setHasScanned] = useState(false);

  // Hidden inputs refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter logic
  const filteredAssets = assets.filter(item => {
    // Nav category
    if (activeNav !== '全部图片') {
      if (item.category !== activeNav) return false;
    }
    // Search query
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    // Date filter
    if (dateFilter && item.date !== dateFilter) return false;
    // Material Type / Tag filter
    if (tagFilter && item.tag !== tagFilter) return false;

    return true;
  });

  const handleCardClick = (id: string) => {
    if (selectedAssetIds.includes(id)) {
      setSelectedAssetIds(prev => prev.filter(x => x !== id));
    } else {
      setSelectedAssetIds(prev => [...prev, id]);
    }
  };

  const handleClearSelection = () => {
    setSelectedAssetIds([]);
  };

  const handleConfirmSelection = () => {
    // Get URLs for selected items
    const urls = assets.filter(a => selectedAssetIds.includes(a.id)).map(a => a.url);
    if (urls.length === 0) {
      alert('请至少选择一个资源！');
      return;
    }
    
    if (onConfirmSelection) {
      onConfirmSelection(urls);
    } else if (onSelectProduct && products.length > 0) {
      // Compatibility with existing standard product model selection
      // Find a product that matches selected asset URL or name
      const selectedItem = assets.find(a => selectedAssetIds.includes(a.id));
      const matchedProduct = products.find(p => p.thumbnail === selectedItem?.url || p.name.includes(selectedItem?.name.split('_')[0] || ''));
      if (matchedProduct) {
        onSelectProduct(matchedProduct);
      } else {
        onSelectProduct({
          ...products[0],
          name: selectedItem?.name.replace(/\.[^/.]+$/, "") || products[0].name,
          thumbnail: selectedItem?.url || products[0].thumbnail
        });
      }
    }
    onClose();
  };

  // Local File Upload
  const handleLocalUploadTrigger = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleLocalUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files) as File[];
      const newUploaded: TransitAsset[] = files.map((file, idx) => {
        const fileUrl = URL.createObjectURL(file);
        return {
          id: `uploaded-${Date.now()}-${idx}`,
          name: file.name,
          url: fileUrl,
          category: '已上传图片',
          tag: '已上传素材',
          date: new Date().toISOString().split('T')[0]
        };
      });

      setAssets(prev => [...newUploaded, ...prev]);
      // Select the newly uploaded assets automatically
      const newIds = newUploaded.map(u => u.id);
      setSelectedAssetIds(prev => [...prev, ...newIds]);
      alert(`成功上传并解析 ${newUploaded.length} 个本地素材！已自动添加到中转站列表中。`);
    }
  };

  // Directory scanning simulator
  const handleTriggerScan = () => {
    setIsScanning(true);
    setHasScanned(false);
    setTimeout(() => {
      setIsScanning(false);
      setHasScanned(true);
      const files = folderMockFiles[scanPath] || [
        { name: 'Custom_Scanned_Asset_01.jpg', url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=500&q=80', tag: '商品原图' },
        { name: 'Custom_Scanned_Asset_02.jpg', url: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=500&q=80', tag: '风格参考' }
      ];
      setScannedFiles(files.map(f => ({ ...f, checked: true })));
    }, 1000);
  };

  const handleImportScanned = () => {
    const checkedFiles = scannedFiles.filter(f => f.checked);
    if (checkedFiles.length === 0) {
      alert('请至少勾选一个扫描到的文件进行导入！');
      return;
    }

    const importedAssets: TransitAsset[] = checkedFiles.map((file, idx) => ({
      id: `scanned-${Date.now()}-${idx}`,
      name: file.name,
      url: file.url,
      category: '全部图片',
      tag: file.tag,
      date: new Date().toISOString().split('T')[0]
    }));

    setAssets(prev => [...importedAssets, ...prev]);
    // Auto select imported assets
    const importedIds = importedAssets.map(i => i.id);
    setSelectedAssetIds(prev => [...prev, ...importedIds]);

    alert(`成功从路径 ${scanPath} 导入 ${importedAssets.length} 个素材！`);
    setIsScanOpen(false);
    setHasScanned(false);
    setScannedFiles([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 md:p-10 select-none animate-fadeIn">
      
      {/* Hidden Upload Input */}
      <input 
        type="file" 
        multiple 
        accept="image/*" 
        ref={fileInputRef} 
        onChange={handleLocalUploadChange} 
        className="hidden" 
      />

      {/* Main Modal Container */}
      <div className="bg-white w-full max-w-[1040px] h-[720px] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Header section matching prototype */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <span className="material-symbols-outlined font-bold text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>dataset</span>
            </div>
            <h1 className="text-base font-extrabold text-slate-800">资源中转站</h1>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </header>

        {/* Modal body container */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Left Navigation (分类导航) */}
          <aside className="w-[240px] border-r border-slate-200 bg-white flex flex-col p-4 gap-6 shrink-0">
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-extrabold text-slate-400 px-3 uppercase tracking-wider">分类导航</p>
              <nav className="flex flex-col gap-1">
                
                {/* 1. 全部图片 */}
                <button
                  onClick={() => setActiveNav('全部图片')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeNav === '全部图片' 
                      ? 'bg-blue-50 text-blue-600' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: activeNav === '全部图片' ? "'FILL' 1" : "'FILL' 0" }}>folder</span>
                  <span>全部图片</span>
                </button>

                {/* 2. 已上传图片 */}
                <button
                  onClick={() => setActiveNav('已上传图片')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeNav === '已上传图片' 
                      ? 'bg-blue-50 text-blue-600' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: activeNav === '已上传图片' ? "'FILL' 1" : "'FILL' 0" }}>cloud_upload</span>
                  <span>已上传图片</span>
                </button>

                {/* 3. 最新编辑 */}
                <button
                  onClick={() => setActiveNav('最新编辑')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeNav === '最新编辑' 
                      ? 'bg-blue-50 text-blue-600' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: activeNav === '最新编辑' ? "'FILL' 1" : "'FILL' 0" }}>edit_note</span>
                  <span>最新编辑</span>
                </button>

                {/* 4. 商品图库 */}
                <button
                  onClick={() => setActiveNav('商品图库')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeNav === '商品图库' 
                      ? 'bg-blue-50 text-blue-600' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: activeNav === '商品图库' ? "'FILL' 1" : "'FILL' 0" }}>image</span>
                  <span>商品图库</span>
                </button>

              </nav>
            </div>

            {/* Storage Progress Meter in bottom of navigation */}
            <div className="mt-auto p-4 bg-blue-50/50 rounded-xl border border-blue-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest">存储空间</span>
                <span className="text-[10px] font-bold text-slate-500">82%</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full w-[82%]" />
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-2">已使用 4.1GB / 5.0GB</p>
            </div>
          </aside>

          {/* Main workspace layout */}
          <main className="flex-1 flex flex-col bg-[#F9FAFB] overflow-hidden relative">
            
            {/* Action panel & search filters */}
            <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="flex gap-2">
                <button 
                  onClick={handleLocalUploadTrigger}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">cloud_upload</span>
                  <span>本地上传</span>
                </button>
                <button 
                  onClick={() => setIsScanOpen(true)}
                  className="flex items-center gap-2 bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold border border-slate-200 hover:bg-slate-100 transition-colors shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">scan</span>
                  <span>目录扫描</span>
                </button>
              </div>

              {/* Filters search */}
              <div className="flex items-center gap-3 flex-1 max-w-lg">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                  <input 
                    type="text" 
                    placeholder="搜索资源文件名"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="pl-2 pr-6 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold bg-slate-50 text-slate-500 outline-none cursor-pointer"
                  >
                    <option value="">日期筛选</option>
                    <option value="2023-11-24">2023-11-24</option>
                    <option value="2023-11-23">2023-11-23</option>
                    <option value="2023-11-22">2023-11-22</option>
                    <option value="2023-11-21">2023-11-21</option>
                  </select>

                  <select
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    className="pl-2 pr-6 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold bg-slate-50 text-slate-500 outline-none cursor-pointer"
                  >
                    <option value="">素材类型</option>
                    <option value="商品原图">商品原图</option>
                    <option value="白底图">白底图</option>
                    <option value="风格参考">风格参考</option>
                    <option value="已上传素材">已上传素材</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Scrollable grid area */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                
                {filteredAssets.map((asset) => {
                  const isSelected = selectedAssetIds.includes(asset.id);
                  const selectIndex = selectedAssetIds.indexOf(asset.id) + 1;
                  return (
                    <div 
                      key={asset.id}
                      onClick={() => handleCardClick(asset.id)}
                      className={`group relative flex flex-col bg-white rounded-xl border overflow-hidden hover:shadow-md transition-all cursor-pointer ${
                        isSelected ? 'border-blue-500 bg-blue-50/10' : 'border-slate-200'
                      }`}
                    >
                      <div className="aspect-square relative overflow-hidden bg-slate-50">
                        <img 
                          src={asset.url} 
                          alt={asset.name}
                          className="w-full h-full object-cover transition-transform group-hover:scale-102"
                          referrerPolicy="no-referrer"
                        />
                        {/* Selected Index circular badge top-left */}
                        <div className={`absolute top-3 left-3 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shadow-sm transition-all ${
                          isSelected ? 'bg-blue-600 text-white' : 'border-2 border-white bg-black/20 text-transparent'
                        }`}>
                          {isSelected ? selectIndex : ''}
                        </div>
                        <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-bold text-slate-800 truncate mb-1">{asset.name}</p>
                        <div className="flex items-center justify-between">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                            asset.tag === '商品原图' ? 'bg-slate-100 text-slate-600' :
                            asset.tag === '白底图' ? 'bg-emerald-50 text-emerald-600' :
                            'bg-blue-50 text-blue-600'
                          }`}>
                            {asset.tag}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono font-medium">{asset.date}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Grid Item empty placeholder */}
                <div 
                  onClick={handleLocalUploadTrigger}
                  className="group relative flex flex-col bg-white rounded-xl border border-slate-200 border-dashed overflow-hidden hover:bg-slate-50 transition-all cursor-pointer justify-center items-center p-6 aspect-square"
                >
                  <span className="material-symbols-outlined text-slate-400 text-3xl group-hover:text-blue-500 mb-2 transition-colors">add_photo_alternate</span>
                  <p className="text-xs font-bold text-slate-400 group-hover:text-blue-600 transition-colors">待上传素材...</p>
                </div>

              </div>
            </div>

            {/* Footer matching prototype strictly */}
            <footer className="p-4 px-8 bg-white border-t border-slate-200 flex items-center justify-between z-10 shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-100">
                  <span className="material-symbols-outlined text-blue-600 text-sm font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-xs font-extrabold text-blue-600">已选择 {selectedAssetIds.length} 个资源</span>
                </div>
                {selectedAssetIds.length > 0 && (
                  <button 
                    onClick={handleClearSelection}
                    className="text-xs text-blue-600 hover:underline font-bold bg-transparent border-none cursor-pointer"
                  >
                    清除选择
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={onClose}
                  className="px-6 py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button 
                  onClick={handleConfirmSelection}
                  className="px-8 py-2 bg-blue-600 text-white rounded-lg text-xs font-extrabold hover:bg-blue-700 hover:shadow-md transition-all cursor-pointer"
                >
                  确认选择
                </button>
              </div>
            </footer>

            {/* DIRECTORY SCAN OVERLAY DRAWER */}
            {isScanOpen && (
              <div className="absolute inset-0 bg-black/50 z-30 flex items-center justify-center p-6 animate-fadeIn">
                <div className="bg-white max-w-lg w-full rounded-xl shadow-xl border border-slate-200 flex flex-col max-h-[90%] overflow-hidden">
                  
                  {/* Scan Header */}
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2 text-slate-800">
                      <span className="material-symbols-outlined text-blue-600 font-bold">scan</span>
                      <h3 className="text-sm font-extrabold">目录扫描获取素材</h3>
                    </div>
                    <button 
                      onClick={() => {
                        setIsScanOpen(false);
                        setHasScanned(false);
                        setScannedFiles([]);
                      }}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </div>

                  {/* Scan Body */}
                  <div className="p-5 flex-1 overflow-y-auto space-y-4">
                    
                    {/* Path selector input */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 block">请输入服务器/磁盘文件夹路径 <span className="text-red-500">*</span></label>
                      <div className="flex gap-2">
                        <select
                          value={scanPath}
                          onChange={(e) => setScanPath(e.target.value)}
                          className="flex-1 h-9 px-3 border border-slate-250 rounded-lg text-xs font-medium outline-none bg-white focus:border-blue-500 cursor-pointer"
                        >
                          <option value="/assets/brand_wear/">/assets/brand_wear/ (户外服饰/新款套组)</option>
                          <option value="/assets/skincare_line/">/assets/skincare_line/ (美妆护肤/高精原图)</option>
                          <option value="/assets/tech_watches/">/assets/tech_watches/ (智能穿戴/钛金属系列)</option>
                          <option value="/assets/luxury_jewelry/">/assets/luxury_jewelry/ (珠宝轻奢/白底系列)</option>
                        </select>
                        <button 
                          onClick={handleTriggerScan}
                          disabled={isScanning}
                          className="px-4 bg-blue-600 text-white font-bold text-xs rounded-lg hover:bg-blue-700 transition-colors cursor-pointer flex items-center shrink-0 disabled:bg-blue-400"
                        >
                          {isScanning ? '扫描中...' : '开始扫描'}
                        </button>
                      </div>
                    </div>

                    {isScanning && (
                      <div className="flex flex-col items-center justify-center py-12 space-y-3">
                        <span className="material-symbols-outlined text-4xl text-blue-600 animate-spin">sync</span>
                        <p className="text-xs font-bold text-slate-500">正在快速检索文件路径，读取元数据...</p>
                      </div>
                    )}

                    {hasScanned && scannedFiles.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-600 flex justify-between">
                          <span>已扫描到以下文件 ({scannedFiles.length} 个):</span>
                          <span className="text-blue-600 font-mono">100% 解析成功</span>
                        </p>

                        {/* Files Checklist */}
                        <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-60 overflow-y-auto">
                          {scannedFiles.map((file, idx) => (
                            <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                              <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                                <input 
                                  type="checkbox" 
                                  checked={file.checked}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setScannedFiles(prev => prev.map((f, i) => i === idx ? { ...f, checked } : f));
                                  }}
                                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300 cursor-pointer"
                                />
                                <img src={file.url} className="w-8 h-8 rounded object-cover" referrerPolicy="no-referrer" />
                                <div className="truncate text-xs font-bold text-slate-800">
                                  {file.name}
                                </div>
                              </label>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-50 text-blue-600">{file.tag}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {hasScanned && scannedFiles.length === 0 && (
                      <div className="py-12 text-center text-slate-400 text-xs font-bold">
                        该路径下暂未检索到可导入的图片文件。
                      </div>
                    )}

                  </div>

                  {/* Scan Footer */}
                  {hasScanned && scannedFiles.length > 0 && (
                    <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
                      <button 
                        onClick={() => {
                          setIsScanOpen(false);
                          setHasScanned(false);
                          setScannedFiles([]);
                        }}
                        className="px-4 py-2 border border-slate-200 font-bold text-slate-500 rounded-lg text-xs bg-white hover:bg-slate-50 cursor-pointer"
                      >
                        取消
                      </button>
                      <button 
                        onClick={handleImportScanned}
                        className="px-6 py-2 bg-blue-600 text-white font-extrabold rounded-lg text-xs hover:bg-blue-700 transition-colors cursor-pointer"
                      >
                        导入至中转站
                      </button>
                    </div>
                  )}

                </div>
              </div>
            )}

          </main>

        </div>

      </div>
    </div>
  );
};
