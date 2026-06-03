import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take, switchMap, from } from 'rxjs';
import { AuthService } from './auth.service';
import { getSupabaseClient } from '../supabase/supabase.client';

async function checkApproval(userId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
        .from('restaurant_admins')
        .select('restaurant_id, restaurants!inner(approval_status)')
        .eq('user_id', userId)
        .eq('restaurants.approval_status', 'aprobado')
        .limit(1)
        .maybeSingle();

    return data !== null;
}

export const pendingApprovalGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const runCheck = async () => {
        const user = auth.currentUser();
        if (!user) return router.createUrlTree(['/login']);

        const approved = await checkApproval(user.id);
        return approved ? true : router.createUrlTree(['/register/pending']);
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
