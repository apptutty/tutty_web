import {
    Component, Input, OnChanges, SimpleChanges, OnDestroy,
    inject, signal, computed, ElementRef, ViewChild, AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
    SupportService, SupportTicketDetail, TicketMessage,
    TicketStatus, TicketPriority,
} from '../../services/support.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';
import { CurrencyDopPipe } from '../../../../shared/pipes/currency-dop.pipe';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<TicketStatus, string> = {
    abierto: 'Abierto',
    en_revision: 'En revisión',
    esperando_respuesta: 'Esperando respuesta',
    escalado: 'Escalado',
    resuelto: 'Resuelto',
    cerrado: 'Cerrado',
};

const STATUS_CLASS: Record<TicketStatus, string> = {
    abierto: 'bg-blue-100 text-blue-700',
    en_revision: 'bg-yellow-100 text-yellow-700',
    esperando_respuesta: 'bg-orange-100 text-orange-700',
    escalado: 'bg-error-100 text-error-700',
    resuelto: 'bg-success-100 text-success-700',
    cerrado: 'bg-gray-100 text-gray-500',
};

const PRIORITY_LABEL: Record<TicketPriority, string> = {
    urgente: 'Urgente', alta: 'Alta', media: 'Media', baja: 'Baja',
};

const PRIORITY_CLASS: Record<TicketPriority, string> = {
    urgente: 'bg-error-100 text-error-700',
    alta: 'bg-orange-100 text-orange-700',
    media: 'bg-warning-100 text-warning-700',
    baja: 'bg-success-100 text-success-700',
};

const QUICK_REPLIES = [
    'Hola, hemos recibido tu reporte y lo estamos revisando. Te responderemos pronto.',
    'Hemos procesado tu reembolso exitosamente. Verás el crédito en 3-5 días hábiles.',
    'Tu pedido ha sido compensado con un crédito de RD$200 en tu cuenta.',
    'El repartidor fue notificado y el incidente ha sido registrado en su historial.',
    'Disculpa los inconvenientes. Te ofrecemos el código promo TUTTY10 para tu próximo pedido.',
];

function initials(name: string): string {
    return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
}

function hoursDiff(a: string, b: string): number {
    return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
}

function slaTimeLeft(deadline: string): { label: string; urgent: boolean } {
    const ms = new Date(deadline).getTime() - Date.now();
    if (ms <= 0) return { label: 'SLA vencido', urgent: true };
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    if (h === 0) return { label: `SLA vence en ${m}min`, urgent: true };
    if (h < 3)   return { label: `SLA vence en ${h}h ${m}min`, urgent: true };
    return { label: `SLA vence en ${h}h`, urgent: false };
}

// ─── TicketMessageBubbleComponent ─────────────────────────────────────────────

@Component({
    selector: 'app-ticket-message-bubble',
    standalone: true,
    imports: [CommonModule, TimeAgoPipe],
    template: `
      <!-- System message -->
      @if (msg.sender_role === 'sistema') {
        <div class="flex items-center gap-3 py-1 my-2">
          <div class="flex-1 h-px bg-gray-100"></div>
          <span class="text-[11px] text-gray-400 whitespace-nowrap">
            {{ msg.message }}
            <span class="ml-1 opacity-60">· {{ msg.created_at | timeAgo }}</span>
          </span>
          <div class="flex-1 h-px bg-gray-100"></div>
        </div>

      <!-- Internal note -->
      } @else if (msg.is_internal) {
        <div class="flex gap-2 my-3">
          <div class="w-7 h-7 rounded-full bg-warning-200 flex items-center justify-center text-[10px] font-bold text-warning-800 flex-shrink-0 mt-0.5">
            {{ senderInitials }}
          </div>
          <div class="flex-1 max-w-xl">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-semibold text-gray-700">{{ msg.sender?.full_name ?? 'Agente' }}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-warning-100 text-warning-700 font-semibold">Nota interna</span>
              <span class="text-[10px] text-gray-400">{{ msg.created_at | timeAgo }}</span>
            </div>
            <div class="bg-warning-50 border border-warning-200 rounded-lg rounded-tl-none px-3.5 py-2.5 text-sm text-gray-700 whitespace-pre-wrap">
              {{ msg.message }}
            </div>
            @if (msg.attachments.length) {
              <div class="flex flex-wrap gap-1.5 mt-1.5">
                @for (url of msg.attachments; track url) {
                  <a [href]="url" target="_blank" rel="noopener"
                     class="flex items-center gap-1 text-[11px] text-primary-600 hover:underline bg-gray-50 border border-gray-200 rounded px-2 py-1">
                    📎 Adjunto
                  </a>
                }
              </div>
            }
          </div>
        </div>

      <!-- Support message (right) -->
      } @else if (msg.sender_role === 'soporte') {
        <div class="flex gap-2 justify-end my-3">
          <div class="flex-1 max-w-xl">
            <div class="flex items-center justify-end gap-2 mb-1">
              <span class="text-[10px] text-gray-400">{{ msg.created_at | timeAgo }}</span>
              <span class="text-xs font-semibold text-gray-700">{{ msg.sender?.full_name ?? 'Soporte Tutty' }}</span>
            </div>
            <div class="bg-error-50 border border-error-100 rounded-lg rounded-tr-none px-3.5 py-2.5 text-sm text-gray-800 whitespace-pre-wrap">
              {{ msg.message }}
            </div>
            @if (msg.attachments.length) {
              <div class="flex flex-wrap gap-1.5 mt-1.5 justify-end">
                @for (url of msg.attachments; track url) {
                  <a [href]="url" target="_blank" rel="noopener"
                     class="flex items-center gap-1 text-[11px] text-primary-600 hover:underline bg-gray-50 border border-gray-200 rounded px-2 py-1">
                    📎 Adjunto
                  </a>
                }
              </div>
            }
          </div>
          <div class="w-7 h-7 rounded-full bg-error-100 flex items-center justify-center text-[10px] font-bold text-error-700 flex-shrink-0 mt-0.5">
            {{ senderInitials }}
          </div>
        </div>

      <!-- User / client message (left) -->
      } @else {
        <div class="flex gap-2 my-3">
          @if (msg.sender?.avatar_url) {
            <img [src]="msg.sender!.avatar_url" [alt]="msg.sender!.full_name"
                 class="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5" />
          } @else {
            <div class="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5">
              {{ senderInitials }}
            </div>
          }
          <div class="flex-1 max-w-xl">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-semibold text-gray-700">{{ msg.sender?.full_name ?? 'Usuario' }}</span>
              <span class="text-[10px] text-gray-400">{{ msg.created_at | timeAgo }}</span>
            </div>
            <div class="bg-gray-100 rounded-lg rounded-tl-none px-3.5 py-2.5 text-sm text-gray-800 whitespace-pre-wrap">
              {{ msg.message }}
            </div>
            @if (msg.attachments.length) {
              <div class="flex flex-wrap gap-1.5 mt-1.5">
                @for (url of msg.attachments; track url) {
                  <a [href]="url" target="_blank" rel="noopener"
                     class="flex items-center gap-1 text-[11px] text-primary-600 hover:underline bg-gray-50 border border-gray-200 rounded px-2 py-1">
                    📎 Adjunto
                  </a>
                }
              </div>
            }
          </div>
        </div>
      }
    `,
})
export class TicketMessageBubbleComponent {
    @Input({ required: true }) msg!: TicketMessage;

    get senderInitials(): string {
        return initials(this.msg.sender?.full_name ?? 'S');
    }
}

// ─── SupportTicketDetailComponent (main) ─────────────────────────────────────

@Component({
    selector: 'app-support-ticket-detail',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, TicketMessageBubbleComponent, TimeAgoPipe, CurrencyDopPipe],
    template: `
    @if (loading()) {
      <div class="flex items-center justify-center h-full">
        <div class="animate-spin w-8 h-8 border-4 border-error-400 border-t-transparent rounded-full"></div>
      </div>
    } @else if (ticket()) {
      <div class="flex h-full min-h-0 overflow-hidden">

        <!-- ═══ LEFT: HEADER + CONVERSATION + COMPOSER ═══════════════════════ -->
        <div class="flex flex-col flex-1 min-w-0 border-r border-gray-200">

          <!-- ── Header ──────────────────────────────────────────────────────── -->
          <div class="flex-shrink-0 border-b border-gray-200 px-4 py-3 space-y-2 bg-white">

            <!-- Row 1: number, badges, actions -->
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs font-mono text-gray-400 flex-shrink-0">{{ ticket()!.ticket_number }}</span>
              <span class="text-[11px] px-2 py-0.5 rounded-full font-semibold leading-snug" [class]="statusClass()">
                {{ statusLabel() }}
              </span>
              <span class="text-[11px] px-2 py-0.5 rounded-full font-semibold leading-snug" [class]="priorityClass()">
                {{ priorityLabel() }}
              </span>

              <div class="flex-1"></div>

              <!-- Change status dropdown -->
              <div class="relative">
                <button
                  class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  (click)="showStatusMenu.set(!showStatusMenu())"
                >
                  Cambiar estado
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                @if (showStatusMenu()) {
                  <div class="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1 min-w-[160px]"
                       (click)="showStatusMenu.set(false)">
                    @for (s of allStatuses; track s) {
                      <button
                        class="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
                        [class.font-semibold]="s === ticket()!.status"
                        (click)="changeStatus(s)"
                      >{{ statusLabels[s] }}</button>
                    }
                  </div>
                }
              </div>

              <!-- Escalate -->
              <button
                class="px-2.5 py-1.5 rounded-lg border border-orange-200 text-xs font-medium text-orange-600 hover:bg-orange-50 transition-colors"
                [disabled]="saving()"
                (click)="changeStatus('escalado')"
              >⚡ Escalar</button>

              <!-- Close -->
              <button
                class="px-2.5 py-1.5 rounded-lg border border-error-200 text-xs font-medium text-error-600 hover:bg-error-50 transition-colors"
                [disabled]="saving()"
                (click)="changeStatus('cerrado')"
              >Cerrar ticket</button>
            </div>

            <!-- Row 2: subject -->
            <h2 class="text-base font-bold text-gray-800 leading-snug">{{ ticket()!.subject }}</h2>

            <!-- Row 3: reporter + SLA -->
            <div class="flex flex-wrap items-center gap-3 text-xs text-gray-500">
              <div class="flex items-center gap-1.5">
                @if (ticket()!.reporter.avatar_url) {
                  <img [src]="ticket()!.reporter.avatar_url" class="w-5 h-5 rounded-full object-cover" />
                } @else {
                  <div class="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[9px] font-bold text-white">
                    {{ reporterInitials }}
                  </div>
                }
                <span class="font-medium text-gray-700">{{ ticket()!.reporter.full_name }}</span>
                <span class="text-gray-400">·</span>
                <span>{{ ticket()!.reporter.email }}</span>
              </div>
              <span class="text-gray-300">|</span>
              <span>Abierto {{ ticket()!.created_at | timeAgo }}</span>
              <span class="text-gray-300">·</span>
              <span [class.text-error-600]="slaInfo().urgent" [class.animate-pulse]="slaInfo().urgent && ticket()!.sla_breached">
                {{ slaInfo().label }}
              </span>
            </div>
          </div>

          <!-- ── Conversation ──────────────────────────────────────────────── -->
          <div #conversationEl class="flex-1 overflow-y-auto px-4 py-2 bg-gray-50">
            @for (msg of messages(); track msg.id; let i = $index) {
              <!-- Time separator if >2h gap -->
              @if (i > 0 && hoursBetween(messages()[i-1].created_at, msg.created_at) > 2) {
                <div class="flex items-center gap-3 my-4">
                  <div class="flex-1 h-px bg-gray-200"></div>
                  <span class="text-[11px] text-gray-400">{{ msg.created_at | timeAgo }}</span>
                  <div class="flex-1 h-px bg-gray-200"></div>
                </div>
              }
              <app-ticket-message-bubble [msg]="msg" />
            } @empty {
              <div class="flex items-center justify-center h-full text-gray-400">
                <p class="text-sm">Aún no hay mensajes. Sé el primero en responder.</p>
              </div>
            }
          </div>

          <!-- ── Composer ─────────────────────────────────────────────────── -->
          <div class="flex-shrink-0 border-t border-gray-200 bg-white">

            <!-- Tabs -->
            <div class="flex border-b border-gray-100">
              <button
                class="px-4 py-2.5 text-xs font-medium transition-colors border-b-2"
                [class]="composerTab() === 'respuesta'
                  ? 'border-error-500 text-error-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'"
                (click)="composerTab.set('respuesta')"
              >Respuesta al cliente</button>
              <button
                class="px-4 py-2.5 text-xs font-medium transition-colors border-b-2"
                [class]="composerTab() === 'nota'
                  ? 'border-warning-500 text-warning-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'"
                (click)="composerTab.set('nota')"
              >🔒 Nota interna</button>
            </div>

            <div class="px-4 py-3 space-y-2" [class.bg-warning-50]="composerTab() === 'nota'">

              <!-- Quick replies -->
              <div class="flex items-center gap-2">
                <div class="relative">
                  <button
                    class="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 transition-colors"
                    (click)="showReplies.set(!showReplies())"
                  >
                    📋 Usar plantilla
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  @if (showReplies()) {
                    <div class="absolute bottom-full mb-1 left-0 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1 w-80"
                         (click)="showReplies.set(false)">
                      @for (reply of quickReplies; track $index) {
                        <button
                          class="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors line-clamp-2"
                          (click)="applyQuickReply(reply)"
                        >{{ reply }}</button>
                      }
                    </div>
                  }
                </div>
              </div>

              <!-- Textarea -->
              <textarea
                class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-error-300 transition-shadow"
                [class.border-warning-300]="composerTab() === 'nota'"
                [class.focus:ring-warning-300]="composerTab() === 'nota'"
                rows="3"
                style="min-height:72px; max-height:192px; field-sizing:content"
                [placeholder]="composerPlaceholder"
                [(ngModel)]="composerText"
              ></textarea>

              <!-- Attachments preview -->
              @if (attachmentFiles().length > 0) {
                <div class="flex flex-wrap gap-1.5">
                  @for (f of attachmentFiles(); track f.name) {
                    <div class="flex items-center gap-1 bg-gray-100 rounded px-2 py-0.5 text-xs text-gray-600">
                      📎 {{ f.name }}
                      <button class="ml-1 text-gray-400 hover:text-error-500" (click)="removeAttachment(f)">×</button>
                    </div>
                  }
                </div>
              }

              <!-- Toolbar -->
              <div class="flex items-center gap-2">
                <!-- File input -->
                <label class="cursor-pointer p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <input type="file" multiple class="hidden" (change)="onFileChange($event)" />
                </label>

                <div class="flex-1"></div>

                <!-- Resolve + close -->
                <button
                  class="px-3 py-1.5 rounded-lg border border-success-200 text-xs font-medium text-success-700 hover:bg-success-50 transition-colors disabled:opacity-50"
                  [disabled]="sending() || !composerText.trim()"
                  (click)="sendAndResolve()"
                >✅ Resolver y cerrar</button>

                <!-- Send -->
                <button
                  class="px-4 py-1.5 rounded-lg bg-error-600 hover:bg-error-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  [disabled]="sending() || !composerText.trim()"
                  (click)="send()"
                >
                  @if (sending()) {
                    <span class="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full"></span>
                  }
                  Responder
                </button>
              </div>
            </div>
          </div>

        </div>

        <!-- ═══ RIGHT: CONTEXT PANEL ═════════════════════════════════════════ -->
        <div class="w-72 flex-shrink-0 bg-white overflow-y-auto flex flex-col divide-y divide-gray-100">

          <!-- ── Card 1: Reporter info ──────────────────────────────────────── -->
          <div class="p-4">
            <button
              class="flex items-center justify-between w-full text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3"
              (click)="cardOpen.reporter = !cardOpen.reporter"
            >
              Reporter
              <svg class="w-3.5 h-3.5 transition-transform" [class.rotate-180]="cardOpen.reporter"
                   fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            @if (cardOpen.reporter) {
              <div class="space-y-3">
                <div class="flex items-center gap-3">
                  @if (ticket()!.reporter.avatar_url) {
                    <img [src]="ticket()!.reporter.avatar_url" class="w-14 h-14 rounded-full object-cover flex-shrink-0" />
                  } @else {
                    <div class="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
                      {{ reporterInitials }}
                    </div>
                  }
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-gray-800 truncate">{{ ticket()!.reporter.full_name }}</p>
                    <p class="text-xs text-gray-500 truncate">{{ ticket()!.reporter.email }}</p>
                    <span class="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                      {{ reporterTypeLabel }}
                    </span>
                  </div>
                </div>

                <!-- Action buttons -->
                <div class="grid grid-cols-3 gap-1.5">
                  <a
                    [href]="'https://wa.me/' + ticket()!.reporter.role"
                    target="_blank" rel="noopener"
                    class="flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg bg-success-50 text-success-700 hover:bg-success-100 transition-colors"
                  >
                    <span class="text-base">📱</span>
                    <span class="text-[10px] font-medium">WhatsApp</span>
                  </a>
                  <a
                    [href]="'mailto:' + ticket()!.reporter.email"
                    class="flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    <span class="text-base">📧</span>
                    <span class="text-[10px] font-medium">Email</span>
                  </a>
                  <a
                    [routerLink]="['/settings/usuarios']"
                    class="flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <span class="text-base">👤</span>
                    <span class="text-[10px] font-medium">Perfil</span>
                  </a>
                </div>
              </div>
            }
          </div>

          <!-- ── Card 2: Context (order / booking / store / repartidor) ─────── -->
          @if (ticket()!.order || ticket()!.booking || ticket()!.store || ticket()!.repartidor) {
            <div class="p-4">
              <button
                class="flex items-center justify-between w-full text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3"
                (click)="cardOpen.context = !cardOpen.context"
              >
                Contexto
                <svg class="w-3.5 h-3.5 transition-transform" [class.rotate-180]="cardOpen.context"
                     fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              @if (cardOpen.context) {
                <div class="space-y-3 text-sm">

                  @if (ticket()!.order) {
                    <div class="bg-gray-50 rounded-lg p-3 space-y-1.5">
                      <p class="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Pedido relacionado</p>
                      <div class="flex items-center justify-between">
                        <span class="font-mono text-xs text-gray-600">#{{ ticket()!.order!.order_number }}</span>
                        <span class="text-xs font-semibold text-gray-700">{{ ticket()!.order!.total | currencyDop }}</span>
                      </div>
                      <a [routerLink]="['/orders', ticket()!.order!.id]"
                         class="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline mt-1">
                        Ver pedido completo →
                      </a>
                    </div>
                  }

                  @if (ticket()!.booking) {
                    <div class="bg-gray-50 rounded-lg p-3 space-y-1.5">
                      <p class="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Reserva relacionada</p>
                      <span class="font-mono text-xs text-gray-600">#{{ ticket()!.booking!.booking_number }}</span>
                      <a [routerLink]="['/excursions']"
                         class="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline mt-1 block">
                        Ver reserva →
                      </a>
                    </div>
                  }

                  @if (ticket()!.store) {
                    <div class="bg-gray-50 rounded-lg p-3 space-y-1.5">
                      <p class="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Comercio</p>
                      <p class="text-sm font-medium text-gray-700">{{ ticket()!.store!.name }}</p>
                      <p class="text-xs text-gray-400">{{ ticket()!.store!.commerce_type }}</p>
                      <a [routerLink]="['/stores', ticket()!.store!.id]"
                         class="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline">
                        Ver comercio →
                      </a>
                    </div>
                  }

                  @if (ticket()!.repartidor) {
                    <div class="bg-gray-50 rounded-lg p-3 space-y-1.5">
                      <p class="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Repartidor</p>
                      <p class="text-sm font-medium text-gray-700">{{ ticket()!.repartidor!.full_name }}</p>
                      <a [routerLink]="['/couriers']"
                         class="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline">
                        Ver repartidor →
                      </a>
                    </div>
                  }

                </div>
              }
            </div>
          }

          <!-- ── Card 3: Ticket management ──────────────────────────────────── -->
          <div class="p-4">
            <button
              class="flex items-center justify-between w-full text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3"
              (click)="cardOpen.management = !cardOpen.management"
            >
              Gestión
              <svg class="w-3.5 h-3.5 transition-transform" [class.rotate-180]="cardOpen.management"
                   fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            @if (cardOpen.management) {
              <div class="space-y-4">

                <!-- Assigned to -->
                <div>
                  <p class="text-xs text-gray-500 mb-1.5">Asignado a</p>
                  <select
                    class="input-field text-sm w-full"
                    [value]="ticket()!.assigned_to?.id ?? ''"
                    (change)="onAssignChange($event)"
                  >
                    <option value="">Sin asignar</option>
                    <option value="me">Asignarme a mí</option>
                  </select>
                </div>

                <!-- Priority pills -->
                <div>
                  <p class="text-xs text-gray-500 mb-1.5">Prioridad</p>
                  <div class="grid grid-cols-2 gap-1.5">
                    @for (p of priorities; track p.value) {
                      <button
                        class="px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                        [class]="ticket()!.priority === p.value
                          ? p.activeClass
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'"
                        (click)="changePriority(p.value)"
                      >{{ p.label }}</button>
                    }
                  </div>
                </div>

                <!-- Zendesk -->
                @if (ticket()!.zendesk_id) {
                  <a [href]="'https://tuttysupport.zendesk.com/tickets/' + ticket()!.zendesk_id"
                     target="_blank" rel="noopener"
                     class="flex items-center gap-1.5 text-xs text-primary-600 hover:underline">
                    Ver en Zendesk →
                  </a>
                } @else {
                  <button class="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                    + Crear en Zendesk
                  </button>
                }

              </div>
            }
          </div>

          <!-- ── Card 4: Change history ──────────────────────────────────────── -->
          <div class="p-4">
            <button
              class="flex items-center justify-between w-full text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3"
              (click)="cardOpen.history = !cardOpen.history"
            >
              Historial
              <svg class="w-3.5 h-3.5 transition-transform" [class.rotate-180]="cardOpen.history"
                   fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            @if (cardOpen.history) {
              <div class="space-y-2">
                @for (msg of systemMessages(); track msg.id) {
                  <div class="flex gap-2 items-start">
                    <div class="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0 mt-1.5"></div>
                    <div class="min-w-0">
                      <p class="text-xs text-gray-600 leading-snug">{{ msg.message }}</p>
                      <p class="text-[10px] text-gray-400 mt-0.5">{{ msg.created_at | timeAgo }}</p>
                    </div>
                  </div>
                } @empty {
                  <p class="text-xs text-gray-400">Sin cambios registrados aún.</p>
                }
              </div>
            }
          </div>

        </div>
      </div>
    }
    `,
})
export class SupportTicketDetailComponent implements OnChanges, OnDestroy, AfterViewChecked {
    @Input({ required: true }) ticketId!: string;
    @ViewChild('conversationEl') conversationEl?: ElementRef<HTMLDivElement>;

    private readonly svc = inject(SupportService);
    private readonly auth = inject(AuthService);
    private readonly toast = inject(ToastService);

    // ─── State ────────────────────────────────────────────────────────────────

    readonly ticket = this.svc.activeTicket;
    readonly messages = this.svc.messages;
    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly sending = signal(false);

    readonly showStatusMenu = signal(false);
    readonly showReplies = signal(false);
    readonly composerTab = signal<'respuesta' | 'nota'>('respuesta');
    readonly attachmentFiles = signal<File[]>([]);

    composerText = '';
    private shouldScrollToBottom = false;

    readonly cardOpen = { reporter: true, context: true, management: true, history: false };

    // ─── Static config ────────────────────────────────────────────────────────

    readonly allStatuses: TicketStatus[] = [
        'abierto', 'en_revision', 'esperando_respuesta', 'escalado', 'resuelto', 'cerrado',
    ];
    readonly statusLabels = STATUS_LABELS;
    readonly quickReplies = QUICK_REPLIES;

    readonly priorities: { value: TicketPriority; label: string; activeClass: string }[] = [
        { value: 'baja',    label: '🟢 Baja',    activeClass: 'border-success-300 bg-success-50 text-success-700' },
        { value: 'media',   label: '🟡 Media',   activeClass: 'border-warning-300 bg-warning-50 text-warning-700' },
        { value: 'alta',    label: '🟠 Alta',    activeClass: 'border-orange-300 bg-orange-50 text-orange-700' },
        { value: 'urgente', label: '🔴 Urgente', activeClass: 'border-error-300 bg-error-50 text-error-700' },
    ];

    // ─── Computed ─────────────────────────────────────────────────────────────

    readonly statusLabel = computed(() => STATUS_LABELS[this.ticket()?.status ?? 'abierto']);
    readonly statusClass  = computed(() => STATUS_CLASS[this.ticket()?.status ?? 'abierto']);
    readonly priorityLabel = computed(() => PRIORITY_LABEL[this.ticket()?.priority ?? 'media']);
    readonly priorityClass  = computed(() => PRIORITY_CLASS[this.ticket()?.priority ?? 'media']);

    readonly slaInfo = computed(() => {
        const t = this.ticket();
        return t ? slaTimeLeft(t.sla_deadline) : { label: '', urgent: false };
    });

    readonly systemMessages = computed(() =>
        this.messages().filter(m => m.sender_role === 'sistema')
    );

    get reporterInitials(): string {
        return initials(this.ticket()?.reporter.full_name ?? 'U');
    }

    get reporterTypeLabel(): string {
        const map: Record<string, string> = {
            cliente: 'Cliente', store_admin: 'Comercio',
            repartidor: 'Repartidor', excursion_operator: 'Operador',
        };
        return map[this.ticket()?.reporter_type ?? ''] ?? '';
    }

    get composerPlaceholder(): string {
        return this.composerTab() === 'nota'
            ? 'Nota interna — solo visible para el equipo de soporte...'
            : 'Escribe tu respuesta al cliente...';
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['ticketId']?.currentValue) {
            this.loadTicket(changes['ticketId'].currentValue);
        }
    }

    ngAfterViewChecked(): void {
        if (this.shouldScrollToBottom) {
            this.scrollToBottom();
            this.shouldScrollToBottom = false;
        }
    }

    ngOnDestroy(): void {
        this.svc.stopWatchingMessages();
    }

    // ─── Data ─────────────────────────────────────────────────────────────────

    private loadTicket(id: string): void {
        this.loading.set(true);
        this.svc.getTicketById(id).subscribe({
            next: detail => {
                this.svc.activeTicket.set(detail);
                this.svc.messages.set(detail.messages);
                this.svc.watchNewMessages(id);
                this.shouldScrollToBottom = true;
                this.loading.set(false);
            },
            error: () => {
                this.toast.error('Error al cargar el ticket');
                this.loading.set(false);
            },
        });
    }

    // ─── Actions ──────────────────────────────────────────────────────────────

    async changeStatus(status: TicketStatus): Promise<void> {
        const t = this.ticket();
        if (!t || t.status === status || this.saving()) return;
        this.saving.set(true);
        try {
            await this.svc.updateTicketStatus(t.id, status);
            this.svc.activeTicket.update(prev => prev ? { ...prev, status } : null);
            this.toast.success(`Ticket marcado como "${STATUS_LABELS[status]}"`);
            this.loadTicket(t.id); // reload to get system message
        } catch {
            this.toast.error('Error al cambiar el estado');
        } finally {
            this.saving.set(false);
            this.showStatusMenu.set(false);
        }
    }

    async changePriority(priority: TicketPriority): Promise<void> {
        const t = this.ticket();
        if (!t || t.priority === priority || this.saving()) return;
        this.saving.set(true);
        try {
            await this.svc.updatePriority(t.id, priority);
            this.svc.activeTicket.update(prev => prev ? { ...prev, priority } : null);
            this.toast.success('Prioridad actualizada');
        } catch {
            this.toast.error('Error al actualizar prioridad');
        } finally {
            this.saving.set(false);
        }
    }

    async onAssignChange(event: Event): Promise<void> {
        const t = this.ticket();
        if (!t) return;
        const value = (event.target as HTMLSelectElement).value;
        const agentId = value === 'me' ? (this.auth.currentUser()?.id ?? '') : value;
        if (!agentId) return;
        try {
            await this.svc.assignTicket(t.id, agentId);
            this.toast.success('Ticket asignado correctamente');
        } catch {
            this.toast.error('Error al asignar el ticket');
        }
    }

    async send(): Promise<void> {
        const t = this.ticket();
        if (!t || !this.composerText.trim() || this.sending()) return;
        this.sending.set(true);
        try {
            const isInternal = this.composerTab() === 'nota';
            await this.svc.sendMessage(t.id, this.composerText.trim(), isInternal, this.attachmentFiles());
            this.composerText = '';
            this.attachmentFiles.set([]);
            this.loadTicket(t.id);
        } catch {
            this.toast.error('Error al enviar el mensaje');
        } finally {
            this.sending.set(false);
        }
    }

    async sendAndResolve(): Promise<void> {
        await this.send();
        const t = this.ticket();
        if (t) await this.changeStatus('resuelto');
    }

    applyQuickReply(text: string): void {
        this.composerText = text;
        this.showReplies.set(false);
    }

    onFileChange(event: Event): void {
        const files = Array.from((event.target as HTMLInputElement).files ?? []);
        this.attachmentFiles.update(prev => [...prev, ...files]);
    }

    removeAttachment(file: File): void {
        this.attachmentFiles.update(prev => prev.filter(f => f !== file));
    }

    // ─── Utils ────────────────────────────────────────────────────────────────

    hoursBetween(a: string, b: string): number {
        return hoursDiff(a, b);
    }

    private scrollToBottom(): void {
        const el = this.conversationEl?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
    }
}
