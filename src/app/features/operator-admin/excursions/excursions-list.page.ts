import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { OperatorAdminService } from '../operator-admin.service';
import { ExcursionService, ExcursionWithMeta } from './excursion.service';

const DIFF_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    facil: { label: 'Fácil', color: '#065f46', bg: '#d1fae5' },
    moderado: { label: 'Moderado', color: '#92400e', bg: '#fef3c7' },
    dificil: { label: 'Difícil', color: '#991b1b', bg: '#fee2e2' },
};

@Component({
    selector: 'app-excursions-list',
    standalone: true,
    imports: [CommonModule, RouterLink],
    template: `
  <div class="page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">🧭 Mis Excursiones</h1>
        <p class="page-sub">{{ excursions().length }} excursión{{ excursions().length !== 1 ? 'es' : '' }}</p>
      </div>
      <a [routerLink]="['/operator/excursions/new']" class="btn-primary">+ Nueva excursión</a>
    </div>

    @if (error()) {
      <div class="error-banner">{{ error() }}</div>
    }

    @if (loading()) {
      <div class="grid">
        @for (i of [1,2,3,4,5,6]; track i) {
          <div class="skeleton-card"></div>
        }
      </div>
    } @else if (excursions().length === 0) {
      <div class="empty-state">
        <p style="font-size:3rem;margin:0">🏝️</p>
        <p style="margin:.75rem 0 .5rem;font-size:1.1rem;font-weight:600;color:#111827">Aún no tienes excursiones</p>
        <p style="color:#6b7280;font-size:.875rem;margin:0 0 1.5rem">Crea tu primera excursión para empezar a recibir reservas.</p>
        <a [routerLink]="['/operator/excursions/new']" class="btn-primary">Crear primera excursión</a>
      </div>
    } @else {
      <div class="grid">
        @for (exc of excursions(); track exc.id) {
          <div class="card">
            <!-- Photo -->
            <div class="card-photo" (click)="router.navigate(['/operator/excursions', exc.id])">
              @if (exc.photos && exc.photos.length > 0) {
                <img [src]="exc.photos[0]" [alt]="exc.name" loading="lazy" class="photo-img" />
              } @else {
                <div class="photo-placeholder">🏝️</div>
              }
              <!-- Difficulty badge -->
              @if (exc.difficulty_level && diff(exc.difficulty_level)) {
                <span class="diff-badge"
                  [style.color]="diff(exc.difficulty_level)!.color"
                  [style.background]="diff(exc.difficulty_level)!.bg">
                  {{ diff(exc.difficulty_level)!.label }}
                </span>
              }
              <!-- Active toggle -->
              <div class="active-toggle" (click)="$event.stopPropagation()">
                <button class="toggle-btn" [class.active]="exc.is_active" (click)="toggleActive(exc)" title="{{ exc.is_active ? 'Publicada' : 'Borrador' }}">
                  <span class="toggle-thumb"></span>
                </button>
                <span class="toggle-label">{{ exc.is_active ? 'Activa' : 'Borrador' }}</span>
              </div>
            </div>

            <!-- Body -->
            <div class="card-body">
              <p class="exc-name" (click)="router.navigate(['/operator/excursions', exc.id])">{{ exc.name }}</p>
              <p class="exc-short">{{ exc.short_description }}</p>

              <div class="exc-meta">
                <span class="meta-chip">⏱ {{ exc.duration_hours }}h</span>
                <span class="meta-chip">👥 {{ exc.min_people }}–{{ exc.max_people ?? '∞' }}</span>
                <span class="price-chip">RD$ {{ exc.price_per_person | number }}</span>
              </div>

              <!-- Next date -->
              @if (exc.nextDate) {
                <div class="next-date">
                  <span class="next-date-label">📅 Próxima:</span>
                  <span>{{ fmtDate(exc.nextDate.date) }}</span>
                  <span class="spots-pill" [class.spots-low]="exc.nextDate.spots_left <= 3" [class.spots-full]="exc.nextDate.spots_left === 0">
                    {{ exc.nextDate.spots_left === 0 ? 'Llena' : exc.nextDate.spots_left + ' cupos' }}
                  </span>
                </div>
              } @else {
                <div class="next-date no-dates">📅 Sin fechas programadas</div>
              }

              <!-- Actions -->
              <div class="card-actions">
                <a [routerLink]="['/operator/excursions', exc.id, 'edit']" class="action-btn" title="Editar">✏️ Editar</a>
                <a [routerLink]="['/operator/excursions', exc.id, 'dates']" class="action-btn" title="Fechas">📅 Fechas</a>
                <a [routerLink]="['/operator/bookings']" [queryParams]="{excursion: exc.id}" class="action-btn" title="Reservas">📋</a>
                <button class="action-btn action-btn--danger" (click)="confirmDelete(exc)" title="Eliminar">🗑️</button>
              </div>
            </div>
          </div>
        }
      </div>
    }

    <!-- Delete confirm modal -->
    @if (deleteTarget()) {
      <div class="modal-overlay" (click)="deleteTarget.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3 style="margin:0 0 .75rem;font-size:1rem;font-weight:700">¿Eliminar excursión?</h3>
          <p style="color:#6b7280;font-size:.875rem;margin:0 0 1.25rem">
            "<strong>{{ deleteTarget()!.name }}</strong>" será eliminada permanentemente junto con todas sus fechas.
          </p>
          <div style="display:flex;gap:.5rem;justify-content:flex-end">
            <button class="btn-secondary" (click)="deleteTarget.set(null)">Cancelar</button>
            <button class="btn-danger" (click)="deleteExcursion()" [disabled]="deleting()">
              {{ deleting() ? 'Eliminando…' : '🗑️ Eliminar' }}
            </button>
          </div>
        </div>
      </div>
    }
  </div>
  `,
    styles: [`
    .page { max-width:1100px; margin:0 auto; }
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:1.5rem; gap:1rem; }
    .page-title { font-size:1.5rem; font-weight:700; color:#111827; margin:0; }
    .page-sub { color:#9ca3af; font-size:.8rem; margin:.2rem 0 0; }
    .btn-primary { text-decoration:none; white-space:nowrap; }

    .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1.25rem; }
    @media(max-width:900px){ .grid { grid-template-columns:repeat(2,1fr); } }
    @media(max-width:560px){ .grid { grid-template-columns:1fr; } }

    .skeleton-card { height:340px; background:#f3f4f6; border-radius:16px; animation:shimmer 1.2s ease-in-out infinite alternate; }
    @keyframes shimmer { from{opacity:.6} to{opacity:1} }

    .empty-state { background:white; border:1px solid #e5e7eb; border-radius:16px; padding:3rem 2rem; text-align:center; }

    .card { background:white; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden; display:flex; flex-direction:column; transition:box-shadow .15s; }
    .card:hover { box-shadow:0 4px 20px rgba(0,0,0,.08); }

    .card-photo { position:relative; height:170px; cursor:pointer; background:#f3f4f6; overflow:hidden; }
    .photo-img { width:100%; height:100%; object-fit:cover; transition:transform .2s; }
    .card-photo:hover .photo-img { transform:scale(1.03); }
    .photo-placeholder { display:flex; align-items:center; justify-content:center; height:100%; font-size:3rem; }

    .diff-badge { position:absolute; top:8px; left:8px; font-size:.68rem; font-weight:700; border-radius:999px; padding:2px 8px; }
    .active-toggle { position:absolute; top:8px; right:8px; display:flex; align-items:center; gap:.35rem; background:rgba(255,255,255,.9); border-radius:999px; padding:3px 8px 3px 4px; }
    .toggle-btn { width:32px; height:18px; border-radius:999px; border:none; cursor:pointer; position:relative; transition:background .2s; background:#d1d5db; }
    .toggle-btn.active { background:#e91e8c; }
    .toggle-thumb { position:absolute; top:2px; left:2px; width:14px; height:14px; border-radius:50%; background:white; transition:transform .2s; }
    .toggle-btn.active .toggle-thumb { transform:translateX(14px); }
    .toggle-label { font-size:.68rem; font-weight:600; color:#374151; }

    .card-body { padding:.9rem 1rem 1rem; flex:1; display:flex; flex-direction:column; gap:.5rem; }
    .exc-name { font-size:.9rem; font-weight:700; color:#111827; margin:0; cursor:pointer; }
    .exc-name:hover { color:#e91e8c; }
    .exc-short { font-size:.775rem; color:#6b7280; margin:0; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }

    .exc-meta { display:flex; gap:.4rem; flex-wrap:wrap; margin-top:.1rem; }
    .meta-chip { background:#f3f4f6; border-radius:999px; padding:2px 8px; font-size:.72rem; color:#4b5563; font-weight:500; }
    .price-chip { background:#fdf2f8; color:#e91e8c; border-radius:999px; padding:2px 8px; font-size:.72rem; font-weight:700; margin-left:auto; }

    .next-date { display:flex; align-items:center; gap:.4rem; font-size:.75rem; color:#374151; flex-wrap:wrap; margin-top:.15rem; }
    .next-date-label { color:#9ca3af; }
    .no-dates { color:#9ca3af; }
    .spots-pill { background:#f0fdf4; color:#166534; border-radius:999px; padding:1px 7px; font-size:.68rem; font-weight:600; }
    .spots-pill.spots-low { background:#fef3c7; color:#92400e; }
    .spots-pill.spots-full { background:#fee2e2; color:#991b1b; }

    .card-actions { display:flex; gap:.35rem; margin-top:auto; padding-top:.5rem; }
    .action-btn { background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:.3rem .6rem; font-size:.75rem; cursor:pointer; text-decoration:none; color:#374151; transition:background .12s; white-space:nowrap; }
    .action-btn:hover { background:#f3f4f6; }
    .action-btn--danger:hover { background:#fee2e2; border-color:#fca5a5; color:#991b1b; }

    /* Modal size override */
    .modal { max-width:400px; }
  `],
})
export class ExcursionsListPageComponent implements OnInit {
    private readonly operatorSvc = inject(OperatorAdminService);
    private readonly excSvc = inject(ExcursionService);
    readonly router = inject(Router);

    readonly excursions = signal<ExcursionWithMeta[]>([]);
    readonly loading = signal(true);
    readonly error = signal<string | null>(null);
    readonly deleteTarget = signal<ExcursionWithMeta | null>(null);
    readonly deleting = signal(false);

    diff(level: string) { return DIFF_LABELS[level] ?? null; }

    fmtDate(d: string): string {
        return new Date(d + 'T00:00:00').toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' });
    }

    ngOnInit() { this.load(); }

    async load() {
        this.loading.set(true);
        this.error.set(null);
        const opId = this.operatorSvc.activeOperatorId();
        if (!opId) { this.loading.set(false); return; }
        try {
            const list = await this.excSvc.listOperatorExcursions(opId);
            this.excursions.set(list);
        } catch (e: unknown) {
            this.error.set((e as Error).message ?? 'Error al cargar excursiones');
        } finally {
            this.loading.set(false);
        }
    }

    async toggleActive(exc: ExcursionWithMeta) {
        const newVal = !exc.is_active;
        this.excursions.update(list => list.map(e => e.id === exc.id ? { ...e, is_active: newVal } : e));
        await this.excSvc.toggleActive(exc.id, newVal);
    }

    confirmDelete(exc: ExcursionWithMeta) { this.deleteTarget.set(exc); }

    async deleteExcursion() {
        const target = this.deleteTarget();
        if (!target) return;
        this.deleting.set(true);
        try {
            await this.excSvc.deleteExcursion(target.id);
            this.excursions.update(list => list.filter(e => e.id !== target.id));
            this.deleteTarget.set(null);
        } finally {
            this.deleting.set(false);
        }
    }
}
