import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import { AuthService } from '../../core/auth/auth.service';
import { StoreApproval, ApprovalStatus } from '../../core/supabase/database.types';

@Injectable({ providedIn: 'root' })
export class ApprovalQueueService {
  private readonly supabase = getSupabaseClient();
  private readonly authService = inject(AuthService);

  getStoresByStatus(status: ApprovalStatus): Observable<StoreApproval[]> {
    return from(
      this.supabase
        .from('restaurants')
        .select(`
                    id, name, commerce_type, logo_url, address, city,
                    approval_status, rejection_reason, approval_notes,
                    approved_by, approved_at, submitted_at,
                    restaurant_admins(users(id, email, full_name))
                `)
        .eq('approval_status', status)
        .order('submitted_at', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data ?? []).map((row: any) => {
          const adminUser = row.restaurant_admins?.[0]?.users;
          return {
            id: row.id,
            name: row.name,
            commerce_type: row.commerce_type,
            logo_url: row.logo_url,
            address: row.address,
            city: row.city,
            approval_status: row.approval_status,
            rejection_reason: row.rejection_reason,
            approval_notes: row.approval_notes,
            approved_by: row.approved_by,
            approved_at: row.approved_at,
            submitted_at: row.submitted_at,
            admin_email: adminUser?.email,
            admin_name: adminUser?.full_name,
          } as StoreApproval;
        });
      })
    );
  }

  watchPending(): Observable<StoreApproval[]> {
    return new Observable(observer => {
      // Initial load
      this.getStoresByStatus('pendiente').subscribe(data => observer.next(data));

      const channel = this.supabase
        .channel('approval-pending')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'restaurants' },
          () => {
            this.getStoresByStatus('pendiente').subscribe(data => observer.next(data));
          }
        )
        .subscribe();

      return () => { this.supabase.removeChannel(channel); };
    });
  }

  async approveStore(storeId: string, notes?: string): Promise<void> {
    const adminId = this.authService.currentUser()?.id;
    const { error } = await this.supabase
      .from('restaurants')
      .update({
        approval_status: 'aprobado',
        is_active: true,
        approved_by: adminId,
        approved_at: new Date().toISOString(),
        approval_notes: notes ?? null,
      })
      .eq('id', storeId);
    if (error) throw error;
    await this._notifyStoreAdmin(storeId, 'Tu comercio ha sido aprobado y ya está activo en Tutty. ¡Bienvenido!');
  }

  async rejectStore(storeId: string, reason: string): Promise<void> {
    const adminId = this.authService.currentUser()?.id;
    const { error } = await this.supabase
      .from('restaurants')
      .update({
        approval_status: 'rechazado',
        is_active: false,
        rejection_reason: reason,
        approved_by: adminId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', storeId);
    if (error) throw error;
    await this._notifyStoreAdmin(storeId, `Tu solicitud fue rechazada. Motivo: ${reason}`);
  }

  async suspendStore(storeId: string, reason: string): Promise<void> {
    const { error } = await this.supabase
      .from('restaurants')
      .update({
        approval_status: 'suspendido',
        is_active: false,
        rejection_reason: reason,
      })
      .eq('id', storeId);
    if (error) throw error;
    await this._notifyStoreAdmin(storeId, `Tu comercio ha sido suspendido. Motivo: ${reason}`);
  }

  async checkAutoApprove(): Promise<boolean> {
    const { data } = await this.supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'store_auto_approve')
      .single();
    return data?.value === 'true';
  }

  async setAutoApprove(enabled: boolean): Promise<void> {
    await this.supabase
      .from('app_settings')
      .upsert({ key: 'store_auto_approve', value: enabled ? 'true' : 'false' }, { onConflict: 'key' });

    if (enabled) {
      const adminId = this.authService.currentUser()?.id;
      // Approve all currently pending stores
      await this.supabase
        .from('restaurants')
        .update({
          approval_status: 'aprobado',
          is_active: true,
          approved_by: adminId,
          approved_at: new Date().toISOString(),
          approval_notes: 'Aprobado automáticamente por configuración del sistema',
        })
        .eq('approval_status', 'pendiente');
    }
  }

  private async _notifyStoreAdmin(storeId: string, message: string): Promise<void> {
    const { data: admins } = await this.supabase
      .from('restaurant_admins')
      .select('user_id')
      .eq('restaurant_id', storeId);

    if (!admins?.length) return;

    const notifications = admins.map((a: any) => ({
      user_id: a.user_id,
      title: 'Tutty — Estado de tu comercio',
      message: message,
      type: 'store_approval',
      data: { store_id: storeId },
    }));

    await this.supabase.from('notifications').insert(notifications);
  }
}
