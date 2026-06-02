import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    // If loading has finished, check immediately
    if (!auth.isLoading()) {
        return auth.isAuthenticated() ? true : router.createUrlTree(['/login']);
    }

    // Wait for loading to complete, then check
    return toObservable(auth.isLoading).pipe(
        filter(loading => !loading),
        take(1),
        map(() => auth.isAuthenticated() ? true : router.createUrlTree(['/login']))
    );
};

export const noAuthGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isLoading()) {
        return !auth.isAuthenticated() ? true : router.createUrlTree(['/dashboard']);
    }

    return toObservable(auth.isLoading).pipe(
        filter(loading => !loading),
        take(1),
        map(() => !auth.isAuthenticated() ? true : router.createUrlTree(['/dashboard']))
    );
};
