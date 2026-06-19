import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import { Courier } from '../../core/supabase/database.types';

@Injectable({ providedIn: 'root' })
export class CouriersService {
    private readonly supabase = getSupabaseClient();

    getCouriers(filters: { available?: boolean } = {}): Observable<Courier[]> {
        return from(
            (async () => {
                let q = this.supabase.from('repartidores')
                    .select('*, user:users(full_name, phone, email)');
                if (filters.available !== undefined) q = q.eq('is_available', filters.available);
                const { data } = await q.order('id');
                return (data ?? []).map((r: any) => ({
                    ...r,
                    full_name: r.user?.full_name ?? '—',
                    phone: r.user?.phone ?? '—',
                    email: r.user?.email ?? '—',
                })) as Courier[];
            })()
        );
    }

    getCourierById(id: string): Observable<any> {
        return from(
            this.supabase.from('repartidores')
                .select('*, user:users(full_name, phone, email, avatar_url)')
                .eq('id', id).single()
                .then(({ data, error }) => {
                    if (error) throw error;
                    return { ...data, full_name: (data as any).user?.full_name ?? '—' };
                })
        );
    }

    getDeliveryHistory(courierId: string, page = 1, pageSize = 20): Observable<{ data: any[]; count: number }> {
        const from_ = (page - 1) * pageSize;
        const to = from_ + pageSize - 1;
        return from(
            this.supabase.from('orders_full')
                .select('id, order_number, status, total, created_at, commerce_name, customer_name', { count: 'exact' })
                .eq('repartidor_id', courierId)
                .eq('status', 'entregado')
                .order('created_at', { ascending: false })
                .range(from_, to)
                .then(({ data, count }) => ({
                    data: (data ?? []).map((o: any) => ({
                        ...o,
                        restaurant_name: o.commerce_name ?? '—',
                        customer_name: o.customer_name ?? '—',
                    })),
                    count: count ?? 0,
                }))
        );
    }

    getRatings(courierId: string): Observable<any[]> {
        return from(
            this.supabase.from('delivery_ratings')
                .select('*, customer:users(full_name)')
                .eq('repartidor_id', courierId)
                .order('created_at', { ascending: false })
                .limit(10)
                .then(({ data }) => (data ?? []).map((r: any) => ({
                    ...r,
                    customer_name: r.customer?.full_name ?? '—',
                })))
        );
    }

    async saveCourier(data: Partial<Courier>): Promise<void> {
        if (data.id) {
            const { error } = await this.supabase.from('repartidores').update(data).eq('id', data.id);
            if (error) throw error;
        } else {
            const { error } = await this.supabase.from('repartidores').insert(data);
            if (error) throw error;
        }
    }
}
