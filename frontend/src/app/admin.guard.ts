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

  const currentUser = authService.getCurrentUser();
  if (currentUser) {
    if (authService.isAdminUser()) {
      return true;
    }
    router.navigate(['/']);
    return false;
  }

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
};