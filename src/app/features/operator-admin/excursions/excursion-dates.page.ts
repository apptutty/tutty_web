import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ExcursionService, ExcursionDateRow } from './excursion.service';
import { Excursion } from '../../../core/supabase/database.types';
import { ConfirmService } from '../../../shared/ui/modal/confirm.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';

const WEEKDAYS = [
    { i: 1, short: 'LUN' }, { i: 2, short: 'MAR' }, { i: 3, short: 'MIÉ' },
    { i: 4, short: 'JUE' }, { i: 5, short: 'VIE' }, { i: 6, short: 'SÁB' }, { i: 0, short: 'DOM' },
];

function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' });
}
function fmtTime(t: string) {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h, 10);
    return `${hour % 12 || 12}:${m}${hour >= 12 ? 'pm' : 'am'}`;
}

type Modal = 'none' | 'single' | 'recurrence' | 'editSpots';

@Component({
    selector: 'app-excursion-dates',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
  <div class="page">
    <div class="page-header">
      <button class="back-btn" (click)="router.navigate(['/operator/excursions'])">← Excursiones</button>
      <div>
        <h1 class="page-title">📅 Fechas</h1>
        @if (excursion()) { <p class="page-sub">{{ excursion()!.name }}</p> }
      </div>
      <div class="add-dropdown" #dropdownRef>
        <button class="btn-primary" (click)="showDropdown = !showDropdown">+ Nueva fecha ▾</button>
        @if (showDropdown) {
          <div class="dropdown-menu">
            <button (click)="openModal('single'); showDropdown=false">📅 Agregar una fecha</button>
            <button (click)="openModal('recurrence'); showDropdown=false">🔁 Fechas recurrentes</button>
          </div>
        }
      </div>
    </div>

    @if (error()) { <div class="error-banner">{{ error() }}</div> }

    <div class="layout">

      <!-- ── LEFT: Lista de fechas ──────────────────────────────────────── -->
      <div class="left-panel">
        @if (loading()) {
          @for (i of [1,2,3]; track i) { <div class="skeleton-row"></div> }
        } @else if (dates().length === 0) {
          <div class="empty-state">
            <p style="font-size:2rem;margin:0">📅</p>
            <p style="margin:.5rem 0 0;color:#6b7280">No hay fechas programadas.</p>
          </div>
        } @else {
          @for (d of filteredDates(); track d.id) {
            <div class="date-row" [class.selected]="selectedDateId() === d.id" (click)="selectedDateId.set(d.id)">
              <div class="date-info">
                <p class="date-main">📅 {{ fmtDate(d.date) }}  🕐 {{ fmtTime(d.departure_time) }}</p>
                <p class="date-spots">👥 {{ d.confirmedPeople ?? 0 }}/{{ d.total_spots }} cupos confirmados</p>
                <div class="spots-bar">
                  <div class="spots-fill" [style.width.%]="spotsPercent(d)"
                    [class.fill-low]="spotsPercent(d) > 75"
                    [class.fill-full]="d.spots_left === 0"></div>
                </div>
                <p class="spots-label">
                  @if (d.spots_left === 0) {
                    <span class="tag-full">LLENA</span>
                  } @else {
                    <span [class.text-low]="d.spots_left <= 3">{{ d.spots_left }} cupo{{ d.spots_left !== 1 ? 's' : '' }} disponible{{ d.spots_left !== 1 ? 's' : '' }}</span>
                  }
                </p>
              </div>
              <div class="date-actions">
                <button class="action-btn" (click)="$event.stopPropagation(); openEditSpots(d)" title="Editar cupos">✏️</button>
                <button class="action-btn action-btn--danger" (click)="$event.stopPropagation(); cancelDate(d.id)" title="Cancelar fecha">🗑️</button>
              </div>
            </div>
          }
        }
      </div>

      <!-- ── RIGHT: Calendario ─────────────────────────────────────────── -->
      <div class="right-panel">
        <div class="calendar">
          <div class="cal-header">
            <button class="cal-nav" (click)="prevMonth()">‹</button>
            <span class="cal-month-label">{{ monthLabel() }}</span>
            <button class="cal-nav" (click)="nextMonth()">›</button>
          </div>
          <div class="cal-weekdays">
            @for (wd of weekdayLabels; track wd) {
              <span>{{ wd }}</span>
            }
          </div>
          <div class="cal-grid">
            @for (cell of calendarCells(); track cell.key) {
              <div class="cal-cell" [class.other-month]="!cell.inMonth" [class.today]="cell.isToday"
                [class.selected]="cell.dateStr === selectedCalDate()"
                [class.has-dates]="cell.hasDates"
                (click)="cell.inMonth && cell.hasDates && selectCalDate(cell.dateStr)">
                <span class="cal-day">{{ cell.day }}</span>
                @if (cell.dot) {
                  <span class="cal-dot" [class]="'dot-' + cell.dot"></span>
                }
              </div>
            }
          </div>
        </div>
      </div>
    </div>

    <!-- ── MODAL: Single date ─────────────────────────────────────────────── -->
    @if (activeModal() === 'single') {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3 class="modal-title">📅 Nueva fecha</h3>
          <div class="form-group">
            <label class="label">Fecha *</label>
            <input type="date" [(ngModel)]="singleForm.date" [min]="today" class="input-field" />
          </div>
          <div class="form-group">
            <label class="label">Hora de salida *</label>
            <input type="time" [(ngModel)]="singleForm.time" class="input-field" />
          </div>
          <div class="form-group">
            <label class="label">Cupos disponibles *</label>
            <input type="number" [(ngModel)]="singleForm.spots" min="1" class="input-field" />
          </div>
          @if (modalError()) { <p class="field-error">{{ modalError() }}</p> }
          <div class="modal-actions">
            <button class="btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn-primary" (click)="saveSingle()" [disabled]="saving()">{{ saving() ? 'Guardando…' : 'Guardar' }}</button>
          </div>
        </div>
      </div>
    }

    <!-- ── MODAL: Recurrence ──────────────────────────────────────────────── -->
    @if (activeModal() === 'recurrence') {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal modal--wide" (click)="$event.stopPropagation()">
          <h3 class="modal-title">🔁 Fechas recurrentes</h3>

          <div class="form-group">
            <label class="label">Días de la semana</label>
            <div class="weekday-grid">
              @for (wd of weekdays; track wd.i) {
                <button type="button" class="wd-btn" [class.wd-btn--active]="recForm.weekdays.includes(wd.i)"
                  (click)="toggleWeekday(wd.i)">{{ wd.short }}</button>
              }
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="label">Fecha inicio</label>
              <input type="date" [(ngModel)]="recForm.from" [min]="today" class="input-field" />
            </div>
            <div class="form-group">
              <label class="label">Fecha fin</label>
              <input type="date" [(ngModel)]="recForm.to" [min]="recForm.from || today" class="input-field" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="label">Hora de salida</label>
              <input type="time" [(ngModel)]="recForm.time" class="input-field" />
            </div>
            <div class="form-group">
              <label class="label">Cupos por fecha</label>
              <input type="number" [(ngModel)]="recForm.spots" min="1" class="input-field" />
            </div>
          </div>

          @if (recurrencePreview() > 0) {
            <div class="rec-preview">
              ✅ Se crearán <strong>{{ recurrencePreview() }}</strong> fecha{{ recurrencePreview() !== 1 ? 's' : '' }}
              {{ recForm.weekdays.length > 0 ? 'los ' + selectedWeekdayNames() : '' }}
              entre {{ recForm.from }} y {{ recForm.to }}
            </div>
          }
          @if (modalError()) { <p class="field-error">{{ modalError() }}</p> }
          <div class="modal-actions">
            <button class="btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn-primary" (click)="saveRecurrence()" [disabled]="saving() || recurrencePreview() === 0">
              {{ saving() ? 'Creando…' : 'Crear ' + recurrencePreview() + ' fecha' + (recurrencePreview() !== 1 ? 's' : '') }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── MODAL: Edit spots ──────────────────────────────────────────────── -->
    @if (activeModal() === 'editSpots' && editSpotsTarget()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3 class="modal-title">✏️ Editar cupos — {{ fmtDate(editSpotsTarget()!.date) }}</h3>
          <p class="modal-sub">Reservas confirmadas: <strong>{{ editSpotsTarget()!.confirmedPeople ?? 0 }}</strong> personas</p>
          <div class="form-group">
            <label class="label">Nuevo total de cupos</label>
            <input type="number" [(ngModel)]="editSpotsValue" [min]="editSpotsTarget()!.confirmedPeople ?? 0" class="input-field" />
            <p class="modal-hint">Mínimo {{ editSpotsTarget()!.confirmedPeople ?? 0 }} (no puede bajar de reservas confirmadas)</p>
          </div>
          @if (modalError()) { <p class="field-error">{{ modalError() }}</p> }
          <div class="modal-actions">
            <button class="btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn-primary" (click)="saveEditSpots()" [disabled]="saving()">{{ saving() ? 'Guardando…' : 'Guardar cupos' }}</button>
          </div>
        </div>
      </div>
    }
  </div>
  `,
    styles: [`
    .page { max-width:1100px; margin:0 auto; }
    .page-header { display:flex; align-items:flex-start; gap:1rem; margin-bottom:1.5rem; flex-wrap:wrap; }
    .back-btn { background:none; border:none; color:#6b7280; cursor:pointer; font-size:.875rem; padding:0; white-space:nowrap; }
    .page-title { font-size:1.5rem; font-weight:700; color:#111827; margin:0; }
    .page-sub { color:#9ca3af; font-size:.8rem; margin:.2rem 0 0; }
    .btn-primary { position:relative; }

    .add-dropdown { position:relative; margin-left:auto; }
    .dropdown-menu { position:absolute; top:calc(100% + 6px); right:0; background:white; border:1px solid #e5e7eb; border-radius:12px; padding:.4rem; min-width:200px; box-shadow:0 8px 24px rgba(0,0,0,.1); z-index:20; }
    .dropdown-menu button { display:block; width:100%; text-align:left; background:none; border:none; padding:.6rem .85rem; border-radius:8px; font-size:.875rem; cursor:pointer; color:#374151; }
    .dropdown-menu button:hover { background:#f9fafb; }

    .layout { display:grid; grid-template-columns:2fr 3fr; gap:1.25rem; }
    @media(max-width:900px){ .layout { grid-template-columns:1fr; } }

    .left-panel { display:flex; flex-direction:column; gap:.5rem; }
    .skeleton-row { height:90px; background:#f3f4f6; border-radius:12px; animation:shimmer 1.2s ease-in-out infinite alternate; }
    @keyframes shimmer { from{opacity:.6} to{opacity:1} }
    .empty-state { background:white; border:1px solid #e5e7eb; border-radius:16px; padding:2rem; text-align:center; }

    .date-row { background:white; border:1px solid #e5e7eb; border-radius:12px; padding:.85rem 1rem; display:flex; align-items:flex-start; gap:.75rem; cursor:pointer; transition:border-color .12s; }
    .date-row.selected { border-color:#e91e8c; background:#fdf2f8; }
    .date-row:hover:not(.selected) { border-color:#d1d5db; }
    .date-info { flex:1; min-width:0; }
    .date-main { font-size:.875rem; font-weight:600; color:#111827; margin:0; }
    .date-spots { font-size:.775rem; color:#6b7280; margin:.2rem 0 .35rem; }
    .spots-bar { height:5px; background:#e5e7eb; border-radius:999px; overflow:hidden; }
    .spots-fill { height:100%; background:#10b981; border-radius:999px; transition:width .3s; }
    .spots-fill.fill-low { background:#f59e0b; }
    .spots-fill.fill-full { background:#ef4444; }
    .spots-label { font-size:.72rem; color:#6b7280; margin:.25rem 0 0; }
    .text-low { color:#f59e0b; font-weight:600; }
    .tag-full { background:#fee2e2; color:#991b1b; font-size:.7rem; font-weight:700; border-radius:4px; padding:1px 6px; }
    .date-actions { display:flex; flex-direction:column; gap:.3rem; flex-shrink:0; }
    .action-btn { background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:.3rem .55rem; font-size:.8rem; cursor:pointer; }
    .action-btn--danger:hover { background:#fee2e2; border-color:#fca5a5; }

    /* Calendar */
    .right-panel { }
    .calendar { background:white; border:1px solid #e5e7eb; border-radius:16px; padding:1.25rem; }
    .cal-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:.85rem; }
    .cal-month-label { font-size:.9rem; font-weight:700; color:#111827; text-transform:capitalize; }
    .cal-nav { background:none; border:1px solid #e5e7eb; border-radius:8px; padding:.25rem .7rem; cursor:pointer; font-size:1rem; color:#374151; }
    .cal-nav:hover { background:#f9fafb; }
    .cal-weekdays { display:grid; grid-template-columns:repeat(7,1fr); text-align:center; font-size:.68rem; color:#9ca3af; font-weight:600; text-transform:uppercase; margin-bottom:.35rem; }
    .cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
    .cal-cell { aspect-ratio:1; display:flex; flex-direction:column; align-items:center; justify-content:center; border-radius:8px; cursor:default; gap:2px; }
    .cal-cell.has-dates { cursor:pointer; }
    .cal-cell.has-dates:hover { background:#f9fafb; }
    .cal-cell.other-month .cal-day { color:#d1d5db; }
    .cal-cell.today .cal-day { background:#e91e8c; color:white; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; font-weight:700; }
    .cal-cell.selected { background:#fdf2f8; }
    .cal-day { font-size:.8rem; color:#374151; }
    .cal-dot { width:6px; height:6px; border-radius:50%; }
    .dot-ok { background:#10b981; }
    .dot-low { background:#f59e0b; }
    .dot-full { background:#ef4444; }

    /* Modal variants */
    .modal--wide { max-width:560px; }
    .modal-sub { font-size:.8rem; color:#6b7280; margin:-0.5rem 0 1rem; }
    .modal-hint { font-size:.72rem; color:#9ca3af; margin:.25rem 0 0; }

    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }

    .weekday-grid { display:flex; gap:.35rem; flex-wrap:wrap; }
    .wd-btn { border:2px solid #e5e7eb; border-radius:8px; padding:.35rem .7rem; font-size:.75rem; font-weight:700; cursor:pointer; background:white; color:#6b7280; transition:all .12s; }
    .wd-btn--active { border-color:#e91e8c; background:#fdf2f8; color:#e91e8c; }

    .rec-preview { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:.65rem .85rem; font-size:.8rem; color:#166534; margin-bottom:.5rem; }
  `],
})
export class ExcursionDatesPageComponent implements OnInit {
    private readonly excSvc = inject(ExcursionService);
    private readonly confirmSvc = inject(ConfirmService);
    private readonly toast = inject(ToastService);
    readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);

    readonly excursion = signal<Excursion | null>(null);
    readonly dates = signal<ExcursionDateRow[]>([]);
    readonly loading = signal(true);
    readonly saving = signal(false);
    readonly error = signal<string | null>(null);
    readonly modalError = signal<string | null>(null);
    readonly activeModal = signal<Modal>('none');
    readonly selectedDateId = signal<string | null>(null);
    readonly selectedCalDate = signal<string | null>(null);

    // Calendar state
    private excursionId = '';
    readonly calYear = signal(new Date().getFullYear());
    readonly calMonth = signal(new Date().getMonth());
    readonly weekdays = WEEKDAYS;
    readonly weekdayLabels = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
    readonly today = todayStr();
    showDropdown = false;

    // Single date form
    singleForm = { date: todayStr(), time: '06:00', spots: 20 };

    // Recurrence form
    recForm = { weekdays: [] as number[], from: todayStr(), to: '', time: '06:00', spots: 20 };

    // Edit spots form
    readonly editSpotsTarget = signal<ExcursionDateRow | null>(null);
    editSpotsValue = 0;

    readonly filteredDates = computed(() => {
        const selected = this.selectedCalDate();
        return selected ? this.dates().filter(d => d.date === selected) : this.dates();
    });

    readonly monthLabel = computed(() => {
        const d = new Date(this.calYear(), this.calMonth(), 1);
        return d.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' });
    });

    readonly calendarCells = computed(() => {
        const year = this.calYear(); const month = this.calMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrev = new Date(year, month, 0).getDate();
        const today = todayStr();
        const dateMap = new Map<string, ExcursionDateRow[]>();
        for (const d of this.dates()) {
            if (!dateMap.has(d.date)) dateMap.set(d.date, []);
            dateMap.get(d.date)!.push(d);
        }
        const cells: { key: string; day: number; inMonth: boolean; isToday: boolean; dateStr: string; hasDates: boolean; dot: 'ok' | 'low' | 'full' | null }[] = [];
        for (let i = 0; i < firstDay; i++) {
            const day = daysInPrev - firstDay + 1 + i;
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            cells.push({ key: 'p' + i, day, inMonth: false, isToday: false, dateStr, hasDates: false, dot: null });
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const ds = dateMap.get(dateStr) ?? [];
            let dot: 'ok' | 'low' | 'full' | null = null;
            if (ds.length > 0) {
                const allFull = ds.every(x => x.spots_left === 0);
                const anyLow = ds.some(x => x.spots_left > 0 && x.spots_left / x.total_spots < 0.2);
                dot = allFull ? 'full' : anyLow ? 'low' : 'ok';
            }
            cells.push({ key: 'c' + d, day: d, inMonth: true, isToday: dateStr === today, dateStr, hasDates: ds.length > 0, dot });
        }
        const remaining = 42 - cells.length;
        for (let i = 1; i <= remaining; i++) {
            const dateStr = `${year}-${String(month + 2).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            cells.push({ key: 'n' + i, day: i, inMonth: false, isToday: false, dateStr, hasDates: false, dot: null });
        }
        return cells;
    });

    readonly recurrencePreview = computed(() => {
        if (!this.recForm.from || !this.recForm.to || this.recForm.weekdays.length === 0) return 0;
        let count = 0;
        const cur = new Date(this.recForm.from + 'T00:00:00');
        const end = new Date(this.recForm.to + 'T00:00:00');
        while (cur <= end) {
            if (this.recForm.weekdays.includes(cur.getDay())) count++;
            cur.setDate(cur.getDate() + 1);
        }
        return count;
    });

    readonly fmtDate = fmtDate;
    readonly fmtTime = fmtTime;

    ngOnInit() {
        this.excursionId = this.route.snapshot.paramMap.get('id') ?? '';
        if (!this.excursionId) { this.router.navigate(['/operator/excursions']); return; }
        this.loadData();
    }

    async loadData() {
        this.loading.set(true);
        try {
            const [exc, ds] = await Promise.all([
                this.excSvc.getExcursion(this.excursionId),
                this.excSvc.listDates(this.excursionId),
            ]);
            this.excursion.set(exc);
            this.dates.set(ds);
        } catch (e: unknown) {
            this.error.set((e as Error).message);
        } finally {
            this.loading.set(false);
        }
    }

    spotsPercent(d: ExcursionDateRow): number {
        if (d.total_spots === 0) return 0;
        return Math.round(((d.total_spots - d.spots_left) / d.total_spots) * 100);
    }

    prevMonth() { if (this.calMonth() === 0) { this.calMonth.set(11); this.calYear.update(y => y - 1); } else { this.calMonth.update(m => m - 1); } }
    nextMonth() { if (this.calMonth() === 11) { this.calMonth.set(0); this.calYear.update(y => y + 1); } else { this.calMonth.update(m => m + 1); } }
    selectCalDate(d: string) { this.selectedCalDate.set(this.selectedCalDate() === d ? null : d); }

    openModal(m: Modal) { this.activeModal.set(m); this.modalError.set(null); }
    closeModal() { this.activeModal.set('none'); this.editSpotsTarget.set(null); }

    toggleWeekday(i: number) {
        const wds = this.recForm.weekdays;
        this.recForm.weekdays = wds.includes(i) ? wds.filter(x => x !== i) : [...wds, i];
    }

    selectedWeekdayNames() {
        return WEEKDAYS.filter(w => this.recForm.weekdays.includes(w.i)).map(w => w.short.toLowerCase()).join(', ');
    }

    openEditSpots(d: ExcursionDateRow) {
        this.editSpotsTarget.set(d);
        this.editSpotsValue = d.total_spots;
        this.activeModal.set('editSpots');
        this.modalError.set(null);
    }

    async saveSingle() {
        if (!this.singleForm.date || !this.singleForm.time || this.singleForm.spots < 1) {
            this.modalError.set('Completa todos los campos.'); return;
        }
        this.saving.set(true);
        try {
            await this.excSvc.addDate(this.excursionId, this.singleForm.date, this.singleForm.time, this.singleForm.spots);
            await this.loadData();
            this.closeModal();
            this.toast.success('Fecha añadida correctamente');
        } catch (e: unknown) {
            this.modalError.set((e as Error).message);
        } finally {
            this.saving.set(false);
        }
    }

    async saveRecurrence() {
        if (!this.recForm.from || !this.recForm.to || this.recForm.weekdays.length === 0) {
            this.modalError.set('Selecciona días y rango de fechas.'); return;
        }
        this.saving.set(true);
        try {
            const n = await this.excSvc.addRecurringDates(
                this.excursionId, this.recForm.weekdays, this.recForm.from, this.recForm.to,
                this.recForm.time, this.recForm.spots,
            );
            await this.loadData();
            this.closeModal();
            this.toast.success(`${n} fecha(s) añadida(s) al calendario`);
        } catch (e: unknown) {
            this.modalError.set((e as Error).message);
        } finally {
            this.saving.set(false);
        }
    }

    async saveEditSpots() {
        const target = this.editSpotsTarget();
        if (!target) return;
        const confirmed = target.confirmedPeople ?? 0;
        if (this.editSpotsValue < confirmed) {
            this.modalError.set(`El mínimo es ${confirmed} (reservas confirmadas).`); return;
        }
        this.saving.set(true);
        try {
            await this.excSvc.updateSpots(target.id, this.editSpotsValue, confirmed);
            this.dates.update(list => list.map(d => d.id === target.id
                ? { ...d, total_spots: this.editSpotsValue, spots_left: this.editSpotsValue - confirmed }
                : d));
            this.closeModal();
            this.toast.success('Cupos actualizados');
        } catch (e: unknown) {
            this.modalError.set((e as Error).message);
        } finally {
            this.saving.set(false);
        }
    }

    async cancelDate(dateId: string) {
        const ok = await this.confirmSvc.confirm({
            title: '¿Cancelar esta fecha?',
            message: 'Las reservas existentes no serán afectadas automáticamente. Deberás contactar a los clientes.',
            danger: true, confirmText: 'Cancelar fecha',
        });
        if (!ok) return;
        await this.excSvc.cancelDate(dateId);
        this.dates.update(list => list.filter(d => d.id !== dateId));
        this.toast.success('Fecha cancelada');
    }
}
