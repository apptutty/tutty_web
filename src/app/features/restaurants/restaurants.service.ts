import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import { Restaurant, MenuCategory, MenuItem, DeliveryZone } from '../../core/supabase/database.types';

@Injectable({ providedIn: 'root' })
export class RestaurantsService {
    private readonly supabase = getSupabaseClient();

    getRestaurants(search?: string): Observable<{ data: Restaurant[]; count: number }> {
        return from(this.fetchRestaurants(search));
    }

    private async fetchRestaurants(search?: string) {
        let query = this.supabase
            .from('commerces')
            .select('*', { count: 'exact' })
            .order('name');
        if (search) query = query.ilike('name', `%${search}%`);
        const { data, count, error } = await query;
        if (error) throw error;
        return { data: (data ?? []) as Restaurant[], count: count ?? 0 };
    }

    getRestaurantById(id: string): Observable<Restaurant> {
        return from(
            this.supabase.from('commerces').select('*').eq('id', id).single()
                .then(({ data, error }) => {
                    if (error) throw error;
                    return data as Restaurant;
                })
        );
    }

    async saveRestaurant(data: Partial<Restaurant>): Promise<Restaurant> {
        if (data.id) {
            const { data: res, error } = await this.supabase
                .from('commerces').update(data).eq('id', data.id).select().single();
            if (error) throw error;
            return res as Restaurant;
        } else {
            const { data: res, error } = await this.supabase
                .from('commerces').insert(data).select().single();
            if (error) throw error;
            return res as Restaurant;
        }
    }

    async toggleRestaurantOpen(id: string, isOpen: boolean): Promise<void> {
        const { error } = await this.supabase.from('commerces').update({ is_open: isOpen }).eq('id', id);
        if (error) throw error;
    }

    async toggleRestaurantActive(id: string, isActive: boolean): Promise<void> {
        const { error } = await this.supabase.from('commerces').update({ is_active: isActive }).eq('id', id);
        if (error) throw error;
    }

    // Menu
    getCategories(commerceId: string): Observable<MenuCategory[]> {
        return from(
            this.supabase.from('menu_categories').select('*')
                .eq('commerce_id', commerceId).order('display_order')
                .then(({ data }) => (data ?? []) as MenuCategory[])
        );
    }

    getMenuItems(categoryId: string): Observable<MenuItem[]> {
        return from(
            this.supabase.from('menu_items').select('*')
                .eq('category_id', categoryId).order('display_order')
                .then(({ data }) => (data ?? []) as MenuItem[])
        );
    }

    async saveMenuItem(item: Partial<MenuItem>): Promise<void> {
        if (item.id) {
            const { data, error } = await this.supabase
                .from('menu_items').update(item).eq('id', item.id).select('id');
            if (error) throw error;
            if (!data || data.length === 0) throw new Error('No rows updated — check RLS policies');
        } else {
            const { error } = await this.supabase.from('menu_items').insert(item);
            if (error) throw error;
        }
    }

    async deleteMenuItem(id: string): Promise<void> {
        const { error } = await this.supabase.from('menu_items').delete().eq('id', id);
        if (error) throw error;
    }

    async saveCategory(cat: Partial<MenuCategory>): Promise<void> {
        if (cat.id) {
            const { error } = await this.supabase.from('menu_categories').update(cat).eq('id', cat.id);
            if (error) throw error;
        } else {
            const { error } = await this.supabase.from('menu_categories').insert(cat);
            if (error) throw error;
        }
    }

    // Delivery zones
    getDeliveryZones(commerceId: string): Observable<DeliveryZone[]> {
        return from(
            this.supabase.from('delivery_zones').select('*')
                .eq('commerce_id', commerceId).order('priority')
                .then(({ data }) => (data ?? []) as DeliveryZone[])
        );
    }

    async saveDeliveryZone(zone: Partial<DeliveryZone>): Promise<void> {
        if (zone.id) {
            const { error } = await this.supabase.from('delivery_zones').update(zone).eq('id', zone.id);
            if (error) throw error;
        } else {
            const { error } = await this.supabase.from('delivery_zones').insert(zone);
            if (error) throw error;
        }
    }

    async deleteDeliveryZone(id: string): Promise<void> {
        const { error } = await this.supabase.from('delivery_zones').delete().eq('id', id);
        if (error) throw error;
    }
}
