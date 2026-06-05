import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { OperatorAdminService } from '../../features/operator-admin/operator-admin.service';

export const operatorApprovedGuard: CanActivateFn = async () => {
    const auth = inject(AuthService);
    const operatorSvc = inject(OperatorAdminService);
    const router = inject(Router);

    const user = auth.currentUser();
    if (!user) return router.createUrlTree(['/login']);

    if (operatorSvc.operators().length === 0) {
        await operatorSvc.loadUserOperators(user.id);
    }

    const approved = operatorSvc.approvedOperators();

    if (approved.length === 0) {
        return router.createUrlTree(['/register/operator/pending']);
    }

    const activeId = operatorSvc.activeOperatorId();
    if (activeId) {
        operatorSvc.loadPendingBookings(activeId);
    }

    return true;
};
