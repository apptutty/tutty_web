import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  try {
    await auth.ready;
    return auth.sessionExists() ? true : router.createUrlTree(['/login']);
  } catch {
    return router.createUrlTree(['/login']);
  }
};

export const noAuthGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  try {
    await auth.ready;
    if (!auth.sessionExists()) return true;
    await auth.profileReady;
    const user = auth.currentUser();
    if (!user) return true; // profile failed — show login rather than redirect loop
    return router.createUrlTree([user.role === 'store_admin' ? '/store' : '/dashboard']);
  } catch {
    return true;
  }
};
