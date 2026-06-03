import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import { AppSetting, Holiday } from '../../core/supabase/database.types';

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
}
