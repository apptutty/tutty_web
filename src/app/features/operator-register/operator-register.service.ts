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

        // 3. Insert excursion_operator
        const { data: op, error: opError } = await this.supabase
            .from('excursion_operators')
            .insert({
                name: d.name,
                slug: d.slug,
                description: d.description || null,
                category: d.category,
                whatsapp_number: d.whatsapp_number || null,
                address: d.address || null,
                logo_url: d.logo_url,
                banner_url: d.banner_url,
                is_active: false,
                approval_status: 'pendiente',
            } as Record<string, unknown>)
            .select('id')
            .single();
        if (opError || !op) throw opError ?? new Error('Error al crear el perfil de operador');

        const operatorId = (op as { id: string }).id;
        this.lastOperatorId.set(operatorId);

        // 4. Link operator admin
        const { error: adminError } = await this.supabase
            .from('excursion_operator_admins')
            .insert({ user_id: userId, operator_id: operatorId });
        if (adminError) throw adminError;

        // 5. Check auto-approve setting
        const { data: setting } = await this.supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'store_auto_approve')
            .maybeSingle();
        const autoApprove = setting?.value === 'true';

        if (autoApprove) {
            await this.supabase
                .from('excursion_operators')
                .update({ is_active: true, approval_status: 'aprobado' } as Record<string, unknown>)
                .eq('id', operatorId);
        }

        // 6. Insert first excursion if provided
        if (d.tour_enabled && d.tour_name.trim()) {
            await this.supabase.from('excursions').insert({
                operator_id: operatorId,
                name: d.tour_name,
                short_description: d.tour_short_description || null,
                price_per_person: d.tour_price,
                duration_hours: d.tour_duration_hours,
                difficulty_level: d.tour_difficulty,
                meeting_point: d.tour_meeting_point || null,
                min_people: d.tour_min_people,
                max_people: d.tour_max_people,
                photos: d.tour_photos,
                is_active: false,
                language: (d.languages[0] ?? 'Español'),
            });
        }

        return { approved: autoApprove, operatorId };
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
