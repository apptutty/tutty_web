import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from './toast.service';

@Component({
    selector: 'app-toast-container',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex items-start gap-3 rounded-xl p-4 shadow-lg border text-sm font-medium animate-slide-in"
          [class]="toastClasses[toast.type]"
        >
          <span class="text-base leading-none mt-0.5">{{ toastIcons[toast.type] }}</span>
          <span class="flex-1">{{ toast.message }}</span>
          <button
            (click)="toastService.remove(toast.id)"
            class="opacity-60 hover:opacity-100 transition-opacity leading-none"
          >✕</button>
        </div>
      }
    </div>
  `,
    styles: [`
    @keyframes slide-in {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .animate-slide-in { animation: slide-in 0.25s ease-out; }
  `],
})
export class ToastContainerComponent {
    readonly toastService = inject(ToastService);

    readonly toastClasses: Record<string, string> = {
        success: 'bg-success-50 border-success-200 text-success-700',
        error: 'bg-error-50 border-error-200 text-error-700',
        warning: 'bg-warning-50 border-warning-200 text-warning-700',
        info: 'bg-brand-50 border-brand-200 text-brand-700',
    };

    readonly toastIcons: Record<string, string> = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️',
    };
}
