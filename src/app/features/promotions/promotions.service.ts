import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import { StorageUploadService } from '../../shared/services/storage-upload.service';

@Injectable({ providedIn: 'root' })
export class PromotionsService {
  private readonly supabase = getSupabaseClient();
  private readonly storageUploadService = inject(StorageUploadService);

  getPromotions(): Observable<HomePromo[]> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('promos')
          .select('*')
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        return (data ?? []) as HomePromo[];
      })()
    );
  }

  async createPromotion(payload: HomePromoInsert): Promise<HomePromo> {
    const { data, error } = await this.supabase
      .from('promos')
      .insert(payload)
      .select()
      .single<HomePromo>();

    if (error || !data) {
      throw error ?? new Error('No se pudo crear la promo');
    }

    return data;
  }

  async updatePromotion(id: string, payload: HomePromoUpdate): Promise<HomePromo> {
    const { data, error } = await this.supabase
      .from('promos')
      .update(payload)
      .eq('id', id)
      .select()
      .single<HomePromo>();

    if (error || !data) {
      throw error ?? new Error('No se pudo actualizar la promo');
    }

    return data;
  }

  async deletePromotion(id: string): Promise<void> {
    const { error } = await this.supabase.from('promos').delete().eq('id', id);
    if (error) {
      throw error;
    }
  }

  async togglePromotion(id: string, isActive: boolean): Promise<void> {
    const { error } = await this.supabase
      .from('promos')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async uploadPromoImage(file: File): Promise<string> {
    const extension = this.resolveExtension(file);
    const path = `promos/${crypto.randomUUID()}.${extension}`;
    const { publicUrl } = await this.storageUploadService.upload(file, {
      bucket: 'media',
      path,
      maxSizeMb: 8,
    });
    return publicUrl;
  }

  private resolveExtension(file: File): string {
    const rawExt = file.name.includes('.') ? file.name.split('.').pop() : file.type.split('/').pop();
    const normalized = (rawExt ?? 'webp').toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalized || 'webp';
  }

  async getPromotionTranslations(promoId: string): Promise<PromoTranslationMap> {
    const { data, error } = await this.supabase
      .from('entity_translations')
      .select('field, lang, value')
      .eq('entity_type', 'promo')
      .eq('entity_id', promoId);

    if (error) {
      throw error;
    }

    const empty = createEmptyPromoTranslationMap();
    for (const row of data ?? []) {
      const field = this.asTranslationField((row as { field?: string }).field);
      const lang = this.asTranslationLang((row as { lang?: string }).lang);
      const value = typeof (row as { value?: unknown }).value === 'string'
        ? ((row as { value: string }).value ?? '')
        : '';
      if (!field || !lang) {
        continue;
      }
      empty[field][lang] = value;
    }
    return empty;
  }

  async savePromotionTranslations(promoId: string, translations: PromoTranslationMap): Promise<void> {
    const upserts: Array<Record<string, unknown>> = [];
    const deletes: Array<{ field: PromoTranslationField; lang: PromoTranslationLang }> = [];

    for (const field of PROMO_TRANSLATION_FIELDS) {
      for (const lang of PROMO_TRANSLATION_LANGS) {
        const value = (translations[field][lang] ?? '').trim();
        if (value) {
          upserts.push({
            entity_type: 'promo',
            entity_id: promoId,
            field,
            lang,
            value,
          });
        } else {
          deletes.push({ field, lang });
        }
      }
    }

    if (upserts.length > 0) {
      const { error } = await this.supabase
        .from('entity_translations')
        .upsert(upserts, { onConflict: 'entity_type,entity_id,field,lang' });
      if (error) {
        throw error;
      }
    }

    await Promise.all(
      deletes.map(async ({ field, lang }) => {
        const { error } = await this.supabase
          .from('entity_translations')
          .delete()
          .eq('entity_type', 'promo')
          .eq('entity_id', promoId)
          .eq('field', field)
          .eq('lang', lang);
        if (error) {
          throw error;
        }
      })
    );
  }

  async getTranslationCoverage(promoIds: string[]): Promise<Record<string, number>> {
    if (promoIds.length === 0) {
      return {};
    }

    const { data, error } = await this.supabase
      .from('entity_translations')
      .select('entity_id, field, lang')
      .eq('entity_type', 'promo')
      .in('entity_id', promoIds)
      .in('field', [...PROMO_TRANSLATION_FIELDS])
      .in('lang', [...PROMO_TRANSLATION_LANGS]);

    if (error) {
      throw error;
    }

    const seenByPromo: Record<string, Set<string>> = {};
    for (const promoId of promoIds) {
      seenByPromo[promoId] = new Set<string>();
    }

    for (const row of data ?? []) {
      const promoId = typeof (row as { entity_id?: unknown }).entity_id === 'string'
        ? ((row as { entity_id: string }).entity_id ?? '')
        : '';
      const field = this.asTranslationField((row as { field?: string }).field);
      const lang = this.asTranslationLang((row as { lang?: string }).lang);
      if (!promoId || !field || !lang || !seenByPromo[promoId]) {
        continue;
      }
      seenByPromo[promoId].add(`${field}:${lang}`);
    }

    const totalRequired = PROMO_TRANSLATION_FIELDS.length * PROMO_TRANSLATION_LANGS.length;
    const missingByPromo: Record<string, number> = {};
    for (const promoId of promoIds) {
      missingByPromo[promoId] = totalRequired - seenByPromo[promoId].size;
    }
    return missingByPromo;
  }

  private asTranslationField(value: string | undefined): PromoTranslationField | null {
    if (value === 'name' || value === 'description' || value === 'caption' || value === 'label') {
      return value;
    }
    return null;
  }

  private asTranslationLang(value: string | undefined): PromoTranslationLang | null {
    if (value === 'en' || value === 'fr' || value === 'it') {
      return value;
    }
    return null;
  }
}

export type PromoCategory = 'food' | 'beach' | 'experiences' | 'transport' | 'all';
export type PromoTargetType = 'catalog' | 'excursions' | 'commerce' | 'support' | 'external';
export type PromoFormLanguage = 'es' | PromoTranslationLang;
export type PromoTranslationField = 'name' | 'description' | 'caption' | 'label';
export type PromoTranslationLang = 'en' | 'fr' | 'it';

export const PROMO_TRANSLATION_FIELDS: readonly PromoTranslationField[] = [
  'name',
  'description',
  'caption',
  'label',
] as const;

export const PROMO_TRANSLATION_LANGS: readonly PromoTranslationLang[] = [
  'en',
  'fr',
  'it',
] as const;

export type PromoTranslationMap = Record<PromoTranslationField, Record<PromoTranslationLang, string>>;

export interface HomePromo {
  id: string;
  title: string;
  description: string | null;
  badge: string | null;
  category: PromoCategory;
  color_tone: string | null;
  cta_label: string | null;
  cta_target_type: PromoTargetType;
  cta_target_value: string | null;
  image_url: string | null;
  priority: number;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
}

export type HomePromoInsert = Omit<HomePromo, 'id' | 'created_at'>;
export type HomePromoUpdate = Partial<HomePromoInsert>;

export function createEmptyPromoTranslationMap(): PromoTranslationMap {
  return {
    name: { en: '', fr: '', it: '' },
    description: { en: '', fr: '', it: '' },
    caption: { en: '', fr: '', it: '' },
    label: { en: '', fr: '', it: '' },
  };
}
