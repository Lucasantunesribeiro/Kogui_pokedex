import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, tap } from 'rxjs';

import { AuthService } from './services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.isAdminUser()) {
    return true;
  }

  if (!authService.getCurrentUser()) {
    return authService.fetchCurrentUser().pipe(
      map(() => authService.isAdminUser()),
      tap((isAdmin) => {
        if (!isAdmin) {
          router.navigate(['/']);
        }
      }),
      catchError(() => {
        router.navigate(['/']);
        return of(false);
      })
    );
  }

  router.navigate(['/']);
  return false;
};