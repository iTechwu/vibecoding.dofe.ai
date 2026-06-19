import type {
  CreateLoopIssueRequest,
  LoopCostResponse,
  LoopDetail,
  LoopImplementationRecord,
  LoopInterventionRequest,
  LoopLogsResponse,
  LoopNotificationsResponse,
  LoopRecordShardImplementationRequest,
  LoopReviewRecord,
  LoopReviewShardRequest,
  LoopRunShardTestsRequest,
  LoopTestRecord,
  LoopsDoctorResponse,
  LoopIssueCreatedResponse,
  LoopListResponse,
  LoopReviewSpecRequest,
  LoopReloopRequest,
  LoopReloopResponse,
  LoopsResumeResponse,
} from '@repo/contracts';
import request, { type DataResponse } from '@/lib/requests';

function unwrap<T>(response: DataResponse<T> | T): T {
  if (response && typeof response === 'object' && 'data' in response && 'code' in response) {
    return (response as DataResponse<T>).data;
  }
  return response as T;
}

export async function listLoops() {
  return unwrap(
    await request.get<DataResponse<LoopListResponse>>('/loops', {
      cacheTime: 0,
    }),
  );
}

export async function createLoopIssue(input: CreateLoopIssueRequest) {
  return unwrap(
    await request.post<DataResponse<LoopIssueCreatedResponse>>('/loops/issues', {
      params: input,
      cacheTime: 0,
    }),
  );
}

export async function getLoopIssue(issueId: string) {
  return unwrap(
    await request.get<DataResponse<LoopDetail>>(`/loops/issues/${issueId}`, {
      cacheTime: 0,
    }),
  );
}

export async function generateLoopSpec(issueId: string) {
  return unwrap(
    await request.post<DataResponse<LoopDetail>>(`/loops/issues/${issueId}/spec`, {
      params: {},
      cacheTime: 0,
    }),
  );
}

export async function reviewLoopSpec(issueId: string, input: LoopReviewSpecRequest) {
  return unwrap(
    await request.post<DataResponse<LoopDetail>>(`/loops/issues/${issueId}/spec/review`, {
      params: input,
      cacheTime: 0,
    }),
  );
}

export async function decomposeLoop(issueId: string) {
  return unwrap(
    await request.post<DataResponse<LoopDetail>>(`/loops/issues/${issueId}/decompose`, {
      params: {},
      cacheTime: 0,
    }),
  );
}

export async function interveneLoopIssue(issueId: string, input: LoopInterventionRequest) {
  return unwrap(
    await request.post<DataResponse<LoopDetail>>(`/loops/issues/${issueId}/interventions`, {
      params: input,
      cacheTime: 0,
    }),
  );
}

export async function getLoopsDoctor() {
  return unwrap(
    await request.get<DataResponse<LoopsDoctorResponse>>('/loops/doctor', {
      cacheTime: 0,
    }),
  );
}

export async function getLoopsCost() {
  return unwrap(
    await request.get<DataResponse<LoopCostResponse>>('/loops/cost', {
      cacheTime: 0,
    }),
  );
}

export async function getLoopLogs(input?: { issueId?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (input?.issueId) searchParams.set('issueId', input.issueId);
  if (input?.limit) searchParams.set('limit', String(input.limit));
  const query = searchParams.toString();
  return unwrap(
    await request.get<DataResponse<LoopLogsResponse>>(`/loops/logs${query ? `?${query}` : ''}`, {
      cacheTime: 0,
    }),
  );
}

export async function getLoopNotifications(input?: { issueId?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (input?.issueId) searchParams.set('issueId', input.issueId);
  if (input?.limit) searchParams.set('limit', String(input.limit));
  const query = searchParams.toString();
  return unwrap(
    await request.get<DataResponse<LoopNotificationsResponse>>(
      `/loops/notifications${query ? `?${query}` : ''}`,
      {
        cacheTime: 0,
      },
    ),
  );
}

export async function resumeLoops() {
  return unwrap(
    await request.post<DataResponse<LoopsResumeResponse>>('/loops/resume', {
      params: {},
      cacheTime: 0,
    }),
  );
}

export async function runLoopShardTests(
  issueId: string,
  shardId: string,
  input?: LoopRunShardTestsRequest,
) {
  return unwrap(
    await request.post<DataResponse<LoopTestRecord>>(
      `/loops/issues/${issueId}/shards/${shardId}/tests`,
      {
        params: input ?? {},
        cacheTime: 0,
      },
    ),
  );
}

export async function recordLoopShardImplementation(
  issueId: string,
  shardId: string,
  input: LoopRecordShardImplementationRequest,
) {
  return unwrap(
    await request.post<DataResponse<LoopImplementationRecord>>(
      `/loops/issues/${issueId}/shards/${shardId}/implementation`,
      {
        params: input,
        cacheTime: 0,
      },
    ),
  );
}

export async function reviewLoopShard(
  issueId: string,
  shardId: string,
  input: LoopReviewShardRequest,
) {
  return unwrap(
    await request.post<DataResponse<LoopReviewRecord>>(
      `/loops/issues/${issueId}/shards/${shardId}/review`,
      {
        params: input,
        cacheTime: 0,
      },
    ),
  );
}

export async function runLoop(issueId: string) {
  return unwrap(
    await request.post<DataResponse<LoopDetail>>(`/loops/issues/${issueId}/run`, {
      params: {},
      cacheTime: 0,
    }),
  );
}

export async function reviewLoopGlobal(issueId: string) {
  return unwrap(
    await request.post<DataResponse<LoopDetail>>(`/loops/issues/${issueId}/global-review`, {
      params: {},
      cacheTime: 0,
    }),
  );
}

export async function reloopIssue(issueId: string, input: LoopReloopRequest) {
  return unwrap(
    await request.post<DataResponse<LoopReloopResponse>>(`/loops/issues/${issueId}/reloop`, {
      params: input,
      cacheTime: 0,
    }),
  );
}

export async function finalizeLoop(issueId: string) {
  return unwrap(
    await request.post<DataResponse<LoopDetail>>(`/loops/issues/${issueId}/finalize`, {
      params: {},
      cacheTime: 0,
    }),
  );
}
