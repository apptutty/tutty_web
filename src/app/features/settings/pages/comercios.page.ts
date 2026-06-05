import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../settings.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';

@Component({
    selector: 'app-settings-comercios',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="max-w-2xl space-y-4">
      <div class="card p-6 border-2 transition-colors"
        [class]="form.store_auto_approve ? 'border-warning-400 bg-warning-50' : 'border-gray-200 bg-white'">
        <div class="flex items-start gap-4">
          <div class="flex-1">
            <p class="font-bold text-gray-900 text-base">Aprobación Automática de Comercios</p>
            <p class="text-sm text-gray-500 mt-1">
              Si está activo, los nuevos comercios se publican inmediatamente sin revisión.
              Al activar, todos los comercios pendientes se aprobarán.
            </p>
            @if (form.store_auto_approve) {
              <div class="mt-2 flex items-center gap-1.5 text-warning-600 text-sm font-semibold">
                ⚠️ Modo activo — nuevos comercios se publican sin revisión
              </div>
            }
          </div>
          <button type="button" (click)="onAutoApproveToggle()"
            class="relative flex-shrink-0 inline-flex h-8 w-16 rounded-full transition-colors duration-300 focus:outline-none"
            [class]="form.store_auto_approve ? 'bg-warning-500' : 'bg-gray-300'">
            <span class="pointer-events-none inline-block h-7 w-7 rounded-full bg-white shadow-lg transform ring-0 transition-transform duration-300 mt-0.5 ml-0.5"
              [class]="form.store_auto_approve ? 'translate-x-8' : 'translate-x-0'"></span>
          </button>
        </div>
      </div>

      <div class="card p-5">
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-gray-900">Aprobación Automática de Repartidores</p>
            <p class="text-sm text-gray-500">Los nuevos repartidores se activan sin revisión manual</p>
          </div>
          <button type="button"
            (click)="form.repartidor_auto_approve = !form.repartidor_auto_approve"
            class="relative inline-flex h-6 w-11 rounded-full transition-colors"
            [class]="form.repartidor_auto_approve ? 'bg-brand-500' : 'bg-gray-200'">
            <span [class]="form.repartidor_auto_approve
              ? 'translate-x-6 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'
              : 'translate-x-0 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'"></span>
          </button>
        </div>
      </div>

      <div class="card p-5">
        <h4 class="font-semibold text-gray-800 mb-4">Comisión de Onboarding para Nuevos Comercios</h4>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="label">Días con comisión reducida</label>
            <input type="number" class="input-field" [(ngModel)]="form.store_onboarding_commission_days"
              name="onboarding_days" min="0" max="365" step="1" />
            <p class="text-xs text-gray-400 mt-1">Días desde la apertura del comercio</p>
          </div>
          <div>
            <label class="label">Tasa de comisión reducida (%)</label>
            <input type="number" class="input-field" [(ngModel)]="form.store_onboarding_commission_rate"
              name="onboarding_rate" min="0" max="100" step="0.1" />
            <p class="text-xs text-gray-400 mt-1">Ej: 5 = 5% de comisión</p>
          </div>
        </div>
      </div>

      <button class="btn-primary" (click)="save()" [disabled]="saving()">
        {{ saving() ? 'Guardando...' : 'Guardar Configuración' }}
      </button>
    </div>

    @if (showConfirm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="showConfirm.set(false)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
          <div class="text-center mb-4">
            <div class="w-14 h-14 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg class="w-7 h-7 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <h3 class="text-lg font-bold text-gray-900">¿Activar aprobación automática?</h3>
            <p class="text-sm text-gray-500 mt-2">
              Esto aprobará <strong>todos los comercios pendientes inmediatamente</strong>
              y los publicará en la plataforma. Esta acción no se puede deshacer automáticamente.
            </p>
          </div>
          <div class="flex gap-3">
            <button class="btn-secondary flex-1" (click)="showConfirm.set(false)">Cancelar</button>
            <button class="flex-1 bg-warning-500 hover:bg-warning-600 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              (click)="confirmAutoApprove()" [disabled]="approvingAll()">
              {{ approvingAll() ? 'Aprobando...' : 'Confirmar y Aprobar Todo' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ComerciosPageComponent implements OnInit {
    private readonly svc = inject(SettingsService);
    private readonly toast = inject(ToastService);

    readonly saving = signal(false);
    readonly approvingAll = signal(false);
    readonly showConfirm = signal(false);

    form = {
        store_auto_approve: false,
        repartidor_auto_approve: false,
        store_onboarding_commission_days: 30,
        store_onboarding_commission_rate: 5,
    };

    ngOnInit() { this.load(); }

    private async load() {
        try {
            const settings = await this.svc.getSettings();
            const map: Record<string, string> = {};
            settings.forEach(s => map[s.key] = s.value);
            this.form.store_auto_approve = map['store_auto_approve'] === 'true';
            this.form.repartidor_auto_approve = map['repartidor_auto_approve'] === 'true';
            this.form.store_onboarding_commission_days = Number(map['store_onboarding_commission_days'] ?? 30);
            this.form.store_onboarding_commission_rate = Number(map['store_onboarding_commission_rate'] ?? 5);
        } catch { }
    }

    onAutoApproveToggle() {
        if (!this.form.store_auto_approve) {
            this.showConfirm.set(true);
        } else {
            this.form.store_auto_approve = false;
        }
    }

    async confirmAutoApprove() {
        this.approvingAll.set(true);
        this.form.store_auto_approve = true;
        this.showConfirm.set(false);
        try {
            await this.svc.approveAllPendingStores();
            this.toast.success('Todos los comercios pendientes han sido aprobados');
            this.save();
        } catch { this.toast.error('Error al aprobar comercios pendientes'); }
        finally { this.approvingAll.set(false); }
    }

    async save() {
        this.saving.set(true);
        const rows = Object.entries(this.form).map(([key, value]) => ({ key, value: String(value) }));
        try {
            await this.svc.upsertSettings(rows);
            this.toast.success('Configuración de comercios guardada');
        } catch { this.toast.error('Error al guardar'); }
        finally { this.saving.set(false); }
    }
}
