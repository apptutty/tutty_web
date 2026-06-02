import { Component, Input, ContentChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-page-header',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="flex items-start justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold text-gray-800 tracking-tight">{{ title }}</h1>
        @if (subtitle) {
          <p class="text-sm text-gray-500 mt-1">{{ subtitle }}</p>
        }
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
    @Input() title = '';
    @Input() subtitle = '';
}
