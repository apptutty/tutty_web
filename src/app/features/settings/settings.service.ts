import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import { AppSetting, Holiday, CommerceCategory, TuttyDomain, AuditLogEntry, CommerceType } from '../../core/supabase/database.types';

// Re-export for backward compat
export type StoreCategory = CommerceCategory;

export interface AdminUser {
    id: string;
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
    created_at: string;
    commerce_id?: string;
    operator_id?: string;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
    private supabase = getSupabaseClient();

    async getSettings(): Promise<AppSetting[]> {
        const { data, error } = await this.supabase
            .from('app_settings')
            .select('*')
            .order('key');
        if (error) throw error;
        return data as AppSetting[];
    }

    async upsertSetting(key: string, value: string): Promise<void> {
        const { error } = await this.supabase
            .from('app_settings')
            .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        if (error) throw error;
    }

    async upsertSettings(settings: { key: string; value: string }[]): Promise<void> {
        const rows = settings.map(s => ({ ...s, updated_at: new Date().toISOString() }));
        const { error } = await this.supabase
            .from('app_settings')
            .upsert(rows, { onConflict: 'key' });
        if (error) throw error;
    }

    async getHolidays(): Promise<Holiday[]> {
        const { data, error } = await this.supabase
            .from('holidays')
            .select('*')
            .order('date');
        if (error) throw error;
        return data as Holiday[];
    }

    async saveHoliday(holiday: Partial<Holiday>): Promise<Holiday> {
        const op = holiday.id
            ? this.supabase.from('holidays').update(holiday).eq('id', holiday.id).select().single()
            : this.supabase.from('holidays').insert(holiday).select().single();
        const { data, error } = await op;
        if (error) throw error;
        return data as Holiday;
    }

    async deleteHoliday(id: string): Promise<void> {
        const { error } = await this.supabase.from('holidays').delete().eq('id', id);
        if (error) throw error;
    }

    async getAdminUsers(): Promise<AdminUser[]> {
        // Uses anon key - only returns users visible to current session.
        // For full list, a backend Edge Function with service role is required.
        const { data, error } = await this.supabase
            .from('users')
            .select('id, email, full_name, role, is_active, created_at')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data ?? []) as AdminUser[];
    }

    async createAdminUser(userData: { email: string; password: string; full_name: string; role: string; commerce_id?: string; operator_id?: string }): Promise<void> {
        const { data, error } = await this.supabase.auth.admin.createUser({
            email: userData.email,
            password: userData.password,
            email_confirm: true,
            user_metadata: { full_name: userData.full_name, role: userData.role }
        });
        if (error) throw error;
        if (data.user) {
            const { error: upsertError } = await this.supabase.from('users').upsert({
                id: data.user.id,
                email: userData.email,
                full_name: userData.full_name,
                role: userData.role,
                commerce_id: userData.commerce_id ?? null,
                operator_id: userData.operator_id ?? null,
                is_active: true
            });
            if (upsertError) throw upsertError;
        }
    }

    async toggleAdminUser(userId: string, isActive: boolean): Promise<void> {
        const { error } = await this.supabase
            .from('users')
            .update({ is_active: isActive })
            .eq('id', userId);
        if (error) throw error;
    }

    // ── SA-6 methods ─────────────────────────────────────────────────────────

    async approveAllPendingStores(): Promise<void> {
        const { error } = await this.supabase
            .from('commerces')
            .update({ approval_status: 'aprobado', is_active: true })
            .eq('approval_status', 'pendiente');
        if (error) throw error;
    }

    async getStoreCategories(commerceType?: CommerceType | string): Promise<CommerceCategory[]> {
        let q = this.supabase.from('commerce_categories')
            .select('id, name, slug, icon_url, commerce_type, display_order, is_active, created_at, domain_id, applies_to, color, domain:tutty_domains(id,name,slug,icon,color,display_order)')
            .order('display_order');
        if (commerceType) q = (q as any).eq('commerce_type', commerceType);
        const { data, error } = await q;
        if (error) throw error;
        return (data ?? []) as unknown as CommerceCategory[];
    }

    async getTuttyDomains(): Promise<TuttyDomain[]> {
        const { data, error } = await this.supabase
            .from('tutty_domains')
            .select('id, name, slug, description, icon, color, display_order, is_active')
            .eq('is_active', true)
            .order('display_order');
        if (error) throw error;
        return (data ?? []) as TuttyDomain[];
    }

    async saveStoreCategory(cat: Partial<CommerceCategory>): Promise<CommerceCategory> {
        const { domain, ...payload } = cat as any;
        const op = payload.id
            ? this.supabase.from('commerce_categories').update(payload).eq('id', payload.id)
                .select('id, name, slug, display_order, commerce_type, is_active, created_at, domain_id, applies_to').single()
            : this.supabase.from('commerce_categories').insert(payload)
                .select('id, name, slug, display_order, commerce_type, is_active, created_at, domain_id, applies_to').single();
        const { data, error } = await op;
        if (error) throw error;
        return data as CommerceCategory;
    }

    async deleteStoreCategory(id: string): Promise<void> {
        const { error } = await this.supabase.from('commerce_categories').delete().eq('id', id);
        if (error) throw error;
    }

    async reorderCategories(updates: { id: string; order: number }[]): Promise<void> {
        await Promise.all(
            updates.map(u =>
                this.supabase
                    .from('commerce_categories')
                    .update({ display_order: u.order })
                    .eq('id', u.id)
                    .then(({ error }) => { if (error) throw error; })
            )
        );
    }

    async getAuditLog(filters: { admin?: string; dateFrom?: string; dateTo?: string; action?: string }): Promise<AuditLogEntry[]> {
        return this.fetchAuditLog(filters);
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

