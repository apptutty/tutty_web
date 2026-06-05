import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import { Restaurant } from '../../core/supabase/database.types';

const ACTIVE_STORE_KEY = 'tutty_active_store_id';

export type TimeRange = 'hoy' | 'semana' | 'mes';

@Injectable({ providedIn: 'root' })
export class StoreAdminService {
    private readonly supabase = getSupabaseClient();
    private readonly router = inject(Router);

    readonly stores = signal<Restaurant[]>([]);
    readonly activeStoreId = signal<string | null>(localStorage.getItem(ACTIVE_STORE_KEY));
    readonly isLoading = signal(false);
    readonly timeRange = signal<TimeRange>('hoy');
    readonly activeOrdersCount = signal(0);

    readonly activeStore = computed(() => {
        const id = this.activeStoreId();
        return id ? (this.stores().find(s => s.id === id) ?? null) : null;
    });

    readonly approvedStores = computed(() =>
        this.stores().filter(s => s.approval_status === 'aprobado')
    );

    async loadUserStores(userId: string): Promise<void> {
        this.isLoading.set(true);
        const { data, error } = await this.supabase
            .from('commerce_admins')
            .select('commerces(*)')
            .eq('user_id', userId);

        if (error || !data) {
            this.isLoading.set(false);
            return;
        }

        const restaurants = (data as any[])
            .map(row => row.commerces)
            .filter(Boolean) as Restaurant[];

        this.stores.set(restaurants);

        // Keep saved id if still valid, else pick first approved
        const savedId = this.activeStoreId();
        const validSaved = restaurants.find(r => r.id === savedId && r.approval_status === 'aprobado');
        if (!validSaved) {
            const firstApproved = restaurants.find(r => r.approval_status === 'aprobado');
            if (firstApproved) {
                this.setActiveStore(firstApproved.id);
            } else {
                this.activeStoreId.set(null);
            }
        }

        this.isLoading.set(false);
    }

    setActiveStore(storeId: string): void {
        this.activeStoreId.set(storeId);
        localStorage.setItem(ACTIVE_STORE_KEY, storeId);
        this.loadActiveOrders(storeId);
        this.router.navigate(['/store/dashboard']);
    }

    async loadActiveOrders(storeId: string): Promise<void> {
        const { count } = await this.supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('commerce_id', storeId)
            .in('status', ['recibido', 'confirmado', 'en_preparacion']);
        this.activeOrdersCount.set(count ?? 0);
    }

    async toggleIsOpen(): Promise<void> {
        const store = this.activeStore();
        if (!store) return;
        const newVal = !store.is_open;
        const { error } = await this.supabase
            .from('commerces')
            .update({ is_open: newVal })
            .eq('id', store.id);
        if (!error) {
            this.stores.update(list =>
                list.map(s => s.id === store.id ? { ...s, is_open: newVal } : s)
            );
        }
    }

    isOutsideSchedule(): boolean {
        const store = this.activeStore();
        if (!store || !store.opening_time || !store.closing_time) return false;

        const now = new Date();
        const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
        const today = dayNames[now.getDay()];

        if (store.open_days && store.open_days.length > 0 && !store.open_days.includes(today)) return true;

        const [oh, om] = store.opening_time.split(':').map(Number);
        const [ch, cm] = store.closing_time.split(':').map(Number);
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const openMins = oh * 60 + om;
        const closeMins = ch * 60 + cm;

        return nowMins < openMins || nowMins > closeMins;
    }
}
