import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../shared/ui/modal/confirm.service';
import { AdminEmptyStateComponent } from '../../shared/ui/admin-empty-state/admin-empty-state.component';
import { AdminImageFieldComponent } from '../../shared/ui/image-field/admin-image-field.component';
import {
  createEmptyPromoTranslationMap,
  HomePromo,
  HomePromoInsert,
  PromoCategory,
  PromoFormLanguage,
  PromoTranslationField,
  PromoTargetType,
  PromotionsService,
} from './promotions.service';

@Component({
  selector: 'app-promotions-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PageHeaderComponent,
    AdminEmptyStateComponent,
    AdminImageFieldComponent,
  ],
  template: `
    <app-page-header
      title="Promos del home"
      subtitle="CRUD de promos dinámicas para la sección Promos de clientes">
      <button class="btn-primary" (click)="openForm()">+ Nueva promo</button>
    </app-page-header>

    <div class="flex flex-wrap gap-3 mb-4">
      <input
        class="input-field max-w-sm"
        type="search"
        placeholder="Buscar por título o badge..."
        [(ngModel)]="searchText"
        aria-label="Buscar promos por título o badge" />

      <select
        class="input-field w-52"
        [(ngModel)]="categoryFilter"
        aria-label="Filtrar promos por categoría">
        <option value="all">Todas las categorías</option>
        @for (cat of categories; track cat.value) {
          <option [value]="cat.value">{{ cat.label }}</option>
        }
      </select>
    </div>

    <div class="admin-table-card">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Title</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Badge</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Idiomas</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Priority</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Activo</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Starts</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ends</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-100">
            @if (loading()) {
              @for (i of [1,2,3]; track i) {
                <tr class="animate-pulse">
                  @for (j of [1,2,3,4,5,6,7,8,9]; track j) {
                    <td class="px-4 py-3"><div class="h-4 bg-gray-200 rounded w-3/4"></div></td>
                  }
                </tr>
              }
            } @else if (filteredPromos().length === 0) {
              <tr>
                <td colspan="9" class="px-4 py-10">
                  <app-admin-empty-state
                    icon="search"
                    title="Sin promos registradas"
                    description="Crea la primera promo para el home de clientes."
                    actionLabel="+ Nueva promo"
                    (action)="openForm()" />
                </td>
              </tr>
            } @else {
              @for (promo of filteredPromos(); track promo.id) {
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-3">
                    <p class="text-sm font-medium text-gray-800">{{ promo.title }}</p>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-700">{{ categoryLabel(promo.category) }}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">{{ promo.badge || '—' }}</td>
                  <td class="px-4 py-3">
                    @if (missingTranslations(promo.id) === 0) {
                      <span class="inline-flex items-center rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
                        Completo
                      </span>
                    } @else {
                      <span class="inline-flex items-center rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-semibold text-warning-700">
                        Faltan {{ missingTranslations(promo.id) }}
                      </span>
                    }
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-700">{{ promo.priority }}</td>
                  <td class="px-4 py-3">
                    <button
                      class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                      [class]="promo.is_active ? 'bg-success-500' : 'bg-gray-200'"
                      (click)="toggleActive(promo)"
                      role="switch"
                      [attr.aria-checked]="promo.is_active"
                      [attr.aria-label]="promo.is_active ? 'Desactivar promo ' + promo.title : 'Activar promo ' + promo.title">
                      <span
                        class="inline-block w-4 h-4 transform rounded-full bg-white shadow transition-transform"
                        [class]="promo.is_active ? 'translate-x-4' : 'translate-x-0.5'"></span>
                    </button>
                  </td>
                  <td class="px-4 py-3 text-xs text-gray-500">{{ formatDate(promo.starts_at) }}</td>
                  <td class="px-4 py-3 text-xs text-gray-500">{{ promo.ends_at ? formatDate(promo.ends_at) : 'Sin vencimiento' }}</td>
                  <td class="px-4 py-3">
                    <div class="flex gap-2">
                      <button class="btn-secondary px-2 py-1 text-xs" (click)="openForm(promo)">Editar</button>
                      <button class="btn-danger px-2 py-1 text-xs" (click)="deletePromo(promo)">Eliminar</button>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (showForm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="showForm.set(false)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto z-10">
          <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between">
            <h3 class="font-semibold">{{ editingId() ? 'Editar promo' : 'Nueva promo' }}</h3>
            <button
              type="button"
              class="text-gray-400"
              aria-label="Cerrar formulario"
              (click)="showForm.set(false)">✕</button>
          </div>

          <form class="p-6 space-y-5" [formGroup]="promoForm" (ngSubmit)="save()">
            <div class="flex flex-wrap items-center gap-2">
              @for (lang of formLangs; track lang.value) {
                <button
                  type="button"
                  class="admin-chip"
                  [class.admin-chip--active]="activeFormLang() === lang.value"
                  [disabled]="lang.value !== 'es' && !editingId()"
                  (click)="setFormLanguage(lang.value)"
                >
                  {{ lang.label }}
                </button>
              }
              @if (!editingId()) {
                <span class="text-xs text-gray-500">
                  Guarda primero en ES para habilitar EN/FR/IT.
                </span>
              }
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              @if (activeFormLang() === 'es') {
                <div class="md:col-span-2">
                  <label class="label">Title *</label>
                  <input class="input-field" formControlName="title" />
                </div>

                <div class="md:col-span-2">
                  <label class="label">Description</label>
                  <textarea class="input-field resize-none" rows="3" formControlName="description"></textarea>
                </div>

                <div>
                  <label class="label">Badge</label>
                  <input class="input-field" formControlName="badge" />
                </div>
              } @else {
                <div class="md:col-span-2">
                  <label class="label">Title ({{ activeFormLangLabel() }})</label>
                  <input
                    class="input-field"
                    [ngModel]="translationValue('name')"
                    (ngModelChange)="setTranslationValue('name', $event)"
                    [ngModelOptions]="{ standalone: true }"
                    placeholder="(sin traducir, se usará el español)" />
                </div>

                <div class="md:col-span-2">
                  <label class="label">Description ({{ activeFormLangLabel() }})</label>
                  <textarea
                    class="input-field resize-none"
                    rows="3"
                    [ngModel]="translationValue('description')"
                    (ngModelChange)="setTranslationValue('description', $event)"
                    [ngModelOptions]="{ standalone: true }"
                    placeholder="(sin traducir, se usará el español)"></textarea>
                </div>

                <div>
                  <label class="label">Badge ({{ activeFormLangLabel() }})</label>
                  <input
                    class="input-field"
                    [ngModel]="translationValue('caption')"
                    (ngModelChange)="setTranslationValue('caption', $event)"
                    [ngModelOptions]="{ standalone: true }"
                    placeholder="(sin traducir, se usará el español)" />
                </div>
              }

              <div>
                <label class="label">Category *</label>
                <select class="input-field" formControlName="category">
                  @for (cat of categories; track cat.value) {
                    <option [value]="cat.value">{{ cat.label }}</option>
                  }
                </select>
              </div>

              <div>
                <label class="label">Color tone</label>
                <input class="input-field" formControlName="color_tone" placeholder="pink, purple, blue..." />
              </div>

              <div>
                <label class="label">Priority *</label>
                <input class="input-field" type="number" formControlName="priority" />
              </div>

              @if (activeFormLang() === 'es') {
                <div>
                  <label class="label">CTA label</label>
                  <input class="input-field" formControlName="cta_label" />
                </div>
              } @else {
                <div>
                  <label class="label">CTA label ({{ activeFormLangLabel() }})</label>
                  <input
                    class="input-field"
                    [ngModel]="translationValue('label')"
                    (ngModelChange)="setTranslationValue('label', $event)"
                    [ngModelOptions]="{ standalone: true }"
                    placeholder="(sin traducir, se usará el español)" />
                </div>
              }

              <div>
                <label class="label">CTA target type *</label>
                <select class="input-field" formControlName="cta_target_type">
                  @for (target of targetTypes; track target.value) {
                    <option [value]="target.value">{{ target.label }}</option>
                  }
                </select>
              </div>

              <div class="md:col-span-2">
                <label class="label">CTA target value *</label>
                <input
                  class="input-field"
                  formControlName="cta_target_value"
                  [placeholder]="promoForm.value.cta_target_type === 'external' ? 'https://...' : '/customer/catalog'" />
              </div>

              <div>
                <label class="label">Starts at *</label>
                <input class="input-field" type="datetime-local" formControlName="starts_at" />
              </div>

              <div>
                <label class="label">Ends at</label>
                <input class="input-field" type="datetime-local" formControlName="ends_at" />
              </div>

              <div class="md:col-span-2">
                <label class="label">Image URL</label>
                <input class="input-field" formControlName="image_url" placeholder="https://..." />
              </div>

              <div class="md:col-span-2">
                <app-admin-image-field
                  label="Subir imagen"
                  aspect="16/9"
                  [maxMb]="8"
                  [currentUrl]="promoForm.value.image_url || null"
                  [uploading]="uploadingImage()"
                  (fileSelected)="onImageSelected($event)"
                  (removed)="promoForm.patchValue({ image_url: '' })">
                </app-admin-image-field>
              </div>

              <div class="md:col-span-2 flex items-center gap-3">
                <input id="promo-active" type="checkbox" class="w-4 h-4 text-brand-600" formControlName="is_active" />
                <label for="promo-active" class="text-sm text-gray-700">Promo activa</label>
              </div>
            </div>

            <div class="flex gap-3 justify-end">
              <button type="button" class="btn-secondary" (click)="showForm.set(false)">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="promoForm.invalid || saveLoading()">
                {{ saveLoading() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class PromotionsPageComponent implements OnInit {
  private readonly service = inject(PromotionsService);
  private readonly toastService = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly saveLoading = signal(false);
  readonly uploadingImage = signal(false);
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly promotions = signal<HomePromo[]>([]);
  readonly activeFormLang = signal<PromoFormLanguage>('es');
  readonly translations = signal(createEmptyPromoTranslationMap());
  readonly translationMissingByPromo = signal<Record<string, number>>({});

  searchText = '';
  categoryFilter: 'all' | PromoCategory = 'all';

  readonly categories: ReadonlyArray<{ value: PromoCategory; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'food', label: 'Food' },
    { value: 'beach', label: 'Beach' },
    { value: 'experiences', label: 'Experiences' },
    { value: 'transport', label: 'Transport' },
  ];

  readonly targetTypes: ReadonlyArray<{ value: PromoTargetType; label: string }> = [
    { value: 'catalog', label: 'Catalog' },
    { value: 'excursions', label: 'Excursions' },
    { value: 'commerce', label: 'Commerce' },
    { value: 'support', label: 'Support' },
    { value: 'external', label: 'External URL' },
  ];

  readonly formLangs: ReadonlyArray<{ value: PromoFormLanguage; label: string }> = [
    { value: 'es', label: 'ES' },
    { value: 'en', label: 'EN' },
    { value: 'fr', label: 'FR' },
    { value: 'it', label: 'IT' },
  ];

  readonly promoForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: [''],
    badge: [''],
    category: ['all' as PromoCategory, Validators.required],
    color_tone: [''],
    cta_label: [''],
    cta_target_type: ['catalog' as PromoTargetType, Validators.required],
    cta_target_value: ['', Validators.required],
    image_url: [''],
    priority: [0, Validators.required],
    starts_at: [this.toLocalDateTime(new Date().toISOString()), Validators.required],
    ends_at: [''],
    is_active: [true],
  });

  readonly filteredPromos = computed(() => {
    const text = this.searchText.trim().toLowerCase();
    return this.promotions().filter((promo) => {
      const matchesCategory = this.categoryFilter === 'all' || promo.category === this.categoryFilter;
      if (!matchesCategory) {
        return false;
      }
      if (!text) {
        return true;
      }
      return (
        promo.title.toLowerCase().includes(text) ||
        (promo.badge ?? '').toLowerCase().includes(text)
      );
    });
  });

  ngOnInit(): void {
    this.loadPromotions();
  }

  loadPromotions(): void {
    this.loading.set(true);
    this.service.getPromotions().subscribe({
      next: async (rows) => {
        this.promotions.set(rows);
        const ids = rows.map((promo) => promo.id);
        try {
          const coverage = await this.service.getTranslationCoverage(ids);
          this.translationMissingByPromo.set(coverage);
        } catch {
          this.translationMissingByPromo.set({});
        }
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Error al cargar promos');
        this.loading.set(false);
      },
    });
  }

  openForm(promo?: HomePromo): void {
    this.editingId.set(promo?.id ?? null);
    this.activeFormLang.set('es');
    this.translations.set(createEmptyPromoTranslationMap());
    this.promoForm.reset({
      title: promo?.title ?? '',
      description: promo?.description ?? '',
      badge: promo?.badge ?? '',
      category: promo?.category ?? 'all',
      color_tone: promo?.color_tone ?? '',
      cta_label: promo?.cta_label ?? '',
      cta_target_type: promo?.cta_target_type ?? 'catalog',
      cta_target_value: promo?.cta_target_value ?? '',
      image_url: promo?.image_url ?? '',
      priority: promo?.priority ?? 0,
      starts_at: this.toLocalDateTime(promo?.starts_at ?? new Date().toISOString()),
      ends_at: this.toLocalDateTime(promo?.ends_at ?? ''),
      is_active: promo?.is_active ?? true,
    });
    if (promo?.id) {
      void this.loadTranslations(promo.id);
    }
    this.showForm.set(true);
  }

  async save(): Promise<void> {
    if (this.promoForm.invalid) {
      this.promoForm.markAllAsTouched();
      return;
    }

    const value = this.promoForm.getRawValue();
    const payload: HomePromoInsert = {
      title: value.title.trim(),
      description: this.asNullable(value.description),
      badge: this.asNullable(value.badge),
      category: value.category,
      color_tone: this.asNullable(value.color_tone),
      cta_label: this.asNullable(value.cta_label),
      cta_target_type: value.cta_target_type,
      cta_target_value: this.asNullable(value.cta_target_value),
      image_url: this.asNullable(value.image_url),
      priority: Number(value.priority) || 0,
      starts_at: this.toIsoOrNow(value.starts_at),
      ends_at: this.toIsoOrNull(value.ends_at),
      is_active: value.is_active,
    };

    this.saveLoading.set(true);
    try {
      if (this.editingId()) {
        await this.service.updatePromotion(this.editingId()!, payload);
        await this.service.savePromotionTranslations(this.editingId()!, this.translations());
      } else {
        const created = await this.service.createPromotion(payload);
        await this.service.savePromotionTranslations(created.id, this.translations());
      }
      this.toastService.success('Promo guardada');
      this.showForm.set(false);
      this.loadPromotions();
    } catch {
      this.toastService.error('Error al guardar promo');
    } finally {
      this.saveLoading.set(false);
    }
  }

  async deletePromo(promo: HomePromo): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: `¿Eliminar "${promo.title}"?`,
      message: 'Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!ok) {
      return;
    }

    try {
      await this.service.deletePromotion(promo.id);
      this.toastService.success('Promo eliminada');
      this.loadPromotions();
    } catch {
      this.toastService.error('Error al eliminar promo');
    }
  }

  async toggleActive(promo: HomePromo): Promise<void> {
    try {
      await this.service.togglePromotion(promo.id, !promo.is_active);
      this.promotions.update((list) =>
        list.map((item) =>
          item.id === promo.id
            ? { ...item, is_active: !promo.is_active }
            : item
        )
      );
    } catch {
      this.toastService.error('Error al actualizar estado');
    }
  }

  async onImageSelected(file: File): Promise<void> {
    this.uploadingImage.set(true);
    try {
      const imageUrl = await this.service.uploadPromoImage(file);
      this.promoForm.patchValue({ image_url: imageUrl });
      this.toastService.success('Imagen subida');
    } catch {
      this.toastService.error('Error al subir imagen');
    } finally {
      this.uploadingImage.set(false);
    }
  }

  categoryLabel(value: PromoCategory): string {
    return this.categories.find((item) => item.value === value)?.label ?? value;
  }

  missingTranslations(promoId: string): number {
    return this.translationMissingByPromo()[promoId] ?? 12;
  }

  setFormLanguage(lang: PromoFormLanguage): void {
    if (lang !== 'es' && !this.editingId()) {
      return;
    }
    this.activeFormLang.set(lang);
  }

  activeFormLangLabel(): string {
    return this.formLangs.find((item) => item.value === this.activeFormLang())?.label ?? 'ES';
  }

  translationValue(field: PromoTranslationField): string {
    const lang = this.activeFormLang();
    if (lang === 'es') {
      return '';
    }
    return this.translations()[field][lang];
  }

  setTranslationValue(field: PromoTranslationField, value: string): void {
    const lang = this.activeFormLang();
    if (lang === 'es') {
      return;
    }
    this.translations.update((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [lang]: value,
      },
    }));
  }

  formatDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return new Intl.DateTimeFormat('es-DO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private asNullable(value: string): string | null {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private toIsoOrNow(localDateTime: string): string {
    const iso = this.toIsoOrNull(localDateTime);
    return iso ?? new Date().toISOString();
  }

  private toIsoOrNull(localDateTime: string): string | null {
    if (!localDateTime?.trim()) {
      return null;
    }
    const date = new Date(localDateTime);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  }

  private toLocalDateTime(isoDateTime: string): string {
    if (!isoDateTime) {
      return '';
    }
    const date = new Date(isoDateTime);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
  }

  private async loadTranslations(promoId: string): Promise<void> {
    try {
      const rows = await this.service.getPromotionTranslations(promoId);
      this.translations.set(rows);
    } catch {
      this.translations.set(createEmptyPromoTranslationMap());
      this.toastService.error('No se pudieron cargar traducciones');
    }
  }
}
