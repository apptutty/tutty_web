/**
 * C-4.3 — ReminderAutomationService
 *
 * Handles sending WhatsApp booking reminders via a Supabase Edge Function.
 *
 * The companion Edge Function (deploy to Supabase as `send-booking-reminder`)
 * should be scheduled to run hourly via a Supabase cron job and should also
 * accept individual booking IDs from the Angular client for manual sends.
 *
 * ── EDGE FUNCTION LOGIC (pseudo-code for Supabase/Deno) ──────────────────
 *
 * // supabase/functions/send-booking-reminder/index.ts
 * const { booking_id } = await req.json();
 *
 * if (booking_id) {
 *   // Manual single send — triggered from operator panel
 *   const booking = await supabase.from('bookings')
 *     .select('*, users!user_id(phone, full_name), excursion_dates!excursion_date_id(date, departure_time, excursions!excursion_id(name))')
 *     .eq('id', booking_id)
 *     .single();
 *   await sendWhatsApp(booking);
 *   await supabase.from('bookings').update({ reminder_sent_at: new Date().toISOString() }).eq('id', booking_id);
 * } else {
 *   // Cron sweep — runs hourly
 *   const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
 *   const dateStr = tomorrow.toISOString().slice(0, 10);
 *
 *   const { data: bookings } = await supabase
 *     .from('bookings')
 *     .select('*, users!user_id(phone, full_name), excursion_dates!excursion_date_id(date, departure_time, excursions!excursion_id(name))')
 *     .eq('status', 'confirmada')
 *     .is('reminder_sent_at', null)
 *     .eq('excursion_dates.date', dateStr);
 *
 *   for (const booking of bookings ?? []) {
 *     await sendWhatsApp(booking);
 *     await supabase.from('bookings').update({ reminder_sent_at: new Date().toISOString() }).eq('id', booking.id);
 *   }
 * }
 *
 * function sendWhatsApp(booking) {
 *   // Use WhatsApp Business API, Twilio, or a similar provider
 *   const msg = `Hola ${booking.users.full_name}! Recordatorio: tu excursión "${booking.excursions.name}" es mañana a las ${booking.excursion_dates.departure_time}. ¡Nos vemos!`;
 *   // POST to WhatsApp provider API...
 * }
 * ─────────────────────────────────────────────────────────────────────────
 */

import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../../../core/supabase/supabase.client';

export interface ReminderRecord {
    id: string;
    booking_number: string | null;
    reminder_sent_at: string;
    customer_name: string;
    excursion_name: string;
    departure_date: string;
    departure_time: string;
}

@Injectable({ providedIn: 'root' })
export class ReminderAutomationService {
    private readonly supabase = getSupabaseClient();

    /**
     * Trigger an individual reminder for a single booking.
     * Calls the Supabase Edge Function 'send-booking-reminder' and updates reminder_sent_at.
     */
    async sendReminder(bookingId: string): Promise<void> {
        const { error } = await this.supabase.functions.invoke('send-booking-reminder', {
            body: { booking_id: bookingId },
        });
        if (error) throw new Error(error.message ?? 'Error al invocar la función de recordatorio.');

        // Update reminder_sent_at locally (the edge function also does this server-side)
        await this.supabase
            .from('bookings')
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq('id', bookingId);
    }

    /**
     * Returns all bookings for the operator that received a reminder today.
     * Used in the "Recordatorios enviados hoy" section of the dashboard.
     */
    async getRemindersToday(operatorId: string): Promise<ReminderRecord[]> {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data } = await this.supabase
            .from('bookings')
            .select(`
        id, booking_number, reminder_sent_at,
        users!user_id ( full_name ),
        excursion_dates!excursion_date_id (
          date, departure_time,
          excursions!excursion_id ( name )
        )
      `)
            .eq('operator_id', operatorId)
            .gte('reminder_sent_at', todayStart.toISOString())
            .order('reminder_sent_at', { ascending: false });

        if (!data) return [];

        return (data as unknown[]).map(row => {
            const r = row as Record<string, unknown>;
            const user = r['users'] as Record<string, unknown> | null;
            const dateRow = r['excursion_dates'] as Record<string, unknown> | null;
            const excursion = dateRow?.['excursions'] as Record<string, unknown> | null;
            return {
                id: r['id'] as string,
                booking_number: r['booking_number'] as string | null,
                reminder_sent_at: r['reminder_sent_at'] as string,
                customer_name: (user?.['full_name'] as string) ?? 'Cliente',
                excursion_name: (excursion?.['name'] as string) ?? '—',
                departure_date: (dateRow?.['date'] as string) ?? '',
                departure_time: (dateRow?.['departure_time'] as string) ?? '',
            };
        });
    }

    /**
     * Returns bookings that are confirmed for tomorrow but haven't received a reminder yet.
     * Useful for a manual "send all pending reminders" action in the dashboard.
     */
    async getPendingRemindersForTomorrow(operatorId: string): Promise<string[]> {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().slice(0, 10);

        const { data: dates } = await this.supabase
            .from('excursion_dates')
            .select('id')
            .eq('date', tomorrowStr);

        if (!dates || dates.length === 0) return [];

        const { data } = await this.supabase
            .from('bookings')
            .select('id')
            .eq('operator_id', operatorId)
            .eq('status', 'confirmada')
            .is('reminder_sent_at', null)
            .in('excursion_date_id', dates.map(d => d.id));

        return (data ?? []).map(b => (b as { id: string }).id);
    }
}
