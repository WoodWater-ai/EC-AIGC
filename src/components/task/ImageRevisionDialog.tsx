import React, { useRef, useState } from 'react';
import type { TaskGroupItemResponse, TaskResultPreviewResponse } from '../../types';
import { useFileUpload } from '../../hooks/useFileUpload';
import { taskApi } from '../../api/modules/task';
import { toast } from 'sonner';

interface ImageRevisionDialogProps {
  source: TaskResultPreviewResponse;
  task: TaskGroupItemResponse;
  onClose: () => void;
  onSubmitted: () => Promise<void>;
}

interface Point {
  x: number;
  y: number;
}

export const ImageRevisionDialog: React.FC<ImageRevisionDialogProps> = ({
  source,
  task,
  onClose,
  onSubmitted,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [brushSize, setBrushSize] = useState(32);
  const [erasing, setErasing] = useState(false);
  const [instruction, setInstruction] = useState(
    source.rejectReason || '请只调整标记区域，并保持商品主体、材质、颜色和未标记区域不变。',
  );
  const [submitting, setSubmitting] = useState(false);
  const { upload, loading: uploading, progress } = useFileUpload({
    purpose: 'IMAGE_EDIT_MASK',
  });

  const resizeCanvas = (width: number, height: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.clearRect(0, 0, width, height);
    setImageSize({ width, height });
  };

  const pointFromEvent = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ): Point => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height,
    };
  };

  const drawTo = (
    event: React.PointerEvent<HTMLCanvasElement>,
    startNewStroke = false,
  ) => {
    if (!drawingRef.current) return;
    const canvas = event.currentTarget;
    const context = canvas.getContext('2d');
    if (!context) return;
    const point = pointFromEvent(event);
    const rect = canvas.getBoundingClientRect();
    const scaledBrush = brushSize * canvas.width / rect.width;
    const previous = startNewStroke ? point : lastPointRef.current ?? point;

    context.save();
    context.globalCompositeOperation = erasing
      ? 'destination-out'
      : 'source-over';
    // 画布内部保存不透明选区，显示透明度统一由 canvas 元素控制。
    // 避免 pointermove 重复覆盖同一区域时 alpha 不断叠加、最终遮住底图。
    context.strokeStyle = '#0256ff';
    context.fillStyle = '#0256ff';
    context.lineWidth = scaledBrush;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    context.beginPath();
    context.arc(point.x, point.y, scaledBrush / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
    lastPointRef.current = point;
  };

  const buildBinaryMask = async (): Promise<File> => {
    const sourceCanvas = canvasRef.current;
    if (!sourceCanvas) throw new Error('蒙版画布尚未初始化');

    const output = document.createElement('canvas');
    output.width = sourceCanvas.width;
    output.height = sourceCanvas.height;
    const context = output.getContext('2d');
    if (!context) throw new Error('无法创建蒙版画布');

    const selectionPixels = sourceCanvas.getContext('2d')?.getImageData(
      0, 0, sourceCanvas.width, sourceCanvas.height,
    ).data;
    if (!selectionPixels) throw new Error('无法读取蒙版选区');
    const maskPixels = context.createImageData(output.width, output.height);
    for (let index = 0; index < selectionPixels.length; index += 4) {
      if (selectionPixels[index + 3] > 0) {
        maskPixels.data[index] = 255;
        maskPixels.data[index + 1] = 255;
        maskPixels.data[index + 2] = 255;
        maskPixels.data[index + 3] = 255;
      }
      // 未选择区域保持 RGBA=0，即完全透明。
    }
    context.putImageData(maskPixels, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      output.toBlob(resolve, 'image/png'),
    );
    if (!blob) throw new Error('蒙版生成失败');
    return new File(
      [blob],
      `image-revision-mask-${source.id}.png`,
      { type: 'image/png' },
    );
  };

  const submit = async () => {
    if (!instruction.trim()) {
      toast.error('请填写本轮修改要求');
      return;
    }
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const pixels = context.getImageData(
      0, 0, canvas.width, canvas.height,
    ).data;
    let hasMask = false;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 0) {
        hasMask = true;
        break;
      }
    }
    if (!hasMask) {
      toast.error('请先涂抹需要修改的区域');
      return;
    }

    setSubmitting(true);
    try {
      const maskFile = await buildBinaryMask();
      const uploaded = await upload(maskFile);
      const response = await taskApi.submitImageRevision({
        sourceResultId: source.id,
        maskFileResourceId: uploaded.fileResourceId,
        instruction: instruction.trim(),
      });
      toast.success(`二次编辑 v${response.revisionNo} 已提交`);
      await onSubmitted();
    } catch (error) {
      if (error instanceof Error && error.message) {
        toast.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/65" onClick={onClose} />
      <section className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-[11px] font-bold text-primary">图片二次编辑</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">
              标记需要修改的区域
            </h2>
            <p className="mt-1 text-[11px] text-slate-400">
              当前成果 v{source.revisionNo ?? 1} · 蒙版将按原图尺寸生成
            </p>
          </div>
          <button
            onClick={onClose}
            className="material-symbols-outlined text-slate-400"
            aria-label="关闭二次编辑"
          >
            close
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-h-[420px] items-center justify-center bg-slate-100 p-5">
            <div
              className="relative max-w-full overflow-hidden bg-white shadow-sm"
              style={{
                aspectRatio: `${imageSize.width} / ${imageSize.height}`,
                width: `min(100%, calc(72vh * ${imageSize.width} / ${imageSize.height}))`,
              }}
            >
              <img
                src={source.url}
                alt="二次编辑源图片"
                className="absolute inset-0 h-full w-full object-contain"
                referrerPolicy="no-referrer"
                onLoad={(event) => resizeCanvas(
                  event.currentTarget.naturalWidth,
                  event.currentTarget.naturalHeight,
                )}
              />
              <canvas
                ref={canvasRef}
                onPointerDown={(event) => {
                  drawingRef.current = true;
                  lastPointRef.current = null;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  drawTo(event, true);
                }}
                onPointerMove={(event) => drawTo(event)}
                onPointerUp={() => {
                  drawingRef.current = false;
                  lastPointRef.current = null;
                }}
                onPointerCancel={() => {
                  drawingRef.current = false;
                  lastPointRef.current = null;
                }}
                className="absolute inset-0 h-full w-full cursor-crosshair touch-none opacity-25"
              />
            </div>
          </div>

          <aside className="space-y-5 overflow-y-auto border-l border-slate-200 p-5">
            <details open className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <summary className="cursor-pointer text-xs font-black text-primary">
                原任务上下文
              </summary>
              <div className="mt-3 space-y-2 break-words text-[11px] leading-5 text-slate-600">
                <p className="rounded bg-white/70 px-2 py-1 text-[10px] text-primary">
                  以下内容仅供编辑时参考，不会拼接进本轮局部编辑 Prompt。
                </p>
                <p><b>原始 Prompt：</b>{task.taskPrompt || '未记录'}</p>
                <p><b>负面约束：</b>{task.negativePrompt || '未设置'}</p>
                {source.editInstruction && (
                  <p><b>上一轮编辑：</b>{source.editInstruction}</p>
                )}
                {source.rejectReason && (
                  <p className="text-red-700">
                    <b>审核意见：</b>{source.rejectReason}
                  </p>
                )}
              </div>
            </details>

            <label className="block text-xs font-black text-slate-800">
              本轮修改要求
              <textarea
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                maxLength={1000}
                className="mt-2 h-28 w-full resize-none rounded-lg border border-slate-200 p-3 text-xs font-normal leading-5 outline-none focus:border-primary"
              />
              <span className="mt-1 block text-right text-[10px] font-normal text-slate-400">
                {instruction.length}/1000
              </span>
            </label>

            <label className="block text-xs font-black text-slate-800">
              画笔大小：{brushSize}px
              <input
                type="range"
                min="8"
                max="96"
                value={brushSize}
                onChange={(event) => setBrushSize(Number(event.target.value))}
                className="mt-3 w-full"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setErasing((value) => !value)}
                className={`h-9 rounded-lg border text-xs font-bold ${
                  erasing
                    ? 'border-primary bg-blue-50 text-primary'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                {erasing ? '当前：橡皮擦' : '切换橡皮擦'}
              </button>
              <button
                onClick={() => canvasRef.current?.getContext('2d')?.clearRect(
                  0, 0,
                  canvasRef.current.width,
                  canvasRef.current.height,
                )}
                className="h-9 rounded-lg border border-slate-200 text-xs font-bold text-slate-600"
              >
                清空涂抹
              </button>
            </div>

            <p className="rounded-lg bg-amber-50 p-3 text-[11px] leading-5 text-amber-700">
              蓝色半透明区域会生成同尺寸蒙版：选择区域为白色，其余区域透明，
              并作为 Vidu 的第二张参考图。
            </p>

            <button
              onClick={() => void submit()}
              disabled={submitting || uploading}
              className="h-10 w-full rounded-lg bg-primary text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading
                ? `正在上传蒙版 ${progress}%`
                : submitting ? '正在提交…' : '生成修改版本'}
            </button>
          </aside>
        </div>
      </section>
    </div>
  );
};
