import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap, map, catchError, of } from 'rxjs';
import { RegisterService } from '../register.service';
import { StoreCategory } from '../../../core/supabase/database.types';

const SD_SECTORS = [
  'Naco', 'Piantini', 'Bella Vista', 'Gazcue', 'Zona Colonial', 'Los Prados',
  'Altos de Arroyo Hondo', 'Mirador Norte', 'El Millón', 'Evaristo Morales', 'Serralles',
  'La Julia', 'Alma Rosa', 'Los Cacicazgos', 'Cristo Rey', 'La Fe', 'Ensanche La Fe',
  'Ensanche Ozama', 'Gualey', 'Villa Consuelo', 'Villa Juana', 'Quisqueya',
  'Villas Agrícolas', 'Pedro Brand', 'Los Alcarrizos', 'Santo Domingo Este',
  'Santo Domingo Norte', 'Santo Domingo Oeste',
];

const CUISINE_TYPES = [
  'Dominicana', 'Americana', 'Italiana', 'China', 'Japonesa/Sushi',
  'Mariscos', 'Vegetariana', 'Parrilla', 'Pizza', 'Postres & Café', 'Internacional',
];

const RD_PHONE_PATTERN = /^(\+1\s?)?(809|829|849)[-.\s]?\d{3}[-.\s]?\d{4}$/;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Component({
  selector: 'app-register-step-info',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="step-container">
      <div class="step-header">
        <h1>Información del comercio</h1>
        <p>Cuéntanos sobre tu negocio. Esta información será visible para tus clientes.</p>
      </div>

      <form [formGroup]="form" (ngSubmit)="next()" class="info-form">

        <!-- Name -->
        <div class="form-group">
          <label class="label" for="name">Nombre del comercio *</label>
          <input id="name" type="text" class="input-field" formControlName="name" placeholder="Ej. Colmado El Progreso" />
          @if (f['name'].touched && f['name'].errors?.['required']) {
            <span class="field-error">El nombre es requerido</span>
          }
        </div>

        <!-- Slug -->
        <div class="form-group">
          <label class="label" for="slug">URL única (slug) *</label>
          <div class="slug-wrapper">
            <span class="slug-prefix">tuttys.do/</span>
            <input id="slug" type="text" class="input-field slug-input" formControlName="slug" placeholder="mi-comercio" />
          </div>
          @if (f['slug'].pending) {
            <span class="field-hint">Verificando disponibilidad…</span>
          }
          @if (f['slug'].touched && f['slug'].errors?.['slugTaken']) {
            <span class="field-error">Este slug ya está en uso</span>
          }
          @if (f['slug'].touched && f['slug'].errors?.['required']) {
            <span class="field-error">El slug es requerido</span>
          }
          @if (f['slug'].valid && !f['slug'].pending) {
            <span class="field-success">✓ Disponible</span>
          }
        </div>

        <!-- Description -->
        <div class="form-group">
          <label class="label" for="description">Descripción</label>
          <textarea id="description" class="input-field" formControlName="description" rows="3" placeholder="¿Qué ofrece tu negocio?"></textarea>
        </div>

        <!-- WhatsApp -->
        <div class="form-group">
          <label class="label" for="whatsapp">Número de WhatsApp *</label>
          <input id="whatsapp" type="tel" class="input-field" formControlName="whatsapp_number" placeholder="809-000-0000" />
          @if (f['whatsapp_number'].touched && f['whatsapp_number'].errors?.['required']) {
            <span class="field-error">El número de WhatsApp es requerido</span>
          }
          @if (f['whatsapp_number'].touched && f['whatsapp_number'].errors?.['pattern']) {
            <span class="field-error">Formato RD: 809/829/849-XXX-XXXX</span>
          }
        </div>

        <!-- Address + Sector -->
        <div class="form-row">
          <div class="form-group">
            <label class="label" for="address">Dirección *</label>
            <input id="address" type="text" class="input-field" formControlName="address" placeholder="Calle Principal #1" />
            @if (f['address'].touched && f['address'].errors?.['required']) {
              <span class="field-error">La dirección es requerida</span>
            }
          </div>
          <div class="form-group">
            <label class="label" for="sector">Sector</label>
            <input id="sector" type="text" class="input-field" formControlName="sector" placeholder="Ej. Naco" list="sd-sectors" />
            <datalist id="sd-sectors">
              @for (s of sdSectors; track s) { <option [value]="s"></option> }
            </datalist>
          </div>
        </div>

        <!-- City -->
        <div class="form-group">
          <label class="label" for="city">Ciudad *</label>
          <select id="city" class="input-field" formControlName="city">
            <option value="">Seleccionar ciudad</option>
            @for (city of cities; track city) {
              <option [value]="city">{{ city }}</option>
            }
          </select>
          @if (f['city'].touched && f['city'].errors?.['required']) {
            <span class="field-error">La ciudad es requerida</span>
          }
        </div>

        <!-- Category -->
        <div class="form-group">
          <label class="label" for="category">Categoría</label>
          <select id="category" class="input-field" formControlName="category_id">
            <option value="">Sin categoría específica</option>
            @for (cat of categories(); track cat.id) {
              <option [value]="cat.id">{{ getCategoryIcon(cat.slug) }} {{ cat.name }}</option>
            }
          </select>
        </div>

        <!-- RESTAURANTE: cuisine types -->
        @if (commerceType() === 'restaurante') {
          <div class="form-group">
            <label class="label">Tipo de cocina (selecciona los que apliquen)</label>
            <div class="tag-grid">
              @for (c of cuisineTypes; track c) {
                <button type="button" class="tag-btn" [class.active]="isCuisineSelected(c)" (click)="toggleCuisine(c)">
                  {{ c }}
                </button>
              }
            </div>
          </div>
        }

        <!-- FARMACIA: SESPAS + 24h -->
        @if (commerceType() === 'farmacia') {
          <div class="form-group">
            <label class="label" for="sespas">Número de registro SESPAS</label>
            <input id="sespas" type="text" class="input-field" formControlName="sespas_number" placeholder="Ej. DGRNT-001234" />
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" formControlName="farmacia_24h" />
              Farmacia de guardia (abierta las 24 horas)
            </label>
          </div>
        }

        <!-- Logo upload -->
        <div class="form-group">
          <label class="label">Logo del comercio</label>
          <div class="upload-area" (click)="logoInput.click()" [class.has-file]="logoPreview()">
            @if (logoPreview()) {
              <img [src]="logoPreview()" class="preview-image" alt="Logo preview" />
            } @else {
              <div class="upload-placeholder">
                <span class="upload-icon">🖼️</span>
                <span>Haz clic para subir tu logo</span>
                <span class="upload-hint">PNG, JPG • Max 2 MB • Recomendado: cuadrado</span>
              </div>
            }
          </div>
          <input #logoInput type="file" accept="image/*" class="hidden-input" (change)="onLogoChange($event)" />
          @if (logoUploading()) {
            <span class="field-hint">Subiendo imagen…</span>
          }
        </div>

        <!-- Banner upload -->
        <div class="form-group">
          <label class="label">Banner del comercio</label>
          <div class="upload-area banner-area" (click)="bannerInput.click()" [class.has-file]="bannerPreview()">
            @if (bannerPreview()) {
              <img [src]="bannerPreview()" class="preview-image banner-preview" alt="Banner preview" />
            } @else {
              <div class="upload-placeholder">
                <span class="upload-icon">🌅</span>
                <span>Haz clic para subir tu banner</span>
                <span class="upload-hint">PNG, JPG • Max 5 MB • Recomendado: 1280×400 px</span>
              </div>
            }
          </div>
          <input #bannerInput type="file" accept="image/*" class="hidden-input" (change)="onBannerChange($event)" />
          @if (bannerUploading()) {
            <span class="field-hint">Subiendo imagen…</span>
          }
        </div>

        <div class="step-actions">
          <button type="button" class="btn-secondary" (click)="back()">← Atrás</button>
          <button type="submit" class="btn-primary" [disabled]="form.invalid || form.pending || logoUploading() || bannerUploading()">
            Continuar →
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .step-container { max-width: 600px; margin: 0 auto; }

    .step-header { margin-bottom: 2rem; }
    .step-header h1 { font-size: 1.5rem; font-weight: 700; color: #111827; margin: 0 0 0.5rem; }
    .step-header p { color: #6b7280; font-size: 0.9rem; margin: 0; }

    .info-form { display: flex; flex-direction: column; gap: 1.25rem; }

    .form-group { display: flex; flex-direction: column; gap: 0.4rem; }

    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

    .slug-wrapper {
      display: flex;
      align-items: center;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      overflow: hidden;
      background: white;
    }

    .slug-prefix {
      padding: 0 0.75rem;
      font-size: 0.875rem;
      color: #9ca3af;
      background: #f9fafb;
      border-right: 1px solid #d1d5db;
      height: 100%;
      display: flex;
      align-items: center;
      white-space: nowrap;
    }

    .slug-input {
      border: none !important;
      border-radius: 0 !important;
      flex: 1;
    }

    .field-error { font-size: 0.78rem; color: #ef4444; }
    .field-hint  { font-size: 0.78rem; color: #6b7280; }
    .field-success { font-size: 0.78rem; color: #10b981; }

    .tag-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; }

    .tag-btn {
      padding: 0.35rem 0.85rem;
      border: 1px solid #d1d5db;
      border-radius: 20px;
      font-size: 0.8rem;
      cursor: pointer;
      background: white;
      color: #374151;
      transition: all 0.15s;
    }

    .tag-btn.active {
      background: #fff5f9;
      border-color: #FF3C97;
      color: #FF3C97;
      font-weight: 600;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.875rem;
      color: #374151;
      cursor: pointer;
    }

    .checkbox-label input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: #FF3C97;
    }

    .upload-area {
      border: 2px dashed #d1d5db;
      border-radius: 10px;
      padding: 1.5rem;
      text-align: center;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
      min-height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .upload-area:hover { border-color: #FF3C97; background: #fff5f9; }
    .upload-area.has-file { border-style: solid; border-color: #10b981; }

    .banner-area { min-height: 140px; }

    .upload-placeholder { display: flex; flex-direction: column; gap: 0.35rem; align-items: center; color: #6b7280; }
    .upload-icon { font-size: 2rem; }
    .upload-hint { font-size: 0.75rem; color: #9ca3af; }

    .preview-image { max-height: 100px; border-radius: 6px; object-fit: cover; }
    .banner-preview { max-height: 130px; width: 100%; }

    .hidden-input { display: none; }

    .step-actions {
      display: flex;
      justify-content: space-between;
      margin-top: 1rem;
    }

    .btn-primary {
      padding: 0.75rem 2rem;
      background: #FF3C97;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-primary:hover:not(:disabled) { background: #e6007a; }
    .btn-primary:disabled { background: #d1d5db; cursor: not-allowed; }

    .btn-secondary {
      padding: 0.75rem 1.5rem;
      background: white;
      color: #374151;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-secondary:hover { background: #f9fafb; }

    @media (max-width: 640px) {
      .form-row { grid-template-columns: 1fr; }
    }
  `],
})
export class RegisterStepInfoComponent implements OnInit {
  private readonly registerService = inject(RegisterService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly categories = signal<StoreCategory[]>([]);
  readonly logoPreview = signal<string | null>(null);
  readonly bannerPreview = signal<string | null>(null);
  readonly logoUploading = signal(false);
  readonly bannerUploading = signal(false);

  readonly commerceType = computed(() => this.registerService.registrationData().commerce_type);
  readonly sdSectors = SD_SECTORS;
  readonly cuisineTypes = CUISINE_TYPES;
  selectedCuisines: string[] = [];

  readonly cities = ['Santo Domingo', 'Santiago', 'La Romana', 'San Pedro de Macorís', 'Puerto Plata', 'La Vega', 'San Cristóbal', 'Higüey', 'Baní', 'Moca'];

  readonly form = this.fb.group({
    name: ['', Validators.required],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)], [this.slugValidator()]],
    description: [''],
    whatsapp_number: ['', [Validators.required, Validators.pattern(RD_PHONE_PATTERN)]],
    address: ['', Validators.required],
    sector: [''],
    city: ['', Validators.required],
    category_id: [''],
    sespas_number: [''],
    farmacia_24h: [false],
  });

  get f() { return this.form.controls; }

  ngOnInit(): void {
    const draft = this.registerService.registrationData();

    // Guard: if no commerce type was selected, go back
    if (!draft.commerce_type) {
      this.router.navigate(['/register']);
      return;
    }

    this.selectedCuisines = [...(draft.cuisine_types ?? [])];

    this.form.patchValue({
      name: draft.name,
      slug: draft.slug,
      description: draft.description,
      whatsapp_number: draft.whatsapp_number,
      address: draft.address,
      sector: draft.sector,
      city: draft.city,
      category_id: draft.category_id ?? '',
      sespas_number: draft.sespas_number ?? '',
      farmacia_24h: draft.farmacia_24h ?? false,
    });

    if (draft.logo_url) this.logoPreview.set(draft.logo_url);
    if (draft.banner_url) this.bannerPreview.set(draft.banner_url);

    // Auto-generate slug from name
    this.form.controls['name'].valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged(),
    ).subscribe(name => {
      if (name && !this.form.controls['slug'].dirty) {
        this.form.controls['slug'].setValue(slugify(name), { emitEvent: true });
        this.form.controls['slug'].markAsTouched();
      }
    });

    this.loadCategories(draft.commerce_type);
  }

  private slugValidator(): AsyncValidatorFn {
    return (control: AbstractControl) => {
      const slug = control.value as string;
      if (!slug) return of(null);

      const draftSlug = this.registerService.registrationData().slug;
      if (slug === draftSlug) return of(null); // same as saved — still available

      return of(slug).pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap(s => this.registerService.checkSlugAvailable(s)),
        map(available => (available ? null : { slugTaken: true })),
        catchError(() => of(null)),
      );
    };
  }

  private async loadCategories(commerceType: string): Promise<void> {
    const data = await this.registerService.getStoreCategories(commerceType);
    this.categories.set(data);
  }

  async onLogoChange(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.logoUploading.set(true);
    try {
      const path = `logos/${Date.now()}-${file.name}`;
      const url = await this.registerService.uploadFile(file, 'restaurant-assets', path);
      this.logoPreview.set(url);
      this.registerService.update({ logo_url: url });
    } catch {
      // File upload failed silently; user can retry
    } finally {
      this.logoUploading.set(false);
    }
  }

  async onBannerChange(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.bannerUploading.set(true);
    try {
      const path = `banners/${Date.now()}-${file.name}`;
      const url = await this.registerService.uploadFile(file, 'restaurant-assets', path);
      this.bannerPreview.set(url);
      this.registerService.update({ banner_url: url });
    } catch {
      // File upload failed silently; user can retry
    } finally {
      this.bannerUploading.set(false);
    }
  }

  isCuisineSelected(c: string): boolean { return this.selectedCuisines.includes(c); }

  getCategoryIcon(slug: string): string {
    const icons: Record<string, string> = {
      dominicana: '🍽️', pizza: '🍕', pollo: '🍗', rapida: '🍔', mariscos: '🦞',
      sushi: '🍣', hamburguesas: '🍔', postres: '🍰', bebidas: '🥤', saludable: '🥗',
      farmacia: '💊', bodega: '📦', colmado: '🛒', tienda_ropa: '👗',
      supermercado: '🛒', electronica: '📱', otro: '🏪',
    };
    return icons[slug] ?? '🏪';
  }

  toggleCuisine(c: string): void {
    if (this.isCuisineSelected(c)) {
      this.selectedCuisines = this.selectedCuisines.filter(x => x !== c);
    } else {
      this.selectedCuisines = [...this.selectedCuisines, c];
    }
  }

  next(): void {
    if (this.form.invalid) return;
    const v = this.form.value;
    this.registerService.update({
      name: v.name ?? '',
      slug: v.slug ?? '',
      description: v.description ?? '',
      whatsapp_number: v.whatsapp_number ?? '',
      address: v.address ?? '',
      sector: v.sector ?? '',
      city: v.city ?? '',
      category_id: v.category_id || null,
      cuisine_types: this.selectedCuisines,
      sespas_number: v.sespas_number || undefined,
      farmacia_24h: v.farmacia_24h ?? false,
    });
    this.router.navigate(['/register/details']);
  }

  back(): void {
    this.router.navigate(['/register']);
  }
}
