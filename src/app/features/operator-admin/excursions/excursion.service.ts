import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../../../core/supabase/supabase.client';
import { Excursion, ExcursionDate } from '../../../core/supabase/database.types';
import { buildStorageObjectKey } from '../../../shared/utils/storage-key.utils';

export interface ExcursionWithMeta extends Excursion {
    nextDate?: ExcursionDate | null;
    avgRating?: number;
}

export interface ExcursionFormData {
    name: string;
    short_description: string;
    description: string | null;
    category: string | null;
    difficulty_level: string | null;
    duration_hours: number;
    language: string;
    price_per_person: number;
    min_people: number;
    max_people: number | null;
    meeting_point: string | null;
    meeting_point_lat: number | null;
    meeting_point_lng: number | null;
    min_hours_advance: number;
    cancellation_hours: number;
    includes: string[];
    excludes: string[];
    what_to_bring: string;
    photos: string[];
    is_active: boolean;
}

export interface ExcursionDateRow extends ExcursionDate {
    confirmedPeople?: number;
}

export interface CalendarEvent {
    dateRowId: string;
    excursionId: string;
    excursionName: string;
    date: string;
    departureTime: string;
    totalSpots: number;
    spotsLeft: number;
    confirmedPeople: number;
    durationHours: number;
    isActive: boolean;
}

export interface CalendarData {
    events: CalendarEvent[];
    excursions: { id: string; name: string }[];
}

@Injectable({ providedIn: 'root' })
export class ExcursionService {
    private readonly supabase = getSupabaseClient();

    // ─── List ─────────────────────────────────────────────────────────────────

    async listOperatorExcursions(operatorId: string): Promise<ExcursionWithMeta[]> {
        const { data: excursions } = await this.supabase
            .from('excursions')
            .select('*')
            .eq('operator_id', operatorId)
            .order('created_at', { ascending: false });

        if (!excursions || excursions.length === 0) return [];

        const ids = excursions.map(e => e.id);
        const today = new Date().toISOString().slice(0, 10);

        // Fetch next upcoming dates for each excursion
        const { data: dates } = await this.supabase
            .from('excursion_dates')
            .select('*')
            .in('excursion_id', ids)
            .eq('is_active', true)
            .gte('date', today)
            .order('date', { ascending: true });

        const nextDateMap = new Map<string, ExcursionDate>();
        for (const d of dates ?? []) {
            if (!nextDateMap.has(d.excursion_id)) {
                nextDateMap.set(d.excursion_id, d as ExcursionDate);
            }
        }

        return excursions.map(e => ({
            ...(e as Excursion),
            nextDate: nextDateMap.get(e.id) ?? null,
        }));
    }

    // ─── Single ───────────────────────────────────────────────────────────────

    async getExcursion(id: string): Promise<Excursion | null> {
        const { data } = await this.supabase
            .from('excursions')
            .select('*')
            .eq('id', id)
            .single();
        return data as Excursion | null;
    }

    // ─── Create / Update ──────────────────────────────────────────────────────

    async createExcursion(operatorId: string, form: ExcursionFormData): Promise<string> {
        const payload = this.buildPayload(operatorId, form);
        const { data, error } = await this.supabase
            .from('excursions')
            .insert(payload)
            .select('id')
            .single();
        if (error) throw new Error(error.message);
        return (data as { id: string }).id;
    }

    async updateExcursion(id: string, form: Partial<ExcursionFormData>): Promise<void> {
        const { error } = await this.supabase
            .from('excursions')
            .update(form)
            .eq('id', id);
        if (error) throw new Error(error.message);
    }

    async toggleActive(id: string, isActive: boolean): Promise<void> {
        await this.supabase.from('excursions').update({ is_active: isActive }).eq('id', id);
    }

    async deleteExcursion(id: string): Promise<void> {
        const { error } = await this.supabase.from('excursions').delete().eq('id', id);
        if (error) throw new Error(error.message);
    }

    // ─── Photos ───────────────────────────────────────────────────────────────

    async uploadPhoto(operatorId: string, excursionId: string, file: File, _index: number): Promise<string> {
        const path = buildStorageObjectKey(`excursions/${operatorId}/${excursionId}`, file);
        const { error } = await this.supabase.storage.from('media').upload(path, file, { upsert: true });
        if (error) throw new Error(error.message);
        const { data } = this.supabase.storage.from('media').getPublicUrl(path);
        return data.publicUrl;
    }

    // ─── Calendar ─────────────────────────────────────────────────────────────

    async loadCalendarData(operatorId: string, dateFrom: string): Promise<CalendarData> {
        const { data: excursions } = await this.supabase
            .from('excursions')
            .select('id, name, duration_hours')
            .eq('operator_id', operatorId);

        if (!excursions || excursions.length === 0) return { events: [], excursions: [] };

        const excMap = new Map(excursions.map(e => [e.id as string, e as { id: string; name: string; duration_hours: number }]));
        const ids = excursions.map(e => e.id as string);

        const { data: dates } = await this.supabase
            .from('excursion_dates')
            .select('*')
            .in('excursion_id', ids)
            .gte('date', dateFrom)
            .order('date')
            .order('departure_time');

        if (!dates || dates.length === 0) {
            return {
                events: [],
                excursions: excursions.map(e => ({ id: e.id as string, name: e.name as string })),
            };
        }

        const dateIds = dates.map(d => d.id as string);
        const { data: bookings } = await this.supabase
            .from('bookings')
            .select('excursion_date_id, num_people')
            .in('excursion_date_id', dateIds)
            .eq('status', 'confirmada');

        const confirmedMap = new Map<string, number>();
        for (const b of bookings ?? []) {
            const id = b.excursion_date_id as string;
            confirmedMap.set(id, (confirmedMap.get(id) ?? 0) + (b.num_people as number));
        }

        const events: CalendarEvent[] = (dates as ExcursionDate[]).map(d => ({
            dateRowId: d.id,
            excursionId: d.excursion_id,
            excursionName: excMap.get(d.excursion_id)?.name ?? '—',
            date: d.date,
            departureTime: d.departure_time,
            totalSpots: d.total_spots,
            spotsLeft: d.spots_left,
            confirmedPeople: confirmedMap.get(d.id) ?? 0,
            durationHours: excMap.get(d.excursion_id)?.duration_hours ?? 4,
            isActive: d.is_active,
        }));

        return {
            events,
            excursions: excursions.map(e => ({ id: e.id as string, name: e.name as string })),
        };
    }

    // ─── Dates ─────────────────────────────────────────────────────────────────

    async listDates(excursionId: string): Promise<ExcursionDateRow[]> {
        const today = new Date().toISOString().slice(0, 10);
        const { data: dates } = await this.supabase
            .from('excursion_dates')
            .select('*')
            .eq('excursion_id', excursionId)
            .gte('date', today)
            .order('date', { ascending: true })
            .order('departure_time', { ascending: true });

        if (!dates || dates.length === 0) return [];

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

        return (dates as ExcursionDate[]).map(d => ({
            ...d,
            confirmedPeople: confirmedMap.get(d.id) ?? 0,
        }));
    }

    async addDate(excursionId: string, date: string, departureTime: string, totalSpots: number): Promise<void> {
        const { error } = await this.supabase.from('excursion_dates').insert({
            excursion_id: excursionId,
            date,
            departure_time: departureTime,
            total_spots: totalSpots,
            spots_left: totalSpots,
            is_active: true,
        });
        if (error) throw new Error(error.message);
    }

    async addRecurringDates(
        excursionId: string,
        weekdays: number[],
        from: string,
        to: string,
        departureTime: string,
        totalSpots: number,
    ): Promise<number> {
        const rows: object[] = [];
        const cur = new Date(from + 'T00:00:00');
        const end = new Date(to + 'T00:00:00');
        while (cur <= end) {
            if (weekdays.includes(cur.getDay())) {
                rows.push({
                    excursion_id: excursionId,
                    date: cur.toISOString().slice(0, 10),
                    departure_time: departureTime,
                    total_spots: totalSpots,
                    spots_left: totalSpots,
                    is_active: true,
                });
            }
            cur.setDate(cur.getDate() + 1);
        }
        if (rows.length === 0) return 0;
        const { error } = await this.supabase.from('excursion_dates').insert(rows);
        if (error) throw new Error(error.message);
        return rows.length;
    }

    async updateSpots(dateId: string, newTotalSpots: number, confirmedPeople: number): Promise<void> {
        const newSpotsLeft = newTotalSpots - confirmedPeople;
        if (newSpotsLeft < 0) throw new Error('No puedes reducir cupos por debajo de las reservas confirmadas.');
        const { error } = await this.supabase
            .from('excursion_dates')
            .update({ total_spots: newTotalSpots, spots_left: newSpotsLeft })
            .eq('id', dateId);
        if (error) throw new Error(error.message);
    }

    async cancelDate(dateId: string): Promise<void> {
        await this.supabase.from('excursion_dates').update({ is_active: false }).eq('id', dateId);
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    private buildPayload(operatorId: string, form: ExcursionFormData): Record<string, unknown> {
        return {
            operator_id: operatorId,
            name: form.name,
            short_description: form.short_description || null,
            description: form.description || null,
            difficulty_level: form.difficulty_level || null,
            language: form.language,
            duration_hours: form.duration_hours,
            price_per_person: form.price_per_person,
            min_people: form.min_people,
            max_people: form.max_people || null,
            meeting_point: form.meeting_point || null,
            meeting_point_lat: form.meeting_point_lat || null,
            meeting_point_lng: form.meeting_point_lng || null,
            min_hours_advance: form.min_hours_advance,
            cancellation_hours: form.cancellation_hours,
            photos: form.photos,
            is_active: form.is_active,
        };
    }
}
