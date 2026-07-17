import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { StoreAdminService } from '../../features/store-admin/store-admin.service';

export const storeApprovedGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const storeService = inject(StoreAdminService);
  const router = inject(Router);

  const user = auth.currentUser();
  if (!user) {
    console.log('[StoreApprovedGuard] no user -> /login');
    return router.createUrlTree(['/login']);
  }

  if (storeService.stores().length === 0) {
    console.log('[StoreApprovedGuard] loading stores', { userId: user.id });
    await storeService.loadUserStores(user.id);
  }

  if (storeService.stores().length === 0) {
    console.log('[StoreApprovedGuard] no stores -> /register/pending');
    return router.createUrlTree(['/register/pending']);
  }

  const approved = storeService.approvedStores();
  console.log('[StoreApprovedGuard] stores summary', {
    total: storeService.stores().length,
    approved: approved.length,
    activeStoreId: storeService.activeStoreId(),
  });

  if (approved.length === 0) {
    const path = state.url.split('?')[0].split('#')[0];
    if (path === '/store/dashboard') {
      console.log('[StoreApprovedGuard] pending-only already at /store/dashboard -> allow');
      return true;
    }
    console.log('[StoreApprovedGuard] pending-only -> /store/dashboard');
    return router.createUrlTree(['/store/dashboard']);
  }

  if (approved.length > 1 && !storeService.activeStoreId()) {
    console.log('[StoreApprovedGuard] multiple approved and no active -> /store/select-store');
    return router.createUrlTree(['/store/select-store']);
  }

  const activeId = storeService.activeStoreId();
  if (activeId) {
    console.log('[StoreApprovedGuard] preload active orders', { activeId });
    storeService.loadActiveOrders(activeId);
  }

  console.log('[StoreApprovedGuard] allow');
  return true;
};
