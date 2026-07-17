import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { OperatorRegisterService } from '../operator-register.service';
import { AppConfigService } from '../../../core/config/app-config.service';
import { buildStorageObjectKey } from '../../../shared/utils/storage-key.utils';

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

@Component({
  selector: 'app-operator-step1',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    .step-container { max-width:680px; margin:0 auto; }
    .step-header { margin-bottom:2rem; }
    .step-header h1 { font-size:1.5rem; font-weight:700; color:#111827; margin:0 0 0.5rem; }
    .step-header p { color:#6b7280; font-size:0.9rem; margin:0; }
    .card-section { background:white; border-radius:16px; border:1px solid #e5e7eb; padding:1.5rem; margin-bottom:1.25rem; }
    .section-title { font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#6b7280; margin-bottom:1rem; }
    .form-group { margin-bottom:1rem; }
    .label { display:block; font-size:0.8rem; font-weight:600; color:#374151; margin-bottom:4px; }
    .input-field { width:100%; border:1px solid #e5e7eb; border-radius:10px; padding:0.6rem 0.85rem; font-size:0.9rem; outline:none; transition:border-color .15s; box-sizing:border-box; }
    .input-field:focus { border-color:#e91e8c; box-shadow:0 0 0 3px rgba(233,30,140,.08); }    .slug-preview { font-size:0.75rem; color:#6b7280; margin-top:4px; }
    .slug-preview code { background:#f3f4f6; border-radius:4px; padding:0 4px; font-size:0.75rem; }
    .category-grid { display:flex; gap:0.5rem; flex-wrap:wrap; }
    .cat-btn { display:flex; flex-direction:column; align-items:center; gap:4px; padding:10px 14px; border:2px solid #e5e7eb; border-radius:12px; cursor:pointer; font-size:0.78rem; font-weight:600; color:#6b7280; background:white; transition:all .15s; }
    .cat-btn:hover { border-color:#e91e8c; color:#e91e8c; }
    .cat-btn.selected { border-color:#e91e8c; color:#e91e8c; background:#fff0f7; }
    .cat-icon { font-size:1.4rem; }
    .lang-chips { display:flex; flex-wrap:wrap; gap:0.5rem; }
    .lang-chip { padding:5px 12px; border:2px solid #e5e7eb; border-radius:20px; font-size:0.78rem; font-weight:600; cursor:pointer; color:#6b7280; background:white; transition:all .15s; }
    .lang-chip.on { border-color:#e91e8c; color:#e91e8c; background:#fff0f7; }
    .toggle-row { display:flex; align-items:center; justify-content:space-between; padding:8px 0; }
    .toggle-label { font-size:0.875rem; font-weight:500; color:#374151; }
    .toggle-track { position:relative; display:inline-flex; width:44px; height:24px; border-radius:12px; background:#d1d5db; cursor:pointer; transition:background .3s; flex-shrink:0; }
    .toggle-track.on { background:#e91e8c; }
    .toggle-thumb { position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:white; transition:transform .3s; }
    .toggle-track.on .toggle-thumb { transform:translateX(20px); }
    .img-upload { position:relative; cursor:pointer; border-radius:12px; overflow:hidden; background:#f9fafb; border:2px dashed #e5e7eb; display:flex; align-items:center; justify-content:center; transition:border-color .15s; }
    .img-upload:hover { border-color:#e91e8c; }
    .img-upload img { width:100%; height:100%; object-fit:cover; }
    .img-placeholder { display:flex; flex-direction:column; align-items:center; gap:4px; color:#9ca3af; font-size:0.75rem; }
    .step-actions { display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem; }
  `],
  template: `
  <div class="step-container">
    <div class="step-header">
      <h1>Cuéntanos sobre tu empresa de excursiones</h1>
      <p>Completa tu perfil para que los viajeros puedan encontrarte en Tutty Tours.</p>
    </div>

    @if (error()) {
      <div class="error-banner">{{ error() }}</div>
    }

    <!-- Imágenes -->
    <div class="card-section">
      <p class="section-title">Imágenes</p>
      <div style="display:flex; gap:1rem; flex-wrap:wrap">
        <div>
          <p class="label">Logo (1:1)</p>
          <div class="img-upload" style="width:88px; height:88px; border-radius:50%" (click)="logoInput.click()">
            @if (logoPreview()) {
              <img [src]="logoPreview()!" alt="Logo" />
            } @else {
              <div class="img-placeholder">🏢<span>Logo</span></div>
            }
          </div>
          <input #logoInput type="file" accept="image/*" style="display:none" (change)="onLogoSelected($event)" />
        </div>
        <div style="flex:1; min-width:200px">
          <p class="label">Banner (16:9)</p>
          <div class="img-upload" style="height:88px" (click)="bannerInput.click()">
            @if (bannerPreview()) {
              <img [src]="bannerPreview()!" alt="Banner" />
            } @else {
              <div class="img-placeholder">🌄<span>Banner del operador</span></div>
            }
          </div>
          <input #bannerInput type="file" accept="image/*" style="display:none" (change)="onBannerSelected($event)" />
        </div>
      </div>
    </div>

    <!-- Información básica -->
    <div class="card-section">
      <p class="section-title">Información básica</p>
      <div class="form-group">
        <label class="label">Nombre del operador/empresa *</label>
        <input [(ngModel)]="form.name" (ngModelChange)="onNameChange($event)"
          class="input-field" maxlength="100" placeholder="Ej. Quisqueya Adventures" />
        @if (submitted() && !form.name.trim()) { <span class="field-error">El nombre es requerido</span> }
      </div>
      <div class="form-group">
        <label class="label">Slug (URL pública)</label>
        <input [(ngModel)]="form.slug" class="input-field" maxlength="60" placeholder="quisqueya-adventures"
          (ngModelChange)="slugEdited = true; checkSlug()" />
        <p class="slug-preview">tutty.do/excursiones/<code>{{ form.slug || '...' }}</code>
          @if (slugChecking()) { <span> · verificando…</span> }
          @else if (slugOk() === false) { <span style="color:#ef4444"> · ya existe</span> }
          @else if (slugOk() === true && form.slug) { <span style="color:#10b981"> · disponible ✓</span> }
        </p>
      </div>
      <div class="form-group">
        <label class="label">Descripción *</label>
        <textarea [(ngModel)]="form.description" class="input-field" rows="3" maxlength="600"
          placeholder="Describe tu operadora, especialidades y lo que te hace único…" style="resize:vertical"></textarea>
        <p class="slug-preview" style="text-align:right">{{ form.description.length }}/600</p>
        @if (submitted() && !form.description.trim()) { <span class="field-error">La descripción es requerida</span> }
      </div>
      <div class="form-group">
        <label class="label">WhatsApp de contacto *</label>
        <input [(ngModel)]="form.whatsapp_number" class="input-field" placeholder="+1809XXXXXXX" />
        @if (submitted() && !form.whatsapp_number.trim()) { <span class="field-error">El WhatsApp es requerido</span> }
      </div>
      <div class="form-group">
        <label class="label">Dirección de oficina (opcional)</label>
        <input [(ngModel)]="form.address" class="input-field" placeholder="Calle, local, sector..." />
      </div>
    </div>

    <!-- Categoría principal -->
    <div class="card-section">
      <p class="section-title">Categoría principal</p>
      <div class="category-grid">
        @for (cat of categories(); track cat.key) {
          <button type="button" class="cat-btn" [class.selected]="form.category === cat.key"
            (click)="form.category = cat.key">
            <span class="cat-icon">{{ cat.icon }}</span>
            {{ cat.label }}
          </button>
        }
      </div>
    </div>

    <!-- Años de experiencia & credenciales -->
    <div class="card-section">
      <p class="section-title">Experiencia y credenciales</p>
      <div class="form-group">
        <label class="label">Años de experiencia</label>
        <select [(ngModel)]="form.years_experience" class="input-field">
          <option value="">Seleccionar...</option>
          @for (o of experienceOptions(); track o.key) {
            <option [value]="o.key">{{ o.label }}</option>
          }
        </select>
      </div>
      <div class="toggle-row">
        <span class="toggle-label">¿Tienes seguro de viajero?</span>
        <div class="toggle-track" [class.on]="form.has_insurance" (click)="form.has_insurance = !form.has_insurance">
          <div class="toggle-thumb"></div>
        </div>
      </div>
      <div style="border-top:1px solid #f3f4f6; margin:8px 0; padding-top:8px">
        <div class="toggle-row">
          <span class="toggle-label">¿Tienes licencia del Ministerio de Turismo?</span>
          <div class="toggle-track" [class.on]="form.has_tourism_license"
            (click)="form.has_tourism_license = !form.has_tourism_license">
            <div class="toggle-thumb"></div>
          </div>
        </div>
        @if (form.has_tourism_license) {
          <div class="form-group" style="margin-top:8px; padding-left:4px">
            <label class="label">Número de licencia</label>
            <input [(ngModel)]="form.tourism_license_number" class="input-field"
              placeholder="Ej. MT-2024-12345" style="max-width:300px" />
          </div>
        }
      </div>
    </div>

    <!-- Idiomas -->
    <div class="card-section">
      <p class="section-title">Idiomas en que operas</p>
      <div class="lang-chips">
        @for (lang of allLanguages(); track lang) {
          <button type="button" class="lang-chip" [class.on]="form.languages.includes(lang)"
            (click)="toggleLanguage(lang)">{{ lang }}</button>
        }
      </div>
    </div>

    <div class="step-actions">
      <button class="btn-primary" (click)="next()" [disabled]="saving()">
        {{ saving() ? 'Guardando...' : 'Continuar →' }}
      </button>
    </div>
  </div>
  `,
})
export class OperatorStep1Component implements OnInit {
  private readonly svc = inject(OperatorRegisterService);
  private readonly router = inject(Router);
  readonly configSvc = inject(AppConfigService);

  readonly categories = this.configSvc.categories;
  readonly allLanguages = this.configSvc.languages;
  readonly experienceOptions = this.configSvc.experienceOptions;

  readonly submitted = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly slugChecking = signal(false);
  readonly slugOk = signal<boolean | null>(null);

  readonly logoPreview = signal<string | null>(null);
  readonly bannerPreview = signal<string | null>(null);
  private logoFile: File | null = null;
  private bannerFile: File | null = null;
  slugEdited = false;
  private slugTimer: ReturnType<typeof setTimeout> | null = null;

  form = { ...this.svc.draft() };

  ngOnInit() {
    this.configSvc.load();
    const d = this.svc.draft();
    this.form = { ...d };
    this.logoPreview.set(d.logo_url);
    this.bannerPreview.set(d.banner_url);
  }

  onNameChange(name: string) {
    if (!this.slugEdited) {
      this.form.slug = toSlug(name);
      this.checkSlug();
    }
  }

  checkSlug() {
    if (this.slugTimer) clearTimeout(this.slugTimer);
    if (!this.form.slug) { this.slugOk.set(null); return; }
    this.slugChecking.set(true);
    this.slugTimer = setTimeout(async () => {
      try {
        const ok = await this.svc.checkSlugAvailable(this.form.slug);
        this.slugOk.set(ok);
      } finally { this.slugChecking.set(false); }
    }, 400);
  }

  toggleLanguage(lang: string) {
    const list = [...this.form.languages];
    const idx = list.indexOf(lang);
    if (idx >= 0) { if (list.length > 1) list.splice(idx, 1); }
    else list.push(lang);
    this.form.languages = list;
  }

  onLogoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.logoFile = file;
    this.logoPreview.set(URL.createObjectURL(file));
  }

  onBannerSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.bannerFile = file;
    this.bannerPreview.set(URL.createObjectURL(file));
  }

  async next() {
    this.submitted.set(true);
    if (!this.form.name.trim() || !this.form.description.trim() || !this.form.whatsapp_number.trim()) return;
    if (!this.form.slug || this.slugOk() === false) { this.error.set('El slug no es válido o ya está en uso.'); return; }

    this.saving.set(true);
    this.error.set('');
    try {
      let logo_url = this.form.logo_url;
      let banner_url = this.form.banner_url;
      const tempSlug = this.form.slug;

      if (this.logoFile) {
        logo_url = await this.svc.uploadFile(this.logoFile, buildStorageObjectKey(`operators/${tempSlug}/logo`, this.logoFile));
      }
      if (this.bannerFile) {
        banner_url = await this.svc.uploadFile(this.bannerFile, buildStorageObjectKey(`operators/${tempSlug}/banner`, this.bannerFile));
      }
      this.svc.update({ ...this.form, logo_url, banner_url });
      this.router.navigate(['/register/operator/tours']);
    } catch (e: unknown) {
      this.error.set((e as Error).message ?? 'Error al guardar. Intenta de nuevo.');
    } finally {
      this.saving.set(false);
    }
  }
}
