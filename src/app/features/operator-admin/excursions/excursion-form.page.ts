import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { OperatorAdminService } from '../operator-admin.service';
import { ExcursionService, ExcursionFormData } from './excursion.service';
import { Excursion } from '../../../core/supabase/database.types';
import { AppConfigService } from '../../../core/config/app-config.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';

const DEFAULT_INCLUDES = ['Guía certificado', 'Seguro de actividad', 'Transporte', 'Almuerzo', 'Equipo'];
const DEFAULT_EXCLUDES = ['Bebidas alcohólicas', 'Propinas', 'Gastos personales'];

function blankForm(): ExcursionFormData & { category: string | null; what_to_bring: string; includes: string[]; excludes: string[] } {
    return {
        name: '', short_description: '', description: '',
        category: null, difficulty_level: null,
        duration_hours: 8, language: 'Español',
        price_per_person: 0, min_people: 2, max_people: 20,
        meeting_point: null, meeting_point_lat: null, meeting_point_lng: null,
        min_hours_advance: 24, cancellation_hours: 48,
        includes: ['Guía certificado'], excludes: [],
        what_to_bring: '',
        photos: [], is_active: true,
    };
}

@Component({
    selector: 'app-excursion-form',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
  <div class="form-page">

    <!-- Sticky header -->
    <div class="form-topbar">
      <button class="back-btn" (click)="goBack()">← Volver</button>
      <h1 class="form-title">{{ isEdit() ? 'Editar excursión' : 'Nueva excursión' }}</h1>
      <div class="form-actions">
        <button class="btn-draft" (click)="save(false)" [disabled]="saving()">Guardar borrador</button>
        <button class="btn-publish" (click)="save(true)" [disabled]="saving()">
          {{ saving() ? 'Guardando…' : (isEdit() ? '💾 Guardar cambios' : '🚀 Publicar') }}
        </button>
      </div>
    </div>

    @if (errorMsg()) {
      <div class="error-banner">{{ errorMsg() }}</div>
    }

    @if (loading()) {
      <div style="text-align:center;padding:3rem;color:#9ca3af">Cargando…</div>
    } @else {

    <div class="form-layout">

      <!-- ── SECCIÓN 1: Información básica ────────────────────────────────── -->
      <section class="form-section">
        <h2 class="section-heading">1. Información básica</h2>

        <div class="form-group">
          <label class="label">Nombre de la excursión * <span class="char-count">{{ form.name.length }}/100</span></label>
          <input [(ngModel)]="form.name" class="input-field" maxlength="100" placeholder="Ej. Snorkel en Bahía de las Águilas" />
        </div>

        <div class="form-group">
          <label class="label">Descripción corta * <span class="char-count">{{ form.short_description.length }}/150</span></label>
          <textarea [(ngModel)]="form.short_description" class="input-field" rows="2" maxlength="150"
            placeholder="Una frase atractiva que aparecerá en la card de la excursión…" style="resize:none"></textarea>
        </div>

        <div class="form-group">
          <label class="label">Descripción completa</label>
          <textarea [(ngModel)]="form.description" class="input-field" rows="5"
            placeholder="Describe la experiencia en detalle: itinerario, qué verán, historia del lugar…"></textarea>
        </div>

        <div class="form-group">
          <label class="label">Categoría</label>
          <div class="category-grid">
            @for (cat of categories(); track cat.key) {
              <button type="button" class="cat-btn" (click)="form.category = cat.key"
                [class.cat-btn--active]="form.category === cat.key">
                {{ cat.icon }} {{ cat.label }}
              </button>
            }
          </div>
        </div>

        <div class="form-group">
          <label class="label">Nivel de dificultad</label>
          <div class="diff-grid">
            @for (d of diffOptions(); track d.key) {
              <button type="button" class="diff-btn" (click)="form.difficulty_level = d.key"
                [class.diff-btn--active]="form.difficulty_level === d.key">
                <span class="diff-icon">{{ d.icon }}</span>
                <span class="diff-label">{{ d.label }}</span>
              </button>
            }
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="label">Duración: <strong>{{ form.duration_hours }}h</strong></label>
            <input type="range" [(ngModel)]="form.duration_hours" min="1" max="72" step="1" class="slider" />
            <div class="slider-labels"><span>1h</span><span>72h</span></div>
          </div>
          <div class="form-group" style="flex:0 0 120px">
            <label class="label">Horas</label>
            <input type="number" [(ngModel)]="form.duration_hours" min="1" max="72" class="input-field" />
          </div>
        </div>

        <div class="form-group">
          <label class="label">Idioma</label>
          <select [(ngModel)]="form.language" class="input-field">
            @for (lang of languages(); track lang) {
              <option [value]="lang">{{ lang }}</option>
            }
          </select>
        </div>
      </section>

      <!-- ── SECCIÓN 2: Precios y capacidad ───────────────────────────────── -->
      <section class="form-section">
        <h2 class="section-heading">2. Precios y capacidad</h2>

        <div class="form-row">
          <div class="form-group">
            <label class="label">Precio por persona (RD$) *</label>
            <input type="number" [(ngModel)]="form.price_per_person" min="0" class="input-field" placeholder="0" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="label">Mínimo de personas *</label>
            <input type="number" [(ngModel)]="form.min_people" min="1" class="input-field" />
          </div>
          <div class="form-group">
            <label class="label">Máximo de personas *</label>
            <input type="number" [(ngModel)]="form.max_people" min="1" class="input-field" />
          </div>
        </div>
        @if (form.max_people !== null && form.min_people > form.max_people) {
          <p class="field-error">El mínimo no puede ser mayor que el máximo</p>
        }
      </section>

      <!-- ── SECCIÓN 3: Punto de encuentro ────────────────────────────────── -->
      <section class="form-section">
        <h2 class="section-heading">3. Punto de encuentro</h2>

        <div class="form-group">
          <label class="label">Descripción del punto *</label>
          <input [(ngModel)]="form.meeting_point" class="input-field" placeholder="Ej. Parque Central de La Romana, frente al kiosco azul" />
        </div>

        <div class="map-hint">🗺️ Coordenadas opcionales — los clientes las recibirán al confirmar reserva.</div>

        <div class="form-row">
          <div class="form-group">
            <label class="label">Latitud</label>
            <input type="number" [(ngModel)]="form.meeting_point_lat" step="any" class="input-field" placeholder="18.4861" />
          </div>
          <div class="form-group">
            <label class="label">Longitud</label>
            <input type="number" [(ngModel)]="form.meeting_point_lng" step="any" class="input-field" placeholder="-69.9312" />
          </div>
        </div>

        @if (form.meeting_point_lat && form.meeting_point_lng) {
          <a class="map-preview-link"
            [href]="'https://www.openstreetmap.org/?mlat=' + form.meeting_point_lat + '&mlon=' + form.meeting_point_lng + '#map=15/' + form.meeting_point_lat + '/' + form.meeting_point_lng"
            target="_blank">
            📍 Ver en mapa →
          </a>
        }
      </section>

      <!-- ── SECCIÓN 4: Políticas ──────────────────────────────────────────── -->
      <section class="form-section">
        <h2 class="section-heading">4. Políticas</h2>

        <div class="form-group">
          <label class="label">Anticipo mínimo: <strong>{{ form.min_hours_advance }}h antes</strong></label>
          <input type="range" [(ngModel)]="form.min_hours_advance" min="4" max="168" step="4" class="slider" />
          <p class="policy-preview">📌 Los clientes podrán reservar hasta <strong>{{ form.min_hours_advance }}h</strong> antes de la salida.</p>
        </div>

        <div class="form-group">
          <label class="label">Cancelación gratuita hasta: <strong>{{ form.cancellation_hours }}h antes</strong></label>
          <input type="range" [(ngModel)]="form.cancellation_hours" min="4" max="168" step="4" class="slider" />
          <p class="policy-preview">✅ Cancelaciones gratuitas hasta <strong>{{ form.cancellation_hours }}h</strong> antes. Después puede aplicar penalización.</p>
        </div>

        <div class="form-group">
          <label class="label">¿Qué incluye?</label>
          <div class="chip-row">
            @for (item of form.includes; track item) {
              <span class="chip chip--green">{{ item }} <button type="button" class="chip-remove" (click)="removeInclude(item)">×</button></span>
            }
            <input class="chip-input" placeholder="Agregar…" #includeInput
              (keydown.enter)="addChip('includes', includeInput.value); includeInput.value = ''"
              (keydown.comma)="addChip('includes', includeInput.value); includeInput.value = ''" />
          </div>
          <div class="chip-suggestions">
            @for (s of defaultIncludes; track s) {
              @if (!form.includes.includes(s)) {
                <button type="button" class="suggestion-chip" (click)="addChip('includes', s)">+ {{ s }}</button>
              }
            }
          </div>
        </div>

        <div class="form-group">
          <label class="label">¿Qué NO incluye?</label>
          <div class="chip-row">
            @for (item of form.excludes; track item) {
              <span class="chip chip--red">{{ item }} <button type="button" class="chip-remove" (click)="removeExclude(item)">×</button></span>
            }
            <input class="chip-input" placeholder="Agregar…" #excludeInput
              (keydown.enter)="addChip('excludes', excludeInput.value); excludeInput.value = ''"
              (keydown.comma)="addChip('excludes', excludeInput.value); excludeInput.value = ''" />
          </div>
          <div class="chip-suggestions">
            @for (s of defaultExcludes; track s) {
              @if (!form.excludes.includes(s)) {
                <button type="button" class="suggestion-chip" (click)="addChip('excludes', s)">+ {{ s }}</button>
              }
            }
          </div>
        </div>

        <div class="form-group">
          <label class="label">¿Qué llevar?</label>
          <textarea [(ngModel)]="form.what_to_bring" class="input-field" rows="3"
            placeholder="Ropa cómoda, zapatos cerrados, bloqueador solar, repelente…"></textarea>
        </div>
      </section>

      <!-- ── SECCIÓN 5: Fotos ──────────────────────────────────────────────── -->
      <section class="form-section">
        <h2 class="section-heading">5. Fotos <span class="section-sub">(máx. 10 — la primera es la foto principal)</span></h2>

        <div class="photos-grid">
          @for (url of photoPreviews(); track url; let i = $index) {
            <div class="photo-thumb" [class.photo-thumb--first]="i === 0">
              <img [src]="url" [alt]="'Foto ' + (i+1)" />
              @if (i === 0) { <span class="primary-badge">Principal</span> }
              <div class="photo-controls">
                @if (i > 0) { <button type="button" class="ctrl-btn" (click)="movePhoto(i, -1)" title="Mover arriba">↑</button> }
                @if (i < photoPreviews().length - 1) { <button type="button" class="ctrl-btn" (click)="movePhoto(i, 1)" title="Mover abajo">↓</button> }
                <button type="button" class="ctrl-btn ctrl-btn--remove" (click)="removePhoto(i)" title="Eliminar">×</button>
              </div>
            </div>
          }
          @if (photoPreviews().length < 10) {
            <div class="photo-add" (click)="photoInput.click()">
              <span>📷</span>
              <span style="font-size:.75rem;color:#9ca3af">Agregar foto</span>
            </div>
          }
        </div>
        <input #photoInput type="file" accept="image/*" multiple style="display:none" (change)="onPhotosSelected($event)" />
        @if (uploadingPhotos()) {
          <p style="font-size:.8rem;color:#6b7280;margin-top:.5rem">📤 Subiendo fotos…</p>
        }
      </section>

      <!-- ── SECCIÓN 6: Estado ─────────────────────────────────────────────── -->
      <section class="form-section">
        <h2 class="section-heading">6. Estado</h2>

        <label class="toggle-row">
          <div class="toggle-wrap">
            <input type="checkbox" [(ngModel)]="form.is_active" style="display:none" />
            <button type="button" class="big-toggle" [class.active]="form.is_active" (click)="form.is_active = !form.is_active">
              <span class="big-toggle-thumb"></span>
            </button>
          </div>
          <div>
            <p class="toggle-label-main">{{ form.is_active ? '✅ Publicar esta excursión' : '📝 Guardar como borrador' }}</p>
            <p class="toggle-label-sub">{{ form.is_active ? 'Será visible para los clientes.' : 'No será visible para los clientes hasta que la actives.' }}</p>
          </div>
        </label>
      </section>

    </div>
    } <!-- end !loading -->
  </div>
  `,
    styles: [`
    .form-page { max-width:780px; margin:0 auto; }
    .form-topbar { display:flex; align-items:center; gap:1rem; margin-bottom:1.5rem; flex-wrap:wrap; }
    .back-btn { background:none; border:none; color:#6b7280; cursor:pointer; font-size:.875rem; padding:0; }
    .back-btn:hover { color:#111827; }
    .form-title { font-size:1.25rem; font-weight:700; color:#111827; margin:0; flex:1; }
    .form-actions { display:flex; gap:.5rem; margin-left:auto; }
    .btn-draft { background:white; border:1px solid #e5e7eb; border-radius:10px; padding:.5rem 1rem; font-size:.875rem; cursor:pointer; color:#374151; }
    .btn-publish { background:#e91e8c; color:white; border:none; border-radius:10px; padding:.5rem 1.25rem; font-size:.875rem; font-weight:600; cursor:pointer; }
    .btn-publish:disabled, .btn-draft:disabled { opacity:.5; cursor:not-allowed; }

    .form-layout { display:flex; flex-direction:column; gap:1rem; }
    .form-section { background:white; border:1px solid #e5e7eb; border-radius:16px; padding:1.5rem; }
    .section-heading { font-size:.9rem; font-weight:700; color:#111827; margin:0 0 1.25rem; }
    .section-sub { font-size:.75rem; font-weight:400; color:#9ca3af; }

    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }
    @media(max-width:560px){ .form-row { grid-template-columns:1fr; } }
    .char-count { font-weight:400; color:#9ca3af; float:right; }

    .category-grid { display:flex; gap:.5rem; flex-wrap:wrap; }
    .cat-btn { border:2px solid #e5e7eb; border-radius:10px; padding:.5rem .9rem; font-size:.8rem; font-weight:600; cursor:pointer; background:white; color:#374151; transition:all .12s; }
    .cat-btn--active { border-color:#e91e8c; background:#fdf2f8; color:#e91e8c; }

    .diff-grid { display:flex; gap:.5rem; flex-wrap:wrap; }
    .diff-btn { flex:1; min-width:130px; border:2px solid #e5e7eb; border-radius:12px; padding:.65rem .85rem; cursor:pointer; background:white; text-align:left; transition:all .12s; }
    .diff-label { display:block; font-size:.8rem; font-weight:700; margin-bottom:2px; }
    .diff-desc { display:block; font-size:.7rem; color:#6b7280; line-height:1.3; }

    .slider { width:100%; accent-color:#e91e8c; margin:.35rem 0; }
    .slider-labels { display:flex; justify-content:space-between; font-size:.7rem; color:#9ca3af; }

    .map-hint { background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:.6rem .85rem; font-size:.8rem; color:#0369a1; margin-bottom:.75rem; }
    .map-preview-link { display:inline-block; font-size:.8rem; color:#e91e8c; text-decoration:none; margin-top:.25rem; }
    .map-preview-link:hover { text-decoration:underline; }

    .policy-preview { background:#f9fafb; border-radius:8px; padding:.5rem .75rem; font-size:.78rem; color:#374151; margin-top:.35rem; margin-bottom:0; }

    .chip-row { display:flex; flex-wrap:wrap; gap:.35rem; background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:.5rem; min-height:42px; align-items:center; }
    .chip { display:inline-flex; align-items:center; gap:.25rem; border-radius:999px; padding:2px 10px; font-size:.75rem; font-weight:600; }
    .chip--green { background:#d1fae5; color:#065f46; }
    .chip--red { background:#fee2e2; color:#991b1b; }
    .chip-remove { background:none; border:none; cursor:pointer; font-size:.9rem; line-height:1; padding:0; color:inherit; opacity:.6; }
    .chip-remove:hover { opacity:1; }
    .chip-input { border:none; outline:none; background:transparent; font-size:.8rem; flex:1; min-width:80px; }
    .chip-suggestions { display:flex; gap:.35rem; flex-wrap:wrap; margin-top:.35rem; }
    .suggestion-chip { background:none; border:1px dashed #d1d5db; border-radius:999px; padding:2px 10px; font-size:.72rem; color:#6b7280; cursor:pointer; transition:all .12s; }
    .suggestion-chip:hover { border-color:#e91e8c; color:#e91e8c; }

    .photos-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:.5rem; }
    @media(max-width:640px){ .photos-grid { grid-template-columns:repeat(3,1fr); } }
    .photo-thumb { position:relative; aspect-ratio:4/3; border-radius:10px; overflow:hidden; border:2px solid #e5e7eb; }
    .photo-thumb--first { border-color:#e91e8c; }
    .photo-thumb img { width:100%; height:100%; object-fit:cover; }
    .primary-badge { position:absolute; bottom:0; left:0; right:0; background:rgba(233,30,140,.85); color:white; font-size:.6rem; font-weight:700; text-align:center; padding:2px; }
    .photo-controls { position:absolute; top:2px; right:2px; display:flex; flex-direction:column; gap:2px; opacity:0; transition:opacity .15s; }
    .photo-thumb:hover .photo-controls { opacity:1; }
    .ctrl-btn { background:rgba(0,0,0,.5); color:white; border:none; border-radius:4px; padding:2px 5px; font-size:.7rem; cursor:pointer; }
    .ctrl-btn--remove { background:rgba(239,68,68,.7); }
    .photo-add { aspect-ratio:4/3; border:2px dashed #e5e7eb; border-radius:10px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.35rem; cursor:pointer; font-size:1.5rem; background:#f9fafb; transition:border-color .15s; }
    .photo-add:hover { border-color:#e91e8c; }

    .toggle-row { display:flex; align-items:center; gap:1rem; cursor:pointer; }
    .toggle-wrap { flex-shrink:0; }
    .big-toggle { width:52px; height:28px; border-radius:999px; border:none; background:#d1d5db; cursor:pointer; position:relative; transition:background .2s; }
    .big-toggle.active { background:#e91e8c; }
    .big-toggle-thumb { position:absolute; top:3px; left:3px; width:22px; height:22px; background:white; border-radius:50%; transition:transform .2s; box-shadow:0 1px 3px rgba(0,0,0,.2); }
    .big-toggle.active .big-toggle-thumb { transform:translateX(24px); }
    .toggle-label-main { font-size:.9rem; font-weight:600; color:#111827; margin:0; }
    .toggle-label-sub { font-size:.775rem; color:#6b7280; margin:.15rem 0 0; }
  `],
})
export class ExcursionFormPageComponent implements OnInit {
    private readonly operatorSvc = inject(OperatorAdminService);
    private readonly excSvc = inject(ExcursionService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly toast = inject(ToastService);
    readonly configSvc = inject(AppConfigService);

    readonly categories = this.configSvc.categories;
    readonly diffOptions = this.configSvc.difficulties;
    readonly languages = this.configSvc.languages;
    readonly defaultIncludes = DEFAULT_INCLUDES;
    readonly defaultExcludes = DEFAULT_EXCLUDES;

    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly uploadingPhotos = signal(false);
    readonly errorMsg = signal<string | null>(null);
    readonly photoPreviews = signal<string[]>([]);

    readonly isEdit = signal(false);
    private editId: string | null = null;
    private pendingPhotoFiles: File[] = [];

    form = blankForm();

    catLabel(cat: string) {
        return this.configSvc.categories().find(c => c.key === cat)?.label ?? cat;
    }

    ngOnInit() {
        this.configSvc.load();
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.isEdit.set(true);
            this.editId = id;
            this.loadExcursion(id);
        }
    }

    async loadExcursion(id: string) {
        this.loading.set(true);
        try {
            const exc = await this.excSvc.getExcursion(id);
            if (exc) {
                this.form = {
                    name: exc.name,
                    short_description: exc.short_description ?? '',
                    description: exc.description ?? '',
                    category: (exc as unknown as Record<string, unknown>)['category'] as string | null ?? null,
                    difficulty_level: exc.difficulty_level ?? null,
                    duration_hours: exc.duration_hours ?? 8,
                    language: exc.language,
                    price_per_person: exc.price_per_person,
                    min_people: exc.min_people,
                    max_people: exc.max_people ?? 20,
                    meeting_point: exc.meeting_point ?? null,
                    meeting_point_lat: exc.meeting_point_lat ?? null,
                    meeting_point_lng: exc.meeting_point_lng ?? null,
                    min_hours_advance: exc.min_hours_advance,
                    cancellation_hours: exc.cancellation_hours,
                    includes: [],
                    excludes: [],
                    what_to_bring: '',
                    photos: exc.photos ?? [],
                    is_active: exc.is_active,
                };
                this.photoPreviews.set(exc.photos ?? []);
            }
        } finally {
            this.loading.set(false);
        }
    }

    goBack() { this.router.navigate(['/operator/excursions']); }

    onPhotosSelected(event: Event) {
        const files = Array.from((event.target as HTMLInputElement).files ?? []);
        const remaining = 10 - this.photoPreviews().length;
        const batch = files.slice(0, remaining);
        for (const f of batch) {
            this.pendingPhotoFiles.push(f);
            this.photoPreviews.update(p => [...p, URL.createObjectURL(f)]);
        }
    }

    movePhoto(i: number, dir: -1 | 1) {
        const arr = [...this.photoPreviews()];
        const files = [...this.pendingPhotoFiles];
        const j = i + dir;
        [arr[i], arr[j]] = [arr[j], arr[i]];
        // only swap file refs for pending files (new uploads)
        this.photoPreviews.set(arr);
    }

    removePhoto(i: number) {
        this.photoPreviews.update(p => p.filter((_, idx) => idx !== i));
        this.pendingPhotoFiles = this.pendingPhotoFiles.filter((_, idx) => idx !== i);
    }

    addChip(field: 'includes' | 'excludes', value: string) {
        const v = value.trim().replace(/,+$/, '');
        if (!v || this.form[field].includes(v)) return;
        this.form[field] = [...this.form[field], v];
    }
    removeInclude(item: string) { this.form.includes = this.form.includes.filter(x => x !== item); }
    removeExclude(item: string) { this.form.excludes = this.form.excludes.filter(x => x !== item); }

    async save(publish: boolean) {
        if (!this.form.name.trim()) { this.errorMsg.set('El nombre es requerido.'); return; }
        if (!this.form.short_description.trim()) { this.errorMsg.set('La descripción corta es requerida.'); return; }
        if (this.form.price_per_person <= 0) { this.errorMsg.set('El precio debe ser mayor a 0.'); return; }
        if (this.form.min_people > (this.form.max_people ?? 9999)) { this.errorMsg.set('El mínimo no puede superar el máximo.'); return; }

        this.errorMsg.set(null);
        this.saving.set(true);
        try {
            const opId = this.operatorSvc.activeOperatorId()!;
            this.form.is_active = publish;

            let excursionId = this.editId;

            if (!excursionId) {
                // Create first to get the ID, then upload photos
                excursionId = await this.excSvc.createExcursion(opId, { ...this.form, photos: [] });
            }

            // Upload any new photo files
            if (this.pendingPhotoFiles.length > 0) {
                this.uploadingPhotos.set(true);
                const uploadedUrls: string[] = [];
                for (let i = 0; i < this.pendingPhotoFiles.length; i++) {
                    const url = await this.excSvc.uploadPhoto(opId, excursionId, this.pendingPhotoFiles[i], i);
                    uploadedUrls.push(url);
                }
                // Merge: existing remote URLs + newly uploaded
                const remotePhotos = this.photoPreviews().filter(u => u.startsWith('http'));
                this.form.photos = [...remotePhotos, ...uploadedUrls];
                this.uploadingPhotos.set(false);
            }

            await this.excSvc.updateExcursion(excursionId, this.form);
            this.router.navigate(['/operator/excursions']);
        } catch (e: unknown) {
            this.toast.error((e as Error).message ?? 'Error al guardar la excursión.');
            this.uploadingPhotos.set(false);
        } finally {
            this.saving.set(false);
        }
    }
}
