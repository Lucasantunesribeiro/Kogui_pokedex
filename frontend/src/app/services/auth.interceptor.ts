import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, catchError, finalize, switchMap, take, throwError } from 'rxjs';

import { AuthService } from './auth.service';

const publicEndpoints = ['/authtoken', '/authtokenrefresh', '/auth/register/'];

const shouldSkipAuth = (url: string): boolean => publicEndpoints.some((endpoint) => url.includes(endpoint));

let refreshInProgress = false;
let refreshSubject: Subject<string | null> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (shouldSkipAuth(req.url)) {
    return next(req);
  }

  const accessToken = authService.getAccessToken();
  const authReq = accessToken
    ? req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 403) {
        authService.logout();
        router.navigate(['/login']);
        return throwError(() => error);
      }

      if (error.status !== 401 || shouldSkipAuth(req.url)) {
        return throwError(() => error);
      }

      if (!refreshInProgress) {
        refreshInProgress = true;
        refreshSubject = new Subject<string | null>();

        return authService.refreshAccessToken().pipe(
          switchMap(() => {
            const refreshedToken = authService.getAccessToken();
            refreshSubject?.next(refreshedToken ?? null);
            refreshSubject?.complete();

            if (!refreshedToken) {
              authService.logout();
              router.navigate(['/login']);
              return throwError(() => error);
            }

            const retryRequest = req.clone({
              setHeaders: { Authorization: `Bearer ${refreshedToken}` }
            });
            return next(retryRequest);
          }),
          catchError((refreshError: HttpErrorResponse) => {
            authService.logout();
            router.navigate(['/login']);
            refreshSubject?.error(refreshError);
            return throwError(() => refreshError);
          }),
          finalize(() => {
            refreshInProgress = false;
            refreshSubject = null;
          })
        );
      }

      if (refreshSubject) {
        return refreshSubject.pipe(
          take(1),
          switchMap((tokenValue) => {
            const refreshedToken = tokenValue ?? authService.getAccessToken();
            if (!refreshedToken) {
              authService.logout();
              router.navigate(['/login']);
              return throwError(() => error);
            }
            const retryRequest = req.clone({
              setHeaders: { Authorization: `Bearer ${refreshedToken}` }
            });
            return next(retryRequest);
          }),
          catchError((subjectError: unknown) => throwError(() => subjectError))
        );
      }

      authService.logout();
      router.navigate(['/login']);
      return throwError(() => error);
    })
  );
};
