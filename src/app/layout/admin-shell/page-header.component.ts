import { Component, Input, ContentChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-page-header',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
      <div class="min-w-0">
        <h1 class="text-xl font-bold text-gray-800 tracking-tight truncate">{{ title }}</h1>
        @if (subtitle) {
          <p class="text-sm text-gray-500 mt-1">{{ subtitle }}</p>
        }
      </div>
      <div class="flex items-center gap-2 flex-shrink-0 flex-wrap">
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
    @Input() title = '';
    @Input() subtitle = '';
}
