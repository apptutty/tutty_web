import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
    selector: 'app-schedule-warning-card',
    standalone: true,
    styles: [`
    .admin-warning-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border: 1px solid #ffd8a8;
      background: #fff6e6;
      border-radius: 20px;
      padding: 14px 16px;
    }
    .admin-warning-content {
      display: flex;
      align-items: center;
      gap: 11px;
      min-width: 0;
    }
    .admin-warning-icon {
      width: 32px;
      height: 32px;
      border-radius: 12px;
      background: #fff;
      display: grid;
      place-items: center;
      color: #e46300;
      flex: 0 0 auto;
    }
    .admin-warning-card p {
      margin: 0;
      color: #a44400;
      font-size: 13px;
      line-height: 1.45;
      font-weight: 600;
    }
    .warning-actions {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .admin-link-btn {
      border: 0;
      background: transparent;
      color: #e46300;
      font-size: 12px;
      font-weight: 800;
      text-decoration: none;
      cursor: pointer;
      white-space: nowrap;
    }
    .admin-close-btn {
      border: 0;
      background: transparent;
      color: #e46300;
      font-size: 20px;
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 10px;
      line-height: 1;
    }
    .admin-close-btn:hover { background: rgba(228,99,0,.08); }
    @media (max-width: 680px) {
      .admin-warning-card { align-items: flex-start; }
    }
  `],
    template: `
    <section class="admin-warning-card">
      <div class="admin-warning-content">
        <span class="admin-warning-icon">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.7">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </span>
        <p><strong>Comercio abierto fuera de horario.</strong> El comercio está marcado como abierto, pero el horario configurado es <strong>{{ scheduleWindow }}</strong>.</p>
      </div>
      <div class="warning-actions">
        @if (showEditButton) {
          <button class="admin-link-btn" (click)="editSchedule.emit()">Editar horario</button>
        }
        @if (dismissible) {
          <button class="admin-close-btn" aria-label="Cerrar alerta" (click)="close.emit()">×</button>
        }
      </div>
    </section>
  `,
})
export class ScheduleWarningCardComponent {
    @Input({ required: true }) scheduleWindow = 'Horario no configurado';
    @Input() showEditButton = true;
    @Input() dismissible = true;

    @Output() editSchedule = new EventEmitter<void>();
    @Output() close = new EventEmitter<void>();
}
