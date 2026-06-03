import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { getSupabaseClient } from '../../core/supabase/supabase.client';

export interface SalesByDay { date: string; total: number; orders: number; }
export interface RestaurantSales { restaurant_name: string; orders: number; revenue: number; commission: number; }
export interface TopProduct { product_name: string; restaurant_name: string; quantity: number; revenue: number; }
export interface CourierPerformance { full_name: string; deliveries: number; avg_rating: number; avg_time_minutes: number; total_earnings: number; }

// SA-7.1 types
export interface CommerceTypeRow {
    commerce_type: string;
    active_stores: number;
    orders: number;
    revenue: number;
    commission: number;
    avg_ticket: number;
}

export interface CustomerRetention {
    new_customers: number;
    returning_customers: number;
    total_customers: number;
    repeat_rate: number;
    ltv: number;
}

export interface TopCustomer {
    user_id: string;
    name: string;
    order_count: number;
    total_spent: number;
    last_order: string;
}

export interface PromoEffectiveness {
    promo_id: string;
    promo_name: string;
    uses: number;
    discount_total: number;
    revenue_generated: number;
    roi: number;
}

export interface SurchargeDay {
    date: string;
    weather_extra: number;
    peak_extra: number;
    night_extra: number;
    holiday_extra: number;
    total_surcharge: number;
    count: number;
}

export interface SurchargeTotals {
    weather: number;
    peak: number;
    night: number;
    holiday: number;
    surge: number;
    total: number;
}

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

    // ── SA-7.1 new methods ────────────────────────────────────────────────

    commerceTypeComparison(from_date: string, to_date: string): Observable<CommerceTypeRow[]> {
        return from(this.fetchCommerceTypeComparison(from_date, to_date));
    }

    private async fetchCommerceTypeComparison(from_date: string, to_date: string): Promise<CommerceTypeRow[]> {
        const { data: orders, error: oErr } = await this.supabase
            .from('orders')
            .select('subtotal, commission_amount, restaurants!inner(commerce_type)')
            .eq('status', 'entregado')
            .gte('created_at', from_date)
            .lte('created_at', to_date + 'T23:59:59');
        if (oErr) throw oErr;

        const { data: stores, error: sErr } = await this.supabase
            .from('restaurants')
            .select('commerce_type')
            .eq('is_active', true);
        if (sErr) throw sErr;

        const storeCount: Record<string, number> = {};
        (stores ?? []).forEach((s: any) => {
            const ct = s.commerce_type ?? 'otro';
            storeCount[ct] = (storeCount[ct] ?? 0) + 1;
        });

        const map: Record<string, { orders: number; revenue: number; commission: number }> = {};
        (orders ?? []).forEach((o: any) => {
            const ct: string = (o.restaurants as any)?.commerce_type ?? 'otro';
            if (!map[ct]) map[ct] = { orders: 0, revenue: 0, commission: 0 };
            map[ct].orders += 1;
            map[ct].revenue += Number(o.subtotal) || 0;
            map[ct].commission += Number(o.commission_amount) || 0;
        });

        return Object.entries(map).map(([ct, d]) => ({
            commerce_type: ct,
            active_stores: storeCount[ct] ?? 0,
            orders: d.orders,
            revenue: d.revenue,
            commission: d.commission,
            avg_ticket: d.orders > 0 ? Math.round(d.revenue / d.orders) : 0,
        })).sort((a, b) => b.revenue - a.revenue);
    }

    customerRetention(from_date: string, to_date: string): Observable<{ summary: CustomerRetention; topCustomers: TopCustomer[]; inactive: TopCustomer[] }> {
        return from(this.fetchCustomerRetention(from_date, to_date));
    }

    private async fetchCustomerRetention(from_date: string, to_date: string): Promise<{ summary: CustomerRetention; topCustomers: TopCustomer[]; inactive: TopCustomer[] }> {
        const { data, error } = await this.supabase
            .from('orders')
            .select('user_id, total, created_at, users(full_name)')
            .eq('status', 'entregado')
            .gte('created_at', from_date)
            .lte('created_at', to_date + 'T23:59:59');
        if (error) throw error;

        const map: Record<string, { name: string; count: number; spent: number; last: string }> = {};
        (data ?? []).forEach((o: any) => {
            const uid: string = o.user_id ?? 'unknown';
            const name: string = (o.users as any)?.full_name ?? uid;
            if (!map[uid]) map[uid] = { name, count: 0, spent: 0, last: '' };
            map[uid].count += 1;
            map[uid].spent += Number(o.total) || 0;
            if (o.created_at > map[uid].last) map[uid].last = o.created_at;
        });

        const customers = Object.entries(map).map(([id, v]) => ({
            user_id: id, name: v.name, order_count: v.count, total_spent: v.spent, last_order: v.last,
        }));

        const returning = customers.filter(c => c.order_count > 1).length;
        const totalRevenue = customers.reduce((s, c) => s + c.total_spent, 0);
        const cutoff = new Date(from_date);
        cutoff.setDate(cutoff.getDate() - 30);
        const inactiveCutoff = cutoff.toISOString();

        return {
            summary: {
                new_customers: customers.filter(c => c.order_count === 1).length,
                returning_customers: returning,
                total_customers: customers.length,
                repeat_rate: customers.length > 0 ? Math.round((returning / customers.length) * 100) : 0,
                ltv: customers.length > 0 ? Math.round(totalRevenue / customers.length) : 0,
            },
            topCustomers: [...customers].sort((a, b) => b.order_count - a.order_count).slice(0, 20),
            inactive: customers.filter(c => c.last_order < inactiveCutoff).sort((a, b) => a.last_order.localeCompare(b.last_order)).slice(0, 30),
        };
    }

    promoEffectiveness(from_date: string, to_date: string): Observable<PromoEffectiveness[]> {
        return from(this.fetchPromoEffectiveness(from_date, to_date));
    }

    private async fetchPromoEffectiveness(from_date: string, to_date: string): Promise<PromoEffectiveness[]> {
        const { data, error } = await this.supabase
            .from('promo_uses')
            .select('promotion_id, discount_applied, promotions(name), orders!inner(total, status, created_at)')
            .eq('orders.status', 'entregado')
            .gte('orders.created_at', from_date)
            .lte('orders.created_at', to_date + 'T23:59:59');
        if (error) throw error;

        const map: Record<string, { name: string; uses: number; discountTotal: number; revenueTotal: number }> = {};
        (data ?? []).forEach((r: any) => {
            const pid: string = r.promotion_id;
            const name: string = r.promotions?.name ?? pid;
            if (!map[pid]) map[pid] = { name, uses: 0, discountTotal: 0, revenueTotal: 0 };
            map[pid].uses += 1;
            map[pid].discountTotal += Number(r.discount_applied) || 0;
            map[pid].revenueTotal += Number(r.orders?.total) || 0;
        });

        return Object.entries(map).map(([id, v]) => ({
            promo_id: id,
            promo_name: v.name,
            uses: v.uses,
            discount_total: v.discountTotal,
            revenue_generated: v.revenueTotal,
            roi: v.discountTotal > 0 ? Math.round((v.revenueTotal / v.discountTotal) * 10) / 10 : 0,
        })).sort((a, b) => b.revenue_generated - a.revenue_generated);
    }

    surchargeReport(from_date: string, to_date: string): Observable<{ daily: SurchargeDay[]; totals: SurchargeTotals }> {
        return from(this.fetchSurchargeReport(from_date, to_date));
    }

    private async fetchSurchargeReport(from_date: string, to_date: string): Promise<{ daily: SurchargeDay[]; totals: SurchargeTotals }> {
        const { data, error } = await this.supabase
            .from('delivery_surcharge_log')
            .select('applied_at, surcharge_type, extra_amount')
            .gte('applied_at', from_date)
            .lte('applied_at', to_date + 'T23:59:59')
            .order('applied_at');
        if (error) throw error;

        const dayMap: Record<string, SurchargeDay> = {};
        const totals: SurchargeTotals = { weather: 0, peak: 0, night: 0, holiday: 0, surge: 0, total: 0 };

        (data ?? []).forEach((r: any) => {
            const day: string = (r.applied_at as string).slice(0, 10);
            if (!dayMap[day]) dayMap[day] = { date: day, weather_extra: 0, peak_extra: 0, night_extra: 0, holiday_extra: 0, total_surcharge: 0, count: 0 };
            const amt = Number(r.extra_amount) || 0;
            const type: string = r.surcharge_type ?? '';
            if (type.includes('weather') || type.includes('clima') || type.includes('rain')) {
                dayMap[day].weather_extra += amt; totals.weather += amt;
            } else if (type.includes('peak') || type.includes('pico')) {
                dayMap[day].peak_extra += amt; totals.peak += amt;
            } else if (type.includes('night') || type.includes('nocturno')) {
                dayMap[day].night_extra += amt; totals.night += amt;
            } else if (type.includes('holiday') || type.includes('feriado')) {
                dayMap[day].holiday_extra += amt; totals.holiday += amt;
            } else {
                totals.surge += amt;
            }
            dayMap[day].total_surcharge += amt;
            dayMap[day].count += 1;
            totals.total += amt;
        });

        return { daily: Object.values(dayMap), totals };
    }
}
