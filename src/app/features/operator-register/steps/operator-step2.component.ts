import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { OperatorRegisterService } from '../operator-register.service';
import { ExcursionDifficulty } from '../../../core/supabase/database.types';
import { buildStorageObjectKey } from '../../../shared/utils/storage-key.utils';

const DIFFICULTIES: { key: ExcursionDifficulty; label: string; color: string }[] = [
  { key: 'facil', label: 'Fácil', color: '#10b981' },
  { key: 'moderado', label: 'Moderado', color: '#f59e0b' },
  { key: 'dificil', label: 'Difícil', color: '#ef4444' },
];

@Component({
  selector: 'app-operator-step2',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    .step-container { max-width:680px; margin:0 auto; }
    .step-header { margin-bottom:1.5rem; }
    .step-header h1 { font-size:1.5rem; font-weight:700; color:#111827; margin:0 0 0.5rem; }
    .step-header p { color:#6b7280; font-size:0.9rem; margin:0; }
    .card-section { background:white; border-radius:16px; border:1px solid #e5e7eb; padding:1.5rem; margin-bottom:1.25rem; }
    .section-title { font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#6b7280; margin-bottom:1rem; }
    .form-group { margin-bottom:1rem; }
    .label { display:block; font-size:0.8rem; font-weight:600; color:#374151; margin-bottom:4px; }
    .diff-grid { display:flex; gap:0.5rem; }
    .diff-btn { flex:1; padding:8px; border:2px solid #e5e7eb; border-radius:10px; font-size:0.8rem; font-weight:600; cursor:pointer; background:white; transition:all .15s; text-align:center; }
    .skip-banner { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:14px; padding:1.25rem; text-align:center; }
    .skip-banner p { color:#166534; font-size:0.875rem; margin:0 0 1rem; }
    .step-actions { display:flex; justify-content:space-between; gap:0.75rem; margin-top:1.5rem; }
    .photo-grid { display:flex; gap:0.75rem; flex-wrap:wrap; }
    .photo-thumb { width:90px; height:70px; border-radius:10px; overflow:hidden; position:relative; }
    .photo-thumb img { width:100%; height:100%; object-fit:cover; }
    .photo-add { width:90px; height:70px; border:2px dashed #e5e7eb; border-radius:10px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:1.4rem; color:#9ca3af; background:#f9fafb; }
    .photo-add:hover { border-color:#e91e8c; color:#e91e8c; }
    .remove-photo { position:absolute; top:3px; right:3px; width:18px; height:18px; background:rgba(0,0,0,.5); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; cursor:pointer; border:none; }
    .field-error { font-size:0.75rem; color:#ef4444; margin-top:2px; display:block; }
    .slider { width:100%; accent-color:#e91e8c; }
  `],
  template: `
  <div class="step-container">
    <div class="step-header">
      <h1>Agrega tu primera excursión</h1>
      <p>Opcional pero recomendado. Tu tour estará en revisión hasta ser aprobado.</p>
    </div>

    <div class="skip-banner">
      <p>Puedes añadir excursiones después desde tu panel de operador.</p>
      <button class="btn-outline" (click)="skip()">Omitir por ahora →</button>
    </div>

    <div style="margin:1.25rem 0; text-align:center; color:#9ca3af; font-size:0.875rem">— o agrega una ahora —</div>

    <!-- Tour info -->
    <div class="card-section">
      <p class="section-title">Información del tour</p>
      <div class="form-group">
        <label class="label">Nombre del tour *</label>
        <input [(ngModel)]="tour.name" class="input-field" placeholder="Ej. Snorkel en Bahía de las Águilas" />
        @if (submitted() && !tour.name.trim()) { <span class="field-error">El nombre es requerido</span> }
      </div>
      <div class="form-group">
        <label class="label">Descripción corta * (máx. 150 caracteres)</label>
        <textarea [(ngModel)]="tour.short_description" class="input-field" rows="2" maxlength="150"
          placeholder="Una frase atractiva que describa la experiencia…" style="resize:none"></textarea>
        <p style="font-size:0.75rem; color:#6b7280; text-align:right; margin-top:2px">{{ tour.short_description.length }}/150</p>
        @if (submitted() && !tour.short_description.trim()) { <span class="field-error">La descripción es requerida</span> }
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem">
        <div class="form-group">
          <label class="label">Precio por persona (RD$) *</label>
          <input type="number" [(ngModel)]="tour.price" class="input-field" min="0" step="100" />
          @if (submitted() && tour.price <= 0) { <span class="field-error">Precio inválido</span> }
        </div>
        <div class="form-group">
          <label class="label">Punto de encuentro *</label>
          <input [(ngModel)]="tour.meeting_point" class="input-field" placeholder="Ej. Parque Central" />
          @if (submitted() && !tour.meeting_point.trim()) { <span class="field-error">Requerido</span> }
        </div>
      </div>
    </div>

    <!-- Duración y dificultad -->
    <div class="card-section">
      <p class="section-title">Duración y dificultad</p>
      <div class="form-group">
        <label class="label">Duración: <strong>{{ tour.duration_hours }} hora{{ tour.duration_hours !== 1 ? 's' : '' }}</strong></label>
        <input type="range" [(ngModel)]="tour.duration_hours" min="1" max="72" step="1" class="slider" />
        <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:#9ca3af">
          <span>1 hora</span><span>72 horas</span>
        </div>
      </div>
      <div class="form-group">
        <label class="label">Nivel de dificultad</label>
        <div class="diff-grid">
          @for (d of difficulties; track d.key) {
            <button type="button" class="diff-btn"
              [style.border-color]="tour.difficulty === d.key ? d.color : '#e5e7eb'"
              [style.color]="tour.difficulty === d.key ? d.color : '#6b7280'"
              [style.background]="tour.difficulty === d.key ? (d.color + '15') : 'white'"
              (click)="tour.difficulty = d.key">{{ d.label }}</button>
          }
        </div>
      </div>
    </div>

    <!-- Capacidad -->
    <div class="card-section">
      <p class="section-title">Capacidad del grupo</p>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem">
        <div class="form-group">
          <label class="label">Mínimo de personas</label>
          <input type="number" [(ngModel)]="tour.min_people" class="input-field" min="1" />
        </div>
        <div class="form-group">
          <label class="label">Máximo de personas</label>
          <input type="number" [(ngModel)]="tour.max_people" class="input-field" min="1" />
        </div>
      </div>
    </div>

    <!-- Fotos -->
    <div class="card-section">
      <p class="section-title">Fotos del tour (máx. 3)</p>
      <div class="photo-grid">
        @for (url of photoPreviews(); track url; let i = $index) {
          <div class="photo-thumb">
            <img [src]="url" alt="Foto {{ i+1 }}" />
            <button class="remove-photo" (click)="removePhoto(i)">✕</button>
          </div>
        }
        @if (photoPreviews().length < 3) {
          <div class="photo-add" (click)="photoInput.click()">+</div>
        }
      </div>
      <input #photoInput type="file" accept="image/*" style="display:none" (change)="onPhotoSelected($event)" />
    </div>

    <div class="step-actions">
      <button class="btn-secondary" (click)="back()">← Atrás</button>
      <button class="btn-primary" (click)="next()" [disabled]="saving()">
        {{ saving() ? 'Guardando...' : 'Continuar →' }}
      </button>
    </div>
  </div>
  `,
})
export class OperatorStep2Component {
  private readonly svc = inject(OperatorRegisterService);
  private readonly router = inject(Router);

  readonly difficulties = DIFFICULTIES;
  readonly submitted = signal(false);
  readonly saving = signal(false);
  readonly photoPreviews = signal<string[]>([]);
  private photoFiles: File[] = [];

  tour = {
    name: this.svc.draft().tour_name,
    short_description: this.svc.draft().tour_short_description,
    price: this.svc.draft().tour_price || 0,
    duration_hours: this.svc.draft().tour_duration_hours || 4,
    difficulty: this.svc.draft().tour_difficulty as ExcursionDifficulty | null,
    meeting_point: this.svc.draft().tour_meeting_point,
    min_people: this.svc.draft().tour_min_people || 1,
    max_people: this.svc.draft().tour_max_people || 20,
  };

  skip() {
    this.svc.update({ tour_enabled: false });
    this.router.navigate(['/register/operator/account']);
  }

  back() { this.router.navigate(['/register/operator']); }

  onPhotoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || this.photoFiles.length >= 3) return;
    this.photoFiles.push(file);
    this.photoPreviews.update(p => [...p, URL.createObjectURL(file)]);
  }

  removePhoto(i: number) {
    this.photoFiles.splice(i, 1);
    this.photoPreviews.update(p => p.filter((_, idx) => idx !== i));
  }

  async next() {
    this.submitted.set(true);
    if (!this.tour.name.trim() || !this.tour.short_description.trim() || this.tour.price <= 0 || !this.tour.meeting_point.trim()) return;

    this.saving.set(true);
    try {
      const uploadedPhotos: string[] = [];
      for (let i = 0; i < this.photoFiles.length; i++) {
        const f = this.photoFiles[i];
        const path = buildStorageObjectKey(`operators/${this.svc.draft().slug}/tours`, f);
        const url = await this.svc.uploadFile(f, path);
        uploadedPhotos.push(url);
      }
      this.svc.update({
        tour_enabled: true,
        tour_name: this.tour.name,
        tour_short_description: this.tour.short_description,
        tour_price: this.tour.price,
        tour_duration_hours: this.tour.duration_hours,
        tour_difficulty: this.tour.difficulty,
        tour_meeting_point: this.tour.meeting_point,
        tour_min_people: this.tour.min_people,
        tour_max_people: this.tour.max_people,
        tour_photos: uploadedPhotos,
      });
      this.router.navigate(['/register/operator/account']);
    } finally {
      this.saving.set(false);
    }
  }
}
