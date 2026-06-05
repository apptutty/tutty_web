import { Injectable, signal, computed } from '@angular/core';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import { ExcursionOperator } from '../../core/supabase/database.types';

const ACTIVE_OPERATOR_KEY = 'tutty_active_operator_id';

@Injectable({ providedIn: 'root' })
export class OperatorAdminService {
    private readonly supabase = getSupabaseClient();

    readonly operators = signal<ExcursionOperator[]>([]);
    readonly activeOperatorId = signal<string | null>(localStorage.getItem(ACTIVE_OPERATOR_KEY));
    readonly pendingBookingsCount = signal(0);
    readonly isLoading = signal(false);

    readonly activeOperator = computed(() => {
        const id = this.activeOperatorId();
        return id ? (this.operators().find(o => o.id === id) ?? null) : null;
    });

    readonly approvedOperators = computed(() =>
        this.operators().filter(o => o.approval_status === 'aprobado' || o.is_active)
    );

    async loadUserOperators(userId: string): Promise<void> {
        this.isLoading.set(true);
        const { data, error } = await this.supabase
            .from('excursion_operator_admins')
            .select('excursion_operators(*)')
            .eq('user_id', userId);

        if (error || !data) { this.isLoading.set(false); return; }

        const ops = (data as unknown[])
            .map((row) => (row as Record<string, unknown>)['excursion_operators'])
            .filter(Boolean) as ExcursionOperator[];

        this.operators.set(ops);

        const savedId = this.activeOperatorId();
        const validSaved = ops.find(o => o.id === savedId && (o.approval_status === 'aprobado' || o.is_active));
        if (!validSaved) {
            const first = ops.find(o => o.approval_status === 'aprobado' || o.is_active);
            if (first) {
                this.setActiveOperator(first.id!);
            } else {
                this.activeOperatorId.set(null);
            }
        }

        this.isLoading.set(false);
    }

    setActiveOperator(operatorId: string): void {
        this.activeOperatorId.set(operatorId);
        localStorage.setItem(ACTIVE_OPERATOR_KEY, operatorId);
        this.loadPendingBookings(operatorId);
    }

    async loadPendingBookings(operatorId: string): Promise<void> {
        const { count } = await this.supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .eq('operator_id', operatorId)
            .eq('status', 'pending');
        this.pendingBookingsCount.set(count ?? 0);
    }
}
