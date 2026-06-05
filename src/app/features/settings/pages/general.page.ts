import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../settings.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';

@Component({
    selector: 'app-settings-general',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="max-w-2xl">
      <div class="card p-6 mb-6">
        <h3 class="text-lg font-semibold mb-4 text-gray-900">Configuración General</h3>
        @if (loading()) {
          <div class="space-y-4">
            @for (i of [1,2,3,4]; track i) {
              <div class="animate-pulse h-10 bg-gray-200 rounded"></div>
            }
          </div>
        } @else {
          <form (ngSubmit)="save()" class="space-y-4">
            <div>
              <label class="label">Monto Mínimo de Pedido (RD$)</label>
              <input type="number" class="input-field" [(ngModel)]="form.min_order_amount" name="min_order_amount" min="0" step="1" />
            </div>
            <div>
              <label class="label">Tarifa de Envío Predeterminada (RD$)</label>
              <input type="number" class="input-field" [(ngModel)]="form.default_delivery_fee" name="default_delivery_fee" min="0" step="1" />
            </div>
            <div>
              <label class="label">Comisión Predeterminada (%)</label>
              <input type="number" class="input-field" [(ngModel)]="form.default_commission_rate" name="default_commission_rate" min="0" max="100" step="0.1" />
            </div>
            <div>
              <label class="label">Tasa ITBIS (%)</label>
              <input type="number" class="input-field" [(ngModel)]="form.itbis_rate" name="itbis_rate" min="0" max="100" step="0.1" />
            </div>
            <div>
              <label class="label">Máx. Artículos por Pedido</label>
              <input type="number" class="input-field" [(ngModel)]="form.max_items_per_order" name="max_items_per_order" min="1" step="1" />
            </div>
            <div>
              <label class="label">Máx. Pedidos simultáneos</label>
              <input type="number" class="input-field" [(ngModel)]="form.max_orders_in_flight" name="max_orders_in_flight" min="1" step="1" />
            </div>
            <div>
              <label class="label">Bono por referido (RD$)</label>
              <input type="number" class="input-field" [(ngModel)]="form.referral_bonus_amount" name="referral_bonus_amount" min="0" step="1" />
            </div>
            <div>
              <label class="label">Auto-cancelar pedido sin confirmar (min)</label>
              <input type="number" class="input-field" [(ngModel)]="form.order_auto_cancel_minutes" name="order_auto_cancel_minutes" min="1" step="1" />
            </div>
            <div>
              <label class="label">Umbral Envío Gratis (RD$)</label>
              <input type="number" class="input-field" [(ngModel)]="form.free_delivery_threshold" name="free_delivery_threshold" min="0" step="1" />
              <p class="text-xs text-gray-500 mt-1">0 = desactivado</p>
            </div>
            <button type="submit" class="btn-primary" [disabled]="saving()">
              {{ saving() ? 'Guardando...' : 'Guardar Cambios' }}
            </button>
          </form>
        }
      </div>
    </div>
  `,
})
export class GeneralSettingsPageComponent implements OnInit {
    private readonly svc = inject(SettingsService);
    private readonly toast = inject(ToastService);

    readonly loading = signal(true);
    readonly saving = signal(false);

    form = {
        min_order_amount: 0,
        default_delivery_fee: 0,
        default_commission_rate: 0,
        itbis_rate: 18,
        max_items_per_order: 20,
        max_orders_in_flight: 50,
        referral_bonus_amount: 200,
        order_auto_cancel_minutes: 30,
        free_delivery_threshold: 0,
    };

    ngOnInit() { this.load(); }

    private async load() {
        this.loading.set(true);
        try {
            const settings = await this.svc.getSettings();
            const map: Record<string, string> = {};
            settings.forEach(s => map[s.key] = s.value);
            this.form.min_order_amount = Number(map['min_order_amount'] ?? 150);
            this.form.default_delivery_fee = Number(map['default_delivery_fee'] ?? 75);
            this.form.default_commission_rate = Number(map['default_commission_rate'] ?? 15);
            this.form.itbis_rate = Number(map['itbis_rate'] ?? 18);
            this.form.max_items_per_order = Number(map['max_items_per_order'] ?? 20);
            this.form.max_orders_in_flight = Number(map['max_orders_in_flight'] ?? 50);
            this.form.referral_bonus_amount = Number(map['referral_bonus_amount'] ?? 200);
            this.form.order_auto_cancel_minutes = Number(map['order_auto_cancel_minutes'] ?? 30);
            this.form.free_delivery_threshold = Number(map['free_delivery_threshold'] ?? 0);
        } catch { } finally { this.loading.set(false); }
    }

    async save() {
        this.saving.set(true);
        const rows = Object.entries(this.form).map(([key, value]) => ({ key, value: String(value) }));
        try {
            await this.svc.upsertSettings(rows);
            this.toast.success('Configuración general guardada');
        } catch { this.toast.error('Error al guardar'); }
        finally { this.saving.set(false); }
    }
}
