import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take, switchMap, from } from 'rxjs';
import { AuthService } from './auth.service';
import { getSupabaseClient } from '../supabase/supabase.client';

async function checkApproval(userId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
        .from('commerce_admins')
        .select('commerce_id, commerces!inner(approval_status)')
        .eq('user_id', userId)
        .eq('commerces.approval_status', 'aprobado')
        .limit(1)
        .maybeSingle();

    return data !== null;
}

export const pendingApprovalGuard: CanActivateFn = (route) => {
    console.log('[pendingApprovalGuard] START — url:', route.url.toString());
    const auth = inject(AuthService);
    const router = inject(Router);

    const runCheck = async () => {
        const user = auth.currentUser();
        console.log('[pendingApprovalGuard] runCheck — user:', user ? `id=${user.id}` : 'null');
        if (!user) {
            console.warn('[pendingApprovalGuard] No user — redirect /login');
            return router.createUrlTree(['/login']);
        }

        const approved = await checkApproval(user.id);
        console.log('[pendingApprovalGuard] checkApproval result:', approved);
        return approved ? true : router.createUrlTree(['/register/pending']);
    };

    console.log('[pendingApprovalGuard] isLoading:', auth.isLoading());
    if (!auth.isLoading()) {
        return from(runCheck());
    }

    return toObservable(auth.isLoading).pipe(
        filter(loading => !loading),
        take(1),
        switchMap(() => from(runCheck())),
    );
};
