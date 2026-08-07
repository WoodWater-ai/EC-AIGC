import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { AssetResourceItem } from '../../api/modules/asset';
import {
  assistantApi,
  type AssistantAttachmentInput,
  type AssistantGenerationResult,
  type AssistantMessage,
  type AssistantPromptRiskResult,
  type AssistantSession,
  type AssistantTaskTargetCapability,
  type AssistantTaskPrefill,
} from '../../api/modules/assistant';
import { AppScreen } from '../../types';
import { AssetImage } from '../AssetImage';
import { AssetTransitModal } from '../AssetTransitModal';
import { ImagePreviewModal, type PreviewImage } from '../ImagePreviewModal';

interface AssistantPageProps {
  onCreateTask: (screen: AppScreen, prefill: AssistantTaskPrefill) => void;
}

interface SelectedResource {
  sourceType: 'ASSET_RESOURCE' | 'ASSISTANT_RESULT';
  sourceId: string;
  type: 'IMAGE' | 'VIDEO';
  name: string;
  url: string;
}

interface TaskChoiceState {
  message: AssistantMessage;
  result: AssistantGenerationResult;
}

interface PromptRiskReviewState {
  prompt: string;
  result?: AssistantPromptRiskResult;
  stage: 'review' | 'optimizing' | 'ready' | 'error';
  optimizedPrompt?: string;
  errorMessage?: string;
}

const RUNNING_STATUSES = new Set(['PENDING', 'TOOL_RUNNING']);

type ProcessStepState = 'done' | 'active' | 'failed' | 'pending';

interface ProcessStep {
  title: string;
  description: string;
  state: ProcessStepState;
}

const CAPABILITY_LABELS: Record<string, string> = {
  REF_IMG_EDIT: '图片生成与编辑',
  IMG2VIDEO: '让图片动起来',
  SOLUTION_TRENDING_REPL: '爆款复刻',
  SOLUTION_AD_VIDEO_EDIT: '电商复刻',
};

const INTENT_LABELS: Record<string, string> = {
  IMAGE_GENERATION: '图片创作需求',
  VIDEO_GENERATION: '视频创作需求',
  CHITCHAT: '对话咨询',
};

const buildProcessSteps = (message: AssistantMessage): ProcessStep[] => {
  const capability = message.capability ?? '';
  const isPending = message.status === 'PENDING';
  const isRunning = message.status === 'TOOL_RUNNING';
  const isCompleted = message.status === 'COMPLETED';
  const isFailed = message.status === 'FAILED';
  const isCancelled = message.status === 'CANCELLED';

  if (!capability) {
    const promptOptimization = message.suggestionType === 'OPTIMIZE_PROMPT';
    return [{
      title: promptOptimization ? '优化提示词' : isCompleted ? '理解并回复' : '理解需求',
      description: isPending
        ? (promptOptimization ? '正在保持原意并优化提示词表达' : '正在结合当前会话和已选资源分析你的需求')
        : isFailed
          ? (message.errorMessage || '需求处理未完成')
          : isCancelled
            ? '本次处理已停止'
            : promptOptimization
              ? '已完成表达增强与风险歧义优化，可回填后继续创作'
              : `已识别为${INTENT_LABELS[message.intent ?? ''] ?? '普通对话需求'}`,
      state: isPending ? 'active' : isFailed ? 'failed' : isCancelled ? 'pending' : 'done',
    }];
  }

  const attachmentCount = message.attachments?.length ?? 0;
  const routeName = [message.executionChannelType, message.executionModelCode]
    .filter(Boolean).join(' · ');
  const finalState: ProcessStepState = isRunning
    ? 'active'
    : isCompleted
      ? 'done'
      : isFailed
        ? 'failed'
        : isCancelled
          ? 'pending'
          : 'active';

  return [
    {
      title: '理解需求',
      description: `已识别为${INTENT_LABELS[message.intent ?? ''] ?? '创作需求'}`,
      state: 'done',
    },
    {
      title: '制定创作方案',
      description: `选择“${CAPABILITY_LABELS[capability] ?? capability}”能力`,
      state: 'done',
    },
    {
      title: '检查素材与参数',
      description: attachmentCount > 0
        ? `已检查 ${attachmentCount} 项引用素材及生成参数`
        : '已检查生成参数，本次无需引用素材',
      state: 'done',
    },
    {
      title: '提交生成',
      description: routeName ? `已提交至 ${routeName}` : '已提交至任务能力默认路由',
      state: 'done',
    },
    {
      title: isCompleted ? '完成作品' : isFailed ? '生成未完成' : '生成作品',
      description: isCompleted
        ? `已生成 ${message.results?.length ?? 0} 个作品`
        : isFailed
          ? (message.errorMessage || '生成任务处理失败')
          : isCancelled
            ? '本次生成已停止'
            : '模型正在生成并处理结果',
      state: finalState,
    },
  ];
};

const createRequestId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const toDate = (time: unknown) => {
  if (Array.isArray(time) && time.length >= 3) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = time.map(Number);
    return new Date(year, month - 1, day, hour, minute, second);
  }
  if (typeof time === 'number') {
    return new Date(time < 1_000_000_000_000 ? time * 1000 : time);
  }
  if (typeof time === 'string' && time.trim()) {
    return new Date(time.includes('T') ? time : time.replace(' ', 'T'));
  }
  return null;
};

const formatTime = (time?: unknown) => {
  const date = toDate(time);
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
};

const formatSessionTime = (time?: unknown) => {
  const date = toDate(time);
  if (!date || Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
};

const QUICK_STARTS = [
  {
    icon: 'image',
    title: '参考图创作',
    description: '基于商品或模特素材继续生图',
    prompt: '请基于我选择的参考图片，生成一张新的电商创意图：',
  },
  {
    icon: 'animation',
    title: '让图片动起来',
    description: '以图片为首帧生成连贯视频',
    prompt: '请让这张图片动起来，保持主体和背景一致，动作自然连贯：',
  },
  {
    icon: 'video_library',
    title: '视频创意复刻',
    description: '分析视频结构并复刻创意节奏',
    prompt: '请参考我选择的视频，分析并复刻它的镜头节奏和创意结构：',
  },
] as const;

const mergeMessage = (messages: AssistantMessage[], next: AssistantMessage) => {
  const exists = messages.some((item) => item.id === next.id);
  return exists
    ? messages.map((item) => item.id === next.id ? next : item)
    : [...messages, next];
};

export function AssistantPage({ onCreateTask }: AssistantPageProps) {
  const [sessions, setSessions] = useState<AssistantSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [content, setContent] = useState('');
  const [selectedResources, setSelectedResources] = useState<SelectedResource[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [optimizingPrompt, setOptimizingPrompt] = useState(false);
  const [promptRiskReview, setPromptRiskReview] = useState<PromptRiskReviewState | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [taskChoice, setTaskChoice] = useState<TaskChoiceState | null>(null);
  const [creatingTaskCapability, setCreatingTaskCapability] = useState<AssistantTaskTargetCapability | null>(null);
  const [resourcePickerKind, setResourcePickerKind] = useState<'IMAGE' | 'VIDEO' | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const promptOptimizationRequestRef = useRef(0);

  const refreshSessions = useCallback(async () => {
    const page = await assistantApi.listSessions();
    setSessions(page.list ?? []);
    return page.list ?? [];
  }, []);

  const createSession = useCallback(async () => {
    const session = await assistantApi.createSession();
    setSessions((current) => [session, ...current]);
    setSessionId(session.id);
    setMessages([]);
    setContent('');
    setSelectedResources([]);
    return session;
  }, []);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const rows = await refreshSessions();
        if (disposed) return;
        if (rows.length > 0) setSessionId(rows[0].id);
        else await createSession();
      } finally {
        if (!disposed) setLoadingSessions(false);
      }
    })();
    return () => { disposed = true; };
  }, [createSession, refreshSessions]);

  const refreshMessages = useCallback(async (targetSessionId: string) => {
    const result = await assistantApi.listMessages(targetSessionId);
    setMessages(result.list ?? []);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let disposed = false;
    setMessages([]);
    setLoadingMessages(true);
    void assistantApi.listMessages(sessionId)
      .then((result) => { if (!disposed) setMessages(result.list ?? []); })
      .finally(() => { if (!disposed) setLoadingMessages(false); });
    return () => { disposed = true; };
  }, [sessionId]);

  const runningIds = useMemo(
    () => messages.filter((item) => RUNNING_STATUSES.has(item.status)).map((item) => item.id),
    [messages],
  );
  const runningKey = runningIds.join(',');

  useEffect(() => {
    if (!runningKey || !sessionId) return;
    let disposed = false;
    const poll = async () => {
      const ids = runningKey.split(',').filter(Boolean);
      const updates = await Promise.all(ids.map((id) => assistantApi.getMessage(id)));
      if (disposed) return;
      setMessages((current) => updates.reduce(mergeMessage, current));
      void refreshSessions();
    };
    const timer = window.setInterval(() => { void poll(); }, 5000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [refreshSessions, runningKey, sessionId]);

  useEffect(() => {
    if (messages.length > 0 || submitting) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      return;
    }
    messageScrollRef.current?.scrollTo({ top: 0 });
  }, [messages, submitting]);

  const send = async (options: {
    skipRiskCheck?: boolean;
    promptOverride?: string;
  } = {}) => {
    if (!sessionId || submitting) return;
    const prompt = (options.promptOverride ?? content).trim();
    if (!prompt && selectedResources.length === 0) {
      toast.info('请输入创作需求，或从资源中心选择素材');
      return;
    }
    setSubmitting(true);
    try {
      if (!options.skipRiskCheck && prompt) {
        const riskResult = await assistantApi.checkPromptRisk(prompt);
        if (riskResult.riskDetected) {
          setPromptRiskReview({ prompt, result: riskResult, stage: 'review' });
          return;
        }
      }
      const attachments: AssistantAttachmentInput[] = selectedResources.map((item, index) => ({
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        type: item.type,
        roleInMessage: 'USER_INPUT',
        sort: index,
      }));
      const response = await assistantApi.chat({
        sessionId,
        clientRequestId: createRequestId(),
        content: prompt,
        attachments,
      });
      setMessages((current) => {
        let next = current;
        if (response.userMessage) next = mergeMessage(next, response.userMessage);
        return mergeMessage(next, response.assistantMessage);
      });
      setContent('');
      setSelectedResources([]);
      void refreshSessions();
    } finally {
      setSubmitting(false);
    }
  };

  const closePromptDialog = () => {
    promptOptimizationRequestRef.current += 1;
    setPromptRiskReview(null);
    setOptimizingPrompt(false);
  };

  const startPromptOptimization = async (
    prompt: string,
    riskResult?: AssistantPromptRiskResult,
  ) => {
    if (!prompt.trim() || optimizingPrompt) return;
    const requestId = promptOptimizationRequestRef.current + 1;
    promptOptimizationRequestRef.current = requestId;
    setOptimizingPrompt(true);
    setPromptRiskReview({ prompt: prompt.trim(), result: riskResult, stage: 'optimizing' });
    try {
      const optimized = await assistantApi.optimizePrompt(prompt.trim());
      if (promptOptimizationRequestRef.current !== requestId) return;
      setPromptRiskReview({
        prompt: prompt.trim(),
        result: riskResult ?? optimized,
        stage: 'ready',
        optimizedPrompt: optimized.optimizedPrompt,
      });
    } catch (error) {
      if (promptOptimizationRequestRef.current !== requestId) return;
      setPromptRiskReview({
        prompt: prompt.trim(),
        result: riskResult,
        stage: 'error',
        errorMessage: error instanceof Error ? error.message : '提示词优化失败，请重试',
      });
    } finally {
      if (promptOptimizationRequestRef.current === requestId) setOptimizingPrompt(false);
    }
  };

  const applyOptimizedPrompt = async (message: AssistantMessage) => {
    setContent(message.content);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
    if (!message.appliedAction) {
      await assistantApi.applySuggestion(message.id, 'APPLY_OPTIMIZED_PROMPT');
      setMessages((current) => current.map((item) => item.id === message.id
        ? { ...item, appliedAction: 'APPLY_OPTIMIZED_PROMPT' }
        : item));
    }
    toast.success('优化后的提示词已填入输入框');
  };

  const cancel = async (messageId: string) => {
    const updated = await assistantApi.cancel(messageId);
    setMessages((current) => mergeMessage(current, updated));
  };

  const regenerate = async (messageId: string) => {
    const response = await assistantApi.regenerate(messageId, createRequestId());
    setMessages((current) => mergeMessage(current, response.assistantMessage));
  };

  const saveResult = async (message: AssistantMessage, result: AssistantGenerationResult) => {
    const saved = await assistantApi.saveToAsset(
      message.id,
      result.id,
      `助手生成${result.resultKind === 'IMAGE' ? '图片' : '视频'}`,
    );
    setMessages((current) => current.map((item) => item.id !== message.id ? item : {
      ...item,
      results: item.results?.map((entry) => entry.id === result.id
        ? { ...entry, savedAssetResourceId: saved.assetResourceId }
        : entry),
    }));
    toast.success(saved.idempotentReplay ? '该结果已在资源中心' : '已保存到公共素材库');
    return saved.assetResourceId;
  };

  const createTask = async (
    message: AssistantMessage,
    result: AssistantGenerationResult,
    targetCapability: AssistantTaskTargetCapability,
  ) => {
    if (creatingTaskCapability) return;
    setCreatingTaskCapability(targetCapability);
    try {
      await saveResult(message, result);
      const prefill = await assistantApi.taskPrefill(message.id, result.id, targetCapability);
      const screen = prefill.targetScreen === 'CREATE_IMAGE_TASK'
        ? AppScreen.CREATE_IMAGE_TASK : AppScreen.CREATE_VIDEO_TASK;
      setTaskChoice(null);
      onCreateTask(screen, prefill);
    } finally {
      setCreatingTaskCapability(null);
    }
  };

  const continueWith = (result: AssistantGenerationResult) => {
    setSelectedResources((current) => {
      const next: SelectedResource = {
        sourceType: 'ASSISTANT_RESULT',
        sourceId: result.id,
        type: result.resultKind,
        name: result.resultKind === 'IMAGE' ? '本轮生成图片' : '本轮生成视频',
        url: result.coverUrl || result.url,
      };
      return current.some((item) => item.sourceType === next.sourceType && item.sourceId === next.sourceId)
        ? current : [...current, next];
    });
    setContent((current) => current || '基于这个结果继续调整：');
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleResourceSelection = (assets: AssetResourceItem[]) => {
    const picked = assets.flatMap((asset): SelectedResource[] => {
      if (asset.assetKind !== 'IMAGE' && asset.assetKind !== 'VIDEO') return [];
      const url = asset.originalUrl || asset.thumbnailUrl;
      if (!url) return [];
      return [{
        sourceType: 'ASSET_RESOURCE',
        sourceId: asset.id,
        type: asset.assetKind,
        name: asset.name,
        url,
      }];
    });

    let next = [...selectedResources];
    let imageLimitReached = false;
    for (const item of picked) {
      if (next.some((entry) => entry.sourceType === item.sourceType && entry.sourceId === item.sourceId)) continue;
      if (item.type === 'VIDEO') {
        next = next.filter((entry) => entry.type !== 'VIDEO');
        next.push(item);
        continue;
      }
      if (next.filter((entry) => entry.type === 'IMAGE').length >= 7) {
        imageLimitReached = true;
        continue;
      }
      next.push(item);
    }
    setSelectedResources(next);
    setResourcePickerKind(null);
    if (imageLimitReached) toast.info('图片素材最多选择 7 张');
  };

  const removeSession = async (id: string) => {
    await assistantApi.deleteSession(id);
    const remaining = sessions.filter((item) => item.id !== id);
    setSessions(remaining);
    if (sessionId === id) {
      if (remaining.length > 0) setSessionId(remaining[0].id);
      else await createSession();
    }
  };

  const beginRenameSession = (session: AssistantSession) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title || '新会话');
  };

  const saveSessionTitle = async () => {
    if (!editingSessionId || renamingSessionId) return;
    const title = editingTitle.trim();
    if (!title) {
      toast.info('会话名称不能为空');
      return;
    }
    const current = sessions.find((item) => item.id === editingSessionId);
    if (current?.title === title) {
      setEditingSessionId(null);
      return;
    }
    setRenamingSessionId(editingSessionId);
    try {
      const updated = await assistantApi.renameSession(editingSessionId, title);
      setSessions((items) => items.map((item) => item.id === updated.id ? updated : item));
      setEditingSessionId(null);
    } finally {
      setRenamingSessionId(null);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] min-h-[640px] max-w-[1560px] overflow-hidden rounded-2xl border border-border-main bg-white shadow-[0_12px_40px_rgba(53,44,37,0.06)]">
      <aside className="hidden w-[280px] shrink-0 flex-col border-r border-border-main bg-[#f7f5f2] lg:flex">
        <div className="border-b border-border-main p-4">
          <div className="mb-4 flex items-center gap-3 px-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-light text-primary">
              <span className="material-symbols-outlined text-xl">forum</span>
            </div>
            <div>
              <p className="text-sm font-black text-text-main">创作空间</p>
              <p className="mt-0.5 text-[10px] font-medium tracking-wide text-text-muted">AI CREATIVE STUDIO</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { void createSession(); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-sm shadow-primary/20 transition hover:bg-primary-hover"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            新建对话
          </button>
        </div>
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <p className="text-[11px] font-black tracking-[0.12em] text-[#9a938d]">最近对话</p>
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-text-muted">{sessions.length}</span>
        </div>
        <div className="flex-1 space-y-1.5 overflow-y-auto px-2.5 pb-3">
          {loadingSessions && (
            <div className="space-y-2 p-2">
              {[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-white/75" />)}
            </div>
          )}
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`group relative flex items-start overflow-hidden rounded-xl border transition ${sessionId === session.id
                ? 'border-[#e3dcd5] bg-white shadow-[0_4px_16px_rgba(53,44,37,0.05)]'
                : 'border-transparent hover:border-[#ebe6e1] hover:bg-white/70'}`}
            >
              {sessionId === session.id && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-primary" />}
              {editingSessionId === session.id ? (
                <div className="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-3">
                  <input
                    autoFocus
                    value={editingTitle}
                    maxLength={128}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void saveSessionTitle();
                      }
                      if (event.key === 'Escape') setEditingSessionId(null);
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-primary/40 bg-white px-2.5 py-1.5 text-xs font-semibold text-text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                  <button
                    type="button"
                    aria-label="保存会话名称"
                    disabled={renamingSessionId === session.id}
                    onClick={() => { void saveSessionTitle(); }}
                    className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-base">check</span>
                  </button>
                  <button
                    type="button"
                    aria-label="取消修改"
                    onClick={() => setEditingSessionId(null)}
                    className="rounded p-1 text-stone-400 hover:bg-stone-100"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setSessionId(session.id)}
                    onDoubleClick={() => beginRenameSession(session)}
                    className="min-w-0 flex-1 px-3.5 py-3 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-text-main">{session.title || '新会话'}</p>
                      <span className="shrink-0 text-[9px] text-[#aaa39c]">{formatSessionTime(session.lastMessageAt || session.updateTime)}</span>
                    </div>
                    <p className="mt-1 truncate text-[11px] leading-4 text-text-muted">{session.lastMessagePreview || '开始一次创作'}</p>
                  </button>
                  <div className="absolute right-1.5 top-1.5 hidden items-center rounded-lg border border-border-main bg-white/95 shadow-sm group-hover:flex">
                    <button
                      type="button"
                      aria-label="修改会话名称"
                      onClick={() => beginRenameSession(session)}
                      className="rounded-l-lg p-1.5 text-stone-400 hover:bg-primary-light hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                    </button>
                    <button
                      type="button"
                      aria-label="删除对话"
                      onClick={() => { void removeSession(session.id); }}
                      className="rounded-r-lg p-1.5 text-stone-400 hover:bg-rose-50 hover:text-rose-500"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="m-3 rounded-xl border border-[#e9e3dd] bg-white/70 p-3">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined mt-0.5 text-base text-primary">tips_and_updates</span>
            <p className="text-[10px] leading-4 text-text-muted">双击会话名称可重命名。助手会保留本会话上下文，支持持续调整历史产物。</p>
          </div>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-[#fbfaf8]">
        <header className="flex min-h-[72px] shrink-0 items-center justify-between gap-3 border-b border-border-main bg-white/95 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm shadow-primary/20">
              <span className="material-symbols-outlined text-xl">auto_awesome</span>
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-base font-black text-text-main">创作助手</h2>
                <span className="hidden rounded-full bg-primary-light px-2 py-0.5 text-[9px] font-black tracking-wide text-primary sm:inline">多轮创作</span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-text-muted">理解素材与上下文，陪你完成图片和视频创作</p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2 lg:hidden">
            {sessions.length > 0 && (
              <select
                aria-label="切换历史对话"
                value={sessionId ?? ''}
                onChange={(event) => setSessionId(event.target.value)}
                className="min-w-0 max-w-36 rounded-lg border border-border-main bg-[#faf9f7] px-2.5 py-2 text-xs font-semibold text-text-main outline-none focus:border-primary sm:max-w-52"
              >
                {sessions.map((session) => <option key={session.id} value={session.id}>{session.title || '新会话'}</option>)}
              </select>
            )}
            <button
              type="button"
              aria-label="新建对话"
              onClick={() => { void createSession(); }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-main bg-white text-text-muted transition hover:border-primary/40 hover:bg-primary-light hover:text-primary"
            >
              <span className="material-symbols-outlined text-lg">add</span>
            </button>
          </div>
        </header>

        <div ref={messageScrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-5xl space-y-7">
            {!loadingMessages && messages.length === 0 && (
              <div className="mx-auto flex min-h-[420px] max-w-3xl flex-col items-center justify-center text-center">
                <div className="relative">
                  <div className="absolute inset-0 scale-150 rounded-full bg-primary/10 blur-2xl" />
                  <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/15 bg-white text-primary shadow-[0_10px_30px_rgba(216,92,66,0.12)]">
                    <span className="material-symbols-outlined text-3xl">auto_awesome</span>
                  </div>
                </div>
                <p className="mt-6 text-[10px] font-black tracking-[0.18em] text-primary">从一个想法开始</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-text-main">今天想创作什么？</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-text-muted">
                  描述创作目标，或从资源中心选择图片、视频作为参考素材。助手会在当前会话中持续理解和调整。
                </p>
                <div className="mt-7 grid w-full gap-3 sm:grid-cols-3">
                  {QUICK_STARTS.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => {
                        setContent(item.prompt);
                        window.requestAnimationFrame(() => textareaRef.current?.focus());
                      }}
                      className="group rounded-2xl border border-border-main bg-white p-4 text-left shadow-[0_4px_16px_rgba(53,44,37,0.035)] transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_10px_24px_rgba(53,44,37,0.07)]"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5f2ee] text-text-muted transition group-hover:bg-primary-light group-hover:text-primary">
                        <span className="material-symbols-outlined text-xl">{item.icon}</span>
                      </span>
                      <span className="mt-3 block text-[13px] font-black text-text-main">{item.title}</span>
                      <span className="mt-1 block text-[11px] leading-4 text-text-muted">{item.description}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-5 flex items-center gap-1.5 rounded-full bg-[#f2efeb] px-3 py-1.5 text-[10px] font-medium text-text-muted">
                  <span className="material-symbols-outlined text-sm">verified_user</span>
                  手动上传的素材需先进入资源中心，再在对话中选择
                </div>
              </div>
            )}
            {loadingMessages && (
              <div className="space-y-6 py-8">
                <div className="flex gap-3"><div className="h-9 w-9 animate-pulse rounded-xl bg-primary/10" /><div className="h-24 w-3/5 animate-pulse rounded-2xl bg-white" /></div>
                <div className="flex justify-end"><div className="h-20 w-2/5 animate-pulse rounded-2xl bg-[#eeeae6]" /></div>
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id}>
                <MessageCard
                  message={message}
                  onCancel={cancel}
                  onRegenerate={regenerate}
                  onContinue={continueWith}
                  onSave={saveResult}
                  onApplyPrompt={applyOptimizedPrompt}
                  onCreateTask={(message, result) => setTaskChoice({ message, result })}
                />
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        <footer className="shrink-0 border-t border-border-main bg-gradient-to-t from-white via-white to-white/80 px-3 pb-3 pt-3 sm:px-6 sm:pb-4 lg:px-10">
          <div className="mx-auto max-w-5xl">
            <div className="overflow-hidden rounded-2xl border border-border-main bg-white shadow-[0_10px_32px_rgba(53,44,37,0.09)] transition focus-within:border-primary/45 focus-within:shadow-[0_12px_36px_rgba(216,92,66,0.11)]">
              {selectedResources.length > 0 && (
                <div className="border-b border-[#eeeae6] bg-[#faf9f7] px-3 py-2.5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-[10px] font-black tracking-wide text-text-muted">
                      <span className="material-symbols-outlined text-sm text-primary">attach_file</span>
                      已选参考素材 · {selectedResources.length}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedResources([])}
                      className="text-[10px] font-semibold text-text-muted hover:text-primary"
                    >全部移除</button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-0.5">
                    {selectedResources.map((item) => (
                      <div key={`${item.sourceType}-${item.sourceId}`} className="group/resource relative h-[68px] w-24 shrink-0 overflow-hidden rounded-xl border border-[#ded8d2] bg-[#eeeae6]">
                        <AssetImage
                          urls={[item.url]}
                          alt={item.name}
                          assetKind={item.type}
                          aspectRatio="auto"
                          objectFit="contain"
                          maxWidth={192}
                          className="h-full w-full bg-white p-1"
                        />
                        <span className="absolute bottom-1 left-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[8px] font-bold text-white backdrop-blur-sm">
                          {item.type === 'IMAGE' ? '图片' : '视频'}
                        </span>
                        <button
                          type="button"
                          aria-label={`移除素材 ${item.name}`}
                          onClick={() => setSelectedResources((current) => current.filter((entry) => entry !== item))}
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white opacity-90 transition hover:bg-primary"
                        >×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="px-3 pb-2 pt-2.5 sm:px-4">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                maxLength={5000}
                placeholder="描述你的创作需求，可以直接说要修改什么……"
                className="min-h-[58px] max-h-36 w-full resize-none border-0 bg-transparent py-1.5 text-sm leading-6 text-text-main outline-none placeholder:text-[#aaa39c]"
              />
              <div className="flex items-end justify-between gap-3 pt-1">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setResourcePickerKind('IMAGE')}
                    className="flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-2 text-[11px] font-bold text-text-muted transition hover:border-border-main hover:bg-[#f7f5f2] hover:text-text-main"
                  >
                    <span className="material-symbols-outlined text-[17px]">add_photo_alternate</span>
                    图片素材
                  </button>
                  <button
                    type="button"
                    onClick={() => setResourcePickerKind('VIDEO')}
                    className="flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-2 text-[11px] font-bold text-text-muted transition hover:border-border-main hover:bg-[#f7f5f2] hover:text-text-main"
                  >
                    <span className="material-symbols-outlined text-[17px]">video_library</span>
                    视频素材
                  </button>
                  <span className="hidden text-[10px] text-[#aaa39c] sm:inline">从资源中心选择</span>
                  <button
                    type="button"
                    disabled={submitting || optimizingPrompt || !content.trim()}
                    onClick={() => { void startPromptOptimization(content); }}
                    className="flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-2 text-[11px] font-bold text-primary transition hover:border-primary/20 hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <span className={`material-symbols-outlined text-[17px] ${optimizingPrompt ? 'animate-spin' : ''}`}>{optimizingPrompt ? 'progress_activity' : 'auto_fix_high'}</span>
                    {optimizingPrompt ? '优化中' : '优化提示词'}
                  </button>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="hidden text-[9px] tabular-nums text-[#aaa39c] sm:inline">{content.length}/5000</span>
                  <button
                    type="button"
                    aria-label="发送创作需求"
                    disabled={submitting || (!content.trim() && selectedResources.length === 0)}
                    onClick={() => { void send(); }}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-white shadow-sm shadow-primary/20 transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-35 sm:px-4"
                  >
                    <span className={`material-symbols-outlined text-lg ${submitting ? 'animate-spin' : ''}`}>{submitting ? 'progress_activity' : 'arrow_upward'}</span>
                    <span className="hidden sm:inline">{submitting ? '发送中' : '发送'}</span>
                  </button>
                </div>
              </div>
              </div>
            </div>
            <p className="mt-2 flex items-center justify-center gap-1 text-center text-[9px] text-[#aaa39c]">
              <span className="material-symbols-outlined text-xs">keyboard_return</span>
              Enter 发送 · Shift + Enter 换行 · AI 生成内容请按业务需要复核
            </p>
          </div>
        </footer>
      </section>

      {resourcePickerKind && (
        <AssetTransitModal
          mode="picker"
          purpose="OTHER"
          targetSlot="assistant-reference"
          assetKind={resourcePickerKind}
          multiSelect={resourcePickerKind === 'IMAGE'}
          allowedSources={resourcePickerKind === 'IMAGE' ? ['UPLOAD', 'PRODUCT', 'MODEL'] : ['UPLOAD', 'PRODUCT']}
          selectionOnly
          onClose={() => setResourcePickerKind(null)}
          onConfirmSelection={handleResourceSelection}
        />
      )}
      {taskChoice && (
        <TaskTargetChoiceModal
          result={taskChoice.result}
          creatingCapability={creatingTaskCapability}
          onClose={() => {
            if (!creatingTaskCapability) setTaskChoice(null);
          }}
          onSelect={(capability) => {
            void createTask(taskChoice.message, taskChoice.result, capability);
          }}
        />
      )}
      {promptRiskReview && (
        <PromptRiskReviewModal
          review={promptRiskReview}
          onClose={closePromptDialog}
          onSendOriginal={() => {
            const prompt = promptRiskReview.prompt;
            closePromptDialog();
            void send({ skipRiskCheck: true, promptOverride: prompt });
          }}
          onOptimize={() => {
            void startPromptOptimization(promptRiskReview.prompt, promptRiskReview.result);
          }}
          onRetry={() => {
            void startPromptOptimization(promptRiskReview.prompt, promptRiskReview.result);
          }}
          onOptimizedPromptChange={(value) => {
            setPromptRiskReview((current) => current ? { ...current, optimizedPrompt: value } : current);
          }}
          onConfirmSend={() => {
            const optimizedPrompt = promptRiskReview.optimizedPrompt?.trim();
            if (!optimizedPrompt) return;
            closePromptDialog();
            void send({ skipRiskCheck: true, promptOverride: optimizedPrompt });
          }}
        />
      )}
    </div>
  );
}

function MessageCard({
  message,
  onCancel,
  onRegenerate,
  onContinue,
  onSave,
  onApplyPrompt,
  onCreateTask,
}: {
  message: AssistantMessage;
  onCancel: (messageId: string) => Promise<void>;
  onRegenerate: (messageId: string) => Promise<void>;
  onContinue: (result: AssistantGenerationResult) => void;
  onSave: (message: AssistantMessage, result: AssistantGenerationResult) => Promise<string>;
  onApplyPrompt: (message: AssistantMessage) => Promise<void>;
  onCreateTask: (message: AssistantMessage, result: AssistantGenerationResult) => void;
}) {
  const assistant = message.role === 'ASSISTANT';
  const timeLabel = formatTime(message.createTime);
  const [imagePreview, setImagePreview] = useState<{
    images: PreviewImage[];
    initialIndex: number;
  } | null>(null);
  const attachmentPreviewImages = (message.attachments ?? []).flatMap((attachment): PreviewImage[] => (
    attachment.type === 'IMAGE' && attachment.url
      ? [{ url: attachment.url, label: assistant ? '助手引用素材' : '用户参考素材' }]
      : []
  ));
  const resultPreviewImages = (message.results ?? []).flatMap((result): PreviewImage[] => (
    result.resultKind === 'IMAGE' && result.url
      ? [{ url: result.url, label: '助手生成图片' }]
      : []
  ));
  return (
    <>
      <div className={`flex gap-3 sm:gap-3.5 ${assistant ? '' : 'justify-end'}`}>
      {assistant && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm shadow-primary/20">
          <span className="material-symbols-outlined text-[19px]">auto_awesome</span>
        </div>
      )}
      <div className={`${assistant ? 'min-w-0 flex-1' : 'max-w-[86%] sm:max-w-[76%]'}`}>
        <div className={`mb-1.5 flex items-center gap-2 px-1 ${assistant ? '' : 'justify-end'}`}>
          <span className={`text-[10px] font-bold ${assistant ? 'text-text-main' : 'text-text-muted'}`}>{assistant ? '创作助手' : '你'}</span>
          {timeLabel && <span className="text-[9px] text-[#aaa39c]">{timeLabel}</span>}
        </div>
        <div className={`rounded-2xl px-4 py-3.5 text-sm leading-6 shadow-[0_3px_14px_rgba(53,44,37,0.035)] ${assistant
          ? 'rounded-tl-md border border-border-main bg-white text-[#4d4843]'
          : 'rounded-tr-md border border-[#e3ddd6] bg-[#f3f0ec] text-[#3d3935]'}`}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
          {assistant && <AssistantProcessPanel message={message} />}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-3 grid max-w-lg grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {message.attachments.map((attachment) => attachment.url && (
                attachment.type === 'IMAGE'
                  ? (
                    <button
                      key={attachment.id}
                      type="button"
                      aria-label="放大查看对话图片"
                      onClick={() => {
                        const initialIndex = (message.attachments ?? [])
                          .filter((item) => item.type === 'IMAGE' && item.url)
                          .findIndex((item) => item.id === attachment.id);
                        setImagePreview({ images: attachmentPreviewImages, initialIndex: Math.max(initialIndex, 0) });
                      }}
                      className="relative aspect-square w-full cursor-zoom-in overflow-hidden rounded-xl bg-white/75 ring-1 ring-[#ddd6cf] transition hover:ring-primary/35 sm:h-28 sm:w-28"
                    >
                      <img src={attachment.url} alt="对话素材" className="h-full w-full object-contain" />
                    </button>
                  )
                  : <video key={attachment.id} src={attachment.url} controls className="max-h-48 w-full rounded-xl sm:max-w-sm" />
              ))}
            </div>
          )}
          {RUNNING_STATUSES.has(message.status) && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-primary-light px-3 py-2 text-xs font-semibold text-primary">
              <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
              <span>{message.status === 'TOOL_RUNNING' ? '正在生成作品，请稍候…' : '正在理解需求…'}</span>
              <span className="ml-auto flex gap-0.5">
                {[0, 1, 2].map((item) => <span key={item} className="h-1 w-1 animate-pulse rounded-full bg-primary" style={{ animationDelay: `${item * 160}ms` }} />)}
              </span>
            </div>
          )}
          {message.status === 'FAILED' && (
            <div className="mt-3 max-h-40 overflow-y-auto rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-xs leading-5 text-rose-600">
              <div className="mb-1 flex items-center gap-1.5 font-bold"><span className="material-symbols-outlined text-sm">error</span>生成未完成</div>
              <p className="break-words">{message.errorMessage || '处理失败'}</p>
            </div>
          )}
          {message.status === 'CANCELLED' && <p className="mt-2 text-xs text-text-muted">已取消本次生成</p>}
        </div>
        {message.results?.map((result) => (
          <div key={result.id} className="mt-3 max-w-[760px] overflow-hidden rounded-2xl border border-border-main bg-white shadow-[0_8px_24px_rgba(53,44,37,0.06)]">
            <div className="relative flex justify-center bg-[#f1eeea]">
              <span className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-[9px] font-bold text-white backdrop-blur-sm">
                <span className="material-symbols-outlined text-xs">{result.resultKind === 'IMAGE' ? 'image' : 'movie'}</span>
                {result.resultKind === 'IMAGE' ? '生成图片' : '生成视频'}
              </span>
              {result.resultKind === 'IMAGE'
                ? (
                  <button
                    type="button"
                    aria-label="放大查看助手生成图片"
                    onClick={() => {
                      const initialIndex = (message.results ?? [])
                        .filter((item) => item.resultKind === 'IMAGE' && item.url)
                        .findIndex((item) => item.id === result.id);
                      setImagePreview({ images: resultPreviewImages, initialIndex: Math.max(initialIndex, 0) });
                    }}
                    className="relative flex w-full cursor-zoom-in justify-center"
                  >
                    <img src={result.url} alt="助手生成结果" className="max-h-[520px] max-w-full object-contain" />
                  </button>
                )
                : <video src={result.url} poster={result.coverUrl || undefined} controls className="max-h-[520px] w-full bg-black" />}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border-main p-3">
              <button type="button" onClick={() => onContinue(result)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white shadow-sm shadow-primary/15 transition hover:bg-primary-hover">
                <span className="material-symbols-outlined text-base">edit_note</span>继续创作
              </button>
              <button type="button" onClick={() => { void onSave(message, result); }} className="flex items-center gap-1.5 rounded-lg border border-border-main px-3 py-2 text-xs font-semibold text-text-muted transition hover:bg-[#f7f5f2] hover:text-text-main">
                <span className="material-symbols-outlined text-base">{result.savedAssetResourceId ? 'check_circle' : 'inventory_2'}</span>
                {result.savedAssetResourceId ? '已在素材库' : '保存到素材库'}
              </button>
              <button type="button" onClick={() => onCreateTask(message, result)} className="flex items-center gap-1.5 rounded-lg border border-border-main px-3 py-2 text-xs font-semibold text-text-muted transition hover:bg-[#f7f5f2] hover:text-text-main">
                <span className="material-symbols-outlined text-base">add_task</span>创建任务
              </button>
            </div>
          </div>
        ))}
        {assistant && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[#aaa39c]">
            {message.status === 'COMPLETED' && message.suggestionType === 'OPTIMIZE_PROMPT' && (
              <button
                type="button"
                onClick={() => { void onApplyPrompt(message); }}
                className="flex items-center gap-1 rounded-lg bg-primary-light px-2.5 py-1.5 font-bold text-primary transition hover:bg-primary/15"
              >
                <span className="material-symbols-outlined text-sm">keyboard_return</span>
                {message.appliedAction ? '再次使用' : '使用优化提示词'}
              </button>
            )}
            {RUNNING_STATUSES.has(message.status) && (
              <button type="button" onClick={() => { void onCancel(message.id); }} className="rounded-lg px-2 py-1 hover:bg-[#f2efeb] hover:text-text-main">停止生成</button>
            )}
            {(message.status === 'FAILED' || message.status === 'COMPLETED') && (
              <button type="button" onClick={() => { void onRegenerate(message.id); }} className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-[#f2efeb] hover:text-text-main">
                <span className="material-symbols-outlined text-sm">refresh</span>重新生成
              </button>
            )}
          </div>
        )}
      </div>
      {!assistant && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#dddff0] bg-gradient-to-br from-[#f0edfb] to-[#e8edf8] text-info shadow-sm shadow-info/10">
          <span className="material-symbols-outlined text-[20px]">face</span>
        </div>
      )}
      </div>
      {imagePreview && (
        <ImagePreviewModal
          images={imagePreview.images}
          initialIndex={imagePreview.initialIndex}
          onClose={() => setImagePreview(null)}
        />
      )}
    </>
  );
}

function AssistantProcessPanel({ message }: { message: AssistantMessage }) {
  const steps = buildProcessSteps(message);
  const completedCount = steps.filter((step) => step.state === 'done').length;
  const stateLabel = message.status === 'PENDING'
    ? '思考中'
    : message.status === 'TOOL_RUNNING'
      ? '生成中'
      : message.status === 'COMPLETED'
        ? '已完成'
        : message.status === 'FAILED'
          ? '未完成'
          : '已停止';
  const stateClass = message.status === 'FAILED'
    ? 'bg-rose-50 text-rose-600'
    : RUNNING_STATUSES.has(message.status)
      ? 'bg-primary-light text-primary'
      : 'bg-[#f2f0ed] text-[#77716b]';

  return (
    <details className="group mt-3 overflow-hidden rounded-xl border border-[#e7e2dc] bg-[#faf9f7]">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5 select-none [&::-webkit-details-marker]:hidden">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm ring-1 ring-[#ebe6e0]">
          <span className="material-symbols-outlined text-[15px]">psychology</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold text-[#514c47]">思考过程</span>
          <span className="block text-[9px] text-[#a09a94]">过程摘要 · {completedCount}/{steps.length} 步完成</span>
        </span>
        <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${stateClass}`}>{stateLabel}</span>
        <span className="material-symbols-outlined text-[17px] text-[#aaa39c] transition-transform group-open:rotate-180">expand_more</span>
      </summary>
      <div className="border-t border-[#ebe7e1] px-3 py-3">
        <div className="space-y-0.5">
          {steps.map((step, index) => {
            const icon = step.state === 'done'
              ? 'check'
              : step.state === 'failed'
                ? 'close'
                : step.state === 'active'
                  ? 'progress_activity'
                  : 'more_horiz';
            const iconClass = step.state === 'done'
              ? 'bg-emerald-50 text-emerald-600'
              : step.state === 'failed'
                ? 'bg-rose-50 text-rose-600'
                : step.state === 'active'
                  ? 'bg-primary-light text-primary'
                  : 'bg-[#efede9] text-[#aaa39c]';
            return (
              <div key={`${step.title}-${index}`} className="relative flex gap-2.5 pb-2.5 last:pb-0">
                {index < steps.length - 1 && <span className="absolute left-[10px] top-5 h-[calc(100%-12px)] w-px bg-[#e3ded8]" />}
                <span className={`relative z-[1] flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
                  <span className={`material-symbols-outlined text-[12px] ${step.state === 'active' ? 'animate-spin' : ''}`}>{icon}</span>
                </span>
                <span className="min-w-0 pt-px">
                  <span className="block text-[10px] font-bold leading-4 text-[#5b5550]">{step.title}</span>
                  <span className="block break-words text-[9px] leading-4 text-[#99928b]">{step.description}</span>
                </span>
              </div>
            );
          })}
        </div>
        {message.prompt && (
          <div className="mt-3 rounded-lg border border-[#ebe6e0] bg-white px-2.5 py-2">
            <div className="mb-1 text-[9px] font-bold text-[#77716b]">整理后的生成指令</div>
            <p className="max-h-28 overflow-y-auto whitespace-pre-wrap break-words text-[9px] leading-4 text-[#99928b]">{message.prompt}</p>
          </div>
        )}
      </div>
    </details>
  );
}

function PromptRiskReviewModal({
  review,
  onClose,
  onSendOriginal,
  onOptimize,
  onRetry,
  onOptimizedPromptChange,
  onConfirmSend,
}: {
  review: PromptRiskReviewState;
  onClose: () => void;
  onSendOriginal: () => void;
  onOptimize: () => void;
  onRetry: () => void;
  onOptimizedPromptChange: (value: string) => void;
  onConfirmSend: () => void;
}) {
  const optimizing = review.stage === 'optimizing';
  const ready = review.stage === 'ready';
  const error = review.stage === 'error';
  const title = optimizing
    ? '正在优化提示词'
    : ready
      ? '提示词优化完成'
      : error
        ? '提示词优化未完成'
        : '提示词可能触发内容审核';
  const description = optimizing
    ? '正在保持原始创作意图，调整可能触发审核的表达，请稍候。'
    : ready
      ? '你可以继续调整优化结果，确认后才会正式发送并创建任务。'
      : error
        ? '本次优化请求没有成功，可以重试或返回继续修改原提示词。'
        : '建议先优化风险歧义，再提交创作，可减少任务被生成服务拒绝的概率。';
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#211d19]/35 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-risk-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#eadfd4] bg-white shadow-[0_24px_80px_rgba(46,35,25,0.22)]"
      >
        <div className={`flex items-start gap-3 border-b border-[#eee7df] px-5 py-4 ${ready ? 'bg-emerald-50/60' : error ? 'bg-rose-50/60' : 'bg-[#fffaf3]'}`}>
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ready ? 'bg-emerald-100 text-emerald-700' : error ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'}`}>
            <span className={`material-symbols-outlined text-xl ${optimizing ? 'animate-spin' : ''}`}>
              {optimizing ? 'progress_activity' : ready ? 'task_alt' : error ? 'error' : 'shield_with_heart'}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="prompt-risk-title" className="text-sm font-black text-[#4b433c]">{title}</h3>
            <p className="mt-1 text-[11px] leading-5 text-[#857b72]">{description}</p>
          </div>
          <button type="button" aria-label="关闭风险提示" onClick={onClose} className="rounded-lg p-1 text-[#aaa099] hover:bg-white hover:text-[#5d554e]">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          {review.stage === 'review' && review.result && (
            <div className="space-y-2">
            {review.result.warnings.map((warning) => (
              <div key={warning} className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-[11px] leading-5 text-amber-800">
                <span className="material-symbols-outlined mt-0.5 text-sm">warning</span>
                <span>{warning}</span>
              </div>
            ))}
            </div>
          )}
          {optimizing ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-primary/10 bg-primary-light/35 px-6 text-center">
              <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-primary shadow-sm">
                <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/10" />
                <span className="material-symbols-outlined relative animate-spin text-2xl">progress_activity</span>
              </span>
              <p className="mt-4 text-xs font-black text-[#554f49]">AI 正在优化表达</p>
              <p className="mt-1.5 text-[10px] leading-5 text-[#938b84]">分析风险歧义 · 保留创作意图 · 整理生成指令</p>
            </div>
          ) : ready ? (
            <div>
              <label htmlFor="optimized-prompt" className="mb-2 flex items-center justify-between text-[10px] font-bold text-[#6f675f]">
                <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm text-emerald-600">auto_fix_high</span>优化后的提示词</span>
                <span className="font-medium tabular-nums text-[#aaa39c]">{review.optimizedPrompt?.length ?? 0}/5000</span>
              </label>
              <textarea
                id="optimized-prompt"
                value={review.optimizedPrompt ?? ''}
                maxLength={5000}
                rows={8}
                onChange={(event) => onOptimizedPromptChange(event.target.value)}
                className="max-h-72 min-h-44 w-full resize-y rounded-xl border border-emerald-200 bg-emerald-50/25 px-3.5 py-3 text-xs leading-6 text-[#554f49] outline-none transition focus:border-primary/45 focus:bg-white focus:ring-2 focus:ring-primary/10"
              />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-[11px] leading-5 text-rose-600">
              {review.errorMessage || '提示词优化失败，请稍后重试。'}
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-[#ebe6e0] bg-[#faf9f7] px-3 py-2.5">
                <div className="mb-1 text-[10px] font-bold text-[#77716b]">本次提示词</div>
                <p className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words text-[10px] leading-5 text-[#938b84]">{review.prompt}</p>
              </div>
              <p className="flex items-start gap-1.5 text-[10px] leading-4 text-[#9a938d]">
                <span className="material-symbols-outlined text-sm text-primary">auto_fix_high</span>
                优化会尽量保留主体、商品、构图、风格和商业意图，同时调整可能存在歧义或触发审核的表达。
              </p>
            </>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-[#eee7df] bg-[#fcfbf9] px-5 py-3.5">
          <button type="button" onClick={onClose} className="rounded-xl px-3.5 py-2 text-xs font-semibold text-text-muted hover:bg-[#f1eeea]">{ready ? '返回修改' : '取消'}</button>
          {review.stage === 'review' && (
            <>
              <button type="button" onClick={onSendOriginal} className="rounded-xl border border-[#ddd6cf] bg-white px-3.5 py-2 text-xs font-semibold text-[#6f675f] hover:bg-[#f7f5f2]">仍然发送</button>
              <button type="button" onClick={onOptimize} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm shadow-primary/20 hover:bg-primary-hover">
                <span className="material-symbols-outlined text-base">auto_fix_high</span>优化提示词
              </button>
            </>
          )}
          {error && (
            <button type="button" onClick={onRetry} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover">
              <span className="material-symbols-outlined text-base">refresh</span>重新优化
            </button>
          )}
          {ready && (
            <button type="button" disabled={!review.optimizedPrompt?.trim()} onClick={onConfirmSend} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm shadow-primary/20 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-35">
              <span className="material-symbols-outlined text-base">arrow_upward</span>确认发送
            </button>
          )}
          {optimizing && <span className="flex items-center px-2 text-[10px] font-semibold text-primary">优化完成后可确认发送</span>}
        </div>
      </div>
    </div>
  );
}

function TaskTargetChoiceModal({
  result,
  creatingCapability,
  onClose,
  onSelect,
}: {
  result: AssistantGenerationResult;
  creatingCapability: AssistantTaskTargetCapability | null;
  onClose: () => void;
  onSelect: (capability: AssistantTaskTargetCapability) => void;
}) {
  const options: Array<{
    capability: AssistantTaskTargetCapability;
    icon: string;
    title: string;
    description: string;
  }> = result.resultKind === 'IMAGE'
    ? [
      {
        capability: 'REF_IMG_EDIT',
        icon: 'image',
        title: '创建图片任务',
        description: '将当前图片作为参考图，继续编辑或生成新图片',
      },
      {
        capability: 'IMG2VIDEO',
        icon: 'animation',
        title: '创建视频任务',
        description: '将当前图片放入视频首帧，创建首帧图生视频任务',
      },
    ]
    : [
      {
        capability: 'SOLUTION_TRENDING_REPL',
        icon: 'local_fire_department',
        title: '创作爆款复刻',
        description: '将当前视频放入爆款复刻的复刻视频源',
      },
      {
        capability: 'SOLUTION_AD_VIDEO_EDIT',
        icon: 'shopping_bag',
        title: '创作电商复刻',
        description: '将当前视频放入电商复刻的复刻视频源',
      },
    ];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#201f1d]/50 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="选择创建任务类型">
      <div className="w-full max-w-xl rounded-3xl border border-white/60 bg-white p-5 shadow-[0_24px_80px_rgba(32,31,29,0.22)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
              <span className="material-symbols-outlined text-xl">conversion_path</span>
            </span>
            <div>
              <h3 className="text-base font-black text-text-main">将作品带入创作任务</h3>
              <p className="mt-1 text-xs leading-5 text-text-muted">
                {result.resultKind === 'IMAGE'
                  ? '当前产物为图片，可继续生图或作为视频首帧。'
                  : '当前产物为视频，请选择需要进入的复刻模式。'}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭"
            disabled={Boolean(creatingCapability)}
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#aaa39c] hover:bg-[#f2efeb] hover:text-text-main disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {options.map((option) => {
            const loading = creatingCapability === option.capability;
            return (
              <button
                key={option.capability}
                type="button"
                disabled={Boolean(creatingCapability)}
                onClick={() => onSelect(option.capability)}
                className="group rounded-2xl border border-border-main bg-[#fdfcfb] p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/45 hover:bg-primary-light/45 hover:shadow-[0_8px_20px_rgba(53,44,37,0.06)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-primary shadow-sm ring-1 ring-border-main transition group-hover:bg-primary group-hover:text-white group-hover:ring-primary">
                  <span className={`material-symbols-outlined text-xl ${loading ? 'animate-spin' : ''}`}>
                    {loading ? 'progress_activity' : option.icon}
                  </span>
                </span>
                <span className="mt-3 block text-sm font-black text-text-main">{option.title}</span>
                <span className="mt-1 block text-xs leading-5 text-text-muted">{option.description}</span>
                <span className="mt-3 flex items-center gap-1 text-[10px] font-bold text-primary opacity-0 transition group-hover:opacity-100">
                  进入创作 <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
