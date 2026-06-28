import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
    selector: 'app-admin-page-header',
    standalone: true,
    template: `
    <section class="admin-page-header">
      <div class="admin-page-header__content">
        <div class="min-w-0 flex items-start gap-3">
          @if (showBack) {
            <button
              type="button"
              class="admin-icon-btn mt-0.5"
              [attr.aria-label]="backAriaLabel"
              (click)="back.emit()"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
          }
          <div class="min-w-0">
            <h1 class="admin-page-title">{{ title }}</h1>
            @if (subtitle) {
              <p class="admin-page-subtitle">{{ subtitle }}</p>
            }
          </div>
        </div>
        <div class="admin-page-header__actions">
          <ng-content select="[actions]" />
        </div>
      </div>
      <ng-content />
    </section>
  `,
    styles: [`
    .admin-page-title {
      margin: 0;
      font-size: 26px;
      line-height: 1.1;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #0f172a;
    }
    .admin-page-subtitle {
      margin: 6px 0 0;
      color: #64748b;
      font-size: 13px;
      font-weight: 600;
    }
    @media (max-width: 768px) {
      .admin-page-title {
        font-size: 21px;
      }
      .admin-page-subtitle {
        font-size: 12px;
      }
    }
  `],
})
export class AdminPageHeaderComponent {
    @Input({ required: true }) title = '';
    @Input() subtitle = '';
    @Input() showBack = false;
    @Input() backAriaLabel = 'Volver';

    @Output() back = new EventEmitter<void>();
}

