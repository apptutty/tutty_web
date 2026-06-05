import { Injectable, signal } from '@angular/core';
import { Observable, from } from 'rxjs';
import { getSupabaseClient } from '../../../core/supabase/supabase.client';
import { MenuItem, MenuCategory, ProductVariant } from '../../../core/supabase/database.types';

export interface ProductFilters {
  categoryId?: string | null;
  search?: string;
  onlyAvailable?: boolean;
  onlyOutOfStock?: boolean;
  onlyDiscounted?: boolean;
  onlyFeatured?: boolean;
}

export interface CsvImportResult {
  success: number;
  errors: string[];
}

@Injectable({ providedIn: 'root' })
export class StoreCatalogService {
  private readonly supabase = getSupabaseClient();

  readonly isLoading = signal(false);

  // ─── Categories ────────────────────────────────────────────────────────────

  getCategories(storeId: string): Observable<MenuCategory[]> {
    return from(
      this.supabase
        .from('menu_categories')
        .select('*')
        .eq('commerce_id', storeId)
        .order('display_order', { ascending: true })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as MenuCategory[];
        }),
    );
  }

  async createCategory(storeId: string, name: string): Promise<MenuCategory> {
    const { data: existing } = await this.supabase
      .from('menu_categories')
      .select('display_order')
      .eq('commerce_id', storeId)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (existing?.display_order ?? 0) + 1;

    const { data, error } = await this.supabase
      .from('menu_categories')
      .insert({ commerce_id: storeId, name, display_order: nextOrder, is_active: true })
      .select()
      .single();

    if (error) throw error;
    return data as MenuCategory;
  }

  async updateCategory(id: string, patch: Partial<MenuCategory>): Promise<void> {
    const { error } = await this.supabase
      .from('menu_categories')
      .update(patch)
      .eq('id', id);
    if (error) throw error;
  }

  async reorderCategories(items: { id: string; display_order: number }[]): Promise<void> {
    await Promise.all(
      items.map(({ id, display_order }) =>
        this.supabase.from('menu_categories').update({ display_order }).eq('id', id),
      ),
    );
  }

  // ─── Products ──────────────────────────────────────────────────────────────

  getProducts(storeId: string, filters: ProductFilters = {}): Observable<MenuItem[]> {
    return from(this.fetchProducts(storeId, filters));
  }

  private async fetchProducts(storeId: string, filters: ProductFilters): Promise<MenuItem[]> {
    let query = this.supabase
      .from('menu_items')
      .select('*')
      .eq('commerce_id', storeId)
      .order('display_order', { ascending: true });

    if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
    if (filters.search) query = query.ilike('name', `%${filters.search}%`);
    if (filters.onlyAvailable) query = query.eq('is_available', true);
    if (filters.onlyOutOfStock) query = query.eq('track_stock', true).eq('stock_count', 0);
    if (filters.onlyDiscounted) query = query.not('discount_price', 'is', null);
    if (filters.onlyFeatured) query = query.eq('is_featured', true);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as MenuItem[];
  }

  getProductById(id: string): Observable<MenuItem> {
    return from(
      this.supabase
        .from('menu_items')
        .select('*')
        .eq('id', id)
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return data as MenuItem;
        }),
    );
  }

  async createProduct(storeId: string, payload: Partial<MenuItem>): Promise<MenuItem> {
    const { data, error } = await this.supabase
      .from('menu_items')
      .insert({ ...payload, commerce_id: storeId })
      .select()
      .single();
    if (error) throw error;
    return data as MenuItem;
  }

  async updateProduct(id: string, payload: Partial<MenuItem>): Promise<void> {
    const { error } = await this.supabase
      .from('menu_items')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  async toggleProductAvailability(id: string, isAvailable: boolean): Promise<void> {
    const { error } = await this.supabase
      .from('menu_items')
      .update({ is_available: isAvailable })
      .eq('id', id);
    if (error) throw error;
  }

  async deleteProduct(id: string): Promise<void> {
    const { error } = await this.supabase.from('menu_items').delete().eq('id', id);
    if (error) throw error;
  }

  // ─── Image upload ──────────────────────────────────────────────────────────

  async uploadProductImage(file: File, storeId: string): Promise<string> {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `stores/${storeId}/products/${crypto.randomUUID()}.${ext}`;
    const { error } = await this.supabase.storage.from('media').upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (error) throw error;
    const { data } = this.supabase.storage.from('media').getPublicUrl(path);
    return data.publicUrl;
  }

  // ─── Variants ──────────────────────────────────────────────────────────────

  getVariants(productId: string): Observable<ProductVariant[]> {
    return from(
      this.supabase
        .from('product_variants')
        .select('*')
        .eq('menu_item_id', productId)
        .order('id')
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as ProductVariant[];
        }),
    );
  }

  async saveVariants(productId: string, variants: Partial<ProductVariant>[]): Promise<void> {
    // Delete existing and re-insert (simplest strategy for small variant sets)
    const { error: delError } = await this.supabase
      .from('product_variants')
      .delete()
      .eq('menu_item_id', productId);
    if (delError) throw delError;

    if (variants.length === 0) return;

    const { error: insError } = await this.supabase
      .from('product_variants')
      .insert(variants.map(v => ({ ...v, menu_item_id: productId })));
    if (insError) throw insError;
  }

  // ─── Bulk CSV import ───────────────────────────────────────────────────────

  async bulkImport(storeId: string, rows: Partial<MenuItem>[]): Promise<CsvImportResult> {
    const valid = rows.filter(r => r.name && r.price != null);
    const errors = rows
      .filter(r => !r.name || r.price == null)
      .map((_, i) => `Fila ${i + 1}: nombre o precio faltante`);

    if (valid.length === 0) return { success: 0, errors };

    const toInsert = valid.map(r => ({
      ...r,
      commerce_id: storeId,
      is_available: r.is_available ?? true,
      is_featured: r.is_featured ?? false,
      track_stock: r.track_stock ?? false,
      tags: r.tags ?? [],
      display_order: r.display_order ?? 0,
    }));

    const { error } = await this.supabase.from('menu_items').insert(toInsert);
    if (error) throw error;

    return { success: valid.length, errors };
  }
}
