import {
    Component, Input, Output, EventEmitter, OnChanges, OnDestroy,
    SimpleChanges, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
    SupportService, SupportTicket, TicketType, TicketPriority, TicketSubtype,
    UserSearchResult, OrderSearchResult, BookingSearchResult,
    StoreSearchResult, CourierSearchResult, AgentResult, NewTicketPayload,
} from '../../services/support.service';
import { ToastService } from '../../../../shared/ui/toast/toast.service';

// ─── Ticket type options ───────────────────────────────────────────────────────

interface TicketTypeOption {
    icon: string;
    label: string;
    type: TicketType;
    subtype?: TicketSubtype;
    contextType?: 'order' | 'booking' | 'store' | 'courier';
}

const TICKET_TYPE_OPTIONS: TicketTypeOption[] = [
    { icon: '🛒', label: 'Queja pedido', type: 'pedido', contextType: 'order' },
    { icon: '🏍️', label: 'Queja repartidor', type: 'repartidor', contextType: 'courier' },
    { icon: '🏪', label: 'Queja comercio', type: 'comercio', contextType: 'store' },
    { icon: '💻', label: 'Problema técnico', type: 'cuenta' },
    { icon: '💰', label: 'Sol. reembolso', type: 'pago', subtype: 'reembolso' },
    { icon: '🚩', label: 'Reporte fraude', type: 'otro', subtype: 'fraude' },
    { icon: '💳', label: 'Problema pago', type: 'pago' },
    { icon: '🧭', label: 'Queja excursión', type: 'excursion', contextType: 'booking' },
    { icon: '❌', label: 'Cancelación exc.', type: 'excursion', subtype: 'cancelacion', contextType: 'booking' },
    { icon: '❓', label: 'Duda general', type: 'otro' },
    { icon: '📝', label: 'Otro', type: 'otro' },
];

const ROLE_LABELS: Record<string, string> = {
    super_admin: 'Admin',
    store_admin: 'Comercio',
    repartidor: 'Repartidor',
    excursion_operator: 'Operador',
};

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf', 'video/mp4'];

// ─── Component ─────────────────────────────────────────────────────────────────

@Component({
    selector: 'app-new-ticket-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
@if (isOpen) {
  <div class="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">

    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" (click)="close()"></div>

    <!-- Slide-over panel -->
    <div class="relative ml-auto w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full z-10">

      <!-- ── HEADER ───────────────────────────────────────────────────────── -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
        <div>
          <h2 class="text-base font-bold text-gray-900">Nuevo ticket de soporte</h2>
          <p class="text-xs text-gray-500 mt-0.5">Crear manualmente (ej: cliente llamó por WhatsApp)</p>
        </div>
        <button
          class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          (click)="close()"
          aria-label="Cerrar"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- ── BODY (scrollable) ────────────────────────────────────────────── -->
      <div class="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        <!-- ══════ SECCIÓN 1 · Reporter ══════════════════════════════════════ -->
        <section>
          <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span class="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
            Información del reporter
          </h3>

          @if (!isExternalTicket()) {
            <!-- Search input -->
            <div class="relative">
              <label class="label text-xs mb-1 block">Buscar usuario en el sistema</label>
              <div class="relative">
                <svg class="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                     fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
                </svg>
                <input
                  type="text"
                  class="input-field pl-8 pr-8 text-sm"
                  placeholder="Nombre, email, teléfono o código de referido…"
                  [(ngModel)]="userQuery"
                  (ngModelChange)="onUserQueryChange()"
                  (blur)="hideUserDropdown()"
                  [attr.readonly]="selectedUser() ? true : null"
                />
                @if (userSearching()) {
                  <svg class="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin"
                       fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                }
                @if (selectedUser()) {
                  <button
                    class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    (mousedown)="clearUser()"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                }
              </div>

              <!-- Dropdown: results -->
              @if (showUserDropdown() && (userResults().length > 0 || (!userSearching() && userQuery.length >= 2))) {
                <div class="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  @for (usr of userResults(); track usr.id) {
                    <button
                      class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors"
                      (mousedown)="selectUser(usr)"
                    >
                      <div class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white overflow-hidden"
                           [style.background]="avatarBg(usr.role)">
                        @if (usr.avatar_url) {
                          <img [src]="usr.avatar_url" class="w-full h-full object-cover" alt="" />
                        } @else {
                          {{ usr.full_name.charAt(0).toUpperCase() }}
                        }
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-800 truncate">{{ usr.full_name }}</p>
                        <p class="text-xs text-gray-500 truncate">{{ usr.email }}</p>
                      </div>
                      <span class="flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium" [class]="roleColor(usr.role)">
                        {{ roleLabel(usr.role) }}
                      </span>
                    </button>
                  }
                  @if (userResults().length === 0 && !userSearching()) {
                    <p class="px-3 py-2 text-sm text-gray-400">Sin resultados.</p>
                  }
                  <!-- External option -->
                  <button
                    class="w-full flex items-center gap-2 px-3 py-2.5 border-t border-gray-100 hover:bg-warning-50 text-left text-sm text-warning-700 font-medium transition-colors"
                    (mousedown)="useExternal()"
                  >
                    <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Crear como ticket externo (no está en el sistema)
                  </button>
                </div>
              }
            </div>

            <!-- Selected user preview -->
            @if (selectedUser()) {
              <div class="mt-2 flex items-center gap-3 p-3 bg-primary-50 border border-primary-200 rounded-xl">
                <div class="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white overflow-hidden"
                     [style.background]="avatarBg(selectedUser()!.role)">
                  @if (selectedUser()!.avatar_url) {
                    <img [src]="selectedUser()!.avatar_url" class="w-full h-full object-cover" alt="" />
                  } @else {
                    {{ selectedUser()!.full_name.charAt(0).toUpperCase() }}
                  }
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-gray-800">{{ selectedUser()!.full_name }}</p>
                  <p class="text-xs text-gray-500">{{ selectedUser()!.email }}</p>
                </div>
                <span class="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                      [class]="roleColor(selectedUser()!.role)">
                  {{ roleLabel(selectedUser()!.role) }}
                </span>
              </div>
            }

          } @else {
            <!-- External ticket fields -->
            <div class="p-4 bg-warning-50 border border-warning-200 rounded-xl space-y-3">
              <div class="flex items-center justify-between mb-1">
                <p class="text-xs font-semibold text-warning-700 flex items-center gap-1.5">
                  <span>⚠️</span> Ticket externo — cliente no registrado en el sistema
                </p>
                <button class="text-xs text-gray-500 hover:text-gray-700 underline" (click)="cancelExternal()">
                  Volver a buscar
                </button>
              </div>
              <div>
                <label class="label text-xs mb-1 block">Nombre del cliente *</label>
                <input type="text" class="input-field text-sm" placeholder="Nombre completo"
                       [(ngModel)]="externalName" />
              </div>
              <div>
                <label class="label text-xs mb-1 block">Contacto (email o WhatsApp)</label>
                <input type="text" class="input-field text-sm"
                       placeholder="email@ejemplo.com o +1 809 000 0000"
                       [(ngModel)]="externalContact" />
              </div>
            </div>
          }
        </section>

        <!-- ══════ SECCIÓN 2 · Tipo de problema ═══════════════════════════════ -->
        <section>
          <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span class="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
            Tipo de problema
          </h3>
          <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
            @for (opt of typeOptions; track opt.label) {
              <button
                class="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 cursor-pointer transition-all text-center"
                [class]="isTypeSelected(opt)
                  ? 'border-primary-500 bg-primary-50 shadow-sm'
                  : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'"
                (click)="selectType(opt)"
              >
                <span class="text-xl leading-none">{{ opt.icon }}</span>
                <span class="text-[10px] leading-tight font-medium"
                      [class]="isTypeSelected(opt) ? 'text-primary-700' : 'text-gray-600'">
                  {{ opt.label }}
                </span>
              </button>
            }
          </div>
        </section>

        <!-- ══════ SECCIÓN 3 · Contexto (condicional) ═════════════════════════ -->
        @if (activeContextType()) {
          <section>
            <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span class="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
              {{ contextSectionLabel() }}
              <span class="text-xs font-normal text-gray-400 ml-1">— opcional, ayuda a resolver más rápido</span>
            </h3>

            <div class="relative">
              <div class="relative">
                <svg class="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                     fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
                </svg>
                <input
                  type="text"
                  class="input-field pl-8 pr-8 text-sm"
                  [placeholder]="contextPlaceholder()"
                  [(ngModel)]="contextQuery"
                  (ngModelChange)="onContextQueryChange()"
                  (blur)="hideContextDropdown()"
                  [attr.readonly]="selectedContext() ? true : null"
                />
                @if (contextSearching()) {
                  <svg class="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin"
                       fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                }
                @if (selectedContext()) {
                  <button
                    class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    (mousedown)="clearContext()"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                }
              </div>

              <!-- Context dropdown results -->
              @if (showContextDropdown() && contextResults().length > 0) {
                <div class="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  @for (item of contextResults(); track item.id) {
                    <button
                      class="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors"
                      (mousedown)="selectContext(item)"
                    >
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-800 truncate">{{ contextItemPrimary(item) }}</p>
                        <p class="text-xs text-gray-500 truncate">{{ contextItemSecondary(item) }}</p>
                      </div>
                    </button>
                  }
                </div>
              }
            </div>

            <!-- Selected context preview -->
            @if (selectedContext()) {
              <div class="mt-2 flex items-center gap-2.5 p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                <span class="text-lg leading-none">{{ selectedTypeOption()?.icon }}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium text-gray-700 truncate">{{ contextItemPrimary(selectedContext()) }}</p>
                  <p class="text-xs text-gray-500 truncate">{{ contextItemSecondary(selectedContext()) }}</p>
                </div>
                <button class="text-gray-400 hover:text-error-500 flex-shrink-0 transition-colors"
                        (click)="clearContext()">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            }
          </section>
        }

        <!-- ══════ SECCIÓN 4 · Detalle ═════════════════════════════════════════ -->
        <section>
          <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span class="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
              {{ activeContextType() ? '4' : '3' }}
            </span>
            Detalle del problema
          </h3>

          <!-- Subject -->
          <div class="mb-3">
            <div class="flex items-center justify-between mb-1">
              <label class="label text-xs">Asunto *</label>
              <span class="text-xs" [class]="subject.length > 110 ? 'text-error-500 font-medium' : 'text-gray-400'">
                {{ subject.length }}/120
              </span>
            </div>
            <input
              type="text"
              class="input-field text-sm"
              placeholder="Ej: Cliente no recibió su pedido"
              [(ngModel)]="subject"
              maxlength="120"
            />
          </div>

          <!-- Description -->
          <div class="mb-3">
            <div class="flex items-center justify-between mb-1">
              <label class="label text-xs">
                Descripción *
                <span class="font-normal text-gray-400">(mín. 50 caracteres)</span>
              </label>
              <span class="text-xs"
                    [class]="description.length > 0 && description.length < 50 ? 'text-warning-600 font-medium' : 'text-gray-400'">
                {{ description.length }} chars
              </span>
            </div>
            <textarea
              class="input-field text-sm resize-none"
              rows="4"
              placeholder="Describe el problema con el mayor detalle posible…"
              [(ngModel)]="description"
            ></textarea>
            @if (description.length > 0 && description.length < 50) {
              <p class="text-xs text-warning-600 mt-1">Mínimo 50 caracteres (faltan {{ 50 - description.length }})</p>
            }
          </div>

          <!-- Attachments -->
          <div>
            <label class="label text-xs mb-2 block">
              Adjuntos
              <span class="font-normal text-gray-400">(máx. 5 archivos · 10 MB c/u · jpg, png, pdf, mp4)</span>
            </label>

            @if (attachments().length > 0) {
              <div class="space-y-1.5 mb-2">
                @for (file of attachments(); track file.name; let i = $index) {
                  <div class="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                    <span class="text-base flex-shrink-0">{{ fileIcon(file) }}</span>
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-medium text-gray-700 truncate">{{ file.name }}</p>
                      <p class="text-xs text-gray-400">{{ fileSizeLabel(file) }}</p>
                    </div>
                    <button
                      class="flex-shrink-0 text-gray-400 hover:text-error-500 transition-colors p-0.5"
                      (click)="removeAttachment(i)"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                }
              </div>
            }

            @if (attachments().length < 5) {
              <label
                class="flex items-center gap-2 px-3 py-2.5 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors text-sm text-gray-500"
              >
                <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span>Adjuntar archivo</span>
                <input
                  type="file"
                  class="hidden"
                  multiple
                  accept="image/jpeg,image/png,application/pdf,video/mp4"
                  (change)="onFilesChange($event)"
                />
              </label>
            }
          </div>
        </section>

        <!-- ══════ SECCIÓN 5 · Asignación ══════════════════════════════════════ -->
        <section class="pb-2">
          <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span class="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
              {{ activeContextType() ? '5' : '4' }}
            </span>
            Asignación y prioridad
          </h3>

          <!-- Agent select -->
          <div class="mb-4">
            <label class="label text-xs mb-1 block">Asignar a</label>
            <select class="input-field text-sm" [(ngModel)]="selectedAgent">
              <option value="">Sin asignar por ahora</option>
              @for (agent of agents(); track agent.id) {
                <option [value]="agent.id">{{ agent.full_name }}</option>
              }
            </select>
          </div>

          <!-- Priority pills -->
          <div>
            <label class="label text-xs mb-2 block">
              Prioridad
              <span class="font-normal text-gray-400 ml-1">— si no seleccionas, se asigna automáticamente</span>
            </label>
            <div class="flex flex-wrap gap-2">
              <!-- Auto pill -->
              <button
                class="px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-all"
                [class]="selectedPriority() === null
                  ? 'border-gray-500 bg-gray-100 text-gray-800'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'"
                (click)="selectedPriority.set(null)"
              >
                ⚡ Auto
              </button>
              @for (p of priorityOptions; track p.value) {
                <button
                  class="px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-all"
                  [class]="selectedPriority() === p.value
                    ? p.selectedClass
                    : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'"
                  (click)="selectedPriority.set(p.value)"
                >
                  {{ p.icon }} {{ p.label }}
                </button>
              }
            </div>
          </div>
        </section>

      </div>

      <!-- ── FOOTER ───────────────────────────────────────────────────────── -->
      <div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
        <p class="text-xs text-gray-400">* Campos obligatorios</p>
        <div class="flex gap-3">
          <button
            class="btn-secondary text-sm"
            (click)="close()"
            [disabled]="submitting()"
          >
            Cancelar
          </button>
          <button
            class="btn-primary text-sm flex items-center gap-2"
            (click)="submit()"
            [disabled]="submitting() || !canSubmit()"
          >
            @if (submitting()) {
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Creando…
            } @else {
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Crear ticket
            }
          </button>
        </div>
      </div>

    </div>
  </div>
}
    `,
})
export class NewTicketModalComponent implements OnChanges, OnDestroy {
    @Input({ required: true }) isOpen = false;
    @Output() closed = new EventEmitter<SupportTicket | null>();

    private readonly svc = inject(SupportService);
    private readonly toast = inject(ToastService);

    // ── Section 1: Reporter ──────────────────────────────────────────────────

    userQuery = '';
    readonly userResults = signal<UserSearchResult[]>([]);
    readonly userSearching = signal(false);
    readonly showUserDropdown = signal(false);
    readonly selectedUser = signal<UserSearchResult | null>(null);
    readonly isExternalTicket = signal(false);
    externalName = '';
    externalContact = '';

    // ── Section 2: Type ──────────────────────────────────────────────────────

    readonly typeOptions = TICKET_TYPE_OPTIONS;
    readonly selectedTypeOption = signal<TicketTypeOption | null>(null);

    // ── Section 3: Context ───────────────────────────────────────────────────

    contextQuery = '';
    readonly contextResults = signal<any[]>([]);
    readonly contextSearching = signal(false);
    readonly showContextDropdown = signal(false);
    readonly selectedContext = signal<any | null>(null);

    // ── Section 4: Details ───────────────────────────────────────────────────

    subject = '';
    description = '';
    readonly attachments = signal<File[]>([]);

    // ── Section 5: Assignment ────────────────────────────────────────────────

    readonly agents = signal<AgentResult[]>([]);
    selectedAgent = '';
    readonly selectedPriority = signal<TicketPriority | null>(null);
    readonly submitting = signal(false);

    readonly priorityOptions: { value: TicketPriority; icon: string; label: string; selectedClass: string }[] = [
        { value: 'urgente', icon: '🔴', label: 'Urgente', selectedClass: 'border-error-500 bg-error-50 text-error-700' },
        { value: 'alta', icon: '🟠', label: 'Alta', selectedClass: 'border-orange-400 bg-orange-50 text-orange-700' },
        { value: 'media', icon: '🟡', label: 'Media', selectedClass: 'border-yellow-400 bg-yellow-50 text-yellow-700' },
        { value: 'baja', icon: '🟢', label: 'Baja', selectedClass: 'border-success-400 bg-success-50 text-success-700' },
    ];

    private userTimeout: ReturnType<typeof setTimeout> | null = null;
    private contextTimeout: ReturnType<typeof setTimeout> | null = null;

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['isOpen']?.currentValue === true) {
            this.reset();
            this.loadAgents();
        }
    }

    ngOnDestroy(): void {
        if (this.userTimeout) clearTimeout(this.userTimeout);
        if (this.contextTimeout) clearTimeout(this.contextTimeout);
    }

    private reset(): void {
        this.userQuery = '';
        this.userResults.set([]);
        this.userSearching.set(false);
        this.showUserDropdown.set(false);
        this.selectedUser.set(null);
        this.isExternalTicket.set(false);
        this.externalName = '';
        this.externalContact = '';
        this.selectedTypeOption.set(null);
        this.contextQuery = '';
        this.contextResults.set([]);
        this.contextSearching.set(false);
        this.showContextDropdown.set(false);
        this.selectedContext.set(null);
        this.subject = '';
        this.description = '';
        this.attachments.set([]);
        this.selectedAgent = '';
        this.selectedPriority.set(null);
        this.submitting.set(false);
    }

    private loadAgents(): void {
        this.svc.getAgents().subscribe({ next: a => this.agents.set(a) });
    }

    // ─── Section 1: User search ───────────────────────────────────────────────

    onUserQueryChange(): void {
        if (this.selectedUser()) return;
        if (this.userTimeout) clearTimeout(this.userTimeout);
        if (this.userQuery.length < 2) {
            this.userResults.set([]);
            this.showUserDropdown.set(false);
            return;
        }
        this.userSearching.set(true);
        this.userTimeout = setTimeout(() => {
            this.svc.searchUsers(this.userQuery).subscribe({
                next: results => {
                    this.userResults.set(results);
                    this.showUserDropdown.set(true);
                    this.userSearching.set(false);
                },
                error: () => this.userSearching.set(false),
            });
        }, 300);
    }

    hideUserDropdown(): void {
        setTimeout(() => this.showUserDropdown.set(false), 150);
    }

    selectUser(usr: UserSearchResult): void {
        this.selectedUser.set(usr);
        this.isExternalTicket.set(false);
        this.showUserDropdown.set(false);
        this.userQuery = usr.full_name;
        this.userResults.set([]);
    }

    clearUser(): void {
        this.selectedUser.set(null);
        this.userQuery = '';
        this.userResults.set([]);
        this.showUserDropdown.set(false);
    }

    useExternal(): void {
        this.isExternalTicket.set(true);
        this.selectedUser.set(null);
        this.showUserDropdown.set(false);
        this.userQuery = '';
    }

    cancelExternal(): void {
        this.isExternalTicket.set(false);
        this.externalName = '';
        this.externalContact = '';
    }

    // ─── Section 2: Type ──────────────────────────────────────────────────────

    selectType(opt: TicketTypeOption): void {
        this.selectedTypeOption.set(opt);
        this.contextQuery = '';
        this.contextResults.set([]);
        this.selectedContext.set(null);
        this.showContextDropdown.set(false);
    }

    isTypeSelected(opt: TicketTypeOption): boolean {
        const sel = this.selectedTypeOption();
        return !!sel && sel.type === opt.type && sel.label === opt.label;
    }

    activeContextType(): 'order' | 'booking' | 'store' | 'courier' | null {
        return this.selectedTypeOption()?.contextType ?? null;
    }

    contextSectionLabel(): string {
        switch (this.activeContextType()) {
            case 'order': return 'Pedido relacionado';
            case 'booking': return 'Reserva relacionada';
            case 'store': return 'Comercio relacionado';
            case 'courier': return 'Repartidor relacionado';
            default: return '';
        }
    }

    contextPlaceholder(): string {
        switch (this.activeContextType()) {
            case 'order': return '# Pedido (ej: TUT-1234)…';
            case 'booking': return '# Reserva…';
            case 'store': return 'Nombre del comercio…';
            case 'courier': return 'Nombre del repartidor…';
            default: return 'Buscar…';
        }
    }

    // ─── Section 3: Context search ────────────────────────────────────────────

    onContextQueryChange(): void {
        const ct = this.activeContextType();
        if (!ct || this.selectedContext()) return;
        if (this.contextTimeout) clearTimeout(this.contextTimeout);
        if (this.contextQuery.length < 2) {
            this.contextResults.set([]);
            this.showContextDropdown.set(false);
            return;
        }
        this.contextSearching.set(true);
        this.contextTimeout = setTimeout(() => {
            const q = this.contextQuery;
            const onNext = (results: any[]) => {
                this.contextResults.set(results);
                this.showContextDropdown.set(results.length > 0);
                this.contextSearching.set(false);
            };
            const onError = () => this.contextSearching.set(false);
            if (ct === 'order') this.svc.searchOrders(q).subscribe({ next: onNext, error: onError });
            else if (ct === 'booking') this.svc.searchBookings(q).subscribe({ next: onNext, error: onError });
            else if (ct === 'store') this.svc.searchCommerces(q).subscribe({ next: onNext, error: onError });
            else this.svc.searchCouriers(q).subscribe({ next: onNext, error: onError });
        }, 300);
    }

    hideContextDropdown(): void {
        setTimeout(() => this.showContextDropdown.set(false), 150);
    }

    selectContext(item: any): void {
        this.selectedContext.set(item);
        this.showContextDropdown.set(false);
        const ct = this.activeContextType();
        if (ct === 'order') this.contextQuery = `#${item.order_number}`;
        else if (ct === 'booking') this.contextQuery = `#${item.booking_number}`;
        else if (ct === 'store') this.contextQuery = item.name;
        else if (ct === 'courier') this.contextQuery = item.full_name;
    }

    clearContext(): void {
        this.selectedContext.set(null);
        this.contextQuery = '';
        this.contextResults.set([]);
    }

    contextItemPrimary(item: any): string {
        const ct = this.activeContextType();
        if (ct === 'order') return `#${item.order_number} · ${item.store_name}`;
        if (ct === 'booking') return `#${item.booking_number} · ${item.excursion_name}`;
        if (ct === 'store') return item.name;
        if (ct === 'courier') return item.full_name;
        return '';
    }

    contextItemSecondary(item: any): string {
        const ct = this.activeContextType();
        if (ct === 'order') return `RD$ ${(item.total ?? 0).toLocaleString()} · ${item.status}`;
        if (ct === 'booking') return `${item.booking_date ?? '—'} · RD$ ${(item.total ?? 0).toLocaleString()}`;
        if (ct === 'store') return item.commerce_type ?? '';
        if (ct === 'courier') return item.phone ?? '';
        return '';
    }

    // ─── Section 4: Attachments ───────────────────────────────────────────────

    onFilesChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        const files = Array.from(input.files ?? []);
        const existing = this.attachments();
        const valid: File[] = [];
        for (const f of files) {
            if (!ALLOWED_MIME.includes(f.type)) {
                this.toast.error(`Tipo no permitido: ${f.name}`);
                continue;
            }
            if (f.size > 10 * 1024 * 1024) {
                this.toast.error(`${f.name} supera los 10 MB`);
                continue;
            }
            if (existing.length + valid.length >= 5) {
                this.toast.error('Máximo 5 archivos');
                break;
            }
            valid.push(f);
        }
        if (valid.length) this.attachments.update(prev => [...prev, ...valid]);
        input.value = '';
    }

    removeAttachment(idx: number): void {
        this.attachments.update(prev => prev.filter((_, i) => i !== idx));
    }

    fileIcon(file: File): string {
        if (file.type === 'application/pdf') return '📄';
        if (file.type.startsWith('video')) return '🎥';
        return '🖼️';
    }

    fileSizeLabel(file: File): string {
        const kb = file.size / 1024;
        return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
    }

    // ─── Display helpers ──────────────────────────────────────────────────────

    roleLabel(role: string): string {
        return ROLE_LABELS[role] ?? 'Cliente';
    }

    roleColor(role: string): string {
        if (role === 'super_admin') return 'bg-primary-100 text-primary-700';
        if (role === 'store_admin') return 'bg-blue-100 text-blue-700';
        if (role === 'repartidor') return 'bg-success-100 text-success-700';
        if (role === 'excursion_operator') return 'bg-purple-100 text-purple-700';
        return 'bg-gray-100 text-gray-700';
    }

    avatarBg(role: string): string {
        if (role === 'super_admin') return '#e91e8c';
        if (role === 'store_admin') return '#3b82f6';
        if (role === 'repartidor') return '#22c55e';
        if (role === 'excursion_operator') return '#8b5cf6';
        return '#9ca3af';
    }

    // ─── Validation & Submit ──────────────────────────────────────────────────

    canSubmit(): boolean {
        const hasReporter =
            this.selectedUser() !== null ||
            (this.isExternalTicket() && this.externalName.trim().length > 0);
        return (
            hasReporter &&
            this.selectedTypeOption() !== null &&
            this.subject.trim().length > 0 &&
            this.subject.trim().length <= 120 &&
            this.description.trim().length >= 50
        );
    }

    async submit(): Promise<void> {
        if (!this.canSubmit() || this.submitting()) return;
        this.submitting.set(true);

        try {
            const opt = this.selectedTypeOption()!;
            const ctx = this.selectedContext();

            const payload: NewTicketPayload = {
                reporter_id: this.selectedUser()?.id,
                external_name: this.isExternalTicket() ? this.externalName.trim() : undefined,
                external_contact:
                    this.isExternalTicket() && this.externalContact.trim()
                        ? this.externalContact.trim()
                        : undefined,
                type: opt.type,
                subtype: opt.subtype ?? null,
                subject: this.subject.trim(),
                description: this.description.trim(),
                order_id: opt.contextType === 'order' ? ctx?.id : undefined,
                booking_id: opt.contextType === 'booking' ? ctx?.id : undefined,
                store_id: opt.contextType === 'store' ? ctx?.id : undefined,
                repartidor_id: opt.contextType === 'courier' ? ctx?.id : undefined,
                assigned_to: this.selectedAgent || undefined,
                priority: this.selectedPriority() ?? undefined,
                attachments: this.attachments(),
            };

            const ticket = await this.svc.createTicket(payload);
            this.toast.success(`✅ Ticket ${ticket.ticket_number} creado`);
            this.closed.emit(ticket);
        } catch {
            this.toast.error('Error al crear el ticket. Intenta de nuevo.');
            this.submitting.set(false);
        }
    }

    close(): void {
        if (!this.submitting()) this.closed.emit(null);
    }
}
