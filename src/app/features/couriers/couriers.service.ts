import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import {
  Courier, DriverStats, RepartidorWallet, WalletTransaction,
  RepartidorBankAccount, RepartidorAbsence, RepartidorSanction,
  RepartidorSession, DriverLocationHistory,
} from '../../core/supabase/database.types';

@Injectable({ providedIn: 'root' })
export class CouriersService {
    private readonly supabase = getSupabaseClient();

    async resolveCourierDocumentUrl(value: string | null | undefined): Promise<string | null> {
        if (!value || !value.trim()) return null;
        if (/^https?:\/\//i.test(value)) return value;

        const normalizedPath = value
            .replace(/^\/+/, '')
            .replace(/^repartidor-docs\//, '');

        const { data, error } = await this.supabase
            .storage
            .from('repartidor-docs')
            .createSignedUrl(normalizedPath, 60 * 60);

        if (error || !data?.signedUrl) return null;
        return data.signedUrl;
    }

    getDriverStats(): Observable<DriverStats> {
        return from((async () => {
            const { data } = await this.supabase.from('repartidores').select('is_available, approval_status, photo_url, cedula_photo_url, vehicle_photo_url, license_photo_url, total_deliveries, total_earnings, avg_rating, last_location_at');
            const list = data ?? [];
            const now = Date.now();
            const recentThreshold = 30 * 60 * 1000; // 30 minutes
            const stats: DriverStats = {
                total: list.length,
                pending: list.filter((r: any) => r.approval_status === 'pendiente').length,
                approved: list.filter((r: any) => r.approval_status === 'aprobado').length,
                available: list.filter((r: any) => r.is_available).length,
                unavailable: list.filter((r: any) => !r.is_available).length,
                suspended: list.filter((r: any) => r.approval_status === 'suspendido' || r.approval_status === 'rechazado').length,
                totalDeliveries: list.reduce((s: number, r: any) => s + (r.total_deliveries ?? 0), 0),
                totalEarnings: list.reduce((s: number, r: any) => s + (r.total_earnings ?? 0), 0),
                avgRating: list.length ? list.reduce((s: number, r: any) => s + (r.avg_rating ?? 0), 0) / list.length : 0,
                missingDocs: list.filter((r: any) => !r.photo_url || !r.cedula_photo_url || !r.vehicle_photo_url || !r.license_photo_url).length,
                onlineRecently: list.filter((r: any) => r.last_location_at && (now - new Date(r.last_location_at).getTime()) < recentThreshold).length,
            };
            return stats;
        })());
    }

    getCouriers(filters: { available?: boolean; approvalStatus?: string; vehicleType?: string } = {}): Observable<Courier[]> {
        return from(
            (async () => {
                let q = this.supabase.from('repartidores')
                    .select('*, user:users!repartidores_user_id_fkey(full_name, phone, email, avatar_url)');
                if (filters.available !== undefined) q = (q as any).eq('is_available', filters.available);
                if (filters.approvalStatus) q = (q as any).eq('approval_status', filters.approvalStatus);
                if (filters.vehicleType) q = (q as any).eq('vehicle_type', filters.vehicleType);
                const { data, error } = await (q as any).order('id', { ascending: false });
                if (error) throw error;
                return (data ?? []).map((r: any) => ({
                    ...r,
                    full_name: r.user?.full_name ?? '—',
                    phone: r.user?.phone ?? '—',
                    email: r.user?.email ?? '—',
                    avatar_url: r.user?.avatar_url ?? null,
                })) as Courier[];
            })()
        );
    }

    getCourierById(id: string): Observable<Courier> {
        return from(
            this.supabase.from('repartidores')
                .select('*, user:users!repartidores_user_id_fkey(full_name, phone, email, avatar_url)')
                .eq('id', id).single()
                .then(({ data, error }) => {
                    if (error) throw error;
                    return {
                        ...data,
                        full_name: (data as any).user?.full_name ?? '—',
                        phone: (data as any).user?.phone ?? '—',
                        email: (data as any).user?.email ?? '—',
                        avatar_url: (data as any).user?.avatar_url ?? null,
                    } as Courier;
                })
        );
    }

    async approveDriver(id: string, adminId: string): Promise<void> {
        const { error } = await this.supabase.from('repartidores').update({
            approval_status: 'aprobado',
            approved_by: adminId,
            hire_date: new Date().toISOString().split('T')[0],
        } as any).eq('id', id);
        if (error) throw error;
    }

    async rejectDriver(id: string, reason?: string): Promise<void> {
        const { error } = await this.supabase.from('repartidores').update({
            approval_status: 'rechazado',
            termination_reason: reason ?? null,
        } as any).eq('id', id);
        if (error) throw error;
    }

    async suspendDriver(id: string, reason?: string): Promise<void> {
        const { error } = await this.supabase.from('repartidores').update({
            approval_status: 'suspendido',
            termination_reason: reason ?? null,
        } as any).eq('id', id);
        if (error) throw error;
    }

    async saveCourier(data: Partial<Courier>): Promise<void> {
        if (data.id) {
            const { error } = await this.supabase.from('repartidores').update(data as any).eq('id', data.id);
            if (error) throw error;
        } else {
            const { error } = await this.supabase.from('repartidores').insert(data as any);
            if (error) throw error;
        }
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
                .limit(20)
                .then(({ data }) => (data ?? []).map((r: any) => ({
                    ...r,
                    customer_name: r.customer?.full_name ?? '—',
                })))
        );
    }

    getDriverWallet(courierId: string): Observable<RepartidorWallet | null> {
        return from(
            this.supabase.from('repartidor_wallets')
                .select('*')
                .eq('repartidor_id', courierId)
                .maybeSingle()
                .then(({ data }) => data as RepartidorWallet | null)
        );
    }

    getWalletTransactions(walletId: string, limit = 30): Observable<WalletTransaction[]> {
        return from(
            this.supabase.from('wallet_transactions')
                .select('*')
                .eq('wallet_id', walletId)
                .order('created_at', { ascending: false })
                .limit(limit)
                .then(({ data }) => (data ?? []) as WalletTransaction[])
        );
    }

    getDriverBankAccounts(courierId: string): Observable<RepartidorBankAccount[]> {
        return from(
            this.supabase.from('repartidor_bank_accounts')
                .select('*')
                .eq('repartidor_id', courierId)
                .order('created_at', { ascending: false })
                .then(({ data }) => (data ?? []) as RepartidorBankAccount[])
        );
    }

    getDriverSessions(courierId: string): Observable<RepartidorSession[]> {
        return from(
            this.supabase.from('repartidor_sessions')
                .select('*')
                .eq('repartidor_id', courierId)
                .order('created_at', { ascending: false })
                .limit(30)
                .then(({ data }) => (data ?? []) as RepartidorSession[])
        );
    }

    getDriverZones(courierId: string): Observable<any[]> {
        return from(
            this.supabase.from('repartidor_zones')
                .select('*, zone:delivery_zones(*)')
                .eq('repartidor_id', courierId)
                .then(({ data }) => data ?? [])
        );
    }

    async assignDriverZone(courierId: string, zoneId: string): Promise<void> {
        const { error } = await this.supabase.from('repartidor_zones').insert({ repartidor_id: courierId, zone_id: zoneId } as any);
        if (error) throw error;
    }

    async removeDriverZone(courierId: string, zoneId: string): Promise<void> {
        const { error } = await this.supabase.from('repartidor_zones').delete().eq('repartidor_id', courierId).eq('zone_id', zoneId);
        if (error) throw error;
    }

    getDriverAbsences(courierId: string): Observable<RepartidorAbsence[]> {
        return from(
            this.supabase.from('repartidor_absences')
                .select('*')
                .eq('repartidor_id', courierId)
                .order('date', { ascending: false })
                .then(({ data }) => (data ?? []) as RepartidorAbsence[])
        );
    }

    async createDriverAbsence(payload: Omit<RepartidorAbsence, 'id' | 'created_at'>): Promise<void> {
        const { error } = await this.supabase.from('repartidor_absences').insert(payload as any);
        if (error) throw error;
    }

    async deleteDriverAbsence(id: string): Promise<void> {
        const { error } = await this.supabase.from('repartidor_absences').delete().eq('id', id);
        if (error) throw error;
    }

    getDriverSanctions(courierId: string): Observable<RepartidorSanction[]> {
        return from(
            this.supabase.from('repartidor_sanctions')
                .select('*')
                .eq('repartidor_id', courierId)
                .order('created_at', { ascending: false })
                .then(({ data }) => (data ?? []) as RepartidorSanction[])
        );
    }

    async createDriverSanction(payload: Omit<RepartidorSanction, 'id' | 'created_at'>): Promise<void> {
        const { error } = await this.supabase.from('repartidor_sanctions').insert(payload as any);
        if (error) throw error;
    }

    getDriverLocationHistory(courierId: string, limit = 50): Observable<DriverLocationHistory[]> {
        return from(
            this.supabase.from('driver_location_history')
                .select('*')
                .eq('repartidor_id', courierId)
                .order('recorded_at', { ascending: false })
                .limit(limit)
                .then(({ data }) => (data ?? []) as DriverLocationHistory[])
        );
    }
}
