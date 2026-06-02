import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type StatCardColor = 'green' | 'blue' | 'yellow' | 'red' | 'purple' | 'orange';
export type StatCardTrend = 'up' | 'down' | 'neutral';

@Component({
    selector: 'app-stat-card',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="bg-white rounded-xl border border-gray-200 shadow-theme-sm p-5">
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <p class="text-sm text-gray-500 font-medium truncate">{{ title }}</p>
          <p class="text-2xl font-bold text-gray-800 mt-1.5 tracking-tight">{{ value }}</p>
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
        <div
          class="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl text-xl"
          [class]="iconBg"
        >{{ icon }}</div>
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
    </div>
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
            green:  'bg-success-50 text-success-700',
            blue:   'bg-brand-50 text-brand-600',
            yellow: 'bg-warning-50 text-warning-700',
            red:    'bg-error-50 text-error-700',
            purple: 'bg-purple-50 text-purple-700',
            orange: 'bg-orange-50 text-orange-700',
        };
        return map[this.color];
    }

    get trendClass(): string {
        if (this.trend === 'up')   return 'text-success-600';
        if (this.trend === 'down') return 'text-error-600';
        return 'text-gray-400';
    }
}
