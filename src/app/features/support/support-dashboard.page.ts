import {
    Component, OnInit, AfterViewInit, OnDestroy,
    ViewChild, ElementRef, inject, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import {
    SupportService, SupportKPIs, TicketVolumeDay,
    TypeStats, AgentPerformance, BreachedTicketRow, TicketType,
} from './services/support.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { StatCardComponent } from '../../shared/ui/stat-card/stat-card.component';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';

Chart.register(...registerables);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Partial<Record<string, string>> = {
    pedido: 'Pedido', pago: 'Pago', repartidor: 'Repartidor',
    comercio: 'Comercio', cuenta: 'Cuenta', excursion: 'Excursión', otro: 'Otro',
};

const TYPE_COLORS: Partial<Record<string, string>> = {
    pedido:     '#EF4444',
    pago:       '#F59E0B',
    repartidor: '#8B5CF6',
    comercio:   '#3B82F6',
    cuenta:     '#10B981',
    excursion:  '#06B6D4',
    otro:       '#9CA3AF',
};

const DONUT_COLORS = ['#3B82F6', '#F59E0B', '#8B5CF6', '#10B981', '#EF4444'];

const REPORTER_LABELS: Record<string, string> = {
    cliente: 'Clientes', store_admin: 'Comercios',
    repartidor: 'Repartidores', excursion_operator: 'Operadores',
};

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
    selector: 'app-support-dashboard',
    standalone: true,
    imports: [CommonModule, RouterLink, StatCardComponent, PageHeaderComponent],
    template: `
    <app-page-header title="Dashboard de Soporte" subtitle="Métricas y KPIs del equipo de soporte">
      <a routerLink="/support"
         class="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
        ← Ver tickets
      </a>
      <a routerLink="/support/templates"
         class="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
        📝 Plantillas
      </a>
    </app-page-header>

    <!-- ═══ Row 1: KPI Cards ═════════════════════════════════════════════════ -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <app-stat-card
        title="Tickets abiertos hoy"
        [value]="kpis()?.open_tickets ?? '—'"
        icon="📬"
        color="blue"
        trend="neutral"
        [subtitle]="openedTodaySubtitle()"
      />
      <app-stat-card
        title="SLA vencidos sin resolver"
        [value]="kpis()?.sla_breached_open ?? '—'"
        icon="⚡"
        [color]="(kpis()?.sla_breached_open ?? 0) > 0 ? 'red' : 'green'"
        trend="neutral"
        subtitle="requieren atención inmediata"
        [pulse]="(kpis()?.sla_breached_open ?? 0) > 0"
      />
      <app-stat-card
        title="1ra respuesta promedio"
        [value]="avgResponseLabel()"
        icon="⏱"
        color="yellow"
        trend="neutral"
        subtitle="tiempo hasta primera resp."
      />
      <app-stat-card
        title="Satisfacción promedio"
        [value]="satisfactionLabel()"
        icon="⭐"
        color="purple"
        trend="neutral"
        subtitle="score de 1 a 5 estrellas"
      />
    </div>

    <!-- ═══ Row 2: Charts ════════════════════════════════════════════════════ -->
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">

      <!-- Volume chart (60%) -->
      <div class="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-theme-sm p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-gray-800">Volumen de tickets</h2>
          <div class="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
            @for (p of periodPresets; track p.days) {
              <button
                class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
                [class]="activePeriod() === p.days
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'"
                (click)="setPeriod(p.days)"
              >{{ p.label }}</button>
            }
          </div>
        </div>
        @if (loadingVolume()) {
          <div class="animate-pulse h-48 bg-gray-100 rounded-lg"></div>
        } @else {
          <div class="relative" style="height:200px">
            <canvas #volumeChart></canvas>
          </div>
          <!-- Legend -->
          <div class="flex flex-wrap gap-3 mt-3">
            @for (t of usedTypes(); track t) {
              <div class="flex items-center gap-1.5 text-xs text-gray-600">
                <span class="w-2.5 h-2.5 rounded-sm flex-shrink-0" [style.background-color]="typeColors[t]"></span>
                {{ typeLabels[t] ?? t }}
              </div>
            }
          </div>
        }
      </div>

      <!-- Donut chart (40%) -->
      <div class="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-theme-sm p-5">
        <h2 class="text-sm font-semibold text-gray-800 mb-4">Por tipo de reporter</h2>
        @if (loadingKpis()) {
          <div class="animate-pulse h-48 bg-gray-100 rounded-lg"></div>
        } @else {
          <div class="flex items-center gap-6">
            <!-- SVG Donut -->
            <div class="relative flex-shrink-0" style="width:140px;height:140px">
              <svg viewBox="0 0 36 36" class="w-full h-full -rotate-90">
                @for (slice of donutSlices(); track slice.label; let i = $index) {
                  <circle cx="18" cy="18" r="15.9154943"
                    fill="none"
                    [attr.stroke]="donutColors[i % donutColors.length]"
                    stroke-width="5"
                    [attr.stroke-dasharray]="slice.dash"
                    [attr.stroke-dashoffset]="slice.offset"
                  />
                }
              </svg>
              <div class="absolute inset-0 flex items-center justify-center">
                <div class="text-center">
                  <p class="text-xl font-bold text-gray-800">{{ totalReporterCount() }}</p>
                  <p class="text-[10px] text-gray-400">tickets</p>
                </div>
              </div>
            </div>
            <!-- Legend -->
            <div class="flex flex-col gap-2.5 flex-1 min-w-0">
              @for (slice of donutSlices(); track slice.label; let i = $index) {
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        [style.background-color]="donutColors[i % donutColors.length]"></span>
                  <span class="text-xs text-gray-600 flex-1 truncate">{{ slice.label }}</span>
                  <span class="text-xs font-semibold text-gray-800">{{ slice.pct }}%</span>
                </div>
              }
            </div>
          </div>
        }
      </div>
    </div>

    <!-- ═══ Row 3: SLA breached tickets ══════════════════════════════════════ -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-theme-sm mb-6 overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div class="flex items-center gap-2">
          <h2 class="text-sm font-semibold text-gray-800">Tickets con SLA vencido</h2>
          @if (breachedTickets().length > 0) {
            <span class="text-xs px-2 py-0.5 rounded-full bg-error-100 text-error-700 font-semibold animate-pulse">
              {{ breachedTickets().length }}
            </span>
          }
        </div>
        @if (loadingBreached()) {
          <span class="text-xs text-gray-400">Cargando…</span>
        }
      </div>

      @if (loadingBreached()) {
        <div class="divide-y divide-gray-100">
          @for (_ of [1,2,3]; track $index) {
            <div class="px-5 py-3 animate-pulse flex gap-4">
              <div class="h-3 bg-gray-100 rounded w-20"></div>
              <div class="h-3 bg-gray-100 rounded w-32"></div>
              <div class="h-3 bg-gray-100 rounded flex-1"></div>
            </div>
          }
        </div>
      } @else if (breachedTickets().length === 0) {
        <div class="flex flex-col items-center justify-center py-10 text-gray-400">
          <span class="text-3xl mb-2">🎉</span>
          <p class="text-sm font-medium text-gray-600">Sin tickets con SLA vencido</p>
          <p class="text-xs mt-1">Todo el equipo está respondiendo a tiempo.</p>
        </div>
      } @else {
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm divide-y divide-gray-100">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase"># Ticket</th>
                <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reporter</th>
                <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Vencido hace</th>
                <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Asignado</th>
                <th class="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (t of breachedTickets(); track t.id) {
                <tr class="bg-error-50/40 hover:bg-error-50 transition-colors">
                  <td class="px-5 py-3 font-mono text-xs text-gray-500">{{ t.ticket_number }}</td>
                  <td class="px-5 py-3">
                    <span class="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{{ typeLabels[t.type] ?? t.type }}</span>
                  </td>
                  <td class="px-5 py-3">
                    <p class="font-medium text-gray-800 text-xs">{{ t.reporter.full_name }}</p>
                    <p class="text-[11px] text-gray-400">{{ t.reporter.email }}</p>
                  </td>
                  <td class="px-5 py-3">
                    <span class="text-xs font-semibold text-error-600">
                      {{ t.overdue_hours }}h {{ t.overdue_hours === 1 ? 'atrás' : 'atrás' }}
                    </span>
                  </td>
                  <td class="px-5 py-3 text-xs text-gray-600">
                    {{ t.assigned_to?.full_name ?? '—' }}
                  </td>
                  <td class="px-5 py-3 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button
                        class="px-2.5 py-1 rounded-lg border border-blue-200 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                        [disabled]="savingTicket() === t.id"
                        (click)="takeTicket(t)"
                      >Tomar</button>
                      <button
                        class="px-2.5 py-1 rounded-lg border border-success-200 text-xs font-medium text-success-700 hover:bg-success-50 transition-colors"
                        [disabled]="savingTicket() === t.id"
                        (click)="resolveTicket(t)"
                      >Resolver</button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <!-- ═══ Row 4: Top ticket types ══════════════════════════════════════════ -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-theme-sm mb-6 overflow-hidden">
      <div class="px-5 py-4 border-b border-gray-100">
        <h2 class="text-sm font-semibold text-gray-800">Tipos de ticket</h2>
      </div>
      @if (loadingTypes()) {
        <div class="animate-pulse p-5 space-y-3">
          @for (_ of [1,2,3]; track $index) {
            <div class="h-8 bg-gray-100 rounded"></div>
          }
        </div>
      } @else {
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm divide-y divide-gray-100">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                <th class="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
                <th class="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">% del total</th>
                <th class="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Tiempo prom. resolución</th>
                <th class="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Satisfacción</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (row of typeStats(); track row.type) {
                <tr class="hover:bg-gray-50 transition-colors"
                    [class.bg-orange-50]="row.avg_resolution_hours > 24 || (row.satisfaction_avg > 0 && row.satisfaction_avg < 3)">
                  <td class="px-5 py-3">
                    <div class="flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            [style.background-color]="typeColors[row.type] ?? '#9CA3AF'"></span>
                      <span class="font-medium text-gray-800">{{ typeLabels[row.type] ?? row.type }}</span>
                      @if (row.avg_resolution_hours > 24) {
                        <span class="text-[10px] text-orange-600 font-semibold">⚠ Lento</span>
                      }
                      @if (row.satisfaction_avg > 0 && row.satisfaction_avg < 3) {
                        <span class="text-[10px] text-error-600 font-semibold">★ Bajo</span>
                      }
                    </div>
                  </td>
                  <td class="px-5 py-3 text-right font-semibold text-gray-800">{{ row.count }}</td>
                  <td class="px-5 py-3 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <div class="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div class="h-1.5 rounded-full" [style.width.%]="row.pct"
                             [style.background-color]="typeColors[row.type] ?? '#9CA3AF'"></div>
                      </div>
                      <span class="text-gray-600 w-8 text-right">{{ row.pct }}%</span>
                    </div>
                  </td>
                  <td class="px-5 py-3 text-right" [class.text-orange-600]="row.avg_resolution_hours > 24">
                    {{ row.avg_resolution_hours ? row.avg_resolution_hours + 'h' : '—' }}
                  </td>
                  <td class="px-5 py-3 text-right">
                    @if (row.satisfaction_avg > 0) {
                      <span [class.text-success-600]="row.satisfaction_avg >= 4"
                            [class.text-orange-500]="row.satisfaction_avg >= 3 && row.satisfaction_avg < 4"
                            [class.text-error-600]="row.satisfaction_avg < 3">
                        ⭐ {{ row.satisfaction_avg }}
                      </span>
                    } @else {
                      <span class="text-gray-300">—</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="px-5 py-10 text-center text-gray-400">Sin datos</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <!-- ═══ Row 5: Agent performance (super_admin only) ══════════════════════ -->
    @if (isSuperAdmin()) {
      <div class="bg-white rounded-xl border border-gray-200 shadow-theme-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100">
          <h2 class="text-sm font-semibold text-gray-800">Rendimiento de agentes</h2>
        </div>
        @if (loadingAgents()) {
          <div class="animate-pulse p-5 space-y-3">
            @for (_ of [1,2,3]; track $index) {
              <div class="h-10 bg-gray-100 rounded"></div>
            }
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm divide-y divide-gray-100">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Agente</th>
                  <th class="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Asignados</th>
                  <th class="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Resueltos hoy</th>
                  <th class="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Tiempo prom.</th>
                  <th class="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Satisfacción</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                @for (agent of agents(); track agent.agent_id) {
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-5 py-3">
                      <div class="flex items-center gap-2.5">
                        <div class="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-[10px] font-bold text-primary-700 flex-shrink-0">
                          {{ agentInitials(agent.full_name) }}
                        </div>
                        <span class="font-medium text-gray-800">{{ agent.full_name }}</span>
                      </div>
                    </td>
                    <td class="px-5 py-3 text-right text-gray-700 font-semibold">{{ agent.assigned_count }}</td>
                    <td class="px-5 py-3 text-right">
                      <span class="font-semibold" [class.text-success-600]="agent.resolved_today > 0" [class.text-gray-400]="agent.resolved_today === 0">
                        {{ agent.resolved_today }}
                      </span>
                    </td>
                    <td class="px-5 py-3 text-right text-gray-600">
                      {{ agent.avg_resolution_hours ? agent.avg_resolution_hours + 'h' : '—' }}
                    </td>
                    <td class="px-5 py-3 text-right">
                      @if (agent.satisfaction_avg > 0) {
                        <span [class.text-success-600]="agent.satisfaction_avg >= 4"
                              [class.text-orange-500]="agent.satisfaction_avg >= 3 && agent.satisfaction_avg < 4"
                              [class.text-error-600]="agent.satisfaction_avg < 3">
                          ⭐ {{ agent.satisfaction_avg }}
                        </span>
                      } @else {
                        <span class="text-gray-300">—</span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="px-5 py-10 text-center text-gray-400">Sin agentes asignados aún</td></tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    }
    `,
})
export class SupportDashboardPageComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('volumeChart') volumeChartRef?: ElementRef<HTMLCanvasElement>;

    private readonly svc = inject(SupportService);
    private readonly auth = inject(AuthService);
    private readonly toast = inject(ToastService);

    // ─── State ────────────────────────────────────────────────────────────────

    readonly kpis = signal<SupportKPIs | null>(null);
    readonly volumeData = signal<TicketVolumeDay[]>([]);
    readonly breachedTickets = signal<BreachedTicketRow[]>([]);
    readonly typeStats = signal<TypeStats[]>([]);
    readonly agents = signal<AgentPerformance[]>([]);

    readonly loadingKpis    = signal(true);
    readonly loadingVolume  = signal(true);
    readonly loadingBreached = signal(true);
    readonly loadingTypes   = signal(true);
    readonly loadingAgents  = signal(false);
    readonly savingTicket   = signal<string | null>(null);

    readonly activePeriod = signal<7 | 30 | 90>(30);

    // ─── Computed ─────────────────────────────────────────────────────────────

    readonly isSuperAdmin = computed(() => this.auth.userRole() === 'super_admin');

    readonly avgResponseLabel = computed(() => {
        const k = this.kpis();
        if (!k) return '—';
        return k.avg_resolution_hours > 0 ? `${k.avg_resolution_hours}h` : '—';
    });

    readonly satisfactionLabel = computed(() => {
        const k = this.kpis();
        if (!k || !k.satisfaction_avg) return '—';
        return `${k.satisfaction_avg} / 5`;
    });

    readonly openedTodaySubtitle = computed(() => {
        const k = this.kpis();
        if (!k) return '';
        return `${k.in_review} en revisión · ${k.awaiting_response} esperando`;
    });

    readonly usedTypes = computed(() => {
        const types = new Set<string>();
        for (const day of this.volumeData()) {
            Object.keys(day.by_type).forEach(t => types.add(t));
        }
        return [...types] as TicketType[];
    });

    readonly donutSlices = computed(() => {
        const k = this.kpis();
        if (!k?.by_reporter_type?.length) return [];
        const total = k.by_reporter_type.reduce((s, r) => s + r.count, 0) || 1;
        const circumference = 100;
        let offset = 0;
        return k.by_reporter_type.map(r => {
            const pct = Math.round((r.count / total) * 100);
            const dash = (r.count / total) * circumference;
            const slice = {
                label: REPORTER_LABELS[r.reporter_type] ?? r.reporter_type,
                pct,
                dash: `${dash} ${circumference - dash}`,
                offset: -offset,
            };
            offset += dash;
            return slice;
        });
    });

    readonly totalReporterCount = computed(() =>
        this.kpis()?.by_reporter_type.reduce((s, r) => s + r.count, 0) ?? 0
    );

    // ─── Static config ────────────────────────────────────────────────────────

    readonly typeColors = TYPE_COLORS;
    readonly typeLabels = TYPE_LABELS;
    readonly donutColors = DONUT_COLORS;

    readonly periodPresets: { label: string; days: 7 | 30 | 90 }[] = [
        { label: '7 días', days: 7 },
        { label: '30 días', days: 30 },
        { label: '3 meses', days: 90 },
    ];

    private chart: Chart | null = null;
    private chartRendered = false;

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    ngOnInit(): void {
        this.loadAll();
    }

    ngAfterViewInit(): void {
        if (!this.loadingVolume()) this.renderChart();
    }

    ngOnDestroy(): void {
        this.chart?.destroy();
    }

    // ─── Data loading ─────────────────────────────────────────────────────────

    private loadAll(): void {
        this.loadKpis();
        this.loadVolume();
        this.loadBreached();
        this.loadTypes();
        if (this.isSuperAdmin()) this.loadAgents();
    }

    private loadKpis(): void {
        this.svc.getKPIs().subscribe({
            next: k => { this.kpis.set(k); this.loadingKpis.set(false); },
            error: () => this.loadingKpis.set(false),
        });
    }

    private loadVolume(): void {
        this.loadingVolume.set(true);
        this.svc.getTicketVolumeByDay(this.activePeriod()).subscribe({
            next: d => {
                this.volumeData.set(d);
                this.loadingVolume.set(false);
                setTimeout(() => this.renderChart(), 0);
            },
            error: () => this.loadingVolume.set(false),
        });
    }

    private loadBreached(): void {
        this.svc.getBreachedTickets().subscribe({
            next: d => { this.breachedTickets.set(d); this.loadingBreached.set(false); },
            error: () => this.loadingBreached.set(false),
        });
    }

    private loadTypes(): void {
        this.svc.getTypeStats().subscribe({
            next: d => { this.typeStats.set(d); this.loadingTypes.set(false); },
            error: () => this.loadingTypes.set(false),
        });
    }

    private loadAgents(): void {
        this.loadingAgents.set(true);
        this.svc.getAgentPerformance().subscribe({
            next: d => { this.agents.set(d); this.loadingAgents.set(false); },
            error: () => this.loadingAgents.set(false),
        });
    }

    setPeriod(days: 7 | 30 | 90): void {
        this.activePeriod.set(days);
        this.loadVolume();
    }

    // ─── Chart ────────────────────────────────────────────────────────────────

    private renderChart(): void {
        const canvas = this.volumeChartRef?.nativeElement;
        if (!canvas) return;

        this.chart?.destroy();

        const data = this.volumeData();
        const types = [...this.usedTypes()];
        const labels = data.map(d => {
            const dt = new Date(d.date);
            return dt.toLocaleDateString('es-DO', { day: '2-digit', month: 'short' });
        });

        const datasets = types.map(type => ({
            label: TYPE_LABELS[type] ?? type,
            data: data.map(d => (d.by_type[type] ?? 0) as number),
            backgroundColor: (TYPE_COLORS[type] ?? '#9CA3AF') + '80',
            borderColor: TYPE_COLORS[type] ?? '#9CA3AF',
            borderWidth: 1.5,
            fill: true,
            tension: 0.4,
            pointRadius: 2,
        }));

        this.chart = new Chart(canvas, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        stacked: true,
                        grid: { display: false },
                        ticks: { font: { size: 10 }, maxTicksLimit: 8 },
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        grid: { color: '#F3F4F6' },
                        ticks: { font: { size: 10 }, precision: 0 },
                    },
                },
            },
        });
    }

    // ─── Actions ──────────────────────────────────────────────────────────────

    async takeTicket(ticket: BreachedTicketRow): Promise<void> {
        if (this.savingTicket()) return;
        this.savingTicket.set(ticket.id);
        try {
            await this.svc.assignToCurrentUser(ticket.id);
            this.breachedTickets.update(list =>
                list.map(t => t.id === ticket.id
                    ? { ...t, assigned_to: { id: this.auth.currentUser()!.id, full_name: this.auth.currentUser()!.role } }
                    : t)
            );
            this.toast.success('Ticket asignado a ti');
        } catch {
            this.toast.error('Error al tomar el ticket');
        } finally {
            this.savingTicket.set(null);
        }
    }

    async resolveTicket(ticket: BreachedTicketRow): Promise<void> {
        if (this.savingTicket()) return;
        this.savingTicket.set(ticket.id);
        try {
            await this.svc.updateTicketStatus(ticket.id, 'resuelto');
            this.breachedTickets.update(list => list.filter(t => t.id !== ticket.id));
            this.kpis.update(k => k ? { ...k, sla_breached_open: Math.max(0, k.sla_breached_open - 1) } : k);
            this.toast.success('Ticket resuelto');
        } catch {
            this.toast.error('Error al resolver el ticket');
        } finally {
            this.savingTicket.set(null);
        }
    }

    // ─── Utils ────────────────────────────────────────────────────────────────

    agentInitials(name: string): string {
        return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
    }
}
