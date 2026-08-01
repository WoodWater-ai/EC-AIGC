import http from '../client';

export interface ScoreSubmitRequest {
  generatedImageId: string;
  overallScore: number;
  dimSubject?: number;
  dimStyle?: number;
  dimComposition?: number;
  dimDetail?: number;
  dimCommercial?: number;
  defectTags?: string;
  advantageTags?: string;
  optimizationNote?: string;
  reviewConclusion?: 'PASSED' | 'REJECTED';
}

export const auditApi = {
  submitScore(request: ScoreSubmitRequest): Promise<string> {
    return http.post<string>('/v1/admin/audit/score/submit', request);
  },
};
