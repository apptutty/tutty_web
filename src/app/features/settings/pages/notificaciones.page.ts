import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../settings.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';

@Component({
    selector: 'app-settings-notificaciones',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="max-w-2xl">
      <div class="card p-6 mb-6">
        <h3 class="text-lg font-semibold mb-4 text-gray-900">Notificaciones del Sistema</h3>
        @if (loading()) {
          <div class="space-y-4">
            @for (i of [1,2,3]; track i) {
              <div class="animate-pulse h-16 bg-gray-200 rounded"></div>
            }
          </div>
        } @else {
          <form (ngSubmit)="save()" class="space-y-5">
            <div class="border rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium text-gray-900">Notificaciones Push</p>
                  <p class="text-sm text-gray-500">Enviar push al cliente cuando cambia el estado del pedido</p>
                </div>
                <button type="button"
                  (click)="form.push_enabled = !form.push_enabled"
                  [class]="form.push_enabled ? 'bg-brand-500 relative inline-flex h-6 w-11 rounded-full transition-colors' : 'bg-gray-200 relative inline-flex h-6 w-11 rounded-full transition-colors'">
                  <span [class]="form.push_enabled ? 'translate-x-6 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5' : 'translate-x-0 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'"></span>
                </button>
              </div>
            </div>
            <div class="border rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium text-gray-900">Notificaciones WhatsApp</p>
                  <p class="text-sm text-gray-500">Enviar mensajes de WhatsApp al repartidor</p>
                </div>
                <button type="button"
                  (click)="form.whatsapp_enabled = !form.whatsapp_enabled"
                  [class]="form.whatsapp_enabled ? 'bg-brand-500 relative inline-flex h-6 w-11 rounded-full transition-colors' : 'bg-gray-200 relative inline-flex h-6 w-11 rounded-full transition-colors'">
                  <span [class]="form.whatsapp_enabled ? 'translate-x-6 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5' : 'translate-x-0 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'"></span>
                </button>
              </div>
            </div>
            <div class="border rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium text-gray-900">Alertas de Nuevos Pedidos</p>
                  <p class="text-sm text-gray-500">Alertar al restaurante por cada pedido recibido</p>
                </div>
                <button type="button"
                  (click)="form.new_order_alert = !form.new_order_alert"
                  [class]="form.new_order_alert ? 'bg-brand-500 relative inline-flex h-6 w-11 rounded-full transition-colors' : 'bg-gray-200 relative inline-flex h-6 w-11 rounded-full transition-colors'">
                  <span [class]="form.new_order_alert ? 'translate-x-6 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5' : 'translate-x-0 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'"></span>
                </button>
              </div>
            </div>
            <div class="border rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <div>
                  <p class="font-medium text-gray-900">Alertas de Pedidos sin Repartidor</p>
                  <p class="text-sm text-gray-500">Notificar al admin si un pedido lleva X minutos sin asignar</p>
                </div>
                <button type="button"
                  (click)="form.unassigned_alert = !form.unassigned_alert"
                  [class]="form.unassigned_alert ? 'bg-brand-500 relative inline-flex h-6 w-11 rounded-full transition-colors' : 'bg-gray-200 relative inline-flex h-6 w-11 rounded-full transition-colors'">
                  <span [class]="form.unassigned_alert ? 'translate-x-6 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5' : 'translate-x-0 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'"></span>
                </button>
              </div>
              @if (form.unassigned_alert) {
                <div>
                  <label class="label">Minutos de espera antes de alertar</label>
                  <input type="number" class="input-field max-w-xs" [(ngModel)]="form.unassigned_alert_minutes" name="unassigned_minutes" min="1" step="1" />
                </div>
              }
            </div>
            <button type="submit" class="btn-primary" [disabled]="saving()">
              {{ saving() ? 'Guardando...' : 'Guardar Configuración' }}
            </button>
          </form>
        }
      </div>
    </div>
  `,
})
export class NotifSettingsPageComponent implements OnInit {
    private readonly svc = inject(SettingsService);
    private readonly toast = inject(ToastService);

    readonly loading = signal(true);
    readonly saving = signal(false);

    form = {
        push_enabled: true,
        whatsapp_enabled: false,
        new_order_alert: true,
        unassigned_alert: true,
        unassigned_alert_minutes: 10,
    };

    ngOnInit() { this.load(); }

    private async load() {
        this.loading.set(true);
        try {
            const settings = await this.svc.getSettings();
            const map: Record<string, string> = {};
            settings.forEach(s => map[s.key] = s.value);
            this.form.push_enabled = map['push_enabled'] !== 'false';
            this.form.whatsapp_enabled = map['whatsapp_enabled'] === 'true';
            this.form.new_order_alert = map['new_order_alert'] !== 'false';
            this.form.unassigned_alert = map['unassigned_alert'] !== 'false';
            this.form.unassigned_alert_minutes = Number(map['unassigned_alert_minutes'] ?? 10);
        } catch { } finally { this.loading.set(false); }
    }

    async save() {
        this.saving.set(true);
        const rows = Object.entries(this.form).map(([key, value]) => ({ key, value: String(value) }));
        try {
            await this.svc.upsertSettings(rows);
            this.toast.success('Configuración de notificaciones guardada');
        } catch { this.toast.error('Error al guardar'); }
        finally { this.saving.set(false); }
    }
}
