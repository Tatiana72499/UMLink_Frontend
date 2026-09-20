import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError, timeout } from 'rxjs';
import { NetworkStatusService } from './network-status.service';

/** Allows long-running, explicit operations such as image analysis to opt out of the default UI timeout. */
export const REQUEST_TIMEOUT_MS = new HttpContextToken<number>(() => 15_000);

export const networkInterceptor: HttpInterceptorFn = (request, next) => {
  const network = inject(NetworkStatusService);
  return next(request).pipe(
    timeout({ each: request.context.get(REQUEST_TIMEOUT_MS) }),
    catchError((error: unknown) => { network.report(error); return throwError(() => error); }),
  );
};
