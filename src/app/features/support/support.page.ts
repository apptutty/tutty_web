import {
    Component, OnInit, OnDestroy, inject, signal, computed,
    Input, Output, EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
    SupportService, SupportTicket, SupportTicketDetail,
    SupportKPIs, TicketFilters, TicketStatus, TicketType, TicketPriority,
} from './services/support.service';
import { SupportTicketListComponent } from './components/ticket-list/ticket-list.component';
import { SupportTicketDetailComponent } from './components/ticket-detail/ticket-detail.component';
import { NewTicketModalComponent } from './components/new-ticket-modal/new-ticket-modal.component';
import { AdminEmptyStateComponent } from '../../shared/ui/admin-empty-state/admin-empty-state.component';

// ─── Quick-filter presets ─────────────────────────────────────────────────────

interface QuickFilter {
    label: string;
    icon?: string;
    badge?: 'sla' | 'status';
    apply: Partial<TicketFilters>;
}

const STATUS_LABELS: Record<TicketStatus, string> = {
    abierto: 'Abierto',
    en_revision: 'En revisión',
    esperando_respuesta: 'Esperando respuesta',
    escalado: 'Escalado',
    resuelto: 'Resuelto',
    cerrado: 'Cerrado',
};

const ALL_STATUSES: TicketStatus[] = [
    'abierto', 'en_revision', 'esperando_respuesta', 'escalado', 'resuelto', 'cerrado',
];

// ─── Shell ────────────────────────────────────────────────────────────────────

@Component({
    selector: 'app-support-page',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, SupportTicketListComponent, SupportTicketDetailComponent, NewTicketModalComponent, AdminEmptyStateComponent],
    template: `
    <!-- Mobile drawer overlay -->
    @if (sidebarOpen()) {
      <div
        class="fixed inset-0 bg-black/40 z-30 xl:hidden"
        (click)="sidebarOpen.set(false)"
      ></div>
    }

    <div class="flex h-[calc(100vh-64px)] overflow-hidden -mx-6 -mt-6">

      <!-- ═══ LEFT PANEL ═══════════════════════════════════════════════════════ -->
      <aside
        class="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col
               fixed xl:relative inset-y-0 left-0 z-40 xl:z-auto
               transition-transform duration-200"
        [class.-translate-x-full]="!sidebarOpen()"
        [class.translate-x-0]="sidebarOpen()"
        [class.xl:translate-x-0]="true"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between px-4 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 class="text-base font-bold text-gray-800">Soporte</h2>
          <button
            class="flex items-center gap-1 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg transition-colors"
            (click)="openNewTicketModal()"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo ticket
          </button>
          <a
            routerLink="/support-dashboard"
            class="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors" title="Dashboard de métricas"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </a>
          <a
            routerLink="/support/templates"
            class="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors" title="Plantillas de respuesta"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </a>
        </div>

        <!-- KPI pills 2×2 -->
        <div class="grid grid-cols-2 gap-2 px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div class="flex items-center gap-2 bg-error-50 rounded-lg px-2.5 py-2">
            <span class="text-base leading-none">🔴</span>
            <div class="min-w-0">
              <p class="text-sm font-bold text-error-700 leading-none">{{ kpis()?.open_tickets ?? '—' }}</p>
              <p class="text-[10px] text-error-500 mt-0.5 truncate">Abiertos</p>
            </div>
          </div>
          <div class="flex items-center gap-2 bg-yellow-50 rounded-lg px-2.5 py-2">
            <span class="text-base leading-none">🟡</span>
            <div class="min-w-0">
              <p class="text-sm font-bold text-yellow-700 leading-none">{{ kpis()?.in_review ?? '—' }}</p>
              <p class="text-[10px] text-yellow-600 mt-0.5 truncate">En revisión</p>
            </div>
          </div>
          <div class="flex items-center gap-2 bg-orange-50 rounded-lg px-2.5 py-2">
            <span class="text-base leading-none">⚡</span>
            <div class="min-w-0">
              <p class="text-sm font-bold text-orange-700 leading-none">{{ kpis()?.sla_breached_open ?? '—' }}</p>
              <p class="text-[10px] text-orange-600 mt-0.5 truncate">SLA vencido</p>
            </div>
          </div>
          <div class="flex items-center gap-2 bg-success-50 rounded-lg px-2.5 py-2">
            <span class="text-base leading-none">✅</span>
            <div class="min-w-0">
              <p class="text-sm font-bold text-success-700 leading-none">{{ kpis()?.resolved_today ?? '—' }}</p>
              <p class="text-[10px] text-success-600 mt-0.5 truncate">Resueltos hoy</p>
            </div>
          </div>
        </div>

        <!-- Filter nav (scrollable) -->
        <nav class="flex-1 overflow-y-auto py-2 text-sm">

          <!-- Quick filters -->
          <div class="px-2 mb-1">
            @for (qf of quickFilters; track qf.label) {
              <button
                class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors"
                [class]="isQuickFilterActive(qf)
                  ? 'bg-primary-50 text-primary-700 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50'"
                (click)="applyQuickFilter(qf)"
              >
                <span class="flex items-center gap-2">
                  @if (qf.icon) { <span>{{ qf.icon }}</span> }
                  {{ qf.label }}
                </span>
                @if (qf.badge === 'sla' && (kpis()?.sla_breached_open ?? 0) > 0) {
                  <span class="min-w-[20px] h-5 px-1 rounded-full bg-error-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {{ kpis()!.sla_breached_open }}
                  </span>
                }
              </button>
            }
          </div>

          <div class="mx-4 my-1.5 border-t border-gray-100"></div>

          <!-- Por estado -->
          <p class="px-5 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Por estado</p>
          <div class="px-2">
            @for (st of allStatuses; track st) {
              <button
                class="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left transition-colors"
                [class]="activeFilters().status === st
                  ? 'bg-primary-50 text-primary-700 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50'"
                (click)="setStatus(st)"
              >
                <span>{{ statusLabels[st] }}</span>
                @if (statusCounts()[st]) {
                  <span class="text-xs text-gray-400">{{ statusCounts()[st] }}</span>
                }
              </button>
            }
          </div>

          <div class="mx-4 my-1.5 border-t border-gray-100"></div>

          <!-- Por tipo de reporter -->
          <p class="px-5 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Por reporter</p>
          <div class="px-2">
            @for (rt of reporterTypes; track rt.value) {
              <button
                class="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left transition-colors"
                [class]="activeFilters().reporter_type === rt.value
                  ? 'bg-primary-50 text-primary-700 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50'"
                (click)="setReporterType(rt.value)"
              >
                <span>{{ rt.icon }}</span>
                <span>{{ rt.label }}</span>
              </button>
            }
          </div>

          <div class="mx-4 my-1.5 border-t border-gray-100"></div>

          <!-- Por prioridad -->
          <p class="px-5 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Por prioridad</p>
          <div class="px-2">
            @for (pr of priorities; track pr.value) {
              <button
                class="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left transition-colors"
                [class]="activeFilters().priority === pr.value
                  ? 'bg-primary-50 text-primary-700 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50'"
                (click)="setPriority(pr.value)"
              >
                <span>{{ pr.icon }}</span>
                <span>{{ pr.label }}</span>
              </button>
            }
          </div>

        </nav>
      </aside>

      <!-- ═══ RIGHT PANEL ══════════════════════════════════════════════════════ -->
      <div class="flex-1 flex flex-col min-w-0 bg-gray-50">

        <!-- Toolbar -->
        <div class="flex flex-wrap items-center gap-2 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
          <!-- Hamburger (mobile) -->
          <button
            class="xl:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            (click)="sidebarOpen.set(true)"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <!-- Search -->
          <div class="relative flex-1 min-w-[180px] max-w-xs">
            <svg class="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
            </svg>
            <input
              type="search"
              class="input-field pl-8 text-sm"
              placeholder="# ticket, asunto, reporter…"
              [(ngModel)]="searchText"
              (ngModelChange)="onSearch()"
            />
          </div>

          <!-- Tipo -->
          <select class="input-field text-sm w-36" [(ngModel)]="filterType" (ngModelChange)="reload()">
            <option value="all">Todos los tipos</option>
            <option value="queja_pedido">Queja pedido</option>
            <option value="problema_pago">Problema pago</option>
            <option value="solicitud_reembolso">Sol. reembolso</option>
            <option value="queja_repartidor">Queja repartidor</option>
            <option value="queja_comercio">Queja comercio</option>
            <option value="problema_tecnico">Problema técnico</option>
            <option value="queja_excursion">Queja excursión</option>
            <option value="cancelacion_excursion">Cancelación exc.</option>
            <option value="reporte_fraude">Reporte fraude</option>
            <option value="duda_general">Duda general</option>
            <option value="otro">Otro</option>
          </select>

          <!-- Prioridad -->
          <select class="input-field text-sm w-36" [(ngModel)]="filterPriority" (ngModelChange)="reload()">
            <option value="all">Todas las prioridades</option>
            <option value="urgente">🔴 Urgente</option>
            <option value="alta">🟠 Alta</option>
            <option value="media">🟡 Media</option>
            <option value="baja">🟢 Baja</option>
          </select>

          <!-- Asignado -->
          <select class="input-field text-sm w-40" [(ngModel)]="filterAssigned" (ngModelChange)="reload()">
            <option value="">Todos los agentes</option>
            <option value="unassigned">Sin asignar</option>
            <option value="me">Asignados a mí</option>
          </select>

          <div class="flex-1"></div>

          <!-- Exportar CSV -->
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            [disabled]="loading()"
            (click)="exportCsv()"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exportar CSV
          </button>

          <!-- Ordenar por -->
          <select class="input-field text-sm w-40" [(ngModel)]="sortBy" (ngModelChange)="reload()">
            <option value="recent">Más reciente</option>
            <option value="sla">SLA</option>
            <option value="priority">Prioridad</option>
            <option value="unanswered">Sin respuesta</option>
          </select>
        </div>

        <!-- Content area -->
        <div class="flex flex-1 min-h-0">

          <!-- Ticket list -->
          <div
            class="flex flex-col border-r border-gray-200 bg-white overflow-hidden"
            [class]="activeTicket() ? 'w-80 flex-shrink-0 hidden md:flex' : 'flex-1'"
          >
            <!-- List header with count + pagination info -->
            <div class="flex items-center justify-between px-4 py-2 border-b border-gray-100 flex-shrink-0">
              <p class="text-xs text-gray-500">
                @if (loading()) {
                  Cargando…
                } @else {
                  {{ totalCount() }} ticket{{ totalCount() === 1 ? '' : 's' }}
                }
              </p>
              @if (totalCount() > pageSize) {
                <div class="flex items-center gap-1">
                  <button
                    class="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
                    [disabled]="currentPage() === 1"
                    (click)="goPage(currentPage() - 1)"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span class="text-xs text-gray-500">{{ currentPage() }} / {{ totalPages() }}</span>
                  <button
                    class="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
                    [disabled]="currentPage() === totalPages()"
                    (click)="goPage(currentPage() + 1)"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              }
            </div>

            <!-- Loading skeleton -->
            @if (loading()) {
              <div class="divide-y divide-gray-100 flex-1">
                @for (_ of skeletonRows; track $index) {
                  <div class="px-4 py-3 animate-pulse">
                    <div class="flex gap-3">
                      <div class="flex-1 space-y-2">
                        <div class="h-3 bg-gray-100 rounded w-24"></div>
                        <div class="h-3 bg-gray-100 rounded w-3/4"></div>
                        <div class="h-2.5 bg-gray-100 rounded w-1/2"></div>
                      </div>
                      <div class="space-y-2">
                        <div class="h-4 bg-gray-100 rounded w-16"></div>
                      </div>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="flex-1 overflow-y-auto">
              <app-support-ticket-list
                  [tickets]="tickets()"
                  [loading]="loading()"
                  [selectedTicketId]="activeTicket()?.id ?? null"
                  [activeFilterLabel]="activeQuickFilter()"
                  (ticketSelect)="selectTicket($event)"
                />
              </div>
            }
          </div>

          <!-- Detail panel -->
          @if (activeTicket()) {
            <div class="flex-1 min-w-0 bg-white overflow-hidden flex flex-col">
              <app-support-ticket-detail
                [ticketId]="activeTicket()!.id"
              />
            </div>
          } @else if (!loading() && tickets().length === 0) {
            <!-- Empty state (no detail panel) -->
            <div class="flex-1 flex items-center justify-center px-6">
              <app-admin-empty-state
                icon="search"
                title="Sin tickets para estos filtros"
                description="Prueba ajustando los filtros o creando un ticket nuevo."
                variant="soft" />
            </div>
          }

        </div>
      </div>

    </div>

    <!-- New ticket modal (SA-8.6) -->
    <app-new-ticket-modal
      [isOpen]="showNewTicketModal()"
      (closed)="onNewTicketClosed($event)"
    />
    `,
})
export class SupportPageComponent implements OnInit, OnDestroy {
    private readonly svc = inject(SupportService);

    // ─── State ────────────────────────────────────────────────────────────────

    readonly tickets = this.svc.tickets;
    readonly activeTicket = this.svc.activeTicket;
    readonly loading = this.svc.loadingTickets;

    readonly kpis = signal<SupportKPIs | null>(null);
    readonly totalCount = signal<number>(0);
    readonly currentPage = signal<number>(1);
    readonly sidebarOpen = signal<boolean>(false);
    readonly showNewTicketModal = signal<boolean>(false);

    readonly pageSize = 20;
    readonly skeletonRows = Array(6);

    readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize)));

    // ─── Toolbar state ────────────────────────────────────────────────────────

    searchText = '';
    filterType: TicketType | 'all' = 'all';
    filterPriority: TicketPriority | 'all' = 'all';
    filterAssigned = '';
    sortBy: 'recent' | 'sla' | 'priority' | 'unanswered' = 'recent';

    // ─── Left-panel filter state ──────────────────────────────────────────────

    readonly activeFilters = signal<Partial<TicketFilters>>({});
    readonly activeQuickFilter = signal<string>('all');

    // ─── Status counts (derived from KPI + status breakdown) ─────────────────

    readonly statusCounts = computed(() => {
        const k = this.kpis();
        const empty: Record<string, number> = {};
        if (!k) return empty;
        return {
            abierto: k.open_tickets,
            en_revision: k.in_review,
            esperando_respuesta: k.awaiting_response,
            escalado: k.escalated,
        } as Record<string, number>;
    });

    // ─── Static config ────────────────────────────────────────────────────────

    readonly statusLabels = STATUS_LABELS;
    readonly allStatuses = ALL_STATUSES;

    readonly quickFilters: QuickFilter[] = [
        { label: 'Todos los tickets', icon: '🎫', apply: {} },
        { label: 'Sin asignar', icon: '📥', apply: { assigned_to: 'unassigned' } },
        { label: 'Asignados a mí', icon: '👤', apply: { assigned_to: 'me' } },
        { label: 'SLA vencido', icon: '⚡', badge: 'sla', apply: { sla_breached: true } },
    ];

    readonly reporterTypes = [
        { value: 'cliente' as const, label: 'Clientes', icon: '🧑' },
        { value: 'store_admin' as const, label: 'Comercios', icon: '🏪' },
        { value: 'repartidor' as const, label: 'Repartidores', icon: '🏍️' },
        { value: 'excursion_operator' as const, label: 'Operadores excursiones', icon: '🧭' },
    ];

    readonly priorities = [
        { value: 'urgente' as TicketPriority, label: 'Urgente', icon: '🔴' },
        { value: 'alta' as TicketPriority, label: 'Alta', icon: '🟠' },
        { value: 'media' as TicketPriority, label: 'Media', icon: '🟡' },
        { value: 'baja' as TicketPriority, label: 'Baja', icon: '🟢' },
    ];

    private searchTimeout: ReturnType<typeof setTimeout> | null = null;

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    ngOnInit(): void {
        this.loadKpis();
        this.reload();
        this.svc.watchNewTickets();
    }

    ngOnDestroy(): void {
        this.svc.stopWatchingTickets();
        if (this.searchTimeout) clearTimeout(this.searchTimeout);
    }

    // ─── Data loading ─────────────────────────────────────────────────────────

    private loadKpis(): void {
        this.svc.getKPIs().subscribe({ next: k => this.kpis.set(k) });
    }

    reload(resetPage = false): void {
        if (resetPage) this.currentPage.set(1);
        const extra = this.activeFilters();

        const filters: TicketFilters = {
            page: this.currentPage(),
            page_size: this.pageSize,
            search: this.searchText || undefined,
            type: this.filterType,
            priority: this.filterPriority,
            assigned_to: this.filterAssigned || undefined,
            ...extra,
        };

        this.svc.loadingTickets.set(true);
        this.svc.getTickets(filters).subscribe({
            next: ({ data, count }) => {
                this.svc.tickets.set(data);
                this.totalCount.set(count);
                this.svc.loadingTickets.set(false);
            },
            error: () => this.svc.loadingTickets.set(false),
        });
    }

    // ─── Toolbar actions ──────────────────────────────────────────────────────

    onSearch(): void {
        if (this.searchTimeout) clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => this.reload(true), 300);
    }

    async exportCsv(): Promise<void> {
        const extra = this.activeFilters();
        await this.svc.exportTickets({
            page: 1,
            search: this.searchText || undefined,
            type: this.filterType,
            priority: this.filterPriority,
            assigned_to: this.filterAssigned || undefined,
            ...extra,
        });
    }

    // ─── Left-panel filter actions ────────────────────────────────────────────

    applyQuickFilter(qf: QuickFilter): void {
        this.activeQuickFilter.set(qf.label);
        this.activeFilters.set(qf.apply);
        this.reload(true);
    }

    isQuickFilterActive(qf: QuickFilter): boolean {
        return this.activeQuickFilter() === qf.label;
    }

    setStatus(status: TicketStatus): void {
        this.activeQuickFilter.set('');
        this.activeFilters.update(f => ({ ...f, status }));
        this.reload(true);
    }

    setReporterType(type: string): void {
        this.activeQuickFilter.set('');
        this.activeFilters.update(f => ({ ...f, reporter_type: type as any }));
        this.reload(true);
    }

    setPriority(priority: TicketPriority): void {
        this.activeQuickFilter.set('');
        this.activeFilters.update(f => ({ ...f, priority }));
        this.reload(true);
    }

    // ─── Ticket selection ─────────────────────────────────────────────────────

    selectTicket(ticketId: string): void {
        this.svc.loadingMessages.set(true);
        this.svc.getTicketById(ticketId).subscribe({
            next: detail => {
                this.svc.activeTicket.set(detail);
                this.svc.messages.set(detail.messages);
                this.svc.watchNewMessages(ticketId);
                this.svc.loadingMessages.set(false);
                this.sidebarOpen.set(false);
            },
            error: () => this.svc.loadingMessages.set(false),
        });
    }

    goPage(page: number): void {
        this.currentPage.set(page);
        this.reload();
    }

    openNewTicketModal(): void {
        this.showNewTicketModal.set(true);
    }

    onNewTicketClosed(ticket: SupportTicket | null): void {
        this.showNewTicketModal.set(false);
        if (ticket) {
            this.reload(true);
            this.loadKpis();
        }
    }
}
