import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import {
  Payout, PayoutSummary, PayoutStatus, PayoutMethod,
  FinanceKpi, FinanceDailyPoint, SurchargeStats, DeliveryFeeRange,
} from '../../core/supabase/database.types';

@Injectable({ providedIn: 'root' })
export class PayoutsService {
  private readonly supabase = getSupabaseClient();

  // ── Payout CRUD ───────────────────────────────────────────────────────────

  getPayoutsByStore(storeId: string): Observable<Payout[]> {
    return from(
      this.supabase.from('store_payouts')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as Payout[];
        })
    );
  }

  getPayoutsSummary(fromDate: string, toDate: string): Observable<PayoutSummary[]> {
    return from(this.fetchPayoutsSummary(fromDate, toDate));
  }

  private async fetchPayoutsSummary(fromDate: string, toDate: string): Promise<PayoutSummary[]> {
    // Aggregate delivered orders per store in the period
    const { data: orders, error } = await this.supabase
      .from('orders')
      .select('commerce_id, subtotal, commission_amount, delivery_fee, commerce:commerces(name)')
      .eq('status', 'entregado')
      .gte('created_at', fromDate)
      .lte('created_at', toDate);
    if (error) throw error;

    // Aggregate by store
    const map: Record<string, PayoutSummary> = {};
    for (const o of (orders ?? [])) {
      const raw = o as any;
      const storeId: string = raw.commerce_id;
      const storeName: string = raw.commerce?.name ?? storeId;
      if (!map[storeId]) {
        map[storeId] = {
          store_id: storeId,
          store_name: storeName,
          gross_sales: 0,
          commission_total: 0,
          delivery_fees: 0,
          net_amount: 0,
          order_count: 0,
        };
      }
      map[storeId].gross_sales += raw.subtotal ?? 0;
      map[storeId].commission_total += raw.commission_amount ?? 0;
      map[storeId].delivery_fees += raw.delivery_fee ?? 0;
      map[storeId].order_count += 1;
    }

    // Fill net_amount
    const summaries = Object.values(map).map(s => ({
      ...s,
      net_amount: s.gross_sales - s.commission_total,
    }));

    // Attach existing payout status for the period
    const storeIds = summaries.map(s => s.store_id);
    if (storeIds.length > 0) {
      const { data: payouts } = await this.supabase
        .from('store_payouts')
        .select('id, store_id, status')
        .in('store_id', storeIds)
        .gte('period_from', fromDate)
        .lte('period_to', toDate);
      for (const p of (payouts ?? []) as any[]) {
        const s = map[p.store_id];
        if (s) {
          s.payout_id = p.id;
          s.payout_status = p.status;
        }
      }
    }

    return summaries.sort((a, b) => b.gross_sales - a.gross_sales);
  }

  async generatePayout(storeId: string, fromDate: string, toDate: string): Promise<Payout> {
    // Calculate from orders
    const { data: orders, error: oErr } = await this.supabase
      .from('orders')
      .select('subtotal, commission_amount, delivery_fee')
      .eq('commerce_id', storeId)
      .eq('status', 'entregado')
      .gte('created_at', fromDate)
      .lte('created_at', toDate);
    if (oErr) throw oErr;

    const rows = orders ?? [];
    const grossSales = rows.reduce((s: number, r: any) => s + (r.subtotal ?? 0), 0);
    const commissionTotal = rows.reduce((s: number, r: any) => s + (r.commission_amount ?? 0), 0);
    const deliveryFees = rows.reduce((s: number, r: any) => s + (r.delivery_fee ?? 0), 0);
    const netAmount = grossSales - commissionTotal;

    const { data, error } = await this.supabase
      .from('store_payouts')
      .insert({
        store_id: storeId,
        period_from: fromDate,
        period_to: toDate,
        gross_sales: grossSales,
        commission_total: commissionTotal,
        delivery_fees: deliveryFees,
        net_amount: netAmount,
        status: 'pendiente',
      })
      .select()
      .single();
    if (error) throw error;
    return data as Payout;
  }

  async markAsPaid(payoutId: string, method: PayoutMethod, reference: string): Promise<void> {
    const { error } = await this.supabase
      .from('store_payouts')
      .update({
        status: 'pagado',
        payment_method: method,
        payment_reference: reference,
        paid_at: new Date().toISOString(),
      })
      .eq('id', payoutId);
    if (error) throw error;
  }

  // ── Finance KPIs ──────────────────────────────────────────────────────────

  getFinanceKpi(fromDate: string, toDate: string): Observable<FinanceKpi> {
    return from(this.fetchFinanceKpi(fromDate, toDate));
  }

  private async fetchFinanceKpi(fromDate: string, toDate: string): Promise<FinanceKpi> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('total, subtotal, commission_amount, delivery_fee, discount_amount, status')
      .gte('created_at', fromDate)
      .lte('created_at', toDate);
    if (error) throw error;

    const delivered = (data ?? []).filter((r: any) => r.status === 'entregado');
    const grossSales = delivered.reduce((s: number, r: any) => s + (r.subtotal ?? 0), 0);
    const commissions = delivered.reduce((s: number, r: any) => s + (r.commission_amount ?? 0), 0);
    const deliveryFees = delivered.reduce((s: number, r: any) => s + (r.delivery_fee ?? 0), 0);
    const discounts = (data ?? []).reduce((s: number, r: any) => s + (r.discount_amount ?? 0), 0);
    return {
      grossSales,
      commissions,
      deliveryFees,
      discounts,
      netTutty: commissions + deliveryFees - discounts,
      orderCount: delivered.length,
    };
  }

  getDailyTimeSeries(fromDate: string, toDate: string): Observable<FinanceDailyPoint[]> {
    return from(this.fetchDailyTimeSeries(fromDate, toDate));
  }

  private async fetchDailyTimeSeries(fromDate: string, toDate: string): Promise<FinanceDailyPoint[]> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('subtotal, commission_amount, created_at, status')
      .eq('status', 'entregado')
      .gte('created_at', fromDate)
      .lte('created_at', toDate)
      .order('created_at');
    if (error) throw error;

    const map: Record<string, FinanceDailyPoint> = {};
    for (const r of (data ?? []) as any[]) {
      const day = r.created_at.slice(0, 10);
      if (!map[day]) map[day] = { date: day, grossSales: 0, commissions: 0 };
      map[day].grossSales += r.subtotal ?? 0;
      map[day].commissions += r.commission_amount ?? 0;
    }
    return Object.values(map);
  }

  // ── Surcharge Stats ───────────────────────────────────────────────────────

  getSurchargeStats(fromDate: string, toDate: string): Observable<SurchargeStats> {
    return from(this.fetchSurchargeStats(fromDate, toDate));
  }

  private async fetchSurchargeStats(fromDate: string, toDate: string): Promise<SurchargeStats> {
    const { data, error } = await this.supabase
      .from('delivery_surcharge_log')
      .select(`
                weather_applied, weather_rate, base_fee,
                peak_applied, peak_rate,
                night_applied, night_rate,
                holiday_applied, holiday_rate,
                surge_applied, surge_multiplier,
                final_fee, created_at,
                order:orders(created_at)
            `)
      .gte('created_at', fromDate)
      .lte('created_at', toDate);
    if (error) throw error;

    const stats: SurchargeStats = {
      weatherCount: 0, weatherTotal: 0,
      peakCount: 0, peakTotal: 0,
      nightCount: 0, nightTotal: 0,
      holidayCount: 0, holidayTotal: 0,
      surgeCount: 0, surgeTotal: 0,
    };
    for (const r of (data ?? []) as any[]) {
      if (r.weather_applied) { stats.weatherCount++; stats.weatherTotal += (r.final_fee - r.base_fee) * (r.weather_rate ?? 0); }
      if (r.peak_applied) { stats.peakCount++; stats.peakTotal += (r.final_fee - r.base_fee) * (r.peak_rate ?? 0); }
      if (r.night_applied) { stats.nightCount++; stats.nightTotal += (r.final_fee - r.base_fee) * (r.night_rate ?? 0); }
      if (r.holiday_applied) { stats.holidayCount++; stats.holidayTotal += (r.final_fee - r.base_fee) * (r.holiday_rate ?? 0); }
      if (r.surge_applied) { stats.surgeCount++; stats.surgeTotal += r.final_fee * ((r.surge_multiplier ?? 1) - 1); }
    }
    return stats;
  }

  getDeliveryFeeDistribution(fromDate: string, toDate: string): Observable<DeliveryFeeRange[]> {
    return from(this.fetchFeeDistribution(fromDate, toDate));
  }

  private async fetchFeeDistribution(fromDate: string, toDate: string): Promise<DeliveryFeeRange[]> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('delivery_fee')
      .gte('created_at', fromDate)
      .lte('created_at', toDate)
      .not('delivery_fee', 'is', null);
    if (error) throw error;

    const buckets: Record<string, number> = {
      'RD$0': 0, 'RD$1-50': 0, 'RD$51-100': 0,
      'RD$101-150': 0, 'RD$151-200': 0, 'RD$200+': 0,
    };
    for (const r of (data ?? []) as any[]) {
      const fee = r.delivery_fee ?? 0;
      if (fee === 0) buckets['RD$0']++;
      else if (fee <= 50) buckets['RD$1-50']++;
      else if (fee <= 100) buckets['RD$51-100']++;
      else if (fee <= 150) buckets['RD$101-150']++;
      else if (fee <= 200) buckets['RD$151-200']++;
      else buckets['RD$200+']++;
    }
    return Object.entries(buckets).map(([range, count]) => ({ range, count }));
  }
}
