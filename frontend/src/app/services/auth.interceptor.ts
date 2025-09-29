import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

const publicEndpoints = ['/api/token/', '/api/token/refresh/', '/auth/register/'];

const shouldSkipAuth = (url: string): boolean => publicEndpoints.some((endpoint) => url.includes(endpoint));

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (shouldSkipAuth(req.url)) {
    return next(req);
  }

  const accessToken = authService.getAccessToken();
  const authRequest = accessToken
    ? req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
    : req;

  return next(authRequest).pipe(
    authService.handle401WithSingleFlightRefresh(authRequest, next),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 || error.status === 403) {
        authService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
