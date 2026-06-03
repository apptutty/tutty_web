import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import {
    ExcursionOperator, Excursion, ExcursionDate, Booking, BookingDetail, BookingStatus,
} from '../../core/supabase/database.types';

@Injectable({ providedIn: 'root' })
export class ExcursionsService {
    private readonly supabase = getSupabaseClient();

    // Operators
    getOperators(): Observable<ExcursionOperator[]> {
        return from(
            this.supabase.from('excursion_operators').select('*').order('name')
                .then(({ data }) => (data ?? []) as ExcursionOperator[])
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

    // Excursions
    getExcursions(operatorId?: string): Observable<any[]> {
        return from(
            (async () => {
                let q = this.supabase.from('excursions').select('*, operator:excursion_operators(name)');
                if (operatorId) q = q.eq('operator_id', operatorId);
                const { data } = await q.order('name');
                return (data ?? []).map((e: any) => ({ ...e, operator_name: e.operator?.name ?? '—' }));
            })()
        );
    }

    async saveExcursion(data: Partial<Excursion>): Promise<void> {
        if (data.id) {
            const { error } = await this.supabase.from('excursions').update(data).eq('id', data.id);
            if (error) throw error;
        } else {
            const { error } = await this.supabase.from('excursions').insert(data);
            if (error) throw error;
        }
    }

    // Dates
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

    // Bookings
    getBookings(filters: { status?: BookingStatus; excursion_id?: string } = {}): Observable<any[]> {
        return from(
            (async () => {
                let q = this.supabase.from('bookings').select(`
          *,
          excursion:excursions(name, operator:excursion_operators(name)),
          excursion_date:excursion_dates(date, departure_time),
          customer:users(full_name, phone)
        `).order('created_at', { ascending: false });
                if (filters.status) q = q.eq('status', filters.status);
                const { data } = await q;
                return (data ?? []).map((b: any) => ({
                    ...b,
                    excursion_name: b.excursion?.name ?? '—',
                    operator_name: b.excursion?.operator?.name ?? '—',
                    customer_name: b.customer?.full_name ?? '—',
                    excursion_date_str: b.excursion_date?.date ?? '—',
                }));
            })()
        );
    }

    getBookingById(id: string): Observable<BookingDetail> {
        return from(
            this.supabase.from('bookings').select(`
        *,
        excursion:excursions(id, name, operator:excursion_operators(name)),
        excursion_date:excursion_dates(date, departure_time),
        customer:users(full_name, phone),
        participants:booking_participants(*)
      `).eq('id', id).single()
                .then(({ data, error }) => {
                    if (error) throw error;
                    return data as BookingDetail;
                })
        );
    }

    async updateBookingStatus(id: string, status: BookingStatus): Promise<void> {
        const { error } = await this.supabase.from('bookings').update({ status }).eq('id', id);
        if (error) throw error;
    }
}
