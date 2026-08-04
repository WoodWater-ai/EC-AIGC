import http from '../client';
import type { PageInfo } from '../service-result';

export type CreationMediaType = 'IMAGE' | 'VIDEO';
export type CreationTemplateStatus = 'DRAFT' | 'PUBLISHED' | 'OFFLINE';

export interface CreationWork {
  resultId: string;
  taskId: string;
  groupId: string;
  mediaType: CreationMediaType;
  taskKind: CreationMediaType;
  taskType: string;
  imageType?: string | null;
  title: string;
  url: string;
  thumbnailUrl?: string | null;
  productImageUrl?: string | null;
  status?: string | null;
  score?: number | null;
  createTime: string;
  canPublishTemplate: boolean;
  creationTemplateId?: string | null;
  templateStatus?: CreationTemplateStatus | null;
}

export interface CreationTemplate {
  id: string;
  templateName: string;
  mediaType: CreationMediaType;
  coverUrl: string;
  previewUrl?: string | null;
  productImageUrl?: string | null;
  status: CreationTemplateStatus;
  visibility: 'PRIVATE' | 'ORG' | 'PUBLIC';
  currentVersionId: string;
  version: string;
  usageCount: number;
  viewCount: number;
  favoriteCount: number;
  favorited: boolean;
  taskType?: string | null;
  imageType?: string | null;
  style?: string | null;
  scene?: string | null;
  pose?: string | null;
  publishTime?: string | null;
}

export interface CreationTemplateReference {
  role:
    | 'REFERENCE_DETAIL'
    | 'REFERENCE_STYLE'
    | 'REFERENCE_SCENE'
    | 'REFERENCE_POSE'
    | 'REFERENCE_MODEL'
    | 'DETAIL_REF'
    | 'STYLE_REF'
    | 'SCENE_REF'
    | 'POSE_REF'
    | 'MODEL_REF'
    | 'FIRST_FRAME'
    | 'SOURCE_VIDEO'
    | 'REPLACEMENT_REFERENCE';
  assetId: string;
  name?: string | null;
  url: string;
  thumbnailUrl?: string | null;
  durationSec?: number | null;
  sortOrder?: number;
}

export interface CreationTemplateSnapshot {
  mediaType: CreationMediaType;
  taskType?: string | null;
  imageType?: string | null;
  count?: number | null;
  style?: string | null;
  scene?: string | null;
  pose?: string | null;
  prompt?: string | null;
  negativePrompt?: string | null;
  channelType?: string | null;
  capability?: string | null;
  modelCode?: string | null;
  schemaParams?: Record<string, unknown>;
  references?: CreationTemplateReference[];
  videoMode?: 'FIRST_FRAME' | 'TRENDING_REPLICATE' | null;
  videoDurationSec?: number | null;
  videoResolution?: string | null;
  videoMotion?: string | null;
}

export interface CreationTemplateReuseContext {
  templateId: string;
  versionId: string;
  templateName: string;
  mediaType: CreationMediaType;
  version: string;
  snapshot: CreationTemplateSnapshot;
}

export interface CreationTemplateEngagement {
  viewCount: number;
  favoriteCount: number;
  favorited: boolean;
}

export const creationTemplateApi = {
  myWorks(mediaType: CreationMediaType, pageNum = 1, pageSize = 100) {
    return http.post<PageInfo<CreationWork>>('/v1/creation-template/work/page', {
      pageNum,
      pageSize,
      mediaType,
    });
  },

  camp(mediaType: CreationMediaType, pageNum = 1, pageSize = 100, keyword?: string) {
    return http.post<PageInfo<CreationTemplate>>('/v1/creation-template/camp/page', {
      pageNum,
      pageSize,
      mediaType,
      keyword,
    });
  },

  publishFromResult(payload: {
    taskId: string;
    resultId: string;
    mediaType: CreationMediaType;
    templateName: string;
  }) {
    return http.post<string>('/v1/creation-template/publish-from-result', payload);
  },

  offline(id: string) {
    return http.post<void>('/v1/creation-template/offline', null, { params: { id } });
  },

  reuseContext(id: string) {
    return http.post<CreationTemplateReuseContext>(
      '/v1/creation-template/reuse-context',
      null,
      { params: { id } },
    );
  },

  recordView(id: string) {
    return http.post<CreationTemplateEngagement>(
      '/v1/creation-template/view',
      null,
      { params: { id } },
    );
  },

  toggleFavorite(id: string) {
    return http.post<CreationTemplateEngagement>(
      '/v1/creation-template/favorite/toggle',
      null,
      { params: { id } },
    );
  },
};
