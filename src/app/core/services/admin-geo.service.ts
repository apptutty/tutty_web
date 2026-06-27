/**
 * AdminGeoService — server-side geocoding and places for the web admin.
 *
 * All calls go through Supabase Edge Functions so the Google Maps API key
 * is never exposed in the browser.  The same Edge Functions are used by the
 * mobile app (see supabase/functions/).
 *
 * Usage:
 *   const geo = inject(AdminGeoService);
 *   const suggestions = await geo.autocomplete('Piantini');
 *   const detail      = await geo.getPlaceDetails(placeId);
 *   const result      = await geo.geocode('Av. Abraham Lincoln 101, SD');
 *   const result      = await geo.reverseGeocode(18.4718, -69.9513);
 */
import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../supabase/supabase.client';

export interface PlaceSuggestion {
    place_id: string;
    description: string;
    main_text: string;
    secondary_text: string;
}

export interface PlaceDetails {
    place_id: string;
    formatted_address: string;
    lat: number;
    lng: number;
    city?: string;
    sector?: string;
    province?: string;
    country?: string;
}

export interface GeocodeResult {
    formatted_address: string;
    lat: number;
    lng: number;
    place_id?: string;
    city?: string;
    sector?: string;
    province?: string;
    country?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminGeoService {
    private readonly supabase = getSupabaseClient();

    /** Forward + reverse geocoding via the geocode Edge Function. */
    async geocode(address: string): Promise<GeocodeResult | null> {
        try {
            const { data, error } = await this.supabase.functions.invoke('geocode', {
                body: { address },
            });
            if (error || !data?.results?.length) return null;
            const r = data.results[0];
            return {
                formatted_address: r.formatted_address ?? address,
                lat: r.lat,
                lng: r.lng,
                place_id: r.place_id,
                city: r.city,
                sector: r.sector,
                province: r.province,
                country: r.country,
            };
        } catch {
            return null;
        }
    }

    async reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
        try {
            const { data, error } = await this.supabase.functions.invoke('geocode', {
                body: { lat, lng },
            });
            if (error || !data) return null;
            return {
                formatted_address: data.formatted_address ?? '',
                lat: data.lat ?? lat,
                lng: data.lng ?? lng,
                place_id: data.place_id,
                city: data.city,
                sector: data.sector,
                province: data.province,
                country: data.country,
            };
        } catch {
            return null;
        }
    }

    /** Places autocomplete — minimum 2 characters. */
    async autocomplete(input: string): Promise<PlaceSuggestion[]> {
        if (input.trim().length < 2) return [];
        try {
            const { data, error } = await this.supabase.functions.invoke('places-autocomplete', {
                body: { input: input.trim() },
            });
            if (error || !Array.isArray(data?.suggestions)) return [];
            return data.suggestions as PlaceSuggestion[];
        } catch {
            return [];
        }
    }

    /** Place details — returns lat/lng and address components for a place_id. */
    async getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
        if (!placeId) return null;
        try {
            const { data, error } = await this.supabase.functions.invoke('places-details', {
                body: { place_id: placeId },
            });
            if (error || !data?.lat) return null;
            return data as PlaceDetails;
        } catch {
            return null;
        }
    }
}
