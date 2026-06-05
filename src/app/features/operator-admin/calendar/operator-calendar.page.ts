import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OperatorAdminService } from '../operator-admin.service';
import { ExcursionService, CalendarEvent } from '../excursions/excursion.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';

type CalView = 'month' | 'week' | 'agenda';

// CalEvent is a local alias for the service-exported CalendarEvent
type CalEvent = CalendarEvent;

interface DayCell {
    key: string;
    day: number;
    inMonth: boolean;
    isToday: boolean;
    dateStr: string;
    events: CalEvent[];
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtTime(t: string) {
    if (!t) return '';
    const [h, m] = t.split(':'); const hr = parseInt(h, 10);
    return `${hr % 12 || 12}:${m}${hr >= 12 ? 'pm' : 'am'}`;
}
function fmtWeekDay(d: Date) {
    return d.toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' });
}

@Component({
    selector: 'app-operator-calendar',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
  <div class="page">
    <!-- ── Top bar ─────────────────────────────────────────────────────────── -->
    <div class="cal-bar">
      <div class="view-toggle">
        <button [class.active]="view() === 'month'"  (click)="view.set('month')">Mes</button>
        <button [class.active]="view() === 'week'"   (click)="view.set('week')">Semana</button>
        <button [class.active]="view() === 'agenda'" (click)="view.set('agenda')">Agenda</button>
      </div>
      <div class="nav-row">
        <button class="nav-btn" (click)="prev()">‹</button>
        <span class="period-label">{{ periodLabel() }}</span>
        <button class="nav-btn" (click)="next()">›</button>
      </div>
      <button class="today-btn" (click)="goToday()">Hoy</button>
    </div>

    @if (loading()) {
      <div class="loading">Cargando fechas…</div>
    }

    <!-- ── VISTA MES ──────────────────────────────────────────────────────── -->
    @if (view() === 'month') {
      <div class="month-view">
        <div class="month-weekdays">
          @for (wd of weekdayLabels; track wd) { <span>{{ wd }}</span> }
        </div>
        <div class="month-grid">
          @for (cell of monthCells(); track cell.key) {
            <div class="day-cell"
              [class.other-month]="!cell.inMonth"
              [class.today]="cell.isToday"
              (click)="cell.inMonth && onDayClick(cell.dateStr, cell.events)">
              <span class="day-num">{{ cell.day }}</span>
              <div class="day-events">
                @for (ev of cell.events.slice(0,3); track ev.dateRowId) {
                  <div class="ev-chip" [class]="evClass(ev)"
                    (click)="$event.stopPropagation(); openEventDetail(ev)"
                    [title]="ev.excursionName + ' ' + fmtTime(ev.departureTime)">
                    <span class="ev-time">{{ fmtTime(ev.departureTime) }}</span>
                    <span class="ev-name">{{ ev.excursionName }}</span>
                    <span class="ev-spots">{{ ev.spotsLeft }}/{{ ev.totalSpots }}</span>
                  </div>
                }
                @if (cell.events.length > 3) {
                  <div class="ev-more" (click)="$event.stopPropagation(); onDayClick(cell.dateStr, cell.events)">
                    +{{ cell.events.length - 3 }} más
                  </div>
                }
              </div>
              @if (cell.inMonth) {
                <button class="add-btn" (click)="$event.stopPropagation(); openAddModal(cell.dateStr)" title="Agregar fecha">+</button>
              }
            </div>
          }
        </div>
      </div>
    }

    <!-- ── VISTA SEMANA ───────────────────────────────────────────────────── -->
    @if (view() === 'week') {
      <div class="week-view">
        <div class="week-header">
          <div class="week-time-col"></div>
          @for (day of weekDays(); track day.dateStr) {
            <div class="week-day-header" [class.today]="day.dateStr === todayStr()">
              <p class="week-day-name">{{ day.dayName }}</p>
              <p class="week-day-num" [class.today-num]="day.dateStr === todayStr()">{{ day.dayNum }}</p>
            </div>
          }
        </div>
        <div class="week-body">
          @for (hour of hours; track hour) {
            <div class="week-hour-row">
              <div class="week-time-label">{{ hour }}:00</div>
              @for (day of weekDays(); track day.dateStr) {
                <div class="week-hour-cell">
                  @for (ev of getEventsForHour(day.dateStr, hour); track ev.dateRowId) {
                    <div class="week-ev-block" [class]="evClass(ev)"
                      [style.height.px]="ev.durationHours * 48"
                      (click)="openEventDetail(ev)">
                      <p class="week-ev-name">{{ ev.excursionName }}</p>
                      <p class="week-ev-meta">{{ fmtTime(ev.departureTime) }} · {{ ev.confirmedPeople }}/{{ ev.totalSpots }}</p>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>
    }

    <!-- ── VISTA AGENDA ───────────────────────────────────────────────────── -->
    @if (view() === 'agenda') {
      <div class="agenda-view">
        @if (agendaEvents().length === 0) {
          <div class="empty-state">
            <p>🗓️</p><p>No hay excursiones programadas en los próximos 30 días.</p>
          </div>
        } @else {
          @for (group of agendaGroups(); track group.dateStr) {
            <div class="agenda-group">
              <div class="agenda-date-header">
                <span class="agenda-date-label" [class.agenda-today]="group.dateStr === todayStr()">
                  {{ group.label }}
                </span>
              </div>
              @for (ev of group.events; track ev.dateRowId) {
                <div class="agenda-row" [class]="'agenda-row--' + evType(ev)" (click)="openEventDetail(ev)">
                  <div class="agenda-time">{{ fmtTime(ev.departureTime) }}</div>
                  <div class="agenda-info">
                    <p class="agenda-name">{{ ev.excursionName }}</p>
                    <p class="agenda-meta">
                      👥 {{ ev.confirmedPeople }} confirmadas / {{ ev.totalSpots }} cupos
                      @if (ev.spotsLeft === 0) { <span class="tag-full">LLENA</span> }
                      @else if (ev.spotsLeft <= 3) { <span class="tag-low">{{ ev.spotsLeft }} cupos</span> }
                    </p>
                  </div>
                  <button class="agenda-action" (click)="$event.stopPropagation(); router.navigate(['/operator/excursions', ev.excursionId, 'dates'])">
                    Fechas →
                  </button>
                </div>
              }
            </div>
          }
        }
      </div>
    }

    <!-- ── Day click slide-over ───────────────────────────────────────────── -->
    @if (slideOver()) {
      <div class="slide-overlay" (click)="slideOver.set(null)">
        <div class="slide-panel" (click)="$event.stopPropagation()">
          <div class="slide-header">
            <h3>{{ slideOver()!.dateLabel }}</h3>
            <button class="slide-close" (click)="slideOver.set(null)">✕</button>
          </div>
          <div class="slide-body">
            @for (ev of slideOver()!.events; track ev.dateRowId) {
              <div class="slide-ev" [class]="'slide-ev--' + evType(ev)">
                <div class="slide-ev-header">
                  <span class="slide-ev-name">{{ ev.excursionName }}</span>
                  <span class="slide-ev-time">{{ fmtTime(ev.departureTime) }}</span>
                </div>
                <div class="spots-bar-wrap">
                  <div class="spots-bar">
                    <div class="spots-fill" [style.width.%]="filledPct(ev)" [class]="'fill-' + evType(ev)"></div>
                  </div>
                  <span class="spots-text">{{ ev.confirmedPeople }}/{{ ev.totalSpots }} cupos</span>
                </div>
                <div class="slide-ev-actions">
                  <button class="sa-btn" (click)="router.navigate(['/operator/bookings'], {queryParams: {excursion: ev.excursionId}})">📋 Reservas</button>
                  <button class="sa-btn" (click)="router.navigate(['/operator/excursions', ev.excursionId, 'dates'])">📅 Fechas</button>
                </div>
              </div>
            }
            <button class="sa-btn-add" (click)="openAddModal(slideOver()!.dateStr)">+ Agregar fecha aquí</button>
          </div>
        </div>
      </div>
    }

    <!-- ── Add date modal ─────────────────────────────────────────────────── -->
    @if (addModal()) {
      <div class="modal-overlay" (click)="addModal.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3 class="modal-title">📅 Nueva fecha — {{ addModal()!.date }}</h3>
          <div class="form-group">
            <label class="label">Excursión *</label>
            <select [(ngModel)]="addForm.excursionId" class="input-field">
              <option value="">Selecciona…</option>
              @for (exc of excursionList(); track exc.id) {
                <option [value]="exc.id">{{ exc.name }}</option>
              }
            </select>
          </div>
          <div class="form-group">
            <label class="label">Hora de salida</label>
            <input type="time" [(ngModel)]="addForm.time" class="input-field" />
          </div>
          <div class="form-group">
            <label class="label">Cupos</label>
            <input type="number" [(ngModel)]="addForm.spots" min="1" class="input-field" />
          </div>
          @if (addError()) { <p class="field-error">{{ addError() }}</p> }
          <div class="modal-actions">
            <button class="btn-secondary" (click)="addModal.set(null)">Cancelar</button>
            <button class="btn-primary" (click)="saveAddDate()" [disabled]="saving()">
              {{ saving() ? 'Guardando…' : 'Guardar fecha' }}
            </button>
          </div>
        </div>
      </div>
    }
  </div>
  `,
    styles: [`
    .page { max-width:1200px; margin:0 auto; }

    /* Top bar */
    .cal-bar { display:flex; align-items:center; gap:1rem; margin-bottom:1.25rem; flex-wrap:wrap; }
    .view-toggle { display:flex; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; }
    .view-toggle button { background:white; border:none; padding:.45rem .85rem; font-size:.8rem; cursor:pointer; color:#6b7280; }
    .view-toggle button.active { background:#e91e8c; color:white; font-weight:600; }
    .nav-row { display:flex; align-items:center; gap:.5rem; }
    .nav-btn { background:white; border:1px solid #e5e7eb; border-radius:8px; padding:.3rem .75rem; cursor:pointer; font-size:1.1rem; }
    .nav-btn:hover { border-color:#e91e8c; color:#e91e8c; }
    .period-label { font-size:.95rem; font-weight:700; color:#111827; min-width:160px; text-align:center; text-transform:capitalize; }
    .today-btn { background:white; border:1px solid #e5e7eb; border-radius:8px; padding:.4rem .85rem; font-size:.8rem; cursor:pointer; color:#374151; margin-left:auto; }
    .today-btn:hover { border-color:#e91e8c; color:#e91e8c; }

    /* ── MONTH ── */
    .month-view { background:white; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden; }
    .month-weekdays { display:grid; grid-template-columns:repeat(7,1fr); background:#f9fafb; border-bottom:1px solid #e5e7eb; }
    .month-weekdays span { padding:.5rem; text-align:center; font-size:.68rem; font-weight:700; color:#9ca3af; text-transform:uppercase; }
    .month-grid { display:grid; grid-template-columns:repeat(7,1fr); }
    .day-cell { border-right:1px solid #f3f4f6; border-bottom:1px solid #f3f4f6; min-height:110px; padding:.35rem; position:relative; cursor:pointer; transition:background .12s; }
    .day-cell:hover:not(.other-month) { background:#fdf2f8; }
    .day-cell.other-month { background:#fafafa; cursor:default; }
    .day-cell.today { background:#fff0f8; }
    .day-num { display:block; font-size:.75rem; font-weight:700; color:#374151; margin-bottom:.25rem; }
    .day-cell.today .day-num { background:#e91e8c; color:white; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; font-size:.72rem; }
    .day-cell.other-month .day-num { color:#d1d5db; }
    .day-events { display:flex; flex-direction:column; gap:2px; }
    .ev-chip { display:flex; align-items:center; gap:3px; border-radius:5px; padding:2px 5px; font-size:.65rem; cursor:pointer; overflow:hidden; }
    .ev-chip.ok  { background:#d1fae5; color:#065f46; }
    .ev-chip.low { background:#fef3c7; color:#92400e; }
    .ev-chip.full{ background:#fee2e2; color:#991b1b; }
    .ev-chip.inactive{ background:#f3f4f6; color:#9ca3af; }
    .ev-time { flex-shrink:0; font-weight:700; }
    .ev-name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ev-spots{ flex-shrink:0; opacity:.7; }
    .ev-more { font-size:.65rem; color:#6b7280; padding:1px 5px; cursor:pointer; }
    .ev-more:hover { color:#e91e8c; }
    .add-btn { position:absolute; bottom:4px; right:4px; background:none; border:none; color:#d1d5db; font-size:1rem; cursor:pointer; line-height:1; opacity:0; transition:opacity .15s; }
    .day-cell:hover .add-btn { opacity:1; color:#e91e8c; }

    /* ── WEEK ── */
    .week-view { background:white; border:1px solid #e5e7eb; border-radius:16px; overflow:auto; }
    .week-header { display:grid; grid-template-columns:60px repeat(7,1fr); border-bottom:1px solid #e5e7eb; position:sticky; top:0; background:white; z-index:2; }
    .week-time-col { }
    .week-day-header { padding:.5rem .25rem; text-align:center; }
    .week-day-header.today { background:#fff0f8; }
    .week-day-name { font-size:.65rem; font-weight:700; text-transform:uppercase; color:#9ca3af; margin:0; }
    .week-day-num { font-size:.9rem; font-weight:700; color:#374151; margin:.15rem 0 0; }
    .week-day-num.today-num { background:#e91e8c; color:white; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; margin:.15rem auto 0; }
    .week-body { display:flex; flex-direction:column; }
    .week-hour-row { display:grid; grid-template-columns:60px repeat(7,1fr); border-bottom:1px solid #f3f4f6; min-height:48px; }
    .week-time-label { font-size:.65rem; color:#9ca3af; padding:.25rem .35rem; text-align:right; }
    .week-hour-cell { border-left:1px solid #f3f4f6; position:relative; }
    .week-ev-block { position:absolute; left:2px; right:2px; top:2px; border-radius:6px; padding:2px 5px; overflow:hidden; cursor:pointer; }
    .week-ev-block.ok   { background:#d1fae5; color:#065f46; }
    .week-ev-block.low  { background:#fef3c7; color:#92400e; }
    .week-ev-block.full { background:#fee2e2; color:#991b1b; }
    .week-ev-name { font-size:.68rem; font-weight:600; margin:0; }
    .week-ev-meta { font-size:.62rem; margin:.1rem 0 0; opacity:.8; }

    /* ── AGENDA ── */
    .agenda-view { display:flex; flex-direction:column; gap:.35rem; }
    .agenda-group { }
    .agenda-date-header { padding:.25rem 0; margin-bottom:.25rem; }
    .agenda-date-label { font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#9ca3af; }
    .agenda-date-label.agenda-today { color:#e91e8c; }
    .agenda-row { background:white; border:1px solid #e5e7eb; border-radius:12px; padding:.75rem 1rem; display:flex; align-items:center; gap:1rem; cursor:pointer; transition:background .12s; border-left:4px solid #e5e7eb; }
    .agenda-row--ok   { border-left-color:#10b981; }
    .agenda-row--low  { border-left-color:#f59e0b; }
    .agenda-row--full { border-left-color:#ef4444; }
    .agenda-row:hover { background:#fdf2f8; }
    .agenda-time { font-size:.8rem; font-weight:700; color:#374151; flex-shrink:0; width:60px; }
    .agenda-info { flex:1; }
    .agenda-name { font-size:.875rem; font-weight:600; color:#111827; margin:0; }
    .agenda-meta { font-size:.75rem; color:#6b7280; margin:.15rem 0 0; display:flex; align-items:center; gap:.4rem; }
    .tag-full { background:#fee2e2; color:#991b1b; font-size:.65rem; font-weight:700; border-radius:4px; padding:1px 5px; }
    .tag-low  { background:#fef3c7; color:#92400e; font-size:.65rem; font-weight:700; border-radius:4px; padding:1px 5px; }
    .agenda-action { background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:.25rem .6rem; font-size:.75rem; cursor:pointer; color:#374151; flex-shrink:0; }
    .agenda-action:hover { border-color:#e91e8c; color:#e91e8c; }
    .empty-state { background:white; border:1px solid #e5e7eb; border-radius:16px; padding:3rem; text-align:center; color:#9ca3af; }

    /* Slide-over */
    .slide-overlay { position:fixed; inset:0; z-index:40; background:rgba(0,0,0,.35); }
    .slide-panel { position:fixed; top:0; right:0; bottom:0; width:360px; background:white; box-shadow:-8px 0 32px rgba(0,0,0,.12); display:flex; flex-direction:column; z-index:41; }
    @media(max-width:480px){ .slide-panel { width:100%; } }
    .slide-header { display:flex; align-items:center; justify-content:space-between; padding:1rem 1.25rem; border-bottom:1px solid #e5e7eb; }
    .slide-header h3 { font-size:.95rem; font-weight:700; color:#111827; margin:0; text-transform:capitalize; }
    .slide-close { background:none; border:none; cursor:pointer; font-size:1.1rem; color:#9ca3af; }
    .slide-body { flex:1; overflow-y:auto; padding:1rem 1.25rem; display:flex; flex-direction:column; gap:.75rem; }
    .slide-ev { background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:.85rem; }
    .slide-ev--ok   { border-color:#6ee7b7; }
    .slide-ev--low  { border-color:#fde68a; }
    .slide-ev--full { border-color:#fca5a5; }
    .slide-ev-header { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:.5rem; }
    .slide-ev-name { font-size:.875rem; font-weight:700; color:#111827; }
    .slide-ev-time { font-size:.8rem; color:#6b7280; }
    .spots-bar-wrap { display:flex; align-items:center; gap:.5rem; margin-bottom:.5rem; }
    .spots-bar { flex:1; height:6px; background:#e5e7eb; border-radius:999px; overflow:hidden; }
    .spots-fill { height:100%; border-radius:999px; transition:width .3s; }
    .fill-ok   { background:#10b981; }
    .fill-low  { background:#f59e0b; }
    .fill-full { background:#ef4444; }
    .spots-text { font-size:.72rem; color:#6b7280; flex-shrink:0; }
    .slide-ev-actions { display:flex; gap:.4rem; }
    .sa-btn { background:white; border:1px solid #e5e7eb; border-radius:8px; padding:.3rem .65rem; font-size:.75rem; cursor:pointer; color:#374151; }
    .sa-btn:hover { border-color:#e91e8c; color:#e91e8c; }
    .sa-btn-add { background:#e91e8c; color:white; border:none; border-radius:10px; padding:.6rem; font-size:.8rem; font-weight:600; cursor:pointer; width:100%; margin-top:.5rem; }

    /* Modal size override */
    .modal { max-width:420px; }
  `],
})
export class OperatorCalendarPageComponent implements OnInit {
    private readonly operatorSvc = inject(OperatorAdminService);
    private readonly excSvc = inject(ExcursionService);
    private readonly toast = inject(ToastService);
    readonly router = inject(Router);

    readonly view = signal<CalView>('month');
    readonly year = signal(new Date().getFullYear());
    readonly month = signal(new Date().getMonth());
    readonly weekStart = signal((() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d; })());

    readonly allEvents = signal<CalEvent[]>([]);
    readonly excursionList = signal<{ id: string; name: string }[]>([]);
    readonly loading = signal(false);

    readonly slideOver = signal<{ dateStr: string; dateLabel: string; events: CalEvent[] } | null>(null);
    readonly addModal = signal<{ date: string } | null>(null);
    readonly addError = signal<string | null>(null);
    readonly saving = signal(false);
    addForm = { excursionId: '', time: '06:00', spots: 20 };

    readonly weekdayLabels = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
    readonly hours = Array.from({ length: 18 }, (_, i) => i + 5); // 5am–10pm
    readonly todayStr = todayStr;
    readonly fmtTime = fmtTime;

    readonly periodLabel = computed(() => {
        if (this.view() === 'month') {
            return new Date(this.year(), this.month(), 1).toLocaleDateString('es-DO', { month: 'long', year: 'numeric' });
        }
        if (this.view() === 'week') {
            const ws = this.weekStart();
            const we = new Date(ws); we.setDate(ws.getDate() + 6);
            return `${ws.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })} – ${we.toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        }
        return 'Próximos 30 días';
    });

    readonly monthCells = computed((): DayCell[] => {
        const year = this.year(); const month = this.month();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrev = new Date(year, month, 0).getDate();
        const today = todayStr();
        const evMap = this.buildEventMap();
        const cells: DayCell[] = [];

        for (let i = 0; i < firstDay; i++) {
            const d = daysInPrev - firstDay + 1 + i;
            const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            cells.push({ key: 'p' + i, day: d, inMonth: false, isToday: false, dateStr: ds, events: evMap.get(ds) ?? [] });
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            cells.push({ key: 'c' + d, day: d, inMonth: true, isToday: ds === today, dateStr: ds, events: evMap.get(ds) ?? [] });
        }
        const rem = 42 - cells.length;
        for (let i = 1; i <= rem; i++) {
            const ds = `${year}-${String(month + 2).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            cells.push({ key: 'n' + i, day: i, inMonth: false, isToday: false, dateStr: ds, events: evMap.get(ds) ?? [] });
        }
        return cells;
    });

    readonly weekDays = computed(() => {
        const ws = this.weekStart();
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(ws); d.setDate(ws.getDate() + i);
            return {
                dateStr: d.toISOString().slice(0, 10),
                dayName: d.toLocaleDateString('es-DO', { weekday: 'short' }).toUpperCase(),
                dayNum: d.getDate(),
            };
        });
    });

    readonly agendaEvents = computed(() => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const end = new Date(today); end.setDate(end.getDate() + 30);
        return this.allEvents()
            .filter(e => { const d = new Date(e.date + 'T00:00:00'); return d >= today && d <= end; })
            .sort((a, b) => a.date.localeCompare(b.date) || a.departureTime.localeCompare(b.departureTime));
    });

    readonly agendaGroups = computed(() => {
        const map = new Map<string, CalEvent[]>();
        for (const ev of this.agendaEvents()) {
            if (!map.has(ev.date)) map.set(ev.date, []);
            map.get(ev.date)!.push(ev);
        }
        return Array.from(map.entries()).map(([dateStr, events]) => ({
            dateStr,
            label: new Date(dateStr + 'T00:00:00').toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' }),
            events,
        }));
    });

    ngOnInit() { this.loadEvents(); }

    async loadEvents() {
        const opId = this.operatorSvc.activeOperatorId();
        if (!opId) return;
        this.loading.set(true);
        try {
            const past7 = new Date(); past7.setDate(past7.getDate() - 7);
            const { events, excursions } = await this.excSvc.loadCalendarData(opId, past7.toISOString().slice(0, 10));
            this.allEvents.set(events);
            this.excursionList.set(excursions);
        } finally { this.loading.set(false); }
    }

    private buildEventMap() {
        const map = new Map<string, CalEvent[]>();
        for (const ev of this.allEvents()) {
            if (!map.has(ev.date)) map.set(ev.date, []);
            map.get(ev.date)!.push(ev);
        }
        return map;
    }

    evType(ev: CalEvent): 'ok' | 'low' | 'full' | 'inactive' {
        if (!ev.isActive) return 'inactive';
        if (ev.spotsLeft === 0) return 'full';
        if (ev.spotsLeft / ev.totalSpots < 0.2) return 'low';
        return 'ok';
    }

    evClass(ev: CalEvent) { return this.evType(ev); }
    filledPct(ev: CalEvent) { return ev.totalSpots > 0 ? Math.round(((ev.totalSpots - ev.spotsLeft) / ev.totalSpots) * 100) : 0; }

    getEventsForHour(dateStr: string, hour: number): CalEvent[] {
        return this.allEvents().filter(ev => {
            if (ev.date !== dateStr) return false;
            const h = parseInt(ev.departureTime.split(':')[0], 10);
            return h === hour;
        });
    }

    prev() {
        if (this.view() === 'month') {
            if (this.month() === 0) { this.month.set(11); this.year.update(y => y - 1); }
            else this.month.update(m => m - 1);
        } else if (this.view() === 'week') {
            this.weekStart.update(ws => { const d = new Date(ws); d.setDate(d.getDate() - 7); return d; });
        }
    }

    next() {
        if (this.view() === 'month') {
            if (this.month() === 11) { this.month.set(0); this.year.update(y => y + 1); }
            else this.month.update(m => m + 1);
        } else if (this.view() === 'week') {
            this.weekStart.update(ws => { const d = new Date(ws); d.setDate(d.getDate() + 7); return d; });
        }
    }

    goToday() {
        const now = new Date();
        this.year.set(now.getFullYear()); this.month.set(now.getMonth());
        const ws = new Date(now); ws.setDate(ws.getDate() - ws.getDay());
        this.weekStart.set(ws);
    }

    onDayClick(dateStr: string, events: CalEvent[]) {
        const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' });
        this.slideOver.set({ dateStr, dateLabel: label, events });
    }

    openEventDetail(ev: CalEvent) {
        this.onDayClick(ev.date, this.allEvents().filter(e => e.date === ev.date));
    }

    openAddModal(date: string) {
        this.slideOver.set(null);
        this.addModal.set({ date });
        this.addError.set(null);
        this.addForm = { excursionId: '', time: '06:00', spots: 20 };
    }

    async saveAddDate() {
        if (!this.addForm.excursionId) { this.addError.set('Selecciona una excursión.'); return; }
        this.saving.set(true);
        try {
            await this.excSvc.addDate(this.addForm.excursionId, this.addModal()!.date, this.addForm.time, this.addForm.spots);
            await this.loadEvents();
            this.addModal.set(null);
            this.toast.success('Fecha añadida al calendario');
        } catch (e: unknown) {
            this.addError.set((e as Error).message);
        } finally { this.saving.set(false); }
    }
}
