import { Injectable } from '@angular/core';
import { Observable, from, interval, switchMap, map } from 'rxjs';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import { DashboardKPIs, Order, StatusCount } from '../../core/supabase/database.types';

@Injectable({ providedIn: 'root' })
export class DashboardService {
    private readonly supabase = getSupabaseClient();

    getKPIs(): Observable<DashboardKPIs> {
        return interval(30_000).pipe(
            // Immediately starts with 0, then every 30s
            switchMap(() => from(this.fetchKPIs())),
        );
    }

    getKPIsOnce(): Observable<DashboardKPIs> {
        return from(this.fetchKPIs());
    }

    private async fetchKPIs(): Promise<DashboardKPIs> {
        const today = new Date().toISOString().split('T')[0];

        const [ventasRes, pedidosRes, activosRes, commercesRes] = await Promise.all([
            this.supabase
                .from('orders')
                .select('total')
                .gte('created_at', `${today}T00:00:00`)
                .neq('status', 'cancelado'),
            this.supabase
                .from('orders')
                .select('id', { count: 'exact', head: true })
                .gte('created_at', `${today}T00:00:00`)
                .neq('status', 'cancelado'),
            this.supabase
                .from('orders')
                .select('id', { count: 'exact', head: true })
                .in('status', ['recibido', 'confirmado', 'en_preparacion', 'en_camino']),
            this.supabase
                .from('commerces')
                .select('id', { count: 'exact', head: true })
                .eq('is_open', true)
                .eq('is_active', true),
        ]);

        const ventas = (ventasRes.data ?? []).reduce((sum, o) => sum + (o.total ?? 0), 0);

        return {
            ventas_hoy: ventas,
            pedidos_hoy: pedidosRes.count ?? 0,
            pedidos_activos: activosRes.count ?? 0,
            active_commerces: commercesRes.count ?? 0,
        };
    }

    getRecentOrders(limit = 10): Observable<Order[]> {
        return from(
            this.supabase
                .from('orders')
                .select('*, commerce:commerces(name), customer:users(full_name)')
                .order('created_at', { ascending: false })
                .limit(limit)
                .then(({ data }) => (data ?? []) as any[])
        );
    }

    getOrdersByStatus(): Observable<StatusCount[]> {
        return from(
            this.supabase
                .from('orders')
                .select('status')
                .then(({ data }) => {
                    const counts: Record<string, number> = {};
                    for (const row of data ?? []) {
                        counts[row.status] = (counts[row.status] ?? 0) + 1;
                    }
                    return Object.entries(counts).map(([status, count]) => ({ status, count }));
                })
        );
    }
}
