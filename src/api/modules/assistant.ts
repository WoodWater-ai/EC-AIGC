import http from '../client';
import type { PageInfo } from '../service-result';

export type AssistantMediaType = 'IMAGE' | 'VIDEO';
export type AssistantTaskTargetCapability =
  | 'REF_IMG_EDIT'
  | 'IMG2VIDEO'
  | 'SOLUTION_TRENDING_REPL'
  | 'SOLUTION_AD_VIDEO_EDIT';
export type AssistantMessageStatus =
  | 'PENDING'
  | 'TOOL_RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';
export type AssistantSuggestionType =
  | 'ADD_REQUIREMENT'
  | 'OPTIMIZE_PROMPT'
  | 'EXPLAIN_AUDIT'
  | 'RETRY_SUGGESTION';

export interface AssistantSession {
  id: string;
  title: string;
  status: 'ACTIVE' | 'CLOSED';
  lastMessagePreview?: string | null;
  lastMessageAt?: number | null;
  createTime?: number | null;
  updateTime?: number | null;
}

export interface AssistantAttachment {
  id: string;
  type: AssistantMediaType;
  sourceType: 'ASSET_RESOURCE' | 'ASSISTANT_RESULT';
  sourceId: string;
  fileResourceId?: string | null;
  roleInMessage?: string | null;
  url?: string | null;
}

export interface AssistantGenerationResult {
  id: string;
  resultKind: AssistantMediaType;
  fileResourceId: string;
  coverFileResourceId?: string | null;
  url: string;
  coverUrl?: string | null;
  savedAssetResourceId?: string | null;
  status: 'NORMAL' | 'ARCHIVED';
}

export interface AssistantMessage {
  id: string;
  sessionId: string;
  parentMessageId?: string | null;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: string;
  intent?: string | null;
  capability?: string | null;
  prompt?: string | null;
  negativePrompt?: string | null;
  schemaParams?: Record<string, unknown> | null;
  status: AssistantMessageStatus;
  executionChannelId?: string | null;
  executionChannelType?: string | null;
  executionModelCode?: string | null;
  suggestionType?: AssistantSuggestionType | null;
  appliedAction?: string | null;
  appliedTime?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  durationMs?: number | null;
  attachments?: AssistantAttachment[];
  results?: AssistantGenerationResult[];
  createTime?: number | null;
  updateTime?: number | null;
}

export interface AssistantMessageCursor {
  list: AssistantMessage[];
  hasMore: boolean;
  nextBeforeMessageId?: string | null;
}

export interface AssistantChatResponse {
  sessionId: string;
  userMessageId?: string | null;
  assistantMessageId: string;
  idempotentReplay: boolean;
  userMessage?: AssistantMessage | null;
  assistantMessage: AssistantMessage;
}

export interface AssistantPromptRiskResult {
  riskDetected: boolean;
  severity: 'NONE' | 'MEDIUM' | 'HIGH';
  riskCodes: string[];
  warnings: string[];
}

export interface AssistantPromptOptimizeResult extends AssistantPromptRiskResult {
  optimizedPrompt: string;
}

export interface AssistantTaskPrefill {
  targetScreen: 'CREATE_IMAGE_TASK' | 'CREATE_VIDEO_TASK';
  sourceMessageId: string;
  sourceResultId: string;
  capability: string;
  prompt?: string | null;
  negativePrompt?: string | null;
  schemaParams: Record<string, unknown>;
  references: Array<{
    type: AssistantMediaType;
    fileResourceId: string;
    assetResourceId?: string | null;
    url: string;
  }>;
  execution: {
    capabilityCode: string;
    channelInstanceId: string;
    channelType: string;
    modelCode?: string | null;
    source: string;
  };
}

export interface AssistantAttachmentInput {
  sourceType: 'ASSET_RESOURCE' | 'ASSISTANT_RESULT';
  sourceId: string;
  type: AssistantMediaType;
  roleInMessage?: 'USER_INPUT' | 'REFERENCE';
  sort?: number;
}

export const assistantApi = {
  createSession: (title?: string) =>
    http.post<AssistantSession>(
      `/v1/assistant/session/create${title ? `?title=${encodeURIComponent(title)}` : ''}`,
      {},
    ),
  listSessions: (pageNum = 1, pageSize = 50) =>
    http.post<PageInfo<AssistantSession>>('/v1/assistant/session/list', { pageNum, pageSize }),
  renameSession: (sessionId: string, title: string) =>
    http.post<AssistantSession>('/v1/assistant/session/rename', { sessionId, title }),
  deleteSession: (sessionId: string) =>
    http.post<void>('/v1/assistant/session/delete', { sessionId }),
  listMessages: (sessionId: string, beforeMessageId?: string) =>
    http.post<AssistantMessageCursor>('/v1/assistant/messages/list', {
      sessionId,
      beforeMessageId,
      limit: 100,
    }),
  getMessage: (id: string) =>
    http.get<AssistantMessage>('/v1/assistant/message/detail', { params: { id } }),
  chat: (request: {
    sessionId: string;
    clientRequestId: string;
    content?: string;
    attachments?: AssistantAttachmentInput[];
    suggestionType?: AssistantSuggestionType;
  }) => http.post<AssistantChatResponse>('/v1/assistant/chat', request),
  checkPromptRisk: (prompt: string) =>
    http.post<AssistantPromptRiskResult>('/v1/assistant/prompt/risk-check', { prompt }),
  optimizePrompt: (prompt: string) =>
    http.post<AssistantPromptOptimizeResult>('/v1/assistant/prompt/optimize', { prompt }),
  applySuggestion: (messageId: string, action: string) =>
    http.post<void>('/v1/assistant/apply', null, { params: { messageId, action } }),
  cancel: (messageId: string) =>
    http.post<AssistantMessage>('/v1/assistant/message/cancel', { messageId }),
  regenerate: (assistantMessageId: string, clientRequestId: string) =>
    http.post<AssistantChatResponse>('/v1/assistant/message/regenerate', {
      assistantMessageId,
      clientRequestId,
    }),
  taskPrefill: (
    messageId: string,
    resultId: string,
    targetCapability: AssistantTaskTargetCapability,
  ) =>
    http.post<AssistantTaskPrefill>('/v1/assistant/message/task-prefill', {
      messageId,
      resultId,
      targetCapability,
    }),
  saveToAsset: (
    messageId: string,
    resultId: string,
    name?: string,
  ) => http.post<{ assetResourceId: string; fileResourceId: string; idempotentReplay: boolean }>(
    '/v1/assistant/message/save-to-asset',
    { messageId, resultId, name },
  ),
};
