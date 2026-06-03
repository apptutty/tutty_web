import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import {
    Restaurant, MenuItem, MenuCategory, DeliveryZone,
    ApprovalStatus, CommissionTier, CommerceType,
    StoreFinanceKpi, StoreOrderSummary, StoreApprovalHistory,
} from '../../core/supabase/database.types';

export interface StoreFilters {
    search?: string;
    commerce_type?: CommerceType | '';
    approval_status?: ApprovalStatus | '';
    open_status?: 'open' | 'closed' | '';
}

@Injectable({ providedIn: 'root' })
export class StoresService {
    private readonly supabase = getSupabaseClient();

    getStores(filters: StoreFilters = {}): Observable<Restaurant[]> {
        return from(this.fetchStores(filters));
    }

    private async fetchStores(filters: StoreFilters): Promise<Restaurant[]> {
        let query = this.supabase
            .from('restaurants')
            .select(`
                *,
                restaurant_admins(
                    user:users(full_name, email)
                )
            `)
            .order('name');

        if (filters.commerce_type) query = query.eq('commerce_type', filters.commerce_type);
        if (filters.approval_status) query = query.eq('approval_status', filters.approval_status);
        if (filters.open_status === 'open') query = query.eq('is_open', true);
        if (filters.open_status === 'closed') query = query.eq('is_open', false);
        if (filters.search) query = query.or(`name.ilike.%${filters.search}%,slug.ilike.%${filters.search}%`);

        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []).map((r: any) => ({
            ...r,
            admin_name: r.restaurant_admins?.[0]?.user?.full_name ?? null,
            admin_email: r.restaurant_admins?.[0]?.user?.email ?? null,
        })) as Restaurant[];
    }

    getStoreById(id: string): Observable<Restaurant> {
        return from(
            this.supabase.from('restaurants')
                .select(`*, restaurant_admins(user:users(full_name, email, phone))`)
                .eq('id', id).single()
                .then(({ data, error }) => {
                    if (error) throw error;
                    const raw = data as any;
                    return {
                        ...raw,
                        admin_name: raw.restaurant_admins?.[0]?.user?.full_name ?? null,
                        admin_email: raw.restaurant_admins?.[0]?.user?.email ?? null,
                        admin_phone: raw.restaurant_admins?.[0]?.user?.phone ?? null,
                    } as Restaurant;
                })
        );
    }

    async saveStore(data: Partial<Restaurant>): Promise<Restaurant> {
        if (data.id) {
            const { data: res, error } = await this.supabase
                .from('restaurants').update(data).eq('id', data.id).select().single();
            if (error) throw error;
            return res as Restaurant;
        } else {
            const { data: res, error } = await this.supabase
                .from('restaurants').insert(data).select().single();
            if (error) throw error;
            return res as Restaurant;
        }
    }

    async toggleOpen(id: string, isOpen: boolean): Promise<void> {
        const { error } = await this.supabase.from('restaurants').update({ is_open: isOpen }).eq('id', id);
        if (error) throw error;
    }

    async toggleActive(id: string, isActive: boolean): Promise<void> {
        const { error } = await this.supabase.from('restaurants').update({ is_active: isActive }).eq('id', id);
        if (error) throw error;
    }

    async updateApproval(id: string, status: ApprovalStatus, notes?: string): Promise<void> {
        const payload: any = { approval_status: status };
        if (status === 'aprobado') payload.approved_at = new Date().toISOString();
        if (notes) payload.rejection_reason = notes;
        const { error } = await this.supabase.from('restaurants').update(payload).eq('id', id);
        if (error) throw error;
    }

    async updateCommission(id: string, rate: number, tier: CommissionTier): Promise<void> {
        const { error } = await this.supabase.from('restaurants')
            .update({ commission_rate: rate, commission_tier: tier }).eq('id', id);
        if (error) throw error;
    }

    async deleteStore(id: string): Promise<void> {
        const { error } = await this.supabase.from('restaurants').delete().eq('id', id);
        if (error) throw error;
    }

    // ── Catalog ──────────────────────────────────────────────────────────────

    getCategories(restaurantId: string): Observable<MenuCategory[]> {
        return from(
            this.supabase.from('menu_categories').select('*')
                .eq('restaurant_id', restaurantId).order('display_order')
                .then(({ data }) => (data ?? []) as MenuCategory[])
        );
    }

    getMenuItems(restaurantId: string): Observable<MenuItem[]> {
        return from(
            this.supabase.from('menu_items').select('*')
                .eq('restaurant_id', restaurantId).order('display_order')
                .then(({ data }) => (data ?? []) as MenuItem[])
        );
    }

    async saveMenuItem(item: Partial<MenuItem>): Promise<void> {
        if (item.id) {
            const { error } = await this.supabase.from('menu_items').update(item).eq('id', item.id);
            if (error) throw error;
        } else {
            const { error } = await this.supabase.from('menu_items').insert(item);
            if (error) throw error;
        }
    }

    async updateItemModeration(id: string, patch: Partial<MenuItem>): Promise<void> {
        const { error } = await this.supabase.from('menu_items').update(patch).eq('id', id);
        if (error) throw error;
    }

    // ── Finance KPIs ─────────────────────────────────────────────────────────

    getFinanceKpi(restaurantId: string, fromDate: string, toDate: string): Observable<StoreFinanceKpi> {
        return from(this.fetchFinanceKpi(restaurantId, fromDate, toDate));
    }

    private async fetchFinanceKpi(restaurantId: string, fromDate: string, toDate: string): Promise<StoreFinanceKpi> {
        const { data, error } = await this.supabase.from('orders')
            .select('subtotal, commission_amount, delivery_fee, status, created_at')
            .eq('restaurant_id', restaurantId)
            .in('status', ['entregado'])
            .gte('created_at', fromDate)
            .lte('created_at', toDate);
        if (error) throw error;
        const rows = data ?? [];
        const totalOrders = rows.length;
        const grossSales = rows.reduce((s: number, r: any) => s + (r.subtotal ?? 0), 0);
        const commission = rows.reduce((s: number, r: any) => s + (r.commission_amount ?? 0), 0);
        const deliveryFees = rows.reduce((s: number, r: any) => s + (r.delivery_fee ?? 0), 0);
        return { totalOrders, grossSales, commission, deliveryFees, netPayout: grossSales - commission };
    }

    getOrderSummaries(restaurantId: string, fromDate: string, toDate: string): Observable<StoreOrderSummary[]> {
        return from(
            this.supabase.from('orders')
                .select('id, order_number, subtotal, commission_amount, delivery_fee, total, status, created_at')
                .eq('restaurant_id', restaurantId)
                .eq('status', 'entregado')
                .gte('created_at', fromDate)
                .lte('created_at', toDate)
                .order('created_at', { ascending: false })
                .then(({ data }) => (data ?? []) as StoreOrderSummary[])
        );
    }

    getTodayStats(restaurantId: string): Observable<{ orders: number; revenue: number }> {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        const startOfTomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
        return from(
            this.supabase.from('orders')
                .select('subtotal, status')
                .eq('restaurant_id', restaurantId)
                .gte('created_at', startOfDay)
                .lt('created_at', startOfTomorrow)
                .then(({ data }) => {
                    const rows = data ?? [];
                    return {
                        orders: rows.length,
                        revenue: rows.filter((r: any) => r.status === 'entregado')
                            .reduce((s: number, r: any) => s + (r.subtotal ?? 0), 0),
                    };
                })
        );
    }

    // ── Approval History (from order_status_history pattern) ─────────────────

    getApprovalHistory(restaurantId: string): Observable<StoreApprovalHistory[]> {
        // Stored in a dedicated audit log or derived from field changes
        // Using a simple query on the restaurant's approval fields as placeholder
        return from(
            this.supabase.from('restaurants')
                .select('approval_status, approved_at, approved_by, rejection_reason, submitted_at')
                .eq('id', restaurantId)
                .then(({ data }) => {
                    const r = data?.[0] as any;
                    if (!r) return [] as StoreApprovalHistory[];
                    const events: StoreApprovalHistory[] = [];
                    if (r.submitted_at) events.push({ date: r.submitted_at, event: 'Solicitud enviada', status: 'pendiente', by: 'Comercio' });
                    if (r.approved_at) events.push({ date: r.approved_at, event: r.approval_status === 'aprobado' ? 'Aprobado' : 'Rechazado', status: r.approval_status, by: r.approved_by ?? 'Admin', notes: r.rejection_reason });
                    return events;
                })
        );
    }
}
