import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ExcursionsService } from './excursions.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { ExcursionOperator, ExcursionCategoryAdmin } from '../../core/supabase/database.types';

interface ExcursionFormModel {
  name: string;
  operator_id: string;
  category_id: string;
  difficulty_level: string;
  language: string;
  short_description: string;
  description: string;
  price_per_person: number;
  duration_hours: number | null;
  min_people: number;
  max_people: number | null;
  min_age: number | null;
  max_age: number | null;
  min_hours_advance: number;
  cancellation_hours: number;
  meeting_point: string;
  hotel_pickup: boolean;
  hotel_pickup_notes: string;
  pickup_time: string;
  wheelchair_accessible: boolean;
  physical_requirements: string;
  health_warnings: string;
  is_active: boolean;
}

function blankForm(): ExcursionFormModel {
  return {
    name: '',
    operator_id: '',
    category_id: '',
    difficulty_level: 'facil',
    language: 'Español',
    short_description: '',
    description: '',
    price_per_person: 0,
    duration_hours: 4,
    min_people: 1,
    max_people: 20,
    min_age: null,
    max_age: null,
    min_hours_advance: 24,
    cancellation_hours: 48,
    meeting_point: '',
    hotel_pickup: false,
    hotel_pickup_notes: '',
    pickup_time: '',
    wheelchair_accessible: false,
    physical_requirements: '',
    health_warnings: '',
    is_active: true,
  };
}

@Component({
  selector: 'app-admin-excursion-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent],
  template: `
    <app-page-header
      [title]="isEdit() ? 'Editar excursión' : 'Nueva excursión'"
      [subtitle]="isEdit() ? 'Modifica todos los campos de la excursión' : 'Completa todos los campos para publicar la excursión'">
      <button class="btn-secondary" (click)="router.navigate(['/excursions'])">← Volver</button>
    </app-page-header>

    @if (loading()) {
      <div class="flex items-center justify-center py-24">
        <svg class="animate-spin h-8 w-8 text-brand-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
      </div>
    } @else {
      <form #f="ngForm" (ngSubmit)="save()" class="space-y-6 max-w-4xl">

        <!-- ── SECCIÓN 1: Información básica ───────────────────────────── -->
        <div class="card p-6 space-y-4">
          <h3 class="font-semibold text-gray-800 text-sm uppercase tracking-wide">1. Información básica</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div class="md:col-span-2">
              <label class="label">Nombre *</label>
              <input class="input-field" [(ngModel)]="form.name" name="name" required />
            </div>

            <div>
              <label class="label">Operador *</label>
              <select class="input-field" [(ngModel)]="form.operator_id" name="operator_id" required>
                <option value="">— Selecciona un operador —</option>
                @for (op of operators(); track op.id) {
                  <option [value]="op.id">{{ op.name }}</option>
                }
              </select>
            </div>

            <div>
              <label class="label">Categoría</label>
              <select class="input-field" [(ngModel)]="form.category_id" name="category_id">
                <option value="">— Sin categoría —</option>
                @for (cat of categories(); track cat.id) {
                  <option [value]="cat.id">{{ cat.name }}</option>
                }
              </select>
            </div>

            <div>
              <label class="label">Dificultad</label>
              <select class="input-field" [(ngModel)]="form.difficulty_level" name="difficulty_level">
                <option value="facil">Fácil</option>
                <option value="moderado">Moderado</option>
                <option value="dificil">Difícil</option>
              </select>
            </div>

            <div>
              <label class="label">Idioma(s)</label>
              <input class="input-field" [(ngModel)]="form.language" name="language" placeholder="Español/English" />
            </div>

            <div class="md:col-span-2">
              <label class="label">Descripción corta</label>
              <textarea class="input-field resize-none" rows="2" [(ngModel)]="form.short_description" name="short_description"
                placeholder="Resumen visible en la tarjeta (máx. 160 chars)"></textarea>
            </div>

            <div class="md:col-span-2">
              <label class="label">Descripción completa</label>
              <textarea class="input-field resize-none" rows="5" [(ngModel)]="form.description" name="description"
                placeholder="Descripción detallada de la excursión"></textarea>
            </div>
          </div>
        </div>

        <!-- ── SECCIÓN 2: Precios y logística ──────────────────────────── -->
        <div class="card p-6 space-y-4">
          <h3 class="font-semibold text-gray-800 text-sm uppercase tracking-wide">2. Precios y logística</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4">

            <div>
              <label class="label">Precio por persona (RD$) *</label>
              <input class="input-field" type="number" min="0" step="0.01" [(ngModel)]="form.price_per_person" name="price_per_person" required />
            </div>

            <div>
              <label class="label">Duración (horas)</label>
              <input class="input-field" type="number" min="0.5" step="0.5" [(ngModel)]="form.duration_hours" name="duration_hours"
                placeholder="ej. 4" />
            </div>

            <div>
              <label class="label">Mín. personas</label>
              <input class="input-field" type="number" min="1" [(ngModel)]="form.min_people" name="min_people" />
            </div>

            <div>
              <label class="label">Máx. personas</label>
              <input class="input-field" type="number" min="1" [(ngModel)]="form.max_people" name="max_people"
                placeholder="Sin límite" />
            </div>

            <div>
              <label class="label">Edad mínima</label>
              <input class="input-field" type="number" min="0" [(ngModel)]="form.min_age" name="min_age"
                placeholder="Sin mínimo" />
            </div>

            <div>
              <label class="label">Edad máxima</label>
              <input class="input-field" type="number" min="0" [(ngModel)]="form.max_age" name="max_age"
                placeholder="Sin máximo" />
            </div>

            <div>
              <label class="label">Aviso previo mínimo (horas)</label>
              <input class="input-field" type="number" min="0" [(ngModel)]="form.min_hours_advance" name="min_hours_advance" />
            </div>

            <div>
              <label class="label">Horas para cancelar sin cargo</label>
              <input class="input-field" type="number" min="0" [(ngModel)]="form.cancellation_hours" name="cancellation_hours" />
            </div>

          </div>
        </div>

        <!-- ── SECCIÓN 3: Ubicación y transfer ─────────────────────────── -->
        <div class="card p-6 space-y-4">
          <h3 class="font-semibold text-gray-800 text-sm uppercase tracking-wide">3. Ubicación y transfer</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div class="md:col-span-2">
              <label class="label">Punto de encuentro</label>
              <input class="input-field" [(ngModel)]="form.meeting_point" name="meeting_point"
                placeholder="ej. Mercado Modelo, Santo Domingo" />
            </div>

            <div>
              <label class="label flex items-center gap-2">
                <input type="checkbox" [(ngModel)]="form.hotel_pickup" name="hotel_pickup" class="rounded" />
                <span>Incluye transfer hotel</span>
              </label>
            </div>

            @if (form.hotel_pickup) {
              <div>
                <label class="label">Hora de recogida</label>
                <input class="input-field" type="time" [(ngModel)]="form.pickup_time" name="pickup_time" />
              </div>
              <div class="md:col-span-2">
                <label class="label">Notas del transfer</label>
                <textarea class="input-field resize-none" rows="2" [(ngModel)]="form.hotel_pickup_notes" name="hotel_pickup_notes"
                  placeholder="Instrucciones de recogida, zona de cobertura, etc."></textarea>
              </div>
            }

            <div class="md:col-span-2">
              <label class="label flex items-center gap-2">
                <input type="checkbox" [(ngModel)]="form.wheelchair_accessible" name="wheelchair_accessible" class="rounded" />
                <span>Accesible para sillas de ruedas</span>
              </label>
            </div>

          </div>
        </div>

        <!-- ── SECCIÓN 4: Qué incluye / qué traer ──────────────────────── -->
        <div class="card p-6 space-y-6">
          <h3 class="font-semibold text-gray-800 text-sm uppercase tracking-wide">4. Contenido de la excursión</h3>

          <!-- Qué incluye -->
          <div>
            <label class="label mb-2">✅ Qué incluye</label>
            <div class="flex gap-2 mb-2">
              <input class="input-field flex-1" [(ngModel)]="tagInputs.included" name="_included_input"
                placeholder="ej. Guía gastronómico" (keydown.enter)="$event.preventDefault(); addTag('included')" />
              <button type="button" class="btn-secondary px-4" (click)="addTag('included')">+ Agregar</button>
            </div>
            <div class="flex flex-wrap gap-2">
              @for (item of whatIsIncluded(); track item) {
                <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-success-50 text-success-700 text-sm">
                  {{ item }}
                  <button type="button" class="text-success-400 hover:text-success-700 ml-1 leading-none" (click)="removeTag('included', item)">×</button>
                </span>
              }
              @if (whatIsIncluded().length === 0) {
                <p class="text-xs text-gray-400 italic">Sin elementos. Agrega ítems usando el campo superior.</p>
              }
            </div>
          </div>

          <!-- Qué NO incluye -->
          <div>
            <label class="label mb-2">❌ Qué NO incluye</label>
            <div class="flex gap-2 mb-2">
              <input class="input-field flex-1" [(ngModel)]="tagInputs.notIncluded" name="_not_included_input"
                placeholder="ej. Compras personales" (keydown.enter)="$event.preventDefault(); addTag('notIncluded')" />
              <button type="button" class="btn-secondary px-4" (click)="addTag('notIncluded')">+ Agregar</button>
            </div>
            <div class="flex flex-wrap gap-2">
              @for (item of whatIsNotIncluded(); track item) {
                <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-error-50 text-error-700 text-sm">
                  {{ item }}
                  <button type="button" class="text-error-400 hover:text-error-700 ml-1 leading-none" (click)="removeTag('notIncluded', item)">×</button>
                </span>
              }
              @if (whatIsNotIncluded().length === 0) {
                <p class="text-xs text-gray-400 italic">Sin elementos.</p>
              }
            </div>
          </div>

          <!-- Qué llevar -->
          <div>
            <label class="label mb-2">🎒 Qué llevar</label>
            <div class="flex gap-2 mb-2">
              <input class="input-field flex-1" [(ngModel)]="tagInputs.toBring" name="_to_bring_input"
                placeholder="ej. Ropa cómoda" (keydown.enter)="$event.preventDefault(); addTag('toBring')" />
              <button type="button" class="btn-secondary px-4" (click)="addTag('toBring')">+ Agregar</button>
            </div>
            <div class="flex flex-wrap gap-2">
              @for (item of whatToBring(); track item) {
                <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-warning-50 text-warning-700 text-sm">
                  {{ item }}
                  <button type="button" class="text-warning-400 hover:text-warning-700 ml-1 leading-none" (click)="removeTag('toBring', item)">×</button>
                </span>
              }
              @if (whatToBring().length === 0) {
                <p class="text-xs text-gray-400 italic">Sin elementos.</p>
              }
            </div>
          </div>

          <!-- Equipamiento requerido -->
          <div>
            <label class="label mb-2">⚙️ Equipamiento requerido</label>
            <div class="flex gap-2 mb-2">
              <input class="input-field flex-1" [(ngModel)]="tagInputs.equipment" name="_equipment_input"
                placeholder="ej. Zapatos de trekking" (keydown.enter)="$event.preventDefault(); addTag('equipment')" />
              <button type="button" class="btn-secondary px-4" (click)="addTag('equipment')">+ Agregar</button>
            </div>
            <div class="flex flex-wrap gap-2">
              @for (item of requiredEquipment(); track item) {
                <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-sm">
                  {{ item }}
                  <button type="button" class="text-brand-400 hover:text-brand-700 ml-1 leading-none" (click)="removeTag('equipment', item)">×</button>
                </span>
              }
              @if (requiredEquipment().length === 0) {
                <p class="text-xs text-gray-400 italic">Sin elementos.</p>
              }
            </div>
          </div>
        </div>

        <!-- ── SECCIÓN 5: Salud y requisitos ───────────────────────────── -->
        <div class="card p-6 space-y-4">
          <h3 class="font-semibold text-gray-800 text-sm uppercase tracking-wide">5. Salud y requisitos físicos</h3>
          <div class="grid grid-cols-1 gap-4">
            <div>
              <label class="label">Requisitos físicos</label>
              <textarea class="input-field resize-none" rows="2" [(ngModel)]="form.physical_requirements" name="physical_requirements"
                placeholder="ej. Nivel básico de condición física, capacidad para caminar 2km"></textarea>
            </div>
            <div>
              <label class="label">Advertencias de salud</label>
              <textarea class="input-field resize-none" rows="2" [(ngModel)]="form.health_warnings" name="health_warnings"
                placeholder="ej. No recomendado para personas con problemas cardíacos"></textarea>
            </div>
          </div>
        </div>

        <!-- ── SECCIÓN 6: Fotos ─────────────────────────────────────────── -->
        <div class="card p-6 space-y-4">
          <h3 class="font-semibold text-gray-800 text-sm uppercase tracking-wide">6. Fotos</h3>
          <p class="text-xs text-gray-500">Agrega las URLs de las fotos. La primera será la imagen principal.</p>
          <div class="flex gap-2 mb-2">
            <input class="input-field flex-1" [(ngModel)]="tagInputs.photo" name="_photo_input"
              placeholder="https://..." (keydown.enter)="$event.preventDefault(); addTag('photo')" />
            <button type="button" class="btn-secondary px-4" (click)="addTag('photo')">+ Agregar</button>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            @for (url of photos(); track url; let i = $index) {
              <div class="relative group rounded-xl overflow-hidden border border-gray-200 aspect-video bg-gray-100">
                <img [src]="url" class="w-full h-full object-cover" (error)="$any($event.target).style.display='none'" alt="" />
                @if (i === 0) {
                  <span class="absolute top-1 left-1 text-[10px] bg-brand-500 text-white px-1.5 py-0.5 rounded-full font-semibold">Principal</span>
                }
                <button type="button"
                  class="absolute top-1 right-1 bg-error-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  (click)="removeTag('photo', url)">×</button>
              </div>
            }
            @if (photos().length === 0) {
              <p class="col-span-full text-xs text-gray-400 italic">Sin fotos. Agrega URLs de imágenes.</p>
            }
          </div>
        </div>

        <!-- ── SECCIÓN 7: Estado ────────────────────────────────────────── -->
        <div class="card p-6">
          <h3 class="font-semibold text-gray-800 text-sm uppercase tracking-wide mb-3">7. Estado de publicación</h3>
          <label class="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" [(ngModel)]="form.is_active" name="is_active"
              class="w-5 h-5 rounded text-brand-600" />
            <span class="text-sm font-medium text-gray-700">Excursión activa y visible en la app</span>
          </label>
          @if (!form.is_active) {
            <p class="text-xs text-warning-600 mt-1.5 ml-8">⚠️ La excursión está inactiva y no será visible para los clientes.</p>
          }
        </div>

        <!-- ── Botones de acción ────────────────────────────────────────── -->
        <div class="flex gap-3 justify-end pb-10">
          <button type="button" class="btn-secondary" (click)="router.navigate(['/excursions'])">Cancelar</button>
          <button type="submit" class="btn-primary px-8" [disabled]="f.invalid || saveLoading()">
            {{ saveLoading() ? 'Guardando...' : (isEdit() ? '💾 Guardar cambios' : '🚀 Crear excursión') }}
          </button>
        </div>

      </form>
    }
  `,
})
export class AdminExcursionEditPageComponent implements OnInit {
  readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(ExcursionsService);
  private readonly toastService = inject(ToastService);

  readonly loading = signal(true);
  readonly saveLoading = signal(false);
  readonly isEdit = signal(false);
  private excursionId = '';

  readonly operators = signal<ExcursionOperator[]>([]);
  readonly categories = signal<ExcursionCategoryAdmin[]>([]);

  // Scalar form model
  form: ExcursionFormModel = blankForm();

  // Array fields as signals
  readonly whatIsIncluded = signal<string[]>([]);
  readonly whatIsNotIncluded = signal<string[]>([]);
  readonly whatToBring = signal<string[]>([]);
  readonly requiredEquipment = signal<string[]>([]);
  readonly photos = signal<string[]>([]);

  // Temporary tag inputs
  tagInputs = { included: '', notIncluded: '', toBring: '', equipment: '', photo: '' };

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEdit.set(true);
      this.excursionId = id;
    }

    await Promise.all([this.loadOperators(), this.loadCategories()]);

    if (this.isEdit()) {
      await this.loadExcursion();
    }

    this.loading.set(false);
  }

  private async loadOperators(): Promise<void> {
    this.service.getOperators().subscribe(ops => this.operators.set(ops));
  }

  private async loadCategories(): Promise<void> {
    this.service.getCategories().subscribe(cats => this.categories.set(cats));
  }

  private async loadExcursion(): Promise<void> {
    return new Promise((resolve) => {
      this.service.getExcursionById(this.excursionId).subscribe({
        next: (exc: any) => {
          if (!exc) { this.router.navigate(['/excursions']); resolve(); return; }
          this.form = {
            name: exc.name ?? '',
            operator_id: exc.operator_id ?? '',
            category_id: exc.category_id ?? '',
            difficulty_level: exc.difficulty_level ?? 'facil',
            language: exc.language ?? 'Español',
            short_description: exc.short_description ?? '',
            description: exc.description ?? '',
            price_per_person: exc.price_per_person ?? 0,
            duration_hours: exc.duration_hours ?? null,
            min_people: exc.min_people ?? 1,
            max_people: exc.max_people ?? null,
            min_age: exc.min_age ?? null,
            max_age: exc.max_age ?? null,
            min_hours_advance: exc.min_hours_advance ?? 24,
            cancellation_hours: exc.cancellation_hours ?? 48,
            meeting_point: exc.meeting_point ?? '',
            hotel_pickup: exc.hotel_pickup ?? false,
            hotel_pickup_notes: exc.hotel_pickup_notes ?? '',
            pickup_time: exc.pickup_time ?? '',
            wheelchair_accessible: exc.wheelchair_accessible ?? false,
            physical_requirements: exc.physical_requirements ?? '',
            health_warnings: exc.health_warnings ?? '',
            is_active: exc.is_active ?? true,
          };
          this.whatIsIncluded.set(Array.isArray(exc.what_is_included) ? exc.what_is_included : []);
          this.whatIsNotIncluded.set(Array.isArray(exc.what_is_not_included) ? exc.what_is_not_included : []);
          this.whatToBring.set(Array.isArray(exc.what_to_bring) ? exc.what_to_bring : []);
          this.requiredEquipment.set(Array.isArray(exc.required_equipment) ? exc.required_equipment : []);
          this.photos.set(Array.isArray(exc.photos) ? exc.photos : []);
          resolve();
        },
        error: () => { this.toastService.error('Error al cargar la excursión'); resolve(); },
      });
    });
  }

  addTag(field: 'included' | 'notIncluded' | 'toBring' | 'equipment' | 'photo'): void {
    const value = this.tagInputs[field].trim();
    if (!value) return;

    const sigMap: Record<string, ReturnType<typeof signal<string[]>>> = {
      included:    this.whatIsIncluded,
      notIncluded: this.whatIsNotIncluded,
      toBring:     this.whatToBring,
      equipment:   this.requiredEquipment,
      photo:       this.photos,
    };

    const sig = sigMap[field];
    if (!sig().includes(value)) {
      sig.update(arr => [...arr, value]);
    }
    this.tagInputs[field] = '';
  }

  removeTag(field: 'included' | 'notIncluded' | 'toBring' | 'equipment' | 'photo', item: string): void {
    const sigMap: Record<string, ReturnType<typeof signal<string[]>>> = {
      included:    this.whatIsIncluded,
      notIncluded: this.whatIsNotIncluded,
      toBring:     this.whatToBring,
      equipment:   this.requiredEquipment,
      photo:       this.photos,
    };
    sigMap[field].update(arr => arr.filter(x => x !== item));
  }

  async save(): Promise<void> {
    if (!this.form.name || !this.form.operator_id) return;
    this.saveLoading.set(true);
    try {
      const payload: Record<string, unknown> = {
        ...(this.isEdit() ? { id: this.excursionId } : {}),
        name: this.form.name,
        operator_id: this.form.operator_id,
        category_id: this.form.category_id || null,
        difficulty_level: this.form.difficulty_level || null,
        language: this.form.language || 'Español',
        short_description: this.form.short_description || null,
        description: this.form.description || null,
        price_per_person: this.form.price_per_person,
        duration_hours: this.form.duration_hours ?? null,
        min_people: this.form.min_people,
        max_people: this.form.max_people ?? null,
        min_age: this.form.min_age ?? null,
        max_age: this.form.max_age ?? null,
        min_hours_advance: this.form.min_hours_advance,
        cancellation_hours: this.form.cancellation_hours,
        meeting_point: this.form.meeting_point || null,
        hotel_pickup: this.form.hotel_pickup,
        hotel_pickup_notes: this.form.hotel_pickup_notes || null,
        pickup_time: this.form.pickup_time || null,
        wheelchair_accessible: this.form.wheelchair_accessible,
        physical_requirements: this.form.physical_requirements || null,
        health_warnings: this.form.health_warnings || null,
        what_is_included: this.whatIsIncluded(),
        what_is_not_included: this.whatIsNotIncluded(),
        what_to_bring: this.whatToBring(),
        required_equipment: this.requiredEquipment(),
        photos: this.photos(),
        is_active: this.form.is_active,
      };

      await this.service.saveExcursion(payload as any);
      this.toastService.success(this.isEdit() ? 'Excursión actualizada' : 'Excursión creada');
      this.router.navigate(['/excursions']);
    } catch {
      this.toastService.error('Error al guardar la excursión');
    } finally {
      this.saveLoading.set(false);
    }
  }
}
