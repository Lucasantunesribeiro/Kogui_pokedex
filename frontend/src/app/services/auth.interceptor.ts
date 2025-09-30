import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, catchError, finalize, switchMap, take, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const PUBLIC_PATHS = [
  '/api/token',
  '/auth/register',
  '/auth/password/reset',      // reset via email (público)
  '/auth/password/change',     // mudança de senha (autenticado, mas sem interceptor)
  '/health',
  '/api/pokemon',              // listagem pública
];

// Paths que precisam de autenticação mas não devem ter interceptor aplicado
const NO_INTERCEPT_PATHS = ['/auth/password/change'];

const isPublic = (url: string) => PUBLIC_PATHS.some((p) => url.includes(p));
const needsNoIntercept = (url: string) => NO_INTERCEPT_PATHS.some((p) => url.includes(p));

let refreshing = false;
let refreshSubject: Subject<string | null> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (isPublic(req.url)) {
    return next(req);
  }

  const token = auth.getAccessToken();
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // 403 -> Forbidden (sem permissão, mas sessão válida)
      // Não deslogamos automaticamente em 403; deixamos o usuário logado
      if (error.status === 403) {
        return throwError(() => error);
      }

      // se não for 401, não tentamos refresh
      if (error.status !== 401 || isPublic(req.url)) {
        return throwError(() => error);
      }

      // fluxo de refresh com de-duplicação
      if (!refreshing) {
        refreshing = true;
        refreshSubject = new Subject<string | null>();

        return auth.refreshAccessToken().pipe(
          switchMap(() => {
            const newToken = auth.getAccessToken();
            refreshSubject?.next(newToken ?? null);
            refreshSubject?.complete();

            if (!newToken) {
              auth.logout();
              router.navigateByUrl('/login');
              return throwError(() => error);
            }

            const retry = req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } });
            return next(retry);
          }),
          catchError((refreshErr) => {
            refreshSubject?.error(refreshErr);
            auth.logout();
            router.navigateByUrl('/login');
            return throwError(() => refreshErr);
          }),
          finalize(() => {
            refreshing = false;
            refreshSubject = null;
          })
        );
      }

      // espera o refresh em andamento
      if (refreshSubject) {
        return refreshSubject.pipe(
          take(1),
          switchMap((maybeToken) => {
            const newToken = maybeToken ?? auth.getAccessToken();
            if (!newToken) {
              auth.logout();
              router.navigateByUrl('/login');
              return throwError(() => error);
            }
            const retry = req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } });
            return next(retry);
          }),
          catchError((e) => throwError(() => e))
        );
      }

      auth.logout();
      router.navigateByUrl('/login');
      return throwError(() => error);
    })
  );
};
