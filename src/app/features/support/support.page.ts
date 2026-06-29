import {
    Component, OnInit, OnDestroy, inject, signal, computed,
    Input, Output, EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
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
    @if (sidebarOpen()) {
      <div class="fixed inset-0 bg-black/40 z-30 xl:hidden" (click)="sidebarOpen.set(false)"></div>
    }

    <div class="-mx-6 -mt-6 min-h-[calc(100vh-64px)] bg-[var(--admin-bg)] p-4 md:p-6">
      <div class="admin-panel-card p-5 md:p-6 mb-5 bg-gradient-to-r from-white to-[#fff2fa]">
        <div class="flex flex-col xl:flex-row xl:items-start gap-4">
          <div class="min-w-0 flex-1">
            <span class="inline-flex items-center rounded-full bg-[#fce7f3] text-[#be185d] text-xs font-semibold px-3 py-1">
              Governance · Support Center
            </span>
            <h1 class="text-3xl font-extrabold tracking-tight text-gray-900 mt-2">Soporte</h1>
            <p class="text-[17px] text-gray-600 max-w-3xl mt-2">
              Gestiona tickets de clientes, comercios, repartidores y operadores desde un centro de soporte global, priorizado y accionable.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2 xl:justify-end">
            <button class="admin-btn admin-btn--secondary" (click)="exportCsv()" [disabled]="loading()">Exportar CSV</button>
            <button class="admin-btn admin-btn--secondary" [disabled]="!activeTicket()" (click)="assignSelectedToMe()">Asignar agente</button>
            <button class="admin-btn admin-btn--primary" (click)="openNewTicketModal()">Crear ticket</button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)_340px] gap-4 xl:gap-5 min-h-[calc(100vh-230px)]">
        <aside
          class="admin-panel-card bg-white overflow-hidden fixed xl:relative inset-y-0 left-0 z-40 xl:z-auto w-[320px] xl:w-auto transition-transform duration-200"
          [class.-translate-x-full]="!sidebarOpen()"
          [class.translate-x-0]="sidebarOpen()"
          [class.xl:translate-x-0]="true">

          <div class="p-4 border-b border-gray-100">
            <div class="flex items-center justify-between gap-2">
              <div>
                <h2 class="text-[32px] leading-none font-black text-gray-900">{{ totalCount() }}</h2>
                <p class="text-sm text-gray-500">Tickets activos</p>
              </div>
              <div class="flex gap-2">
                <a routerLink="/support-dashboard" class="admin-icon-btn" aria-label="Ir al dashboard de soporte">◫</a>
                <a routerLink="/support/templates" class="admin-icon-btn" aria-label="Ir a plantillas de soporte">☰</a>
              </div>
            </div>
          </div>

          <div class="p-4 border-b border-gray-100">
            <div class="grid grid-cols-2 gap-2">
              <div class="rounded-3xl bg-[#fde7e7] px-4 py-3">
                <p class="text-3xl font-black text-[#b42318] leading-none">{{ kpis()?.open_tickets ?? 0 }}</p>
                <p class="text-sm font-semibold text-[#b42318] mt-1">Abiertos</p>
              </div>
              <div class="rounded-3xl bg-[#efe8cc] px-4 py-3">
                <p class="text-3xl font-black text-[#8a5b00] leading-none">{{ kpis()?.in_review ?? 0 }}</p>
                <p class="text-sm font-semibold text-[#8a5b00] mt-1">En revisión</p>
              </div>
              <div class="rounded-3xl bg-[#fff3e2] px-4 py-3">
                <p class="text-3xl font-black text-[#e46300] leading-none">{{ kpis()?.sla_breached_open ?? 0 }}</p>
                <p class="text-sm font-semibold text-[#e46300] mt-1">SLA vencido</p>
              </div>
              <div class="rounded-3xl bg-[#e8f4ee] px-4 py-3">
                <p class="text-3xl font-black text-[#067647] leading-none">{{ kpis()?.resolved_today ?? 0 }}</p>
                <p class="text-sm font-semibold text-[#067647] mt-1">Resueltos hoy</p>
              </div>
            </div>
          </div>

          <nav class="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-420px)]">
            @for (qf of quickFilters; track qf.label) {
              <button
                class="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-left transition-colors"
                [class]="isQuickFilterActive(qf) ? 'bg-[#0f172a] text-white font-semibold' : 'text-gray-700 hover:bg-gray-50'"
                (click)="applyQuickFilter(qf)">
                <span class="inline-flex items-center gap-2.5 text-base">
                  @if (qf.icon) { <span>{{ qf.icon }}</span> }
                  {{ qf.label }}
                </span>
                <span class="text-sm font-bold opacity-80">
                  @if (qf.label === 'Todos los tickets') { {{ totalCount() }} }
                  @else if (qf.label === 'SLA vencido') { {{ kpis()?.sla_breached_open ?? 0 }} }
                  @else if (qf.label === 'Sin asignar') { {{ queueCountUnassigned() }} }
                  @else if (qf.label === 'Asignados a mí') { {{ queueCountMine() }} }
                </span>
              </button>
            }

            <p class="px-3 pt-4 pb-1 text-[11px] uppercase tracking-[.16em] text-gray-400 font-semibold">Por estado</p>
            @for (st of allStatuses; track st) {
              <button
                class="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-left transition-colors"
                [class]="activeFilters().status === st ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'"
                (click)="setStatus(st)">
                <span>{{ statusLabels[st] }}</span>
                <span class="text-sm text-gray-400">{{ statusCounts()[st] }}</span>
              </button>
            }

            <p class="px-3 pt-4 pb-1 text-[11px] uppercase tracking-[.16em] text-gray-400 font-semibold">Por reporter</p>
            @for (rt of reporterTypes; track rt.value) {
              <button
                class="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-left transition-colors"
                [class]="activeFilters().reporter_type === rt.value ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'"
                (click)="setReporterType(rt.value)">
                <span class="inline-flex items-center gap-2">{{ rt.icon }} {{ rt.label }}</span>
                <span class="text-sm text-gray-400">{{ reporterTypeCounts()[rt.value] }}</span>
              </button>
            }
          </nav>
        </aside>

        <section class="min-w-0 flex flex-col gap-4">
          <div class="admin-panel-card p-4 md:p-5">
            <div class="flex flex-col lg:flex-row lg:items-center gap-3">
              <button class="xl:hidden admin-icon-btn" (click)="sidebarOpen.set(true)" aria-label="Abrir panel de resumen">☰</button>
              <div class="relative flex-1 min-w-[220px]">
                <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
                </svg>
                <input
                  type="search"
                  class="input-field pl-9"
                  placeholder="Buscar por ticket, asunto, reporter o comercio..."
                  [(ngModel)]="searchText"
                  (ngModelChange)="onSearch()" />
              </div>
              <button class="admin-btn admin-btn--secondary" (click)="exportCsv()" [disabled]="loading()">Exportar CSV</button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5 mt-3">
              <select class="input-field text-sm" [(ngModel)]="filterType" (ngModelChange)="reload()">
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
              <select class="input-field text-sm" [(ngModel)]="filterPriority" (ngModelChange)="reload()">
                <option value="all">Todas las prioridades</option>
                <option value="urgente">Urgente</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
              <select class="input-field text-sm" [(ngModel)]="filterAssigned" (ngModelChange)="reload()">
                <option value="">Todos los agentes</option>
                <option value="unassigned">Sin asignar</option>
                <option value="me">Asignados a mí</option>
              </select>
              <select class="input-field text-sm" [(ngModel)]="sortBy" (ngModelChange)="reload()">
                <option value="recent">Más reciente</option>
                <option value="sla">SLA</option>
                <option value="priority">Prioridad</option>
                <option value="unanswered">Sin respuesta</option>
              </select>
            </div>

            <div class="flex flex-wrap items-center gap-2 mt-3">
              <button class="admin-chip" [class.admin-chip--active]="activeQuickFilter() === 'Todos los tickets'" (click)="applyQuickFilter(quickFilters[0])">Todos {{ totalCount() }}</button>
              <button class="admin-chip" [class.admin-chip--active]="activeFilters().status === 'abierto'" (click)="setStatus('abierto')">Abiertos {{ kpis()?.open_tickets ?? 0 }}</button>
              <button class="admin-chip" [class.admin-chip--active]="activeFilters().sla_breached === true" (click)="applyQuickFilter(quickFilters[3])">SLA vencido {{ kpis()?.sla_breached_open ?? 0 }}</button>
              <button class="admin-chip" [class.admin-chip--active]="activeFilters().assigned_to === 'unassigned'" (click)="applyQuickFilter(quickFilters[1])">Sin asignar {{ queueCountUnassigned() }}</button>
              <button class="admin-chip" [class.admin-chip--active]="activeFilters().status === 'resuelto'" (click)="setStatus('resuelto')">Resueltos hoy {{ kpis()?.resolved_today ?? 0 }}</button>
            </div>
          </div>

          <div class="admin-panel-card flex-1 overflow-hidden min-h-[420px]">
            <div class="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <div>
                <h3 class="text-[34px] font-black text-gray-900 leading-none">Tickets</h3>
                <p class="text-lg text-gray-500 mt-1">{{ totalCount() }} ticket{{ totalCount() === 1 ? '' : 's' }} encontrados</p>
              </div>
              <div class="flex items-center gap-2">
                @if (totalCount() > pageSize) {
                  <button class="admin-icon-btn" [disabled]="currentPage() === 1" (click)="goPage(currentPage() - 1)" aria-label="Página anterior">‹</button>
                  <span class="text-sm text-gray-500">{{ currentPage() }} / {{ totalPages() }}</span>
                  <button class="admin-icon-btn" [disabled]="currentPage() === totalPages()" (click)="goPage(currentPage() + 1)" aria-label="Página siguiente">›</button>
                }
              </div>
            </div>
            <div class="h-[calc(100vh-470px)] min-h-[320px] overflow-y-auto">
              <app-support-ticket-list
                [tickets]="tickets()"
                [loading]="loading()"
                [selectedTicketId]="activeTicket()?.id ?? null"
                [activeFilterLabel]="activeQuickFilter()"
                (ticketSelect)="selectTicket($event)" />
            </div>
          </div>
        </section>

        <aside class="admin-panel-card bg-white overflow-hidden min-h-[420px]">
          @if (activeTicket()) {
            <div class="p-5 border-b border-gray-100 space-y-3">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold" [class]="statusChipClass(activeTicket()!.status)">
                  {{ statusLabels[activeTicket()!.status] }}
                </span>
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold" [class]="priorityChipClass(activeTicket()!.priority)">
                  {{ priorityLabel(activeTicket()!.priority) }}
                </span>
              </div>
              <h3 class="text-[40px] leading-[1.02] tracking-tight font-black text-gray-900">{{ activeTicket()!.subject }}</h3>
              <p class="text-[28px] leading-tight text-gray-600">{{ activeTicket()!.description }}</p>
              <div class="grid grid-cols-2 gap-2 pt-2">
                <button class="admin-btn admin-btn--secondary" (click)="assignSelectedToMe()">Asignar</button>
                <button class="admin-btn admin-btn--primary" (click)="openDetailWorkspace()">Responder</button>
              </div>
            </div>

            <div class="p-5 border-b border-gray-100">
              <dl class="space-y-3 text-sm">
                <div class="flex items-center justify-between gap-3">
                  <dt class="text-gray-400 font-semibold">Ticket</dt>
                  <dd class="font-bold text-gray-900">{{ activeTicket()!.ticket_number }}</dd>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <dt class="text-gray-400 font-semibold">Reporter</dt>
                  <dd class="font-bold text-gray-900">{{ reporterTypeLabel(activeTicket()!.reporter_type) }}</dd>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <dt class="text-gray-400 font-semibold">Comercio</dt>
                  <dd class="font-bold text-gray-900">{{ activeTicket()!.store?.name ?? '—' }}</dd>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <dt class="text-gray-400 font-semibold">Asignado a</dt>
                  <dd class="font-bold text-gray-900">{{ activeTicket()!.assigned_to?.full_name ?? 'Sin asignar' }}</dd>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <dt class="text-gray-400 font-semibold">SLA</dt>
                  <dd class="font-bold" [class.text-red-600]="activeTicket()!.sla_breached">{{ activeTicket()!.sla_breached ? 'Vencido' : 'En tiempo' }}</dd>
                </div>
              </dl>
            </div>

            <div class="p-5">
              <h4 class="text-xl font-black text-gray-900 mb-4">Actividad reciente</h4>
              <ol class="space-y-4">
                <li class="flex gap-3">
                  <span class="w-8 h-8 rounded-full bg-[#f9d7ea] text-[#be185d] text-sm font-bold grid place-items-center flex-shrink-0">1</span>
                  <div>
                    <p class="text-base font-bold text-gray-900">Ticket creado</p>
                    <p class="text-sm text-gray-400">{{ activeTicket()!.created_at | date:'dd/MM/yyyy HH:mm' }}</p>
                  </div>
                </li>
                @for (msg of recentMessages(); track msg.id; let idx = $index) {
                  <li class="flex gap-3">
                    <span class="w-8 h-8 rounded-full bg-[#f9d7ea] text-[#be185d] text-sm font-bold grid place-items-center flex-shrink-0">{{ idx + 2 }}</span>
                    <div>
                      <p class="text-base font-bold text-gray-900 line-clamp-1">{{ msg.sender_role === 'sistema' ? 'Actualización de sistema' : 'Nueva actividad' }}</p>
                      <p class="text-sm text-gray-500 line-clamp-2">{{ msg.message }}</p>
                      <p class="text-sm text-gray-400">{{ msg.created_at | date:'dd/MM/yyyy HH:mm' }}</p>
                    </div>
                  </li>
                }
              </ol>
            </div>
          } @else {
            <div class="h-full min-h-[420px] flex items-center justify-center p-6">
              <app-admin-empty-state
                icon="search"
                title="Selecciona un ticket"
                description="El detalle operativo, SLA y actividad reciente aparecerán aquí."
                variant="soft" />
            </div>
          }
        </aside>
      </div>
    </div>

    @if (showDetailWorkspace() && activeTicket()) {
      <div class="fixed inset-0 z-50 bg-black/50 p-3 md:p-6">
        <div class="h-full w-full max-w-[1500px] mx-auto admin-modal bg-white">
          <div class="admin-modal__header flex items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-gray-900">Ticket workspace</h3>
              <p class="text-sm text-gray-500">{{ activeTicket()!.ticket_number }} · {{ activeTicket()!.subject }}</p>
            </div>
            <button class="admin-icon-btn" aria-label="Cerrar detalle del ticket" (click)="closeDetailWorkspace()">✕</button>
          </div>
          <div class="admin-modal__body p-0 h-[calc(100%-76px)]">
            <app-support-ticket-detail [ticketId]="activeTicket()!.id" />
          </div>
        </div>
      </div>
    }

    <app-new-ticket-modal
      [isOpen]="showNewTicketModal()"
      (closed)="onNewTicketClosed($event)"
    />
    `,
})
export class SupportPageComponent implements OnInit, OnDestroy {
    private readonly svc = inject(SupportService);
    private readonly auth = inject(AuthService);

    // ─── State ────────────────────────────────────────────────────────────────

    readonly tickets = this.svc.tickets;
    readonly activeTicket = this.svc.activeTicket;
    readonly loading = this.svc.loadingTickets;

    readonly kpis = signal<SupportKPIs | null>(null);
    readonly totalCount = signal<number>(0);
    readonly currentPage = signal<number>(1);
    readonly sidebarOpen = signal<boolean>(false);
    readonly showNewTicketModal = signal<boolean>(false);
    readonly showDetailWorkspace = signal<boolean>(false);

    readonly pageSize = 20;
    readonly skeletonRows = Array(6);

    readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize)));
    readonly recentMessages = computed(() => [...this.svc.messages()].slice(-3).reverse());
    readonly reporterTypeCounts = computed(() => {
        const rows = this.kpis()?.by_reporter_type ?? [];
        const counts: Record<string, number> = {
            cliente: 0,
            store_admin: 0,
            repartidor: 0,
            excursion_operator: 0,
        };
        for (const row of rows) counts[row.reporter_type] = row.count;
        return counts;
    });

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

    openDetailWorkspace(): void {
        if (!this.activeTicket()) return;
        this.showDetailWorkspace.set(true);
    }

    closeDetailWorkspace(): void {
        this.showDetailWorkspace.set(false);
    }

    async assignSelectedToMe(): Promise<void> {
        const ticket = this.activeTicket();
        const me = this.auth.currentUser();
        if (!ticket || !me?.id) return;
        await this.svc.assignTicket(ticket.id, me.id);
        this.reload();
        this.selectTicket(ticket.id);
    }

    queueCountUnassigned(): number {
        return this.tickets().filter(t => !t.assigned_to).length;
    }

    queueCountMine(): number {
        const me = this.auth.currentUser()?.id;
        if (!me) return 0;
        return this.tickets().filter(t => t.assigned_to?.id === me).length;
    }

    reporterTypeLabel(value: string): string {
        const map: Record<string, string> = {
            cliente: 'Cliente',
            store_admin: 'Comercio',
            repartidor: 'Repartidor',
            excursion_operator: 'Operador',
        };
        return map[value] ?? value;
    }

    statusChipClass(status: TicketStatus): string {
        const map: Record<TicketStatus, string> = {
            abierto: 'bg-red-100 text-red-700',
            en_revision: 'bg-yellow-100 text-yellow-700',
            esperando_respuesta: 'bg-gray-100 text-gray-700',
            escalado: 'bg-orange-100 text-orange-700',
            resuelto: 'bg-green-100 text-green-700',
            cerrado: 'bg-slate-100 text-slate-700',
        };
        return map[status] ?? 'bg-gray-100 text-gray-700';
    }

    priorityChipClass(priority: TicketPriority): string {
        const map: Record<TicketPriority, string> = {
            urgente: 'bg-red-100 text-red-800',
            alta: 'bg-yellow-100 text-yellow-800',
            media: 'bg-blue-100 text-blue-800',
            baja: 'bg-gray-100 text-gray-700',
        };
        return map[priority] ?? 'bg-gray-100 text-gray-700';
    }

    priorityLabel(priority: TicketPriority): string {
        const map: Record<TicketPriority, string> = {
            urgente: 'Urgente',
            alta: 'Alta prioridad',
            media: 'Media prioridad',
            baja: 'Baja prioridad',
        };
        return map[priority] ?? priority;
    }

    onNewTicketClosed(ticket: SupportTicket | null): void {
        this.showNewTicketModal.set(false);
        if (ticket) {
            this.reload(true);
            this.loadKpis();
        }
    }
}
