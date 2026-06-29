import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../settings.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';

@Component({
    selector: 'app-settings-surcharge',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="max-w-4xl">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <!-- Input panel -->
        <div class="admin-form-card">
          <div class="admin-form-card__header">
            <h3 class="admin-card-title">Delivery fee simulator</h3>
            <p class="text-sm text-gray-500 mt-1">Prueba escenarios de recargos antes de guardar parámetros globales.</p>
          </div>
          <div class="admin-form-card__body space-y-4">
          <div>
            <label class="label">Tarifa base (RD$)</label>
            <input type="number" class="input-field" [(ngModel)]="form.baseFee" min="0" step="5" />
          </div>
          <div>
            <label class="label">% Recargo Clima/Lluvia</label>
            <input type="number" class="input-field" [(ngModel)]="form.weatherPct" min="0" max="200" step="1" />
          </div>
          <div>
            <label class="label">% Recargo Hora Pico</label>
            <input type="number" class="input-field" [(ngModel)]="form.peakPct" min="0" max="200" step="1" />
          </div>
          <div>
            <label class="label">% Recargo Nocturno</label>
            <input type="number" class="input-field" [(ngModel)]="form.nightPct" min="0" max="200" step="1" />
          </div>
          <div>
            <label class="label">% Recargo Feriado</label>
            <input type="number" class="input-field" [(ngModel)]="form.holidayPct" min="0" max="200" step="1" />
          </div>
          <hr class="border-gray-100" />
          <h4 class="font-medium text-gray-700 text-sm">Simulación</h4>
          <div>
            <label class="label">Hora del día</label>
            <div class="flex gap-2 items-center">
              <input type="number" class="input-field w-20" [(ngModel)]="form.hour" min="0" max="23" step="1" />
              <span class="text-gray-400">:</span>
              <input type="number" class="input-field w-20" [(ngModel)]="form.minute" min="0" max="59" step="5" />
            </div>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span class="text-sm text-gray-700">🌧 ¿Simular lluvia?</span>
              <button type="button"
                (click)="form.isRaining = !form.isRaining"
                class="admin-switch"
                aria-label="Alternar simulación de lluvia"
                role="switch"
                [attr.aria-checked]="form.isRaining"
                [class.admin-switch--on]="form.isRaining">
                <span class="admin-switch__thumb" [class.admin-switch__thumb--on]="form.isRaining"></span>
              </button>
            </div>
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span class="text-sm text-gray-700">🎉 ¿Simular feriado?</span>
              <button type="button"
                (click)="form.isHoliday = !form.isHoliday"
                class="admin-switch"
                aria-label="Alternar simulación de feriado"
                role="switch"
                [attr.aria-checked]="form.isHoliday"
                [class.admin-switch--on]="form.isHoliday">
                <span class="admin-switch__thumb" [class.admin-switch__thumb--on]="form.isHoliday"></span>
              </button>
            </div>
          </div>
          <button class="btn-primary w-full" (click)="save()" [disabled]="saving()">
            {{ saving() ? 'Guardando...' : '💾 Guardar estos parámetros' }}
          </button>
          </div>
        </div>

        <!-- Live output -->
        <div class="card p-5 bg-gray-900 text-white">
          <h3 class="font-semibold text-gray-300 mb-4 text-sm uppercase tracking-wide">Resultado en tiempo real</h3>
          <div class="mb-4 text-gray-400 text-sm leading-relaxed">
            A las
            <span class="text-white font-mono font-bold">
              {{ form.hour | number:'2.0-0' }}:{{ form.minute | number:'2.0-0' }}
            </span>
            @if (form.isRaining) { <span class="text-blue-300"> con lluvia</span> }
            @if (form.isHoliday) { <span class="text-yellow-300"> y feriado</span> }:
          </div>
          <div class="space-y-1.5 mb-5">
            <div class="flex justify-between items-center py-2 border-b border-gray-700">
              <span class="text-gray-300">Base</span>
              <span class="font-mono text-white">RD$ {{ calc().base | number:'1.2-2' }}</span>
            </div>
            @for (item of calc().breakdown; track item.label) {
              <div class="flex justify-between items-center py-2 border-b border-gray-700">
                <span class="text-gray-300">{{ item.label }}</span>
                <span class="font-mono text-brand-400">+RD$ {{ item.amount | number:'1.2-2' }}</span>
              </div>
            }
            @if (calc().breakdown.length === 0) {
              <div class="py-3 text-gray-500 text-sm text-center">Sin recargos adicionales</div>
            }
          </div>
          <div class="flex justify-between items-center bg-brand-600 rounded-xl px-4 py-3">
            <span class="font-bold text-white text-sm">TOTAL</span>
            <span class="font-bold text-white text-2xl font-mono">RD$ {{ calc().total | number:'1.2-2' }}</span>
          </div>
          <p class="text-xs text-gray-600 mt-3 text-center">
            Horas pico configuradas: {{ peakHours() }}
          </p>
        </div>
      </div>
    </div>
  `,
})
export class SurchargePageComponent implements OnInit {
    private readonly svc = inject(SettingsService);
    private readonly toast = inject(ToastService);

    readonly saving = signal(false);
    readonly peakHours = signal('12:00-14:00,18:00-21:00');

    form = {
        baseFee: 150, weatherPct: 35, peakPct: 20, nightPct: 15, holidayPct: 15,
        hour: 19, minute: 30, isRaining: false, isHoliday: false,
    };

    readonly calc = computed(() => {
        const f = this.form;
        const base = f.baseFee;
        let total = base;
        const breakdown: { label: string; amount: number }[] = [];

        if (this.isPeak(f.hour, f.minute)) {
            const amount = Math.round(base * f.peakPct / 100 * 100) / 100;
            breakdown.push({ label: `Hora Pico (${f.peakPct}%)`, amount });
            total += amount;
        }
        if (f.hour >= 22 || f.hour < 6) {
            const amount = Math.round(base * f.nightPct / 100 * 100) / 100;
            breakdown.push({ label: `Nocturno (${f.nightPct}%)`, amount });
            total += amount;
        }
        if (f.isRaining) {
            const amount = Math.round(base * f.weatherPct / 100 * 100) / 100;
            breakdown.push({ label: `Clima/Lluvia (${f.weatherPct}%)`, amount });
            total += amount;
        }
        if (f.isHoliday) {
            const amount = Math.round(base * f.holidayPct / 100 * 100) / 100;
            breakdown.push({ label: `Feriado (${f.holidayPct}%)`, amount });
            total += amount;
        }
        return { base, breakdown, total: Math.round(total * 100) / 100 };
    });

    ngOnInit() { this.load(); }

    private async load() {
        try {
            const settings = await this.svc.getSettings();
            const map: Record<string, string> = {};
            settings.forEach(s => map[s.key] = s.value);
            this.form.baseFee = Number(map['default_delivery_fee'] ?? 150);
            this.form.weatherPct = Number(map['weather_surcharge_rate'] ?? 35);
            this.form.peakPct = Number(map['peak_surcharge_rate'] ?? 20);
            this.form.nightPct = Number(map['night_surcharge_rate'] ?? 15);
            this.peakHours.set(map['peak_hours'] ?? '12:00-14:00,18:00-21:00');
        } catch { }
    }

    private isPeak(hour: number, minute: number): boolean {
        const time = hour * 60 + minute;
        for (const range of this.peakHours().split(',')) {
            const parts = range.trim().split('-');
            if (parts.length !== 2) continue;
            const [sh, sm] = parts[0].split(':').map(Number);
            const [eh, em] = parts[1].split(':').map(Number);
            if (time >= (sh * 60 + (sm || 0)) && time <= (eh * 60 + (em || 0))) return true;
        }
        return false;
    }

    async save() {
        this.saving.set(true);
        const f = this.form;
        const rows = [
            { key: 'default_delivery_fee', value: String(f.baseFee) },
            { key: 'weather_surcharge_rate', value: String(f.weatherPct) },
            { key: 'peak_surcharge_rate', value: String(f.peakPct) },
            { key: 'night_surcharge_rate', value: String(f.nightPct) },
        ];
        try {
            await this.svc.upsertSettings(rows);
            this.toast.success('Parámetros de tarifa guardados');
        } catch { this.toast.error('Error al guardar'); }
        finally { this.saving.set(false); }
    }
}
