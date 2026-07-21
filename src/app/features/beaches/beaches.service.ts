import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../../core/supabase/supabase.client';

export interface BeachRow {
  id: string;
  name: string;
  city: string | null;
  sector: string | null;
  is_active: boolean;
  points_count: number;
  commerces_count: number;
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
      .select('id, name, city, sector, is_active, beach_points(count), commerce_beach_coverage(count)')
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
    }));
  }

  async saveBeach(payload: Partial<BeachRow>): Promise<void> {
    const data = {
      name: payload.name?.trim(),
      city: payload.city?.trim() || null,
      sector: payload.sector?.trim() || null,
      is_active: payload.is_active ?? true,
    };
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
