import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Runs after authGuard, so isLoading is already false and currentUser is set.
 * Redirects store_admin to /store; all other roles pass through.
 */
export const operatorGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.profileReady;
  const user = auth.currentUser();
  if (!user) {
    return auth.sessionExists() ? true : router.createUrlTree(['/login']);
  }
  if (user.role === 'store_admin') return router.createUrlTree(['/store']);
  return true;
};
