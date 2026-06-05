import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Runs after authGuard, so isLoading is already false and currentUser is set.
 * Redirects store_admin to /store; all other roles pass through.
 */
export const operatorGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = auth.currentUser();
  if (!user) return router.createUrlTree(['/login']);
  if (user.role === 'store_admin') return router.createUrlTree(['/store']);
  return true;
};
