import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import { LatLng } from '../../shared/ui/map/tutty-map.component';
import { DeliveryZone } from '../../core/supabase/database.types';

export interface GlobalZoneRow extends DeliveryZone {
  has_boundary: boolean;
  area_name?: string | null;
}

/**
 * Nivel 3 (delivery_zones, global) — sub-zonas dentro de una delivery_area (Nivel 1)
 * con su propia tarifa/tiempo estimado, sin atarse a un comercio (`commerce_id = null`).
 * La cobertura de un comercio a una de estas zonas se autoriza aparte, vía
 * `commerce_delivery_zone_coverage` (full-replace con `save_commerce_delivery_zone_coverage`).
 *
 * Las zonas "legacy" (con `commerce_id` fijo, creadas desde
 * `restaurants/:id/zones`) siguen existiendo y no se tocan aquí — ambos modelos
 * conviven hasta que se migren los datos legacy.
 */
@Injectable({ providedIn: 'root' })
export class DeliveryZonesGlobalService {
  private readonly supabase = getSupabaseClient();

  async listAreasForSelect(): Promise<Array<{ id: string; name: string }>> {
    const { data, error } = await this.supabase
      .from('delivery_areas')
      .select('id, name')
      .order('name');
    if (error) throw error;
    return (data ?? []) as Array<{ id: string; name: string }>;
  }

  async listGlobalZones(): Promise<GlobalZoneRow[]> {
    const { data, error } = await this.supabase
      .from('delivery_zones')
      .select('id, name, sector_list, delivery_fee, min_order, estimated_time, max_distance_km, extra_km_fee, available_from, available_until, priority, is_active, area_id, boundary, delivery_areas(name)')
      .is('commerce_id', null)
      .order('priority');
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ...(row as unknown as DeliveryZone),
      has_boundary: row['boundary'] != null,
      area_name: (row['delivery_areas'] as { name?: string } | null)?.name ?? null,
    }));
  }

  async saveZone(payload: Partial<GlobalZoneRow>): Promise<void> {
    const name = payload.name?.trim();
    if (!name) throw new Error('El nombre es obligatorio');

    const data = {
      name,
      commerce_id: null,
      area_id: payload.area_id || null,
      sector_list: payload.sector_list ?? [],
      delivery_fee: payload.delivery_fee ?? 0,
      min_order: payload.min_order ?? 0,
      estimated_time: payload.estimated_time ?? 30,
      max_distance_km: payload.max_distance_km ?? null,
      extra_km_fee: payload.extra_km_fee ?? 0,
      priority: payload.priority ?? 1,
      available_from: payload.available_from ?? null,
      available_until: payload.available_until ?? null,
      is_active: payload.is_active ?? true,
    };

    if (payload.id) {
      const { error } = await this.supabase.from('delivery_zones').update(data).eq('id', payload.id);
      if (error) throw error;
      return;
    }
    const { error } = await this.supabase.from('delivery_zones').insert(data);
    if (error) throw error;
  }

  async deleteZone(id: string): Promise<void> {
    const { error } = await this.supabase.from('delivery_zones').delete().eq('id', id);
    if (error) throw error;
  }

  /** Boundary vertices ({lat,lng}[]) for a zone, or null if not delimited yet. */
  async getZoneBoundary(zoneId: string): Promise<LatLng[] | null> {
    const { data, error } = await this.supabase.rpc('get_delivery_zone_boundary', { p_zone_id: zoneId });
    if (error) throw error;
    return (data as LatLng[] | null) ?? null;
  }

  /** Saves (or clears, when vertices is an empty array) the polygon boundary for a zone. */
  async saveZoneBoundary(zoneId: string, vertices: LatLng[]): Promise<void> {
    const { error } = await this.supabase.rpc('save_delivery_zone_boundary', {
      p_zone_id: zoneId,
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

  /** Global-zone ids a given commerce is authorized to deliver in. */
  async getCommerceZoneCoverage(commerceId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('commerce_delivery_zone_coverage')
      .select('zone_id')
      .eq('commerce_id', commerceId);
    if (error) throw error;
    return ((data ?? []) as Array<{ zone_id: string }>).map((row) => row.zone_id);
  }

  /** Full replace of the zone-coverage set for one commerce. */
  async saveCommerceZoneCoverage(commerceId: string, zoneIds: string[]): Promise<void> {
    const { error } = await this.supabase.rpc('save_commerce_delivery_zone_coverage', {
      p_commerce_id: commerceId,
      p_zone_ids: zoneIds,
    });
    if (error) throw error;
  }

  /** Distinct count of commerces authorized for at least one global zone. */
  async countCommercesWithZoneCoverage(): Promise<number> {
    const { data, error } = await this.supabase.from('commerce_delivery_zone_coverage').select('commerce_id');
    if (error) throw error;
    return new Set(((data ?? []) as Array<{ commerce_id: string }>).map((row) => row.commerce_id)).size;
  }
}
