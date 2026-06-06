import {
    Component, OnInit, inject, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
    SupportService, ReplyTemplate, TemplateCategory, TemplatePayload,
} from '../services/support.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { PageHeaderComponent } from '../../../layout/admin-shell/page-header.component';
import { ConfirmService } from '../../../shared/ui/modal/confirm.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: TemplateCategory; label: string; icon: string; color: string }[] = [
    { value: 'seguimiento', label: 'Seguimiento', icon: '📋', color: 'bg-blue-100 text-blue-700' },
    { value: 'reembolso', label: 'Reembolso', icon: '💰', color: 'bg-success-100 text-success-700' },
    { value: 'compensacion', label: 'Compensación', icon: '🎁', color: 'bg-purple-100 text-purple-700' },
    { value: 'cierre', label: 'Cierre', icon: '✅', color: 'bg-gray-100 text-gray-700' },
];

const TEMPLATE_VARIABLES: { key: string; example: string; label: string }[] = [
    { key: '{{nombre_cliente}}', example: 'Juan Pérez', label: 'Nombre cliente' },
    { key: '{{numero_ticket}}', example: 'TKT-00042', label: '# Ticket' },
    { key: '{{numero_pedido}}', example: 'TUT-1234', label: '# Pedido' },
    { key: '{{monto}}', example: '350', label: 'Monto RD$' },
    { key: '{{codigo_promo}}', example: 'SORRY50', label: 'Código promo' },
    { key: '{{sla_horas}}', example: '24', label: 'SLA horas' },
    { key: '{{descuento}}', example: '100', label: 'Descuento RD$' },
];

function extractVariables(body: string): string[] {
    const matches = body.match(/\{\{[^}]+\}\}/g) ?? [];
    return [...new Set(matches)];
}

function applyExamples(body: string): string {
    let result = body;
    for (const v of TEMPLATE_VARIABLES) {
        result = result.replaceAll(v.key, `<strong class="text-primary-600">${v.example}</strong>`);
    }
    return result;
}

// ─── Empty form factory ───────────────────────────────────────────────────────

function emptyForm(): TemplatePayload {
    return { name: '', category: 'seguimiento', subject: '', body: '' };
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
    selector: 'app-ticket-templates-page',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, PageHeaderComponent],
    template: `
<app-page-header
  title="Plantillas de respuesta"
  subtitle="Respuestas predefinidas reutilizables en tickets de soporte"
>
  <a routerLink="/support" class="btn-secondary text-sm flex items-center gap-1.5">
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
    </svg>
    Volver a soporte
  </a>
  <button class="btn-primary text-sm flex items-center gap-1.5" (click)="openCreate()">
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
    </svg>
    Nueva plantilla
  </button>
</app-page-header>

<!-- ─── Loading skeleton ─────────────────────────────────────────────────── -->
@if (loading()) {
  <div class="space-y-4">
    @for (_ of skeletonRows; track $index) {
      <div class="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 bg-gray-100 rounded w-1/4"></div>
            <div class="h-3 bg-gray-100 rounded w-3/4"></div>
            <div class="h-3 bg-gray-100 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    }
  </div>
}

<!-- ─── Empty state ──────────────────────────────────────────────────────── -->
@if (!loading() && templates().length === 0) {
  <div class="flex flex-col items-center justify-center py-24 text-center text-gray-400">
    <span class="text-5xl mb-4">📝</span>
    <p class="text-base font-medium text-gray-500">Sin plantillas aún</p>
    <p class="text-sm mt-1">Crea tu primera plantilla de respuesta para agilizar el soporte</p>
    <button class="btn-primary mt-6" (click)="openCreate()">+ Nueva plantilla</button>
  </div>
}

<!-- ─── Template groups ──────────────────────────────────────────────────── -->
@if (!loading() && templates().length > 0) {
  <div class="space-y-8">
    @for (cat of categories; track cat.value) {
      @let group = groupedTemplates()[cat.value];
      @if (group?.length) {
        <section>
          <!-- Category header -->
          <div class="flex items-center gap-2 mb-3">
            <span class="text-lg leading-none">{{ cat.icon }}</span>
            <h3 class="text-sm font-bold text-gray-700">{{ cat.label }}</h3>
            <span class="text-xs text-gray-400">({{ group!.length }})</span>
          </div>

          <div class="space-y-2">
            @for (tpl of group; track tpl.id) {
              <div
                class="bg-white border rounded-xl p-4 transition-all"
                [class]="tpl.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'"
              >
                <div class="flex items-start gap-4">

                  <!-- Category badge -->
                  <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                       [class]="cat.color">
                    {{ cat.icon }}
                  </div>

                  <!-- Body -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                      <p class="text-sm font-semibold text-gray-800">{{ tpl.name }}</p>
                      @if (!tpl.is_active) {
                        <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Inactiva</span>
                      }
                    </div>
                    @if (tpl.subject) {
                      <p class="text-xs text-gray-500 mb-1.5">
                        <span class="font-medium">Asunto:</span> {{ tpl.subject }}
                      </p>
                    }
                    <p class="text-xs text-gray-600 line-clamp-2 leading-relaxed">{{ tpl.body }}</p>

                    <!-- Variable badges -->
                    @let vars = getVars(tpl.body);
                    @if (vars.length > 0) {
                      <div class="flex flex-wrap gap-1 mt-2">
                        @for (v of vars; track v) {
                          <span class="text-[10px] px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 font-mono font-medium border border-primary-100">
                            {{ v }}
                          </span>
                        }
                      </div>
                    }
                  </div>

                  <!-- Actions -->
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <!-- Toggle active -->
                    <button
                      class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                      [title]="tpl.is_active ? 'Desactivar' : 'Activar'"
                      (click)="toggleActive(tpl)"
                      [disabled]="toggling() === tpl.id"
                    >
                      @if (toggling() === tpl.id) {
                        <svg class="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                      } @else if (tpl.is_active) {
                        <svg class="w-4 h-4 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      } @else {
                        <svg class="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      }
                    </button>

                    <!-- Edit -->
                    <button
                      class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
                      title="Editar"
                      (click)="openEdit(tpl)"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>

                    <!-- Duplicate -->
                    <button
                      class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
                      title="Duplicar"
                      (click)="duplicate(tpl)"
                      [disabled]="duplicating() === tpl.id"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>

                    <!-- Delete -->
                    <button
                      class="p-1.5 rounded-lg hover:bg-error-50 transition-colors text-gray-300 hover:text-error-500"
                      title="Eliminar"
                      (click)="confirmDelete(tpl)"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                </div>
              </div>
            }
          </div>
        </section>
      }
    }
  </div>
}

<!-- ══════════════ FORM MODAL ══════════════════════════════════════════════════ -->
@if (showForm()) {
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" (click)="closeForm()"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col z-10">

      <!-- Form header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
        <h3 class="text-base font-bold text-gray-900">
          {{ editingId() ? 'Editar plantilla' : 'Nueva plantilla' }}
        </h3>
        <button class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" (click)="closeForm()">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Form body (scrollable) -->
      <div class="flex-1 overflow-y-auto px-6 py-5 space-y-4">

        <!-- Name -->
        <div>
          <label class="label text-xs mb-1 block">Nombre interno *</label>
          <input
            type="text"
            class="input-field text-sm"
            placeholder="Ej: Acuse de recibo inicial"
            [(ngModel)]="form.name"
            maxlength="80"
          />
        </div>

        <!-- Category -->
        <div>
          <label class="label text-xs mb-1 block">Categoría *</label>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            @for (cat of categories; track cat.value) {
              <button
                class="flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all"
                [class]="form.category === cat.value
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'"
                (click)="form.category = cat.value"
                type="button"
              >
                <span class="text-base leading-none flex-shrink-0">{{ cat.icon }}</span>
                <span class="text-xs font-medium truncate"
                      [class]="form.category === cat.value ? 'text-primary-700' : 'text-gray-600'">
                  {{ cat.label }}
                </span>
              </button>
            }
          </div>
        </div>

        <!-- Subject (optional) -->
        <div>
          <label class="label text-xs mb-1 block">
            Asunto
            <span class="font-normal text-gray-400 ml-1">— opcional</span>
          </label>
          <input
            type="text"
            class="input-field text-sm"
            placeholder="Asunto del correo o mensaje (opcional)"
            [(ngModel)]="form.subject"
            maxlength="120"
          />
        </div>

        <!-- Variable chips -->
        <div>
          <label class="label text-xs mb-2 block">
            Variables disponibles
            <span class="font-normal text-gray-400 ml-1">— click para insertar en el body</span>
          </label>
          <div class="flex flex-wrap gap-1.5">
            @for (v of templateVars; track v.key) {
              <button
                class="text-[11px] px-2 py-1 rounded-full bg-primary-50 hover:bg-primary-100 text-primary-700 font-mono font-medium border border-primary-100 transition-colors"
                (click)="insertVar(v.key)"
                type="button"
                [title]="'Ejemplo: ' + v.example"
              >
                {{ v.key }}
              </button>
            }
          </div>
        </div>

        <!-- Body textarea -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="label text-xs">Cuerpo del mensaje *</label>
            <span class="text-xs text-gray-400">{{ form.body.length }} chars</span>
          </div>
          <textarea
            #bodyTextarea
            class="input-field text-sm font-mono resize-none"
            rows="6"
            placeholder="Hola {{ '{' }}{{ '{' }}nombre_cliente{{ '}' }}{{ '}' }}, tu ticket #{{ '{' }}{{ '{' }}numero_ticket{{ '}' }}{{ '}' }}…"
            [(ngModel)]="form.body"
          ></textarea>
        </div>

        <!-- Live preview -->
        @if (form.body.trim().length > 0) {
          <div class="border border-gray-200 rounded-xl overflow-hidden">
            <div class="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
              <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Preview en vivo</span>
              <span class="text-[10px] text-gray-400">(variables reemplazadas con ejemplos)</span>
            </div>
            <div class="px-4 py-3 text-sm text-gray-700 leading-relaxed"
                 [innerHTML]="livePreview()">
            </div>
          </div>
        }

      </div>

      <!-- Form footer -->
      <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
        <button class="btn-secondary text-sm" (click)="closeForm()" [disabled]="saving()">Cancelar</button>
        <button
          class="btn-primary text-sm flex items-center gap-2"
          (click)="save()"
          [disabled]="saving() || !canSave()"
        >
          @if (saving()) {
            <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            Guardando…
          } @else {
            {{ editingId() ? 'Guardar cambios' : 'Crear plantilla' }}
          }
        </button>
      </div>

    </div>
  </div>
}
    `,
})
export class TicketTemplatesPageComponent implements OnInit {
    private readonly svc = inject(SupportService);
    private readonly toast = inject(ToastService);
    private readonly confirm = inject(ConfirmService);

    readonly templates = signal<ReplyTemplate[]>([]);
    readonly loading = signal(true);
    readonly toggling = signal<string | null>(null);
    readonly duplicating = signal<string | null>(null);

    // ── Form state ────────────────────────────────────────────────────────────

    readonly showForm = signal(false);
    readonly editingId = signal<string | null>(null);
    readonly saving = signal(false);
    form: TemplatePayload = emptyForm();

    // ── Textarea ref (for inserting variables at cursor) ──────────────────────

    private bodyTextareaEl: HTMLTextAreaElement | null = null;

    // ── Static config ─────────────────────────────────────────────────────────

    readonly categories = CATEGORIES;
    readonly templateVars = TEMPLATE_VARIABLES;
    readonly skeletonRows = Array(4);

    // ── Derived ───────────────────────────────────────────────────────────────

    readonly groupedTemplates = computed<Partial<Record<TemplateCategory, ReplyTemplate[]>>>(() => {
        const groups: Partial<Record<TemplateCategory, ReplyTemplate[]>> = {};
        for (const tpl of this.templates()) {
            if (!groups[tpl.category]) groups[tpl.category] = [];
            groups[tpl.category]!.push(tpl);
        }
        return groups;
    });

    readonly livePreview = computed(() => applyExamples(this.form.body));

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    ngOnInit(): void {
        this.load();
    }

    private load(): void {
        this.loading.set(true);
        this.svc.getTemplates().subscribe({
            next: t => {
                this.templates.set(t);
                this.loading.set(false);
            },
            error: () => {
                this.toast.error('Error al cargar plantillas');
                this.loading.set(false);
            },
        });
    }

    // ─── Form open/close ──────────────────────────────────────────────────────

    openCreate(): void {
        this.editingId.set(null);
        this.form = emptyForm();
        this.showForm.set(true);
    }

    openEdit(tpl: ReplyTemplate): void {
        this.editingId.set(tpl.id);
        this.form = {
            name: tpl.name,
            category: tpl.category,
            subject: tpl.subject ?? '',
            body: tpl.body,
        };
        this.showForm.set(true);
    }

    closeForm(): void {
        if (!this.saving()) this.showForm.set(false);
    }

    // ─── Variable insertion ───────────────────────────────────────────────────

    insertVar(key: string): void {
        const ta = document.querySelector<HTMLTextAreaElement>('textarea[name="body"], textarea');
        if (ta) {
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            this.form = {
                ...this.form,
                body: this.form.body.slice(0, start) + key + this.form.body.slice(end),
            };
            setTimeout(() => {
                ta.selectionStart = ta.selectionEnd = start + key.length;
                ta.focus();
            });
        } else {
            this.form = { ...this.form, body: this.form.body + key };
        }
    }

    // ─── CRUD ─────────────────────────────────────────────────────────────────

    canSave(): boolean {
        return this.form.name.trim().length > 0 && this.form.body.trim().length > 0;
    }

    async save(): Promise<void> {
        if (!this.canSave() || this.saving()) return;
        this.saving.set(true);
        try {
            const payload: TemplatePayload = {
                name: this.form.name.trim(),
                category: this.form.category,
                subject: this.form.subject?.trim() || undefined,
                body: this.form.body.trim(),
            };
            const id = this.editingId();
            if (id) {
                await this.svc.updateTemplate(id, payload);
                this.templates.update(prev =>
                    prev.map(t => t.id === id ? { ...t, ...payload } : t)
                );
                this.toast.success('Plantilla actualizada');
            } else {
                const created = await this.svc.createTemplate(payload);
                this.templates.update(prev => [created, ...prev]);
                this.toast.success('Plantilla creada');
            }
            this.showForm.set(false);
        } catch {
            this.toast.error('Error al guardar. Intenta de nuevo.');
        } finally {
            this.saving.set(false);
        }
    }

    async toggleActive(tpl: ReplyTemplate): Promise<void> {
        this.toggling.set(tpl.id);
        try {
            await this.svc.toggleTemplate(tpl.id, !tpl.is_active);
            this.templates.update(prev =>
                prev.map(t => t.id === tpl.id ? { ...t, is_active: !t.is_active } : t)
            );
            this.toast.success(tpl.is_active ? 'Plantilla desactivada' : 'Plantilla activada');
        } catch {
            this.toast.error('Error al cambiar estado');
        } finally {
            this.toggling.set(null);
        }
    }

    async duplicate(tpl: ReplyTemplate): Promise<void> {
        this.duplicating.set(tpl.id);
        try {
            const created = await this.svc.duplicateTemplate(tpl);
            this.templates.update(prev => [created, ...prev]);
            this.toast.success(`Duplicada: "${created.name}"`);
        } catch {
            this.toast.error('Error al duplicar');
        } finally {
            this.duplicating.set(null);
        }
    }

    async confirmDelete(tpl: ReplyTemplate): Promise<void> {
        const ok = await this.confirm.confirm({
            title: 'Eliminar plantilla',
            message: `¿Eliminar "${tpl.name}"? Esta acción no se puede deshacer.`,
            confirmText: 'Eliminar',
            cancelText: 'Cancelar',
            danger: true,
        });
        if (!ok) return;
        try {
            await this.svc.deleteTemplate(tpl.id);
            this.templates.update(prev => prev.filter(t => t.id !== tpl.id));
            this.toast.success('Plantilla eliminada');
        } catch {
            this.toast.error('Error al eliminar');
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    getVars(body: string): string[] {
        return extractVariables(body);
    }
}
