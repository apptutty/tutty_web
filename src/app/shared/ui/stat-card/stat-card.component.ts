import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type StatCardColor = 'green' | 'blue' | 'yellow' | 'red' | 'purple' | 'orange';
export type StatCardTrend = 'up' | 'down' | 'neutral';

@Component({
    selector: 'app-stat-card',
    standalone: true,
    imports: [CommonModule],
    template: `
    <article class="bg-white rounded-[22px] border border-[#e7eaf1] shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4 sm:p-5">
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <p class="text-xs text-[#7b8496] font-extrabold truncate">{{ title }}</p>
          <p class="text-[22px] leading-none font-black text-[#111827] mt-1.5 tracking-[-0.04em]">{{ value }}</p>
          @if (subtitle) {
            <p class="text-xs mt-1.5 flex items-center gap-1" [class]="trendClass">
              @if (trend !== 'neutral') {
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd"
                    [attr.d]="trend === 'up'
                      ? 'M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z'
                      : 'M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z'"
                    clip-rule="evenodd"
                  />
                </svg>
              }
              <span>{{ subtitle }}</span>
            </p>
          }
        </div>
        <div class="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-2xl text-lg" [class]="iconBg">{{ icon }}</div>
      </div>

      @if (pulse) {
        <div class="mt-3 flex items-center gap-2">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-success-500"></span>
          </span>
          <span class="text-xs text-success-600 font-medium">En vivo</span>
        </div>
      }
    </article>
  `,
})
export class StatCardComponent {
    @Input() title = '';
    @Input() value: string | number = 0;
    @Input() subtitle = '';
    @Input() icon = '';
    @Input() trend: StatCardTrend = 'neutral';
    @Input() color: StatCardColor = 'blue';
    @Input() pulse = false;

    get iconBg(): string {
        const map: Record<StatCardColor, string> = {
            green: 'bg-[#eafbf1] text-[#087b3c]',
            blue: 'bg-[#eef4ff] text-[#2451c7]',
            yellow: 'bg-[#fff7dc] text-[#b54708]',
            red: 'bg-[#fee2e2] text-[#b42318]',
            purple: 'bg-[#f4ecff] text-[#6d28d9]',
            orange: 'bg-[#fff6e6] text-[#e46300]',
        };
        return map[this.color];
    }

    get trendClass(): string {
        if (this.trend === 'up') return 'text-success-600';
        if (this.trend === 'down') return 'text-error-600';
        return 'text-gray-400';
    }
}
