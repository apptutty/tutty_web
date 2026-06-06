import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { getSupabaseClient } from '../../../core/supabase/supabase.client';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { MenuItem, MenuCategory, ProductVariant } from '../../../core/supabase/database.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModerationStatus = 'aprobado' | 'bajo_revision' | 'retirado';
export type StockStatus = 'disponible' | 'bajo_stock' | 'agotado' | 'no_controlado';

export interface StoreWithCatalogStats {
    id: string;
    name: string;
    commerce_type: string;
    logo_url?: string;
    is_active: boolean;
    is_open: boolean;
    total_products: number;
    active_products: number;
    out_of_stock: number;
    pending_price_approval: number;
    categories_count: number;
    last_catalog_update: string;
}

export interface CatalogProduct extends MenuItem {
    category_name: string;
    in_venue_price?: number;
    price_pending?: number;
    price_pending_notes?: string;
    price_change_pct?: number;
    moderation_status: ModerationStatus;
    variants_count: number;
    stock_status: StockStatus;
}

export interface CatalogFilters {
    category_id?: string;
    search?: string;
    is_available?: boolean;
    moderation_status?: ModerationStatus | 'all';
    has_pending_price?: boolean;
    has_variants?: boolean;
    stock_status?: StockStatus | 'all';
    page: number;
    page_size?: number;
}

export interface PendingPriceItem {
    product_id: string;
    product_name: string;
    product_photo?: string;
    current_price: number;
    pending_price: number;
    pending_notes?: string;
    price_change_pct: number;
    store_id: string;
    store_name: string;
    store_logo?: string;
    submitted_at: string;
}

export interface StoreCombo {
    id: string;
    commerce_id: string;
    name: string;
    description?: string;
    price: number;
    photo_url?: string;
    is_active: boolean;
    available_from?: string;
    available_until?: string;
    items: { menu_item_id: string; name: string; quantity: number }[];
}

export interface CatalogChangeEntry {
    id: string;
    commerce_id: string;
    product_id?: string;
    product_name?: string;
    changed_by_id: string;
    changed_by_name: string;
    change_type: string;
    old_value?: unknown;
    new_value?: unknown;
    notes?: string;
    created_at: string;
}

export interface CreateProductData {
    category_id?: string;
    name: string;
    description?: string;
    price: number;
    discount_price?: number;
    photo_url?: string;
    is_available?: boolean;
    in_venue_price?: number;
    moderation_status?: ModerationStatus;
    dietary_tags?: string[];
    tags?: string[];
    track_stock?: boolean;
    stock_count?: number;
    low_stock_alert?: number;
    sku?: string;
    is_featured?: boolean;
    notify_store?: boolean;
}

export interface ImportResult {
    preview: { row: number; name: string; price: number; category: string; errors: string[] }[];
    total: number;
    valid: number;
    invalid: number;
    committed?: boolean;
    inserted?: number;
}

export interface CatalogStoreFilters {
    commerce_type?: string;
    has_pending_prices?: boolean;
    has_out_of_stock?: boolean;
    search?: string;
}

export interface GlobalSearchFilters {
    query: string;
    commerce_type?: string;
    min_price?: number;
    max_price?: number;
    dietary_tags?: string[];
    moderation_status?: ModerationStatus | 'all';
    low_stock?: boolean;
    pending_price?: boolean;
    page?: number;
    page_size?: number;
}

export interface GlobalSearchResult extends CatalogProduct {
    store_id: string;
    store_name: string;
    store_type: string;
    store_logo?: string;
}

export interface CatalogAnomalies {
    priceGreaterThanVenue: number;
    missingPhoto: number;
    missingDescription: number;
    missingCategory: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeStockStatus(item: MenuItem): StockStatus {
    if (!item.track_stock) return 'no_controlado';
    const count = item.stock_count ?? 0;
    const alert = item.low_stock_alert ?? 5;
    if (count === 0) return 'agotado';
    if (count <= alert) return 'bajo_stock';
    return 'disponible';
}

function csvRow(values: unknown[]): string {
    return values.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class CatalogAdminService {
    private readonly supabase = getSupabaseClient();
    private readonly auth = inject(AuthService);
    private readonly toast = inject(ToastService);

    // ─── getStoresWithCatalogStats ────────────────────────────────────────────

    getStoresWithCatalogStats(filters?: CatalogStoreFilters): Observable<StoreWithCatalogStats[]> {
        return from(this.fetchStoresWithStats(filters));
    }

    private async fetchStoresWithStats(filters?: CatalogStoreFilters): Promise<StoreWithCatalogStats[]> {
        let q = this.supabase
            .from('commerces')
            .select('id, name, commerce_type, logo_url, is_active, is_open')
            .order('name');

        if (filters?.commerce_type) q = q.eq('commerce_type', filters.commerce_type);
        if (filters?.search) q = q.ilike('name', `%${filters.search}%`);

        const { data: stores, error } = await q;
        if (error) throw error;

        const results = await Promise.all(
            (stores ?? []).map(async (store) => {
                const [productsRes, pendingRes, catRes, lastUpdateRes] = await Promise.all([
                    this.supabase.from('menu_items').select('id, is_available, track_stock, stock_count', { count: 'exact' }).eq('commerce_id', store.id),
                    this.supabase.from('menu_items').select('id', { count: 'exact', head: true }).eq('commerce_id', store.id).not('price_pending', 'is', null),
                    this.supabase.from('menu_categories').select('id', { count: 'exact', head: true }).eq('commerce_id', store.id),
                    this.supabase.from('menu_items').select('updated_at').eq('commerce_id', store.id).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
                ]);

                const items = productsRes.data ?? [];
                const total = items.length;
                const active = items.filter(i => i.is_available).length;
                const outOfStock = items.filter(i => i.track_stock && (i.stock_count ?? 0) === 0).length;

                const stat: StoreWithCatalogStats = {
                    id: store.id,
                    name: store.name,
                    commerce_type: store.commerce_type,
                    logo_url: store.logo_url ?? undefined,
                    is_active: store.is_active,
                    is_open: store.is_open,
                    total_products: total,
                    active_products: active,
                    out_of_stock: outOfStock,
                    pending_price_approval: pendingRes.count ?? 0,
                    categories_count: catRes.count ?? 0,
                    last_catalog_update: lastUpdateRes.data?.updated_at ?? store.id,
                };
                return stat;
            })
        );

        let filtered = results;
        if (filters?.has_pending_prices) filtered = filtered.filter(s => s.pending_price_approval > 0);
        if (filters?.has_out_of_stock) filtered = filtered.filter(s => s.out_of_stock > 0);
        return filtered;
    }

    // ─── getCatalog ───────────────────────────────────────────────────────────

    getCatalog(storeId: string, filters: CatalogFilters): Observable<{ data: CatalogProduct[]; count: number }> {
        return from(this.fetchCatalog(storeId, filters));
    }

    private async fetchCatalog(storeId: string, filters: CatalogFilters): Promise<{ data: CatalogProduct[]; count: number }> {
        const pageSize = filters.page_size ?? 30;
        const from_ = (filters.page - 1) * pageSize;
        const to = from_ + pageSize - 1;

        let q = this.supabase
            .from('menu_items')
            .select(
                `*, category:menu_categories(name)`,
                { count: 'exact' }
            )
            .eq('commerce_id', storeId)
            .order('display_order');

        if (filters.category_id) q = q.eq('category_id', filters.category_id);
        if (filters.search) q = q.ilike('name', `%${filters.search}%`);
        if (filters.is_available !== undefined) q = q.eq('is_available', filters.is_available);
        if (filters.moderation_status && filters.moderation_status !== 'all') {
            q = q.eq('moderation_status', filters.moderation_status);
        }
        if (filters.has_pending_price) q = q.not('price_pending', 'is', null);
        if (filters.has_variants) q = q.eq('has_variants', true);
        if (filters.stock_status && filters.stock_status !== 'all') {
            if (filters.stock_status === 'agotado') q = q.eq('track_stock', true).eq('stock_count', 0);
            else if (filters.stock_status === 'no_controlado') q = q.eq('track_stock', false);
        }

        const { data, count, error } = await q.range(from_, to);
        if (error) throw error;

        const products: CatalogProduct[] = (data ?? []).map(raw => {
            const pricePending = (raw as any).price_pending ?? undefined;
            const pricePct = pricePending != null
                ? Math.round(((pricePending - raw.price) / raw.price) * 100)
                : undefined;
            return {
                ...raw,
                category_name: (raw as any).category?.name ?? '—',
                in_venue_price: (raw as any).in_venue_price ?? undefined,
                price_pending: pricePending,
                price_pending_notes: (raw as any).price_pending_notes ?? undefined,
                price_change_pct: pricePct,
                moderation_status: ((raw as any).moderation_status ?? 'aprobado') as ModerationStatus,
                variants_count: (raw as any).variants_count ?? 0,
                stock_status: computeStockStatus(raw as MenuItem),
            };
        });

        return { data: products, count: count ?? 0 };
    }

    // ─── getProduct ───────────────────────────────────────────────────────────

    getProduct(productId: string): Observable<CatalogProduct> {
        return from(
            this.supabase
                .from('menu_items')
                .select(`*, category:menu_categories(name), variants:product_variants(*)`)
                .eq('id', productId)
                .single()
                .then(({ data, error }) => {
                    if (error) throw error;
                    const raw = data as any;
                    const pricePending = raw.price_pending ?? undefined;
                    const pricePct = pricePending != null
                        ? Math.round(((pricePending - raw.price) / raw.price) * 100)
                        : undefined;
                    return {
                        ...raw,
                        category_name: raw.category?.name ?? '—',
                        in_venue_price: raw.in_venue_price ?? undefined,
                        price_pending: pricePending,
                        price_pending_notes: raw.price_pending_notes ?? undefined,
                        price_change_pct: pricePct,
                        moderation_status: (raw.moderation_status ?? 'aprobado') as ModerationStatus,
                        variants_count: (raw.variants ?? []).length,
                        stock_status: computeStockStatus(raw as MenuItem),
                    } as CatalogProduct;
                })
        );
    }

    // ─── createProduct ────────────────────────────────────────────────────────

    async createProduct(storeId: string, data: CreateProductData): Promise<{ product?: CatalogProduct; error?: string }> {
        const user = this.auth.currentUser();
        try {
            const { notify_store, ...fields } = data;
            const { data: row, error } = await this.supabase
                .from('menu_items')
                .insert({
                    ...fields,
                    commerce_id: storeId,
                    is_available: fields.is_available ?? true,
                    moderation_status: fields.moderation_status ?? 'aprobado',
                    display_order: 9999,
                    tags: fields.tags ?? [],
                    has_variants: false,
                    track_stock: fields.track_stock ?? false,
                    is_featured: fields.is_featured ?? false,
                })
                .select(`*, category:menu_categories(name)`)
                .single();

            if (error) return { error: error.message };

            await this.insertChangeLog(storeId, row.id, 'producto_creado', null, { name: row.name, price: row.price }, user?.id);

            if (notify_store) {
                await this.notifyStoreAdmin(storeId, 'Nuevo producto añadido', `El equipo Tutty añadió "${row.name}" a tu catálogo.`, { product_id: row.id });
            }

            const product: CatalogProduct = {
                ...(row as MenuItem),
                category_name: (row as any).category?.name ?? '—',
                moderation_status: ((row as any).moderation_status ?? 'aprobado') as ModerationStatus,
                variants_count: 0,
                stock_status: computeStockStatus(row as MenuItem),
            };
            return { product };
        } catch (e: any) {
            return { error: e?.message ?? 'Error desconocido' };
        }
    }

    // ─── updateProduct ────────────────────────────────────────────────────────

    async updateProduct(productId: string, patch: Partial<MenuItem> & { in_venue_price?: number; moderation_status?: ModerationStatus; dietary_tags?: string[]; notify_store?: boolean }): Promise<{ error?: string }> {
        const user = this.auth.currentUser();
        try {
            const { notify_store, ...fields } = patch as any;

            // Capture old values for log
            const { data: oldData } = await this.supabase
                .from('menu_items')
                .select('price, name, is_available, moderation_status')
                .eq('id', productId)
                .single();

            const { error } = await this.supabase
                .from('menu_items')
                .update({ ...fields, updated_at: new Date().toISOString() })
                .eq('id', productId);

            if (error) return { error: error.message };

            const changeType = patch.price !== undefined && patch.price !== oldData?.price
                ? 'precio_actualizado'
                : 'producto_editado';

            const storeRes = await this.supabase.from('menu_items').select('commerce_id').eq('id', productId).single();
            const storeId = storeRes.data?.commerce_id;
            if (storeId) {
                await this.insertChangeLog(storeId, productId, changeType, oldData, fields, user?.id);
                if (notify_store) {
                    await this.notifyStoreAdmin(storeId, 'Producto actualizado', `El equipo Tutty actualizó "${oldData?.name}".`, { product_id: productId });
                }
            }
            return {};
        } catch (e: any) {
            return { error: e?.message ?? 'Error desconocido' };
        }
    }

    // ─── approvePendingPrice ──────────────────────────────────────────────────

    async approvePendingPrice(productId: string, notes?: string): Promise<void> {
        const user = this.auth.currentUser();
        const { data: item } = await this.supabase
            .from('menu_items')
            .select('price, price_pending, name, commerce_id')
            .eq('id', productId)
            .single();

        if (!item?.price_pending) return;

        const { error } = await this.supabase
            .from('menu_items')
            .update({
                price: item.price_pending,
                price_approved_by: user?.id ?? null,
                price_approved_at: new Date().toISOString(),
                price_pending: null,
                price_pending_at: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', productId);

        if (error) throw error;

        await this.insertChangeLog(item.commerce_id, productId, 'precio_aprobado', { price: item.price }, { price: item.price_pending, notes }, user?.id);
        await this.notifyStoreAdmin(item.commerce_id, 'Precio aprobado', `Tu nuevo precio para "${item.name}" (RD$${item.price_pending}) fue aprobado.`, { product_id: productId });
    }

    // ─── rejectPendingPrice ───────────────────────────────────────────────────

    async rejectPendingPrice(productId: string, reason: string): Promise<void> {
        const user = this.auth.currentUser();
        const { data: item } = await this.supabase
            .from('menu_items')
            .select('price_pending, name, commerce_id')
            .eq('id', productId)
            .single();

        const { error } = await this.supabase
            .from('menu_items')
            .update({ price_pending: null, price_pending_at: null, updated_at: new Date().toISOString() })
            .eq('id', productId);

        if (error) throw error;

        if (item) {
            await this.insertChangeLog(item.commerce_id, productId, 'precio_rechazado', { price_pending: item.price_pending }, { reason }, user?.id);
            await this.notifyStoreAdmin(item.commerce_id, 'Propuesta de precio rechazada', `Tu propuesta de precio para "${item.name}" fue rechazada. Motivo: ${reason}`, { product_id: productId });
        }
    }

    // ─── moderateProduct ──────────────────────────────────────────────────────

    async moderateProduct(productId: string, status: ModerationStatus, notes: string, notify = true): Promise<void> {
        const user = this.auth.currentUser();
        const patch: Record<string, unknown> = {
            moderation_status: status,
            moderation_notes: notes,
            moderated_by: user?.id ?? null,
            moderated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        if (status === 'retirado') patch['is_available'] = false;

        const { data: item } = await this.supabase.from('menu_items').select('name, commerce_id, moderation_status').eq('id', productId).single();
        const { error } = await this.supabase.from('menu_items').update(patch).eq('id', productId);
        if (error) throw error;

        if (item) {
            await this.insertChangeLog(item.commerce_id, productId, 'moderacion_' + status, { moderation_status: item.moderation_status }, { moderation_status: status, notes }, user?.id);
            if (notify) {
                const title = status === 'retirado'
                    ? 'Producto retirado'
                    : status === 'bajo_revision'
                        ? 'Producto bajo revisión'
                        : 'Producto aprobado';
                await this.notifyStoreAdmin(item.commerce_id, title, `"${item.name}" fue marcado como ${status}. ${notes ? `Notas: ${notes}` : ''}`, { product_id: productId });
            }
        }
    }

    // ─── bulkUpdateAvailability ───────────────────────────────────────────────

    async bulkUpdateAvailability(productIds: string[], isAvailable: boolean): Promise<void> {
        const user = this.auth.currentUser();
        // Read BEFORE updating so old_value in the log is accurate
        const { data: items } = await this.supabase
            .from('menu_items')
            .select('id, commerce_id, name, is_available')
            .in('id', productIds);

        const { error } = await this.supabase
            .from('menu_items')
            .update({ is_available: isAvailable, updated_at: new Date().toISOString() })
            .in('id', productIds);
        if (error) throw error;

        await Promise.all(
            (items ?? []).map(item =>
                this.insertChangeLog(item.commerce_id, item.id, isAvailable ? 'activado' : 'desactivado', { is_available: item.is_available }, { is_available: isAvailable }, user?.id)
            )
        );
    }

    // ─── deleteProduct ────────────────────────────────────────────────────────

    async deleteProduct(productId: string): Promise<{ error?: string }> {
        const user = this.auth.currentUser();
        try {
            const { data: item } = await this.supabase
                .from('menu_items')
                .select('name, commerce_id')
                .eq('id', productId)
                .single();

            const { error } = await this.supabase.from('menu_items').delete().eq('id', productId);
            if (error) return { error: error.message };

            if (item) {
                await this.insertChangeLog(item.commerce_id, productId, 'producto_eliminado', { name: item.name }, null, user?.id);
            }
            return {};
        } catch (e: any) {
            return { error: e?.message ?? 'Error desconocido' };
        }
    }

    // ─── getPendingPriceApprovals ─────────────────────────────────────────────

    getPendingPriceApprovals(): Observable<PendingPriceItem[]> {
        return from(
            this.supabase
                .from('menu_items')
                .select('id, name, price, price_pending, price_pending_notes, price_pending_at, photo_url, commerce_id, commerce:commerces(name, logo_url)')
                .not('price_pending', 'is', null)
                .order('price_pending_at', { ascending: true })
                .then(({ data, error }) => {
                    if (error) throw error;
                    return (data ?? []).map(row => {
                        const pending = (row as any).price_pending as number;
                        const current = row.price;
                        return {
                            product_id: row.id,
                            product_name: row.name,
                            product_photo: row.photo_url ?? undefined,
                            current_price: current,
                            pending_price: pending,
                            pending_notes: (row as any).price_pending_notes ?? undefined,
                            price_change_pct: Math.round(((pending - current) / current) * 100),
                            store_id: row.commerce_id,
                            store_name: (row as any).commerce?.name ?? '—',
                            store_logo: (row as any).commerce?.logo_url ?? undefined,
                            submitted_at: (row as any).price_pending_at ?? row.id,
                        } as PendingPriceItem;
                    });
                })
        );
    }

    // ─── getCategories ────────────────────────────────────────────────────────

    getCategories(storeId: string): Observable<MenuCategory[]> {
        return from(
            this.supabase
                .from('menu_categories')
                .select('*')
                .eq('commerce_id', storeId)
                .order('display_order')
                .then(({ data, error }) => {
                    if (error) throw error;
                    return (data ?? []) as MenuCategory[];
                })
        );
    }

    async createCategory(storeId: string, name: string): Promise<MenuCategory> {
        const { data: last } = await this.supabase
            .from('menu_categories')
            .select('display_order')
            .eq('commerce_id', storeId)
            .order('display_order', { ascending: false })
            .limit(1)
            .maybeSingle();

        const { data, error } = await this.supabase
            .from('menu_categories')
            .insert({ commerce_id: storeId, name, display_order: (last?.display_order ?? 0) + 1, is_active: true })
            .select()
            .single();
        if (error) throw error;
        return data as MenuCategory;
    }

    async updateCategory(id: string, patch: Partial<MenuCategory>): Promise<void> {
        const { error } = await this.supabase.from('menu_categories').update(patch).eq('id', id);
        if (error) throw error;
    }

    async reorderCategories(storeId: string, orderedIds: string[]): Promise<void> {
        await Promise.all(
            orderedIds.map((id, index) =>
                this.supabase.from('menu_categories').update({ display_order: index + 1 }).eq('id', id)
            )
        );
    }

    // ─── getCombos ────────────────────────────────────────────────────────────

    getCombos(storeId: string): Observable<StoreCombo[]> {
        return from(
            this.supabase
                .from('store_combos')
                .select('*')
                .eq('store_id', storeId)
                .order('display_order')
                .then(({ data, error }) => {
                    if (error) throw error;
                    return (data ?? []).map(r => ({
                        ...r,
                        commerce_id: r.store_id, // normalize to interface field name
                    })) as StoreCombo[];
                })
        );
    }

    async createCombo(storeId: string, data: Partial<StoreCombo>): Promise<StoreCombo> {
        const { commerce_id: _ignored, ...rest } = data as any;
        const { data: row, error } = await this.supabase
            .from('store_combos')
            .insert({ ...rest, store_id: storeId })
            .select()
            .single();
        if (error) throw error;
        return { ...(row as any), commerce_id: (row as any).store_id } as StoreCombo;
    }

    async updateCombo(comboId: string, data: Partial<StoreCombo>): Promise<void> {
        const { commerce_id: _ignored, ...rest } = data as any;
        const { error } = await this.supabase.from('store_combos').update(rest).eq('id', comboId);
        if (error) throw error;
    }

    async deleteCombo(comboId: string): Promise<void> {
        const { error } = await this.supabase.from('store_combos').delete().eq('id', comboId);
        if (error) throw error;
    }

    // ─── getCatalogChangeLog ──────────────────────────────────────────────────

    getCatalogChangeLog(storeId: string, limit = 50): Observable<CatalogChangeEntry[]> {
        return from(
            this.supabase
                .from('catalog_change_log')
                .select('*, changed_by_user:users!changed_by(full_name), item:menu_items(name)')
                .eq('commerce_id', storeId)
                .order('created_at', { ascending: false })
                .limit(limit)
                .then(({ data, error }) => {
                    if (error) throw error;
                    return (data ?? []).map(row => ({
                        id: row.id,
                        commerce_id: row.commerce_id,
                        product_id: row.product_id ?? undefined,
                        product_name: (row as any).item?.name ?? undefined,
                        changed_by_id: row.changed_by ?? '',
                        changed_by_name: (row as any).changed_by_user?.full_name ?? '—',
                        change_type: row.change_type,
                        old_value: row.old_value,
                        new_value: row.new_value,
                        notes: row.notes ?? undefined,
                        created_at: row.created_at,
                    })) as CatalogChangeEntry[];
                })
        );
    }

    // ─── importProductsFromCSV ────────────────────────────────────────────────

    async importProductsFromCSV(storeId: string, file: File, commit = false): Promise<ImportResult> {
        const text = await file.text();
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) return { preview: [], total: 0, valid: 0, invalid: 0 };

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        const preview: ImportResult['preview'] = [];
        let valid = 0;
        let invalid = 0;

        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            const row: Record<string, string> = {};
            headers.forEach((h, idx) => { row[h] = cols[idx] ?? ''; });

            const errors: string[] = [];
            if (!row['name']) errors.push('nombre requerido');
            const price = parseFloat(row['price'] ?? row['precio'] ?? '');
            if (isNaN(price) || price < 0) errors.push('precio inválido');

            const entry = {
                row: i,
                name: row['name'] ?? row['nombre'] ?? '',
                price: isNaN(price) ? 0 : price,
                category: row['category'] ?? row['categoria'] ?? '',
                errors,
            };
            preview.push(entry);
            if (errors.length === 0) valid++; else invalid++;
        }

        if (commit && valid > 0) {
            const inserts = preview
                .filter(p => p.errors.length === 0)
                .map(p => ({
                    commerce_id: storeId,
                    name: p.name,
                    price: p.price,
                    is_available: true,
                    moderation_status: 'aprobado',
                    display_order: 9999,
                    tags: [],
                    has_variants: false,
                    track_stock: false,
                    is_featured: false,
                }));

            const { error } = await this.supabase.from('menu_items').insert(inserts);
            if (error) throw error;
            return { preview, total: preview.length, valid, invalid, committed: true, inserted: inserts.length };
        }

        return { preview, total: preview.length, valid, invalid, committed: false };
    }

    // ─── exportCatalogToCSV ───────────────────────────────────────────────────

    async exportCatalogToCSV(storeId: string): Promise<void> {
        const { data, error } = await this.supabase
            .from('menu_items')
            .select('*, category:menu_categories(name)')
            .eq('commerce_id', storeId)
            .order('display_order');

        if (error) throw error;
        if (!data?.length) {
            this.toast.error('Sin productos para exportar');
            return;
        }

        const headers = ['ID', 'Nombre', 'Categoría', 'Precio', 'Precio Desc.', 'Disponible', 'Destacado', 'Stock', 'SKU', 'Creado'];
        const rows = (data ?? []).map(p => [
            p.id, p.name, (p as any).category?.name ?? '—',
            p.price, p.discount_price ?? '',
            p.is_available ? 'Sí' : 'No',
            p.is_featured ? 'Sí' : 'No',
            p.track_stock ? (p.stock_count ?? 0) : 'N/A',
            p.sku ?? '',
            p.created_at?.slice(0, 10) ?? '',
        ]);

        const csv = [csvRow(headers), ...rows.map(csvRow)].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `catalogo-${storeId}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ─── globalSearch ─────────────────────────────────────────────────────────

    globalSearch(filters: GlobalSearchFilters): Observable<{ data: GlobalSearchResult[]; count: number }> {
        return from(this.fetchGlobalSearch(filters));
    }

    private async fetchGlobalSearch(filters: GlobalSearchFilters): Promise<{ data: GlobalSearchResult[]; count: number }> {
        const pageSize = filters.page_size ?? 40;
        const page = filters.page ?? 1;
        const from_ = (page - 1) * pageSize;
        const to = from_ + pageSize - 1;

        let q = this.supabase
            .from('menu_items')
            .select(`*, commerce:commerces(id, name, commerce_type, logo_url)`, { count: 'exact' })
            .order('name')
            .range(from_, to);

        if (filters.query.trim()) {
            const term = filters.query.trim().replace(/'/g, "''"); // escape single quotes
            q = q.or(`name.ilike.%${term}%,description.ilike.%${term}%,brand.ilike.%${term}%,sku.ilike.%${term}%,barcode.ilike.%${term}%`);
        }
        if (filters.min_price !== undefined) q = q.gte('price', filters.min_price);
        if (filters.max_price !== undefined) q = q.lte('price', filters.max_price);
        if (filters.moderation_status && filters.moderation_status !== 'all') {
            q = q.eq('moderation_status', filters.moderation_status);
        }
        if (filters.low_stock) q = q.eq('track_stock', true).gt('stock_count', 0).lte('stock_count', 10);
        if (filters.pending_price) q = q.not('price_pending', 'is', null);
        if (filters.dietary_tags?.length) {
            // overlaps: any of the selected tags
            q = q.overlaps('dietary_tags', filters.dietary_tags);
        }

        const { data, count, error } = await q;
        if (error) throw error;

        let results: GlobalSearchResult[] = (data ?? []).map(raw => {
            const r = raw as any;
            const commerce = r.commerce ?? {};
            const pricePending = r.price_pending ?? undefined;
            const pricePct = pricePending != null
                ? Math.round(((pricePending - r.price) / r.price) * 100)
                : undefined;
            return {
                ...r,
                category_name: r.category_name ?? '—',
                in_venue_price: r.in_venue_price ?? undefined,
                price_pending: pricePending,
                price_pending_notes: r.price_pending_notes ?? undefined,
                price_change_pct: pricePct,
                moderation_status: (r.moderation_status ?? 'aprobado') as ModerationStatus,
                variants_count: r.variants_count ?? 0,
                stock_status: computeStockStatus(r as MenuItem),
                store_id: commerce.id ?? r.commerce_id,
                store_name: commerce.name ?? '—',
                store_type: commerce.commerce_type ?? '—',
                store_logo: commerce.logo_url ?? undefined,
            } as GlobalSearchResult;
        });

        if (filters.commerce_type) {
            results = results.filter(r => r.store_type === filters.commerce_type);
        }

        return { data: results, count: count ?? 0 };
    }

    // ─── getCatalogAnomalies ──────────────────────────────────────────────────

    getCatalogAnomalies(): Observable<CatalogAnomalies> {
        return from(this.fetchCatalogAnomalies());
    }

    private async fetchCatalogAnomalies(): Promise<CatalogAnomalies> {
        // For price > in_venue_price we need an RPC-level comparison;
        // approximate with a client-side check on a limited result set
        const [noPhotoRes, noDescRes, noCatRes, priceVsVenueRes] = await Promise.all([
            this.supabase
                .from('menu_items')
                .select('id', { count: 'exact', head: true })
                .or('photo_url.is.null,photo_url.eq.'),
            this.supabase
                .from('menu_items')
                .select('id', { count: 'exact', head: true })
                .or('description.is.null,description.eq.'),
            this.supabase
                .from('menu_items')
                .select('id', { count: 'exact', head: true })
                .is('category_id', null),
            // Fetch items where in_venue_price is set, then filter price > in_venue_price in JS
            this.supabase
                .from('menu_items')
                .select('id, price, in_venue_price')
                .not('in_venue_price', 'is', null)
                .gt('price', 0),
        ]);

        const priceGtVenueCount = (priceVsVenueRes.data ?? [])
            .filter(r => r.price > (r as any).in_venue_price).length;

        return {
            priceGreaterThanVenue: priceGtVenueCount,
            missingPhoto: noPhotoRes.count ?? 0,
            missingDescription: noDescRes.count ?? 0,
            missingCategory: noCatRes.count ?? 0,
        };
    }

    // ─── notifyStoreAdminPublic ───────────────────────────────────────────────
    // Public wrapper so pages can send store notifications without unsafe casts

    async sendStoreNotification(storeId: string, title: string, body: string, data: Record<string, string>): Promise<void> {
        return this.notifyStoreAdmin(storeId, title, body, data);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private async insertChangeLog(
        storeId: string,
        productId: string | undefined,
        changeType: string,
        oldValue: unknown,
        newValue: unknown,
        changedBy?: string
    ): Promise<void> {
        await this.supabase.from('catalog_change_log').insert({
            commerce_id: storeId,
            product_id: productId ?? null,
            changed_by: changedBy ?? null,
            change_type: changeType,
            old_value: oldValue ?? null,
            new_value: newValue ?? null,
        });
    }

    private async notifyStoreAdmin(storeId: string, title: string, body: string, data: Record<string, string>): Promise<void> {
        // Find store admin user
        const { data: admins } = await this.supabase
            .from('commerce_admins')
            .select('user_id')
            .eq('commerce_id', storeId)
            .limit(1);

        const adminId = admins?.[0]?.user_id;
        if (!adminId) return;

        await this.supabase.from('notifications').insert({
            user_id: adminId,
            type: 'catalog_update',
            title,
            body,
            data,
        });
    }
}
