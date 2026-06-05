import { Injectable, signal } from '@angular/core';
import { Observable, from } from 'rxjs';
import { getSupabaseClient } from '../../../core/supabase/supabase.client';
import { Restaurant, StoreCategory, Payout, CommissionTier } from '../../../core/supabase/database.types';

export interface TeamMember {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
  joined_at: string;
  role: string;
}

export interface StoreNotifPrefs {
  soundEnabled: boolean;
  whatsappEnabled: boolean;
  whatsappNumber: string;
  lowStockEnabled: boolean;
  lowStockThreshold: number;
}

export interface StoreDaySchedule {
  open: boolean;
  opening_time: string;
  closing_time: string;
}

const NOTIF_PREFS_KEY = (storeId: string) => `tutty_notif_${storeId}`;
const DEFAULT_NOTIF: StoreNotifPrefs = {
  soundEnabled: true,
  whatsappEnabled: false,
  whatsappNumber: '',
  lowStockEnabled: false,
  lowStockThreshold: 5,
};

@Injectable({ providedIn: 'root' })
export class StoreSettingsService {
  private readonly supabase = getSupabaseClient();
  readonly isSaving = signal(false);

  // ─── Store profile ─────────────────────────────────────────────────────────

  async updateStore(id: string, patch: Partial<Restaurant>): Promise<void> {
    this.isSaving.set(true);
    try {
      const { error } = await this.supabase.from('restaurants').update(patch).eq('id', id);
      if (error) throw error;
    } finally {
      this.isSaving.set(false);
    }
  }

  async uploadImage(file: File, storeId: string, type: 'logo' | 'banner'): Promise<string> {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `stores/${storeId}/${type}.${ext}`;
    const { error } = await this.supabase.storage.from('media').upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (error) throw error;
    const { data } = this.supabase.storage.from('media').getPublicUrl(path);
    return data.publicUrl;
  }

  getStoreCategories(commerceType: string): Observable<StoreCategory[]> {
    return from(
      this.supabase
        .from('store_categories')
        .select('*')
        .eq('commerce_type', commerceType)
        .eq('is_active', true)
        .order('display_order')
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as StoreCategory[];
        }),
    );
  }

  // ─── Team ─────────────────────────────────────────────────────────────────

  getTeamMembers(storeId: string): Observable<TeamMember[]> {
    return from(
      this.supabase
        .from('restaurant_admins')
        .select('user_id, created_at, role, users(full_name, email, avatar_url)')
        .eq('restaurant_id', storeId)
        .then(({ data, error }) => {
          if (error) throw error;
          return ((data ?? []) as any[]).map(row => ({
            user_id: row.user_id,
            full_name: row.users?.full_name ?? '—',
            email: row.users?.email ?? '—',
            avatar_url: row.users?.avatar_url ?? null,
            joined_at: row.created_at,
            role: row.role ?? 'admin',
          })) as TeamMember[];
        }),
    );
  }

  async inviteAdminByEmail(storeId: string, email: string): Promise<'linked' | 'not_found'> {
    // Check if user exists
    const { data: user } = await this.supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (!user) return 'not_found';

    const { error } = await this.supabase
      .from('restaurant_admins')
      .upsert({ restaurant_id: storeId, user_id: user.id, role: 'admin' }, { onConflict: 'restaurant_id,user_id' });

    if (error) throw error;
    return 'linked';
  }

  async removeAdmin(storeId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('restaurant_admins')
      .delete()
      .eq('restaurant_id', storeId)
      .eq('user_id', userId);
    if (error) throw error;
  }

  // ─── Payouts (Finances tab) ────────────────────────────────────────────────

  getPayouts(storeId: string): Observable<Payout[]> {
    return from(
      this.supabase
        .from('store_payouts')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(20)
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as Payout[];
        }),
    );
  }

  async getPendingBalance(storeId: string): Promise<number> {
    const { data } = await this.supabase
      .from('orders')
      .select('total, commission_rate:restaurants!inner(commission_rate)')
      .eq('restaurant_id', storeId)
      .eq('status', 'entregado')
      .is('payout_id', null);

    const rows = (data ?? []) as any[];
    return rows.reduce((sum, r) => {
      const rate = r.commission_rate ?? 0;
      return sum + r.total * (1 - rate);
    }, 0);
  }

  // ─── Notification prefs (localStorage per store) ───────────────────────────

  loadNotifPrefs(storeId: string): StoreNotifPrefs {
    try {
      const raw = localStorage.getItem(NOTIF_PREFS_KEY(storeId));
      return raw ? { ...DEFAULT_NOTIF, ...JSON.parse(raw) } : { ...DEFAULT_NOTIF };
    } catch {
      return { ...DEFAULT_NOTIF };
    }
  }

  saveNotifPrefs(storeId: string, prefs: StoreNotifPrefs): void {
    localStorage.setItem(NOTIF_PREFS_KEY(storeId), JSON.stringify(prefs));
  }

  // ─── Commission tier helpers ───────────────────────────────────────────────

  tierLabel(tier: CommissionTier | null | undefined): string {
    const labels: Record<CommissionTier, string> = {
      onboarding: 'Onboarding',
      estandar: 'Estándar',
      medio: 'Medio',
      alto: 'Alto',
      premium: 'Premium',
    };
    return tier ? (labels[tier] ?? tier) : 'Estándar';
  }

  tierColor(tier: CommissionTier | null | undefined): string {
    const colors: Record<CommissionTier, string> = {
      onboarding: '#f59e0b',
      estandar: '#6b7280',
      medio: '#3b82f6',
      alto: '#8b5cf6',
      premium: '#e91e8c',
    };
    return tier ? (colors[tier] ?? '#6b7280') : '#6b7280';
  }

  onboardingDaysLeft(activatedAt: string | null | undefined): number {
    if (!activatedAt) return 0;
    const diffMs = Date.now() - new Date(activatedAt).getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    return Math.max(0, 30 - diffDays);
  }
}
