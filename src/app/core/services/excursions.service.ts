import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { getSupabaseClient } from '../supabase/supabase.client';

export interface Excursion {
  id: string;
  name: string;
  short_description: string | null;
  description: string | null;
  photos: string[];
  price_per_person: number;
  duration_hours: number | null;
  difficulty_level: 'facil' | 'moderado' | 'dificil' | null;
  language: string;
  min_people: number;
  max_people: number | null;
  min_hours_advance: number;
  cancellation_hours: number;
  hotel_pickup: boolean;
  hotel_pickup_notes: string | null;
  pickup_time: string | null;
  what_to_bring: string[];
  what_is_included: string[];
  what_is_not_included: string[];
  min_age: number | null;
  max_age: number | null;
  wheelchair_accessible: boolean;
  physical_requirements: string | null;
  health_warnings: string | null;
  meeting_point: string | null;
  operator_name: string;
  operator_logo: string | null;
  operator_category: string | null;
  avg_rating: number;
  total_reviews: number;
  is_active: boolean;
}

export interface ExcursionDate {
  id: string;
  excursion_id: string;
  date: string;
  departure_time: string;
  total_spots: number;
  spots_left: number;
  is_active: boolean;
}

@Injectable({ providedIn: 'root' })
export class ExcursionsService {
  private readonly supabase = getSupabaseClient();
  private readonly authService = inject(AuthService);

  readonly excursions = signal<Excursion[]>([]);
  readonly selectedExcursion = signal<Excursion | null>(null);
  readonly selectedDate = signal<ExcursionDate | null>(null);
  readonly availableDates = signal<ExcursionDate[]>([]);
  readonly numPeople = signal<number>(1);
  readonly totalPrice = computed(() => (this.selectedExcursion()?.price_per_person ?? 0) * this.numPeople());
  readonly isLoading = signal(false);
  readonly activeCategory = signal<string>('todos');
  readonly upcomingSpotsByExcursion = signal<Record<string, number>>({});
  readonly filteredExcursions = computed(() => {
    const cat = this.normalizeCategory(this.activeCategory());
    const all = this.excursions();
    return cat === 'todos' ? all : all.filter(excursion => this.normalizeCategory(excursion.operator_category) === cat);
  });

  async loadExcursions(): Promise<void> {
    this.isLoading.set(true);
    try {
      const { data, error } = await this.supabase
        .from('excursions')
        .select(`
          id,
          name,
          short_description,
          photos,
          price_per_person,
          duration_hours,
          difficulty_level,
          hotel_pickup,
          what_is_included,
          min_people,
          wheelchair_accessible,
          is_active,
          excursion_operators(name, logo_url, avg_rating, total_reviews, category)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const excursions = (data ?? []).map(row => this.mapExcursion(row));
      this.excursions.set(excursions);
      await this.loadUpcomingSpots(excursions.map(excursion => excursion.id));
    } catch (error) {
      console.error('[ExcursionsService] loadExcursions failed', error);
      this.excursions.set([]);
      this.upcomingSpotsByExcursion.set({});
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadExcursionDetail(id: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const { data, error } = await this.supabase
        .from('excursions')
        .select(`
          id,
          name,
          short_description,
          description,
          photos,
          price_per_person,
          duration_hours,
          difficulty_level,
          language,
          min_people,
          max_people,
          min_hours_advance,
          cancellation_hours,
          hotel_pickup,
          hotel_pickup_notes,
          pickup_time,
          what_to_bring,
          what_is_included,
          what_is_not_included,
          min_age,
          max_age,
          wheelchair_accessible,
          physical_requirements,
          health_warnings,
          meeting_point,
          is_active,
          excursion_operators(name, logo_url, avg_rating, total_reviews, category)
        `)
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      const today = new Date().toISOString().slice(0, 10);
      const { data: datesData, error: datesError } = await this.supabase
        .from('excursion_dates')
        .select('id, excursion_id, date, departure_time, total_spots, spots_left, is_active')
        .eq('excursion_id', id)
        .gte('date', today)
        .eq('is_active', true)
        .gt('spots_left', 0)
        .order('date', { ascending: true })
        .order('departure_time', { ascending: true });

      if (datesError) {
        throw datesError;
      }

      const excursion = this.mapExcursion(data);
      const dates = (datesData ?? []).map(row => this.mapExcursionDate(row));
      const currentDate = this.selectedDate();
      const nextSelectedDate = currentDate && currentDate.excursion_id === id
        ? dates.find(date => date.id === currentDate.id) ?? null
        : null;

      this.selectedExcursion.set(excursion);
      this.availableDates.set(dates);
      this.selectedDate.set(nextSelectedDate);
      this.numPeople.set(Math.max(excursion.min_people, 1));
      this.upcomingSpotsByExcursion.update(current => ({
        ...current,
        [id]: dates[0]?.spots_left ?? current[id] ?? 0,
      }));
    } catch (error) {
      console.error('[ExcursionsService] loadExcursionDetail failed', error);
      this.selectedExcursion.set(null);
      this.availableDates.set([]);
      this.selectedDate.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  async createBooking(params: {
    excursionDateId: string;
    numPeople: number;
    total: number;
    specialRequests: string;
    participants: { full_name: string; id_number?: string; phone?: string }[];
  }): Promise<{ bookingNumber: string } | null> {
    try {
      const signalUser = this.authService.currentUser();
      const authUser = signalUser ?? (await this.supabase.auth.getUser()).data.user;
      const userId = signalUser?.id ?? authUser?.id;

      if (!userId) {
        throw new Error('Usuario no autenticado');
      }

      const { data: booking, error: bookingError } = await this.supabase
        .from('bookings')
        .insert({
          user_id: userId,
          excursion_date_id: params.excursionDateId,
          num_people: params.numPeople,
          total: params.total,
          status: 'pendiente',
          special_requests: params.specialRequests || null,
        })
        .select('id, booking_number')
        .single();

      if (bookingError || !booking) {
        throw bookingError ?? new Error('No se pudo crear la reserva');
      }

      const participants = params.participants.map(participant => ({
        booking_id: booking.id,
        full_name: participant.full_name,
        cedula: participant.id_number ?? null,
        phone: participant.phone ?? null,
      }));

      if (participants.length > 0) {
        const { error: participantsError } = await this.supabase.from('booking_participants').insert(participants);
        if (participantsError) {
          throw participantsError;
        }
      }

      this.availableDates.update(dates => dates.map(date => {
        if (date.id !== params.excursionDateId) {
          return date;
        }
        const nextSpotsLeft = Math.max(date.spots_left - params.numPeople, 0);
        const updatedDate = { ...date, spots_left: nextSpotsLeft };
        if (this.selectedDate()?.id === date.id) {
          this.selectedDate.set(updatedDate);
        }
        return updatedDate;
      }));

      return {
        bookingNumber: booking.booking_number ?? String(booking.id).slice(0, 8).toUpperCase(),
      };
    } catch (error) {
      console.error('[ExcursionsService] createBooking failed', error);
      return null;
    }
  }

  spotsLeftFor(excursionId: string): number | null {
    const value = this.upcomingSpotsByExcursion()[excursionId];
    return typeof value === 'number' ? value : null;
  }

  private async loadUpcomingSpots(excursionIds: string[]): Promise<void> {
    if (excursionIds.length === 0) {
      this.upcomingSpotsByExcursion.set({});
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await this.supabase
      .from('excursion_dates')
      .select('excursion_id, date, spots_left')
      .in('excursion_id', excursionIds)
      .gte('date', today)
      .eq('is_active', true)
      .gt('spots_left', 0)
      .order('date', { ascending: true });

    if (error) {
      throw error;
    }

    const nextSpots: Record<string, number> = {};
    for (const row of data ?? []) {
      if (row.excursion_id && nextSpots[row.excursion_id] === undefined) {
        nextSpots[row.excursion_id] = Number(row.spots_left ?? 0);
      }
    }
    this.upcomingSpotsByExcursion.set(nextSpots);
  }

  private mapExcursion(row: any): Excursion {
    const operator = this.extractRelation(row.excursion_operators);
    return {
      id: String(row.id),
      name: row.name ?? '',
      short_description: row.short_description ?? null,
      description: row.description ?? null,
      photos: Array.isArray(row.photos) ? row.photos.filter((photo: unknown): photo is string => typeof photo === 'string') : [],
      price_per_person: Number(row.price_per_person ?? 0),
      duration_hours: row.duration_hours === null || row.duration_hours === undefined ? null : Number(row.duration_hours),
      difficulty_level: row.difficulty_level ?? null,
      language: row.language ?? 'Español',
      min_people: Number(row.min_people ?? 1),
      max_people: row.max_people === null || row.max_people === undefined ? null : Number(row.max_people),
      min_hours_advance: Number(row.min_hours_advance ?? 0),
      cancellation_hours: Number(row.cancellation_hours ?? 0),
      hotel_pickup: Boolean(row.hotel_pickup),
      hotel_pickup_notes: row.hotel_pickup_notes ?? null,
      pickup_time: row.pickup_time ?? null,
      what_to_bring: Array.isArray(row.what_to_bring) ? row.what_to_bring.filter((item: unknown): item is string => typeof item === 'string') : [],
      what_is_included: Array.isArray(row.what_is_included) ? row.what_is_included.filter((item: unknown): item is string => typeof item === 'string') : [],
      what_is_not_included: Array.isArray(row.what_is_not_included) ? row.what_is_not_included.filter((item: unknown): item is string => typeof item === 'string') : [],
      min_age: row.min_age === null || row.min_age === undefined ? null : Number(row.min_age),
      max_age: row.max_age === null || row.max_age === undefined ? null : Number(row.max_age),
      wheelchair_accessible: Boolean(row.wheelchair_accessible),
      physical_requirements: row.physical_requirements ?? null,
      health_warnings: row.health_warnings ?? null,
      meeting_point: row.meeting_point ?? null,
      operator_name: operator?.name ?? 'Tuttys',
      operator_logo: operator?.logo_url ?? null,
      operator_category: operator?.category ?? null,
      avg_rating: Number(operator?.avg_rating ?? 0),
      total_reviews: Number(operator?.total_reviews ?? 0),
      is_active: row.is_active ?? true,
    };
  }

  private mapExcursionDate(row: any): ExcursionDate {
    return {
      id: String(row.id),
      excursion_id: String(row.excursion_id),
      date: row.date ?? '',
      departure_time: row.departure_time ?? '',
      total_spots: Number(row.total_spots ?? 0),
      spots_left: Number(row.spots_left ?? 0),
      is_active: Boolean(row.is_active),
    };
  }

  private extractRelation<T>(value: T | T[] | null | undefined): T | null {
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }
    return value ?? null;
  }

  private normalizeCategory(value: string | null | undefined): string {
    return (value ?? 'todos')
      .normalize('NFD')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }
}
