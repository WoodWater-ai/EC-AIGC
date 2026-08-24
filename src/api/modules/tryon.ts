import http from '../client';
import type { PageInfo } from '../service-result';

export interface TryonAvailableModel {
  id: string;
  name: string;
  imageUrl: string;
  modelType: string;
  sourceMode: string;
  rightsRecordId: string;
  personConsentId?: string;
  estimatedCost?: string;
  syntheticModel: boolean;
}

export interface TryonPreflight {
  ready: boolean;
  projectId: string;
  approvedGarmentId?: string;
  modelProfileId?: string;
  channelId?: string;
  channelName?: string;
  channelType?: string;
  modelCode?: string;
  providerProfileId?: string;
  providerProfileCode?: string;
  agreementVersion?: string;
  rightsRecordId?: string;
  personConsentId?: string;
  blockers: string[];
}

export interface TryonCandidate {
  id: string;
  outputIndex: number;
  fileResourceId: string;
  imageUrl: string;
  contentSha256: string;
  garmentFidelityStatus: string;
  personConsistencyStatus: string;
  safetyStatus: string;
  status: 'READY' | 'SELECTED' | 'DISCARDED' | 'RESTRICTED';
}

export interface TryonTask {
  id: string;
  projectId: string;
  idempotencyKey: string;
  channelType: string;
  modelCode: string;
  providerProfileId: string;
  requestHash: string;
  requestedCandidateCount: number;
  poseCode: string;
  sceneCode: string;
  targetMarket: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'PARTIAL_FAILED' | 'FAILED' | 'BLOCKED';
  failureType?: string;
  providerErrorCode?: string;
  failureMessage?: string;
  providerCost?: string;
  estimatedCost?: string;
  accountedCost?: string;
  costBasis?: 'PROVIDER_ACTUAL' | 'CONFIGURED_ESTIMATE_FALLBACK' | 'NOT_INVOKED' | 'RECONCILIATION_REQUIRED';
  durationMs?: string;
  createTime?: string;
  completedAt?: string;
  candidates: TryonCandidate[];
}

export interface TryonProject {
  id: string;
  approvedGarmentId: string;
  garmentImageUrl?: string;
  modelProfileId: string;
  modelName?: string;
  modelImageUrl?: string;
  name: string;
  targetMarket: string;
  currentCandidateId?: string;
  currentCandidateImageUrl?: string;
  status: string;
  createTime?: string;
}

const base = '/v1/user/tryon';

export const tryonApi = {
  availableModels: (approvedGarmentId: string, targetMarket: string) =>
    http.post<TryonAvailableModel[]>(`${base}/available-models`, { approvedGarmentId, targetMarket }),
  createProject: (request: { approvedGarmentId: string; modelProfileId: string; name: string; targetMarket: string }) =>
    http.post<string>(`${base}/project/create`, request),
  projectDetail: (id: string) => http.post<TryonProject>(`${base}/project/detail`, { id }),
  preflight: (projectId: string, candidateCount: number) =>
    http.post<TryonPreflight>(`${base}/preflight`, { projectId, candidateCount }),
  submit: (request: { projectId: string; idempotencyKey: string; candidateCount: number; poseCode: string; sceneCode: string }) =>
    http.post<string>(`${base}/submit`, request),
  taskPage: (request: { pageNum: number; pageSize: number; projectId?: string; status?: TryonTask['status'] }) =>
    http.post<PageInfo<TryonTask>>(`${base}/task/page`, request),
  taskDetail: (id: string) => http.post<TryonTask>(`${base}/task/detail`, { id }),
  selectCandidate: (candidateId: string) =>
    http.post<TryonProject>(`${base}/candidate/select`, { candidateId, confirmInternalOnly: true }),
};
