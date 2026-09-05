import { HttpErrorResponse } from '@angular/common/http';

type ApiErrorBody = { code?: unknown };

export function isVersionConflict(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse) || error.status !== 409) {
    return false;
  }

  const body = error.error as ApiErrorBody | null;
  return body?.code === 'VERSION_CONFLICT';
}
