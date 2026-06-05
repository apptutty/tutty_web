import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../settings.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';

@Component({
  selector: 'app-settings-delivery',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-2xl">
      <div class="card p-6 mb-6">
        <h3 class="text-lg font-semibold mb-4 text-gray-900">Tarifas Especiales</h3>
        @if (loading()) {
          <div class="animate-pulse h-40 bg-gray-200 rounded"></div>
        } @else {
          <form (ngSubmit)="save()" class="space-y-6">
            <!-- Recargo Climático -->
            <div class="border rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <div>
                  <p class="font-medium text-gray-900">Recargo Climático</p>
                  <p class="text-sm text-gray-500">Aplica tarifa adicional en mal tiempo</p>
                </div>
                <button type="button"
                  (click)="form.weather_surcharge_enabled = !form.weather_surcharge_enabled"
                  [class]="form.weather_surcharge_enabled ? 'bg-brand-500 relative inline-flex h-6 w-11 rounded-full transition-colors' : 'bg-gray-200 relative inline-flex h-6 w-11 rounded-full transition-colors'">
                  <span [class]="form.weather_surcharge_enabled ? 'translate-x-6 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5' : 'translate-x-0 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'"></span>
                </button>
              </div>
              @if (form.weather_surcharge_enabled) {
                <div>
                  <label class="label">Porcentaje de Recargo (%)</label>
                  <input type="number" class="input-field" [(ngModel)]="form.weather_surcharge_rate" name="weather_surcharge_rate" min="0" max="100" step="1" />
                </div>
              }
            </div>

            <!-- Recargo Hora Pico -->
            <div class="border rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <div>
                  <p class="font-medium text-gray-900">Recargo Hora Pico</p>
                  <p class="text-sm text-gray-500">Tarifa dinámica en horario de alta demanda</p>
                </div>
                <button type="button"
                  (click)="form.surge_pricing_enabled = !form.surge_pricing_enabled"
                  [class]="form.surge_pricing_enabled ? 'bg-brand-500 relative inline-flex h-6 w-11 rounded-full transition-colors' : 'bg-gray-200 relative inline-flex h-6 w-11 rounded-full transition-colors'">
                  <span [class]="form.surge_pricing_enabled ? 'translate-x-6 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5' : 'translate-x-0 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'"></span>
                </button>
              </div>
              @if (form.surge_pricing_enabled) {
                <div class="space-y-3">
                  <div>
                    <label class="label">Recargo en Pico (%)</label>
                    <input type="number" class="input-field" [(ngModel)]="form.peak_surcharge_rate" name="peak_surcharge_rate" min="0" max="200" step="1" />
                  </div>
                  <div>
                    <label class="label">Recargo Nocturno (%)</label>
                    <input type="number" class="input-field" [(ngModel)]="form.night_surcharge_rate" name="night_surcharge_rate" min="0" max="200" step="1" />
                  </div>
                  <div>
                    <label class="label">Horario Pico (ej: 12:00-14:00,18:00-21:00)</label>
                    <input type="text" class="input-field" [(ngModel)]="form.peak_hours" name="peak_hours" placeholder="12:00-14:00,18:00-21:00" />
                  </div>
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
export class DeliverySettingsPageComponent implements OnInit {
  private readonly svc = inject(SettingsService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);

  form = {
    weather_surcharge_enabled: false,
    weather_surcharge_rate: 10,
    surge_pricing_enabled: false,
    peak_surcharge_rate: 20,
    night_surcharge_rate: 15,
    peak_hours: '12:00-14:00,18:00-21:00',
  };

  ngOnInit() { this.load(); }

  private async load() {
    this.loading.set(true);
    try {
      const settings = await this.svc.getSettings();
      const map: Record<string, string> = {};
      settings.forEach(s => map[s.key] = s.value);
      this.form.weather_surcharge_enabled = map['weather_surcharge_enabled'] === 'true';
      this.form.weather_surcharge_rate = Number(map['weather_surcharge_rate'] ?? 10);
      this.form.surge_pricing_enabled = map['surge_pricing_enabled'] === 'true';
      this.form.peak_surcharge_rate = Number(map['peak_surcharge_rate'] ?? 20);
      this.form.night_surcharge_rate = Number(map['night_surcharge_rate'] ?? 15);
      this.form.peak_hours = map['peak_hours'] ?? '12:00-14:00,18:00-21:00';
    } catch { } finally { this.loading.set(false); }
  }

  async save() {
    this.saving.set(true);
    const rows = Object.entries(this.form).map(([key, value]) => ({ key, value: String(value) }));
    try {
      await this.svc.upsertSettings(rows);
      this.toast.success('Configuración de delivery guardada');
    } catch { this.toast.error('Error al guardar'); }
    finally { this.saving.set(false); }
  }
}
