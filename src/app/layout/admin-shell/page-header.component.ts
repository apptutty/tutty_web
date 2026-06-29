import { Component, Input, ContentChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-page-header',
    standalone: true,
    imports: [CommonModule],
    template: `
    <section class="rounded-[28px] border border-[#e7eaf1] bg-[radial-gradient(circle_at_94%_12%,rgba(235,27,141,.12),transparent_25%),linear-gradient(180deg,#fff,#fbfcff)] shadow-[0_8px_24px_rgba(18,24,40,.07)] px-6 py-5 mb-5">
      <div class="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
        <div class="min-w-0">
          @if (resolvedEyebrow()) {
            <p class="inline-flex items-center rounded-full bg-[#ffe7f4] px-3 py-1 text-[11px] font-extrabold tracking-wide text-[#c71473]">{{ resolvedEyebrow() }}</p>
          }
          <h1 class="mt-2 text-[30px] leading-[1.08] tracking-[-0.04em] font-bold text-[#111827] truncate">{{ title }}</h1>
          @if (subtitle) {
            <p class="mt-2 max-w-4xl text-[15px] leading-6 text-[#667085]">{{ subtitle }}</p>
          }
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 xl:flex xl:flex-wrap xl:justify-end">
          <ng-content></ng-content>
        </div>
      </div>
    </section>
  `,
})
export class PageHeaderComponent {
    @Input() title = '';
    @Input() subtitle = '';
    @Input() eyebrow = '';

    resolvedEyebrow(): string {
        if (this.eyebrow.trim()) return this.eyebrow.trim();
        return this.title.trim() ? 'Operations · Platform Admin' : '';
    }
}
