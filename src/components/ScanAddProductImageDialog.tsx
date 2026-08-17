import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import COS from 'cos-js-sdk-v5';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, FolderOpen, Image as ImageIcon, Loader2, ScanSearch, Settings2, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import type {
  ProductDTO,
  ProductScanMatchItem,
  ProductScanMatchMode,
} from '../api/modules/productInfo';
import { productInfoApi } from '../api/modules/productInfo';
import { assetApi } from '../api/modules/asset';
import { fileApi } from '../api/modules/file';
import { readMediaMeta } from '../hooks/useFileUpload';
import { md5FileHex } from '../utils/crypto';
import { withCosThumbnail } from '../utils/cosImage';
import { useConfirm } from './common/ConfirmProvider';
import { ImagePreviewModal, type PreviewImage } from './ImagePreviewModal';

/** 高级选项:文件名前置文本提取 */
type AdvancedMode = 'none' | 'split' | 'regex';

interface AdvancedOptions {
  mode: AdvancedMode;
  /** 按分隔符:分隔符(默认 -)+ 段号(1-based) */
  splitter: string;
  splitIndex: number;
  /** 正则:模式 + flags + 捕获组(1-based) */
  regexPattern: string;
  regexFlags: string;
  regexGroup: number;
}

const DEFAULT_ADVANCED: AdvancedOptions = {
  mode: 'none',
  splitter: '-',
  splitIndex: 1,
  regexPattern: '',
  regexFlags: '',
  regexGroup: 1,
};

interface ScanAddProductImageDialogProps {
  open: boolean;
  onClose: () => void;
  /** 全部上传完成后回调(父组件刷新列表) */
  onDone: () => void;
}

/** 扫描到的本地图片文件(保留相对层级,供后续定位/命名) */
interface ScannedFile {
  file: File;
  /** webkitRelativePath,如 2026秋冬/卫衣/A1001.png */
  relPath: string;
  /** 去掉最后扩展名的文件名,用于精确匹配 */
  baseName: string;
}

type UploadStatus = 'pending' | 'uploading' | 'success' | 'failed';

/** 上传单元:一张图 × 一个被勾选的商品 */
interface UploadUnit {
  key: string;
  file: File;
  product: ProductDTO;
}

/** 懒加载 COS 实例(与 useFileUpload 同一策略) */
let cachedCos: COS | null = null;
let cachedTokenKey = '';

function getCos(tmpSecretId: string, tmpSecretKey: string, sessionToken: string): COS {
  const tokenKey = tmpSecretId + '|' + tmpSecretKey + '|' + sessionToken;
  if (!cachedCos || cachedTokenKey !== tokenKey) {
    cachedCos = new COS({
      SecretId: tmpSecretId,
      SecretKey: tmpSecretKey,
      SecurityToken: sessionToken,
      Protocol: 'https:',
    });
    cachedTokenKey = tokenKey;
  }
  return cachedCos;
}

function stripExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(0, idx) : name;
}

function radioOptionClass(active: boolean, disabled: boolean) {
  return 'flex h-10 items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-bold transition-colors ' +
    (active
      ? 'border-primary bg-primary/5 text-primary'
      : 'border-slate-300 bg-white text-slate-500 hover:border-slate-400') +
    (disabled ? ' cursor-not-allowed opacity-50' : '');
}

export function ScanAddProductImageDialog({
  open,
  onClose,
  onDone,
}: ScanAddProductImageDialogProps) {
  const dirInputRef = useRef<HTMLInputElement>(null);
  /** File System Access API 的目录句柄(showDirectoryPicker) */
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const confirmDialog = useConfirm();

  const [matchMode, setMatchMode] = useState<ProductScanMatchMode>('NAME');
  /** 输入框回显的目录路径(如 /卫衣目录/) */
  const [scanPath, setScanPath] = useState('');
  const [dirScanning, setDirScanning] = useState(false);
  const [scannedFiles, setScannedFiles] = useState<ScannedFile[]>([]);
  const [matched, setMatched] = useState<ProductScanMatchItem[] | null>(null);
  /** fileName → 已勾选的商品 id 列表 */
  const [checked, setChecked] = useState<Record<string, string[]>>({});
  const [matching, setMatching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadDone, setUploadDone] = useState(0);
  const [uploadStatuses, setUploadStatuses] = useState<Record<string, UploadStatus>>({});
  /** 高级选项:文本提取 */
  const [advanced, setAdvanced] = useState<AdvancedOptions>(DEFAULT_ADVANCED);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // webkitdirectory 必须作为 attribute 存在,浏览器才进入"选择文件夹"模式
  // (React 对空字符串属性可能走 property 赋值导致失效,这里用 setAttribute 兜底)
  useEffect(() => {
    const el = dirInputRef.current;
    if (el) {
      el.setAttribute('webkitdirectory', '');
      el.setAttribute('directory', '');
    }
  }, [open]);

  // 打开时重置为全新一轮扫描
  useEffect(() => {
    if (open) {
      setMatchMode('NAME');
      setScanPath('');
      setDirScanning(false);
      setScannedFiles([]);
      setMatched(null);
      setChecked({});
      setMatching(false);
      setUploading(false);
      setUploadTotal(0);
      setUploadDone(0);
      setUploadStatuses({});
      setAdvanced(DEFAULT_ADVANCED);
      setAdvancedOpen(false);
      setPreviewState(null);
    }
  }, [open]);

  // 切换高级选项(模式/分隔符/段号/正则)时,清除旧的匹配与勾选,避免失效
  useEffect(() => {
    if (!open) return;
    if (!matched) return;
    setMatched(null);
    setChecked({});
    setUploadStatuses({});
    toast.info('提取规则已变更,请重新匹配商品');
    // 只依赖 mode / splitter / splitIndex / regexPattern / regexFlags / regexGroup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanced.mode, advanced.splitter, advanced.splitIndex, advanced.regexPattern, advanced.regexFlags, advanced.regexGroup]);

  // 切换匹配模式(NAME/CODE)时,旧勾选已无意义,清空
  useEffect(() => {
    if (!open) return;
    if (Object.keys(checked).length === 0) return;
    setChecked({});
    setUploadStatuses({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchMode]);

  // ESC 关闭(上传中禁止关闭)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !uploading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, uploading, onClose]);

  /** 输入框回显:目录路径 + 图片数 */
  const scanSummary = useMemo(() => {
    if (!scanPath) return null;
    const subDirs = new Set(
      scannedFiles.map((f) => f.relPath.split('/').slice(0, -1).join('/')),
    );
    return {
      path: scanPath,
      fileCount: scannedFiles.length,
      subDirCount: subDirs.size,
    };
  }, [scanPath, scannedFiles]);

  /**
   * 根据高级选项从原始文件名(已去扩展名)提取"用于匹配的文本"。
   * 失败时返回空串(调用方按原文件名兜底,并在 UI 中提示用户)。
   */
  function extractMatchText(baseName: string): string {
    if (advanced.mode === 'none') return baseName;
    if (advanced.mode === 'split') {
      const sep = advanced.splitter.length > 0 ? advanced.splitter : '-';
      const parts = baseName.split(sep);
      const idx = Math.max(1, advanced.splitIndex | 0) - 1;
      return parts[idx] ?? baseName;
    }
    // regex
    if (!advanced.regexPattern) return baseName;
    try {
      const re = new RegExp(advanced.regexPattern, advanced.regexFlags);
      const m = baseName.match(re);
      if (!m) return '';
      const group = Math.max(1, advanced.regexGroup | 0) - 1;
      return m[group + 1] ?? '';
    } catch {
      return '';
    }
  }

  /** baseName → 提取后的匹配文本 */
  const extractedMap = useMemo(() => {
    const m = new Map<string, string>();
    scannedFiles.forEach((f) => m.set(f.baseName, extractMatchText(f.baseName)));
    return m;
  }, [scannedFiles, advanced]);

  /** 高级预览:前 5 个文件 原始名 → 提取文本 */
  const previewRows = useMemo(
    () => scannedFiles.slice(0, 5).map((f) => ({ baseName: f.baseName, extracted: extractedMap.get(f.baseName) ?? f.baseName })),
    [scannedFiles, extractedMap],
  );

  /**
   * 冲突检测:
   * - conflictByProduct: 商品 id → 被多少个文件勾选(跨文件统计)
   * - conflictProductIds: 被 ≥2 个文件勾选的商品集合
   * - conflictFileNames: 涉及冲突的文件 baseName 集合
   */
  const conflictByProduct = useMemo(() => {
    const counter = new Map<string, number>();
    scannedFiles.forEach((f) => {
      const ids: string[] = checked[f.baseName] ?? [];
      new Set(ids).forEach((pid: string) => counter.set(pid, (counter.get(pid) ?? 0) + 1));
    });
    return counter;
  }, [checked, scannedFiles]);

  const conflictProductIds = useMemo(() => {
    const set = new Set<string>();
    conflictByProduct.forEach((count, pid) => {
      if (count > 1) set.add(pid);
    });
    return set;
  }, [conflictByProduct]);

  const conflictFileNames = useMemo(() => {
    const set = new Set<string>();
    scannedFiles.forEach((f) => {
      const ids: string[] = checked[f.baseName] ?? [];
      if (ids.some((pid: string) => conflictProductIds.has(pid))) set.add(f.baseName);
    });
    return set;
  }, [checked, scannedFiles, conflictProductIds]);

  const conflictCount = conflictProductIds.size;

  /**
   * 本地图片预览:为每个已扫描文件生成 blob URL,
   * 在对话框生命周期内缓存(open=false 或文件列表变化时 revoke)。
   * 点击文件行缩略图触发 ImagePreviewModal 大图查看。
   */
  const [previewState, setPreviewState] = useState<{
    images: PreviewImage[];
    initialIndex: number;
  } | null>(null);

  /** baseName → blob URL(本地图预览缩略图与大图共用) */
  const previewMap = useMemo(() => {
    const m = new Map<string, string>();
    scannedFiles.forEach((f) => m.set(f.baseName, URL.createObjectURL(f.file)));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannedFiles]);

  // 卸载对话框时(或 scannedFiles 重置时)统一释放 blob URL,避免内存泄漏
  useEffect(() => {
    return () => {
      previewMap.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewMap]);

  /** 点击缩略图:打开 ImagePreviewModal 大图查看,只展示当前一张图(不翻页) */
  function openPreview(url: string, label: string) {
    if (!url) return;
    setPreviewState({
      images: [{ url, label }],
      initialIndex: 0,
    });
  }

  function openLocalPreview(baseName: string) {
    const file = scannedFiles.find((f) => f.baseName === baseName);
    const url = previewMap.get(baseName);
    if (!file || !url) return;
    openPreview(url, file.relPath);
  }

  // 部分浏览器对部分扩展名(jfif/webp 等)type 为空,按扩展名兜底
  const isImageFile = (f: File) => {
    if (f.type.startsWith('image/')) return true;
    return /\.(png|jpe?g|gif|webp|bmp|jfif|svg|avif)$/i.test(f.name);
  };

  /** 从 FileList 收集图片 + 相对路径 + 去扩展名文件名(webkitdirectory 降级共用) */
  function collectScanned(files: File[]): ScannedFile[] {
    return files
      .filter(isImageFile)
      .map((f) => {
        const relPath = f.webkitRelativePath || f.name;
        return { file: f, relPath, baseName: stripExtension(f.name) };
      })
      // 同名文件只保留第一个(匹配与上传都以文件名为准)
      .filter(
        (item, index, arr) => arr.findIndex((x) => x.baseName === item.baseName) === index,
      )
      // 按文件名(file.name 含扩展名)字典序排序:numeric:true 让 A2 < A10(自然数字序)
      .sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true, sensitivity: 'base' }));
  }

  function applyScanned(scanned: ScannedFile[]) {
    setScannedFiles(scanned);
    setMatched(null);
    setChecked({});
    setUploadStatuses({});
  }

  /** 递归遍历目录,收集图片文件 + 相对路径(层级仅内部记录,不展示) */
  async function collectFromDirectory(handle: FileSystemDirectoryHandle): Promise<ScannedFile[]> {
    const collected: ScannedFile[] = [];
    const MAX = 500;
    const walk = async (dir: FileSystemDirectoryHandle, prefix: string) => {
      // values() 在部分 TS lib 类型里缺失,运行时可用 —— 与资源中心一致
      const values = (dir as unknown as { values: () => AsyncIterable<FileSystemHandle> }).values();
      for await (const entry of values) {
        if (collected.length >= MAX) return;
        if (entry.kind === 'directory') {
          await walk(entry as FileSystemDirectoryHandle, prefix + entry.name + '/');
        } else if (entry.kind === 'file') {
          const file = await (entry as FileSystemFileHandle).getFile();
          if (!isImageFile(file)) continue;
          collected.push({ file, relPath: prefix + file.name, baseName: stripExtension(file.name) });
        }
      }
    };
    await walk(handle, handle.name + '/');
    // 同名文件只保留第一个(匹配与上传都以文件名为准)
    const deduped = collected.filter(
      (item, index, arr) => arr.findIndex((x) => x.baseName === item.baseName) === index,
    );
    // 按文件名(file.name 含扩展名)字典序排序:numeric 让 A2 < A10(自然数字序)
    return deduped.sort((a, b) =>
      a.file.name.localeCompare(b.file.name, undefined, { numeric: true, sensitivity: 'base' }),
    );
  }

  /**
   * 点击"选择目录":使用 File System Access API 的 showDirectoryPicker,
   * 弹出的是系统原生"选择文件夹"对话框(而非 webkitdirectory 的"上传"对话框)。
   * 选择后立即递归读取文件夹内图片,路径回显到输入框。
   */
  async function handleBrowseClick() {
    type DirectoryPickerWindow = Window & {
      showDirectoryPicker?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
    };
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
    if (!picker) {
      // 浏览器不支持(Firefox 等)→ 降级为 webkitdirectory 输入框
      dirInputRef.current?.click();
      return;
    }
    try {
      const dirHandle = await picker({ mode: 'read' });
      dirHandleRef.current = dirHandle;
      setScanPath('/' + dirHandle.name + '/');
      setDirScanning(true);
      const scanned = await collectFromDirectory(dirHandle);
      applyScanned(scanned);
      if (scanned.length === 0) {
        toast.error('所选文件夹中没有图片文件');
      } else {
        toast.success('已读取 ' + scanned.length + ' 张图片,请点击「匹配商品」');
      }
    } catch (err) {
      // 用户取消选择 → 静默
      if ((err as Error).name === 'AbortError') return;
      toast.error('目录选择失败: ' + (err as Error).message);
    } finally {
      setDirScanning(false);
    }
  }

  // 项目未安装 @types/react(allowJs + 无 strict),不依赖 React 事件类型
  function handleDirChange(event: { target: HTMLInputElement }) {
    applyScanned(collectScanned(Array.from(event.target.files ?? [])));
    // 允许再次选择同一目录时重新触发 onChange
    event.target.value = '';
  }


  function toggleCheck(fileName: string, productId: string, on: boolean) {
    setChecked((prev) => {
      const current = new Set(prev[fileName] ?? []);
      if (on) current.add(productId);
      else current.delete(productId);
      return { ...prev, [fileName]: Array.from(current) };
    });
  }

  async function handleMatch() {
    // 用高级选项提取后的文本(去重)发请求
    const extractedList: string[] = scannedFiles.map(
      (f: ScannedFile): string => extractedMap.get(f.baseName) ?? f.baseName,
    );
    const fileNames: string[] = Array.from(new Set(extractedList)).filter(
      (s: string) => s.length > 0,
    );
    if (fileNames.length === 0) {
      toast.error('高级选项未提取到任何有效文本,请检查规则或改回"整文件名"');
      return;
    }
    setMatching(true);
    try {
      const result = await productInfoApi.scanMatch({ matchMode, fileNames });
      // 响应按"提取文本(fileName)"索引;把 matches 复制给所有 baseName 提取到同一文本的原始文件
      const responseByExtracted = new Map<string, ProductScanMatchItem>(
        result.map((item) => [item.fileName, item]),
      );
      const expanded: ProductScanMatchItem[] = scannedFiles.map((f) => {
        const extracted = extractedMap.get(f.baseName) ?? f.baseName;
        const resp = responseByExtracted.get(extracted);
        return {
          fileName: f.baseName,
          matches: resp?.matches ?? [],
        };
      });
      setMatched(expanded);
      // 唯一命中时默认勾选,多候选留给用户选择(同一提取文本的多文件各自独立勾选)
      const next: Record<string, string[]> = {};
      expanded.forEach((item) => {
        next[item.fileName] = item.matches.length === 1 ? [item.matches[0].id] : [];
      });
      setChecked(next);
    } catch {
      // 全局 HTTP 拦截器负责错误提示
    } finally {
      setMatching(false);
    }
  }

  const selectedCount = useMemo(
    () => Object.values(checked).reduce((sum: number, ids: string[]) => sum + ids.length, 0),
    [checked],
  );

  function buildUnits(): UploadUnit[] {
    const units: UploadUnit[] = [];
    matched?.forEach((item) => {
      const ids = checked[item.fileName] ?? [];
      if (ids.length === 0) return;
      const file = scannedFiles.find((f) => f.baseName === item.fileName);
      if (!file) return;
      ids.forEach((productId) => {
        const product = item.matches.find((p) => p.id === productId);
        if (product) {
          units.push({
            key: item.fileName + '::' + productId,
            file: file.file,
            product,
          });
        }
      });
    });
    return units;
  }

  /** 单张图上传 → 建素材 → 设置商品主图(复用现有封面设置链路,不做 MD5 校验) */
  async function uploadOne(unit: UploadUnit) {
    // Step 1: 签发上传凭证
    const tokenResp = await fileApi.uploadToken({
      purpose: 'PRODUCT',
      productId: unit.product.id,
      fileName: unit.file.name,
    });
    const info = tokenResp.uploadTokenInfo;
    if (!info || !info.fileKey || !info.bucket || !info.region) {
      throw new Error('上传凭证不完整(缺少 fileKey/bucket/region)');
    }

    // Step 1.5: 文件 MD5 + 媒体元数据(仅供入库,不做去重校验)
    const fileMd5 = await md5FileHex(unit.file);
    const mediaMeta = await readMediaMeta(unit.file);

    // Step 2: COS 直传
    const cos = getCos(
      info.tmpSecretId ?? '',
      info.tmpSecretKey ?? '',
      info.sessionToken ?? '',
    );
    const cosResult = await new Promise<{ Key: string }>((resolve, reject) => {
      cos.uploadFile(
        {
          Bucket: info.bucket!,
          Region: info.region!,
          Key: info.fileKey!,
          Body: unit.file,
          SliceSize: 5 * 1024 * 1024,
        },
        (err: unknown, data: { Location?: string; Key?: string }) => {
          if (err) {
            const e = err as { code?: string; message?: string };
            reject(new Error('COS 上传失败: ' + (e.code ?? '') + ' ' + (e.message ?? '')));
            return;
          }
          resolve({ Key: data.Key ?? info.fileKey! });
        },
      );
    });

    // Step 3: 上传完成回调 → fileResourceId
    const complete = await fileApi.uploadComplete({
      fileKey: cosResult.Key,
      fileSize: unit.file.size,
      mimeType: unit.file.type || 'application/octet-stream',
      width: mediaMeta.width,
      height: mediaMeta.height,
    });

    // Step 4: 创建商品素材(绑定 productId)
    const assetId = await assetApi.create({
      fileResourceId: complete.fileResourceId,
      fileMd5,
      name: unit.file.name,
      assetKind: 'IMAGE',
      productId: unit.product.id,
    });

    // Step 5: 设置为商品主图(复用 update 的 imageId 链路)
    await productInfoApi.update({
      id: unit.product.id,
      name: unit.product.name,
      imageId: assetId,
    });
  }

  /** 构造"覆盖冲突"对话框内容:按商品分组,展示被哪些原始文件勾选 */
  function buildConflictMessage(): ReactNode {
    // 按 productId 聚合原始文件(baseName)
    const productToFiles = new Map<string, { product: ProductDTO; fileNames: string[] }>();
    matched?.forEach((item) => {
      const ids = checked[item.fileName] ?? [];
      ids.forEach((pid) => {
        if (!conflictProductIds.has(pid)) return;
        const product = item.matches.find((p) => p.id === pid);
        if (!product) return;
        if (!productToFiles.has(pid)) productToFiles.set(pid, { product, fileNames: [] });
        productToFiles.get(pid)!.fileNames.push(item.fileName);
      });
    });
    const list: ReactNode[] = [];
    productToFiles.forEach(({ product, fileNames }) => {
      list.push(
        <div key={product.id} className="mb-2 last:mb-0">
          <div className="font-bold text-slate-800">
            <span className="font-mono text-slate-500">{product.skuCode ?? '无 SKU 编码'}</span>
            <span className="mx-1">·</span>
            {product.name}
            <span className="ml-2 text-rose-600">被 {fileNames.length} 个文件勾选</span>
          </div>
          <ul className="mt-1 ml-3 list-disc text-slate-600">
            {fileNames.map((n) => (
              <li key={n} className="font-mono text-[11px]">
                {n}
              </li>
            ))}
          </ul>
        </div>,
      );
    });
    return (
      <div>
        <p className="mb-2 text-rose-600">
          检测到 {conflictCount} 个 SKU 被多个文件勾选。按勾选顺序上传时,后传的 imageId 会覆盖先传的,
          导致只有最后一张图作为商品主图。继续上传将按你勾选的顺序生效。
        </p>
        <div className="max-h-64 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2.5 text-[11px]">
          {list}
        </div>
      </div>
    );
  }

  async function handleStartUpload() {
    const units = buildUnits();
    if (units.length === 0) return;
    // 软阻断:有冲突时弹 confirm 告知覆盖情况
    if (conflictCount > 0) {
      const ok = await confirmDialog({
        title: '检测到 SKU 覆盖冲突',
        message: buildConflictMessage(),
        confirmText: '仍要上传(将覆盖)',
        cancelText: '取消,返回调整',
        danger: true,
      });
      if (!ok) return;
    }
    setUploading(true);
    setUploadTotal(units.length);
    setUploadDone(0);
    setUploadStatuses(Object.fromEntries(units.map((u) => [u.key, 'pending'])));

    const failures: string[] = [];
    let done = 0;
    for (const unit of units) {
      setUploadStatuses((prev) => ({ ...prev, [unit.key]: 'uploading' }));
      try {
        await uploadOne(unit);
        done += 1;
        setUploadDone(done);
        setUploadStatuses((prev) => ({ ...prev, [unit.key]: 'success' }));
      } catch (e) {
        setUploadStatuses((prev) => ({ ...prev, [unit.key]: 'failed' }));
        failures.push(unit.product.name + '(' + unit.file.name + ')');
      }
    }
    setUploading(false);

    if (failures.length === 0) {
      toast.success('已完成,共为 ' + units.length + ' 个商品更新主图');
    } else {
      toast.error(
        '完成:' + (units.length - failures.length) + ' 成功,' + failures.length + ' 个失败:' + failures.join('、'),
      );
    }
    onDone();
  }

  if (!open) return null;

  const uploadPercent = uploadTotal > 0 ? Math.round((uploadDone / uploadTotal) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="扫描添加商品主图"
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        {/* 头部 */}
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <ScanSearch className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">扫描添加商品主图</h2>
              <p className="mt-0.5 max-w-md text-[11px] leading-relaxed text-slate-500">
                选择本地文件夹,按文件名精确匹配商品;勾选候选商品后批量上传为商品封面图(主图)。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="grid h-8 w-8 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          {/* 扫描目录 */}
          <section>
            <p className="mb-1.5 text-[11px] font-bold text-slate-600">扫描目录</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                disabled
                value={
                  scanSummary
                    ? scanSummary.path + ' (' + scanSummary.fileCount + ' 张图片,' + scanSummary.subDirCount + ' 个子目录)'
                    : ''
                }
                placeholder="请点击右侧「选择目录」选择本地文件夹"
                className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-500 placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => void handleBrowseClick()}
                disabled={uploading || dirScanning}
                className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 text-xs font-bold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {dirScanning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderOpen className="h-4 w-4" />
                )}
                {dirScanning ? '读取中...' : '选择目录'}
              </button>
              <input
                ref={dirInputRef}
                type="file"
                multiple
                accept="image/*"
                webkitdirectory=""
                className="hidden"
                onChange={handleDirChange}
              />
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
              「选择目录」弹出的是系统原生「选择文件夹」对话框,选择后立即读取文件夹内图片
              (同名文件只保留一个;目录层级仅内部记录,不会展示或上传)。
              <br />
              仅支持 Chrome / Edge / Opera;若浏览器不支持,将回退为文件选择框。
            </p>
          </section>

          {/* 匹配模式(精确匹配)—— 放在匹配商品按钮上方,选择目录后决定按何种字段匹配 */}
          <section>
            <p className="mb-1.5 text-[11px] font-bold text-slate-600">匹配模式(精确匹配)</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => setMatchMode('NAME')}
                className={radioOptionClass(matchMode === 'NAME', uploading)}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                按 SKU 名称匹配
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={() => setMatchMode('NAME')}
                className={radioOptionClass(matchMode === 'CODE', uploading)}
              >
                <span className="font-mono">#</span>
                按 SKU 编码匹配
              </button>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              {matchMode === 'NAME'
                ? '图片文件名(不含扩展名)与商品名称完全一致时命中'
                : '图片文件名(不含扩展名)与 SKU 编码完全一致时命中'}
            </p>
          </section>

          {/* 匹配操作 + 高级选项 */}
          <section className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                disabled={uploading}
                className={
                  'flex h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-bold transition-colors ' +
                  (advancedOpen
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50')
                }
              >
                <Settings2 className="h-4 w-4" />
                高级选项
                {advanced.mode !== 'none' && (
                  <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                )}
                {advancedOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              <button
                type="button"
                onClick={() => void handleMatch()}
                disabled={scannedFiles.length === 0 || matching || uploading}
                className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-xs font-bold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                {matching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ScanSearch className="h-4 w-4" />
                )}
                {matching ? '匹配中...' : '匹配商品'}
              </button>
              {matched && (
                <span className="text-[11px] text-slate-500">
                  共 {matched.length} 个文件参与匹配,
                  {matched.filter((m) => m.matches.length > 0).length} 个命中商品
                </span>
              )}
            </div>

            {advancedOpen && (
              <div className="rounded-md border border-slate-200 bg-slate-50/50 p-3">
                <p className="mb-2 text-[11px] font-bold text-slate-600">
                  文件名匹配文本(从原文件名提取后再去重发给后端匹配)
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => setAdvanced({ ...advanced, mode: 'none' })}
                    className={radioOptionClass(advanced.mode === 'none', uploading)}
                  >
                    整文件名
                  </button>
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => setAdvanced({ ...advanced, mode: 'split' })}
                    className={radioOptionClass(advanced.mode === 'split', uploading)}
                  >
                    按分隔符分段
                  </button>
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => setAdvanced({ ...advanced, mode: 'regex' })}
                    className={radioOptionClass(advanced.mode === 'regex', uploading)}
                  >
                    正则提取
                  </button>
                </div>

                {advanced.mode === 'split' && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      分隔符
                      <input
                        type="text"
                        value={advanced.splitter}
                        onChange={(e) => setAdvanced({ ...advanced, splitter: e.target.value })}
                        disabled={uploading}
                        placeholder="如: - 或 _"
                        className="h-8 w-24 rounded border border-slate-300 px-2 font-mono text-xs outline-none focus:border-primary"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      取第
                      <input
                        type="number"
                        min={1}
                        value={advanced.splitIndex}
                        onChange={(e) =>
                          setAdvanced({ ...advanced, splitIndex: Math.max(1, Number(e.target.value) || 1) })
                        }
                        disabled={uploading}
                        className="h-8 w-14 rounded border border-slate-300 px-2 text-xs outline-none focus:border-primary"
                      />
                      段(1-based)
                    </label>
                  </div>
                )}

                {advanced.mode === 'regex' && (
                  <div className="mt-2 flex flex-col gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      正则
                      <input
                        type="text"
                        value={advanced.regexPattern}
                        onChange={(e) => setAdvanced({ ...advanced, regexPattern: e.target.value })}
                        disabled={uploading}
                        placeholder="如: ([A-Z]\d+)"
                        className="h-8 min-w-0 flex-1 rounded border border-slate-300 px-2 font-mono text-xs outline-none focus:border-primary"
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                        flags
                        <input
                          type="text"
                          value={advanced.regexFlags}
                          onChange={(e) => setAdvanced({ ...advanced, regexFlags: e.target.value })}
                          disabled={uploading}
                          placeholder="如 i / ig"
                          className="h-8 w-20 rounded border border-slate-300 px-2 font-mono text-xs outline-none focus:border-primary"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                        取第
                        <input
                          type="number"
                          min={1}
                          value={advanced.regexGroup}
                          onChange={(e) =>
                            setAdvanced({ ...advanced, regexGroup: Math.max(1, Number(e.target.value) || 1) })
                          }
                          disabled={uploading}
                          className="h-8 w-14 rounded border border-slate-300 px-2 text-xs outline-none focus:border-primary"
                        />
                        个捕获组
                      </label>
                    </div>
                  </div>
                )}

                {scannedFiles.length > 0 && (
                  <div className="mt-3 rounded border border-slate-200 bg-white p-2">
                    <p className="mb-1 text-[10px] font-bold text-slate-500">预览(前 5 个)</p>
                    <div className="space-y-0.5 font-mono text-[10px]">
                      {previewRows.map((row) => (
                        <div key={row.baseName} className="flex items-center gap-1.5">
                          <span className="truncate text-slate-700">{row.baseName}</span>
                          <span className="shrink-0 text-slate-300">→</span>
                          <span className={row.extracted ? 'text-primary' : 'text-rose-500'}>
                            {row.extracted || '(空)'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 匹配结果 */}
          {matched && (
            <section className="min-h-0 flex-1">
              <p className="mb-1.5 text-[11px] font-bold text-slate-600">
                匹配结果(勾选要设为封面图的商品)
              </p>
              <div className="max-h-80 overflow-y-auto rounded-md border border-slate-200 bg-white">
                {matched.map((item) => {
                  const fileHasConflict = conflictFileNames.has(item.fileName);
                  const extracted = extractedMap.get(item.fileName) ?? item.baseName ?? item.fileName;
                  const previewUrl = previewMap.get(item.fileName);
                  return (
                    <div
                      key={item.fileName}
                      className="border-b border-slate-100 px-3 py-2.5 last:border-b-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openLocalPreview(item.fileName)}
                            disabled={!previewUrl}
                            title="点击查看本地图(支持左右切换)"
                            // 参考 ImageResultPanel 的方案:aspect-square(1:1) + min-w-0 + overflow-hidden,
                            // img 用 min-h-0/min-w-0 + max-h-full/max-w-full + object-contain,
                            // 这样不论图本身横长还是竖长,都能完整显示且不变形。
                            className="group relative flex aspect-square h-12 w-12 min-w-0 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50 hover:border-primary/60 hover:bg-slate-100 disabled:cursor-not-allowed"
                          >
                            {previewUrl ? (
                              <img
                                src={previewUrl}
                                alt={item.fileName}
                                className="min-h-0 min-w-0 max-h-full max-w-full object-contain transition group-hover:scale-[1.02]"
                                loading="lazy"
                              />
                            ) : (
                              <ImageIcon className="h-4 w-4 text-slate-300" />
                            )}
                          </button>
                          <span className="truncate font-mono text-[11px] font-bold text-slate-700">
                            {item.fileName}
                          </span>
                        </div>
                        <span className="ml-2 shrink-0 text-[10px] text-slate-400">
                          {item.matches.length} 个匹配
                          {extracted !== item.fileName && (
                            <span className="ml-1 text-primary">→ {extracted}</span>
                          )}
                        </span>
                      </div>
                      {fileHasConflict && (
                        <div className="mt-1 flex items-start gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] text-rose-600">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>
                            该文件勾选的商品中,有与其它文件相同的 SKU,上传后会被覆盖
                          </span>
                        </div>
                      )}
                      {item.matches.length === 0 ? (
                        <p className="mt-1 text-[11px] text-slate-400">未匹配到商品</p>
                      ) : (
                        <div className="mt-1.5 space-y-1">
                          {item.matches.map((product) => {
                            const status = uploadStatuses[item.fileName + '::' + product.id];
                            const isChecked = (checked[item.fileName] ?? []).includes(product.id);
                            const productConflictCount = conflictByProduct.get(product.id) ?? 0;
                            const isConflict = productConflictCount > 1;
                            return (
                              <label
                                key={product.id}
                                className={
                                  'flex cursor-pointer items-center gap-2 rounded border px-2.5 py-1.5 transition-colors ' +
                                  (isConflict
                                    ? isChecked
                                      ? 'border-rose-300 bg-rose-50'
                                      : 'border-rose-200 bg-white hover:bg-rose-50/50'
                                    : isChecked
                                    ? 'border-primary/40 bg-primary/5'
                                    : 'border-slate-200 bg-white hover:bg-slate-50') +
                                  (uploading ? ' cursor-default' : '')
                                }
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={uploading}
                                  onChange={(e) =>
                                    toggleCheck(item.fileName, product.id, e.target.checked)
                                  }
                                  className="h-3.5 w-3.5 accent-[#D85C42]"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    // 阻止冒泡到外层 <label>(否则会切换 checkbox)
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (product.imageUrl) {
                                      // 大图用原图 url(不带 COS thumbnail 参数),保证清晰
                                      openPreview(product.imageUrl, product.name);
                                    }
                                  }}
                                  disabled={!product.imageUrl}
                                  title={product.imageUrl ? '点击查看大图' : '暂无商品图'}
                                  // 参考 ImageResultPanel 方案:aspect-square + min-w-0 + overflow-hidden,
                                  // img 用 min-0 + max-full + object-contain,过长/过宽图都能完整展示。
                                  className="group relative flex aspect-square h-8 w-8 min-w-0 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50 hover:border-primary/60 hover:bg-slate-100 disabled:cursor-not-allowed"
                                >
                                  {product.imageUrl ? (
                                    <img
                                      src={withCosThumbnail(product.imageUrl, 64) ?? product.imageUrl}
                                      alt={product.name}
                                      className="min-h-0 min-w-0 max-h-full max-w-full object-contain transition group-hover:scale-[1.02]"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <ImageIcon className="h-3.5 w-3.5 text-slate-300" />
                                  )}
                                </button>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[11px] font-medium text-slate-800">
                                    {product.name}
                                  </span>
                                  <span className="block truncate font-mono text-[9px] text-slate-400">
                                    {product.skuCode ?? '无 SKU 编码'} · {product.statusDesc}
                                  </span>
                                </span>
                                {isConflict && (
                                  <span
                                    className="inline-flex items-center gap-0.5 rounded border border-rose-200 bg-rose-50 px-1 py-0.5 text-[9px] font-bold text-rose-600"
                                    title={'该 SKU 被 ' + productConflictCount + ' 个文件勾选'}
                                  >
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    {productConflictCount} 文件
                                  </span>
                                )}
                                {status === 'success' && (
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                                )}
                                {status === 'failed' && (
                                  <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
                                )}
                                {status === 'uploading' && (
                                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                                )}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <div className="min-w-0 text-[11px] text-slate-500">
            {uploading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                正在上传 {uploadDone}/{uploadTotal}
                <span className="inline-block h-1.5 w-28 overflow-hidden rounded-full bg-slate-100 align-middle">
                  <span
                    className="block h-full rounded-full bg-primary transition-all"
                    style={{ width: uploadPercent + '%' }}
                  />
                </span>
              </span>
            ) : matched && conflictCount > 0 ? (
              <span className="flex items-center gap-1.5 text-rose-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                已勾选 {selectedCount} 项 · {conflictCount} 个 SKU 存在覆盖冲突
              </span>
            ) : matched ? (
              '已勾选 ' + selectedCount + ' 项'
            ) : (
              '选择文件夹并匹配商品后即可开始上传'
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="h-9 rounded-md border border-slate-300 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void handleStartUpload()}
              disabled={!matched || selectedCount === 0 || uploading}
              title={
                conflictCount > 0
                  ? '存在 ' + conflictCount + ' 个 SKU 覆盖冲突,点击后将弹出确认窗口'
                  : undefined
              }
              className={
                'flex h-9 items-center justify-center gap-1.5 rounded-md px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 ' +
                (conflictCount > 0
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-slate-900 hover:bg-primary')
              }
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : conflictCount > 0 ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
              {uploading
                ? '上传中...'
                : conflictCount > 0
                ? '开始上传(' + selectedCount + ' · ⚠ ' + conflictCount + ')'
                : '开始上传(' + selectedCount + ')'}
            </button>
          </div>
        </div>
      </div>

      {previewState && (
        <ImagePreviewModal
          images={previewState.images}
          initialIndex={previewState.initialIndex}
          onClose={() => setPreviewState(null)}
        />
      )}
    </div>
  );
}
