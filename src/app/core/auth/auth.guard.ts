import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  try {
    await auth.ready;
    const allowed = auth.sessionExists();
    console.log('[AuthGuard] decision', { allowed, sessionExists: auth.sessionExists() });
    return allowed ? true : router.createUrlTree(['/login']);
  } catch (err) {
    console.error('[AuthGuard] failed', err);
    return router.createUrlTree(['/login']);
  }
};

export const noAuthGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  try {
    await auth.ready;
    if (!auth.sessionExists()) {
      console.log('[NoAuthGuard] allow login route (no session)');
      return true;
    }
    await auth.profileReady;
    const user = auth.currentUser();
    if (!user) {
      console.warn('[NoAuthGuard] session exists but no user profile; allow /login');
      return true; // profile failed — show login rather than redirect loop
    }
    const redirect = user.role === 'store_admin' ? '/store' : '/dashboard';
    console.log('[NoAuthGuard] redirect authenticated user', { userId: user.id, role: user.role, redirect });
    return router.createUrlTree([redirect]);
  } catch (err) {
    console.error('[NoAuthGuard] failed', err);
    return true;
  }
};
