import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupportTicket, TicketStatus, TicketPriority } from '../../services/support.service';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';
import { AdminEmptyStateComponent } from '../../../../shared/ui/admin-empty-state/admin-empty-state.component';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
    abierto: 'Abierto',
    en_revision: 'En revisión',
    esperando_respuesta: 'Esperando resp.',
    escalado: 'Escalado',
    resuelto: 'Resuelto',
    cerrado: 'Cerrado',
};

const TICKET_STATUS_CLASS: Record<TicketStatus, string> = {
    abierto: 'bg-blue-100 text-blue-700',
    en_revision: 'bg-yellow-100 text-yellow-700',
    esperando_respuesta: 'bg-orange-100 text-orange-700',
    escalado: 'bg-error-100 text-error-700',
    resuelto: 'bg-success-100 text-success-700',
    cerrado: 'bg-gray-100 text-gray-500',
};

const PRIORITY_LABEL: Record<TicketPriority, string> = {
    urgente: 'Urgente',
    alta: 'Alta',
    media: 'Media',
    baja: 'Baja',
};

const PRIORITY_CLASS: Record<TicketPriority, string> = {
    urgente: 'bg-red-100 text-red-700',
    alta: 'bg-yellow-100 text-yellow-700',
    media: 'bg-blue-100 text-blue-700',
    baja: 'bg-gray-100 text-gray-700',
};

// ─── TicketRowSkeletonComponent ───────────────────────────────────────────────

@Component({
    selector: 'app-ticket-row-skeleton',
    standalone: true,
    template: `
      <div class="rounded-3xl border border-gray-200 p-4 bg-white animate-pulse">
        <div class="flex items-center justify-between gap-3">
          <div class="h-3.5 bg-gray-100 rounded w-28"></div>
          <div class="h-3.5 bg-gray-100 rounded w-16"></div>
        </div>
        <div class="h-5 bg-gray-100 rounded w-2/3 mt-2.5"></div>
        <div class="h-3.5 bg-gray-100 rounded w-5/6 mt-2"></div>
        <div class="flex gap-2 mt-3.5">
          <div class="h-6 bg-gray-100 rounded-full w-16"></div>
          <div class="h-6 bg-gray-100 rounded-full w-20"></div>
          <div class="h-6 bg-gray-100 rounded-full w-16"></div>
        </div>
      </div>
    `,
})
export class TicketRowSkeletonComponent { }

// ─── TicketRowComponent ───────────────────────────────────────────────────────

@Component({
    selector: 'app-ticket-row',
    standalone: true,
    imports: [CommonModule, TimeAgoPipe],
    template: `
      <div
        class="rounded-3xl border p-4 cursor-pointer select-none transition-colors"
        [class.border-[#f7c4de]]="selected"
        [class.bg-[#fff8fc]]="selected"
        [class.border-gray-200]="!selected"
        [class.hover:bg-gray-50]="!selected"
        (click)="rowClick.emit(ticket.id)"
        role="button"
        [attr.aria-selected]="selected"
      >
        <div class="flex items-start justify-between gap-3">
          <span class="text-xs font-black text-[#ec2a8f]">{{ ticket.ticket_number }}</span>
          <span class="text-xs font-semibold text-gray-400 whitespace-nowrap">{{ ticket.created_at | timeAgo }}</span>
        </div>

        <h3 class="text-[16px] md:text-[18px] leading-[1.3] tracking-tight font-black text-gray-900 mt-2">
          {{ ticket.subject }}
        </h3>

        <p class="text-[13px] md:text-[14px] leading-relaxed text-gray-500 mt-1.5 line-clamp-2">
          {{ ticket.description }}
        </p>

        <div class="flex flex-wrap items-center gap-1.5 mt-3.5">
          <span
            class="text-xs px-2.5 py-1 rounded-full font-semibold leading-snug whitespace-nowrap"
            [class]="statusClass"
          >{{ statusLabel }}</span>
          <span class="text-xs px-2.5 py-1 rounded-full font-semibold leading-snug whitespace-nowrap" [class]="priorityClass">
            {{ priorityLabel }}
          </span>
          <span class="text-xs px-2.5 py-1 rounded-full font-semibold bg-blue-50 text-blue-700">{{ reporterTypeLabel }}</span>
          <span class="text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-100 text-slate-600">
            {{ ticket.assigned_to?.full_name ?? 'Sin asignar' }}
          </span>
          @if (ticket.sla_breached) {
            <span class="text-xs px-2.5 py-1 rounded-full font-semibold bg-orange-100 text-orange-700">SLA vencido</span>
          }
        </div>
      </div>
    `,
})
export class TicketRowComponent {
    @Input({ required: true }) ticket!: SupportTicket;
    @Input() selected = false;
    @Output() rowClick = new EventEmitter<string>();

    get priorityClass(): string {
        return PRIORITY_CLASS[this.ticket.priority] ?? 'bg-gray-100 text-gray-700';
    }

    get priorityLabel(): string {
        return PRIORITY_LABEL[this.ticket.priority] ?? this.ticket.priority;
    }

    get reporterTypeLabel(): string {
        const map: Record<string, string> = {
            cliente: 'Cliente',
            store_admin: 'Comercio',
            repartidor: 'Repartidor',
            excursion_operator: 'Operador',
        };
        return map[this.ticket.reporter_type] ?? this.ticket.reporter_type;
    }

    get statusLabel(): string {
        return TICKET_STATUS_LABEL[this.ticket.status] ?? this.ticket.status;
    }

    get statusClass(): string {
        return TICKET_STATUS_CLASS[this.ticket.status] ?? 'bg-gray-100 text-gray-600';
    }
}

// ─── SupportTicketListComponent ───────────────────────────────────────────────

@Component({
    selector: 'app-support-ticket-list',
    standalone: true,
    imports: [CommonModule, TicketRowComponent, TicketRowSkeletonComponent, AdminEmptyStateComponent],
    template: `
      <div class="flex flex-col h-full overflow-y-auto">

        <!-- Skeleton -->
        @if (loading) {
          @for (_ of skeletonRows; track $index) {
            <app-ticket-row-skeleton />
          }

        <!-- Empty state -->
        } @else if (tickets.length === 0) {
          <div class="flex items-center justify-center flex-1 py-16 px-6 text-center text-gray-400">
            <app-admin-empty-state
              icon="search"
              title="No hay tickets aquí"
              [description]="emptySubtext"
              variant="soft" />
          </div>

        <!-- List -->
        } @else {
          @for (ticket of tickets; track ticket.id) {
            <app-ticket-row
              [ticket]="ticket"
              [selected]="ticket.id === selectedTicketId"
              (rowClick)="ticketSelect.emit($event)"
            />
          }
        }

      </div>
    `,
})
export class SupportTicketListComponent {
    @Input() tickets: SupportTicket[] = [];
    @Input() loading = false;
    @Input() selectedTicketId: string | null = null;
    @Input() activeFilterLabel = '';
    @Output() ticketSelect = new EventEmitter<string>();

    readonly skeletonRows = Array(8);

    get emptySubtext(): string {
        const map: Record<string, string> = {
            'Sin asignar': 'Todos los tickets tienen un agente asignado.',
            'Asignados a mí': 'No tienes tickets asignados en este momento.',
            'SLA vencido': 'Ningún ticket tiene el SLA vencido. ¡Todo en orden!',
            'Abierto': 'No hay tickets abiertos con estos filtros.',
            'Escalado': 'No hay tickets escalados actualmente.',
        };
        return map[this.activeFilterLabel] ?? 'Prueba cambiando los filtros activos.';
    }
}
