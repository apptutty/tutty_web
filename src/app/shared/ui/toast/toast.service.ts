import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
    readonly toasts = signal<Toast[]>([]);

    success(message: string): void { this.add('success', message); }
    error(message: string): void { this.add('error', message); }
    warning(message: string): void { this.add('warning', message); }
    info(message: string): void { this.add('info', message); }

    private add(type: ToastType, message: string): void {
        const id = crypto.randomUUID();
        this.toasts.update(t => [...t, { id, type, message }]);
        setTimeout(() => this.remove(id), 4000);
    }

    remove(id: string): void {
        this.toasts.update(t => t.filter(toast => toast.id !== id));
    }
}
