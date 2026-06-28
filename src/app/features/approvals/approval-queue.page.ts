import {
  Component, OnInit, OnDestroy, inject, signal, computed,
  ChangeDetectionStrategy, DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApprovalQueueService } from './approval-queue.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { StoreApproval, ApprovalStatus, CommerceType } from '../../core/supabase/database.types';
import { AdminEmptyStateComponent } from '../../shared/ui/admin-empty-state/admin-empty-state.component';

type ApprovalTab = 'pendiente' | 'aprobado' | 'rechazado' | 'suspendido';

const COMMERCE_LABELS: Record<CommerceType, string> = {
  restaurante: 'Restaurante',
  farmacia: 'Farmacia',
  bodega: 'Bodega',
  colmado: 'Colmado',
  tienda_ropa: 'Ropa',
  supermercado: 'Supermercado',
  electronica: 'Electrónica',
  otro: 'Otro',
};

@Component({
  selector: 'app-approval-queue-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, PageHeaderComponent, TimeAgoPipe, AdminEmptyStateComponent],
  template: `
    <app-page-header title="Aprobación de Comercios" subtitle="Revisa y gestiona las solicitudes de nuevos comercios">
      <div class="flex items-center gap-3">
        <!-- Auto-approve toggle -->
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600">Auto-aprobar</span>
          <button
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
            [class]="autoApprove() ? 'bg-success-500' : 'bg-gray-200'"
            (click)="toggleAutoApprove()"
            [disabled]="savingAutoApprove()"
          >
            <span class="inline-block w-5 h-5 transform rounded-full bg-white shadow transition-transform"
              [class]="autoApprove() ? 'translate-x-5' : 'translate-x-0.5'"></span>
          </button>
        </div>
      </div>
    </app-page-header>

    <!-- Tabs (horizontal scroll on mobile) -->
    <div class="overflow-x-auto scrollbar-hide -mx-0 mb-6">
      <div class="flex gap-1 bg-gray-100 p-1 rounded-xl w-max">
        @for (tab of tabs; track tab.key) {
          <button
            class="relative px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap min-h-[44px] sm:min-h-0"
            [class]="activeTab() === tab.key
              ? 'bg-white text-gray-800 shadow-theme-xs'
              : 'text-gray-500 hover:text-gray-700'"
            (click)="switchTab(tab.key)"
          >
            {{ tab.label }}
            @if (tab.key === 'pendiente' && pendingCount() > 0) {
              <span class="flex items-center justify-center w-5 h-5 rounded-full bg-error-500 text-white text-[10px] font-bold">
                {{ pendingCount() > 9 ? '9+' : pendingCount() }}
              </span>
            }
          </button>
        }
      </div>
    </div>

    <!-- Cards grid -->
    @if (loading()) {
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        @for (i of [1,2,3]; track i) {
          <div class="card p-5 animate-pulse space-y-3">
            <div class="flex gap-3">
              <div class="w-12 h-12 bg-gray-200 rounded-xl"></div>
              <div class="flex-1 space-y-2">
                <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                <div class="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
            <div class="h-3 bg-gray-200 rounded"></div>
            <div class="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        }
      </div>
    } @else if (stores().length === 0) {
      <div class="flex flex-col items-center justify-center py-24 text-center">
        <app-admin-empty-state
          icon="map"
          [title]="'Sin comercios ' + tabLabel(activeTab())"
          description="No hay solicitudes en esta categoría por el momento." />
      </div>
    } @else {
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        @for (store of stores(); track store.id) {
          <div class="card p-5 flex flex-col gap-4 hover:shadow-theme-md transition-shadow">
            <!-- Header -->
            <div class="flex items-start gap-3">
              @if (store.logo_url) {
                <img [src]="store.logo_url" [alt]="store.name"
                  class="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-gray-200" />
              } @else {
                <div class="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0 text-xl">
                  {{ commerceEmoji(store.commerce_type) }}
                </div>
              }
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-gray-800 truncate">{{ store.name }}</h3>
                <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                  @if (store.commerce_type) {
                    <span class="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
                      {{ commerceLabel(store.commerce_type) }}
                    </span>
                  }
                  <span class="text-xs text-gray-400">{{ store.city }}</span>
                </div>
              </div>
            </div>

            <!-- Info -->
            <div class="space-y-1.5 text-sm">
              <div class="flex items-center gap-2 text-gray-600">
                <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <span class="truncate">{{ store.admin_email ?? 'Sin admin vinculado' }}</span>
              </div>
              <div class="flex items-center gap-2 text-gray-600">
                <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span class="truncate">{{ store.address }}</span>
              </div>
              @if (store.submitted_at) {
                <div class="flex items-center gap-2 text-gray-400 text-xs">
                  <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Solicitado {{ store.submitted_at | timeAgo }}
                </div>
              }
              @if (store.rejection_reason) {
                <div class="mt-1 p-2.5 bg-error-50 rounded-lg text-xs text-error-700">
                  <span class="font-semibold">Motivo:</span> {{ store.rejection_reason }}
                </div>
              }
              @if (store.approval_notes) {
                <div class="mt-1 p-2.5 bg-brand-50 rounded-lg text-xs text-brand-700">
                  <span class="font-semibold">Notas:</span> {{ store.approval_notes }}
                </div>
              }
            </div>

            <!-- Actions -->
            <div class="flex gap-2 pt-1 border-t border-gray-100 flex-wrap">
              <button
                class="text-xs px-2.5 py-1.5 rounded-lg text-brand-600 hover:bg-brand-50 font-medium transition-colors"
                (click)="openSlideOver(store)"
              >
                👁 Ver perfil
              </button>
              @if (store.approval_status === 'pendiente') {
                <button
                  class="text-xs px-2.5 py-1.5 rounded-lg bg-success-500 text-white font-medium hover:bg-success-600 transition-colors"
                  (click)="openApproveModal(store)"
                >
                  ✅ Aprobar
                </button>
                <button
                  class="text-xs px-2.5 py-1.5 rounded-lg bg-error-500 text-white font-medium hover:bg-error-600 transition-colors"
                  (click)="openRejectModal(store)"
                >
                  ❌ Rechazar
                </button>
              }
              @if (store.approval_status === 'aprobado') {
                <button
                  class="text-xs px-2.5 py-1.5 rounded-lg bg-warning-400 text-white font-medium hover:bg-warning-500 transition-colors"
                  (click)="openSuspendModal(store)"
                >
                  ⏸ Suspender
                </button>
              }
              @if (store.approval_status === 'rechazado' || store.approval_status === 'suspendido') {
                <button
                  class="text-xs px-2.5 py-1.5 rounded-lg bg-success-500 text-white font-medium hover:bg-success-600 transition-colors"
                  (click)="openApproveModal(store)"
                >
                  ✅ Aprobar
                </button>
              }
            </div>
          </div>
        }
      </div>
    }

    <!-- ── Slide-over (Ver perfil) ── -->
    @if (slideOverStore()) {
      <div class="fixed inset-0 z-50 flex">
        <div class="absolute inset-0 bg-black/40" (click)="slideOverStore.set(null)"></div>
        <div class="relative ml-auto w-full max-w-md bg-white shadow-2xl flex flex-col h-full z-10 overflow-y-auto">
          <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
            <h3 class="font-semibold text-gray-800">Perfil del comercio</h3>
            <button class="text-gray-400 hover:text-gray-600" (click)="slideOverStore.set(null)">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="p-6 space-y-5">
            <!-- Logo -->
            <div class="flex items-center gap-4">
              @if (slideOverStore()!.logo_url) {
                <img [src]="slideOverStore()!.logo_url" class="w-16 h-16 rounded-2xl object-cover border border-gray-200" />
              } @else {
                <div class="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center text-3xl">
                  {{ commerceEmoji(slideOverStore()!.commerce_type) }}
                </div>
              }
              <div>
                <h4 class="text-lg font-bold text-gray-800">{{ slideOverStore()!.name }}</h4>
                <span class="text-sm px-2 py-0.5 rounded-full" [class]="statusClass(slideOverStore()!.approval_status)">
                  {{ statusLabel(slideOverStore()!.approval_status) }}
                </span>
              </div>
            </div>

            <!-- Details -->
            <div class="space-y-3 text-sm">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <p class="text-xs text-gray-400 font-medium uppercase mb-0.5">Tipo de comercio</p>
                  <p class="text-gray-800">{{ slideOverStore()!.commerce_type ? commerceLabel(slideOverStore()!.commerce_type!) : '—' }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-400 font-medium uppercase mb-0.5">Ciudad</p>
                  <p class="text-gray-800">{{ slideOverStore()!.city }}</p>
                </div>
              </div>
              <div>
                <p class="text-xs text-gray-400 font-medium uppercase mb-0.5">Dirección</p>
                <p class="text-gray-800">{{ slideOverStore()!.address }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-400 font-medium uppercase mb-0.5">Admin solicitante</p>
                <p class="text-gray-800">{{ slideOverStore()!.admin_name ?? '—' }}</p>
                <p class="text-gray-500 text-xs">{{ slideOverStore()!.admin_email ?? '' }}</p>
              </div>
            </div>

            <!-- Decision history -->
            <div class="border-t border-gray-100 pt-4">
              <p class="text-xs text-gray-400 font-medium uppercase mb-3">Historial de decisiones</p>
              <div class="space-y-2 text-sm">
                @if (slideOverStore()!.submitted_at) {
                  <div class="flex items-start gap-2">
                    <span class="w-2 h-2 rounded-full bg-gray-300 mt-1.5 flex-shrink-0"></span>
                    <div>
                      <p class="text-gray-700">Solicitud enviada</p>
                      <p class="text-xs text-gray-400">{{ slideOverStore()!.submitted_at | timeAgo }}</p>
                    </div>
                  </div>
                }
                @if (slideOverStore()!.approved_at) {
                  <div class="flex items-start gap-2">
                    <span class="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      [class]="slideOverStore()!.approval_status === 'aprobado' ? 'bg-success-500' : 'bg-error-500'"></span>
                    <div>
                      <p class="text-gray-700">
                        {{ slideOverStore()!.approval_status === 'aprobado' ? 'Aprobado' : 'Rechazado/Suspendido' }}
                      </p>
                      <p class="text-xs text-gray-400">{{ slideOverStore()!.approved_at | timeAgo }}</p>
                      @if (slideOverStore()!.rejection_reason) {
                        <p class="text-xs text-error-600 mt-0.5">{{ slideOverStore()!.rejection_reason }}</p>
                      }
                      @if (slideOverStore()!.approval_notes) {
                        <p class="text-xs text-brand-600 mt-0.5">{{ slideOverStore()!.approval_notes }}</p>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>

            <!-- Actions inside slide-over -->
            <div class="flex gap-2 pt-2">
              @if (slideOverStore()!.approval_status === 'pendiente') {
                <button class="flex-1 btn-primary text-sm py-2" (click)="openApproveModal(slideOverStore()!)">✅ Aprobar</button>
                <button class="flex-1 text-sm py-2 px-3 rounded-lg border border-error-300 text-error-600 hover:bg-error-50 transition-colors font-medium"
                  (click)="openRejectModal(slideOverStore()!)">❌ Rechazar</button>
              }
              @if (slideOverStore()!.approval_status === 'aprobado') {
                <button class="flex-1 text-sm py-2 px-3 rounded-lg bg-warning-400 text-white hover:bg-warning-500 transition-colors font-medium"
                  (click)="openSuspendModal(slideOverStore()!)">⏸ Suspender</button>
              }
            </div>
          </div>
        </div>
      </div>
    }

    <!-- ── Approve Modal ── -->
    @if (approveStore()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="approveStore.set(null)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6">
          <h3 class="font-semibold text-gray-800 mb-1">Aprobar comercio</h3>
          <p class="text-sm text-gray-500 mb-4">
            ¿Confirmas la aprobación de <strong>{{ approveStore()!.name }}</strong>?
            El comercio quedará activo de inmediato.
          </p>
          <div class="mb-4">
            <label class="label">Notas internas (opcional)</label>
            <textarea class="input-field" rows="3" [(ngModel)]="approveNotes"
              placeholder="Ej: Documentos verificados, todo en orden..."></textarea>
          </div>
          <div class="flex gap-3 justify-end">
            <button class="btn-secondary" (click)="approveStore.set(null)">Cancelar</button>
            <button class="btn-primary bg-success-500 hover:bg-success-600 border-success-500"
              [disabled]="actionLoading()"
              (click)="confirmApprove()">
              {{ actionLoading() ? 'Procesando...' : '✅ Confirmar aprobación' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Reject Modal ── -->
    @if (rejectStore()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="rejectStore.set(null)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6">
          <h3 class="font-semibold text-gray-800 mb-1">Rechazar solicitud</h3>
          <p class="text-sm text-gray-500 mb-4">
            Debes indicar el motivo del rechazo de <strong>{{ rejectStore()!.name }}</strong>.
            Este motivo le será notificado al solicitante.
          </p>
          <div class="mb-4">
            <label class="label">Motivo del rechazo *</label>
            <textarea class="input-field" rows="4" [(ngModel)]="rejectReason"
              placeholder="Ej: Documentación incompleta, zona no cubierta..."></textarea>
          </div>
          <div class="flex gap-3 justify-end">
            <button class="btn-secondary" (click)="rejectStore.set(null)">Cancelar</button>
            <button class="px-4 py-2 rounded-lg bg-error-500 text-white text-sm font-medium hover:bg-error-600 transition-colors disabled:opacity-50"
              [disabled]="actionLoading() || !rejectReason.trim()"
              (click)="confirmReject()">
              {{ actionLoading() ? 'Procesando...' : '❌ Confirmar rechazo' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Suspend Modal ── -->
    @if (suspendStore()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="suspendStore.set(null)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6">
          <h3 class="font-semibold text-gray-800 mb-1">Suspender comercio</h3>
          <p class="text-sm text-gray-500 mb-4">
            El comercio <strong>{{ suspendStore()!.name }}</strong> quedará inactivo hasta nueva revisión.
          </p>
          <div class="mb-4">
            <label class="label">Motivo de suspensión *</label>
            <textarea class="input-field" rows="4" [(ngModel)]="suspendReason"
              placeholder="Ej: Quejas de clientes, incumplimiento de términos..."></textarea>
          </div>
          <div class="flex gap-3 justify-end">
            <button class="btn-secondary" (click)="suspendStore.set(null)">Cancelar</button>
            <button class="px-4 py-2 rounded-lg bg-warning-500 text-white text-sm font-medium hover:bg-warning-600 transition-colors disabled:opacity-50"
              [disabled]="actionLoading() || !suspendReason.trim()"
              (click)="confirmSuspend()">
              {{ actionLoading() ? 'Procesando...' : '⏸ Confirmar suspensión' }}
            </button>
          </div>
        </div>
      </div>
    }
    `,
})
export class ApprovalQueuePageComponent implements OnInit, OnDestroy {
  private readonly service = inject(ApprovalQueueService);
  private readonly toast = inject(ToastService);

  readonly activeTab = signal<ApprovalTab>('pendiente');
  readonly loading = signal(true);
  readonly stores = signal<StoreApproval[]>([]);
  readonly autoApprove = signal(false);
  readonly savingAutoApprove = signal(false);
  readonly actionLoading = signal(false);

  readonly slideOverStore = signal<StoreApproval | null>(null);
  readonly approveStore = signal<StoreApproval | null>(null);
  readonly rejectStore = signal<StoreApproval | null>(null);
  readonly suspendStore = signal<StoreApproval | null>(null);

  pendingCount = signal(0);

  approveNotes = '';
  rejectReason = '';
  suspendReason = '';

  readonly tabs: { key: ApprovalTab; label: string }[] = [
    { key: 'pendiente', label: 'Pendientes' },
    { key: 'aprobado', label: 'Aprobados' },
    { key: 'rechazado', label: 'Rechazados' },
    { key: 'suspendido', label: 'Suspendidos' },
  ];

  private realtimeSub?: { unsubscribe(): void };

  ngOnInit(): void {
    this.service.checkAutoApprove().then(v => this.autoApprove.set(v));
    this.subscribeToTab('pendiente');
  }

  ngOnDestroy(): void {
    this.realtimeSub?.unsubscribe();
  }

  switchTab(tab: ApprovalTab): void {
    this.activeTab.set(tab);
    this.realtimeSub?.unsubscribe();
    this.subscribeToTab(tab);
  }

  private subscribeToTab(tab: ApprovalTab): void {
    this.loading.set(true);
    if (tab === 'pendiente') {
      this.realtimeSub = this.service.watchPending().subscribe({
        next: (data) => {
          this.stores.set(data);
          this.pendingCount.set(data.length);
          this.loading.set(false);
        },
      }) as any;
    } else {
      this.realtimeSub = this.service.getStoresByStatus(tab).subscribe({
        next: (data) => { this.stores.set(data); this.loading.set(false); },
        error: () => { this.loading.set(false); },
      }) as any;
    }
  }

  openSlideOver(store: StoreApproval): void { this.slideOverStore.set(store); }
  openApproveModal(store: StoreApproval): void { this.approveStore.set(store); this.approveNotes = ''; }
  openRejectModal(store: StoreApproval): void { this.rejectStore.set(store); this.rejectReason = ''; }
  openSuspendModal(store: StoreApproval): void { this.suspendStore.set(store); this.suspendReason = ''; }

  async confirmApprove(): Promise<void> {
    const store = this.approveStore();
    if (!store) return;
    this.actionLoading.set(true);
    try {
      await this.service.approveStore(store.id, this.approveNotes.trim() || undefined);
      this.toast.success(`✅ ${store.name} aprobado correctamente`);
      this.approveStore.set(null);
      this.slideOverStore.set(null);
      this.stores.update(list => list.filter(s => s.id !== store.id));
      if (this.activeTab() === 'pendiente') this.pendingCount.update(n => Math.max(0, n - 1));
    } catch { this.toast.error('Error al aprobar el comercio'); }
    finally { this.actionLoading.set(false); }
  }

  async confirmReject(): Promise<void> {
    const store = this.rejectStore();
    if (!store || !this.rejectReason.trim()) return;
    this.actionLoading.set(true);
    try {
      await this.service.rejectStore(store.id, this.rejectReason.trim());
      this.toast.success(`Solicitud de ${store.name} rechazada`);
      this.rejectStore.set(null);
      this.slideOverStore.set(null);
      this.stores.update(list => list.filter(s => s.id !== store.id));
      if (this.activeTab() === 'pendiente') this.pendingCount.update(n => Math.max(0, n - 1));
    } catch { this.toast.error('Error al rechazar la solicitud'); }
    finally { this.actionLoading.set(false); }
  }

  async confirmSuspend(): Promise<void> {
    const store = this.suspendStore();
    if (!store || !this.suspendReason.trim()) return;
    this.actionLoading.set(true);
    try {
      await this.service.suspendStore(store.id, this.suspendReason.trim());
      this.toast.success(`${store.name} suspendido`);
      this.suspendStore.set(null);
      this.slideOverStore.set(null);
      this.stores.update(list => list.filter(s => s.id !== store.id));
      if (this.activeTab() === 'pendiente') this.pendingCount.update(n => Math.max(0, n - 1));
    } catch { this.toast.error('Error al suspender el comercio'); }
    finally { this.actionLoading.set(false); }
  }

  async toggleAutoApprove(): Promise<void> {
    this.savingAutoApprove.set(true);
    try {
      const newVal = !this.autoApprove();
      await this.service.setAutoApprove(newVal);
      this.autoApprove.set(newVal);
      this.toast.success(newVal
        ? 'Auto-aprobación activada. Todos los pendientes han sido aprobados.'
        : 'Auto-aprobación desactivada.'
      );
    } catch { this.toast.error('Error al cambiar configuración'); }
    finally { this.savingAutoApprove.set(false); }
  }

  commerceLabel(type?: CommerceType | null): string {
    return type ? (COMMERCE_LABELS[type] ?? type) : '—';
  }

  commerceEmoji(type?: CommerceType | null): string {
    const map: Partial<Record<CommerceType, string>> = {
      restaurante: '🍽️', farmacia: '💊', bodega: '🏪', colmado: '🛒',
      tienda_ropa: '👗', supermercado: '🛍️', electronica: '📱', otro: '🏬',
    };
    return type ? (map[type] ?? '🏬') : '🏬';
  }

  statusLabel(status: ApprovalStatus): string {
    const map: Record<ApprovalStatus, string> = {
      pendiente: 'Pendiente', aprobado: 'Aprobado',
      rechazado: 'Rechazado', suspendido: 'Suspendido',
    };
    return map[status];
  }

  statusClass(status: ApprovalStatus): string {
    const map: Record<ApprovalStatus, string> = {
      pendiente: 'bg-warning-100 text-warning-700',
      aprobado: 'bg-success-100 text-success-700',
      rechazado: 'bg-error-100 text-error-700',
      suspendido: 'bg-gray-100 text-gray-600',
    };
    return `text-xs px-2 py-0.5 rounded-full font-medium ${map[status]}`;
  }

  tabLabel(tab: ApprovalTab): string {
    const map: Record<ApprovalTab, string> = {
      pendiente: 'pendiente', aprobado: 'aprobado',
      rechazado: 'rechazado', suspendido: 'suspendido',
    };
    return map[tab];
  }
}
