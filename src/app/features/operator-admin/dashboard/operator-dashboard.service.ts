import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { getSupabaseClient } from '../../../core/supabase/supabase.client';
import { Booking } from '../../../core/supabase/database.types';

export interface OperatorKPIs {
    confirmedBookingsMonth: number;
    revenueMonth: number;
    pendingBookings: number;
    activeExcursions: number;
    spotsThisWeek: number;
    avgRating: number;
}

export interface UpcomingDate {
    id: string;
    excursionId: string;
    excursionName: string;
    date: string;
    departureTime: string;
    spotsLeft: number;
    totalSpots: number;
    confirmedPeople: number;
}

export interface PendingBookingRow {
    id: string;
    booking_number: string | null;
    num_people: number;
    total: number;
    status: string;
    created_at: string;
    customer_name: string;
    customer_phone: string | null;
    excursion_name: string;
    excursion_date: string;
    departure_time: string;
}

export interface DashboardAlert {
    level: 'red' | 'yellow' | 'green';
    message: string;
}

@Injectable({ providedIn: 'root' })
export class OperatorDashboardService {
    private readonly supabase = getSupabaseClient();

    getDashboardKPIs(operatorId: string): Observable<OperatorKPIs> {
        return from(this.fetchKPIs(operatorId));
    }

    getUpcomingDates(operatorId: string, days = 7): Observable<UpcomingDate[]> {
        return from(this.fetchUpcomingDates(operatorId, days));
    }

    getPendingBookings(operatorId: string): Observable<PendingBookingRow[]> {
        return from(this.fetchPendingBookings(operatorId));
    }

    getDashboardAlerts(operatorId: string): Observable<DashboardAlert[]> {
        return from(this.fetchAlerts(operatorId));
    }

    async confirmBooking(bookingId: string): Promise<void> {
        await this.supabase
            .from('bookings')
            .update({ status: 'confirmada' })
            .eq('id', bookingId);
    }

    async cancelBooking(bookingId: string, reason = 'Cancelada por el operador'): Promise<void> {
        await this.supabase
            .from('bookings')
            .update({ status: 'cancelada', cancellation_reason: reason })
            .eq('id', bookingId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    private async fetchKPIs(operatorId: string): Promise<OperatorKPIs> {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [
            confirmedRes,
            revenueRes,
            pendingRes,
            activeExcursionsRes,
            spotsRes,
            operatorRes,
        ] = await Promise.all([
            // a) confirmed bookings this month
            this.supabase
                .from('bookings')
                .select('id', { count: 'exact', head: true })
                .eq('operator_id', operatorId)
                .eq('status', 'confirmada')
                .gte('created_at', monthStart),

            // b) revenue this month (confirmed + completed)
            this.supabase
                .from('bookings')
                .select('total')
                .eq('operator_id', operatorId)
                .in('status', ['confirmada', 'completada'])
                .gte('created_at', monthStart),

            // c) pending bookings total
            this.supabase
                .from('bookings')
                .select('id', { count: 'exact', head: true })
                .eq('operator_id', operatorId)
                .eq('status', 'pendiente'),

            // d) active excursions
            this.supabase
                .from('excursions')
                .select('id', { count: 'exact', head: true })
                .eq('operator_id', operatorId)
                .eq('is_active', true),

            // e) spots sold this week
            this.supabase
                .from('bookings')
                .select('num_people')
                .eq('operator_id', operatorId)
                .eq('status', 'confirmada')
                .gte('created_at', weekStart),

            // f) avg_rating
            this.supabase
                .from('excursion_operators')
                .select('avg_rating')
                .eq('id', operatorId)
                .single(),
        ]);

        const revenue = (revenueRes.data ?? []).reduce((sum, r) => sum + (r.total ?? 0), 0);
        const spotsThisWeek = (spotsRes.data ?? []).reduce((sum, r) => sum + (r.num_people ?? 0), 0);

        return {
            confirmedBookingsMonth: confirmedRes.count ?? 0,
            revenueMonth: revenue,
            pendingBookings: pendingRes.count ?? 0,
            activeExcursions: activeExcursionsRes.count ?? 0,
            spotsThisWeek,
            avgRating: operatorRes.data?.avg_rating ?? 0,
        };
    }

    private async fetchUpcomingDates(operatorId: string, days: number): Promise<UpcomingDate[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const until = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

        const { data: excursions } = await this.supabase
            .from('excursions')
            .select('id, name')
            .eq('operator_id', operatorId)
            .eq('is_active', true);

        if (!excursions || excursions.length === 0) return [];

        const excursionIds = excursions.map(e => e.id);
        const excursionMap = new Map(excursions.map(e => [e.id, e.name]));

        const { data: dates } = await this.supabase
            .from('excursion_dates')
            .select('id, excursion_id, date, departure_time, total_spots, spots_left')
            .in('excursion_id', excursionIds)
            .eq('is_active', true)
            .gte('date', today.toISOString().slice(0, 10))
            .lte('date', until.toISOString().slice(0, 10))
            .order('date', { ascending: true })
            .order('departure_time', { ascending: true });

        if (!dates || dates.length === 0) return [];

        // Get confirmed people count per date
        const dateIds = dates.map(d => d.id);
        const { data: bookings } = await this.supabase
            .from('bookings')
            .select('excursion_date_id, num_people')
            .in('excursion_date_id', dateIds)
            .eq('status', 'confirmada');

        const confirmedMap = new Map<string, number>();
        for (const b of bookings ?? []) {
            confirmedMap.set(b.excursion_date_id, (confirmedMap.get(b.excursion_date_id) ?? 0) + b.num_people);
        }

        return dates.map(d => ({
            id: d.id,
            excursionId: d.excursion_id,
            excursionName: excursionMap.get(d.excursion_id) ?? 'Excursión',
            date: d.date,
            departureTime: d.departure_time,
            spotsLeft: d.spots_left,
            totalSpots: d.total_spots,
            confirmedPeople: confirmedMap.get(d.id) ?? 0,
        }));
    }

    private async fetchPendingBookings(operatorId: string): Promise<PendingBookingRow[]> {
        const { data } = await this.supabase
            .from('bookings')
            .select(`
        id,
        booking_number,
        num_people,
        total,
        status,
        created_at,
        users!user_id ( full_name, phone ),
        excursion_dates!excursion_date_id (
          date,
          departure_time,
          excursions!excursion_id ( name )
        )
      `)
            .eq('operator_id', operatorId)
            .eq('status', 'pendiente')
            .order('created_at', { ascending: true });

        if (!data) return [];

        return data.map((row: unknown) => {
            const r = row as Record<string, unknown>;
            const user = r['users'] as Record<string, unknown> | null;
            const dateRow = r['excursion_dates'] as Record<string, unknown> | null;
            const excursion = dateRow?.['excursions'] as Record<string, unknown> | null;

            return {
                id: r['id'] as string,
                booking_number: r['booking_number'] as string | null,
                num_people: r['num_people'] as number,
                total: r['total'] as number,
                status: r['status'] as string,
                created_at: r['created_at'] as string,
                customer_name: (user?.['full_name'] as string) ?? 'Cliente',
                customer_phone: (user?.['phone'] as string | null) ?? null,
                excursion_name: (excursion?.['name'] as string) ?? '—',
                excursion_date: (dateRow?.['date'] as string) ?? '',
                departure_time: (dateRow?.['departure_time'] as string) ?? '',
            };
        });
    }

    private async fetchAlerts(operatorId: string): Promise<DashboardAlert[]> {
        const alerts: DashboardAlert[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const inSevenDays = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

        const { data: excursions } = await this.supabase
            .from('excursions')
            .select('id, name')
            .eq('operator_id', operatorId)
            .eq('is_active', true);

        if (!excursions || excursions.length === 0) return alerts;

        const excursionIds = excursions.map(e => e.id);
        const nameMap = new Map(excursions.map(e => [e.id, e.name]));

        const { data: dates } = await this.supabase
            .from('excursion_dates')
            .select('id, excursion_id, date, total_spots, spots_left')
            .in('excursion_id', excursionIds)
            .eq('is_active', true)
            .gte('date', today.toISOString().slice(0, 10))
            .lte('date', inSevenDays.toISOString().slice(0, 10));

        for (const d of dates ?? []) {
            const name = nameMap.get(d.excursion_id) ?? 'Excursión';
            const dateStr = new Date(d.date + 'T00:00:00').toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric' });
            if (d.spots_left === 0) {
                alerts.push({ level: 'red', message: `La excursión '${name}' del ${dateStr} está llena` });
            } else if (d.spots_left <= 3) {
                alerts.push({ level: 'yellow', message: `'${name}' el ${dateStr} tiene solo ${d.spots_left} cupo${d.spots_left !== 1 ? 's' : ''} disponible${d.spots_left !== 1 ? 's' : ''}` });
            }
        }

        // Reminder alert: check confirmed bookings for tomorrow
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        const tomorrowStr = tomorrow.toISOString().slice(0, 10);
        const { data: tomorrowDates } = await this.supabase
            .from('excursion_dates')
            .select('id')
            .in('excursion_id', excursionIds)
            .eq('date', tomorrowStr)
            .eq('is_active', true);

        if (tomorrowDates && tomorrowDates.length > 0) {
            const tomorrowDateIds = tomorrowDates.map(d => d.id);
            const { data: confirmados } = await this.supabase
                .from('bookings')
                .select('num_people')
                .in('excursion_date_id', tomorrowDateIds)
                .eq('status', 'confirmada');
            const totalPeople = (confirmados ?? []).reduce((s, b) => s + b.num_people, 0);
            if (totalPeople > 0) {
                alerts.push({ level: 'green', message: `Recordatorios enviados a ${totalPeople} participante${totalPeople !== 1 ? 's' : ''} de mañana` });
            }
        }

        return alerts;
    }
}
