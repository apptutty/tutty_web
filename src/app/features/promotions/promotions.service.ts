import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import { Promotion, PromoType } from '../../core/supabase/database.types';

@Injectable({ providedIn: 'root' })
export class PromotionsService {
    private readonly supabase = getSupabaseClient();

    getPromotions(activeOnly = false): Observable<Promotion[]> {
        return from(
            (async () => {
                let q = this.supabase.from('promotions')
                    .select('*, restaurant:restaurants(name)')
                    .order('created_at', { ascending: false });
                if (activeOnly) q = q.eq('is_active', true);
                const { data } = await q;
                return (data ?? []).map((p: any) => ({
                    ...p,
                    restaurant_name: p.restaurant?.name ?? 'Global',
                })) as any[];
            })()
        );
    }

    async savePromotion(data: Partial<Promotion>): Promise<void> {
        if (data.id) {
            const { error } = await this.supabase.from('promotions').update(data).eq('id', data.id);
            if (error) throw error;
        } else {
            const { error } = await this.supabase.from('promotions').insert(data);
            if (error) throw error;
        }
    }

    async togglePromotion(id: string, isActive: boolean): Promise<void> {
        const { error } = await this.supabase.from('promotions').update({ is_active: isActive }).eq('id', id);
        if (error) throw error;
    }

    getPromoUses(promoId: string): Observable<any[]> {
        return from(
            this.supabase.from('promo_uses')
                .select('*, user:users(full_name), order:orders(order_number)')
                .eq('promotion_id', promoId)
                .order('created_at', { ascending: false })
                .limit(20)
                .then(({ data }) => (data ?? []).map((u: any) => ({
                    ...u,
                    user_name: u.user?.full_name ?? '—',
                    order_number: u.order?.order_number ?? '—',
                })))
        );
    }
}
