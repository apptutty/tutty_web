import { Injectable, signal, inject } from '@angular/core';
import { Observable, from, interval } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';
import { getSupabaseClient } from '../../../core/supabase/supabase.client';
import { OrderStatus, OrderDetail, StoreOrderSummary } from '../../../core/supabase/database.types';
import { ToastService } from '../../../shared/ui/toast/toast.service';

export interface StoreOrder extends StoreOrderSummary {
    customer_name: string;
    customer_phone: string;
    item_count: number;
    items_preview: string;
    delivery_address: string;
    repartidor_name: string | null;
}

export interface StoreOrderFilters {
    status?: OrderStatus | 'activos' | null;
    date_from?: string;
    date_to?: string;
    search?: string;
    page?: number;
    pageSize?: number;
}

export interface StoreOrderDetail extends OrderDetail {
    // commission_amount intentionally excluded from display
}

const STATUS_SEQUENCE: OrderStatus[] = [
    'recibido', 'confirmado', 'en_preparacion', 'en_camino', 'entregado',
];

@Injectable({ providedIn: 'root' })
export class StoreOrdersService {
    private readonly supabase = getSupabaseClient();
    private readonly toast = inject(ToastService);

    readonly isLoading = signal(false);
    readonly realtimeChannel = signal<any>(null);

    // ─── Orders List ───────────────────────────────────────────────────────────

    getMyOrders(storeId: string, filters: StoreOrderFilters = {}): Observable<{ data: StoreOrder[]; count: number }> {
        return from(this.fetchOrders(storeId, filters));
    }

    getLiveOrders(storeId: string): Observable<{ data: StoreOrder[]; count: number }> {
        return interval(30_000).pipe(
            startWith(0),
            switchMap(() => from(this.fetchOrders(storeId, { status: 'activos' }))),
        );
    }

    private async fetchOrders(storeId: string, filters: StoreOrderFilters) {
        const { page = 1, pageSize = 50, status, date_from, date_to, search } = filters;

        let query = this.supabase
            .from('orders_full')
            .select(
                `id, order_number, subtotal, delivery_fee, total, status, created_at,
         delivery_street, delivery_sector, delivery_city, delivery_notes,
         customer_name, customer_phone, repartidor_name, commerce_id`,
                { count: 'exact' },
            )
            .eq('commerce_id', storeId);

        const ACTIVE: OrderStatus[] = ['recibido', 'confirmado', 'en_preparacion', 'en_camino'];
        if (status === 'activos') {
            query = query.in('status', ACTIVE);
        } else if (status) {
            query = query.eq('status', status);
        }

        if (date_from) query = query.gte('created_at', `${date_from}T00:00:00`);
        if (date_to) query = query.lte('created_at', `${date_to}T23:59:59`);
        if (search) query = query.ilike('order_number', `%${search}%`);

        const from_ = (page - 1) * pageSize;
        const to = from_ + pageSize - 1;

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from_, to);

        if (error) throw error;

        // Fetch items separately to build preview (orders_full is a flat view, no nested joins)
        const orderIds = (data ?? []).map((o: any) => o.id);
        let itemsMap: Map<string, any[]> = new Map();
        if (orderIds.length > 0) {
            const { data: itemsData } = await this.supabase
                .from('order_items')
                .select('order_id, menu_item_snapshot, quantity')
                .in('order_id', orderIds);
            for (const item of itemsData ?? []) {
                if (!itemsMap.has(item.order_id)) itemsMap.set(item.order_id, []);
                itemsMap.get(item.order_id)!.push(item);
            }
        }

        const orders: StoreOrder[] = (data ?? []).map((o: any) => {
            const items = itemsMap.get(o.id) ?? [];
            const addr = [o.delivery_street, o.delivery_sector, o.delivery_city].filter(Boolean).join(', ');
            return {
                id: o.id,
                order_number: o.order_number,
                subtotal: o.subtotal ?? 0,
                commission_amount: 0, // not fetched intentionally
                delivery_fee: o.delivery_fee ?? 0,
                total: o.total ?? 0,
                status: o.status,
                created_at: o.created_at,
                delivery_address: addr,
                customer_name: o.customer_name ?? '—',
                customer_phone: o.customer_phone ?? '',
                repartidor_name: o.repartidor_name ?? null,
                item_count: items.length,
                items_preview: items
                    .slice(0, 3)
                    .map((i: any) => `${i.quantity}x ${(i.menu_item_snapshot as any)?.name ?? 'Producto'}`)
                    .join(', '),
            };
        });

        return { data: orders, count: count ?? 0 };
    }

    // ─── Order Detail ──────────────────────────────────────────────────────────

    getOrderDetail(orderId: string): Observable<StoreOrderDetail> {
        return from(
            Promise.all([
                this.supabase.from('orders_full').select('*').eq('id', orderId).single(),
                this.supabase.from('order_items').select('*').eq('order_id', orderId),
                this.supabase
                    .from('order_status_history')
                    .select('*, changed_by_user:users(full_name)')
                    .eq('order_id', orderId)
                    .order('created_at', { ascending: true }),
            ]).then(([orderRes, itemsRes, historyRes]) => {
                if (orderRes.error) throw orderRes.error;
                return {
                    ...orderRes.data,
                    items: itemsRes.data ?? [],
                    status_history: historyRes.data ?? [],
                } as StoreOrderDetail;
            })
        );
    }

    // ─── Status Management ─────────────────────────────────────────────────────

    async updateStatus(orderId: string, newStatus: OrderStatus, notes?: string): Promise<void> {
        const { error: updateError } = await this.supabase
            .from('orders')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', orderId);
        if (updateError) throw updateError;

        const { error: historyError } = await this.supabase
            .from('order_status_history')
            .insert({ order_id: orderId, status: newStatus, notes: notes ?? null });
        if (historyError) throw historyError;
    }

    async rejectOrder(orderId: string, reason: string): Promise<void> {
        const { error: updateError } = await this.supabase
            .from('orders')
            .update({
                status: 'cancelado',
                updated_at: new Date().toISOString(),
                cancelled_by: 'comercio',
            })
            .eq('id', orderId);
        if (updateError) throw updateError;

        const { error: historyError } = await this.supabase
            .from('order_status_history')
            .insert({ order_id: orderId, status: 'cancelado', notes: reason });
        if (historyError) throw historyError;
    }

    nextStatus(current: OrderStatus): OrderStatus | null {
        const idx = STATUS_SEQUENCE.indexOf(current);
        if (idx === -1 || idx >= STATUS_SEQUENCE.length - 1) return null;
        return STATUS_SEQUENCE[idx + 1];
    }

    // ─── Realtime subscription ─────────────────────────────────────────────────

    subscribeToNewOrders(
        storeId: string,
        onNew: (order: { order_number: string; total: number }) => void,
    ) {
        const channel = this.supabase
            .channel(`store-orders-${storeId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'orders',
                    filter: `commerce_id=eq.${storeId}`,
                },
                (payload: any) => {
                    const order = payload.new as { order_number: string; total: number };
                    onNew(order);
                },
            )
            .subscribe();

        this.realtimeChannel.set(channel);
        return channel;
    }

    unsubscribe() {
        const ch = this.realtimeChannel();
        if (ch) {
            this.supabase.removeChannel(ch);
            this.realtimeChannel.set(null);
        }
    }
}
