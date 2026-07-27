import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import { LatLng } from '../../shared/ui/map/tutty-map.component';
import { DeliveryArea } from '../../core/supabase/database.types';

export interface DeliveryAreaRow extends DeliveryArea {
  has_boundary: boolean;
}

/**
 * Nivel 1 (delivery_areas) — the absolute ceiling of where the app delivers at all, and
 * Nivel 2 (commerce_area_coverage) — explicit authorization for "special" areas
 * (requires_special_driver = true, e.g. gated residential communities).
 *
 * All writes to the area definition itself (fields + boundary) are super-admin only per
 * the `033_delivery_zones_write_policy` migration already applied in production.
 */
@Injectable({ providedIn: 'root' })
export class DeliveryAreasService {
  private readonly supabase = getSupabaseClient();

  async listAreas(): Promise<DeliveryAreaRow[]> {
    const { data, error } = await this.supabase
      .from('delivery_areas')
      .select('id, name, slug, description, base_fee, radius_km, lat_center, lng_center, color, display_order, is_active, requires_special_driver, special_fee_multiplier, created_at, boundary')
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as any[]).map((row) => ({
      ...row,
      has_boundary: row.boundary != null,
    }));
  }

  private slugify(name: string): string {
    return name
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  async saveArea(payload: Partial<DeliveryAreaRow>): Promise<void> {
    const name = payload.name?.trim();
    if (!name) throw new Error('El nombre es obligatorio');

    const data = {
      name,
      slug: payload.slug?.trim() || this.slugify(name),
      description: payload.description?.trim() || null,
      base_fee: payload.base_fee ?? 0,
      radius_km: payload.radius_km ?? null,
      lat_center: payload.lat_center ?? null,
      lng_center: payload.lng_center ?? null,
      color: payload.color?.trim() || '#FF3C97',
      display_order: payload.display_order ?? null,
      is_active: payload.is_active ?? true,
      requires_special_driver: payload.requires_special_driver ?? false,
      special_fee_multiplier: payload.special_fee_multiplier ?? 1,
    };

    let duplicateQuery = this.supabase
      .from('delivery_areas')
      .select('id', { count: 'exact', head: true })
      .ilike('name', name);
    if (payload.id) duplicateQuery = duplicateQuery.neq('id', payload.id);
    const { count: duplicateCount, error: duplicateError } = await duplicateQuery;
    if (duplicateError) throw duplicateError;
    if ((duplicateCount ?? 0) > 0) throw new Error('Ya existe una zona global con ese nombre');

    if (payload.id) {
      const { error } = await this.supabase.from('delivery_areas').update(data).eq('id', payload.id);
      if (error) throw error;
      return;
    }
    const { error } = await this.supabase.from('delivery_areas').insert(data);
    if (error) throw error;
  }

  async deleteArea(id: string): Promise<void> {
    const { error } = await this.supabase.from('delivery_areas').delete().eq('id', id);
    if (error) throw error;
  }

  /** Boundary vertices ({lat,lng}[]) for an area, or null if not delimited yet. */
  async getAreaBoundary(areaId: string): Promise<LatLng[] | null> {
    const { data, error } = await this.supabase.rpc('get_delivery_area_boundary', { p_area_id: areaId });
    if (error) throw error;
    return (data as LatLng[] | null) ?? null;
  }

  /** Saves (or clears, when vertices is an empty array) the polygon boundary for an area. */
  async saveAreaBoundary(areaId: string, vertices: LatLng[]): Promise<void> {
    const { error } = await this.supabase.rpc('save_delivery_area_boundary', {
      p_area_id: areaId,
      p_vertices: vertices,
    });
    if (error) throw error;
  }

  async listCommercesForCoverage(): Promise<Array<{ id: string; name: string }>> {
    const { data, error } = await this.supabase
      .from('commerces')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return (data ?? []) as Array<{ id: string; name: string }>;
  }

  /** Special-area ids (requires_special_driver = true) that a given commerce is authorized for. */
  async getCommerceAreaCoverage(commerceId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('commerce_area_coverage')
      .select('area_id')
      .eq('commerce_id', commerceId);
    if (error) throw error;
    return ((data ?? []) as any[]).map((row) => row.area_id as string);
  }

  /** Distinct count of commerces authorized for at least one special area. */
  async countCommercesWithAreaCoverage(): Promise<number> {
    const { data, error } = await this.supabase.from('commerce_area_coverage').select('commerce_id');
    if (error) throw error;
    return new Set(((data ?? []) as any[]).map((row) => row.commerce_id as string)).size;
  }

  /** Full replace of the special-area authorization set for one commerce. */
  async saveCommerceAreaCoverage(commerceId: string, areaIds: string[]): Promise<void> {
    const { error } = await this.supabase.rpc('save_commerce_area_coverage', {
      p_commerce_id: commerceId,
      p_area_ids: areaIds,
    });
    if (error) throw error;
  }
}
