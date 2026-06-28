import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
    selector: 'app-admin-empty-state',
    standalone: true,
    template: `
    <section class="admin-empty-state" [class.admin-empty-state--soft]="variant === 'soft'">
      <div class="admin-empty-state__icon" aria-hidden="true">{{ iconGlyph() }}</div>
      <h3 class="admin-empty-state__title">{{ title }}</h3>
      <p class="admin-empty-state__description">{{ description }}</p>
      @if (actionLabel) {
        <button type="button" class="admin-btn admin-btn--secondary mt-4" (click)="action.emit()">
          {{ actionLabel }}
        </button>
      }
    </section>
  `,
    styles: [`
    .admin-empty-state--soft {
      background: #fbfcff;
    }
  `],
})
export class AdminEmptyStateComponent {
    @Input() icon: 'orders' | 'search' | 'map' | 'users' | 'money' | 'default' = 'default';
    @Input({ required: true }) title = '';
    @Input({ required: true }) description = '';
    @Input() actionLabel = '';
    @Input() variant: 'default' | 'soft' = 'default';

    @Output() action = new EventEmitter<void>();

    iconGlyph(): string {
        switch (this.icon) {
            case 'orders': return '🧾';
            case 'search': return '🔎';
            case 'map': return '🗺️';
            case 'users': return '👥';
            case 'money': return '💸';
            default: return 'ℹ️';
        }
    }
}

