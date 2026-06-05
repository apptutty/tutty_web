import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../../../core/supabase/supabase.client';
import { Order, OrderItem } from '../../../core/supabase/database.types';

export interface ReportKPIs {
  grossSales: number;
  orderCount: number;
  avgTicket: number;
  cancelRate: number;
  productsSold: number;
}

export interface DailySale {
  date: string;   // 'YYYY-MM-DD'
  total: number;
}

export interface TopProduct {
  name: string;
  qty: number;
  revenue: number;
  photo_url?: string | null;
}

export interface StoreReview {
  id: string;
  order_id: string;
  rating: number;
  comment?: string | null;
  created_at: string;
  customer_name?: string;
}

@Injectable({ providedIn: 'root' })
export class StoreReportsService {
  private readonly supabase = getSupabaseClient();

  // ─── KPIs ──────────────────────────────────────────────────────────────────
  async getKPIs(storeId: string, from: string, to: string): Promise<ReportKPIs> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('status, total, subtotal')
      .eq('commerce_id', storeId)
      .gte('created_at', from)
      .lte('created_at', to);

    if (error) throw error;
    const orders = (data ?? []) as Pick<Order, 'status' | 'total' | 'subtotal'>[];

    const delivered = orders.filter(o => o.status === 'entregado');
    const cancelled = orders.filter(o => o.status === 'cancelado');
    const grossSales = delivered.reduce((s, o) => s + (o.total ?? 0), 0);
    const orderCount = delivered.length;
    const avgTicket = orderCount > 0 ? grossSales / orderCount : 0;
    const cancelRate = orders.length > 0 ? (cancelled.length / orders.length) * 100 : 0;

    // Get products sold (from order_items for delivered orders)
    const deliveredIds = delivered.map(o => (o as any).id).filter(Boolean);
    let productsSold = 0;
    if (deliveredIds.length > 0) {
      const { data: items } = await this.supabase
        .from('order_items')
        .select('quantity')
        .in('order_id', deliveredIds);
      productsSold = (items ?? []).reduce((s: number, i: { quantity: number }) => s + (i.quantity ?? 0), 0);
    }

    return { grossSales, orderCount, avgTicket, cancelRate, productsSold };
  }

  // ─── Daily Sales ───────────────────────────────────────────────────────────
  async getDailySales(storeId: string, from: string, to: string): Promise<DailySale[]> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('created_at, total, status')
      .eq('commerce_id', storeId)
      .eq('status', 'entregado')
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const byDate: Record<string, number> = {};
    for (const o of (data ?? []) as { created_at: string; total: number }[]) {
      const day = o.created_at.slice(0, 10);
      byDate[day] = (byDate[day] ?? 0) + (o.total ?? 0);
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date, total }));
  }

  // ─── Top Products ──────────────────────────────────────────────────────────
  async getTopProducts(storeId: string, from: string, to: string, limit = 10): Promise<TopProduct[]> {
    // First get delivered order ids in range
    const { data: orders, error: oErr } = await this.supabase
      .from('orders')
      .select('id')
      .eq('commerce_id', storeId)
      .eq('status', 'entregado')
      .gte('created_at', from)
      .lte('created_at', to);

    if (oErr) throw oErr;
    const orderIds = (orders ?? []).map((o: { id: string }) => o.id);
    if (orderIds.length === 0) return [];

    const { data: items, error: iErr } = await this.supabase
      .from('order_items')
      .select('menu_item_snapshot, quantity, subtotal')
      .in('order_id', orderIds);

    if (iErr) throw iErr;

    const productMap: Record<string, TopProduct> = {};
    for (const item of (items ?? []) as Pick<OrderItem, 'menu_item_snapshot' | 'quantity' | 'subtotal'>[]) {
      const snap = item.menu_item_snapshot as Record<string, unknown> | null;
      if (!snap) continue;
      const name = (snap['name'] as string) ?? 'Desconocido';
      const photo_url = (snap['photo_url'] as string | null) ?? null;
      if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0, photo_url };
      productMap[name].qty += item.quantity ?? 0;
      productMap[name].revenue += item.subtotal ?? 0;
    }

    return Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  // ─── Demand Heatmap ────────────────────────────────────────────────────────
  // Returns 7×24 matrix: rows = Sun(0)–Sat(6) day of week, cols = hour 0-23
  async getDemandHeatmap(storeId: string, from: string, to: string): Promise<number[][]> {
    const matrix: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));

    const { data, error } = await this.supabase
      .from('orders')
      .select('created_at')
      .eq('commerce_id', storeId)
      .gte('created_at', from)
      .lte('created_at', to);

    if (error) throw error;

    for (const o of (data ?? []) as { created_at: string }[]) {
      const d = new Date(o.created_at);
      matrix[d.getDay()][d.getHours()]++;
    }
    return matrix;
  }

  // ─── Reviews ───────────────────────────────────────────────────────────────
  async getRecentReviews(_storeId: string): Promise<StoreReview[]> {
    // order_reviews table may not exist yet — gracefully return empty
    try {
      const { data, error } = await this.supabase
        .from('order_reviews' as never)
        .select('id, order_id, rating, comment, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) return [];
      return (data ?? []) as StoreReview[];
    } catch {
      return [];
    }
  }

  // ─── CSV Export ────────────────────────────────────────────────────────────
  async getOrdersForExport(storeId: string, from: string, to: string): Promise<Record<string, unknown>[]> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('id, order_number, status, total, subtotal, delivery_fee, discount_amount, itbis_amount, created_at, user_id')
      .eq('commerce_id', storeId)
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Record<string, unknown>[];
  }

  // ─── Helper: date range boundaries ────────────────────────────────────────
  static rangeFor(preset: 'hoy' | 'semana' | 'mes'): { from: string; to: string } {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'hoy') {
      const s = iso(now);
      return { from: `${s}T00:00:00`, to: `${s}T23:59:59` };
    }
    if (preset === 'semana') {
      const day = now.getDay();
      const start = new Date(now); start.setDate(now.getDate() - day);
      return { from: `${iso(start)}T00:00:00`, to: `${iso(now)}T23:59:59` };
    }
    // mes
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: `${iso(start)}T00:00:00`, to: `${iso(now)}T23:59:59` };
  }
}
