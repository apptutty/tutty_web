import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { StoreAdminService } from '../store-admin.service';
import { StoreDashboardService, StoreKPIs, ActiveOrder, TopProduct, SalesDay, LowStockItem } from './store-dashboard.service';
import { OpenCloseToggleComponent } from './open-close-toggle.component';
import { ScheduleWarningCardComponent } from '../shared/schedule-warning-card.component';

const STATUS_CFG: Record<string, { label: string; classes: string; pulse: boolean }> = {
    recibido: { label: 'Nuevo', classes: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200', pulse: true },
    confirmado: { label: 'Confirmado', classes: 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200', pulse: false },
    en_preparacion: { label: 'Preparando', classes: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200', pulse: false },
    en_camino: { label: 'En camino', classes: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200', pulse: false },
};

const NEXT_BTN: Record<string, string> = {
    recibido: 'Confirmar',
    confirmado: 'Preparando',
    en_preparacion: 'Listo',
};

@Component({
    selector: 'app-store-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule, OpenCloseToggleComponent, ScheduleWarningCardComponent],
    styles: [`
      .admin-dashboard-page {
        padding: 30px 34px 38px;
        min-width: 0;
        background: var(--admin-bg, #f6f7fb);
      }
      .dashboard-stack { display: grid; gap: 16px; min-width: 0; }
      .dashboard-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 22px;
        flex-wrap: wrap;
        padding: 24px;
        border-radius: 26px;
        border: 1px solid #e7eaf1;
        background:
          radial-gradient(circle at 92% 15%, rgba(235,27,141,.12), transparent 26%),
          linear-gradient(180deg, #fff, #fbfcff);
        box-shadow: 0 8px 24px rgba(18, 24, 40, .07);
      }
      .dashboard-header h1 {
        margin: 0;
        font-size: 26px;
        line-height: 1.1;
        color: #111827;
        letter-spacing: -0.04em;
        font-weight: 700;
      }
      .dashboard-header p {
        margin: 8px 0 0;
        color: #667085;
        font-size: 14px;
        font-weight: 600;
      }
      .admin-header-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .admin-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border: 1px solid #e7eaf1;
        background: #fbfcff;
        color: #667085;
        border-radius: 999px;
        padding: 9px 13px;
        font-size: 12px;
        font-weight: 700;
        box-shadow: 0 4px 14px rgba(18,24,40,.05);
      }
      .admin-chip strong { color: #111827; }
      .admin-metrics-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(190px, 1fr));
        gap: 16px;
        min-width: 0;
      }
      .admin-metric-card {
        background: #fff;
        border: 1px solid #e7eaf1;
        border-radius: 22px;
        padding: 20px;
        box-shadow: 0 8px 24px rgba(18, 24, 40, .07);
        min-width: 0;
        position: relative;
        overflow: hidden;
        transition: .18s ease;
      }
      .admin-metric-card::after {
        content: "";
        position: absolute;
        inset: auto 0 0 0;
        height: 3px;
        background: linear-gradient(90deg, #eb1b8d, transparent);
        opacity: 0;
        transition: .18s ease;
      }
      .admin-metric-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 14px 34px rgba(18, 24, 40, .10);
      }
      .admin-metric-card:hover::after { opacity: 1; }
      .metric-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      .metric-label {
        margin: 0;
        font-size: 12px;
        font-weight: 800;
        color: #667085;
        letter-spacing: .06em;
        text-transform: uppercase;
      }
      .metric-value {
        margin: 9px 0 0;
        font-size: 27px;
        line-height: 1;
        color: #111827;
        font-weight: 800;
        letter-spacing: -0.04em;
      }
      .metric-sub {
        margin: 10px 0 0;
        font-size: 12.5px;
        color: #98a2b3;
        font-weight: 500;
      }
      .metric-icon {
        width: 38px;
        height: 38px;
        border-radius: 14px;
        display: grid;
        place-items: center;
      }
      .dashboard-main-grid, .dashboard-secondary-grid {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(280px, .9fr);
        gap: 18px;
        min-width: 0;
      }
      .dashboard-main-grid { margin-bottom: 18px; }
      .admin-card {
        background: #fff;
        border: 1px solid #e7eaf1;
        border-radius: 22px;
        box-shadow: 0 8px 24px rgba(18, 24, 40, .07);
      }
      .active-orders-card { overflow: hidden; min-width: 0; min-height: 280px; padding: 22px; }
      .orders-card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 18px;
      }
      .orders-card-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .orders-card-title h2 {
        margin: 0;
        font-size: 17px;
        color: #111827;
      }
      .orders-card-refresh {
        margin: 0;
        color: #98a2b3;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
      }
      .orders-list {
        border-top: 1px solid #eef1f6;
        padding-top: 16px;
      }
      .order-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto auto;
        align-items: center;
        gap: 14px;
        padding: 0;
        transition: .15s ease;
      }
      .order-row:hover { background: transparent; }
      .order-meta { flex: 1; min-width: 0; }
      .order-main {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .order-main .order-number {
        font-size: 14px;
        font-weight: 800;
        color: #111827;
      }
      .order-main .order-customer {
        font-size: 14px;
        color: #667085;
        font-weight: 600;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .order-summary {
        margin: 4px 0 0;
        font-size: 12px;
        color: #8d96a8;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .order-amount {
        text-align: right;
        flex-shrink: 0;
      }
      .order-amount p {
        margin: 0;
      }
      .order-amount .order-time {
        font-size: 12px;
        color: #98a2b3;
        font-weight: 500;
      }
      .order-amount .order-total {
        margin-top: 2px;
        font-size: 14px;
        color: #111827;
        font-weight: 800;
      }
      .store-state-card { display: block; min-width: 0; }
      .sales-chart-card, .top-products-card {
        padding: 18px;
        min-width: 0;
      }
      .secondary-btn {
        height: 38px;
        border: 1px solid #e7eaf1;
        background: #fff;
        color: #344054;
        border-radius: 13px;
        padding: 0 14px;
        font-family: inherit;
        font-weight: 800;
        font-size: 12px;
        cursor: pointer;
        white-space: nowrap;
      }
      .secondary-btn:hover {
        border-color: #d3d8e2;
        box-shadow: 0 6px 14px rgba(18,24,40,.06);
      }
      .panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 14px;
      }
      .panel-head h2 {
        margin: 0;
      }
      .sales-bars {
        display: flex;
        align-items: flex-end;
        gap: 9px;
        height: 210px;
        padding: 20px 0 4px;
      }
      .sales-bar-col {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      }
      .sales-value {
        font-size: 10px;
        color: #98a2b3;
      }
      .sales-label {
        font-size: 11px;
        color: #667085;
        font-weight: 600;
      }
      .sales-bar {
        width: 100%;
        max-width: 64px;
        border-radius: 999px 999px 8px 8px;
        background: linear-gradient(180deg, #f2299b, #eb1b8d);
        min-height: 5px;
        box-shadow: 0 8px 18px rgba(235, 27, 141, .18);
      }
      .admin-empty-state {
        min-height: 205px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        color: #7b8496;
        gap: 8px;
        border: 1px dashed #d9dee8;
        border-radius: 20px;
        background: linear-gradient(180deg, #fff, #fbfcff);
        padding: 24px;
      }
      .admin-empty-state h3 {
        margin: 0;
        font-size: 15px;
        color: #344054;
      }
      .admin-empty-state p {
        margin: 0 auto;
        max-width: 270px;
        font-size: 12.5px;
        line-height: 1.55;
      }
      .top-list { display: grid; gap: 10px; }
      .top-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .top-rank {
        width: 20px;
        text-align: right;
        color: #c4c9d4;
        font-weight: 700;
        font-size: 12px;
      }
      .top-info { flex: 1; min-width: 0; }
      .top-name {
        margin: 0;
        font-size: 13px;
        color: #111827;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .top-bar-track {
        margin-top: 4px;
        height: 5px;
        border-radius: 999px;
        overflow: hidden;
        background: #eef1f6;
      }
      .top-bar-fill {
        height: 100%;
        border-radius: inherit;
        background: #eb1b8d;
      }
      .top-sold {
        font-size: 13px;
        color: #475467;
        font-weight: 700;
        flex-shrink: 0;
      }
      .inventory-alert-card { overflow: hidden; }
      @media (max-width: 1360px) {
        .admin-metrics-grid { grid-template-columns: repeat(2, minmax(220px, 1fr)); }
        .dashboard-main-grid, .dashboard-secondary-grid { grid-template-columns: 1fr; }
      }
      @media (max-width: 980px) {
        .admin-dashboard-page { padding: 22px; }
        .dashboard-header { flex-direction: column; }
        .admin-header-actions { justify-content: flex-start; }
        .order-row {
          grid-template-columns: 1fr;
          align-items: flex-start;
        }
        .order-amount {
          text-align: left;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
      }
      @media (max-width: 680px) {
        .admin-dashboard-page { padding: 16px; }
        .dashboard-header { padding: 18px; }
        .dashboard-header h1 { font-size: 24px; }
        .metric-value { font-size: 24px; }
        .admin-metrics-grid { grid-template-columns: 1fr; }
      }
    `],
    template: `
    <div class="admin-dashboard-page">
      <div class="dashboard-stack">
        <section class="dashboard-header">
          <div>
            <h1>Dashboard</h1>
            <p>Resumen de ventas, pedidos y operación de {{ storeName() }}.</p>
          </div>
          <div class="admin-header-actions">
            <span class="admin-chip"><strong>Hoy</strong> · {{ today }}</span>
            <span class="admin-chip">Actualiza cada <strong>30 seg</strong></span>
          </div>
        </section>

        @if (showOutsideScheduleAlert() && !warningDismissed()) {
          <app-schedule-warning-card
            [scheduleWindow]="scheduleWindow()"
            (editSchedule)="goToSettings()"
            (close)="warningDismissed.set(true)" />
        }

        @if (kpisLoading()) {
          <div class="admin-metrics-grid">
            @for (n of skeleton; track n) {
              <article class="admin-metric-card animate-pulse">
                <div class="h-3 w-20 bg-gray-200 rounded mb-3"></div>
                <div class="h-7 w-14 bg-gray-200 rounded"></div>
              </article>
            }
          </div>
        } @else {
          <div class="admin-metrics-grid">
            <article class="admin-metric-card">
              <div class="metric-head">
                <div>
                  <p class="metric-label">Ventas hoy</p>
                  <p class="metric-value">RD&#36;{{ sales() }}</p>
                </div>
                <div class="metric-icon bg-green-50">
                  <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p class="metric-sub">Ticket promedio RD&#36;{{ avgTicket() }}</p>
            </article>

            <article class="admin-metric-card">
              <div class="metric-head">
                <div>
                  <p class="metric-label">Pedidos hoy</p>
                  <p class="metric-value">{{ orderCount() }}</p>
                </div>
                <div class="metric-icon bg-blue-50">
                  <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
              </div>
              <p class="metric-sub">{{ cancellations() }} cancelados</p>
            </article>

            <article class="admin-metric-card">
              <div class="metric-head">
                <div>
                  <p class="metric-label">Activos ahora</p>
                  <p class="metric-value">{{ activeOrdering() }}</p>
                </div>
                <div class="metric-icon bg-gray-100">
                  <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                </div>
              </div>
              <p class="metric-sub">En preparacion / camino</p>
            </article>

            <article class="admin-metric-card">
              <div class="metric-head">
                <div>
                  <p class="metric-label">Calificacion</p>
                  <p class="metric-value">{{ rating() }}</p>
                </div>
                <div class="metric-icon bg-yellow-50">
                  <svg class="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                </div>
              </div>
              <p class="metric-sub">{{ totalReviews() }} reseñas</p>
            </article>
          </div>
        }

        <div class="dashboard-main-grid">
          <section class="admin-card active-orders-card">
            <div class="orders-card-head">
              <div class="orders-card-title">
                <h2 class="admin-card-title">Pedidos activos</h2>
                @if (activeOrders().length > 0) {
                  <span class="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-brand-500 text-white text-xs font-bold">
                    {{ activeOrders().length }}
                  </span>
                }
              </div>
              <p class="orders-card-refresh">Actualiza cada 30 seg</p>
            </div>

            @if (activeOrders().length === 0) {
              <div class="py-12 text-center text-gray-400">
                <svg class="w-10 h-10 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p class="text-sm font-medium">Sin pedidos activos</p>
              </div>
            } @else {
              <div class="orders-list divide-y divide-gray-100">
                @for (order of activeOrders(); track order.id) {
                  <div class="order-row">
                    <span class="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                      [ngClass]="statusCfg(order.status).classes">
                      @if (statusCfg(order.status).pulse) {
                        <span class="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                      }
                      {{ statusCfg(order.status).label }}
                    </span>

                    <div class="order-meta">
                      <div class="order-main">
                        <span class="order-number">#{{ order.order_number }}</span>
                        <span class="order-customer">{{ order.customer_name }}</span>
                      </div>
                      <p class="order-summary">{{ itemSummary(order) }}</p>
                    </div>

                    <div class="order-amount">
                      <p class="order-time">{{ elapsed(order.created_at) }}</p>
                      <p class="order-total">RD&#36;{{ fmtN(order.total) }}</p>
                    </div>

                    <button class="secondary-btn" (click)="goToOrders()">Ver pedido</button>
                  </div>
                }
              </div>
            }
          </section>

          <app-open-close-toggle class="store-state-card" />
        </div>

        <div class="dashboard-secondary-grid">
          <section class="admin-card sales-chart-card">
            <div class="panel-head">
              <h2 class="admin-card-title">Ventas últimos 7 días</h2>
            </div>
            @if (weeklySales().length === 0) {
              <div class="admin-empty-state">
                <h3>Cargando datos</h3>
              </div>
            } @else if (!hasSalesData()) {
              <div class="admin-empty-state">
                <h3>Aún no hay suficientes ventas</h3>
                <p>Los datos aparecerán cuando el comercio tenga pedidos completados.</p>
                <button class="secondary-btn" (click)="goToOrders()">Ver pedidos</button>
              </div>
            } @else {
              <div class="sales-bars">
                @for (day of weeklySales(); track day.date) {
                  <div class="sales-bar-col">
                    <span class="sales-value">{{ day.sales > 0 ? fmtN(day.sales) : '' }}</span>
                    <div class="sales-bar transition-all duration-500" [style.height.%]="barH(day.sales)"></div>
                    <span class="sales-label">{{ day.date }}</span>
                  </div>
                }
              </div>
            }
          </section>

          <section class="admin-card top-products-card">
            <div class="panel-head">
              <h2 class="admin-card-title">Top productos hoy</h2>
            </div>
            @if (topProducts().length === 0) {
              <div class="admin-empty-state">
                <svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
                </svg>
                <h3>Sin ventas hoy</h3>
                <p>Cuando recibas pedidos, aquí verás tus productos más vendidos.</p>
                <button class="secondary-btn" (click)="goToMenu()">Ver menú</button>
              </div>
            } @else {
              <div class="top-list">
                @for (p of topProducts(); track p.name; let i = $index) {
                  <div class="top-row">
                    <span class="top-rank">{{ i + 1 }}</span>
                    <div class="top-info">
                      <p class="top-name">{{ p.name }}</p>
                      <div class="top-bar-track">
                        <div class="top-bar-fill transition-all duration-500" [style.width.%]="topBarW(p.totalSold)"></div>
                      </div>
                    </div>
                    <span class="top-sold">{{ p.totalSold }}</span>
                  </div>
                }
              </div>
            }
          </section>
        </div>

        @if (hasInventoryAlerts()) {
          <section class="admin-card inventory-alert-card">
            <div class="flex items-center gap-3 px-5 py-4 border-b border-orange-100 bg-orange-50">
            <svg class="w-5 h-5 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <h2 class="font-semibold text-orange-800">Alertas de inventario</h2>
              <p class="text-xs text-orange-600 mt-0.5">{{ inventoryAlertSummary() }}</p>
            </div>
          </div>

          <div class="divide-y divide-gray-100">
            @for (item of lowStockItems(); track item.id) {
              <div class="flex items-center gap-4 px-5 py-3">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-800 truncate">{{ item.name }}</p>
                  <p class="text-xs mt-0.5"
                    [class.text-red-600]="item.stock_count === 0"
                    [class.text-amber-600]="item.stock_count !== 0">
                    {{ stockLabel(item) }}
                  </p>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  @if (editingStockId() === item.id) {
                    <input type="number" min="0"
                      class="input-field w-20 text-center text-sm py-1"
                      [(ngModel)]="editingStockValue"
                      (keydown.enter)="saveStock(item.id)" />
                    <button class="btn-primary text-xs px-2.5 py-1" (click)="saveStock(item.id)">Guardar</button>
                    <button class="btn-secondary text-xs px-2.5 py-1" (click)="editingStockId.set(null)">&#10005;</button>
                  } @else {
                    <button
                      class="text-xs font-medium text-brand-600 hover:text-brand-700 underline underline-offset-2 transition-colors"
                      (click)="startEditStock(item)">Actualizar stock</button>
                  }
                </div>
              </div>
            }
          </div>
          </section>
        }
      </div>
    </div>
  `,
})
export class StoreDashboardPageComponent implements OnInit, OnDestroy {
    private readonly storeService = inject(StoreAdminService);
    private readonly dashService = inject(StoreDashboardService);
    private readonly router = inject(Router);
    private readonly subs: Subscription[] = [];

    readonly skeleton = [1, 2, 3, 4];
    readonly today = new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' });
    editingStockValue = 0;

    readonly kpis = signal<StoreKPIs | null>(null);
    readonly kpisLoading = signal(true);
    readonly activeOrders = signal<ActiveOrder[]>([]);
    readonly topProducts = signal<TopProduct[]>([]);
    readonly weeklySales = signal<SalesDay[]>([]);
    readonly lowStockItems = signal<LowStockItem[]>([]);
    readonly editingStockId = signal<string | null>(null);

    // Derived KPI helpers (avoid complex optional chaining in template)
    readonly storeName = computed(() => this.storeService.activeStore()?.name ?? '');
    readonly sales = computed(() => this.fmtN(this.kpis()?.sales ?? 0));
    readonly avgTicket = computed(() => this.fmtN(this.kpis()?.avgTicket ?? 0));
    readonly orderCount = computed(() => this.kpis()?.orderCount ?? 0);
    readonly cancellations = computed(() => this.kpis()?.cancellations ?? 0);
    readonly activeOrdering = computed(() => this.kpis()?.activeOrders ?? 0);
    readonly rating = computed(() => (this.kpis()?.rating ?? 0).toFixed(1));
    readonly totalReviews = computed(() => this.storeService.activeStore()?.total_reviews ?? 0);
    readonly storeIsOpen = computed(() => this.storeService.activeStore()?.is_open ?? false);
    readonly outsideSchedule = computed(() => this.storeService.isOutsideSchedule());
    readonly showOutsideScheduleAlert = computed(() => this.storeIsOpen() && this.outsideSchedule());
    readonly warningDismissed = signal(false);
    readonly hasSalesData = computed(() => this.weeklySales().some(d => d.sales > 0));
    readonly scheduleWindow = computed(() => {
        const store = this.storeService.activeStore();
        if (!store?.opening_time || !store?.closing_time) return 'Horario no configurado';
        return `${this.fmt12(store.opening_time)} - ${this.fmt12(store.closing_time)}`;
    });

    readonly maxWeekly = computed(() => Math.max(...this.weeklySales().map(d => d.sales), 1));
    readonly maxTop = computed(() => Math.max(...this.topProducts().map(p => p.totalSold), 1));

    readonly hasInventoryAlerts = computed(() => {
        const k = this.kpis();
        if (k?.lowStockCount == null) return false;
        return (k.outOfStockCount ?? 0) > 0 || (k.lowStockCount ?? 0) > 0;
    });

    readonly inventoryAlertSummary = computed(() => {
        const k = this.kpis();
        if (!k) return '';
        const parts: string[] = [];
        if ((k.outOfStockCount ?? 0) > 0) parts.push(`${k.outOfStockCount} sin stock`);
        if ((k.lowStockCount ?? 0) > 0) parts.push(`${k.lowStockCount} con stock bajo`);
        return parts.join(' · ');
    });

    ngOnInit(): void {
        const storeId = this.storeService.activeStoreId();
        const commerceType = this.storeService.activeStore()?.commerce_type ?? '';
        if (!storeId) return;

        this.subs.push(
            this.dashService.getTodayKPIs(storeId, commerceType).subscribe(k => {
                this.kpis.set(k);
                this.kpisLoading.set(false);
            }),
            this.dashService.getActiveOrders(storeId).subscribe(o => this.activeOrders.set(o)),
            this.dashService.getTopProducts(storeId).subscribe(p => this.topProducts.set(p)),
            this.dashService.getWeeklySales(storeId).subscribe(s => this.weeklySales.set(s)),
            this.dashService.getLowStockItems(storeId).subscribe(i => this.lowStockItems.set(i)),
        );
    }

    ngOnDestroy(): void {
        this.subs.forEach(s => s.unsubscribe());
    }

    statusCfg(status: string) {
        return STATUS_CFG[status] ?? { label: status, classes: 'bg-gray-100 text-gray-600', pulse: false };
    }

    goToSettings() {
        this.router.navigate(['/store/settings']);
    }

    goToMenu() {
        this.router.navigate(['/store/catalog']);
    }

    goToOrders() {
        this.router.navigate(['/store/orders']);
    }

    nextBtn(status: string): string | null {
        return NEXT_BTN[status] ?? null;
    }

    async advanceStatus(order: ActiveOrder) {
        const next = await this.dashService.advanceOrderStatus(order.id, order.status);
        if (next) {
            this.activeOrders.update(list =>
                list.map(o => o.id === order.id ? { ...o, status: next } : o)
            );
        }
    }

    itemSummary(order: ActiveOrder): string {
        const first2 = order.items.slice(0, 2).map(i => i.quantity + 'x ' + i.name).join(', ');
        const extra = order.items.length - 2;
        return extra > 0 ? first2 + ' y ' + extra + ' mas' : first2;
    }

    elapsed(createdAt: string): string {
        const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
        if (diff < 60) return diff + ' min';
        const h = Math.floor(diff / 60);
        return h + 'h ' + (diff % 60) + 'm';
    }

    fmtN(n: number): string {
        return Math.round(n).toLocaleString('es-DO');
    }

    private fmt12(time: string): string {
        const [h, m] = time.split(':').map(Number);
        const ampm = h >= 12 ? 'pm' : 'am';
        const h12 = h % 12 || 12;
        return `${h12}:${String(m).padStart(2, '0')}${ampm}`;
    }

    barH(sales: number): number {
        const max = this.maxWeekly();
        return max > 0 ? Math.max(5, Math.round((sales / max) * 100)) : 5;
    }

    topBarW(sold: number): number {
        const max = this.maxTop();
        return max > 0 ? Math.round((sold / max) * 100) : 0;
    }

    stockLabel(item: LowStockItem): string {
        if ((item.stock_count ?? 0) === 0) return 'Sin stock';
        const base = 'Stock: ' + item.stock_count;
        return item.low_stock_alert ? base + ' · Minimo: ' + item.low_stock_alert : base;
    }

    startEditStock(item: LowStockItem) {
        this.editingStockId.set(item.id);
        this.editingStockValue = item.stock_count ?? 0;
    }

    async saveStock(itemId: string) {
        await this.dashService.updateStock(itemId, this.editingStockValue);
        const newVal = this.editingStockValue;
        this.lowStockItems.update(list =>
            list.map(i => i.id === itemId ? { ...i, stock_count: newVal } : i)
                .filter(i => i.low_stock_alert == null || (i.stock_count ?? 0) <= i.low_stock_alert || (i.stock_count ?? 0) === 0)
        );
        this.editingStockId.set(null);
    }
}
