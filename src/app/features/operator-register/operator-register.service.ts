import { Injectable, signal } from '@angular/core';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import { OperatorRegistrationDraft } from '../../core/supabase/database.types';

const DEFAULT_DRAFT: OperatorRegistrationDraft = {
    name: '',
    slug: '',
    description: '',
    category: null,
    whatsapp_number: '',
    address: '',
    logo_url: null,
    banner_url: null,
    years_experience: '',
    has_insurance: false,
    has_tourism_license: false,
    tourism_license_number: '',
    languages: ['Español'],
    tour_enabled: false,
    tour_name: '',
    tour_short_description: '',
    tour_price: 0,
    tour_duration_hours: 4,
    tour_difficulty: null,
    tour_meeting_point: '',
    tour_min_people: 1,
    tour_max_people: 20,
    tour_photos: [],
    email: '',
    password: '',
    full_name: '',
    phone: '',
};

export interface OperatorSubmitResult {
    approved: boolean;
    operatorId: string;
}

@Injectable({ providedIn: 'root' })
export class OperatorRegisterService {
    private readonly supabase = getSupabaseClient();

    readonly draft = signal<OperatorRegistrationDraft>({ ...DEFAULT_DRAFT });
    readonly lastOperatorId = signal<string | null>(null);

    update(patch: Partial<OperatorRegistrationDraft>): void {
        this.draft.update(cur => ({ ...cur, ...patch }));
    }

    reset(): void {
        this.draft.set({ ...DEFAULT_DRAFT });
        this.lastOperatorId.set(null);
    }

    async checkSlugAvailable(slug: string): Promise<boolean> {
        const { data, error } = await this.supabase
            .from('excursion_operators')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();
        if (error) throw error;
        return data === null;
    }

    async uploadFile(file: File, path: string): Promise<string> {
        const { error } = await this.supabase.storage
            .from('media')
            .upload(path, file, { upsert: true });
        if (error) throw error;
        const { data } = this.supabase.storage.from('media').getPublicUrl(path);
        return data.publicUrl;
    }

    async submitRegistration(): Promise<OperatorSubmitResult> {
        const d = this.draft();

        // 1. Auth signup
        const { data: authData, error: authError } = await this.supabase.auth.signUp({
            email: d.email,
            password: d.password,
            options: { data: { full_name: d.full_name } },
        });
        if (authError || !authData.user) throw authError ?? new Error('No se pudo crear la cuenta');
        const userId = authData.user.id;

        // 2. Insert user profile with excursion_operator role
        const { error: userError } = await this.supabase.from('users').insert({
            id: userId,
            email: d.email,
            full_name: d.full_name,
            phone: d.phone || null,
            role: 'excursion_operator',
        });
        if (userError) throw userError;

        // 3-6. Create operator profile + admin link + optional first excursion,
        // atomically, via RPC (direct inserts to these tables are blocked by
        // RLS today — see migration 043_register_excursion_operator_rpc.sql).
        const { data: rpcData, error: rpcError } = await this.supabase.rpc(
            'register_excursion_operator',
            {
                p_name: d.name,
                p_slug: d.slug,
                p_description: d.description || null,
                p_category: d.category,
                p_whatsapp_number: d.whatsapp_number || null,
                p_address: d.address || null,
                p_logo_url: d.logo_url,
                p_banner_url: d.banner_url,
                p_tour_name: d.tour_enabled && d.tour_name.trim() ? d.tour_name : null,
                p_tour_short_description: d.tour_short_description || null,
                p_tour_price: d.tour_price,
                p_tour_duration_hours: d.tour_duration_hours,
                p_tour_difficulty: d.tour_difficulty,
                p_tour_meeting_point: d.tour_meeting_point || null,
                p_tour_min_people: d.tour_min_people,
                p_tour_max_people: d.tour_max_people,
                p_tour_photos: d.tour_photos,
                p_tour_language: d.languages[0] ?? 'Español',
            },
        );
        if (rpcError) throw rpcError;

        const result = rpcData as {
            success: boolean;
            operator_id?: string;
            approved?: boolean;
            error_code?: string;
        };
        if (!result?.success || !result.operator_id) {
            throw new Error(result?.error_code ?? 'Error al crear el perfil de operador');
        }

        const operatorId = result.operator_id;
        this.lastOperatorId.set(operatorId);

        return { approved: !!result.approved, operatorId };
    }

    async getOperatorStatus(operatorId: string): Promise<{ is_active: boolean } | null> {
        const { data, error } = await this.supabase
            .from('excursion_operators')
            .select('is_active')
            .eq('id', operatorId)
            .single();
        if (error) return null;
        return data as { is_active: boolean };
    }
}
