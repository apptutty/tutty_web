import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import { AppSetting, Holiday, StoreCategory, AuditLogEntry, CommerceType } from '../../core/supabase/database.types';

export interface AdminUser {
    id: string;
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
    created_at: string;
    restaurant_id?: string;
    operator_id?: string;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
    private supabase = getSupabaseClient();

    getSettings(): Observable<AppSetting[]> {
        return from(
            this.supabase
                .from('app_settings')
                .select('*')
                .order('key')
                .then(({ data, error }) => {
                    if (error) throw error;
                    return data as AppSetting[];
                })
        );
    }

    upsertSetting(key: string, value: string): Observable<void> {
        return from(
            this.supabase
                .from('app_settings')
                .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
                .then(({ error }) => { if (error) throw error; })
        );
    }

    upsertSettings(settings: { key: string; value: string }[]): Observable<void> {
        const rows = settings.map(s => ({ ...s, updated_at: new Date().toISOString() }));
        return from(
            this.supabase
                .from('app_settings')
                .upsert(rows, { onConflict: 'key' })
                .then(({ error }) => { if (error) throw error; })
        );
    }

    getHolidays(): Observable<Holiday[]> {
        return from(
            this.supabase
                .from('holidays')
                .select('*')
                .order('date')
                .then(({ data, error }) => {
                    if (error) throw error;
                    return data as Holiday[];
                })
        );
    }

    saveHoliday(holiday: Partial<Holiday>): Observable<Holiday> {
        const op = holiday.id
            ? this.supabase.from('holidays').update(holiday).eq('id', holiday.id).select().single()
            : this.supabase.from('holidays').insert(holiday).select().single();
        return from(op.then(({ data, error }) => {
            if (error) throw error;
            return data as Holiday;
        }));
    }

    deleteHoliday(id: string): Observable<void> {
        return from(
            this.supabase
                .from('holidays')
                .delete()
                .eq('id', id)
                .then(({ error }) => { if (error) throw error; })
        );
    }

    getAdminUsers(): Observable<AdminUser[]> {
        // Uses anon key - only returns users visible to current session.
        // For full list, a backend Edge Function with service role is required.
        return from(
            this.supabase
                .from('users')
                .select('id, email, full_name, role, is_active, created_at')
                .order('created_at', { ascending: false })
                .then(({ data, error }) => {
                    if (error) throw error;
                    return (data ?? []) as AdminUser[];
                })
        );
    }

    createAdminUser(userData: { email: string; password: string; full_name: string; role: string; restaurant_id?: string; operator_id?: string }): Observable<void> {
        return from(
            this.supabase.auth.admin.createUser({
                email: userData.email,
                password: userData.password,
                email_confirm: true,
                user_metadata: { full_name: userData.full_name, role: userData.role }
            }).then(async ({ data, error }) => {
                if (error) throw error;
                if (data.user) {
                    const { error: upsertError } = await this.supabase.from('users').upsert({
                        id: data.user.id,
                        email: userData.email,
                        full_name: userData.full_name,
                        role: userData.role,
                        restaurant_id: userData.restaurant_id ?? null,
                        operator_id: userData.operator_id ?? null,
                        is_active: true
                    });
                    if (upsertError) throw upsertError;
                }
            })
        );
    }

    toggleAdminUser(userId: string, isActive: boolean): Observable<void> {
        return from(
            this.supabase.from('users').update({ is_active: isActive }).eq('id', userId)
                .then(({ error }) => { if (error) throw error; })
        );
    }

    // ── SA-6 methods ─────────────────────────────────────────────────────────

    approveAllPendingStores(): Observable<void> {
        return from(
            this.supabase
                .from('restaurants')
                .update({ approval_status: 'aprobado', is_active: true })
                .eq('approval_status', 'pendiente')
                .then(({ error }) => { if (error) throw error; })
        );
    }

    getStoreCategories(commerceType?: CommerceType): Observable<StoreCategory[]> {
        let q = this.supabase.from('restaurant_categories').select('*').order('display_order');
        if (commerceType) q = q.eq('commerce_type', commerceType);
        return from(q.then(({ data, error }) => {
            if (error) throw error;
            return (data ?? []) as StoreCategory[];
        }));
    }

    saveStoreCategory(cat: Partial<StoreCategory>): Observable<StoreCategory> {
        const op = cat.id
            ? this.supabase.from('restaurant_categories').update(cat).eq('id', cat.id).select().single()
            : this.supabase.from('restaurant_categories').insert(cat).select().single();
        return from(op.then(({ data, error }) => {
            if (error) throw error;
            return data as StoreCategory;
        }));
    }

    deleteStoreCategory(id: string): Observable<void> {
        return from(
            this.supabase.from('restaurant_categories').delete().eq('id', id)
                .then(({ error }) => { if (error) throw error; })
        );
    }

    reorderCategories(updates: { id: string; order: number }[]): Observable<void> {
        const ops = updates.map(u =>
            this.supabase.from('restaurant_categories').update({ display_order: u.order }).eq('id', u.id)
        );
        return from(Promise.all(ops.map(op => op.then(({ error }) => { if (error) throw error; }))).then(() => { }));
    }

    getAuditLog(filters: { admin?: string; dateFrom?: string; dateTo?: string; action?: string }): Observable<AuditLogEntry[]> {
        return from(this.fetchAuditLog(filters));
    }

    private async fetchAuditLog(filters: { admin?: string; dateFrom?: string; dateTo?: string; action?: string }): Promise<AuditLogEntry[]> {
        // Try dedicated audit log table first
        let q = this.supabase.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(200);
        if (filters.dateFrom) q = q.gte('created_at', filters.dateFrom + 'T00:00:00');
        if (filters.dateTo) q = q.lte('created_at', filters.dateTo + 'T23:59:59');
        if (filters.admin) q = q.ilike('admin_email', `%${filters.admin}%`);
        if (filters.action) q = q.ilike('action', `%${filters.action}%`);
        const { data, error } = await q;
        if (!error && data && data.length > 0) return data as AuditLogEntry[];

        // Fallback: derive audit entries from app_settings changes
        let sq = this.supabase.from('app_settings').select('key, value, description, updated_at').order('updated_at', { ascending: false }).limit(200);
        if (filters.dateFrom) sq = sq.gte('updated_at', filters.dateFrom + 'T00:00:00');
        if (filters.dateTo) sq = sq.lte('updated_at', filters.dateTo + 'T23:59:59');
        const { data: settings } = await sq;
        return (settings ?? []).map((s: any, i: number) => ({
            id: `setting-${i}`,
            admin_email: null,
            action: `Modificó configuración: ${s.key}`,
            table_name: 'app_settings',
            previous_value: null,
            new_value: `${s.key} = ${s.value}`,
            created_at: s.updated_at,
        } as AuditLogEntry));
    }
}
