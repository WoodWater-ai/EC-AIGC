import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { assetApi } from '../api/modules/asset';
import {
  modelProfileApi,
  type ModelCandidate,
  type ModelCandidateGenerateRequest,
  type ModelGenerationMode,
  type ModelGenerationPreflight,
} from '../api/modules/modelProfile';
import { useFileUpload } from '../hooks/useFileUpload';
import { withCosThumbnail } from '../utils/cosImage';
import { ImagePreviewModal } from './ImagePreviewModal';

export type ModelCreatorAssetTarget = 'reference' | 'face_source' | 'target_appearance';

export interface ModelCreatorAsset {
  id: string;
  name: string;
  url: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onPublished: () => void;
  onRequestAsset: (
    target: ModelCreatorAssetTarget,
    onSelected: (asset: ModelCreatorAsset) => void,
  ) => void;
}

type ModelCreatorMode = ModelGenerationMode | 'upload';

type UploadCandidateStatus = 'uploading' | 'ready' | 'failed';

interface UploadCandidate {
  clientId: string;
  file: File;
  fileName: string;
  previewUrl: string;
  status: UploadCandidateStatus;
  assetResourceId?: string;
  error?: string;
}

const MODES: Array<{
  id: ModelCreatorMode;
  label: string;
  description: string;
  icon: string;
}> = [
  { id: 'text', label: '文本生成', description: '用人物描述生成候选图', icon: 'auto_awesome' },
  { id: 'reference', label: '参考图生成', description: '参考人物气质与画面', icon: 'image' },
  { id: 'face_swap', label: '换脸生成', description: '授权脸部替换到目标形象', icon: 'face_retouching_natural' },
  { id: 'upload', label: '上传已有模特', description: '批量上传已有模特图片', icon: 'upload_file' },
];

const TERMINAL_TASK_STATUSES = new Set([
  'FAILED',
  'REJECTED',
  'CANCELED',
  'ARCHIVED',
]);

const isGenerationComplete = (status: string | undefined, progress: number) =>
  TERMINAL_TASK_STATUSES.has(status ?? '')
  || (progress >= 100
    && (status === 'PENDING_REVIEW_SCORE' || status === 'PENDING_REVIEW_PUBLISH'));

export function ModelProfileCreator({
  open,
  onClose,
  onPublished,
  onRequestAsset,
}: Props) {
  const [mode, setMode] = useState<ModelCreatorMode>('text');
  const [prompt, setPrompt] = useState('');
  const [reference, setReference] = useState<ModelCreatorAsset>();
  const [faceSource, setFaceSource] = useState<ModelCreatorAsset>();
  const [targetAppearance, setTargetAppearance] = useState<ModelCreatorAsset>();
  const [sourceDescription, setSourceDescription] = useState('');
  const [rightsAccepted, setRightsAccepted] = useState(false);
  const [candidateCount, setCandidateCount] = useState(4);
  const [candidates, setCandidates] = useState<ModelCandidate[]>([]);
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(() => new Set());
  const [profileName, setProfileName] = useState('');
  const [preflight, setPreflight] = useState<ModelGenerationPreflight>();
  const [taskId, setTaskId] = useState<string>();
  const [taskStatus, setTaskStatus] = useState<string>();
  const [progress, setProgress] = useState(0);
  const [working, setWorking] = useState(false);
  const [failReason, setFailReason] = useState<string>();
  const [previewIndex, setPreviewIndex] = useState<number>();
  const [uploadedCandidates, setUploadedCandidates] = useState<UploadCandidate[]>([]);
  const [selectedUploadIds, setSelectedUploadIds] = useState<Set<string>>(() => new Set());
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploadedCandidatesRef = useRef<UploadCandidate[]>([]);
  const { upload } = useFileUpload({ purpose: 'OTHER' });

  useEffect(() => {
    uploadedCandidatesRef.current = uploadedCandidates;
  }, [uploadedCandidates]);

  useEffect(() => () => {
    uploadedCandidatesRef.current.forEach((candidate) => URL.revokeObjectURL(candidate.previewUrl));
  }, []);

  useEffect(() => {
    if (open) return;
    setMode('text');
    setPrompt('');
    setReference(undefined);
    setFaceSource(undefined);
    setTargetAppearance(undefined);
    setSourceDescription('');
    setRightsAccepted(false);
    setCandidateCount(4);
    setCandidates([]);
    setSelectedResultIds(new Set());
    setProfileName('');
    setPreflight(undefined);
    setTaskId(undefined);
    setTaskStatus(undefined);
    setProgress(0);
    setWorking(false);
    setFailReason(undefined);
    setPreviewIndex(undefined);
    uploadedCandidates.forEach((candidate) => URL.revokeObjectURL(candidate.previewUrl));
    setUploadedCandidates([]);
    setSelectedUploadIds(new Set());
    setUploading(false);
  }, [open]);

  useEffect(() => {
    if (!open || !taskId || isGenerationComplete(taskStatus, progress)) return;
    let alive = true;

    const poll = async () => {
      try {
        const response = await modelProfileApi.candidates(taskId);
        if (!alive) return;
        setTaskStatus(response.taskStatus);
        setProgress(response.progressPercent ?? 0);
        setCandidates(response.candidates);
        setFailReason(response.failReason);
      } catch (error) {
        if (alive) {
          setFailReason((error as Error).message);
        }
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 2000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [open, progress, taskId, taskStatus]);

  const canGenerate = useMemo(
    () => (mode === 'text' && Boolean(prompt.trim()))
      || (mode === 'reference' && Boolean(reference))
      || (mode === 'face_swap'
        && Boolean(faceSource && targetAppearance && rightsAccepted && sourceDescription.trim())),
    [faceSource, mode, prompt, reference, rightsAccepted, sourceDescription, targetAppearance],
  );

  const requestBody = (): ModelCandidateGenerateRequest => ({
    mode: mode as ModelGenerationMode,
    prompt: prompt.trim() || undefined,
    referenceAssetId: reference?.id,
    faceSourceAssetId: faceSource?.id,
    targetAppearanceAssetId: targetAppearance?.id,
    candidateCount,
    aspectRatio: '3:4',
    resolution: '1K',
    sourceDescription: sourceDescription.trim() || undefined,
    rightsAccepted,
  });

  if (!open) return null;

  const chooseMode = (next: ModelCreatorMode) => {
    if (working || uploading || taskId) return;
    setMode(next);
    setPreflight(undefined);
    setCandidates([]);
    setSelectedResultIds(new Set());
    setProfileName('');
    setFailReason(undefined);
  };

  const updateUploadCandidate = (
    clientId: string,
    update: Partial<UploadCandidate>,
  ) => {
    setUploadedCandidates((current) => current.map(
      (candidate) => candidate.clientId === clientId
        ? { ...candidate, ...update }
        : candidate,
    ));
  };

  const uploadFiles = async (files: File[]) => {
    const allImageFiles = files.filter((file) => file.type.startsWith('image/'));
    const availableCount = Math.max(0, 20 - uploadedCandidates.length);
    const imageFiles = allImageFiles.slice(0, availableCount);
    if (allImageFiles.length === 0) {
      toast.error('请选择图片文件');
      return;
    }
    if (allImageFiles.length !== files.length) {
      toast.warning(`已忽略 ${files.length - allImageFiles.length} 个非图片文件`);
    }
    if (imageFiles.length === 0) {
      toast.warning('单次最多保存 20 张模特图片');
      return;
    }
    if (imageFiles.length !== allImageFiles.length) {
      toast.warning(`单次最多保存 20 张，已忽略 ${allImageFiles.length - imageFiles.length} 张`);
    }

    const incoming = imageFiles.map<UploadCandidate>((file, index) => ({
      clientId: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
      file,
      fileName: file.name,
      previewUrl: URL.createObjectURL(file),
      status: 'uploading',
    }));
    setUploadedCandidates((current) => [...current, ...incoming]);
    if (!profileName.trim() && incoming[0]) {
      setProfileName(incoming[0].fileName.replace(/\.[^/.]+$/, ''));
    }
    setUploading(true);

    let successCount = 0;
    for (const candidate of incoming) {
      try {
        const result = await upload(candidate.file);
        const assetResourceId = await assetApi.create({
          fileResourceId: result.fileResourceId,
          fileMd5: result.fileMd5,
          name: candidate.fileName,
          assetKind: 'IMAGE',
          assetType: 'MODEL_PROFILE',
          tags: '模特库,已有模特',
        });
        updateUploadCandidate(candidate.clientId, {
          assetResourceId,
          status: 'ready',
          error: undefined,
        });
        setSelectedUploadIds((current) => new Set(current).add(candidate.clientId));
        successCount += 1;
      } catch (error) {
        updateUploadCandidate(candidate.clientId, {
          status: 'failed',
          error: (error as Error).message,
        });
      }
    }

    setUploading(false);
    if (successCount > 0) {
      toast.success(`已上传 ${successCount} 张模特图片`);
    }
    if (successCount < incoming.length) {
      toast.error(`${incoming.length - successCount} 张图片上传失败`);
    }
  };

  const handleUploadInput = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []) as File[];
    event.currentTarget.value = '';
    if (files.length > 0) void uploadFiles(files);
  };

  const removeUploadCandidate = (clientId: string) => {
    setUploadedCandidates((current) => {
      const target = current.find((candidate) => candidate.clientId === clientId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((candidate) => candidate.clientId !== clientId);
    });
    setSelectedUploadIds((current) => {
      const next = new Set(current);
      next.delete(clientId);
      return next;
    });
  };

  const handlePreflight = async () => {
    setWorking(true);
    setFailReason(undefined);
    try {
      setPreflight(await modelProfileApi.preflight(requestBody()));
    } catch (error) {
      const message = (error as Error).message;
      setFailReason(message);
      toast.error(message);
    } finally {
      setWorking(false);
    }
  };

  const handleGenerate = async () => {
    setWorking(true);
    setFailReason(undefined);
    try {
      const response = await modelProfileApi.generate(requestBody());
      setTaskId(response.taskId);
      setTaskStatus(response.status);
      setCandidates([]);
      setSelectedResultIds(new Set());
      setPreflight(undefined);
      setProfileName(
        mode === 'text' ? 'AI 模特' : mode === 'reference' ? '参考图模特' : '授权换脸模特',
      );
      toast.success('候选生成任务已提交');
    } catch (error) {
      const message = (error as Error).message;
      setFailReason(message);
      toast.error(message);
    } finally {
      setWorking(false);
    }
  };

  const save = async () => {
    const readySelectedUploads = uploadedCandidates.filter(
      (candidate) => candidate.status === 'ready'
        && candidate.assetResourceId
        && selectedUploadIds.has(candidate.clientId),
    );
    const selectedCount = mode === 'upload'
      ? readySelectedUploads.length
      : selectedResultIds.size;
    if (selectedCount === 0 || !profileName.trim()) return;
    setWorking(true);
    try {
      if (mode === 'upload') {
        await modelProfileApi.importExisting({
          assetResourceIds: readySelectedUploads.map(
            (candidate) => candidate.assetResourceId as string,
          ),
          name: profileName.trim(),
          tags: ['已有模特', '人物资产'],
          suitableFor: ['product_main', 'scene_detail', 'model_triple_view'],
          reason: '由用户上传的已有模特图片创建。',
        });
      } else {
        await modelProfileApi.publish({
          generationResultIds: Array.from(selectedResultIds),
          name: profileName.trim(),
          tags: [
            mode === 'text' ? 'AI 生成' : mode === 'reference' ? '参考图生成' : '换脸生成',
            '人物资产',
          ],
          suitableFor: ['product_main', 'scene_detail', 'model_triple_view'],
          reason: mode === 'face_swap'
            ? '由已授权脸部来源与目标形象生成。'
            : mode === 'reference'
              ? '由授权参考图生成。'
              : '由文本描述生成的虚拟模特。',
        });
      }
      toast.success(`已保存 ${selectedCount} 个模特到资源库`);
      onPublished();
      onClose();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const generating = Boolean(taskId) && !isGenerationComplete(taskStatus, progress);
  const allCandidatesSelected = candidates.length > 0
    && candidates.every((candidate) => selectedResultIds.has(candidate.generationResultId));
  const readyUploadCandidates = uploadedCandidates.filter((candidate) => candidate.status === 'ready');
  const allUploadsSelected = readyUploadCandidates.length > 0
    && readyUploadCandidates.every((candidate) => selectedUploadIds.has(candidate.clientId));
  const selectedCount = mode === 'upload' ? selectedUploadIds.size : selectedResultIds.size;

  const toggleCandidate = (generationResultId: string) => {
    setSelectedResultIds((current) => {
      const next = new Set(current);
      if (next.has(generationResultId)) {
        next.delete(generationResultId);
      } else {
        next.add(generationResultId);
      }
      return next;
    });
  };

  const toggleAllCandidates = () => {
    setSelectedResultIds(allCandidatesSelected
      ? new Set()
      : new Set(candidates.map((candidate) => candidate.generationResultId)));
  };

  const toggleUploadCandidate = (clientId: string) => {
    const candidate = uploadedCandidates.find((item) => item.clientId === clientId);
    if (!candidate || candidate.status !== 'ready') return;
    setSelectedUploadIds((current) => {
      const next = new Set(current);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const toggleAllUploads = () => {
    setSelectedUploadIds(allUploadsSelected
      ? new Set()
      : new Set(readyUploadCandidates.map((candidate) => candidate.clientId)));
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">新建 AI 模特</h2>
            <p className="mt-1 text-xs text-slate-500">
              {mode === 'upload'
                ? '批量上传已有模特 → 设置模特名称 → 保存到模特资源库。'
                : '输入 → Vidu Image 2 生成候选 → 可多选保存为人物资产。'}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={working || uploading}
            className="grid h-8 w-8 place-items-center rounded text-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="关闭"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="p-6">
          <div className="grid grid-cols-2 border-b border-slate-200 sm:grid-cols-4">
            {MODES.map((item) => (
              <button
                key={item.id}
                onClick={() => chooseMode(item.id)}
                disabled={Boolean(taskId) || working || uploading}
                className={`flex min-h-16 items-center gap-2 border-b-2 px-3 text-left disabled:cursor-not-allowed ${
                  mode === item.id ? 'border-primary text-primary' : 'border-transparent text-slate-500'
                }`}
              >
                <span className="material-symbols-outlined text-lg">{item.icon}</span>
                <span>
                  <span className="block text-xs font-black">{item.label}</span>
                  <span className="hidden text-[10px] text-slate-400 lg:block">{item.description}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
            <section>
              {mode === 'text' && (
                <label className="block text-xs font-black text-slate-700">
                  人物描述
                  <textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    disabled={Boolean(taskId)}
                    placeholder="例如：25 岁东方面孔女模特，清透自然妆，居家睡衣风格，全身站姿"
                    className="mt-2 h-28 w-full resize-none rounded border border-slate-200 p-3 text-sm outline-none focus:border-primary disabled:bg-slate-50"
                  />
                </label>
              )}

              {mode === 'reference' && (
                <>
                  <AssetTile
                    asset={reference}
                    label="选择形象或风格参考图"
                    disabled={Boolean(taskId)}
                    onClick={() => onRequestAsset('reference', setReference)}
                  />
                  <input
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    disabled={Boolean(taskId)}
                    placeholder="补充描述（可选）"
                    className="mt-4 h-9 w-full rounded border border-slate-200 px-3 text-xs outline-none focus:border-primary"
                  />
                </>
              )}

              {mode === 'face_swap' && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <AssetTile
                      asset={faceSource}
                      label="1. 选择脸部来源"
                      disabled={Boolean(taskId)}
                      onClick={() => onRequestAsset('face_source', setFaceSource)}
                    />
                    <AssetTile
                      asset={targetAppearance}
                      label="2. 选择目标形象"
                      disabled={Boolean(taskId)}
                      onClick={() => onRequestAsset('target_appearance', setTargetAppearance)}
                    />
                  </div>
                  <input
                    value={sourceDescription}
                    onChange={(event) => setSourceDescription(event.target.value)}
                    disabled={Boolean(taskId)}
                    placeholder="授权来源说明"
                    className="mt-4 h-9 w-full rounded border border-slate-200 px-3 text-xs outline-none focus:border-primary"
                  />
                  <label className="mt-3 flex gap-2 text-[11px] leading-5 text-slate-600">
                    <input
                      checked={rightsAccepted}
                      onChange={(event) => setRightsAccepted(event.target.checked)}
                      disabled={Boolean(taskId)}
                      type="checkbox"
                      className="mt-1"
                    />
                    我确认对脸部来源拥有合法肖像及生成使用授权，并同意记录来源、操作者、时间和声明版本。
                  </label>
                </>
              )}

              {mode === 'upload' && (
                <div>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleUploadInput}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => uploadInputRef.current?.click()}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (!uploading) void uploadFiles(Array.from(event.dataTransfer.files));
                    }}
                    disabled={uploading}
                    className="grid min-h-52 w-full place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 text-center transition hover:border-primary hover:bg-blue-50 disabled:cursor-wait disabled:opacity-70"
                  >
                    <span>
                      <span className="material-symbols-outlined text-4xl text-primary">
                        {uploading ? 'progress_activity' : 'cloud_upload'}
                      </span>
                      <span className="mt-3 block text-sm font-black text-slate-800">
                        {uploading ? '正在上传模特图片…' : '点击或拖拽上传已有模特'}
                      </span>
                      <span className="mt-2 block text-[11px] leading-5 text-slate-500">
                        支持 JPG、PNG、WebP，可批量选择，单次最多 20 张
                      </span>
                    </span>
                  </button>
                  {uploadedCandidates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => uploadInputRef.current?.click()}
                      disabled={uploading}
                      className="mt-3 inline-flex h-9 items-center gap-1.5 rounded border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-base">add_photo_alternate</span>
                      继续添加
                    </button>
                  )}
                </div>
              )}

              {mode !== 'upload' && <div className="mt-5 flex flex-wrap gap-3">
                <div className="flex h-10 items-center rounded border border-slate-200">
                  <span className="px-3 text-xs font-bold text-slate-600">生成数量</span>
                  <button
                    onClick={() => setCandidateCount((value) => Math.max(1, value - 1))}
                    disabled={Boolean(taskId)}
                    className="h-full w-9 border-l border-slate-200 disabled:text-slate-300"
                  >−</button>
                  <output className="grid h-full w-9 place-items-center border-l border-slate-200 text-xs font-black">
                    {candidateCount}
                  </output>
                  <button
                    onClick={() => setCandidateCount((value) => Math.min(4, value + 1))}
                    disabled={Boolean(taskId)}
                    className="h-full w-9 border-l border-slate-200 disabled:text-slate-300"
                  >＋</button>
                </div>
                {!taskId && (
                  <button
                    onClick={handlePreflight}
                    disabled={!canGenerate || working}
                    className="h-10 rounded bg-primary px-4 text-xs font-bold text-white disabled:bg-slate-300"
                  >
                    {working ? '预检中…' : `生成 ${candidateCount} 张候选图`}
                  </button>
                )}
              </div>}

              {taskId && (
                <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">
                      {generating ? 'Vidu 正在生成候选图' : `任务状态：${taskStatus ?? '未知'}`}
                    </span>
                    <span className="font-mono text-primary">{progress}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-100">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-2 truncate text-[10px] text-slate-400">任务 ID：{taskId}</p>
                </div>
              )}

              {failReason && (
                <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {failReason}
                </div>
              )}
            </section>

            <aside className="border-l border-slate-100 pl-6">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black text-slate-700">
                  {mode === 'upload' ? '已上传模特' : '候选图'}
                  <span className="ml-1 font-normal text-slate-400">
                    {mode === 'upload'
                      ? `${uploadedCandidates.length} 张`
                      : candidates.length ? `${candidates.length} 张` : `待生成 ${candidateCount} 张`}
                  </span>
                </p>
                {mode === 'upload' && readyUploadCandidates.length > 0 ? (
                  <button
                    type="button"
                    onClick={toggleAllUploads}
                    className="text-[11px] font-bold text-primary hover:underline"
                  >
                    {allUploadsSelected ? '取消全选' : '全选'}
                  </button>
                ) : mode !== 'upload' && candidates.length > 0 ? (
                  <button
                    type="button"
                    onClick={toggleAllCandidates}
                    className="text-[11px] font-bold text-primary hover:underline"
                  >
                    {allCandidatesSelected ? '取消全选' : '全选'}
                  </button>
                ) : null}
              </div>
              {mode === 'upload' ? uploadedCandidates.length === 0 ? (
                <div className="mt-3 grid h-48 place-items-center rounded border border-dashed border-slate-300 bg-slate-50 px-5 text-center text-[11px] leading-5 text-slate-400">
                  上传后的模特会展示在这里，可多选并统一设置名称后保存。
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {uploadedCandidates.map((candidate, index) => (
                    <div
                      key={candidate.clientId}
                      title={candidate.error}
                      className={`relative aspect-[3/4] overflow-hidden border-2 ${
                        selectedUploadIds.has(candidate.clientId)
                          ? 'border-primary'
                          : candidate.status === 'failed'
                            ? 'border-red-300'
                            : 'border-transparent hover:border-slate-300'
                      }`}
                    >
                      <button
                        type="button"
                        aria-pressed={selectedUploadIds.has(candidate.clientId)}
                        aria-label={`选择上传模特 ${index + 1}`}
                        onClick={() => toggleUploadCandidate(candidate.clientId)}
                        className="absolute inset-0"
                      >
                        <img
                          src={candidate.previewUrl}
                          alt={candidate.fileName}
                          className="h-full w-full object-cover"
                        />
                        <span
                          className={`absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full border text-[13px] ${
                            selectedUploadIds.has(candidate.clientId)
                              ? 'border-primary bg-primary text-white'
                              : 'border-white/80 bg-slate-900/35 text-transparent'
                          }`}
                        >
                          ✓
                        </span>
                        {candidate.status !== 'ready' && (
                          <span className={`absolute inset-x-0 bottom-0 px-2 py-1.5 text-[10px] font-bold text-white ${
                            candidate.status === 'failed' ? 'bg-red-600/90' : 'bg-slate-900/70'
                          }`}>
                            {candidate.status === 'failed' ? '上传失败' : '上传中…'}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label={`移除上传模特 ${index + 1}`}
                        title="移除"
                        onClick={() => removeUploadCandidate(candidate.clientId)}
                        disabled={candidate.status === 'uploading'}
                        className="absolute left-1.5 top-1.5 z-10 grid h-6 w-6 place-items-center rounded-full bg-slate-950/65 text-white disabled:hidden"
                      >
                        <span className="material-symbols-outlined text-[15px]">close</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`放大查看上传模特 ${index + 1}`}
                        title="放大查看"
                        onClick={() => setPreviewIndex(index)}
                        className="absolute bottom-1.5 right-1.5 z-10 grid h-7 w-7 place-items-center rounded-full bg-slate-950/65 text-white shadow-md backdrop-blur-sm transition hover:bg-slate-950/85"
                      >
                        <span className="material-symbols-outlined text-[17px]">zoom_in</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : candidates.length === 0 ? (
                <div className="mt-3 grid h-48 place-items-center rounded border border-dashed border-slate-300 bg-slate-50 px-5 text-center text-[11px] leading-5 text-slate-400">
                  {generating ? '生成中，结果会自动出现在这里。' : '生成后可多选候选图，分别保存到模特资源库。'}
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {candidates.map((candidate, index) => (
                    <div
                      key={candidate.generationResultId}
                      className={`relative aspect-[3/4] overflow-hidden border-2 ${
                        selectedResultIds.has(candidate.generationResultId)
                          ? 'border-primary'
                          : 'border-transparent hover:border-slate-300'
                      }`}
                    >
                      <button
                        type="button"
                        aria-pressed={selectedResultIds.has(candidate.generationResultId)}
                        aria-label={`选择候选模特 ${index + 1}`}
                        onClick={() => toggleCandidate(candidate.generationResultId)}
                        className="absolute inset-0"
                      >
                        <img
                          src={withCosThumbnail(candidate.thumbnailUrl || candidate.imageUrl, 480)}
                          alt={`候选模特 ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <span
                          className={`absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full border text-[13px] ${
                            selectedResultIds.has(candidate.generationResultId)
                              ? 'border-primary bg-primary text-white'
                              : 'border-white/80 bg-slate-900/35 text-transparent'
                          }`}
                        >
                          ✓
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`放大查看候选模特 ${index + 1}`}
                        title="放大查看"
                        onClick={() => setPreviewIndex(index)}
                        className="absolute bottom-1.5 right-1.5 z-10 grid h-7 w-7 place-items-center rounded-full bg-slate-950/65 text-white shadow-md backdrop-blur-sm transition hover:bg-slate-950/85"
                      >
                        <span className="material-symbols-outlined text-[17px]">zoom_in</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {selectedCount > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="mb-2 text-[11px] text-slate-500">
                    已选择 {selectedCount} 张；多选时将分别创建模特档案。
                  </p>
                  <input
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    placeholder="模特名称"
                    className="h-9 w-full rounded border border-slate-200 px-2 text-xs outline-none focus:border-primary"
                  />
                  <button
                    onClick={save}
                    disabled={!profileName.trim() || working || uploading}
                    className="mt-3 h-9 w-full rounded bg-slate-900 text-xs font-bold text-white disabled:bg-slate-300"
                  >
                    {working ? '保存中…' : `保存 ${selectedCount} 张到模特库`}
                  </button>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>

      {preflight && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-sm rounded border border-slate-200 bg-white p-5 shadow-xl">
            <p className="text-[11px] font-bold text-primary">Preflight 已通过</p>
            <h3 className="mt-1 text-sm font-black">确认生成 {preflight.candidateCount} 张候选图</h3>
            <div className="mt-4 space-y-2 border-y border-slate-100 py-3 text-xs">
              <InfoRow label="通道" value={`${preflight.channelName} (${preflight.channelType})`} />
              <InfoRow label="能力" value={preflight.capability} />
              <InfoRow label="模型" value={preflight.model} />
              <InfoRow
                label="预计费用"
                value={preflight.estimatedCost == null
                  ? '以实际 credits 为准'
                  : `${preflight.currency} ${preflight.estimatedCost.toFixed(2)}`}
              />
            </div>
            <p className="mt-3 text-[11px] leading-4 text-slate-500">{preflight.billingNote}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setPreflight(undefined)}
                className="h-8 px-3 text-xs font-bold text-slate-500"
              >取消</button>
              <button
                onClick={handleGenerate}
                disabled={working}
                className="h-8 rounded bg-primary px-3 text-xs font-bold text-white disabled:bg-slate-300"
              >
                {working ? '提交中…' : '确认并生成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewIndex !== undefined && (
        <ImagePreviewModal
          images={mode === 'upload'
            ? uploadedCandidates.map((candidate, index) => ({
                url: candidate.previewUrl,
                label: candidate.fileName || `上传模特 ${index + 1}`,
              }))
            : candidates.map((candidate, index) => ({
                url: candidate.imageUrl,
                label: `候选模特 ${index + 1}`,
              }))}
          initialIndex={previewIndex}
          onClose={() => setPreviewIndex(undefined)}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-bold text-slate-800">{value}</span>
    </div>
  );
}

function AssetTile({
  asset,
  label,
  disabled,
  onClick,
}: {
  asset?: ModelCreatorAsset;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-3 flex min-h-36 w-full items-center gap-3 rounded border border-dashed border-slate-300 bg-slate-50 p-3 text-left hover:border-primary hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <span className="h-28 w-24 shrink-0 overflow-hidden rounded bg-white">
        {asset
          ? <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" />
          : (
            <span className="grid h-full place-items-center text-slate-400">
              <span className="material-symbols-outlined text-2xl">folder_open</span>
            </span>
          )}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-black text-slate-700">{label}</span>
        {asset && <span className="mt-1 block truncate text-[11px] text-slate-500">{asset.name}</span>}
        <span className="mt-2 block text-[11px] font-bold text-primary">从资源中心选择</span>
      </span>
    </button>
  );
}
