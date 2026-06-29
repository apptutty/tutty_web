import {
  Component, OnDestroy, OnInit, computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OrdersService } from './orders.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { OrderFilters, OrderStatus } from '../../core/supabase/database.types';
import { AdminEmptyStateComponent } from '../../shared/ui/admin-empty-state/admin-empty-state.component';

type StatusTab = 'todos' | 'activos' | OrderStatus;
type AlertFilter = 'delayed' | 'unassigned' | '';

@Component({
  selector: 'app-orders-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, AdminEmptyStateComponent],
  template: `
    <app-page-header
      eyebrow="Operations · Real-time Orders"
      title="Pedidos"
      subtitle="Gestiona pedidos en tiempo real, estados operativos, repartidores, restaurantes, tiempos de entrega y cancelaciones desde un centro de control premium."
    >
      @if (newOrderAlert()) {
        <div class="inline-flex items-center gap-2 rounded-full border border-[#ffd8a8] bg-[#fff6e6] px-3 py-1 text-xs font-bold text-[#b54708] animate-pulse">
          📦 {{ newOrderAlert() }}
        </div>
      }
      <button class="btn-secondary text-sm" (click)="exportCsv()">Exportar CSV</button>
      <button class="h-10 rounded-xl border border-[#ffd8a8] bg-[#fff6e6] px-4 text-sm font-bold text-[#b54708]" (click)="toggleIncidentMode()">
        Ver incidencias
      </button>
      <button class="btn-primary text-sm" (click)="loadOrders()" [disabled]="loading()">
        {{ loading() ? 'Actualizando…' : 'Actualizar' }}
      </button>
    </app-page-header>

    <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
      <article class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4 flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-[#eef4ff] text-[#2451c7] grid place-items-center text-lg">📦</div>
        <div>
          <p class="text-xs font-extrabold text-[#7b8496]">Resultados totales</p>
          <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ totalCount() }}</p>
          <p class="text-xs text-[#98a2b3]">pedidos filtrados</p>
        </div>
      </article>
      <article class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4 flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-[#fff6e6] text-[#e46300] grid place-items-center text-lg">🔥</div>
        <div>
          <p class="text-xs font-extrabold text-[#7b8496]">Activos</p>
          <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ activeOnPage() }}</p>
          <p class="text-xs text-[#98a2b3]">requieren seguimiento</p>
        </div>
      </article>
      <article class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4 flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-[#eafbf1] text-[#087b3c] grid place-items-center text-lg">✅</div>
        <div>
          <p class="text-xs font-extrabold text-[#7b8496]">Entregados</p>
          <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ deliveredOnPage() }}</p>
          <p class="text-xs text-[#98a2b3]">página actual</p>
        </div>
      </article>
      <article class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4 flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-[#fee2e2] text-[#b42318] grid place-items-center text-lg">⛔</div>
        <div>
          <p class="text-xs font-extrabold text-[#7b8496]">Cancelados</p>
          <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ cancelledOnPage() }}</p>
          <p class="text-xs text-[#98a2b3]">página actual</p>
        </div>
      </article>
    </section>

    <section class="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)_340px] gap-4">
      <aside class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] overflow-hidden self-start">
        <div class="px-5 py-5 border-b border-[#eef1f6]">
          <h3 class="text-[32px] leading-none mb-2 text-[#111827]">Cola de pedidos</h3>
          <p class="text-sm text-[#667085]">Filtra por etapa, prioridad y estado de entrega.</p>
        </div>
        <div class="p-3 space-y-4">
          <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition-colors"
            [class]="activeTab() === 'todos' ? 'bg-[#111827] text-white shadow-[0_8px_16px_rgba(17,24,39,.25)]' : 'text-[#344054] hover:bg-[#f8fafc]'"
            (click)="setTab('todos')">
            <span>📦 Todos</span><span class="text-xs opacity-80">{{ totalCount() }}</span>
          </button>
          <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors"
            [class]="activeTab() === 'recibido' ? 'bg-[#eef4ff] text-[#2451c7]' : 'text-[#475467] hover:bg-[#f8fafc]'"
            (click)="setTab('recibido')">
            <span>🆕 Recibidos</span><span class="text-xs">{{ statusOnPage('recibido') }}</span>
          </button>
          <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors"
            [class]="activeTab() === 'confirmado' ? 'bg-[#eafbf1] text-[#087b3c]' : 'text-[#475467] hover:bg-[#f8fafc]'"
            (click)="setTab('confirmado')">
            <span>✅ Confirmados</span><span class="text-xs">{{ statusOnPage('confirmado') }}</span>
          </button>
          <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors"
            [class]="activeTab() === 'en_preparacion' ? 'bg-[#fff6e6] text-[#b54708]' : 'text-[#475467] hover:bg-[#f8fafc]'"
            (click)="setTab('en_preparacion')">
            <span>🍳 En preparación</span><span class="text-xs">{{ statusOnPage('en_preparacion') }}</span>
          </button>
          <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors"
            [class]="activeTab() === 'en_camino' ? 'bg-[#eef4ff] text-[#2451c7]' : 'text-[#475467] hover:bg-[#f8fafc]'"
            (click)="setTab('en_camino')">
            <span>🛵 En camino</span><span class="text-xs">{{ statusOnPage('en_camino') }}</span>
          </button>
          <p class="px-2 text-xs font-black uppercase tracking-[0.08em] text-[#98a2b3]">Alertas</p>
          <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors"
            [class]="alertFilter === 'delayed' ? 'bg-[#fff6e6] text-[#b54708]' : 'text-[#475467] hover:bg-[#f8fafc]'"
            (click)="setAlertFilter('delayed')">
            <span>⏱ Demorados</span><span class="text-xs">{{ delayedCount() }}</span>
          </button>
          <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors"
            [class]="alertFilter === 'unassigned' ? 'bg-[#fee2e2] text-[#b42318]' : 'text-[#475467] hover:bg-[#f8fafc]'"
            (click)="setAlertFilter('unassigned')">
            <span>⚠ Sin repartidor</span><span class="text-xs">{{ unassignedCount() }}</span>
          </button>
          <p class="px-2 text-xs font-black uppercase tracking-[0.08em] text-[#98a2b3]">Cierre</p>
          <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors"
            [class]="activeTab() === 'entregado' ? 'bg-[#eafbf1] text-[#087b3c]' : 'text-[#475467] hover:bg-[#f8fafc]'"
            (click)="setTab('entregado')">
            <span>✅ Entregados</span><span class="text-xs">{{ deliveredOnPage() }}</span>
          </button>
          <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors"
            [class]="activeTab() === 'cancelado' ? 'bg-[#fee2e2] text-[#b42318]' : 'text-[#475467] hover:bg-[#f8fafc]'"
            (click)="setTab('cancelado')">
            <span>⛔ Cancelados</span><span class="text-xs">{{ cancelledOnPage() }}</span>
          </button>
        </div>
      </aside>

      <div class="min-w-0 space-y-4">
        <div class="rounded-3xl border border-[#e7eaf1] bg-white p-2 shadow-[0_8px_24px_rgba(18,24,40,.07)] overflow-x-auto">
          <div class="inline-flex gap-1 min-w-max">
            @for (tab of statusTabs; track tab.key) {
              <button
                class="px-4 py-2 rounded-xl text-sm font-bold transition-colors whitespace-nowrap"
                [class]="activeTab() === tab.key ? 'bg-[#111827] text-white shadow-[0_8px_16px_rgba(17,24,39,.25)]' : 'text-[#667085] hover:text-[#344054]'"
                (click)="setTab(tab.key)"
              >{{ tab.label }}</button>
            }
          </div>
        </div>

        <section class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4">
          <div class="grid grid-cols-1 xl:grid-cols-[minmax(260px,1fr)_190px_260px_260px] gap-2 mb-3">
            <label class="h-12 rounded-2xl border border-[#e7eaf1] bg-[#fbfcff] px-3 inline-flex items-center gap-2 min-w-0">
              <span class="text-[#667085]">⌕</span>
              <input type="search" class="bg-transparent border-0 outline-0 w-full min-w-0 text-sm" placeholder="Buscar por # pedido, restaurante, cliente..." [(ngModel)]="searchText" (ngModelChange)="onSearchChange()" aria-label="Buscar pedidos" />
            </label>
            <select class="input-field !h-12 !rounded-2xl" [(ngModel)]="dateRange" (ngModelChange)="applyDateFilter()">
              <option value="today">Hoy</option>
              <option value="yesterday">Ayer</option>
              <option value="week">Esta semana</option>
              <option value="month">Este mes</option>
            </select>
            <select class="input-field !h-12 !rounded-2xl" [(ngModel)]="selectedRestaurant">
              <option value="">Todos los restaurantes</option>
              @for (name of restaurantOptions(); track name) { <option [value]="name">{{ name }}</option> }
            </select>
            <select class="input-field !h-12 !rounded-2xl" [(ngModel)]="selectedCourier">
              <option value="">Todos los repartidores</option>
              @for (name of courierOptions(); track name) { <option [value]="name">{{ name }}</option> }
            </select>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="h-9 rounded-full border px-3 text-sm font-bold transition-colors" [class]="!alertFilter && !incidentMode ? 'bg-[#111827] border-[#111827] text-white' : 'border-[#e7eaf1] text-[#475467]'" (click)="clearLocalFilters()">Todos {{ totalCount() }}</button>
            <button type="button" class="h-9 rounded-full border px-3 text-sm font-bold transition-colors" [class]="activeTab() === 'recibido' ? 'bg-[#fff6e6] border-[#ffd8a8] text-[#b54708]' : 'border-[#e7eaf1] text-[#475467]'" (click)="setTab('recibido')">Recibidos {{ statusOnPage('recibido') }}</button>
            <button type="button" class="h-9 rounded-full border px-3 text-sm font-bold transition-colors" [class]="activeTab() === 'en_preparacion' ? 'bg-[#fff6e6] border-[#ffd8a8] text-[#b54708]' : 'border-[#e7eaf1] text-[#475467]'" (click)="setTab('en_preparacion')">En preparación {{ statusOnPage('en_preparacion') }}</button>
            <button type="button" class="h-9 rounded-full border px-3 text-sm font-bold transition-colors" [class]="activeTab() === 'en_camino' ? 'bg-[#eef4ff] border-[#d7e3ff] text-[#2451c7]' : 'border-[#e7eaf1] text-[#475467]'" (click)="setTab('en_camino')">En camino {{ statusOnPage('en_camino') }}</button>
            <button type="button" class="h-9 rounded-full border px-3 text-sm font-bold transition-colors" [class]="activeTab() === 'entregado' ? 'bg-[#eafbf1] border-[#b7efcc] text-[#087b3c]' : 'border-[#e7eaf1] text-[#475467]'" (click)="setTab('entregado')">Entregados {{ deliveredOnPage() }}</button>
            <button type="button" class="h-9 rounded-full border px-3 text-sm font-bold transition-colors" [class]="activeTab() === 'cancelado' ? 'bg-[#fee2e2] border-[#fecaca] text-[#b42318]' : 'border-[#e7eaf1] text-[#475467]'" (click)="setTab('cancelado')">Cancelados {{ cancelledOnPage() }}</button>
          </div>
        </section>

        <div class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] overflow-hidden">
          <div class="px-5 py-4 border-b border-[#eef1f6]">
            <h3 class="text-base font-black text-[#111827]">Pedidos en tiempo real</h3>
            <p class="text-sm font-semibold text-[#98a2b3]">{{ visibleOrders().length }} registros encontrados</p>
          </div>
          @if (loadError()) {
            <div class="p-6">
              <div class="rounded-2xl border border-[#fee2e2] bg-[#fff7f7] p-4 text-center">
                <p class="text-sm font-black text-[#b42318]">No se pudieron cargar los pedidos</p>
                <p class="text-xs text-[#98a2b3] mt-1">Intenta refrescar la página o vuelve a intentarlo más tarde.</p>
                <button class="h-9 mt-3 px-4 rounded-xl border border-[#e7eaf1] bg-white text-sm font-bold text-[#344054]" (click)="loadOrders()">Reintentar</button>
              </div>
            </div>
          } @else if (!loading() && visibleOrders().length === 0) {
            <div class="p-6">
              <app-admin-empty-state
                icon="orders"
                title="No hay pedidos para estos filtros"
                description="Prueba ajustando la búsqueda, estado, restaurante, repartidor o rango de fecha."
                variant="soft"
              />
            </div>
          } @else {
            <div class="overflow-x-auto">
              <table class="min-w-[980px] w-full divide-y divide-gray-200 text-sm">
                <thead class="bg-[#f8fafc]">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Restaurante</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Delivery</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Repartidor</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Hora</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Acción</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-100">
                  @if (loading()) {
                    @for (i of [1,2,3,4,5]; track i) {
                      <tr class="animate-pulse">
                        @for (j of [1,2,3,4,5,6,7,8,9]; track j) { <td class="px-4 py-3"><div class="h-4 bg-gray-200 rounded w-3/4"></div></td> }
                      </tr>
                    }
                  } @else {
                    @for (order of visibleOrders(); track order.id) {
                      <tr class="cursor-pointer hover:bg-[#fcfcfd] transition-colors" [class.bg-[#f8fafc]]="selectedOrder()?.id === order.id" (click)="selectOrder(order)">
                        <td class="px-4 py-3">
                          <p class="font-black text-[#111827]">{{ order.order_number_display }}</p>
                          <p class="text-xs text-[#98a2b3]">{{ order.created_at | date:'h:mm a' }}</p>
                        </td>
                        <td class="px-4 py-3 text-[#344054] font-semibold">{{ order.restaurant_name }}</td>
                        <td class="px-4 py-3 text-[#344054]">{{ order.customer_name }}</td>
                        <td class="px-4 py-3 font-black text-[#111827]">{{ money(order.total) }}</td>
                        <td class="px-4 py-3"><span class="inline-flex items-center rounded-full bg-[#f2f4f7] px-2.5 py-1 text-xs font-bold text-[#667085]">{{ order.delivery_fee > 0 ? 'Delivery' : 'Pickup' }}</span></td>
                        <td class="px-4 py-3"><span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold" [class]="statusPillClass(order.status)">{{ statusLabel(order.status) }}</span></td>
                        <td class="px-4 py-3 text-[#344054]">{{ order.repartidor_name || 'Sin asignar' }}</td>
                        <td class="px-4 py-3 text-xs text-[#98a2b3]">{{ order.created_at | date:'dd/MM HH:mm' }}</td>
                        <td class="px-4 py-3 text-right">
                          <button class="btn-secondary px-2 py-1 text-xs" (click)="openOrder($event, order)">Ver</button>
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
            @if (totalCount() > pageSize) {
              <div class="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                <p class="text-xs text-gray-400">{{ (currentPage() - 1) * pageSize + 1 }}–{{ Math.min(currentPage() * pageSize, totalCount()) }} de {{ totalCount() }}</p>
                <div class="flex gap-2">
                  <button class="btn-secondary text-xs px-3 py-1" [disabled]="currentPage() === 1" (click)="onPageChange(currentPage() - 1)">←</button>
                  <button class="btn-secondary text-xs px-3 py-1" [disabled]="currentPage() * pageSize >= totalCount()" (click)="onPageChange(currentPage() + 1)">→</button>
                </div>
              </div>
            }
          }
        </div>
      </div>

      <aside class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] overflow-hidden self-start">
        <div class="px-5 py-5 border-b border-[#eef1f6]">
          <h3 class="text-[32px] leading-none mb-2 text-[#111827]">Detalle rápido</h3>
          <p class="text-sm text-[#667085]">Selecciona un pedido para ver acciones y trazabilidad.</p>
        </div>
        <div class="p-5">
          @if (selectedOrder()) {
            <h4 class="text-[32px] leading-[1.04] tracking-[-0.04em] font-black text-[#111827]">{{ selectedOrder()!.order_number_display }}</h4>
            <span class="mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold" [class]="statusPillClass(selectedOrder()!.status)">{{ statusLabel(selectedOrder()!.status) }}</span>
            <div class="mt-4 grid grid-cols-2 gap-2">
              <button class="h-11 rounded-2xl border border-[#d0d5dd] bg-white text-sm font-bold text-[#344054]" (click)="goToDetail(selectedOrder()!)">Asignar</button>
              <button class="h-11 rounded-2xl bg-[#eb1b8d] text-white text-sm font-black" (click)="goToDetail(selectedOrder()!)">Actualizar</button>
            </div>
            <dl class="mt-4 divide-y divide-[#eef1f6] text-sm">
              <div class="py-2.5 flex items-center justify-between gap-3"><dt class="text-[#667085]">Restaurante</dt><dd class="font-bold text-[#101828]">{{ selectedOrder()!.restaurant_name || '—' }}</dd></div>
              <div class="py-2.5 flex items-center justify-between gap-3"><dt class="text-[#667085]">Cliente</dt><dd class="font-bold text-[#101828]">{{ selectedOrder()!.customer_name || '—' }}</dd></div>
              <div class="py-2.5 flex items-center justify-between gap-3"><dt class="text-[#667085]">Total</dt><dd class="font-black text-[#101828]">{{ money(selectedOrder()!.total) }}</dd></div>
              <div class="py-2.5 flex items-center justify-between gap-3"><dt class="text-[#667085]">Repartidor</dt><dd class="font-bold text-[#101828]">{{ selectedOrder()!.repartidor_name || 'Sin asignar' }}</dd></div>
            </dl>
            <div class="mt-4 space-y-3">
              @for (step of timelineSteps(selectedOrder()!.status); track step.label) {
                <div class="flex gap-2.5 text-sm">
                  <span class="mt-1 h-3.5 w-3.5 rounded-full" [class]="step.done ? 'bg-[#eb1b8d]' : 'bg-[#d0d5dd]'"></span>
                  <div>
                    <p class="font-semibold text-[#111827]">{{ step.label }}</p>
                    <p class="text-xs text-[#98a2b3]">{{ step.time }}</p>
                  </div>
                </div>
              }
            </div>
          } @else {
            <app-admin-empty-state
              icon="orders"
              title="Selecciona un pedido"
              description="Haz click en una fila para ver detalle rápido, acciones y timeline."
              variant="soft"
            />
          }
        </div>
      </aside>
    </section>
  `,
})
export class OrdersPageComponent implements OnInit, OnDestroy {
  private readonly ordersService = inject(OrdersService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  readonly orders = signal<any[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly currentPage = signal(1);
  readonly activeTab = signal<StatusTab>('todos');
  readonly newOrderAlert = signal<string | null>(null);
  readonly selectedOrder = signal<any | null>(null);

  searchText = '';
  dateRange = 'today';
  selectedRestaurant = '';
  selectedCourier = '';
  alertFilter: AlertFilter = '';
  incidentMode = false;
  readonly pageSize = 20;
  readonly Math = Math;

  private searchTimeout: any;
  private realtimeChannel: any;

  readonly statusTabs = [
    { key: 'todos' as StatusTab, label: 'Todos' },
    { key: 'activos' as StatusTab, label: 'Activos' },
    { key: 'recibido' as StatusTab, label: 'Recibido' },
    { key: 'confirmado' as StatusTab, label: 'Confirmado' },
    { key: 'en_preparacion' as StatusTab, label: 'En preparación' },
    { key: 'en_camino' as StatusTab, label: 'En camino' },
    { key: 'entregado' as StatusTab, label: 'Entregado' },
    { key: 'cancelado' as StatusTab, label: 'Cancelado' },
  ];

  readonly activeOnPage = computed(() =>
    this.orders().filter((o) => ['recibido', 'confirmado', 'en_preparacion', 'en_camino'].includes(o.status)).length
  );
  readonly deliveredOnPage = computed(() => this.orders().filter((o) => o.status === 'entregado').length);
  readonly cancelledOnPage = computed(() => this.orders().filter((o) => o.status === 'cancelado').length);
  readonly delayedCount = computed(() =>
    this.orders().filter((o) => this.isDelayed(o) && !['entregado', 'cancelado'].includes(o.status)).length
  );
  readonly unassignedCount = computed(() =>
    this.orders().filter((o) => !o.repartidor_name && !['entregado', 'cancelado'].includes(o.status)).length
  );
  readonly restaurantOptions = computed(() =>
    [...new Set(this.orders().map((o) => o.restaurant_name).filter(Boolean))].sort()
  );
  readonly courierOptions = computed(() =>
    [...new Set(this.orders().map((o) => o.repartidor_name).filter(Boolean))].sort()
  );
  readonly visibleOrders = computed(() => {
    let list = this.orders();
    if (this.selectedRestaurant) list = list.filter((o) => o.restaurant_name === this.selectedRestaurant);
    if (this.selectedCourier) list = list.filter((o) => (o.repartidor_name || '') === this.selectedCourier);
    if (this.alertFilter === 'delayed') list = list.filter((o) => this.isDelayed(o));
    if (this.alertFilter === 'unassigned') list = list.filter((o) => !o.repartidor_name);
    if (this.incidentMode) list = list.filter((o) => this.isDelayed(o) || !o.repartidor_name || o.status === 'cancelado');
    return list;
  });

  statusOnPage(status: OrderStatus): number {
    return this.orders().filter((o) => o.status === status).length;
  }

  ngOnInit(): void {
    this.loadOrders();
    this.subscribeRealtime();
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimeout);
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe();
    }
  }

  private getFilters(): OrderFilters {
    const { dateFrom, dateTo } = this.getDateRange();
    return {
      status: this.activeTab() === 'todos' ? null : this.activeTab() as any,
      date_from: dateFrom,
      date_to: dateTo,
      search: this.searchText || null,
      page: this.currentPage(),
      pageSize: this.pageSize,
    };
  }

  private getDateRange(): { dateFrom: string; dateTo: string } {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    if (this.dateRange === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const d = y.toISOString().split('T')[0];
      return { dateFrom: d, dateTo: d };
    }
    if (this.dateRange === 'week') {
      const w = new Date(now);
      w.setDate(w.getDate() - 6);
      return { dateFrom: w.toISOString().split('T')[0], dateTo: today };
    }
    if (this.dateRange === 'month') {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: m.toISOString().split('T')[0], dateTo: today };
    }
    return { dateFrom: today, dateTo: today };
  }

  loadOrders(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.ordersService.getOrders(this.getFilters()).subscribe({
      next: ({ data, count }) => {
        const mapped = data.map((o) => ({ ...o, order_number_display: o.order_number ?? o.id.slice(0, 8).toUpperCase() }));
        this.orders.set(mapped);
        this.totalCount.set(count);

        const current = this.selectedOrder();
        if (!current && mapped.length > 0) this.selectedOrder.set(mapped[0]);
        if (current) {
          const updated = mapped.find((o: any) => o.id === current.id);
          if (updated) this.selectedOrder.set(updated);
        }

        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('No se pudieron cargar los pedidos con los filtros actuales.');
        this.toastService.error('Error al cargar pedidos');
        this.loading.set(false);
      },
    });
  }

  setTab(tab: StatusTab): void {
    this.activeTab.set(tab);
    this.alertFilter = '';
    this.currentPage.set(1);
    this.loadOrders();
  }

  onSearchChange(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage.set(1);
      this.loadOrders();
    }, 300);
  }

  applyDateFilter(): void {
    this.currentPage.set(1);
    this.loadOrders();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadOrders();
  }

  goToDetail(order: any): void {
    this.router.navigate(['/orders', order.id]);
  }

  openOrder(event: Event, order: any): void {
    event.stopPropagation();
    this.goToDetail(order);
  }

  selectOrder(order: any): void {
    this.selectedOrder.set(order);
  }

  clearLocalFilters(): void {
    this.alertFilter = '';
    this.incidentMode = false;
    this.selectedRestaurant = '';
    this.selectedCourier = '';
  }

  setAlertFilter(filter: AlertFilter): void {
    this.alertFilter = this.alertFilter === filter ? '' : filter;
  }

  toggleIncidentMode(): void {
    this.incidentMode = !this.incidentMode;
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      recibido: 'Recibido',
      confirmado: 'Confirmado',
      en_preparacion: 'En preparación',
      en_camino: 'En camino',
      entregado: 'Entregado',
      cancelado: 'Cancelado',
    };
    return map[status] ?? status;
  }

  statusPillClass(status: string): string {
    if (status === 'entregado') return 'bg-[#eafbf1] text-[#087b3c]';
    if (status === 'cancelado') return 'bg-[#fee2e2] text-[#b42318]';
    if (status === 'en_preparacion') return 'bg-[#fff6e6] text-[#b54708]';
    if (status === 'en_camino') return 'bg-[#eef4ff] text-[#2451c7]';
    if (status === 'confirmado') return 'bg-[#eafbf1] text-[#087b3c]';
    return 'bg-[#f2f4f7] text-[#475467]';
  }

  money(value: number): string {
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(value ?? 0);
  }

  timelineSteps(status: string): Array<{ label: string; done: boolean; time: string }> {
    const order = this.selectedOrder();
    const states: OrderStatus[] = ['recibido', 'confirmado', 'en_preparacion', 'en_camino', 'entregado'];
    const idx = states.indexOf(status as OrderStatus);
    return states.map((s, i) => ({
      label: this.statusLabel(s),
      done: idx >= i,
      time: order?.created_at ? new Date(order.created_at).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' }) : '—',
    }));
  }

  exportCsv(): void {
    const rows = this.visibleOrders();
    const header = ['order_number', 'restaurant', 'customer', 'total', 'status', 'courier', 'created_at'];
    const csv = [
      header.join(','),
      ...rows.map((o) => [
        this.escapeCsv(o.order_number_display ?? ''),
        this.escapeCsv(o.restaurant_name ?? ''),
        this.escapeCsv(o.customer_name ?? ''),
        String(o.total ?? 0),
        this.escapeCsv(this.statusLabel(o.status)),
        this.escapeCsv(o.repartidor_name ?? ''),
        this.escapeCsv(o.created_at ?? ''),
      ].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pedidos.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  private escapeCsv(value: string): string {
    return `"${String(value).replaceAll('"', '""')}"`;
  }

  private isDelayed(order: any): boolean {
    if (!order?.created_at) return false;
    const created = new Date(order.created_at).getTime();
    return (Date.now() - created) > 25 * 60 * 1000;
  }

  private subscribeRealtime(): void {
    this.realtimeChannel = this.ordersService.subscribeToOrders((payload) => {
      if (payload.eventType === 'INSERT') {
        const num = payload.new?.order_number ?? '';
        this.newOrderAlert.set(`Nuevo pedido ${num}`);
        setTimeout(() => this.newOrderAlert.set(null), 5000);
        this.toastService.info(`📦 Nuevo pedido ${num}`);
        this.loadOrders();
      } else if (payload.eventType === 'UPDATE') {
        this.loadOrders();
      }
    });
  }
}
