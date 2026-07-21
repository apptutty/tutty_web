import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import { LatLng } from '../../shared/ui/map/tutty-map.component';

export interface BeachRow {
  id: string;
  name: string;
  city: string | null;
  sector: string | null;
  is_active: boolean;
  points_count: number;
  commerces_count: number;
  created_at: string | null;
  has_boundary: boolean;
}

export interface BeachPointRow {
  id: string;
  beach_id: string;
  name: string;
  lat: number;
  lng: number;
  reference_notes: string | null;
  is_active: boolean;
}

@Injectable({ providedIn: 'root' })
export class BeachesService {
  private readonly supabase = getSupabaseClient();

  async listBeaches(): Promise<BeachRow[]> {
    const { data, error } = await this.supabase
      .from('beaches')
      .select('id, name, city, sector, is_active, created_at, boundary, beach_points(count), commerce_beach_coverage(count)')
      .order('name');
    if (error) throw error;
    return ((data ?? []) as any[]).map((row) => ({
      id: row.id,
      name: row.name,
      city: row.city ?? null,
      sector: row.sector ?? null,
      is_active: row.is_active === true,
      points_count: Number(row.beach_points?.[0]?.count ?? 0),
      commerces_count: Number(row.commerce_beach_coverage?.[0]?.count ?? 0),
      created_at: row.created_at ?? null,
      has_boundary: row.boundary != null,
    }));
  }

  async saveBeach(payload: Partial<BeachRow>): Promise<void> {
    const data = {
      name: payload.name?.trim(),
      city: payload.city?.trim() || null,
      sector: payload.sector?.trim() || null,
      is_active: payload.is_active ?? true,
    };
    if (!data.name) {
      throw new Error('El nombre es obligatorio');
    }

    let duplicateQuery = this.supabase
      .from('beaches')
      .select('id', { count: 'exact', head: true })
      .ilike('name', data.name);
    if (payload.id) {
      duplicateQuery = duplicateQuery.neq('id', payload.id);
    }
    const { count: duplicateCount, error: duplicateError } = await duplicateQuery;
    if (duplicateError) throw duplicateError;
    if ((duplicateCount ?? 0) > 0) {
      throw new Error('Ya existe una playa con ese nombre');
    }

    if (payload.id) {
      const { error } = await this.supabase.from('beaches').update(data).eq('id', payload.id);
      if (error) throw error;
      return;
    }
    const { error } = await this.supabase.from('beaches').insert(data);
    if (error) throw error;
  }

  async deleteBeach(id: string): Promise<void> {
    const { error } = await this.supabase.from('beaches').delete().eq('id', id);
    if (error) throw error;
  }

  /** Boundary vertices ({lat,lng}[]) for a beach, or null if not delimited yet. */
  async getBeachBoundary(beachId: string): Promise<LatLng[] | null> {
    const { data, error } = await this.supabase.rpc('get_beach_boundary', { p_beach_id: beachId });
    if (error) throw error;
    return (data as LatLng[] | null) ?? null;
  }

  /** Saves (or clears, when vertices is an empty array) the polygon boundary for a beach. */
  async saveBeachBoundary(beachId: string, vertices: LatLng[]): Promise<void> {
    const { error } = await this.supabase.rpc('save_beach_boundary', {
      p_beach_id: beachId,
      p_vertices: vertices,
    });
    if (error) throw error;
  }

  /** Active (non-terminal) orders whose historical snapshot references this beach. */
  async countActiveOrdersForBeach(beachId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .not('status', 'in', '(entregado,cancelado)')
      .eq('delivery_address_snapshot->>beach_id', beachId);
    if (error) throw error;
    return count ?? 0;
  }

  /** Active (non-terminal) orders whose historical snapshot references this beach point. */
  async countActiveOrdersForPoint(pointId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .not('status', 'in', '(entregado,cancelado)')
      .eq('delivery_address_snapshot->>beach_point_id', pointId);
    if (error) throw error;
    return count ?? 0;
  }

  async listPoints(beachId: string): Promise<BeachPointRow[]> {
    const { data, error } = await this.supabase
      .from('beach_points')
      .select('id, beach_id, name, lat, lng, reference_notes, is_active')
      .eq('beach_id', beachId)
      .order('name');
    if (error) throw error;
    return ((data ?? []) as any[]).map((row) => ({
      id: row.id,
      beach_id: row.beach_id,
      name: row.name,
      lat: Number(row.lat ?? 0),
      lng: Number(row.lng ?? 0),
      reference_notes: row.reference_notes ?? null,
      is_active: row.is_active === true,
    }));
  }

  async savePoint(payload: Partial<BeachPointRow>): Promise<void> {
    const point = {
      beach_id: payload.beach_id,
      name: payload.name?.trim(),
      lat: payload.lat,
      lng: payload.lng,
      reference_notes: payload.reference_notes?.trim() || null,
      is_active: payload.is_active ?? true,
    };
    if (!point.beach_id) {
      throw new Error('La playa es obligatoria');
    }
    if (!point.name) {
      throw new Error('El nombre es obligatorio');
    }
    if (point.lat == null || point.lng == null || Number.isNaN(point.lat) || Number.isNaN(point.lng)) {
      throw new Error('Las coordenadas son obligatorias');
    }
    if (point.lat < -90 || point.lat > 90 || point.lng < -180 || point.lng > 180) {
      throw new Error('Las coordenadas no son válidas');
    }

    let duplicateQuery = this.supabase
      .from('beach_points')
      .select('id', { count: 'exact', head: true })
      .eq('beach_id', point.beach_id)
      .ilike('name', point.name);
    if (payload.id) {
      duplicateQuery = duplicateQuery.neq('id', payload.id);
    }
    const { count: duplicateCount, error: duplicateError } = await duplicateQuery;
    if (duplicateError) throw duplicateError;
    if ((duplicateCount ?? 0) > 0) {
      throw new Error('Ya existe un punto con ese nombre en esta playa');
    }

    if (payload.id) {
      const { error } = await this.supabase.from('beach_points').update(point).eq('id', payload.id);
      if (error) throw error;
      return;
    }
    const { error } = await this.supabase.from('beach_points').insert(point);
    if (error) throw error;
  }

  async deletePoint(id: string): Promise<void> {
    const { error } = await this.supabase.from('beach_points').delete().eq('id', id);
    if (error) throw error;
  }

  async listCommercesForCoverage(): Promise<Array<{ id: string; name: string; is_beach_delivery: boolean }>> {
    const { data, error } = await this.supabase
      .from('commerces')
      .select('id, name, is_beach_delivery')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return (data ?? []) as Array<{ id: string; name: string; is_beach_delivery: boolean }>;
  }

  /** Distinct count of commerces that have at least one beach coverage row, across all beaches. */
  async countCommercesWithCoverage(): Promise<number> {
    const { data, error } = await this.supabase
      .from('commerce_beach_coverage')
      .select('commerce_id');
    if (error) throw error;
    const uniqueIds = new Set(((data ?? []) as any[]).map((row) => row.commerce_id as string));
    return uniqueIds.size;
  }

  async getCoverageByCommerce(commerceId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('commerce_beach_coverage')
      .select('beach_id')
      .eq('commerce_id', commerceId);
    if (error) throw error;
    return ((data ?? []) as any[]).map((row) => row.beach_id as string);
  }

  async saveCoverage(commerceId: string, beachIds: string[]): Promise<void> {
    const current = await this.getCoverageByCommerce(commerceId);
    const toAdd = beachIds.filter((id) => !current.includes(id));
    const toRemove = current.filter((id) => !beachIds.includes(id));

    if (toAdd.length > 0) {
      const { error } = await this.supabase
        .from('commerce_beach_coverage')
        .insert(toAdd.map((beachId) => ({ commerce_id: commerceId, beach_id: beachId })));
      if (error) throw error;
    }

    if (toRemove.length > 0) {
      const { error } = await this.supabase
        .from('commerce_beach_coverage')
        .delete()
        .eq('commerce_id', commerceId)
        .in('beach_id', toRemove);
      if (error) throw error;
    }
  }
}
