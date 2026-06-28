import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import {
  MediaAsset,
  MediaAssetLink,
  MediaEntityType,
  MediaKind,
  EntityMedia,
} from '../../core/supabase/database.types';

export interface ListAssetsFilters {
  commerceId?: string;
  operatorId?: string;
  kind?: MediaKind;
  isArchived?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface UpdateAssetMetadata {
  displayName?: string | null;
  altText?: string | null;
  caption?: string | null;
}

/**
 * Admin media library service.
 *
 * Wraps the `media_assets` / `media_asset_links` tables and the
 * `assign_media_as_primary` / `get_entity_media` RPCs.
 *
 * NOT intended for mobile customer use — see AvatarUploadService.
 */
@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly client = getSupabaseClient();

  // ── Listing ────────────────────────────────────────────────────────────────

  async listAssets(filters: ListAssetsFilters = {}): Promise<MediaAsset[]> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 48;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = this.client
      .from('media_assets')
      .select('*')
      .eq('is_archived', filters.isArchived ?? false)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filters.commerceId) q = q.eq('commerce_id', filters.commerceId);
    if (filters.operatorId) q = q.eq('operator_id', filters.operatorId);
    if (filters.kind) q = q.eq('kind', filters.kind);
    if (filters.search) {
      q = q.or(
        `display_name.ilike.%${filters.search}%,original_filename.ilike.%${filters.search}%`,
      );
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data as MediaAsset[]) ?? [];
  }

  async getAssetById(id: string): Promise<MediaAsset | null> {
    const { data, error } = await this.client
      .from('media_assets')
      .select('*')
      .eq('id', id)
      .single<MediaAsset>();

    if (error) throw new Error(error.message);
    return data;
  }

  // ── Metadata ───────────────────────────────────────────────────────────────

  async updateAssetMetadata(id: string, meta: UpdateAssetMetadata): Promise<void> {
    const patch: Record<string, unknown> = {};
    if ('displayName' in meta) patch['display_name'] = meta.displayName;
    if ('altText' in meta) patch['alt_text'] = meta.altText;
    if ('caption' in meta) patch['caption'] = meta.caption;

    const { error } = await this.client.from('media_assets').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async archiveAsset(id: string): Promise<void> {
    const { error } = await this.client
      .from('media_assets')
      .update({ is_archived: true })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  // ── Assignment via RPC ─────────────────────────────────────────────────────

  /**
   * Assigns a media asset as primary for an entity using the
   * `assign_media_as_primary` Postgres RPC.
   *
   * The RPC also updates the direct URL column on the entity table
   * (e.g. `commerces.logo_url`, `menu_items.photo_url`, `excursions.cover_url`).
   */
  async assignAsPrimary(
    assetId: string,
    entityType: MediaEntityType,
    entityId: string,
    role: string,
  ): Promise<void> {
    const { error } = await this.client.rpc('assign_media_as_primary', {
      p_media_asset_id: assetId,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_role: role,
    });
    if (error) throw new Error(error.message);
  }

  /**
   * Adds a media asset to an entity's gallery (non-primary link).
   */
  async linkAssetToEntity(
    assetId: string,
    entityType: MediaEntityType,
    entityId: string,
    role: string,
    displayOrder = 0,
  ): Promise<MediaAssetLink> {
    const { data, error } = await this.client
      .from('media_asset_links')
      .insert({
        media_asset_id: assetId,
        entity_type: entityType,
        entity_id: entityId,
        role,
        display_order: displayOrder,
        is_primary: false,
      })
      .select()
      .single<MediaAssetLink>();

    if (error) throw new Error(error.message);
    return data!;
  }

  async unlinkAsset(linkId: string): Promise<void> {
    const { error } = await this.client
      .from('media_asset_links')
      .delete()
      .eq('id', linkId);
    if (error) throw new Error(error.message);
  }

  async reorderGallery(
    entityType: MediaEntityType,
    entityId: string,
    orderedLinkIds: string[],
  ): Promise<void> {
    const updates = orderedLinkIds.map((id, idx) =>
      this.client
        .from('media_asset_links')
        .update({ display_order: idx })
        .eq('id', id)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId),
    );
    await Promise.all(updates);
  }

  // ── Gallery retrieval via RPC ──────────────────────────────────────────────

  /**
   * Returns the full media gallery for an entity using the
   * `get_entity_media` Postgres RPC.
   */
  async getEntityMedia(
    entityType: MediaEntityType,
    entityId: string,
  ): Promise<EntityMedia[]> {
    const { data, error } = await this.client.rpc('get_entity_media', {
      p_entity_type: entityType,
      p_entity_id: entityId,
    });
    if (error) throw new Error(error.message);
    return (data as EntityMedia[]) ?? [];
  }

  // ── Public URL helper ──────────────────────────────────────────────────────

  getPublicUrl(bucket: string, path: string): string {
    const { data } = this.client.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }
}
