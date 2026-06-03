import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { getSupabaseClient } from '../../core/supabase/supabase.client';

export interface SalesByDay { date: string; total: number; orders: number; }
export interface RestaurantSales { restaurant_name: string; orders: number; revenue: number; commission: number; }
export interface TopProduct { product_name: string; restaurant_name: string; quantity: number; revenue: number; }
export interface CourierPerformance { full_name: string; deliveries: number; avg_rating: number; avg_time_minutes: number; total_earnings: number; }

@Injectable({ providedIn: 'root' })
export class ReportsService {
    private supabase = getSupabaseClient();

    salesByDay(from_date: string, to_date: string): Observable<SalesByDay[]> {
        return from(
            this.supabase
                .from('orders')
                .select('created_at, total, status')
                .eq('status', 'entregado')
                .gte('created_at', from_date)
                .lte('created_at', to_date + 'T23:59:59')
                .then(({ data, error }) => {
                    if (error) throw error;
                    const map: Record<string, SalesByDay> = {};
                    (data ?? []).forEach((o: any) => {
                        const d = o.created_at.slice(0, 10);
                        if (!map[d]) map[d] = { date: d, total: 0, orders: 0 };
                        map[d].total += Number(o.total) || 0;
                        map[d].orders += 1;
                    });
                    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
                })
        );
    }

    ordersByRestaurant(from_date: string, to_date: string): Observable<RestaurantSales[]> {
        return from(
            this.supabase
                .from('orders')
                .select('total, commission_amount, restaurants(name)')
                .eq('status', 'entregado')
                .gte('created_at', from_date)
                .lte('created_at', to_date + 'T23:59:59')
                .then(({ data, error }) => {
                    if (error) throw error;
                    const map: Record<string, RestaurantSales> = {};
                    (data ?? []).forEach((o: any) => {
                        const name = o.restaurants?.name ?? 'Sin nombre';
                        if (!map[name]) map[name] = { restaurant_name: name, orders: 0, revenue: 0, commission: 0 };
                        map[name].orders += 1;
                        map[name].revenue += Number(o.total) || 0;
                        map[name].commission += Number(o.commission_amount) || 0;
                    });
                    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
                })
        );
    }

    topProducts(from_date: string, to_date: string): Observable<TopProduct[]> {
        return from(
            this.supabase
                .from('order_items')
                .select('quantity, subtotal, menu_items(name, restaurants(name)), orders!inner(created_at, status)')
                .eq('orders.status', 'entregado')
                .gte('orders.created_at', from_date)
                .lte('orders.created_at', to_date + 'T23:59:59')
                .then(({ data, error }) => {
                    if (error) throw error;
                    const map: Record<string, TopProduct> = {};
                    (data ?? []).forEach((item: any) => {
                        const name = item.menu_items?.name ?? 'Sin nombre';
                        const rest = item.menu_items?.restaurants?.name ?? '';
                        const key = `${name}__${rest}`;
                        if (!map[key]) map[key] = { product_name: name, restaurant_name: rest, quantity: 0, revenue: 0 };
                        map[key].quantity += Number(item.quantity) || 0;
                        map[key].revenue += Number(item.subtotal) || 0;
                    });
                    return Object.values(map).sort((a, b) => b.quantity - a.quantity).slice(0, 20);
                })
        );
    }

    courierPerformance(from_date: string, to_date: string): Observable<CourierPerformance[]> {
        return from(
            this.supabase
                .from('orders')
                .select('delivery_time_minutes, repartidores(full_name, commission_rate)')
                .eq('status', 'entregado')
                .not('repartidor_id', 'is', null)
                .gte('created_at', from_date)
                .lte('created_at', to_date + 'T23:59:59')
                .then(({ data, error }) => {
                    if (error) throw error;
                    const map: Record<string, { name: string; times: number[]; total: number; count: number }> = {};
                    (data ?? []).forEach((o: any) => {
                        const name = o.repartidores?.full_name ?? 'Desconocido';
                        if (!map[name]) map[name] = { name, times: [], total: 0, count: 0 };
                        if (o.delivery_time_minutes) map[name].times.push(o.delivery_time_minutes);
                        map[name].count += 1;
                    });
                    return Object.values(map).map(r => ({
                        full_name: r.name,
                        deliveries: r.count,
                        avg_rating: 0,
                        avg_time_minutes: r.times.length ? Math.round(r.times.reduce((a, b) => a + b, 0) / r.times.length) : 0,
                        total_earnings: 0,
                    })).sort((a, b) => b.deliveries - a.deliveries) as CourierPerformance[];
                })
        );
    }

    cancellationRate(from_date: string, to_date: string): Observable<{ total: number; cancelled: number; rate: number }> {
        return from(
            this.supabase
                .from('orders')
                .select('status')
                .gte('created_at', from_date)
                .lte('created_at', to_date + 'T23:59:59')
                .then(({ data, error }) => {
                    if (error) throw error;
                    const total = data?.length ?? 0;
                    const cancelled = data?.filter((o: any) => o.status === 'cancelado').length ?? 0;
                    return { total, cancelled, rate: total > 0 ? Math.round((cancelled / total) * 100 * 10) / 10 : 0 };
                })
        );
    }
}
