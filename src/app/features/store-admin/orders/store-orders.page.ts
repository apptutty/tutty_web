import {
    Component, OnInit, OnDestroy, inject, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { StoreOrdersService, StoreOrder } from './store-orders.service';
import { StoreAdminService } from '../store-admin.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { OrderStatus } from '../../../core/supabase/database.types';
import { ScheduleWarningCardComponent } from '../shared/schedule-warning-card.component';

type ViewTab = 'kanban' | 'lista' | 'mapa';
type OrdersChip = 'all' | 'new' | 'preparing' | 'route' | 'today';

const STATUS_LABELS: Record<OrderStatus, string> = {
    recibido: 'Nuevo',
    confirmado: 'Confirmado',
    en_preparacion: 'Preparando',
    en_camino: 'En camino',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
};

const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
    recibido: 'admin-badge admin-badge--new',
    confirmado: 'admin-badge admin-badge--preparing',
    en_preparacion: 'admin-badge admin-badge--preparing',
    en_camino: 'admin-badge admin-badge--route',
    entregado: 'admin-badge admin-badge--delivered',
    cancelado: 'admin-badge admin-badge--cancelled',
};

interface KanbanColumn {
    id: 'new' | 'preparing' | 'route' | 'delivered';
    title: string;
    statuses: OrderStatus[];
    toneClass: string;
    dotClass: string;
    emptyTitle: string;
    emptyText: string;
}

const KANBAN_COLUMNS: KanbanColumn[] = [
    {
        id: 'new',
        title: 'Nuevos',
        statuses: ['recibido'],
        toneClass: 'kanban-column--new',
        dotClass: 'kanban-dot--new',
        emptyTitle: 'No hay pedidos nuevos',
        emptyText: 'Los pedidos entrantes aparecerán aquí.',
    },
    {
        id: 'preparing',
        title: 'Preparando',
        statuses: ['confirmado', 'en_preparacion'],
        toneClass: 'kanban-column--preparing',
        dotClass: 'kanban-dot--preparing',
        emptyTitle: 'No hay pedidos en preparación',
        emptyText: 'Cuando aceptes un pedido, pasará a esta columna.',
    },
    {
        id: 'route',
        title: 'Listo / En camino',
        statuses: ['en_camino'],
        toneClass: 'kanban-column--route',
        dotClass: 'kanban-dot--route',
        emptyTitle: 'No hay pedidos en camino',
        emptyText: 'Los pedidos listos o en entrega aparecerán aquí.',
    },
    {
        id: 'delivered',
        title: 'Entregados',
        statuses: ['entregado'],
        toneClass: 'kanban-column--delivered',
        dotClass: 'kanban-dot--delivered',
        emptyTitle: 'No hay pedidos entregados hoy',
        emptyText: 'Los pedidos completados aparecerán aquí.',
    },
];

@Component({
    selector: 'app-store-orders',
    standalone: true,
    imports: [CommonModule, FormsModule, ScheduleWarningCardComponent],
    template: `
    <div class="orders-page">
      <section class="orders-page-header">
        <div class="orders-header-top">
          <div class="orders-heading">
            <h1>Pedidos</h1>
            <p>Gestiona pedidos activos, preparación y entregas de {{ storeName() }}.</p>
          </div>
          <div class="orders-view-switch">
            @for (tab of tabs; track tab.id) {
              <button
                class="orders-view-btn"
                [class.orders-view-btn--active]="activeView() === tab.id"
                (click)="setView(tab.id)"
                [attr.aria-label]="'Vista ' + tab.label"
              >
                {{ tab.label }}
              </button>
            }
          </div>
        </div>

        <div class="orders-toolbar">
          <div class="orders-search">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.804 7.5 7.5 0 0 0 15.803 15.803Z" />
            </svg>
            <input
              [(ngModel)]="kanbanSearch"
              placeholder="Buscar por orden, cliente o producto..."
              aria-label="Buscar por orden, cliente o producto"
            />
          </div>
          <div class="orders-filter-chips">
            <button class="orders-chip" [class.orders-chip--active]="activeChip() === 'all'" (click)="activeChip.set('all')">
              Todos <span class="chip-count">{{ filteredCount('all') }}</span>
            </button>
            <button class="orders-chip" [class.orders-chip--active]="activeChip() === 'new'" (click)="activeChip.set('new')">
              Nuevos <span class="chip-count">{{ filteredCount('new') }}</span>
            </button>
            <button class="orders-chip" [class.orders-chip--active]="activeChip() === 'preparing'" (click)="activeChip.set('preparing')">
              Preparando <span class="chip-count">{{ filteredCount('preparing') }}</span>
            </button>
            <button class="orders-chip" [class.orders-chip--active]="activeChip() === 'route'" (click)="activeChip.set('route')">
              En camino <span class="chip-count">{{ filteredCount('route') }}</span>
            </button>
            <button class="orders-chip" [class.orders-chip--active]="activeChip() === 'today'" (click)="activeChip.set('today')">
              Hoy
            </button>
          </div>
        </div>
      </section>

      @if (showOutsideScheduleAlert() && !warningDismissed()) {
        <app-schedule-warning-card
          [scheduleWindow]="scheduleWindow()"
          (editSchedule)="goToSettings()"
          (close)="warningDismissed.set(true)" />
      }

      @if (isLoading()) {
        <div class="orders-loading">
          @for (i of [1,2,3,4]; track i) {
            <div class="orders-skeleton"></div>
          }
        </div>
      } @else {
        @if (activeView() === 'kanban') {
          <div class="orders-layout">
            <div class="kanban-wrapper">
              <div class="kanban-board">
                @for (col of kanbanColumns; track col.id) {
                  <section class="kanban-column" [class]="col.toneClass">
                    <header class="kanban-column__header">
                      <div class="kanban-column__title">
                        <span class="kanban-dot" [class]="col.dotClass"></span>
                        <span>{{ col.title }}</span>
                      </div>
                      <span class="kanban-column__count">{{ ordersForColumn(col.statuses).length }}</span>
                    </header>
                    <div class="kanban-column__body">
                      @if (ordersForColumn(col.statuses).length === 0) {
                        <div class="kanban-empty">
                          <svg class="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                          </svg>
                          <h3>{{ col.emptyTitle }}</h3>
                          <p>{{ col.emptyText }}</p>
                        </div>
                      } @else {
                        @for (order of ordersForColumn(col.statuses); track order.id) {
                          <article class="order-card" (click)="selectOrder(order.id)">
                            <div class="order-card__top">
                              <p class="order-card__id">#{{ order.order_number }}</p>
                              <p class="order-card__time">{{ elapsedLabel(order.created_at) }}</p>
                            </div>
                            <p class="order-card__customer">{{ order.customer_name }}</p>
                            <div class="order-card__products">
                              <p>{{ order.items_preview }}</p>
                            </div>
                            <div class="order-card__total-row">
                              <span [class]="statusColor(order.status)">
                                {{ statusLabel(order.status) }}
                              </span>
                              <p class="order-card__total">RD$ {{ order.total | number:'1.0-0' }}</p>
                            </div>
                            <div class="order-card__actions">
                              <button class="order-btn-secondary" (click)="goToDetail(order.id); $event.stopPropagation()">Ver detalle</button>
                              @if (primaryActionLabel(order)) {
                                <button
                                  class="order-btn-primary"
                                  [disabled]="advancingId() === order.id"
                                  (click)="advanceOrder(order, $event)"
                                >
                                  @if (advancingId() === order.id) { Procesando… } @else { {{ primaryActionLabel(order)! }} }
                                </button>
                              }
                            </div>
                          </article>
                        }
                      }
                    </div>
                  </section>
                }
              </div>
            </div>

            <aside class="orders-side-panel">
              <section class="admin-card orders-summary-card">
                <h2 class="admin-card-title">Resumen de pedidos</h2>
                <div class="orders-summary-grid">
                  <div class="orders-summary-item"><span>Activos</span><strong>{{ summaryActive() }}</strong></div>
                  <div class="orders-summary-item"><span>En camino</span><strong>{{ summaryRoute() }}</strong></div>
                  <div class="orders-summary-item"><span>Entregados</span><strong>{{ summaryDelivered() }}</strong></div>
                  <div class="orders-summary-item"><span>Total activo</span><strong>RD$ {{ summaryTotalActive() }}</strong></div>
                </div>
              </section>

              <section class="admin-card orders-selected-card">
                <h2 class="admin-card-title">Pedido seleccionado</h2>
                @if (selectedOrder()) {
                  <span [class]="statusColor(selectedOrder()!.status)">
                    {{ statusLabel(selectedOrder()!.status) }}
                  </span>
                  <p class="selected-order-id">#{{ selectedOrder()!.order_number }}</p>
                  <p class="selected-order-customer">{{ selectedOrder()!.customer_name }}</p>
                  <div class="order-card__products mt-3">
                    <p>{{ selectedOrder()!.items_preview }}</p>
                  </div>
                  <p class="order-card__total mt-3">RD$ {{ selectedOrder()!.total | number:'1.0-0' }}</p>
                  <button class="order-btn-secondary w-full mt-3" (click)="goToDetail(selectedOrder()!.id)">Ver detalle</button>
                } @else {
                  <div class="kanban-empty">
                    <h3>Selecciona un pedido</h3>
                    <p>Verás aquí el detalle rápido del pedido.</p>
                  </div>
                }
              </section>
            </aside>
          </div>
        }

        @if (activeView() === 'lista') {
          <section class="admin-card list-card">
            <div class="list-toolbar">
              <input
                type="text"
                placeholder="Buscar por orden, cliente o producto..."
                class="input-field"
                [(ngModel)]="filterSearch"
                (ngModelChange)="onFilterChange()"
              />
              <select class="input-field" [(ngModel)]="filterStatus" (ngModelChange)="onFilterChange()">
                <option value="">Todos los estados</option>
                <option value="activos">Activos</option>
                <option value="recibido">Nuevos</option>
                <option value="confirmado">Confirmados</option>
                <option value="en_preparacion">En preparación</option>
                <option value="en_camino">En camino</option>
                <option value="entregado">Entregados</option>
                <option value="cancelado">Cancelados</option>
              </select>
              <input type="date" class="input-field" [(ngModel)]="filterDateFrom" (ngModelChange)="onFilterChange()" />
              <input type="date" class="input-field" [(ngModel)]="filterDateTo" (ngModelChange)="onFilterChange()" />
            </div>
            <div class="list-table-wrap">
              <table class="orders-list-table">
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Cliente</th>
                    <th>Estado</th>
                    <th>Productos</th>
                    <th>Tiempo</th>
                    <th>Total</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  @for (order of listOrders(); track order.id) {
                    <tr>
                      <td>#{{ order.order_number }}</td>
                      <td>{{ order.customer_name }}</td>
                      <td><span [class]="statusColor(order.status)">{{ statusLabel(order.status) }}</span></td>
                      <td class="truncate">{{ order.items_preview }}</td>
                      <td>{{ elapsedLabel(order.created_at) }}</td>
                      <td class="font-bold">RD$ {{ order.total | number:'1.0-0' }}</td>
                      <td><button class="order-btn-secondary" (click)="goToDetail(order.id)">Ver detalle</button></td>
                    </tr>
                  }
                </tbody>
              </table>
              @if (listOrders().length === 0) {
                <div class="kanban-empty my-6">
                  <h3>No hay pedidos para mostrar</h3>
                  <p>Intenta cambiar los filtros o espera nuevos pedidos.</p>
                </div>
              }
            </div>
            @if (totalPages() > 1) {
              <div class="border-t border-gray-100 pt-3 flex items-center justify-between text-sm text-gray-600">
                <span>Página {{ currentPage() }} de {{ totalPages() }}</span>
                <div class="flex gap-2">
                  <button class="order-btn-secondary" [disabled]="currentPage() === 1" (click)="prevPage()">Anterior</button>
                  <button class="order-btn-secondary" [disabled]="currentPage() === totalPages()" (click)="nextPage()">Siguiente</button>
                </div>
              </div>
            }
          </section>
        }

        @if (activeView() === 'mapa') {
          <section class="admin-card map-card">
            <h2 class="admin-card-title">Mapa de entregas</h2>
            <p class="map-subtitle">Visualiza pedidos activos y rutas de entrega.</p>
            <div class="kanban-empty map-empty">
              <h3>No hay entregas activas en el mapa</h3>
              <p>Los pedidos con dirección aparecerán aquí.</p>
            </div>
          </section>
        }
      }

      @if (rejectModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" (click)="closeRejectModal()">
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" (click)="$event.stopPropagation()">
            <h3 class="text-lg font-bold text-gray-900 mb-1">Rechazar pedido</h3>
            <p class="text-sm text-gray-500 mb-4">Pedido #{{ rejectModal()?.order_number }} — Indica el motivo para el cliente</p>
            <div class="space-y-2 mb-4">
              @for (reason of rejectReasons; track reason) {
                <button
                  class="w-full text-left text-sm px-4 py-2.5 rounded-lg border transition-all"
                  [class]="rejectReason() === reason ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium' : 'border-gray-200 hover:bg-gray-50'"
                  (click)="rejectReason.set(reason)"
                >
                  {{ reason }}
                </button>
              }
              <input
                type="text"
                placeholder="Otro motivo..."
                class="input-field text-sm"
                [(ngModel)]="customRejectReason"
              />
            </div>
            <div class="flex gap-3">
              <button class="btn-secondary flex-1" (click)="closeRejectModal()">Cancelar</button>
              <button
                class="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                [disabled]="!finalRejectReason() || rejectingId() !== null"
                (click)="confirmReject()"
              >
                @if (rejectingId() !== null) { Rechazando… } @else { Rechazar pedido }
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
    styles: [`
    :host { display: block; height: 100%; min-width: 0; }
    .orders-page {
      padding: 24px;
      display: grid;
      gap: 16px;
      min-width: 0;
      background: var(--admin-bg, #f6f7fb);
    }
    .orders-page-header {
      border: 1px solid #e7eaf1;
      background: linear-gradient(180deg, #fff, #fbfcff);
      border-radius: 26px;
      box-shadow: 0 8px 24px rgba(18, 24, 40, .07);
      padding: 22px;
      display: grid;
      gap: 14px;
    }
    .orders-header-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
    }
    .orders-heading h1 {
      margin: 0;
      font-size: 28px;
      line-height: 1.1;
      letter-spacing: -0.04em;
      color: #111827;
      font-weight: 800;
    }
    .orders-heading p {
      margin: 8px 0 0;
      font-size: 14px;
      color: #667085;
      font-weight: 600;
    }
    .orders-view-switch {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: 1px solid #e7eaf1;
      background: #eef1f6;
      border-radius: 15px;
      padding: 4px;
    }
    .orders-view-btn {
      border: 0;
      background: transparent;
      color: #667085;
      border-radius: 11px;
      height: 34px;
      padding: 0 14px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .orders-view-btn--active {
      background: #fff;
      color: #111827;
      box-shadow: 0 6px 14px rgba(18,24,40,.08);
    }
    .orders-toolbar {
      display: grid;
      gap: 10px;
    }
    .orders-search {
      position: relative;
      max-width: 760px;
    }
    .orders-search svg {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      width: 18px;
      height: 18px;
      color: #9aa3b4;
      pointer-events: none;
    }
    .orders-search input {
      width: 100%;
      height: 48px;
      border: 1px solid #e7eaf1;
      border-radius: 16px;
      background: #fff;
      color: #111827;
      font-size: 14px;
      padding: 0 14px 0 42px;
      outline: none;
      font-family: inherit;
    }
    .orders-search input:focus {
      border-color: #eb1b8d;
      box-shadow: 0 0 0 4px rgba(235, 27, 141, .12);
    }
    .orders-filter-chips {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .orders-chip {
      height: 38px;
      border: 1px solid #e7eaf1;
      border-radius: 999px;
      background: #fff;
      color: #111827;
      padding: 0 14px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }
    .orders-chip--active {
      background: #111827;
      color: #fff;
      border-color: #111827;
    }
    .chip-count {
      min-width: 20px;
      height: 20px;
      border-radius: 999px;
      background: #f4f6f9;
      color: #667085;
      display: inline-grid;
      place-items: center;
      font-size: 10px;
      font-weight: 800;
      padding: 0 5px;
    }
    .orders-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 18px;
      align-items: start;
      min-width: 0;
    }
    .kanban-wrapper {
      min-width: 0;
      overflow: hidden;
    }
    .kanban-board {
      min-width: 0;
      display: grid;
      grid-template-columns: repeat(4, minmax(230px, 1fr));
      gap: 14px;
    }
    .kanban-column {
      background: #fff;
      border: 1px solid #e7eaf1;
      border-radius: 24px;
      box-shadow: 0 8px 24px rgba(18, 24, 40, .07);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      min-height: 560px;
    }
    .kanban-column__header {
      padding: 12px 12px 10px;
      border-bottom: 1px solid #eef1f6;
      display: flex;
      align-items: center;
      gap: 10px;
      justify-content: space-between;
    }
    .kanban-column__title {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #111827;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: .01em;
    }
    .kanban-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      display: inline-block;
    }
    .kanban-column__count {
      background: #f4f6f9;
      color: #667085;
      border-radius: 999px;
      min-width: 22px;
      height: 22px;
      padding: 0 7px;
      display: inline-grid;
      place-items: center;
      font-size: 11px;
      font-weight: 800;
    }
    .kanban-column__body {
      display: grid;
      gap: 10px;
      padding: 10px;
      min-height: 0;
    }
    .kanban-column--new .kanban-column__header { background: #fff9df; }
    .kanban-column--preparing .kanban-column__header { background: #f4ecff; }
    .kanban-column--route .kanban-column__header { background: #ffe7f4; }
    .kanban-column--delivered .kanban-column__header { background: #eafbf1; }
    .kanban-dot--new { background: #f4b400; }
    .kanban-dot--preparing { background: #8b5cf6; }
    .kanban-dot--route { background: #eb1b8d; }
    .kanban-dot--delivered { background: #16a34a; }
    .kanban-empty {
      flex: 1;
      min-height: 170px;
      border: 1px dashed #d9dee8;
      border-radius: 18px;
      background: #fbfcff;
      display: grid;
      place-items: center;
      text-align: center;
      padding: 18px;
      color: #8d96a8;
      gap: 6px;
    }
    .kanban-empty h3 {
      margin: 0;
      color: #344054;
      font-size: 14px;
      font-weight: 700;
    }
    .kanban-empty p {
      margin: 0;
      font-size: 12px;
      line-height: 1.45;
      max-width: 220px;
    }
    .order-card {
      background: #fff;
      border: 1px solid #e7eaf1;
      border-radius: 18px;
      box-shadow: 0 8px 18px rgba(18, 24, 40, .08);
      padding: 14px;
      transition: .18s ease;
      cursor: pointer;
      display: grid;
      gap: 10px;
    }
    .order-card:hover {
      transform: translateY(-1px);
      box-shadow: 0 12px 26px rgba(18,24,40,.10);
    }
    .order-card__top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }
    .order-card__id {
      margin: 0;
      color: #111827;
      font-size: 12px;
      font-weight: 800;
    }
    .order-card__time {
      margin: 0;
      color: #98a2b3;
      font-size: 12px;
      font-weight: 600;
    }
    .order-card__customer {
      margin: 0;
      color: #344054;
      font-size: 14px;
      font-weight: 700;
      line-height: 1.25;
    }
    .order-card__products {
      background: #fbfcff;
      border: 1px solid #eef1f6;
      border-radius: 14px;
      padding: 10px;
    }
    .order-card__products p {
      margin: 0;
      color: #667085;
      font-size: 12px;
      line-height: 1.45;
    }
    .order-card__total-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .order-card__total {
      margin: 0;
      color: #111827;
      font-size: 17px;
      font-weight: 800;
      letter-spacing: -0.01em;
    }
    .order-card__actions {
      display: grid;
      grid-template-columns: 1fr 1.1fr;
      gap: 8px;
    }
    .order-btn-secondary,
    .order-btn-primary {
      height: 38px;
      border-radius: 13px;
      font-size: 12px;
      font-weight: 800;
      font-family: inherit;
      cursor: pointer;
      border: 1px solid transparent;
      white-space: nowrap;
    }
    .order-btn-secondary {
      border-color: #e7eaf1;
      background: #fff;
      color: #111827;
    }
    .order-btn-primary {
      background: #eb1b8d;
      color: #fff;
      box-shadow: 0 10px 18px rgba(235, 27, 141, .22);
    }
    .order-btn-primary:disabled { opacity: .6; cursor: default; }
    .orders-side-panel {
      display: grid;
      gap: 12px;
      position: sticky;
      top: 12px;
    }
    .orders-summary-card,
    .orders-selected-card {
      padding: 16px;
    }
    .orders-summary-grid {
      margin-top: 12px;
      display: grid;
      gap: 8px;
    }
    .orders-summary-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 10px;
      border-radius: 12px;
      background: #fbfcff;
      border: 1px solid #eef1f6;
      font-size: 13px;
      color: #475467;
      font-weight: 600;
    }
    .orders-summary-item strong {
      color: #111827;
      font-size: 13px;
      font-weight: 800;
    }
    .selected-order-id {
      margin: 8px 0 0;
      font-size: 13px;
      font-weight: 800;
      color: #111827;
    }
    .selected-order-customer {
      margin: 4px 0 0;
      color: #667085;
      font-size: 13px;
      font-weight: 600;
    }
    .list-card {
      padding: 16px;
      display: grid;
      gap: 12px;
      min-width: 0;
    }
    .list-toolbar {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) repeat(3, minmax(140px, auto));
      gap: 8px;
      min-width: 0;
    }
    .list-toolbar .input-field { height: 40px; }
    .list-table-wrap { min-width: 0; overflow: auto; }
    .orders-list-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 860px;
      font-size: 13px;
    }
    .orders-list-table thead th {
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      color: #667085;
      font-weight: 800;
      letter-spacing: .04em;
      padding: 11px 12px;
      border-bottom: 1px solid #eef1f6;
      background: #fbfcff;
    }
    .orders-list-table tbody td {
      padding: 12px;
      border-bottom: 1px solid #f2f4f7;
      color: #475467;
      vertical-align: middle;
    }
    .orders-list-table tbody tr:hover { background: #fbfcff; }
    .orders-loading {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    .orders-skeleton {
      height: 140px;
      border-radius: 16px;
      background: #eef1f6;
      animation: pulse 1.4s ease-in-out infinite;
    }
    .map-card {
      padding: 16px;
      min-height: 420px;
      display: grid;
      gap: 10px;
      align-content: start;
    }
    .map-subtitle {
      margin: 0;
      color: #667085;
      font-size: 13px;
      font-weight: 600;
    }
    .map-empty { min-height: 260px; }
    .admin-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      padding: 4px 9px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .01em;
      white-space: nowrap;
    }
    .admin-badge--new { background: #fff9df; color: #a16207; }
    .admin-badge--preparing { background: #f4ecff; color: #6d28d9; }
    .admin-badge--route { background: #ffe7f4; color: #be185d; }
    .admin-badge--delivered { background: #eafbf1; color: #067647; }
    .admin-badge--cancelled { background: #feefef; color: #b42318; }
    .text-brand-600 { color: #e91e8c; }
    .text-brand-700 { color: #9d174d; }
    .bg-brand-50 { background-color: #fdf2f8; }
    .border-brand-500 { border-color: #e91e8c; }
    @keyframes pulse {
      0%,100% { opacity: 1; }
      50% { opacity: .55; }
    }
    @media (max-width: 1440px) {
      .orders-layout { grid-template-columns: 1fr; }
      .orders-side-panel { position: static; grid-template-columns: repeat(2, minmax(0,1fr)); }
    }
    @media (max-width: 1180px) {
      .kanban-wrapper { overflow-x: auto; padding-bottom: 8px; }
      .kanban-board { min-width: 980px; }
    }
    @media (max-width: 980px) {
      .orders-page { padding: 16px; }
      .orders-page-header { padding: 16px; }
      .orders-header-top { flex-direction: column; align-items: stretch; }
      .orders-view-switch { width: 100%; justify-content: space-between; }
      .orders-view-btn { flex: 1; }
      .orders-side-panel { grid-template-columns: 1fr; }
      .list-toolbar { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 680px) {
      .orders-heading h1 { font-size: 24px; }
      .orders-filter-chips { gap: 6px; }
      .orders-chip { height: 36px; padding: 0 12px; font-size: 12px; }
      .list-toolbar { grid-template-columns: 1fr; }
      .order-card__actions { grid-template-columns: 1fr; }
    }
  `],
})
export class StoreOrdersPageComponent implements OnInit, OnDestroy {
    private readonly ordersService = inject(StoreOrdersService);
    private readonly storeAdminService = inject(StoreAdminService);
    private readonly toast = inject(ToastService);
    private readonly router = inject(Router);

    readonly isLoading = signal(true);
    readonly activeView = signal<ViewTab>(
        typeof window !== 'undefined' && window.innerWidth < 1024 ? 'lista' : 'kanban'
    );
    readonly activeChip = signal<OrdersChip>('all');
    readonly allOrders = signal<StoreOrder[]>([]);
    readonly listOrders = signal<StoreOrder[]>([]);
    readonly totalOrders = signal(0);
    readonly totalCount = signal(0);
    readonly currentPage = signal(1);
    readonly selectedOrderId = signal<string | null>(null);
    readonly advancingId = signal<string | null>(null);
    readonly rejectingId = signal<string | null>(null);
    readonly rejectModal = signal<StoreOrder | null>(null);
    readonly rejectReason = signal<string>('');
    readonly warningDismissed = signal(false);

    readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.PAGE_SIZE)));
    readonly tabs = [
        { id: 'kanban' as ViewTab, label: 'Kanban' },
        { id: 'lista' as ViewTab, label: 'Lista' },
        { id: 'mapa' as ViewTab, label: 'Mapa' },
    ];

    readonly kanbanColumns = KANBAN_COLUMNS;
    readonly rejectReasons = [
        'Producto no disponible',
        'Cocina cerrada / sin capacidad',
        'Dirección de entrega fuera de zona',
        'Pedido duplicado',
    ];
    customRejectReason = '';
    kanbanSearch = '';

    readonly finalRejectReason = computed(() => this.customRejectReason.trim() || this.rejectReason());
    readonly storeName = computed(() => this.storeAdminService.activeStore()?.name ?? 'QA Burger Naco');
    readonly storeIsOpen = computed(() => this.storeAdminService.activeStore()?.is_open ?? false);
    readonly outsideSchedule = computed(() => this.storeAdminService.isOutsideSchedule());
    readonly showOutsideScheduleAlert = computed(() => this.storeIsOpen() && this.outsideSchedule());
    readonly scheduleWindow = computed(() => {
        const store = this.storeAdminService.activeStore();
        if (!store?.opening_time || !store?.closing_time) return 'Horario no configurado';
        return `${this.fmt12(store.opening_time)} - ${this.fmt12(store.closing_time)}`;
    });

    readonly filteredKanbanOrders = computed(() => {
        const q = this.kanbanSearch.trim().toLowerCase();
        const chip = this.activeChip();
        const startToday = new Date();
        startToday.setHours(0, 0, 0, 0);

        return this.allOrders().filter(order => {
            if (q) {
                const haystack = `${order.order_number} ${order.customer_name} ${order.items_preview}`.toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            if (chip === 'all') return true;
            if (chip === 'new') return order.status === 'recibido';
            if (chip === 'preparing') return order.status === 'confirmado' || order.status === 'en_preparacion';
            if (chip === 'route') return order.status === 'en_camino';
            return new Date(order.created_at) >= startToday;
        });
    });

    readonly selectedOrder = computed(() => {
        const id = this.selectedOrderId();
        if (!id) return null;
        return this.allOrders().find(o => o.id === id) ?? null;
    });

    readonly summaryActive = computed(() => this.allOrders().filter(o => !['entregado', 'cancelado'].includes(o.status)).length);
    readonly summaryRoute = computed(() => this.allOrders().filter(o => o.status === 'en_camino').length);
    readonly summaryDelivered = computed(() => this.allOrders().filter(o => o.status === 'entregado').length);
    readonly summaryTotalActive = computed(() =>
        Math.round(this.allOrders()
            .filter(o => !['entregado', 'cancelado'].includes(o.status))
            .reduce((acc, o) => acc + (o.total ?? 0), 0)
        ).toLocaleString('es-DO')
    );

    filterSearch = '';
    filterStatus = 'activos';
    filterDateFrom = '';
    filterDateTo = '';
    private readonly PAGE_SIZE = 30;
    private kanbanSub: Subscription | null = null;

    ngOnInit(): void {
        this.loadKanbanOrders();
        this.setupRealtime();
    }

    ngOnDestroy(): void {
        this.kanbanSub?.unsubscribe();
        this.ordersService.unsubscribe();
    }

    private loadKanbanOrders(): void {
        const storeId = this.storeAdminService.activeStoreId();
        if (!storeId) return;

        this.isLoading.set(true);
        this.kanbanSub = this.ordersService.getLiveOrders(storeId).subscribe({
            next: ({ data }) => {
                this.allOrders.set(data);
                this.totalOrders.set(data.length);
                if (!this.selectedOrderId() && data.length) this.selectedOrderId.set(data[0].id);
                this.isLoading.set(false);
            },
            error: () => {
                this.toast.error('Error al cargar los pedidos');
                this.isLoading.set(false);
            },
        });
    }

    private loadListOrders(): void {
        const storeId = this.storeAdminService.activeStoreId();
        if (!storeId) return;

        this.isLoading.set(true);
        this.ordersService.getMyOrders(storeId, {
            status: (this.filterStatus as any) || null,
            search: this.filterSearch || undefined,
            date_from: this.filterDateFrom || undefined,
            date_to: this.filterDateTo || undefined,
            page: this.currentPage(),
            pageSize: this.PAGE_SIZE,
        }).subscribe({
            next: ({ data, count }) => {
                this.listOrders.set(data);
                this.totalCount.set(count);
                this.isLoading.set(false);
            },
            error: () => {
                this.toast.error('Error al cargar los pedidos');
                this.isLoading.set(false);
            },
        });
    }

    private setupRealtime(): void {
        const storeId = this.storeAdminService.activeStoreId();
        if (!storeId) return;

        this.ordersService.subscribeToNewOrders(storeId, (order) => {
            this.playNewOrderSound();
            this.toast.info(`🔔 Nuevo pedido #${order.order_number} — RD$ ${order.total?.toLocaleString('es-DO') ?? '—'}`);
            const id = this.storeAdminService.activeStoreId()!;
            this.ordersService.getMyOrders(id, { status: 'activos' }).subscribe({
                next: ({ data }) => this.allOrders.set(data),
            });
        });
    }

    private playNewOrderSound(): void {
        try {
            const audio = new Audio('/assets/sounds/new-order.mp3');
            audio.volume = 0.7;
            audio.play().catch(() => {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = 880;
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.4);
            });
        } catch {
            // Ignore if audio not supported
        }
    }

    setView(tab: ViewTab): void {
        this.activeView.set(tab);
        if (tab === 'lista') {
            this.currentPage.set(1);
            this.loadListOrders();
        }
    }

    onFilterChange(): void {
        this.currentPage.set(1);
        this.loadListOrders();
    }

    prevPage(): void {
        if (this.currentPage() > 1) {
            this.currentPage.update(p => p - 1);
            this.loadListOrders();
        }
    }

    nextPage(): void {
        if (this.currentPage() < this.totalPages()) {
            this.currentPage.update(p => p + 1);
            this.loadListOrders();
        }
    }

    ordersForColumn(statuses: OrderStatus[]): StoreOrder[] {
        return this.filteredKanbanOrders().filter(o => statuses.includes(o.status));
    }

    primaryActionLabel(order: StoreOrder): string | null {
        if (order.status === 'recibido') return 'Aceptar pedido';
        if (order.status === 'confirmado' || order.status === 'en_preparacion') return 'Marcar listo';
        if (order.status === 'en_camino') return 'Marcar entregado';
        return null;
    }

    filteredCount(chip: OrdersChip): number {
        const startToday = new Date();
        startToday.setHours(0, 0, 0, 0);
        if (chip === 'all') return this.allOrders().length;
        if (chip === 'new') return this.allOrders().filter(o => o.status === 'recibido').length;
        if (chip === 'preparing') return this.allOrders().filter(o => o.status === 'confirmado' || o.status === 'en_preparacion').length;
        if (chip === 'route') return this.allOrders().filter(o => o.status === 'en_camino').length;
        return this.allOrders().filter(o => new Date(o.created_at) >= startToday).length;
    }

    selectOrder(id: string): void {
        this.selectedOrderId.set(id);
    }

    elapsedLabel(createdAt: string): string {
        const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000);
        if (minutes < 1) return 'Ahora';
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m`;
    }

    nextStatus(current: OrderStatus): OrderStatus | null {
        return this.ordersService.nextStatus(current);
    }

    async advanceOrder(order: StoreOrder, event: Event): Promise<void> {
        event.stopPropagation();
        const next = this.nextStatus(order.status);
        if (!next || this.advancingId() === order.id) return;

        this.advancingId.set(order.id);
        try {
            await this.ordersService.updateStatus(order.id, next);
            this.allOrders.update(orders =>
                orders.map(o => o.id === order.id ? { ...o, status: next } : o),
            );
            this.toast.success(`Pedido #${order.order_number} → ${STATUS_LABELS[next]}`);
        } catch {
            this.toast.error('No se pudo actualizar el estado');
        } finally {
            this.advancingId.set(null);
        }
    }

    goToDetail(id: string): void {
        this.router.navigate(['/store/orders', id]);
    }

    goToSettings() {
        this.router.navigate(['/store/settings']);
    }

    openRejectModal(order: StoreOrder, event: Event): void {
        event.stopPropagation();
        this.rejectModal.set(order);
        this.rejectReason.set('');
        this.customRejectReason = '';
    }

    closeRejectModal(): void {
        if (this.rejectingId() !== null) return;
        this.rejectModal.set(null);
    }

    async confirmReject(): Promise<void> {
        const order = this.rejectModal();
        const reason = this.finalRejectReason();
        if (!order || !reason) return;

        this.rejectingId.set(order.id);
        try {
            await this.ordersService.rejectOrder(order.id, reason);
            this.allOrders.update(orders => orders.filter(o => o.id !== order.id));
            this.toast.success(`Pedido #${order.order_number} rechazado`);
            this.rejectModal.set(null);
        } catch {
            this.toast.error('No se pudo rechazar el pedido');
        } finally {
            this.rejectingId.set(null);
        }
    }

    statusLabel(status: OrderStatus): string { return STATUS_LABELS[status] ?? status; }
    statusColor(status: OrderStatus): string { return STATUS_BADGE_CLASS[status] ?? 'admin-badge'; }

    private fmt12(time: string): string {
        const [h, m] = time.split(':').map(Number);
        const ampm = h >= 12 ? 'pm' : 'am';
        const h12 = h % 12 || 12;
        return `${h12}:${String(m).padStart(2, '0')}${ampm}`;
    }
}

