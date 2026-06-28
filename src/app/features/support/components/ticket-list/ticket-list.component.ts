import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupportTicket, TicketStatus, TicketType, TicketPriority } from '../../services/support.service';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';
import { AdminEmptyStateComponent } from '../../../../shared/ui/admin-empty-state/admin-empty-state.component';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_BAR: Record<TicketPriority, string> = {
    urgente: 'bg-error-500',
    alta: 'bg-orange-500',
    media: 'bg-warning-400',
    baja: 'bg-success-500',
};

const REPORTER_AVATAR_BG: Record<string, string> = {
    cliente: 'bg-blue-500',
    store_admin: 'bg-orange-500',
    repartidor: 'bg-purple-500',
    excursion_operator: 'bg-success-600',
};

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

const TICKET_TYPE_LABEL: Record<TicketType, string> = {
    queja_pedido: 'Queja pedido',
    queja_repartidor: 'Queja repartidor',
    queja_comercio: 'Queja comercio',
    problema_tecnico: 'Problema técnico',
    solicitud_reembolso: 'Sol. reembolso',
    duda_general: 'Duda general',
    reporte_fraude: 'Reporte fraude',
    problema_pago: 'Problema pago',
    queja_excursion: 'Queja excursión',
    cancelacion_excursion: 'Cancelación exc.',
    otro: 'Otro',
};

function initials(name: string): string {
    return name
        .split(' ')
        .slice(0, 2)
        .map(w => w[0] ?? '')
        .join('')
        .toUpperCase();
}

// ─── TicketRowSkeletonComponent ───────────────────────────────────────────────

@Component({
    selector: 'app-ticket-row-skeleton',
    standalone: true,
    template: `
      <div class="flex items-center gap-3 px-4 py-3 animate-pulse">
        <!-- priority bar -->
        <div class="w-1 self-stretch rounded-full bg-gray-100 flex-shrink-0"></div>
        <!-- avatar -->
        <div class="w-9 h-9 rounded-full bg-gray-100 flex-shrink-0"></div>
        <!-- text -->
        <div class="flex-1 min-w-0 space-y-2">
          <div class="flex gap-2 items-center">
            <div class="h-3 bg-gray-100 rounded w-20"></div>
            <div class="h-3 bg-gray-100 rounded w-14"></div>
          </div>
          <div class="h-3.5 bg-gray-100 rounded w-3/4"></div>
          <div class="h-3 bg-gray-100 rounded w-1/2"></div>
        </div>
        <!-- meta -->
        <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
          <div class="h-5 bg-gray-100 rounded-full w-16"></div>
          <div class="h-3 bg-gray-100 rounded w-10"></div>
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
        class="relative flex items-stretch gap-3 px-4 py-3 cursor-pointer select-none
               transition-colors border-b border-gray-100 last:border-b-0"
        [class.border-l-2]="selected"
        [class.border-l-error-500]="selected"
        [class.bg-primary-50]="selected"
        [class.bg-error-50]="!selected && ticket.sla_breached"
        [class.hover:bg-gray-50]="!selected"
        (click)="rowClick.emit(ticket.id)"
        role="button"
        [attr.aria-selected]="selected"
      >
        <!-- Priority bar -->
        <div class="w-1 rounded-full flex-shrink-0 self-stretch" [class]="priorityBar"></div>

        <!-- Avatar -->
        <div class="flex-shrink-0 self-center">
          @if (ticket.reporter.avatar_url) {
            <img
              [src]="ticket.reporter.avatar_url"
              [alt]="ticket.reporter.full_name"
              class="w-9 h-9 rounded-full object-cover"
              loading="lazy"
            />
          } @else {
            <div
              class="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              [class]="avatarBg"
            >{{ avatarInitials }}</div>
          }
        </div>

        <!-- Text column -->
        <div class="flex-1 min-w-0">
          <!-- Row 1: ticket number + type badge + SLA -->
          <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span class="text-[11px] font-mono text-gray-400 flex-shrink-0">
              {{ ticket.ticket_number }}
            </span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium leading-none flex-shrink-0">
              {{ typeLabel }}
            </span>
            @if (ticket.sla_breached) {
              <span class="text-[10px] text-error-600 font-bold leading-none animate-pulse flex-shrink-0">
                ⚡ SLA vencido
              </span>
            }
          </div>

          <!-- Row 2: subject -->
          <p class="text-sm font-semibold text-gray-800 truncate leading-snug">
            {{ ticket.subject }}
          </p>

          <!-- Row 3: reporter + contextual links -->
          <p class="text-xs text-gray-500 truncate mt-0.5 leading-snug">
            {{ ticket.reporter.full_name }}
            <span class="mx-1 text-gray-300">·</span>
            {{ reporterTypeLabel }}
            @if (ticket.order) {
              <span class="mx-1 text-gray-300">·</span>
              <span class="text-gray-400">Pedido #{{ ticket.order.order_number }}</span>
            }
            @if (ticket.store) {
              <span class="mx-1 text-gray-300">·</span>
              <span class="text-gray-400">{{ ticket.store.name }}</span>
            }
          </p>
        </div>

        <!-- Meta column -->
        <div class="flex flex-col items-end justify-between gap-1 flex-shrink-0">
          <!-- Status badge -->
          <span
            class="text-[10px] px-2 py-0.5 rounded-full font-semibold leading-snug whitespace-nowrap"
            [class]="statusClass"
          >{{ statusLabel }}</span>

          <!-- Time ago -->
          <span class="text-[11px] text-gray-400 whitespace-nowrap">
            {{ ticket.created_at | timeAgo }}
          </span>

          <!-- Unread count -->
          @if (ticket.unread_count > 0) {
            <span
              class="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full
                     bg-blue-500 text-white text-[10px] font-bold"
            >{{ ticket.unread_count > 9 ? '9+' : ticket.unread_count }}</span>
          }
        </div>
      </div>
    `,
})
export class TicketRowComponent {
    @Input({ required: true }) ticket!: SupportTicket;
    @Input() selected = false;
    @Output() rowClick = new EventEmitter<string>();

    get priorityBar(): string {
        return PRIORITY_BAR[this.ticket.priority] ?? 'bg-gray-200';
    }

    get avatarBg(): string {
        return REPORTER_AVATAR_BG[this.ticket.reporter_type] ?? 'bg-gray-400';
    }

    get avatarInitials(): string {
        return initials(this.ticket.reporter.full_name);
    }

    get typeLabel(): string {
        return TICKET_TYPE_LABEL[this.ticket.type] ?? this.ticket.type;
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
