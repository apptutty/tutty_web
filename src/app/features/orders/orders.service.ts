import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import {
    Order, OrderDetail, OrderStatus, OrderFilters, Courier,
} from '../../core/supabase/database.types';

const ACTIVE_STATUSES: OrderStatus[] = ['recibido', 'confirmado', 'en_preparacion', 'en_camino'];

@Injectable({ providedIn: 'root' })
export class OrdersService {
    private readonly supabase = getSupabaseClient();

    getOrders(filters: OrderFilters = {}): Observable<{ data: any[]; count: number }> {
        return from(this.fetchOrders(filters));
    }

    private async fetchOrders(filters: OrderFilters) {
        const { page = 1, pageSize = 20, status, commerce_id, date_from, date_to, search } = filters;

        let query = this.supabase
            .from('orders_full')
            .select('*', { count: 'exact' });

        if (status === 'activos') {
            query = query.in('status', ACTIVE_STATUSES);
        } else if (status) {
            query = query.eq('status', status);
        }

        if (commerce_id) query = query.eq('commerce_id', commerce_id);
        if (date_from) query = query.gte('created_at', `${date_from}T00:00:00`);
        if (date_to) query = query.lte('created_at', `${date_to}T23:59:59`);
        if (search) query = query.ilike('order_number', `%${search}%`);

        const from_ = (page - 1) * pageSize;
        const to = from_ + pageSize - 1;

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from_, to);

        if (error) throw error;
        return { data: (data ?? []).map(this.mapOrder), count: count ?? 0 };
    }

    private mapOrder(o: any) {
        return {
            ...o,
            // Keep restaurant_name alias so the table column key stays unchanged
            restaurant_name: o.commerce_name ?? '—',
        };
    }

    getOrderById(id: string): Observable<OrderDetail> {
        return from(
            Promise.all([
                this.supabase.from('orders_full').select('*').eq('id', id).single(),
                this.supabase.from('order_items').select('*').eq('order_id', id),
                this.supabase
                    .from('order_status_history')
                    .select('*, changed_by_user:users(full_name)')
                    .eq('order_id', id)
                    .order('created_at', { ascending: true }),
            ]).then(([orderRes, itemsRes, historyRes]) => {
                if (orderRes.error) throw orderRes.error;
                return {
                    ...orderRes.data,
                    items: itemsRes.data ?? [],
                    status_history: historyRes.data ?? [],
                } as OrderDetail;
            })
        );
    }

    async updateOrderStatus(orderId: string, status: OrderStatus, notes?: string): Promise<void> {
        const { error: updateError } = await this.supabase
            .from('orders')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', orderId);
        if (updateError) throw updateError;

        const { error: historyError } = await this.supabase
            .from('order_status_history')
            .insert({ order_id: orderId, status, notes: notes ?? null });
        if (historyError) throw historyError;
    }

    async assignCourier(orderId: string, courierId: string): Promise<void> {
        const { error } = await this.supabase
            .from('orders')
            .update({ repartidor_id: courierId })
            .eq('id', orderId);
        if (error) throw error;
    }

    getAvailableCouriers(): Observable<Courier[]> {
        return from(
            this.supabase
                .from('repartidores')
                .select('*, user:users!repartidores_user_id_fkey(full_name, phone)')
                .eq('is_available', true)
                .then(({ data }) =>
                    (data ?? []).map((r: any) => ({
                        ...r,
                        full_name: r.user?.full_name ?? '—',
                        phone: r.user?.phone ?? '—',
                    }))
                )
        );
    }

    subscribeToOrders(callback: (payload: any) => void) {
        return this.supabase
            .channel('orders-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, callback)
            .subscribe();
    }
}
