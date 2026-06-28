import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-admin-badge',
    standalone: true,
    template: `
    <span class="admin-badge" [class]="badgeClass()">
      <ng-content />
    </span>
  `,
})
export class AdminBadgeComponent {
    @Input() variant:
        | 'success'
        | 'warning'
        | 'danger'
        | 'neutral'
        | 'primary'
        | 'new'
        | 'preparing'
        | 'route'
        | 'delivered'
        | 'cancelled' = 'neutral';

    badgeClass(): string {
        return `admin-badge--${this.variant}`;
    }
}

