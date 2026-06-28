import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import { validateImageFile, safePath, ALLOWED_IMAGE_TYPES } from '../utils/media-utils';
import { MediaAsset, MediaKind } from '../../core/supabase/database.types';

export interface UploadOptions {
  /** Storage bucket name (e.g., 'restaurants', 'menu-items', 'avatars'). */
  bucket: string;
  /** Full path within the bucket (e.g., 'abc123/logo/uuid.webp'). */
  path: string;
  /** Maximum file size in MB. Defaults to 5. */
  maxSizeMb?: number;
  /** Allowed MIME types. Defaults to common image types. */
  allowedTypes?: readonly string[];
}

export interface RegisterAssetOptions {
  commerceId?: string | null;
  operatorId?: string | null;
  kind: MediaKind;
  displayName?: string | null;
  altText?: string | null;
}

export interface UploadResult {
  publicUrl: string;
}

export interface UploadAndRegisterResult {
  publicUrl: string;
  asset: MediaAsset;
}

/**
 * Centralised Supabase Storage upload service for the Admin web.
 *
 * Bucket / path conventions (must match Supabase Storage RLS policies):
 *   restaurants/{commerce_id}/logo/{uuid}.webp
 *   restaurants/{commerce_id}/cover/{uuid}.webp
 *   restaurants/{commerce_id}/gallery/{uuid}.webp
 *   menu-items/{commerce_id}/products/{product_id}/{uuid}.webp
 *   excursions/{operator_id}/covers/{uuid}.webp
 *   excursions/{operator_id}/gallery/{uuid}.webp
 */
@Injectable({ providedIn: 'root' })
export class StorageUploadService {
  private readonly client = getSupabaseClient();

  /**
   * Validates and uploads a file to Supabase Storage.
   * Returns the public URL. Does NOT register in media_assets.
   * Throws a human-readable Error if validation fails or upload errors.
   */
  async upload(file: File, options: UploadOptions): Promise<UploadResult> {
    const maxMb = options.maxSizeMb ?? 5;
    const allowedTypes = options.allowedTypes ?? ALLOWED_IMAGE_TYPES;

    const validationError = validateImageFile(file, maxMb, allowedTypes);
    if (validationError) throw new Error(validationError.message);

    const { error } = await this.client.storage
      .from(options.bucket)
      .upload(options.path, file, { upsert: true, contentType: file.type });

    if (error) throw new Error(`Error al subir imagen: ${error.message}`);

    const { data } = this.client.storage.from(options.bucket).getPublicUrl(options.path);
    return { publicUrl: data.publicUrl };
  }

  /**
   * Validates, uploads, AND registers the asset in the `media_assets` table.
   * Use this in all admin flows so images are tracked and reusable.
   * Requires the user to be authenticated (RLS).
   */
  async uploadAndRegister(
    file: File,
    options: UploadOptions,
    register: RegisterAssetOptions,
  ): Promise<UploadAndRegisterResult> {
    const { publicUrl } = await this.upload(file, options);

    const { data: authData } = await this.client.auth.getUser();
    const userId = authData.user?.id ?? null;

    const { data: asset, error: insertError } = await this.client
      .from('media_assets')
      .insert({
        bucket: options.bucket,
        path: options.path,
        public_url: publicUrl,
        commerce_id: register.commerceId ?? null,
        operator_id: register.operatorId ?? null,
        uploaded_by: userId,
        kind: register.kind,
        mime_type: file.type,
        size_bytes: file.size,
        original_filename: file.name,
        display_name: register.displayName ?? null,
        alt_text: register.altText ?? null,
      })
      .select()
      .single<MediaAsset>();

    if (insertError) {
      // Upload succeeded; return URL even if media_assets insert fails
      console.warn('media_assets insert failed:', insertError.message);
      return { publicUrl, asset: { id: '', public_url: publicUrl } as MediaAsset };
    }

    return { publicUrl, asset: asset! };
  }

  // ── Path builders (aligned with Supabase Storage RLS policies) ─────────────

  /** `restaurants/{commerceId}/logo/{uuid}.webp` */
  logoPath(commerceId: string): string {
    return `${commerceId}/logo/${crypto.randomUUID()}.webp`;
  }

  /** `restaurants/{commerceId}/cover/{uuid}.webp` */
  coverPath(commerceId: string): string {
    return `${commerceId}/cover/${crypto.randomUUID()}.webp`;
  }

  /** `restaurants/{commerceId}/gallery/{uuid}.webp` */
  galleryPath(commerceId: string): string {
    return `${commerceId}/gallery/${crypto.randomUUID()}.webp`;
  }

  /** `menu-items/{commerceId}/products/{productId}/{uuid}.webp` */
  productImagePath(commerceId: string, productId: string): string {
    return `${commerceId}/products/${productId}/${crypto.randomUUID()}.webp`;
  }

  /** `menu-items/{commerceId}/products/new/{uuid}.webp` (pre-create) */
  newProductImagePath(commerceId: string): string {
    return `${commerceId}/products/new/${crypto.randomUUID()}.webp`;
  }

  /** `excursions/{operatorId}/covers/{uuid}.webp` */
  excursionCoverPath(operatorId: string): string {
    return `${operatorId}/covers/${crypto.randomUUID()}.webp`;
  }

  /** `excursions/{operatorId}/gallery/{uuid}.webp` */
  excursionGalleryPath(operatorId: string): string {
    return `${operatorId}/gallery/${crypto.randomUUID()}.webp`;
  }

  /** Returns a safe, lowercase path segment from a raw filename. */
  safePath(filename: string): string {
    return safePath(filename);
  }

  /**
   * @deprecated Use typed path builders (logoPath, coverPath, etc.) instead.
   */
  buildStorePath(storeId: string, type: string, mimeType: string): string {
    const ext = mimeType.split('/')[1] ?? 'jpg';
    return `${storeId}/${type}/${crypto.randomUUID()}.${ext}`;
  }

  /**
   * @deprecated Use productImagePath() instead.
   */
  buildProductPath(storeId: string, productId: string, mimeType: string): string {
    const ext = mimeType.split('/')[1] ?? 'jpg';
    return `${storeId}/products/${productId}/${crypto.randomUUID()}.${ext}`;
  }
}
