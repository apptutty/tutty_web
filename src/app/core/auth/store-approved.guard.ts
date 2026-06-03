import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, take, switchMap, from } from 'rxjs';
import { AuthService } from './auth.service';
import { StoreAdminService } from '../../features/store-admin/store-admin.service';

export const storeApprovedGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const storeService = inject(StoreAdminService);
  const router = inject(Router);

  const runCheck = async () => {
    const user = auth.currentUser();
    if (!user) return router.createUrlTree(['/login']);

    // Load stores only if not already loaded
    if (storeService.stores().length === 0) {
      await storeService.loadUserStores(user.id);
    }

    const approved = storeService.approvedStores();

    if (approved.length === 0) {
      return router.createUrlTree(['/register/pending']);
    }

    // If multi-store and nothing selected yet → select-store page
    if (approved.length > 1 && !storeService.activeStoreId()) {
      return router.createUrlTree(['/store/select-store']);
    }

    // Ensure active orders count is loaded
    const activeId = storeService.activeStoreId();
    if (activeId) {
      storeService.loadActiveOrders(activeId);
    }

    return true;
  };

  if (!auth.isLoading()) {
    return from(runCheck());
  }

  return toObservable(auth.isLoading).pipe(
    filter(loading => !loading),
    take(1),
    switchMap(() => from(runCheck())),
  );
};
