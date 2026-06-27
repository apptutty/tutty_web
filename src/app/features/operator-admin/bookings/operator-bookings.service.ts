import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../../../core/supabase/supabase.client';
import { BookingStatus } from '../../../core/supabase/database.types';

export interface BookingListRow {
    id: string;
    booking_number: string | null;
    status: BookingStatus;
    num_people: number;
    total: number;
    created_at: string;
    reminder_sent_at: string | null;
    customer_name: string;
    customer_phone: string | null;
    excursion_name: string;
    excursion_id: string;
    departure_date: string;
    departure_time: string;
}

export interface BookingFullDetail {
    id: string;
    booking_number: string | null;
    status: BookingStatus;
    num_people: number;
    total: number;
    special_requests: string | null;
    cancellation_reason: string | null;
    reminder_sent_at: string | null;
    confirmed_at: string | null;
    cancelled_at: string | null;
    completed_at: string | null;
    created_at: string;
    customer: { full_name: string; phone: string | null; email: string | null };
    excursion: { id: string; name: string; price_per_person: number; meeting_point: string | null };
    excursion_date: { date: string; departure_time: string };
    participants: { id: string; full_name: string; cedula: string | null; phone: string | null }[];
}

export interface BookingFilters {
    status?: BookingStatus | 'all';
    excursionId?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    search?: string;
}

export interface PassengerExportRow {
    booking_number: string;
    customer: string;
    excursion: string;
    departure: string;
    participants: string;
    total: number;
}

@Injectable({ providedIn: 'root' })
export class OperatorBookingsService {
    private readonly supabase = getSupabaseClient();

    // ─── List ──────────────────────────────────────────────────────────────────
    async listBookings(operatorId: string, filters: BookingFilters = {}): Promise<BookingListRow[]> {
        // operatorId is accepted for API compatibility but RLS already scopes results
        // to excursions owned by the authenticated operator. No client-side operator_id
        // filter is applied here because bookings has no denormalised operator_id column.
        void operatorId;
        let q = this.supabase
            .from('bookings')
            .select(`
        id, booking_number, status, num_people, total, created_at, reminder_sent_at,
        users!user_id ( full_name, phone ),
        excursion_dates!excursion_date_id (
          date, departure_time,
          excursions!excursion_id ( id, name )
        )
      `)
            .order('created_at', { ascending: false });

        if (filters.status && filters.status !== 'all') {
            q = q.eq('status', filters.status);
        }
        if (filters.excursionId) {
            // Filter via excursion_dates join — use a subquery workaround
            const { data: dateIds } = await this.supabase
                .from('excursion_dates')
                .select('id')
                .eq('excursion_id', filters.excursionId);
            if (dateIds && dateIds.length > 0) {
                q = q.in('excursion_date_id', dateIds.map(d => d.id));
            }
        }
        if (filters.dateFrom) {
            const { data: dateIds } = await this.supabase
                .from('excursion_dates')
                .select('id')
                .gte('date', filters.dateFrom);
            q = q.in('excursion_date_id', (dateIds ?? []).map(d => d.id));
        }
        if (filters.dateTo) {
            const { data: dateIds } = await this.supabase
                .from('excursion_dates')
                .select('id')
                .lte('date', filters.dateTo);
            q = q.in('excursion_date_id', (dateIds ?? []).map(d => d.id));
        }

        const { data } = await q;
        if (!data) return [];

        const rows = (data as unknown[]).map(row => {
            const r = row as Record<string, unknown>;
            const user = r['users'] as Record<string, unknown> | null;
            const dateRow = r['excursion_dates'] as Record<string, unknown> | null;
            const excursion = dateRow?.['excursions'] as Record<string, unknown> | null;
            return {
                id: r['id'] as string,
                booking_number: r['booking_number'] as string | null,
                status: r['status'] as BookingStatus,
                num_people: r['num_people'] as number,
                total: r['total'] as number,
                created_at: r['created_at'] as string,
                reminder_sent_at: r['reminder_sent_at'] as string | null,
                customer_name: (user?.['full_name'] as string) ?? 'Cliente',
                customer_phone: (user?.['phone'] as string | null) ?? null,
                excursion_name: (excursion?.['name'] as string) ?? '—',
                excursion_id: (excursion?.['id'] as string) ?? '',
                departure_date: (dateRow?.['date'] as string) ?? '',
                departure_time: (dateRow?.['departure_time'] as string) ?? '',
            };
        });

        // Client-side search filter
        if (filters.search?.trim()) {
            const q = filters.search.toLowerCase();
            return rows.filter(r =>
                r.booking_number?.toLowerCase().includes(q) ||
                r.customer_name.toLowerCase().includes(q)
            );
        }
        return rows;
    }

    // ─── Detail ────────────────────────────────────────────────────────────────
    async getBookingDetail(bookingId: string): Promise<BookingFullDetail | null> {
        const { data, error } = await this.supabase
            .from('bookings')
            .select(`
        id, booking_number, status, num_people, total,
        special_requests, cancellation_reason,
        reminder_sent_at, confirmed_at, cancelled_at, completed_at, created_at,
        users!user_id ( full_name, phone, email ),
        excursion_dates!excursion_date_id (
          date, departure_time,
          excursions!excursion_id ( id, name, price_per_person, meeting_point )
        ),
        booking_participants!booking_id ( id, full_name, cedula, phone )
      `)
            .eq('id', bookingId)
            .single();

        if (error || !data) return null;
        const r = data as Record<string, unknown>;
        const user = r['users'] as Record<string, unknown> | null;
        const dateRow = r['excursion_dates'] as Record<string, unknown> | null;
        const excursion = dateRow?.['excursions'] as Record<string, unknown> | null;
        const rawParticipants = (r['booking_participants'] ?? []) as Record<string, unknown>[];

        return {
            id: r['id'] as string,
            booking_number: r['booking_number'] as string | null,
            status: r['status'] as BookingStatus,
            num_people: r['num_people'] as number,
            total: r['total'] as number,
            special_requests: r['special_requests'] as string | null,
            cancellation_reason: r['cancellation_reason'] as string | null,
            reminder_sent_at: r['reminder_sent_at'] as string | null,
            confirmed_at: r['confirmed_at'] as string | null,
            cancelled_at: r['cancelled_at'] as string | null,
            completed_at: r['completed_at'] as string | null,
            created_at: r['created_at'] as string,
            customer: {
                full_name: (user?.['full_name'] as string) ?? 'Cliente',
                phone: (user?.['phone'] as string | null) ?? null,
                email: (user?.['email'] as string | null) ?? null,
            },
            excursion: {
                id: (excursion?.['id'] as string) ?? '',
                name: (excursion?.['name'] as string) ?? '—',
                price_per_person: (excursion?.['price_per_person'] as number) ?? 0,
                meeting_point: (excursion?.['meeting_point'] as string | null) ?? null,
            },
            excursion_date: {
                date: (dateRow?.['date'] as string) ?? '',
                departure_time: (dateRow?.['departure_time'] as string) ?? '',
            },
            participants: rawParticipants.map(p => ({
                id: p['id'] as string,
                full_name: p['full_name'] as string,
                cedula: (p['cedula'] as string | null) ?? null,
                phone: (p['phone'] as string | null) ?? null,
            })),
        };
    }

    // ─── Status changes ────────────────────────────────────────────────────────
    /** Approve a pending booking via RPC (validates authorization, spots, status atomically). */
    async confirmBooking(bookingId: string): Promise<{ success: boolean; error?: string }> {
        const { data, error } = await this.supabase.rpc('approve_excursion_booking', {
            p_booking_id: bookingId,
        });
        if (error) return { success: false, error: error.message };
        const result = data as { success?: boolean; error?: string } | null;
        if (result?.error) return { success: false, error: result.error };
        return { success: true };
    }

    /** Cancel a booking via RPC (validates authorization and status atomically). */
    async cancelBooking(bookingId: string, reason: string): Promise<{ success: boolean; error?: string }> {
        const { data, error } = await this.supabase.rpc('cancel_excursion_booking', {
            p_booking_id: bookingId,
            p_reason: reason || null,
        });
        if (error) return { success: false, error: error.message };
        const result = data as { success?: boolean; error?: string } | null;
        if (result?.error) return { success: false, error: result.error };
        return { success: true };
    }

    async completeBooking(bookingId: string): Promise<{ success: boolean; error?: string }> {
        const { error } = await this.supabase.from('bookings').update({
            status: 'completada',
            completed_at: new Date().toISOString(),
        }).eq('id', bookingId);
        if (error) return { success: false, error: error.message };
        return { success: true };
    }

    // ─── Excursions for filter ─────────────────────────────────────────────────
    async listOperatorExcursionsForFilter(operatorId: string): Promise<{ id: string; name: string }[]> {
        const { data } = await this.supabase
            .from('excursions')
            .select('id, name')
            .eq('operator_id', operatorId)
            .order('name');
        return (data ?? []) as { id: string; name: string }[];
    }

    // ─── Export helpers ────────────────────────────────────────────────────────
    exportToCsv(rows: BookingListRow[]): void {
        const header = ['# Reserva', 'Excursión', 'Fecha salida', 'Cliente', 'Teléfono', 'Personas', 'Total RD$', 'Estado', 'Fecha reserva'].join(',');
        const lines = rows.map(r => [
            r.booking_number ?? r.id.slice(0, 8),
            `"${r.excursion_name}"`,
            `${r.departure_date} ${r.departure_time}`,
            `"${r.customer_name}"`,
            r.customer_phone ?? '',
            r.num_people,
            r.total,
            r.status,
            r.created_at.slice(0, 10),
        ].join(','));
        const csv = [header, ...lines].join('\n');
        this.downloadFile(csv, 'reservas.csv', 'text/csv');
    }

    exportParticipantsCsv(booking: BookingFullDetail): void {
        const header = ['# Reserva', 'Excursión', 'Fecha', 'Nombre', 'Cédula', 'Teléfono'].join(',');
        const lines = booking.participants.map(p => [
            booking.booking_number ?? booking.id.slice(0, 8),
            `"${booking.excursion.name}"`,
            booking.excursion_date.date,
            `"${p.full_name}"`,
            p.cedula ?? '',
            p.phone ?? '',
        ].join(','));
        const csv = [header, ...lines].join('\n');
        this.downloadFile(csv, `participantes-${booking.booking_number ?? booking.id.slice(0, 8)}.csv`, 'text/csv');
    }

    private downloadFile(content: string, filename: string, type: string) {
        const blob = new Blob(['\ufeff' + content], { type: `${type};charset=utf-8;` });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    }
}
