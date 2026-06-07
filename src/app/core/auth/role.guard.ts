import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { UserRole } from './user.model';

export function roleGuard(allowedRoles: UserRole[]): CanActivateFn {
    return async () => {
        const auth = inject(AuthService);
        const router = inject(Router);

        // Await ready so this guard is safe even when used without authGuard in front of it.
        await auth.ready;

        if (!auth.isAuthenticated()) {
            return router.createUrlTree(['/login']);
        }

        if (auth.hasRole(allowedRoles)) {
            return true;
        }

        return router.createUrlTree(['/unauthorized']);
    };
}
