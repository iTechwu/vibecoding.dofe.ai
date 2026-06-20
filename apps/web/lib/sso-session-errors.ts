export type SsoSessionErrorCode =
  | 'SESSION_EXPIRED'
  | 'SSO_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'PERMISSION_DENIED'
  | 'UNKNOWN';

export interface SsoSessionErrorClassification {
  code: SsoSessionErrorCode;
  message: string;
  status?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readStatus(error: unknown): number | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  const status = error.status ?? error.statusCode;
  return typeof status === 'number' ? status : undefined;
}

function readMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }

  return 'Unknown SSO session error';
}

export function classifySsoSessionError(error: unknown): SsoSessionErrorClassification {
  const status = readStatus(error);
  const message = readMessage(error);
  const normalized = message.toLowerCase();

  if (
    status === 401 ||
    normalized.includes('unauthorized') ||
    normalized.includes('session expired') ||
    normalized.includes('login expired') ||
    normalized.includes('token expired')
  ) {
    return { code: 'SESSION_EXPIRED', message, status };
  }

  if (status === 403 || normalized.includes('forbidden') || normalized.includes('permission')) {
    return { code: 'PERMISSION_DENIED', message, status };
  }

  if (
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    (error instanceof Error && error.name === 'AbortError')
  ) {
    return { code: 'TIMEOUT', message, status };
  }

  if (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    normalized.includes('unavailable') ||
    normalized.includes('bad gateway') ||
    normalized.includes('gateway timeout')
  ) {
    return { code: 'SSO_UNAVAILABLE', message, status };
  }

  if (
    normalized.includes('network') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('load failed')
  ) {
    return { code: 'NETWORK_ERROR', message, status };
  }

  return { code: 'UNKNOWN', message, status };
}
