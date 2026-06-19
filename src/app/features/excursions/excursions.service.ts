import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import {
    ExcursionOperator, ExcursionOperatorAdmin, Excursion, ExcursionDate,
    Booking, BookingDetail, BookingStatus, ExcursionCategoryAdmin, ExcursionStats,
} from '../../core/supabase/database.types';

@Injectable({ providedIn: 'root' })
export class ExcursionsService {
    private readonly supabase = getSupabaseClient();

    // ── Stats ──────────────────────────────────────────────────────────────────
    getExcursionStats(): Observable<ExcursionStats> {
        return from((async () => {
            const [opRes, excRes, bookRes, datesRes] = await Promise.all([
                this.supabase.from('excursion_operators').select('approval_status'),
                this.supabase.from('excursions').select('is_active'),
                this.supabase.from('bookings').select('status, total'),
                this.supabase.from('excursion_dates').select('date, spots_left, total_spots, is_active'),
            ]);
            const ops = opRes.data ?? [];
            const excs = excRes.data ?? [];
            const bks = bookRes.data ?? [];
            const today = new Date().toISOString().split('T')[0];
            const dates = datesRes.data ?? [];
            return {
                totalOperators: ops.length,
                pendingOperators: ops.filter((o: any) => o.approval_status === 'pendiente').length,
                approvedOperators: ops.filter((o: any) => o.approval_status === 'aprobado').length,
                totalExcursions: excs.length,
                activeExcursions: excs.filter((e: any) => e.is_active).length,
                totalBookings: bks.length,
                pendingBookings: bks.filter((b: any) => b.status === 'pendiente').length,
                confirmedBookings: bks.filter((b: any) => b.status === 'confirmada').length,
                cancelledBookings: bks.filter((b: any) => b.status === 'cancelada').length,
                completedBookings: bks.filter((b: any) => b.status === 'completada').length,
                totalRevenue: bks.filter((b: any) => b.status === 'confirmada' || b.status === 'completada').reduce((s: number, b: any) => s + (b.total ?? 0), 0),
                upcomingDepartures: dates.filter((d: any) => d.date >= today && d.is_active).length,
                lowSpotsCount: dates.filter((d: any) => d.date >= today && d.is_active && d.total_spots > 0 && d.spots_left / d.total_spots <= 0.2).length,
            } as ExcursionStats;
        })());
    }

    // ── Categories ─────────────────────────────────────────────────────────────
    getCategories(): Observable<ExcursionCategoryAdmin[]> {
        return from(
            this.supabase.from('excursion_categories').select('*').order('display_order')
                .then(({ data }) => (data ?? []) as ExcursionCategoryAdmin[])
        );
    }

    async saveCategory(data: Partial<ExcursionCategoryAdmin>): Promise<void> {
        if (data.id) {
            const { error } = await this.supabase.from('excursion_categories').update(data).eq('id', data.id);
            if (error) throw error;
        } else {
            const { error } = await this.supabase.from('excursion_categories').insert(data);
            if (error) throw error;
        }
    }

    async deleteCategory(id: string): Promise<void> {
        const { error } = await this.supabase.from('excursion_categories').delete().eq('id', id);
        if (error) throw error;
    }

    // ── Operators ──────────────────────────────────────────────────────────────
    getOperators(filters: { approvalStatus?: string } = {}): Observable<ExcursionOperator[]> {
        return from(
            (async () => {
                let q = this.supabase.from('excursion_operators').select('*');
                if (filters.approvalStatus) q = (q as any).eq('approval_status', filters.approvalStatus);
                const { data } = await (q as any).order('name');
                return (data ?? []) as ExcursionOperator[];
            })()
        );
    }

    getOperatorById(id: string): Observable<ExcursionOperator> {
        return from(
            this.supabase.from('excursion_operators').select('*').eq('id', id).single()
                .then(({ data, error }) => {
                    if (error) throw error;
                    return data as ExcursionOperator;
                })
        );
    }

    async saveOperator(data: Partial<ExcursionOperator>): Promise<void> {
        if (data.id) {
            const { error } = await this.supabase.from('excursion_operators').update(data).eq('id', data.id);
            if (error) throw error;
        } else {
            const { error } = await this.supabase.from('excursion_operators').insert(data);
            if (error) throw error;
        }
    }

    async approveOperator(id: string): Promise<void> {
        const { error } = await this.supabase.from('excursion_operators').update({ approval_status: 'aprobado', is_active: true } as any).eq('id', id);
        if (error) throw error;
    }

    async rejectOperator(id: string, reason?: string): Promise<void> {
        const { error } = await this.supabase.from('excursion_operators').update({ approval_status: 'rechazado' } as any).eq('id', id);
        if (error) throw error;
    }

    // ── Operator Admins ────────────────────────────────────────────────────────
    listOperatorAdmins(operatorId: string): Observable<ExcursionOperatorAdmin[]> {
        return from(
            this.supabase.from('excursion_operator_admins')
                .select('*, user:users(full_name, email, phone)')
                .eq('operator_id', operatorId)
                .then(({ data }) => (data ?? []).map((a: any) => ({
                    ...a,
                    full_name: a.user?.full_name ?? '—',
                    email: a.user?.email ?? '—',
                    phone: a.user?.phone ?? '—',
                })) as ExcursionOperatorAdmin[])
        );
    }

    async addOperatorAdmin(operatorId: string, userId: string): Promise<void> {
        const { error } = await this.supabase.from('excursion_operator_admins').insert({ operator_id: operatorId, user_id: userId } as any);
        if (error) throw error;
    }

    async removeOperatorAdmin(id: string): Promise<void> {
        const { error } = await this.supabase.from('excursion_operator_admins').delete().eq('id', id);
        if (error) throw error;
    }

    // ── Excursions ─────────────────────────────────────────────────────────────
    getExcursions(filters: { operatorId?: string; isActive?: boolean } = {}): Observable<any[]> {
        return from(
            (async () => {
                let q = this.supabase.from('excursions').select('*, operator:excursion_operators(name), category:excursion_categories(name)');
                if (filters.operatorId) q = (q as any).eq('operator_id', filters.operatorId);
                if (filters.isActive !== undefined) q = (q as any).eq('is_active', filters.isActive);
                const { data } = await (q as any).order('name');
                return (data ?? []).map((e: any) => ({
                    ...e,
                    operator_name: e.operator?.name ?? '—',
                    category_name: e.category?.name ?? '—',
                }));
            })()
        );
    }

    getExcursionById(id: string): Observable<any> {
        return from(
            this.supabase.from('excursions')
                .select('*, operator:excursion_operators(id, name), category:excursion_categories(id, name)')
                .eq('id', id).single()
                .then(({ data, error }) => {
                    if (error) throw error;
                    return { ...data, operator_name: (data as any).operator?.name ?? '—' };
                })
        );
    }

    async saveExcursion(data: Partial<Excursion>): Promise<void> {
        if (data.id) {
            const { error } = await this.supabase.from('excursions').update(data as any).eq('id', data.id);
            if (error) throw error;
        } else {
            const { error } = await this.supabase.from('excursions').insert(data as any);
            if (error) throw error;
        }
    }

    async deleteExcursion(id: string): Promise<void> {
        const { error } = await this.supabase.from('excursions').delete().eq('id', id);
        if (error) throw error;
    }

    // ── Excursion Dates ────────────────────────────────────────────────────────
    getExcursionDates(excursionId: string): Observable<ExcursionDate[]> {
        return from(
            this.supabase.from('excursion_dates').select('*').eq('excursion_id', excursionId).order('date')
                .then(({ data }) => (data ?? []) as ExcursionDate[])
        );
    }

    async addExcursionDates(excursionId: string, dates: string[], departureTime: string, totalSpots: number): Promise<void> {
        const rows = dates.map(date => ({
            excursion_id: excursionId,
            date,
            departure_time: departureTime,
            total_spots: totalSpots,
            spots_left: totalSpots,
            is_active: true,
        }));
        const { error } = await this.supabase.from('excursion_dates').insert(rows);
        if (error) throw error;
    }

    async updateExcursionDate(id: string, payload: Partial<ExcursionDate>): Promise<void> {
        const { error } = await this.supabase.from('excursion_dates').update(payload as any).eq('id', id);
        if (error) throw error;
    }

    async deleteExcursionDate(id: string): Promise<void> {
        const { error } = await this.supabase.from('excursion_dates').delete().eq('id', id);
        if (error) throw error;
    }

    // ── Bookings ───────────────────────────────────────────────────────────────
    getBookings(filters: { status?: BookingStatus; excursionId?: string; operatorId?: string; dateFrom?: string; dateTo?: string } = {}): Observable<any[]> {
        return from(
            (async () => {
                let q = this.supabase.from('bookings').select(`
                    *,
                    excursion_date:excursion_dates(date, departure_time, excursion:excursions(id, name, operator:excursion_operators(id, name))),
                    customer:users(full_name, phone)
                `).order('created_at', { ascending: false });
                if (filters.status) q = (q as any).eq('status', filters.status);
                const { data } = await (q as any);
                let result = (data ?? []).map((b: any) => ({
                    ...b,
                    excursion_name: b.excursion_date?.excursion?.name ?? '—',
                    operator_name: b.excursion_date?.excursion?.operator?.name ?? '—',
                    customer_name: b.customer?.full_name ?? '—',
                    excursion_date_str: b.excursion_date?.date ?? '—',
                }));
                if (filters.operatorId) result = result.filter((b: any) => b.excursion_date?.excursion?.operator?.id === filters.operatorId);
                if (filters.excursionId) result = result.filter((b: any) => b.excursion_date?.excursion?.id === filters.excursionId);
                if (filters.dateFrom) result = result.filter((b: any) => b.excursion_date_str >= filters.dateFrom!);
                if (filters.dateTo) result = result.filter((b: any) => b.excursion_date_str <= filters.dateTo!);
                return result;
            })()
        );
    }

    getBookingById(id: string): Observable<BookingDetail> {
        return from(
            this.supabase.from('bookings').select(`
                *,
                excursion_date:excursion_dates(date, departure_time, excursion:excursions(id, name, price_per_person, meeting_point, operator:excursion_operators(name))),
                customer:users(full_name, phone, email),
                participants:booking_participants(*)
            `).eq('id', id).single()
                .then(({ data, error }) => {
                    if (error) throw error;
                    const d = data as any;
                    return {
                        ...d,
                        excursion: d.excursion_date?.excursion ?? {},
                        excursion_name: d.excursion_date?.excursion?.name ?? '—',
                        operator_name: d.excursion_date?.excursion?.operator?.name ?? '—',
                        customer_name: d.customer?.full_name ?? '—',
                        excursion_date_str: d.excursion_date?.date ?? '—',
                    } as BookingDetail;
                })
        );
    }

    async updateBookingStatus(id: string, status: BookingStatus, metadata?: { cancellation_reason?: string; cancelled_by?: string }): Promise<void> {
        const payload: any = { status };
        if (metadata?.cancellation_reason) payload.cancellation_reason = metadata.cancellation_reason;
        if (metadata?.cancelled_by) payload.cancelled_by = metadata.cancelled_by;
        if (status === 'confirmada') payload.confirmed_at = new Date().toISOString();
        if (status === 'cancelada') payload.cancelled_at = new Date().toISOString();
        if (status === 'completada') payload.completed_at = new Date().toISOString();
        const { error } = await this.supabase.from('bookings').update(payload).eq('id', id);
        if (error) throw error;
    }

    async updateBookingRefund(id: string, refundProcessed: boolean): Promise<void> {
        const { error } = await this.supabase.from('bookings').update({ refund_processed: refundProcessed } as any).eq('id', id);
        if (error) throw error;
    }
}

