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
  console.log('[OperatorGuard] check', {
    hasUser: !!user,
    userId: user?.id ?? null,
    role: user?.role ?? null,
    sessionExists: auth.sessionExists(),
  });
  if (!user) {
    console.log('[OperatorGuard] no user decision', { decision: auth.sessionExists() ? 'allow' : 'redirect-login' });
    return auth.sessionExists() ? true : router.createUrlTree(['/login']);
  }
  if (user.role === 'store_admin') {
    console.log('[OperatorGuard] redirect store_admin -> /store');
    return router.createUrlTree(['/store']);
  }
  console.log('[OperatorGuard] allow');
  return true;
};
