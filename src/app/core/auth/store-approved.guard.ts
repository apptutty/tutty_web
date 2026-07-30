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
    return router.createUrlTree(['/login']);
  }

  if (storeService.stores().length === 0) {
    await storeService.loadUserStores(user.id);
  }

  if (storeService.stores().length === 0) {
    return router.createUrlTree(['/register/pending']);
  }

  const approved = storeService.approvedStores();

  if (approved.length === 0) {
    const path = state.url.split('?')[0].split('#')[0];
    if (path === '/store/dashboard') {
      return true;
    }
    return router.createUrlTree(['/store/dashboard']);
  }

  if (approved.length > 1 && !storeService.activeStoreId()) {
    return router.createUrlTree(['/store/select-store']);
  }

  const activeId = storeService.activeStoreId();
  if (activeId) {
    storeService.loadActiveOrders(activeId);
  }

  return true;
};
