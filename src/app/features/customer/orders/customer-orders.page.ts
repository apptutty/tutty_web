import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { getSupabaseClient } from '../../../core/supabase/supabase.client';
import { OrderStatus } from '../../../core/supabase/database.types';

interface CustomerOrder {
    id: string;
    order_number: string;
    status: OrderStatus;
    total: number;
    created_at: string;
    commerce_name: string;
    commerce_logo?: string | null;
    item_count: number;
}

const STATUS_LABELS: Record<string, string> = {
    recibido: 'Received',
    confirmado: 'Confirmed',
    en_preparacion: 'Preparing',
    en_camino: 'On the way',
    entregado: 'Delivered',
    cancelado: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
    recibido: 'bg-yellow-50 text-yellow-700',
    confirmado: 'bg-blue-50 text-blue-700',
    en_preparacion: 'bg-orange-50 text-orange-700',
    en_camino: 'bg-purple-50 text-purple-700',
    entregado: 'bg-green-50 text-green-700',
    cancelado: 'bg-gray-100 text-gray-500',
};

@Component({
    selector: 'app-customer-orders-page',
    standalone: true,
    imports: [CommonModule, RouterLink],
    template: `
    <div class="max-w-lg mx-auto px-4 pt-6 pb-24">
      <h1 class="text-xl font-bold text-gray-900 mb-5">My Orders</h1>

      @if (loading()) {
        <div class="space-y-3">
          @for (i of [1,2,3]; track i) {
            <div class="bg-white rounded-2xl p-4 shadow-sm animate-pulse">
              <div class="flex gap-3">
                <div class="w-12 h-12 rounded-xl bg-gray-200"></div>
                <div class="flex-1 space-y-2">
                  <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div class="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          }
        </div>
      } @else if (orders().length === 0) {
        <div class="text-center py-16 text-gray-400">
          <div class="text-5xl mb-4">🛍️</div>
          <p class="font-semibold text-gray-600 mb-1">No orders yet</p>
          <p class="text-sm">Your orders will appear here once you place one.</p>
          <a routerLink="/customer/catalog"
            class="mt-5 inline-block px-6 py-2.5 bg-pink-500 hover:bg-pink-600 text-white font-semibold rounded-xl transition-colors text-sm">
            Browse catalog
          </a>
        </div>
      } @else {
        <div class="space-y-3">
          @for (order of orders(); track order.id) {
            <div class="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
              <div class="p-4">
                <div class="flex items-center gap-3">
                  <!-- Commerce logo -->
                  <div class="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    @if (order.commerce_logo) {
                      <img [src]="order.commerce_logo" class="w-full h-full object-cover" />
                    } @else {
                      <span class="text-xl">🏪</span>
                    }
                  </div>
                  <!-- Info -->
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-gray-900 truncate">{{ order.commerce_name }}</p>
                    <p class="text-xs text-gray-400 mt-0.5">
                      Order #{{ order.order_number }} · {{ order.item_count }} item{{ order.item_count !== 1 ? 's' : '' }}
                    </p>
                  </div>
                  <!-- Total -->
                  <div class="text-right flex-shrink-0">
                    <p class="text-sm font-bold text-gray-900">RD$ {{ order.total | number:'1.0-0' }}</p>
                    <p class="text-xs text-gray-400 mt-0.5">{{ order.created_at | date:'MMM d, y' }}</p>
                  </div>
                </div>
                <!-- Status bar -->
                <div class="mt-3 flex items-center justify-between">
                  <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                    [class]="statusColor(order.status)">
                    {{ statusLabel(order.status) }}
                  </span>
                  @if (isActive(order.status)) {
                    <span class="text-xs text-pink-500 font-medium flex items-center gap-1">
                      <span class="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse"></span>
                      In progress
                    </span>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class CustomerOrdersPageComponent implements OnInit {
    private readonly auth = inject(AuthService);
    private readonly supabase = getSupabaseClient();

    readonly orders = signal<CustomerOrder[]>([]);
    readonly loading = signal(true);

    ngOnInit(): void {
        this.loadOrders();
    }

    private async loadOrders(): Promise<void> {
        const userId = this.auth.currentUser()?.id;
        if (!userId) return;

        const { data, error } = await this.supabase
            .from('orders_full')
            .select('id, order_number, status, total, created_at, commerce_name, commerce_logo, commerce_id')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error || !data) {
            this.loading.set(false);
            return;
        }

        // Get item counts per order
        const orderIds = data.map((o: any) => o.id);
        let countMap: Record<string, number> = {};
        if (orderIds.length > 0) {
            const { data: items } = await this.supabase
                .from('order_items')
                .select('order_id, quantity')
                .in('order_id', orderIds);
            for (const item of items ?? []) {
                countMap[item.order_id] = (countMap[item.order_id] ?? 0) + (item.quantity ?? 1);
            }
        }

        this.orders.set(data.map((o: any) => ({
            id: o.id,
            order_number: o.order_number,
            status: o.status,
            total: o.total,
            created_at: o.created_at,
            commerce_name: o.commerce_name ?? 'Store',
            commerce_logo: o.commerce_logo,
            item_count: countMap[o.id] ?? 0,
        })));
        this.loading.set(false);
    }

    statusLabel(status: string): string {
        return STATUS_LABELS[status] ?? status;
    }

    statusColor(status: string): string {
        return STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600';
    }

    isActive(status: string): boolean {
        return ['recibido', 'confirmado', 'en_preparacion', 'en_camino'].includes(status);
    }
}
