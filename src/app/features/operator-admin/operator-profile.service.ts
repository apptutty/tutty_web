import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import { ExcursionOperator, ExcursionOperatorNotifPrefs } from '../../core/supabase/database.types';
import { buildStorageObjectKey } from '../../shared/utils/storage-key.utils';

export interface TeamMember {
    id: string;
    userId: string;
    name: string;
    email: string;
    role: string;
    avatarUrl: string | null;
}

export interface FinancialBookingRow {
    id: string;
    created_at: string;
    clientName: string;
    excursionName: string;
    total: number;
}

export interface OperatorProfileData {
    name: string;
    description: string;
    whatsapp_number: string;
    address: string;
    category: string;
    logo_url: string;
    banner_url: string;
    has_insurance: boolean;
    has_tourism_license: boolean;
    tourism_license_number: string;
    languages: string[];
    notification_prefs: ExcursionOperatorNotifPrefs;
}

@Injectable({ providedIn: 'root' })
export class OperatorProfileService {
    private readonly supabase = getSupabaseClient();

    // ── Profile ──────────────────────────────────────────────────────────────

    async loadProfile(operatorId: string): Promise<OperatorProfileData | null> {
        const { data, error } = await this.supabase
            .from('excursion_operators')
            .select('name, description, whatsapp_number, address, category, logo_url, banner_url, has_insurance, has_tourism_license, tourism_license_number, languages, notification_prefs')
            .eq('id', operatorId)
            .single();

        if (error || !data) return null;
        const row = data as Partial<ExcursionOperator>;

        return {
            name: row.name ?? '',
            description: row.description ?? '',
            whatsapp_number: row.whatsapp_number ?? '',
            address: row.address ?? '',
            category: row.category ?? '',
            logo_url: row.logo_url ?? '',
            banner_url: row.banner_url ?? '',
            has_insurance: row.has_insurance ?? false,
            has_tourism_license: row.has_tourism_license ?? false,
            tourism_license_number: row.tourism_license_number ?? '',
            languages: row.languages ?? ['Español'],
            notification_prefs: row.notification_prefs ?? {
                newBookingWA: true, cancellationWA: true, dayBeforeReminder: true, whatsappNumber: '',
            },
        };
    }

    async saveProfile(
        operatorId: string,
        data: Omit<OperatorProfileData, 'notification_prefs'>,
        logoFile: File | null,
        bannerFile: File | null,
        slug: string,
    ): Promise<{ logo_url: string; banner_url: string }> {
        let logoUrl = data.logo_url;
        let bannerUrl = data.banner_url;

        if (logoFile) {
            const path = buildStorageObjectKey(`operators/${slug}/logo`, logoFile);
            await this.supabase.storage.from('media').upload(path, logoFile, { upsert: true });
            const { data: pub } = this.supabase.storage.from('media').getPublicUrl(path);
            logoUrl = pub.publicUrl;
        }
        if (bannerFile) {
            const path = buildStorageObjectKey(`operators/${slug}/banner`, bannerFile);
            await this.supabase.storage.from('media').upload(path, bannerFile, { upsert: true });
            const { data: pub } = this.supabase.storage.from('media').getPublicUrl(path);
            bannerUrl = pub.publicUrl;
        }

        const payload: Record<string, unknown> = {
            name: data.name,
            description: data.description || null,
            whatsapp_number: data.whatsapp_number || null,
            address: data.address || null,
            category: data.category || null,
            logo_url: logoUrl || null,
            banner_url: bannerUrl || null,
            has_insurance: data.has_insurance,
            has_tourism_license: data.has_tourism_license,
            tourism_license_number: data.has_tourism_license ? data.tourism_license_number : null,
            languages: data.languages,
        };

        const { error } = await this.supabase
            .from('excursion_operators').update(payload).eq('id', operatorId);
        if (error) throw new Error(error.message);

        return { logo_url: logoUrl, banner_url: bannerUrl };
    }

    async saveNotificationPrefs(operatorId: string, prefs: ExcursionOperatorNotifPrefs): Promise<void> {
        const { error } = await this.supabase
            .from('excursion_operators')
            .update({ notification_prefs: prefs } as Record<string, unknown>)
            .eq('id', operatorId);
        if (error) throw new Error(error.message);
    }

    // ── Team ─────────────────────────────────────────────────────────────────

    async loadTeam(operatorId: string): Promise<TeamMember[]> {
        const { data } = await this.supabase
            .from('excursion_operator_admins')
            .select('id, user_id, role, users(id, full_name, email, avatar_url)')
            .eq('operator_id', operatorId);

        return (data ?? []).map((row: Record<string, unknown>) => {
            const u = row['users'] as Record<string, string> | null;
            return {
                id: row['id'] as string,
                userId: row['user_id'] as string,
                name: u?.['full_name'] ?? u?.['email'] ?? '—',
                email: u?.['email'] ?? '—',
                role: (row['role'] as string) ?? 'admin',
                avatarUrl: u?.['avatar_url'] ?? null,
            };
        });
    }

    async inviteMember(operatorId: string, email: string, role: string): Promise<void> {
        const { data: user } = await this.supabase
            .from('users').select('id').eq('email', email.trim().toLowerCase()).single();
        if (!user) throw new Error('No se encontró un usuario con ese email. Pídele que se registre primero.');
        const { error } = await this.supabase.from('excursion_operator_admins').insert({
            operator_id: operatorId,
            user_id: (user as Record<string, string>)['id'],
            role,
        });
        if (error) throw new Error(error.message);
    }

    async removeMember(adminId: string): Promise<void> {
        await this.supabase.from('excursion_operator_admins').delete().eq('id', adminId);
    }

    // ── Financials ────────────────────────────────────────────────────────────

    async loadFinancials(operatorId: string): Promise<FinancialBookingRow[]> {
        const { data: excursions } = await this.supabase
            .from('excursions').select('id, name').eq('operator_id', operatorId);
        const excIds = (excursions ?? []).map(e => e.id);
        const excMap = new Map((excursions ?? []).map(e => [e.id, e.name as string]));

        if (excIds.length === 0) return [];

        const { data: dates } = await this.supabase
            .from('excursion_dates').select('id, excursion_id').in('excursion_id', excIds);
        const dateMap = new Map((dates ?? []).map(d => [d.id as string, d.excursion_id as string]));
        const dateIds = (dates ?? []).map(d => d.id as string);

        const { data: bookings } = await this.supabase
            .from('bookings')
            .select('id, created_at, client_name, excursion_date_id, total_price, status')
            .in('excursion_date_id', dateIds)
            .in('status', ['confirmada', 'completada'])
            .order('created_at', { ascending: false });

        return (bookings ?? []).map(b => ({
            id: b.id as string,
            created_at: b.created_at as string,
            clientName: (b.client_name as string | null) ?? '—',
            excursionName: excMap.get(dateMap.get(b.excursion_date_id as string) ?? '') ?? '—',
            total: Number(b.total_price) || 0,
        }));
    }
}
