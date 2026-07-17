import { Injectable, inject, signal } from '@angular/core';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import { RegistrationDraft, StoreCategory } from '../../core/supabase/database.types';

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
  temp_logo_path: null,
  temp_banner_path: null,
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
  commerceId: string;
}

@Injectable({ providedIn: 'root' })
export class RegisterService {
  private readonly supabase = getSupabaseClient();

  readonly registrationData = signal<RegistrationDraft>({ ...DEFAULT_DRAFT });
  readonly lastCommerceId = signal<string | null>(null);

  update(patch: Partial<RegistrationDraft>): void {
    this.registrationData.update(current => ({ ...current, ...patch }));
  }

  reset(): void {
    this.registrationData.set({ ...DEFAULT_DRAFT });
    this.lastCommerceId.set(null);
  }

  async checkSlugAvailable(slug: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('commerces')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw error;
    return data === null;
  }

  async getStoreCategories(commerceType: string): Promise<StoreCategory[]> {
    const { data } = await this.supabase
      .from('restaurant_categories')
      .select('id, name, slug, display_order, commerce_type, is_active')
      .eq('commerce_type', commerceType)
      .eq('is_active', true)
      .order('display_order');
    return (data ?? []) as StoreCategory[];
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

    // Ensure we have an authenticated session before DB writes guarded by RLS.
    let userId = authData.user.id;
    if (!authData.session) {
      const { data: signInData, error: signInError } = await this.supabase.auth.signInWithPassword({
        email: draft.email,
        password: draft.password,
      });
      if (signInError || !signInData.user) {
        throw signInError ?? new Error('Cuenta creada, pero no se pudo iniciar sesión para completar el registro.');
      }
      userId = signInData.user.id;
    }

    // 2. Ensure user profile exists with store_admin role
    const { error: userError } = await this.supabase
      .from('users')
      .upsert({
        id: userId,
        email: draft.email,
        full_name: draft.full_name,
        phone: draft.phone || null,
        role: 'store_admin',
      }, { onConflict: 'id' });

    if (userError) throw userError;

    // 3. Insert commerce via secure RPC (RLS-safe)
    const { data: restaurantData, error: restaurantError } = await this.supabase.rpc('register_commerce', this.buildRegisterCommercePayload(draft));
    if (restaurantError || !restaurantData) throw restaurantError ?? new Error('No se pudo crear el comercio');

    const restaurant = Array.isArray(restaurantData) ? restaurantData[0] : restaurantData;
    if (!restaurant?.id) throw new Error('No se recibió el comercio creado');

    const commerceId = restaurant.id;
    this.lastCommerceId.set(commerceId);
    return { approved: false, commerceId };
  }

  async getMyStoreStatus(commerceId: string): Promise<{ approval_status: string; rejection_reason: string | null } | null> {
    const { data, error } = await this.supabase
      .from('commerces')
      .select('approval_status, rejection_reason')
      .eq('id', commerceId)
      .single();

    if (error) return null;
    return data as { approval_status: string; rejection_reason: string | null };
  }

  /** For users who are already authenticated — skips signUp, uses existing userId. */
  async submitRegistrationForExistingUser(userId: string): Promise<SubmitResult> {
    const draft = this.registrationData();
    const { data: authData } = await this.supabase.auth.getUser();
    const authUser = authData.user;

    // Promote/update existing user to store_admin.
    const { error: roleError } = await this.supabase
      .from('users')
      .upsert({
        id: userId,
        email: authUser?.email ?? draft.email,
        role: 'store_admin',
        full_name: draft.full_name || authUser?.user_metadata?.['full_name'] || null,
        phone: draft.phone || null,
      }, { onConflict: 'id' });
    if (roleError) throw roleError;

    const { data: restaurantData, error: restaurantError } = await this.supabase.rpc('register_commerce', this.buildRegisterCommercePayload(draft));
    if (restaurantError || !restaurantData) throw restaurantError ?? new Error('No se pudo crear el comercio');

    const restaurant = Array.isArray(restaurantData) ? restaurantData[0] : restaurantData;
    if (!restaurant?.id) throw new Error('No se recibió el comercio creado');

    const commerceId = restaurant.id;
    this.lastCommerceId.set(commerceId);
    return { approved: false, commerceId };
  }

  private buildRegisterCommercePayload(draft: RegistrationDraft): Record<string, unknown> {
    return {
      p_name: draft.name,
      p_slug: draft.slug,
      p_commerce_type: draft.commerce_type,
      p_description: draft.description || null,
      p_whatsapp_number: draft.whatsapp_number || null,
      p_address: draft.address || null,
      p_sector: draft.sector || null,
      p_city: draft.city,
      p_category_id: draft.category_id,
      p_cuisine_types: draft.cuisine_types ?? [],
      p_open_days: draft.open_days,
      p_opening_time: draft.opening_time,
      p_closing_time: draft.closing_time,
      p_min_order_amount: draft.min_order_amount,
      p_avg_delivery_time: draft.avg_delivery_minutes,
      p_free_delivery_threshold: draft.free_delivery_enabled ? draft.free_delivery_threshold : null,
      p_temp_logo_path: draft.temp_logo_path ?? null,
      p_temp_banner_path: draft.temp_banner_path ?? null,
    };
  }
}
