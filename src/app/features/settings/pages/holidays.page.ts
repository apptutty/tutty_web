import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../settings.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { Holiday } from '../../../core/supabase/database.types';

@Component({
  selector: 'app-settings-holidays',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-2xl">
      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">Feriados Nacionales</h3>
          <button class="btn-primary text-sm" (click)="openForm()">+ Agregar Feriado</button>
        </div>

        @if (loading()) {
          <div class="space-y-2">
            @for (i of [1,2,3]; track i) {
              <div class="animate-pulse h-12 bg-gray-200 rounded"></div>
            }
          </div>
        } @else if (holidays().length === 0) {
          <p class="text-center text-gray-500 py-8">No hay feriados registrados</p>
        } @else {
          <div class="space-y-2">
            @for (h of holidays(); track h.id) {
              <div class="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                <div>
                  <p class="font-medium text-gray-900">{{ h.name || '—' }}</p>
                  <p class="text-sm text-gray-500">{{ formatHolidayDate(h.date) }}</p>
                </div>
                <div class="flex gap-2">
                  <button class="text-brand-500 hover:text-brand-700 text-sm px-3 py-1.5 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors" (click)="openForm(h)">Editar</button>
                  <button class="text-error-500 hover:text-error-700 text-sm px-3 py-1.5 border border-error-200 rounded-lg hover:bg-error-50 transition-colors" (click)="delete(h.id)">Eliminar</button>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>

    @if (showModal()) {
      <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <h3 class="text-lg font-semibold mb-4">{{ editing()?.id ? 'Editar Feriado' : 'Nuevo Feriado' }}</h3>
          <form (ngSubmit)="save()" class="space-y-4">
            <div>
              <label class="label">Nombre</label>
              <input type="text" class="input-field" [(ngModel)]="form.name" name="name" required />
            </div>
            <div>
              <label class="label">Fecha</label>
              <input type="date" class="input-field" [(ngModel)]="form.date" name="date" required />
            </div>
            <div>
              <label class="label">Recargo Especial (%) — 0 si no aplica</label>
              <input type="number" class="input-field" [(ngModel)]="form.surcharge" name="surcharge" min="0" max="200" step="1" />
            </div>
            <div class="flex gap-3 pt-2">
              <button type="button" class="btn-secondary flex-1" (click)="showModal.set(false)">Cancelar</button>
              <button type="submit" class="btn-primary flex-1" [disabled]="saving()">
                {{ saving() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class HolidaysPageComponent implements OnInit {
  private readonly svc = inject(SettingsService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly holidays = signal<Holiday[]>([]);
  readonly showModal = signal(false);
  readonly editing = signal<Holiday | null>(null);
  form: { name: string; date: string; surcharge: number } = { name: '', date: '', surcharge: 0 };

  ngOnInit() { this.load(); }

  private async load() {
    this.loading.set(true);
    try {
      this.holidays.set(await this.svc.getHolidays());
    } catch { } finally { this.loading.set(false); }
  }

  openForm(h?: Holiday) {
    this.editing.set(h ?? null);
    this.form = h ? { name: h.name, date: h.date, surcharge: h.surcharge ?? 0 } : { name: '', date: '', surcharge: 0 };
    this.showModal.set(true);
  }

  async save() {
    this.saving.set(true);
    try {
      await this.svc.saveHoliday({ ...this.form, id: this.editing()?.id });
      this.toast.success('Feriado guardado');
      this.showModal.set(false);
      this.load();
    } catch { this.toast.error('Error al guardar feriado'); }
    finally { this.saving.set(false); }
  }

  async delete(id: string) {
    try {
      await this.svc.deleteHoliday(id);
      this.toast.success('Feriado eliminado');
      this.load();
    } catch { this.toast.error('Error al eliminar'); }
  }

  formatHolidayDate(dateStr: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T12:00:00'); // noon to avoid timezone shift
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
  }
}
