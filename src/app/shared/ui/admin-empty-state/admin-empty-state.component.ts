import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
    selector: 'app-admin-empty-state',
    standalone: true,
    template: `
    <section
      class="admin-empty-state relative isolate overflow-hidden rounded-[24px] border border-[#e7eaf1] bg-white p-8 text-center shadow-[0_8px_24px_rgba(18,24,40,0.06)]"
      [class.admin-empty-state--soft]="variant === 'soft'"
    >
      <span class="pointer-events-none absolute right-[-48px] top-[-48px] h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(235,27,141,.16),transparent_70%)]"></span>
      <div class="admin-empty-state__icon mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-[#f5d0e7] bg-[#fff4fa] text-2xl shadow-[inset_0_1px_0_rgba(255,255,255,.9)]" aria-hidden="true">{{ iconGlyph() }}</div>
      <h3 class="admin-empty-state__title">{{ title }}</h3>
      <p class="admin-empty-state__description">{{ description }}</p>
      @if (actionLabel) {
        <button type="button" class="btn-secondary mt-5" [attr.aria-label]="actionLabel" (click)="action.emit()">
          {{ actionLabel }}
        </button>
      }
    </section>
  `,
    styles: [`
    .admin-empty-state {
      text-wrap: balance;
    }

    .admin-empty-state__title {
      margin: 0;
      color: #111827;
      font-size: clamp(1.1rem, 1rem + 0.55vw, 1.4rem);
      font-weight: 800;
      letter-spacing: -0.02em;
    }

    .admin-empty-state__description {
      margin: 0.55rem auto 0;
      max-width: 56ch;
      color: #667085;
      font-size: 0.96rem;
      line-height: 1.55;
    }

    .admin-empty-state--soft {
      background: #fbfcff;
      border-color: #edf1f8;
    }

    @media (max-width: 640px) {
      .admin-empty-state {
        padding: 1.25rem;
      }

      .admin-empty-state__description {
        font-size: 0.91rem;
      }
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
