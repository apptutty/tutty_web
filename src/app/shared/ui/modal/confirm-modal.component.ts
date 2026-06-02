import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService } from './confirm.service';

@Component({
    selector: 'app-confirm-modal',
    standalone: true,
    imports: [CommonModule],
    template: `
    @if (confirmService.state()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          (click)="confirmService.cancel()"
        ></div>

        <!-- Modal -->
        <div class="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 z-10">
          <h3 class="text-lg font-semibold text-gray-800 mb-2">
            {{ confirmService.state()!.title }}
          </h3>
          <p class="text-sm text-gray-600 mb-6">
            {{ confirmService.state()!.message }}
          </p>
          <div class="flex gap-3 justify-end">
            <button class="btn-secondary" (click)="confirmService.cancel()">
              {{ confirmService.state()!.cancelText ?? 'Cancelar' }}
            </button>
            <button
              [class]="confirmService.state()!.danger ? 'btn-danger' : 'btn-primary'"
              (click)="confirmService.accept()"
            >
              {{ confirmService.state()!.confirmText ?? 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmModalComponent {
    readonly confirmService = inject(ConfirmService);
}
