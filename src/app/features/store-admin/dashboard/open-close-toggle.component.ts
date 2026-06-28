import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { StoreAdminService } from '../store-admin.service';

@Component({
    selector: 'app-open-close-toggle',
    standalone: true,
    imports: [CommonModule],
    styles: [`
    .store-state-panel {
      background: #fff;
      border: 1px solid #e7eaf1;
      border-radius: 22px;
      box-shadow: 0 8px 24px rgba(18, 24, 40, .07);
      padding: 22px;
      display: grid;
      gap: 18px;
      min-width: 0;
    }
    .store-state-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .store-state-title {
      margin: 0;
    }
    .store-state-header p {
      margin: 6px 0 0;
      font-size: 12.5px;
      color: #667085;
      line-height: 1.45;
    }
    .store-switch {
      position: relative;
      width: 66px;
      height: 38px;
      border: 0;
      border-radius: 999px;
      cursor: pointer;
      transition: .2s ease;
      flex-shrink: 0;
      padding: 0;
    }
    .store-switch.on { background: #19b65b; }
    .store-switch.off { background: #ef4444; }
    .store-switch-knob {
      position: absolute;
      top: 4px;
      left: 4px;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, .18);
      transition: transform .2s ease;
      display: grid;
      place-items: center;
    }
    .store-switch.on .store-switch-knob {
      transform: translateX(28px);
    }
    .store-state-badges {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .admin-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 999px;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .01em;
    }
    .admin-badge--success {
      background: #eafbf1;
      color: #067647;
    }
    .admin-badge--danger {
      background: #feefef;
      color: #b42318;
    }
    .admin-badge--warning {
      background: #fff6e6;
      color: #b54708;
    }
    .store-schedule-box {
      border: 1px solid #eef1f6;
      border-radius: 16px;
      padding: 13px;
      background: #fbfcff;
    }
    .store-schedule-label {
      display: block;
      font-size: 11px;
      color: #667085;
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: .06em;
      font-weight: 800;
    }
    .store-schedule-box strong {
      font-size: 14px;
      color: #111827;
      font-weight: 800;
      letter-spacing: .01em;
    }
    .state-primary-btn {
      height: 42px;
      border: 0;
      border-radius: 15px;
      background: linear-gradient(135deg, #f2299b, #df117f);
      color: #fff;
      font-weight: 800;
      font-size: 13px;
      box-shadow: 0 12px 22px rgba(235, 27, 141, .24);
    }
    .state-primary-btn:hover { filter: brightness(.97); }
    .outside-confirm {
      border: 1px solid #ffd9b0;
      background: #fff6e6;
      border-radius: 16px;
      padding: 10px 12px;
      display: grid;
      gap: 8px;
    }
    .outside-confirm p {
      margin: 0;
      color: #b54708;
      font-size: 12px;
      line-height: 1.45;
    }
    .outside-confirm-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
  `],
    template: `
    <div class="store-state-panel">
      <div class="store-state-header">
        <div>
          <h2 class="admin-card-title store-state-title">Estado del comercio</h2>
          <p>Controla si el comercio puede recibir pedidos ahora.</p>
        </div>

        <button
          class="store-switch focus:outline-none"
          [class.on]="isOpen()"
          [class.off]="!isOpen()"
          role="switch"
          [attr.aria-checked]="isOpen()"
          [attr.aria-label]="isOpen() ? 'Cerrar comercio' : 'Abrir comercio'"
          (click)="handleToggle()"
          [disabled]="busy()"
        >
          <span class="store-switch-knob" [class.animate-spin]="busy()"></span>
        </button>
      </div>

      <div class="store-state-badges">
        @if (isOpen()) {
          <span class="admin-badge admin-badge--success">
            <span class="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse"></span>
            ABIERTO
          </span>
        } @else {
          <span class="admin-badge admin-badge--danger">
            <span class="w-1.5 h-1.5 rounded-full bg-error-400"></span>
            CERRADO
          </span>
        }
        @if (outsideSchedule()) {
          <span class="admin-badge admin-badge--warning">
            ⚠ Fuera de horario
          </span>
        }
      </div>

      <div class="store-schedule-box">
        <span class="store-schedule-label">Horario de hoy</span>
        <strong>{{ simpleScheduleText() }}</strong>
      </div>

      <button class="state-primary-btn w-full justify-center text-sm" (click)="goToSettings()">Editar horario</button>

      @if (showConfirm()) {
        <div class="outside-confirm">
          <p>
            Estas abriendo fuera del horario configurado
            @if (simpleScheduleText()) { <strong>({{ simpleScheduleText() }})</strong>. }
            ¿Deseas abrirlo de todas formas?
          </p>
          <div class="outside-confirm-actions">
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
    private readonly router = inject(Router);

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

    readonly simpleScheduleText = computed(() => {
        const store = this.storeService.activeStore();
        if (!store?.opening_time || !store?.closing_time) return 'Horario no configurado';
        return `${this.fmt12(store.opening_time)} - ${this.fmt12(store.closing_time)}`;
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

    goToSettings() {
        this.router.navigate(['/store/settings']);
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
