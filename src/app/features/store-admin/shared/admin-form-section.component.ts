import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-admin-form-section',
    standalone: true,
    template: `
    <section class="admin-form-card">
      @if (title || subtitle) {
        <header class="admin-form-card__header">
          @if (title) {
            <h2 class="admin-card-title">{{ title }}</h2>
          }
          @if (subtitle) {
            <p class="text-xs text-gray-500 mt-1">{{ subtitle }}</p>
          }
        </header>
      }
      <div class="admin-form-card__body">
        <ng-content />
      </div>
    </section>
  `,
})
export class AdminFormSectionComponent {
    @Input() title = '';
    @Input() subtitle = '';
}

