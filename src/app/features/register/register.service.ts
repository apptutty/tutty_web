import { Injectable, inject, signal } from '@angular/core';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import { RegistrationDraft } from '../../core/supabase/database.types';

const DEFAULT_DRAFT: RegistrationDraft = {
    commerce_type: null,
    name: '',
    slug: '',
    description: '',
    whatsapp_number: '',
    address: '',
    sector: '',
    city: '',
    logo_url: null,
    banner_url: null,
    category_id: null,
    opening_time: '08:00',
    closing_time: '22:00',
    open_days: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
    avg_delivery_minutes: 30,
    min_order_amount: 0,
    free_delivery_enabled: false,
    free_delivery_threshold: 0,
    email: '',
    password: '',
    full_name: '',
    phone: '',
};

export interface SubmitResult {
    approved: boolean;
    restaurantId: string;
}

@Injectable({ providedIn: 'root' })
export class RegisterService {
    private readonly supabase = getSupabaseClient();

    readonly registrationData = signal<RegistrationDraft>({ ...DEFAULT_DRAFT });
    readonly lastRestaurantId = signal<string | null>(null);

    update(patch: Partial<RegistrationDraft>): void {
        this.registrationData.update(current => ({ ...current, ...patch }));
    }

    reset(): void {
        this.registrationData.set({ ...DEFAULT_DRAFT });
        this.lastRestaurantId.set(null);
    }

    async checkSlugAvailable(slug: string): Promise<boolean> {
        const { data, error } = await this.supabase
            .from('restaurants')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();

        if (error) throw error;
        return data === null;
    }

    async uploadFile(file: File, bucket: string, path: string): Promise<string> {
        const { error } = await this.supabase.storage
            .from(bucket)
            .upload(path, file, { upsert: true });

        if (error) throw error;

        const { data } = this.supabase.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
    }

    async submitRegistration(): Promise<SubmitResult> {
        const draft = this.registrationData();

        // 1. Create auth user
        const { data: authData, error: authError } = await this.supabase.auth.signUp({
            email: draft.email,
            password: draft.password,
            options: { data: { full_name: draft.full_name } },
        });

        if (authError || !authData.user) {
            throw authError ?? new Error('No se pudo crear la cuenta');
        }

        const userId = authData.user.id;

        // 2. Insert user profile with store_admin role
        const { error: userError } = await this.supabase
            .from('users')
            .insert({
                id: userId,
                email: draft.email,
                full_name: draft.full_name,
                phone: draft.phone,
                role: 'store_admin',
            });

        if (userError) throw userError;

        // 3. Insert restaurant
        const restaurantPayload: Record<string, unknown> = {
            name: draft.name,
            slug: draft.slug,
            description: draft.description || null,
            commerce_type: draft.commerce_type,
            whatsapp_number: draft.whatsapp_number || null,
            address: draft.address || null,
            sector: draft.sector || null,
            city: draft.city,
            logo_url: draft.logo_url,
            banner_url: draft.banner_url,
            category_id: draft.category_id,
            opening_time: draft.opening_time,
            closing_time: draft.closing_time,
            open_days: draft.open_days,
            avg_delivery_time: draft.avg_delivery_minutes,
            min_order_amount: draft.min_order_amount,
            free_delivery_threshold: draft.free_delivery_enabled ? draft.free_delivery_threshold : null,
            approval_status: 'pendiente',
            is_active: false,
            is_open: false,
            submitted_at: new Date().toISOString(),
        };

        // Commerce-type specific fields (stored as JSONB metadata or dedicated columns if present)
        if (draft.commerce_type === 'farmacia') {
            restaurantPayload['sespas_number'] = draft.sespas_number ?? null;
            restaurantPayload['farmacia_24h'] = draft.farmacia_24h ?? false;
            restaurantPayload['requires_prescription'] = draft.requires_prescription ?? false;
        } else if (draft.commerce_type === 'restaurante') {
            restaurantPayload['cuisine_types'] = draft.cuisine_types ?? [];
        }

        const { data: restaurant, error: restaurantError } = await this.supabase
            .from('restaurants')
            .insert(restaurantPayload)
            .select('id')
            .single();

        if (restaurantError || !restaurant) throw restaurantError ?? new Error('No se pudo crear el comercio');

        const restaurantId = restaurant.id;
        this.lastRestaurantId.set(restaurantId);

        // 4. Link restaurant admin
        const { error: adminError } = await this.supabase
            .from('restaurant_admins')
            .insert({ user_id: userId, restaurant_id: restaurantId });

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
                .from('restaurants')
                .update({ approval_status: 'aprobado', is_active: true, activated_at: new Date().toISOString() })
                .eq('id', restaurantId);
        }

        return { approved: autoApprove, restaurantId };
    }

    async getMyStoreStatus(restaurantId: string): Promise<{ approval_status: string; rejection_reason: string | null } | null> {
        const { data, error } = await this.supabase
            .from('restaurants')
            .select('approval_status, rejection_reason')
            .eq('id', restaurantId)
            .single();

        if (error) return null;
        return data as { approval_status: string; rejection_reason: string | null };
    }

    /** For users who are already authenticated — skips signUp, uses existing userId. */
    async submitRegistrationForExistingUser(userId: string): Promise<SubmitResult> {
        const draft = this.registrationData();

        const restaurantPayload: Record<string, unknown> = {
            name: draft.name,
            slug: draft.slug,
            description: draft.description || null,
            commerce_type: draft.commerce_type,
            whatsapp_number: draft.whatsapp_number || null,
            address: draft.address || null,
            sector: draft.sector || null,
            city: draft.city,
            logo_url: draft.logo_url,
            banner_url: draft.banner_url,
            category_id: draft.category_id,
            opening_time: draft.opening_time,
            closing_time: draft.closing_time,
            open_days: draft.open_days,
            avg_delivery_time: draft.avg_delivery_minutes,
            min_order_amount: draft.min_order_amount,
            free_delivery_threshold: draft.free_delivery_enabled ? draft.free_delivery_threshold : null,
            approval_status: 'pendiente',
            is_active: false,
            is_open: false,
            submitted_at: new Date().toISOString(),
        };

        if (draft.commerce_type === 'farmacia') {
            restaurantPayload['sespas_number'] = draft.sespas_number ?? null;
            restaurantPayload['farmacia_24h'] = draft.farmacia_24h ?? false;
            restaurantPayload['requires_prescription'] = draft.requires_prescription ?? false;
        } else if (draft.commerce_type === 'restaurante') {
            restaurantPayload['cuisine_types'] = draft.cuisine_types ?? [];
        }

        const { data: restaurant, error: restaurantError } = await this.supabase
            .from('restaurants')
            .insert(restaurantPayload)
            .select('id')
            .single();

        if (restaurantError || !restaurant) throw restaurantError ?? new Error('No se pudo crear el comercio');

        const restaurantId = restaurant.id;
        this.lastRestaurantId.set(restaurantId);

        const { error: adminError } = await this.supabase
            .from('restaurant_admins')
            .insert({ user_id: userId, restaurant_id: restaurantId });

        if (adminError) throw adminError;

        const { data: setting } = await this.supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'store_auto_approve')
            .maybeSingle();

        const autoApprove = setting?.value === 'true';

        if (autoApprove) {
            await this.supabase
                .from('restaurants')
                .update({ approval_status: 'aprobado', is_active: true, activated_at: new Date().toISOString() })
                .eq('id', restaurantId);
        }

        return { approved: autoApprove, restaurantId };
    }
}
