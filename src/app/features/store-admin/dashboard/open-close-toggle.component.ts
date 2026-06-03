import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoreAdminService } from '../store-admin.service';

@Component({
  selector: 'app-open-close-toggle',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    .toggle-track {
      @apply relative inline-flex items-center cursor-pointer select-none;
      min-height: 60px;
    }
    .toggle-knob {
      @apply absolute left-1 transition-all duration-300 ease-in-out;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.18);
    }
    .toggle-knob.on  { transform: translateX(72px); }
    .toggle-knob.off { transform: translateX(0px); }
    .toggle-bg {
      width: 132px;
      height: 60px;
      border-radius: 30px;
      transition: background 0.3s;
    }
    .toggle-bg.on  { background: linear-gradient(90deg, #16a34a, #22c55e); }
    .toggle-bg.off { background: linear-gradient(90deg, #ef4444, #f87171); }
  `],
  template: `
    <div class="card p-5 space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-semibold text-gray-900 text-sm">Estado del comercio</h2>
          @if (scheduleText()) {
            <p class="text-xs text-gray-500 mt-0.5">{{ scheduleText() }}</p>
          }
        </div>

        <!-- Big toggle -->
        <button
          class="toggle-track focus:outline-none"
          [attr.aria-label]="isOpen() ? 'Cerrar comercio' : 'Abrir comercio'"
          (click)="handleToggle()"
          [disabled]="busy()"
        >
          <div class="toggle-bg" [class.on]="isOpen()" [class.off]="!isOpen()">
            <div class="toggle-knob" [class.on]="isOpen()" [class.off]="!isOpen()"
              [class.animate-spin]="busy()">
              @if (busy()) {
                <div class="w-full h-full flex items-center justify-center">
                  <svg class="w-5 h-5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                </div>
              }
            </div>
          </div>
        </button>
      </div>

      <!-- Status label -->
      <div class="flex items-center gap-2">
        @if (isOpen()) {
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success-50 text-success-700 text-sm font-semibold">
            <span class="w-2 h-2 rounded-full bg-success-500 animate-pulse"></span>
            ABIERTO
          </span>
        } @else {
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-error-50 text-error-700 text-sm font-semibold">
            <span class="w-2 h-2 rounded-full bg-error-400"></span>
            CERRADO
          </span>
        }
        @if (outsideSchedule()) {
          <span class="flex items-center gap-1 text-xs text-warning-600 font-medium">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            Fuera de horario
          </span>
        }
      </div>

      <!-- Out-of-schedule confirmation modal -->
      @if (showConfirm()) {
        <div class="mt-2 p-3 rounded-xl bg-warning-50 border border-warning-200 space-y-3">
          <div class="flex gap-2">
            <svg class="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p class="text-sm text-warning-700">
              ⚠️ Estás abriendo fuera de tu horario configurado
              @if (scheduleText()) { <strong>({{ scheduleText() }})</strong>. }
              ¿Deseas abrirlo de todas formas?
            </p>
          </div>
          <div class="flex gap-2">
            <button class="btn-primary text-xs px-3 py-1.5" (click)="confirmOpen()">Sí, abrir</button>
            <button class="btn-secondary text-xs px-3 py-1.5" (click)="showConfirm.set(false)">Cancelar</button>
          </div>
        </div>
      }
    </div>
  `,
})
export class OpenCloseToggleComponent {
  private readonly storeService = inject(StoreAdminService);

  readonly busy = signal(false);
  readonly showConfirm = signal(false);

  readonly isOpen = computed(() => this.storeService.activeStore()?.is_open ?? false);
  readonly outsideSchedule = computed(() => this.storeService.isOutsideSchedule());

  readonly scheduleText = computed(() => {
    const store = this.storeService.activeStore();
    if (!store?.opening_time || !store?.closing_time) return null;
    const days = store.open_days?.length
      ? this.formatDays(store.open_days)
      : 'Todos los días';
    return `${days} ${this.fmt12(store.opening_time)} – ${this.fmt12(store.closing_time)}`;
  });

  async handleToggle() {
    if (this.busy()) return;

    // If trying to open while outside schedule → show confirmation first
    if (!this.isOpen() && this.outsideSchedule()) {
      this.showConfirm.set(true);
      return;
    }

    await this.doToggle();
  }

  async confirmOpen() {
    this.showConfirm.set(false);
    await this.doToggle();
  }

  private async doToggle() {
    this.busy.set(true);
    await this.storeService.toggleIsOpen();
    this.busy.set(false);
  }

  private fmt12(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')}${ampm}`;
  }

  private formatDays(days: string[]): string {
    const abbr: Record<string, string> = {
      lunes: 'Lun', martes: 'Mar', miercoles: 'Mié',
      jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom',
    };
    return days.map(d => abbr[d] ?? d).join('-');
  }
}
