import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../settings.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';

@Component({
  selector: 'app-settings-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-5xl">
      <div class="admin-form-card mb-6">
        <div class="admin-form-card__header">
          <h3 class="admin-card-title">Notification settings</h3>
          <p class="text-sm text-gray-500 mt-1">Define alertas operativas para pedidos, WhatsApp y notificaciones push.</p>
        </div>
        <div class="admin-form-card__body">
        @if (loading()) {
          <div class="space-y-4">
            @for (i of skeleton3; track i) {
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
                  aria-label="Alternar notificaciones push"
                  role="switch"
                  [attr.aria-checked]="form.push_enabled"
                  class="admin-switch"
                  [class.admin-switch--on]="form.push_enabled">
                  <span class="admin-switch__thumb" [class.admin-switch__thumb--on]="form.push_enabled"></span>
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
                  aria-label="Alternar notificaciones de WhatsApp"
                  role="switch"
                  [attr.aria-checked]="form.whatsapp_enabled"
                  class="admin-switch"
                  [class.admin-switch--on]="form.whatsapp_enabled">
                  <span class="admin-switch__thumb" [class.admin-switch__thumb--on]="form.whatsapp_enabled"></span>
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
                  aria-label="Alternar alertas de nuevos pedidos"
                  role="switch"
                  [attr.aria-checked]="form.new_order_alert"
                  class="admin-switch"
                  [class.admin-switch--on]="form.new_order_alert">
                  <span class="admin-switch__thumb" [class.admin-switch__thumb--on]="form.new_order_alert"></span>
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
                  aria-label="Alternar alertas de pedidos sin repartidor"
                  role="switch"
                  [attr.aria-checked]="form.unassigned_alert"
                  class="admin-switch"
                  [class.admin-switch--on]="form.unassigned_alert">
                  <span class="admin-switch__thumb" [class.admin-switch__thumb--on]="form.unassigned_alert"></span>
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
    </div>
  `,
})
export class NotificationsSettingsPageComponent implements OnInit {
  private readonly svc = inject(SettingsService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly skeleton3 = [1, 2, 3];

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
