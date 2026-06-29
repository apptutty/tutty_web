import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ExcursionsService, ExcursionPhotoAsset } from './excursions.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ExcursionOperator, ExcursionCategoryAdmin } from '../../core/supabase/database.types';
import { ALLOWED_IMAGE_TYPES, validateImageFile } from '../../shared/utils/media-utils';

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
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-[1440px] mx-auto min-w-0">
      @if (loading()) {
        <div class="flex items-center justify-center py-24">
          <svg class="animate-spin h-8 w-8 text-brand-500" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
        </div>
      } @else {
        <section class="rounded-[28px] border border-[#e7eaf1] bg-[radial-gradient(circle_at_94%_12%,rgba(235,27,141,.12),transparent_25%),linear-gradient(180deg,#fff,#fbfcff)] shadow-[0_8px_24px_rgba(18,24,40,.07)] px-6 py-5 mb-4">
          <div class="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
            <div>
              <p class="inline-flex items-center rounded-full bg-[#ffe7f4] px-3 py-1 text-[11px] font-extrabold tracking-wide text-[#c71473]">Operations · Excursions</p>
              <h1 class="mt-2 text-[30px] leading-[1.08] tracking-[-0.04em] font-bold text-[#111827]">{{ isEdit() ? 'Editar excursión' : 'Nueva excursión' }}</h1>
              <p class="mt-2 max-w-4xl text-[15px] leading-6 text-[#667085]">
                {{ isEdit() ? 'Actualiza la información, precio, disponibilidad e imágenes de esta experiencia.' : 'Crea una experiencia turística para operadores, reservas y catálogo de excursiones.' }}
              </p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 xl:flex xl:flex-wrap xl:justify-end">
              <button type="button" class="h-11 inline-flex items-center justify-center rounded-2xl border border-[#e7eaf1] bg-white px-4 text-sm font-bold text-[#344054] hover:bg-[#f8fafc]" (click)="router.navigate(['/excursions'])" aria-label="Volver al listado de excursiones">
                Volver
              </button>
              <button type="button" class="h-11 inline-flex items-center justify-center rounded-2xl border border-[#e7eaf1] bg-white px-4 text-sm font-bold text-[#344054] hover:bg-[#f8fafc]" (click)="router.navigate(['/excursions'])" aria-label="Cancelar y volver a excursiones">
                Cancelar
              </button>
              <button type="button" class="h-11 inline-flex items-center justify-center rounded-2xl bg-[#eb1b8d] hover:bg-[#c71473] text-white px-4 text-sm font-black" [disabled]="saveLoading() || !canSave()" (click)="save()">
                {{ saveLoading() ? 'Guardando...' : (isEdit() ? 'Guardar cambios' : 'Crear excursión') }}
              </button>
            </div>
          </div>
        </section>

        @if (statusWarning()) {
          <section class="rounded-2xl border border-[#ffe2b6] bg-[#fff6e6] px-4 py-3 mb-4">
            <p class="text-sm font-black text-[#b54708]">{{ statusWarning()!.title }}</p>
            <p class="text-xs text-[#7a6140] mt-1">{{ statusWarning()!.description }}</p>
          </section>
        }

        <form (ngSubmit)="save()" class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start min-w-0">
          <div class="space-y-4 min-w-0">
            <section class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-5">
              <h2 class="text-base font-black text-[#111827]">Información básica</h2>
              <p class="text-sm text-[#667085] mt-1 mb-4">Define cómo se verá la excursión dentro del catálogo de experiencias.</p>

              <div class="space-y-4">
                <div>
                  <label class="label">Foto principal de la excursión</label>
                  <input #coverInput type="file" class="hidden" accept="image/jpeg,image/png,image/webp" (change)="onPhotoFileSelected($event, 'excursion_cover')" />
                  <input #galleryInput type="file" class="hidden" accept="image/jpeg,image/png,image/webp" multiple (change)="onGalleryFilesSelected($event)" />

                  <div
                    class="mt-2 rounded-[22px] border-2 border-dashed p-4 sm:p-5 transition-colors min-h-[230px] relative overflow-hidden"
                    [class]="isDropzoneActive() ? 'border-[#eb1b8d] bg-[#fff7fc]' : 'border-[#d6dce8] bg-[#fbfcff]'"
                    [class.opacity-70]="!isEdit()"
                    role="button"
                    tabindex="0"
                    aria-label="Foto principal de la excursión"
                    (dragover)="onDropzoneDragOver($event)"
                    (dragleave)="onDropzoneDragLeave($event)"
                    (drop)="onDropzoneDrop($event)"
                    (click)="coverInput.click()"
                    (keydown.enter)="coverInput.click()"
                    (keydown.space)="coverInput.click()">
                    @if (primaryImageUrl()) {
                      <img [src]="primaryImageUrl()!" class="absolute inset-0 w-full h-full object-cover" alt="Foto principal de la excursión" />
                      <div class="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent"></div>
                      <div class="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2 items-center">
                        <button type="button" class="h-9 rounded-xl bg-white/90 px-3 text-xs font-bold text-[#344054]" (click)="$event.stopPropagation(); coverInput.click()">Cambiar imagen</button>
                        <button type="button" class="h-9 rounded-xl bg-[#111827]/85 px-3 text-xs font-bold text-white" (click)="$event.stopPropagation(); removePrimaryImage()">Eliminar</button>
                        <button type="button" class="h-9 rounded-xl bg-white/90 px-3 text-xs font-bold text-[#344054]" [disabled]="!isEdit() || photoLoading() || photoCount() >= 10" (click)="$event.stopPropagation(); galleryInput.click()">Agregar galería</button>
                      </div>
                    } @else {
                      <div class="h-full grid place-items-center text-center">
                        <div>
                          <div class="mx-auto w-16 h-16 rounded-2xl bg-[#ffe7f4] text-[#c71473] grid place-items-center text-2xl">🖼️</div>
                          <p class="mt-3 text-sm font-black text-[#111827]">Arrastra una imagen aquí</p>
                          <p class="text-sm font-semibold text-[#667085]">o haz clic para subir</p>
                          <p class="mt-2 text-xs text-[#98a2b3]">JPG, PNG, WEBP · máx. 5MB</p>
                        </div>
                      </div>
                    }
                  </div>

                  @if (!isEdit()) {
                    <p class="mt-2 text-xs text-[#b54708] font-semibold">Guarda primero la excursión para habilitar el upload de imágenes.</p>
                  }
                  @if (photoLoading()) {
                    <p class="mt-2 text-xs text-[#667085]">Subiendo imagen...</p>
                  }
                  @if (photoError()) {
                    <p class="mt-2 text-xs text-[#b42318]" role="alert">{{ photoError() }}</p>
                  }
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div class="md:col-span-2">
                    <label class="label">Nombre de la excursión *</label>
                    <input class="input-field" [(ngModel)]="form.name" name="name" required placeholder="Ej: Isla Saona Premium Tour" />
                  </div>

                  <div class="md:col-span-2">
                    <label class="label">Descripción</label>
                    <textarea class="input-field resize-none" rows="4" [(ngModel)]="form.description" name="description" placeholder="Describe la experiencia, recorrido, duración y puntos destacados..."></textarea>
                  </div>

                  <div>
                    <label class="label">Categoría de excursión</label>
                    <select class="input-field" [(ngModel)]="form.category_id" name="category_id">
                      <option value="">Sin categoría</option>
                      @for (cat of categories(); track cat.id) {
                        <option [value]="cat.id">{{ cat.name }}</option>
                      }
                    </select>
                  </div>

                  <div>
                    <label class="label">Operador *</label>
                    <select class="input-field" [(ngModel)]="form.operator_id" name="operator_id" required>
                      <option value="">Selecciona el operador responsable</option>
                      @for (op of operators(); track op.id) {
                        <option [value]="op.id">{{ op.name }}</option>
                      }
                    </select>
                  </div>

                  <div>
                    <label class="label">Nivel de dificultad</label>
                    <select class="input-field" [(ngModel)]="form.difficulty_level" name="difficulty_level">
                      <option value="facil">Fácil</option>
                      <option value="moderado">Moderado</option>
                      <option value="dificil">Difícil</option>
                    </select>
                  </div>

                  <div>
                    <label class="label">Idioma</label>
                    <input class="input-field" [(ngModel)]="form.language" name="language" placeholder="Español" />
                  </div>
                </div>
              </div>
            </section>

            <section class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-5">
              <h2 class="text-base font-black text-[#111827]">Ubicación y punto de encuentro</h2>
              <p class="text-sm text-[#667085] mt-1 mb-4">Define dónde inicia la experiencia y cómo llegará el cliente.</p>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="md:col-span-2">
                  <label class="label">Punto de encuentro</label>
                  <input class="input-field" [(ngModel)]="form.meeting_point" name="meeting_point" placeholder="Dirección o punto de encuentro" />
                </div>
                <label class="inline-flex items-center gap-2 h-11 rounded-xl border border-[#e7eaf1] bg-[#fbfcff] px-3">
                  <input type="checkbox" [(ngModel)]="form.hotel_pickup" name="hotel_pickup" />
                  <span class="text-sm font-semibold text-[#344054]">Incluye recogida</span>
                </label>
                <label class="inline-flex items-center gap-2 h-11 rounded-xl border border-[#e7eaf1] bg-[#fbfcff] px-3">
                  <input type="checkbox" [(ngModel)]="form.wheelchair_accessible" name="wheelchair_accessible" />
                  <span class="text-sm font-semibold text-[#344054]">Accesible para silla de ruedas</span>
                </label>
                @if (form.hotel_pickup) {
                  <div>
                    <label class="label">Hora de salida</label>
                    <input class="input-field" type="time" [(ngModel)]="form.pickup_time" name="pickup_time" />
                  </div>
                  <div class="md:col-span-2">
                    <label class="label">Instrucciones de llegada</label>
                    <textarea class="input-field resize-none" rows="2" [(ngModel)]="form.hotel_pickup_notes" name="hotel_pickup_notes" placeholder="Lugar de recogida, zona de cobertura o notas adicionales"></textarea>
                  </div>
                }
              </div>
            </section>

            <section class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-5">
              <h2 class="text-base font-black text-[#111827]">Precio y disponibilidad</h2>
              <p class="text-sm text-[#667085] mt-1 mb-4">Configura precio, visibilidad y estado comercial de la excursión.</p>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="label">Precio por persona *</label>
                  <input class="input-field" type="number" min="0" step="0.01" [(ngModel)]="form.price_per_person" name="price_per_person" required />
                </div>
                <div>
                  <label class="label">Estado de publicación</label>
                  <select class="input-field" [ngModel]="form.is_active ? 'publicada' : 'pausada'" (ngModelChange)="form.is_active = $event === 'publicada'" name="status_publication">
                    <option value="publicada">Publicada</option>
                    <option value="pausada">Pausada</option>
                  </select>
                </div>
                <label class="inline-flex items-center gap-2 h-11 rounded-xl border border-[#e7eaf1] bg-[#fbfcff] px-3">
                  <input type="checkbox" [(ngModel)]="form.is_active" name="is_active" />
                  <span class="text-sm font-semibold text-[#344054]">Disponible</span>
                </label>
              </div>
            </section>

            <section class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-5">
              <h2 class="text-base font-black text-[#111827]">Horario y capacidad</h2>
              <p class="text-sm text-[#667085] mt-1 mb-4">Controla duración, cupos, días disponibles y horario de salida.</p>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="label">Duración</label>
                  <input class="input-field" type="number" min="0.5" step="0.5" [(ngModel)]="form.duration_hours" name="duration_hours" placeholder="Horas" />
                </div>
                <div>
                  <label class="label">Cupo mínimo</label>
                  <input class="input-field" type="number" min="1" [(ngModel)]="form.min_people" name="min_people" />
                </div>
                <div>
                  <label class="label">Cupo máximo</label>
                  <input class="input-field" type="number" min="1" [(ngModel)]="form.max_people" name="max_people" />
                  <p class="text-[11px] text-[#98a2b3] mt-1">Máximo por reserva</p>
                </div>
                <div>
                  <label class="label">Hora de salida</label>
                  <input class="input-field" type="time" [(ngModel)]="form.pickup_time" name="pickup_time_schedule" />
                </div>
              </div>
            </section>

            <section class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-5 space-y-5">
              <div>
                <h2 class="text-base font-black text-[#111827]">Detalles de la experiencia</h2>
                <p class="text-sm text-[#667085] mt-1">Agrega información clave para que el cliente entienda la excursión.</p>
              </div>

              <div>
                <label class="label mb-2">Qué incluye</label>
                <div class="flex gap-2 mb-2">
                  <input class="input-field flex-1" [(ngModel)]="tagInputs.included" name="_included_input" placeholder="Ej. Transporte marítimo" (keydown.enter)="$event.preventDefault(); addTag('included')" />
                  <button type="button" class="h-11 px-4 rounded-2xl border border-[#e7eaf1] text-sm font-bold text-[#344054]" (click)="addTag('included')">Agregar</button>
                </div>
                <div class="flex flex-wrap gap-2">
                  @for (item of whatIsIncluded(); track item) {
                    <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#eafbf1] text-[#087b3c] text-sm font-semibold">
                      {{ item }}
                      <button type="button" class="leading-none" (click)="removeTag('included', item)" [attr.aria-label]="'Quitar elemento incluido ' + item">×</button>
                    </span>
                  }
                </div>
              </div>

              <div>
                <label class="label mb-2">Qué no incluye</label>
                <div class="flex gap-2 mb-2">
                  <input class="input-field flex-1" [(ngModel)]="tagInputs.notIncluded" name="_not_included_input" placeholder="Ej. Gastos personales" (keydown.enter)="$event.preventDefault(); addTag('notIncluded')" />
                  <button type="button" class="h-11 px-4 rounded-2xl border border-[#e7eaf1] text-sm font-bold text-[#344054]" (click)="addTag('notIncluded')">Agregar</button>
                </div>
                <div class="flex flex-wrap gap-2">
                  @for (item of whatIsNotIncluded(); track item) {
                    <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#fee2e2] text-[#b42318] text-sm font-semibold">
                      {{ item }}
                      <button type="button" class="leading-none" (click)="removeTag('notIncluded', item)" [attr.aria-label]="'Quitar elemento no incluido ' + item">×</button>
                    </span>
                  }
                </div>
              </div>

              <div>
                <label class="label">Recomendaciones</label>
                <div class="flex gap-2 mb-2">
                  <input class="input-field flex-1" [(ngModel)]="tagInputs.toBring" name="_to_bring_input" placeholder="Ej. Bloqueador solar, ropa cómoda" (keydown.enter)="$event.preventDefault(); addTag('toBring')" />
                  <button type="button" class="h-11 px-4 rounded-2xl border border-[#e7eaf1] text-sm font-bold text-[#344054]" (click)="addTag('toBring')">Agregar</button>
                </div>
                <div class="flex flex-wrap gap-2">
                  @for (item of whatToBring(); track item) {
                    <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#fff7dc] text-[#b54708] text-sm font-semibold">
                      {{ item }}
                      <button type="button" class="leading-none" (click)="removeTag('toBring', item)" [attr.aria-label]="'Quitar recomendación ' + item">×</button>
                    </span>
                  }
                </div>
              </div>
            </section>

            <section class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-5">
              <h2 class="text-base font-black text-[#111827]">Políticas y condiciones</h2>
              <p class="text-sm text-[#667085] mt-1 mb-4">Define reglas de cancelación, confirmación y restricciones.</p>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="label">Reserva con anticipación (horas)</label>
                  <input class="input-field" type="number" min="0" [(ngModel)]="form.min_hours_advance" name="min_hours_advance" />
                </div>
                <div>
                  <label class="label">Política de cancelación (horas)</label>
                  <input class="input-field" type="number" min="0" [(ngModel)]="form.cancellation_hours" name="cancellation_hours" />
                </div>
                <div>
                  <label class="label">Edad mínima</label>
                  <input class="input-field" type="number" min="0" [(ngModel)]="form.min_age" name="min_age" />
                </div>
                <div>
                  <label class="label">Edad máxima</label>
                  <input class="input-field" type="number" min="0" [(ngModel)]="form.max_age" name="max_age" />
                </div>
                <div class="md:col-span-2">
                  <label class="label">Requisitos</label>
                  <textarea class="input-field resize-none" rows="2" [(ngModel)]="form.physical_requirements" name="physical_requirements" placeholder="Condiciones físicas o requisitos para participar"></textarea>
                </div>
                <div class="md:col-span-2">
                  <label class="label">Restricciones</label>
                  <textarea class="input-field resize-none" rows="2" [(ngModel)]="form.health_warnings" name="health_warnings" placeholder="Restricciones, advertencias o notas internas"></textarea>
                </div>
              </div>
            </section>

            <div class="flex flex-col sm:flex-row gap-2 sm:justify-end pb-3">
              <button type="button" class="h-11 px-5 rounded-2xl border border-[#e7eaf1] text-sm font-bold text-[#344054] hover:bg-[#f8fafc] w-full sm:w-auto" (click)="router.navigate(['/excursions'])">Cancelar</button>
              <button type="submit" class="h-11 px-5 rounded-2xl bg-[#eb1b8d] hover:bg-[#c71473] text-sm font-black text-white w-full sm:w-auto" [disabled]="saveLoading() || !canSave()">
                {{ saveLoading() ? 'Guardando...' : (isEdit() ? 'Guardar cambios' : 'Crear excursión') }}
              </button>
            </div>
          </div>

          <aside class="space-y-4 xl:sticky xl:top-[84px] min-w-0">
            <section class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4">
              <h3 class="text-sm font-black text-[#111827]">Vista previa</h3>
              <p class="text-xs text-[#98a2b3] mb-3">Así se verá la excursión en el catálogo.</p>

              <div class="rounded-2xl overflow-hidden border border-[#eef1f6] bg-[#fbfcff]">
                <div class="h-40 bg-[#f4f6f9]">
                  @if (primaryImageUrl()) {
                    <img [src]="primaryImageUrl()!" class="w-full h-full object-cover" alt="Vista previa excursión" />
                  } @else {
                    <div class="h-full grid place-items-center text-[#98a2b3] text-sm font-semibold">Sin imagen</div>
                  }
                </div>
                <div class="p-3">
                  <div class="flex flex-wrap gap-1 mb-2">
                    <span class="inline-flex rounded-full px-2 py-1 text-[11px] font-black bg-[#eef4ff] text-[#2451c7]">{{ currentCategoryLabel() }}</span>
                    @if (form.is_active) {
                      <span class="inline-flex rounded-full px-2 py-1 text-[11px] font-black bg-[#eafbf1] text-[#087b3c]">Disponible</span>
                    } @else {
                      <span class="inline-flex rounded-full px-2 py-1 text-[11px] font-black bg-[#fff7dc] text-[#b54708]">Pendiente</span>
                    }
                    <span class="inline-flex rounded-full px-2 py-1 text-[11px] font-black bg-[#f4ecff] text-[#6d28d9]">Excursión</span>
                  </div>
                  <p class="text-sm font-black text-[#111827] leading-tight">{{ form.name || 'Nombre de la excursión' }}</p>
                  <p class="text-xs text-[#667085] mt-1">{{ selectedOperatorName() || 'Operador por definir' }}</p>
                  <div class="mt-2 text-xs text-[#667085] space-y-1">
                    <p>📍 {{ form.meeting_point || 'Ubicación por definir' }}</p>
                    <p>⏱ {{ form.duration_hours ?? 0 }} horas</p>
                    <p>👥 Hasta {{ form.max_people ?? 'N/A' }} personas</p>
                  </div>
                  <p class="mt-3 text-sm font-black text-[#111827]">RD$ {{ (form.price_per_person || 0).toLocaleString('es-DO') }} por persona</p>
                </div>
              </div>
            </section>

            <section class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4">
              <h3 class="text-sm font-black text-[#111827]">Resumen</h3>
              <p class="text-xs text-[#98a2b3] mb-3">Revisa los detalles antes de publicar.</p>
              <div class="space-y-2 text-sm">
                <div class="flex items-center justify-between gap-2"><span class="text-[#667085]">Operador</span><strong class="text-[#111827]">{{ selectedOperatorName() || '—' }}</strong></div>
                <div class="flex items-center justify-between gap-2"><span class="text-[#667085]">Categoría</span><strong class="text-[#111827]">{{ currentCategoryLabel() }}</strong></div>
                <div class="flex items-center justify-between gap-2"><span class="text-[#667085]">Ubicación</span><strong class="text-[#111827]">{{ form.meeting_point || '—' }}</strong></div>
                <div class="flex items-center justify-between gap-2"><span class="text-[#667085]">Duración</span><strong class="text-[#111827]">{{ form.duration_hours ?? 0 }} h</strong></div>
                <div class="flex items-center justify-between gap-2"><span class="text-[#667085]">Precio</span><strong class="text-[#111827]">RD$ {{ (form.price_per_person || 0).toLocaleString('es-DO') }}</strong></div>
                <div class="flex items-center justify-between gap-2"><span class="text-[#667085]">Cupo máximo</span><strong class="text-[#111827]">{{ form.max_people ?? '—' }}</strong></div>
                <div class="flex items-center justify-between gap-2"><span class="text-[#667085]">Máximo por reserva</span><strong class="text-[#111827]">{{ form.max_people ?? '—' }}</strong></div>
                <div class="flex items-center justify-between gap-2"><span class="text-[#667085]">Disponible</span><strong class="text-[#111827]">{{ form.is_active ? 'Sí' : 'No' }}</strong></div>
                <div class="flex items-center justify-between gap-2"><span class="text-[#667085]">Estado</span><strong class="text-[#111827]">{{ form.is_active ? 'Publicada' : 'Pausada' }}</strong></div>
              </div>
            </section>

            <section class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4">
              <h3 class="text-sm font-black text-[#111827]">Checklist</h3>
              <p class="text-xs text-[#98a2b3] mb-3">Completa lo necesario para publicar correctamente la excursión.</p>
              <div class="space-y-2 text-sm text-[#344054]">
                <p>• Agrega una imagen clara de la experiencia.</p>
                <p>• Usa un nombre corto y fácil de entender.</p>
                <p>• Confirma precio y disponibilidad.</p>
                <p>• Define ubicación y punto de encuentro.</p>
                <p>• Configura duración y cupos.</p>
                <p>• Revisa políticas y condiciones.</p>
              </div>
            </section>
          </aside>
        </form>
      }
    </div>
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
  readonly excursionPhotos = signal<ExcursionPhotoAsset[]>([]);
  readonly legacyPhotos = signal<string[]>([]);
  readonly photoLoading = signal<boolean>(false);
  readonly photoError = signal<string | null>(null);
  readonly isDropzoneActive = signal(false);

  // Temporary tag inputs
  tagInputs = { included: '', notIncluded: '', toBring: '', equipment: '', photo: '' };
  private readonly supportedImageTypes = ALLOWED_IMAGE_TYPES.filter((type) => type !== 'image/avif');

  canSave(): boolean {
    return !!this.form.name.trim() && !!this.form.operator_id && Number(this.form.price_per_person) >= 0;
  }

  selectedOperatorName(): string {
    if (!this.form.operator_id) return '';
    return this.operators().find((operator) => operator.id === this.form.operator_id)?.name ?? '';
  }

  currentCategoryLabel(): string {
    if (!this.form.category_id) return 'Sin categoría';
    return this.categories().find((category) => category.id === this.form.category_id)?.name ?? 'Sin categoría';
  }

  statusWarning(): { title: string; description: string } | null {
    if (!this.form.operator_id) return null;
    const operator = this.operators().find((item) => item.id === this.form.operator_id);
    if (!operator) return null;
    const approvalStatus = String((operator as any).approval_status ?? '').toLowerCase();
    if (approvalStatus === 'pendiente') {
      return {
        title: 'Excursión pendiente de revisión',
        description: 'Esta excursión todavía requiere revisión antes de publicarse.',
      };
    }
    if (approvalStatus === 'suspendido' || approvalStatus === 'rechazado') {
      return {
        title: 'Operador fuera de horario',
        description: 'El operador está activo, pero la excursión está fuera del horario configurado.',
      };
    }
    return null;
  }

  photoCount(): number {
    return this.photos().length;
  }

  primaryImageUrl(): string | null {
    const primaryAsset = this.excursionPhotos().find((photo) => photo.kind === 'excursion_cover' || photo.is_primary);
    if (primaryAsset?.public_url) return primaryAsset.public_url;
    const firstRpc = this.excursionPhotos()[0]?.public_url;
    if (firstRpc) return firstRpc;
    const firstLegacy = this.legacyPhotos()[0];
    return firstLegacy ?? null;
  }

  async removePrimaryImage(): Promise<void> {
    const primaryAsset = this.excursionPhotos().find((photo) => photo.kind === 'excursion_cover' || photo.is_primary);
    if (primaryAsset) {
      await this.removePhoto(primaryAsset);
      return;
    }
    const legacy = this.legacyPhotos()[0];
    if (legacy) this.removeLegacyPhoto(legacy);
  }

  onDropzoneDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.isEdit()) return;
    this.isDropzoneActive.set(true);
  }

  onDropzoneDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDropzoneActive.set(false);
  }

  async onDropzoneDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.isDropzoneActive.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    await this.uploadSinglePhoto(file, 'excursion_cover');
  }

  private imageValidationMessage(file: File): string | null {
    const validationError = validateImageFile(file, 5, this.supportedImageTypes);
    if (!validationError) return null;
    if (validationError.code === 'type') return 'Solo puedes subir imágenes JPG, PNG o WEBP.';
    if (validationError.code === 'size') return 'La imagen no puede pesar más de 5MB.';
    return validationError.message;
  }

  private canUploadPhotos(): boolean {
    if (this.excursionId && this.form.operator_id) return true;
    this.photoError.set('Guarda primero la excursión para habilitar el upload de imágenes.');
    this.toastService.error('Guarda primero la excursión para habilitar el upload de imágenes.');
    return false;
  }

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
          this.legacyPhotos.set(Array.isArray(exc.photos) ? exc.photos : []);
          if (this.isEdit()) {
            void this.refreshExcursionPhotos();
          }
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

  private async uploadSinglePhoto(file: File, kind: 'excursion_cover' | 'excursion_gallery'): Promise<boolean> {
    if (!this.canUploadPhotos()) return false;
    const validationMessage = this.imageValidationMessage(file);
    if (validationMessage) {
      this.photoError.set(validationMessage);
      this.toastService.error(validationMessage);
      return false;
    }
    this.photoError.set(null);

    if (kind === 'excursion_gallery' && this.photoCount() >= 10) {
      this.photoError.set('Máximo 10 fotos por excursión.');
      this.toastService.error('Máximo 10 fotos por excursión.');
      return false;
    }

    await this.service.uploadExcursionPhoto({
      excursionId: this.excursionId,
      operatorId: this.form.operator_id,
      file,
      kind,
    });
    await this.refreshExcursionPhotos();
    return true;
  }

  async onPhotoFileSelected(event: Event, kind: 'excursion_cover' | 'excursion_gallery'): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.photoLoading.set(true);
    try {
      const uploaded = await this.uploadSinglePhoto(file, kind);
      if (uploaded) this.toastService.success(kind === 'excursion_cover' ? 'Imagen principal actualizada' : 'Foto agregada');
    } catch {
      this.photoError.set('No se pudo subir la imagen. Intenta nuevamente.');
      this.toastService.error('No se pudo subir la imagen. Intenta nuevamente.');
    } finally {
      this.photoLoading.set(false);
    }
  }

  async onGalleryFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;
    if (!this.canUploadPhotos()) return;

    const remaining = Math.max(0, 10 - this.photoCount());
    const batch = files.slice(0, remaining);
    if (!batch.length) {
      this.toastService.error('Máximo 10 fotos por excursión.');
      return;
    }

    this.photoLoading.set(true);
    try {
      let uploadedCount = 0;
      for (const file of batch) {
        const uploaded = await this.uploadSinglePhoto(file, 'excursion_gallery');
        if (uploaded) uploadedCount += 1;
      }
      if (uploadedCount > 0) {
        this.photoError.set(null);
        this.toastService.success(uploadedCount === 1 ? 'Foto agregada' : `${uploadedCount} fotos agregadas`);
      }
    } catch {
      this.photoError.set('No se pudo subir la imagen. Intenta nuevamente.');
      this.toastService.error('No se pudo subir la imagen. Intenta nuevamente.');
    } finally {
      this.photoLoading.set(false);
    }
  }

  async removePhoto(photo: ExcursionPhotoAsset): Promise<void> {
    if (!photo.media_asset_id) return;
    this.photoLoading.set(true);
    try {
      await this.service.removeExcursionPhoto(photo.media_asset_id);
      await this.refreshExcursionPhotos();
      this.toastService.success('Foto eliminada');
    } catch {
      this.toastService.error('No se pudo eliminar la foto');
    } finally {
      this.photoLoading.set(false);
    }
  }

  removeLegacyPhoto(url: string): void {
    this.legacyPhotos.update(arr => arr.filter(item => item !== url));
    this.photos.set(this.excursionPhotos().map(photo => photo.public_url).concat(this.legacyPhotos()));
  }

  private async refreshExcursionPhotos(): Promise<void> {
    if (!this.excursionId) return;
    try {
      const assets = await this.service.getExcursionPhotos(this.excursionId);
      this.excursionPhotos.set(assets);
      const rpcUrls = assets.map(photo => photo.public_url);
      const extras = this.legacyPhotos().filter(url => !rpcUrls.includes(url));
      this.photos.set([...rpcUrls, ...extras]);
    } catch {
      this.excursionPhotos.set([]);
      this.photos.set(this.legacyPhotos());
    }
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
