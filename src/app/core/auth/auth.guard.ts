import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;
  return auth.isAuthenticated() ? true : router.createUrlTree(['/login']);
};

export const noAuthGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;
  if (!auth.isAuthenticated()) return true;
  const user = auth.currentUser();
  return user?.role === 'store_admin'
    ? router.createUrlTree(['/store'])
    : router.createUrlTree(['/dashboard']);
};
