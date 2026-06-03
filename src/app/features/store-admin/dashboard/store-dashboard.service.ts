import { Injectable } from '@angular/core';
import { Observable, from, interval, switchMap, startWith } from 'rxjs';
import { getSupabaseClient } from '../../../core/supabase/supabase.client';
import { Order } from '../../../core/supabase/database.types';

export interface StoreKPIs {
  orderCount: number;
  sales: number;
  activeOrders: number;
  cancellations: number;
  avgTicket: number;
  rating: number;
  lowStockCount: number | null;
  outOfStockCount: number | null;
}

export interface TopProduct {
  name: string;
  totalSold: number;
  totalRevenue: number;
}

export interface ActiveOrder {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  customer_name: string;
  items: { name: string; quantity: number }[];
}

export interface SalesDay {
  date: string;
  sales: number;
  orders: number;
}

export interface LowStockItem {
  id: string;
  name: string;
  stock_count: number;
  low_stock_alert: number | null;
}

const STOCK_COMMERCE_TYPES = ['farmacia', 'bodega', 'colmado', 'tienda_ropa', 'electronica', 'supermercado'];

@Injectable({ providedIn: 'root' })
export class StoreDashboardService {
  private readonly supabase = getSupabaseClient();

  getTodayKPIs(storeId: string, commerceType: string): Observable<StoreKPIs> {
    return from(this.fetchTodayKPIs(storeId, commerceType));
  }

  private async fetchTodayKPIs(storeId: string, commerceType: string): Promise<StoreKPIs> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [ordersRes, storeRes] = await Promise.all([
      this.supabase
        .from('orders')
        .select('id, status, total')
        .eq('restaurant_id', storeId)
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString()),
      this.supabase
        .from('restaurants')
        .select('avg_rating')
        .eq('id', storeId)
        .single(),
    ]);

    const orders = ordersRes.data ?? [];
    const activeStatuses = ['recibido', 'confirmado', 'en_preparacion', 'en_camino'];

    const completedOrders = orders.filter(o => o.status !== 'cancelado');
    const sales = completedOrders.reduce((sum, o) => sum + (o.total ?? 0), 0);
    const orderCount = orders.length;
    const activeOrders = orders.filter(o => activeStatuses.includes(o.status)).length;
    const cancellations = orders.filter(o => o.status === 'cancelado').length;
    const avgTicket = completedOrders.length > 0 ? sales / completedOrders.length : 0;
    const rating = storeRes.data?.avg_rating ?? 0;

    let lowStockCount: number | null = null;
    let outOfStockCount: number | null = null;

    if (STOCK_COMMERCE_TYPES.includes(commerceType)) {
      const { data: stockItems } = await this.supabase
        .from('menu_items')
        .select('stock_count, low_stock_alert')
        .eq('restaurant_id', storeId)
        .eq('track_stock', true)
        .eq('is_available', true);

      if (stockItems) {
        outOfStockCount = stockItems.filter(i => (i.stock_count ?? 0) === 0).length;
        lowStockCount = stockItems.filter(i =>
          (i.stock_count ?? 0) > 0 &&
          i.low_stock_alert != null &&
          (i.stock_count ?? 0) <= i.low_stock_alert
        ).length;
      }
    }

    return { orderCount, sales, activeOrders, cancellations, avgTicket, rating, lowStockCount, outOfStockCount };
  }

  getActiveOrders(storeId: string): Observable<ActiveOrder[]> {
    // Poll every 30s; Supabase Realtime for row-level events would require DB config
    return interval(30_000).pipe(
      startWith(0),
      switchMap(() => from(this.fetchActiveOrders(storeId))),
    );
  }

  private async fetchActiveOrders(storeId: string): Promise<ActiveOrder[]> {
    const { data, error } = await this.supabase
      .from('orders')
      .select(`
        id, order_number, status, total, created_at,
        users!user_id(full_name),
        order_items(quantity, menu_item_snapshot)
      `)
      .eq('restaurant_id', storeId)
      .in('status', ['recibido', 'confirmado', 'en_preparacion', 'en_camino'])
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    return (data as any[]).map(o => ({
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      total: o.total,
      created_at: o.created_at,
      customer_name: o.users?.full_name ?? 'Cliente',
      items: (o.order_items ?? []).map((item: any) => ({
        name: item.menu_item_snapshot?.name ?? 'Producto',
        quantity: item.quantity,
      })),
    }));
  }

  getTopProducts(storeId: string, limit = 5): Observable<TopProduct[]> {
    return from(this.fetchTopProducts(storeId, limit));
  }

  private async fetchTopProducts(storeId: string, limit: number): Promise<TopProduct[]> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data, error } = await this.supabase
      .from('order_items')
      .select(`
        quantity, unit_price, subtotal, menu_item_snapshot,
        orders!inner(restaurant_id, status, created_at)
      `)
      .eq('orders.restaurant_id', storeId)
      .neq('orders.status', 'cancelado')
      .gte('orders.created_at', todayStart.toISOString());

    if (error || !data) return [];

    const totals = new Map<string, { totalSold: number; totalRevenue: number }>();
    for (const item of data as any[]) {
      const name = item.menu_item_snapshot?.name ?? 'Producto';
      const existing = totals.get(name) ?? { totalSold: 0, totalRevenue: 0 };
      totals.set(name, {
        totalSold: existing.totalSold + (item.quantity ?? 0),
        totalRevenue: existing.totalRevenue + (item.subtotal ?? 0),
      });
    }

    return Array.from(totals.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, limit);
  }

  getWeeklySales(storeId: string): Observable<SalesDay[]> {
    return from(this.fetchWeeklySales(storeId));
  }

  private async fetchWeeklySales(storeId: string): Promise<SalesDay[]> {
    const days: SalesDay[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end = new Date(d); end.setHours(23, 59, 59, 999);

      const { data } = await this.supabase
        .from('orders')
        .select('total, status')
        .eq('restaurant_id', storeId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const completed = (data ?? []).filter((o: any) => o.status !== 'cancelado');
      const dayLabel = d.toLocaleDateString('es-DO', { weekday: 'short' });
      days.push({
        date: dayLabel,
        sales: completed.reduce((s: number, o: any) => s + (o.total ?? 0), 0),
        orders: completed.length,
      });
    }

    return days;
  }

  getLowStockItems(storeId: string): Observable<LowStockItem[]> {
    return from(this.fetchLowStockItems(storeId));
  }

  private async fetchLowStockItems(storeId: string): Promise<LowStockItem[]> {
    const { data: items } = await this.supabase
      .from('menu_items')
      .select('id, name, stock_count, low_stock_alert')
      .eq('restaurant_id', storeId)
      .eq('track_stock', true)
      .order('stock_count', { ascending: true });

    if (!items) return [];

    return items.filter(i =>
      i.low_stock_alert != null
        ? (i.stock_count ?? 0) <= i.low_stock_alert
        : (i.stock_count ?? 0) === 0
    ) as LowStockItem[];
  }

  async updateStock(itemId: string, newCount: number): Promise<void> {
    await this.supabase
      .from('menu_items')
      .update({ stock_count: newCount })
      .eq('id', itemId);
  }

  async advanceOrderStatus(orderId: string, currentStatus: string): Promise<string | null> {
    const nextStatus: Record<string, string> = {
      recibido: 'confirmado',
      confirmado: 'en_preparacion',
      en_preparacion: 'en_camino',
    };
    const next = nextStatus[currentStatus];
    if (!next) return null;
    await this.supabase
      .from('orders')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', orderId);
    return next;
  }
}
