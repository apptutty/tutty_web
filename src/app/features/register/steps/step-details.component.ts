import { Component, inject, OnInit, computed } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RegisterService } from '../register.service';
import { CommerceType } from '../../../core/supabase/database.types';

const ALL_DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DAY_LABELS: Record<string, string> = {
    lunes: 'Lun', martes: 'Mar', miercoles: 'Mié',
    jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom',
};

const UNIT_TYPES = ['kg', 'litro', 'unidad', 'caja', 'paquete', 'docena', 'libra'];

@Component({
    selector: 'app-register-step-details',
    standalone: true,
    imports: [ReactiveFormsModule],
    template: `
    <div class="step-container">
      <div class="step-header">
        <h1>Configuración operativa</h1>
        <p>Define tus horarios, opciones de delivery y detalles específicos de tu tipo de comercio.</p>
      </div>

      <form [formGroup]="form" (ngSubmit)="next()" class="details-form">

        <!-- Hours -->
        <section class="section">
          <h2 class="section-title">⏰ Horario de atención</h2>
          <div class="form-row">
            <div class="form-group">
              <label class="label" for="opening">Apertura</label>
              <input id="opening" type="time" class="input-field" formControlName="opening_time" />
            </div>
            <div class="form-group">
              <label class="label" for="closing">Cierre</label>
              <input id="closing" type="time" class="input-field" formControlName="closing_time" />
            </div>
          </div>

          <div class="form-group">
            <label class="label">Días de atención</label>
            <div class="day-pills">
              @for (day of allDays; track day) {
                <button
                  type="button"
                  class="day-pill"
                  [class.active]="isDaySelected(day)"
                  (click)="toggleDay(day)">
                  {{ dayLabel(day) }}
                </button>
              }
            </div>
          </div>

          @if (schedulePreview()) {
            <div class="schedule-preview">
              {{ schedulePreview() }}
            </div>
          }
        </section>

        <!-- Delivery -->
        <section class="section">
          <h2 class="section-title">🚴 Configuración de delivery</h2>
          <div class="form-row">
            <div class="form-group">
              <label class="label" for="avg_delivery">Tiempo promedio de entrega: <strong>{{ form.value.avg_delivery_minutes }} min</strong></label>
              <input id="avg_delivery" type="range" class="slider" formControlName="avg_delivery_minutes" min="15" max="120" step="5" />
              <div class="slider-labels"><span>15 min</span><span>120 min</span></div>
            </div>
            <div class="form-group">
              <label class="label" for="min_order">Pedido mínimo (RD$)</label>
              <input id="min_order" type="number" class="input-field" formControlName="min_order_amount" min="0" />
            </div>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" formControlName="free_delivery_enabled" />
              Ofrecer delivery gratis a partir de cierto monto
            </label>
          </div>

          @if (form.value.free_delivery_enabled) {
            <div class="form-group">
              <label class="label" for="threshold">Monto mínimo para delivery gratis (RD$)</label>
              <input id="threshold" type="number" class="input-field" formControlName="free_delivery_threshold" min="0" />
            </div>
          }
        </section>

        <!-- Commerce-type specific -->
        @if (commerceType() === 'farmacia') {
          <section class="section">
            <h2 class="section-title">💊 Detalles de farmacia</h2>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" formControlName="requires_prescription" />
                Requiere receta para medicamentos controlados
              </label>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" formControlName="urgent_delivery" />
                Ofrece entrega de urgencia disponible
              </label>
            </div>
          </section>
        }

        @if (commerceType() === 'tienda_ropa') {
          <section class="section">
            <h2 class="section-title">👗 Detalles de tienda de ropa</h2>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" formControlName="handles_sizes" />
                Maneja tallas (XS, S, M, L, XL, etc.)
              </label>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" formControlName="handles_colors" />
                Maneja variantes de color
              </label>
            </div>
            <div class="form-group">
              <label class="label" for="return_policy">Política de devoluciones</label>
              <textarea id="return_policy" class="input-field" formControlName="return_policy" rows="2" placeholder="Ej. Devoluciones hasta 7 días con ticket de compra"></textarea>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" formControlName="sells_secondhand" />
                Vende ropa de segunda mano / vintage
              </label>
            </div>
          </section>
        }

        @if (commerceType() === 'electronica') {
          <section class="section">
            <h2 class="section-title">📱 Detalles de electrónica</h2>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" formControlName="offers_warranty" />
                Ofrece garantía en sus productos
              </label>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" formControlName="sells_secondhand" />
                Vende equipos usados / reacondicionados
              </label>
            </div>
          </section>
        }

        @if (commerceType() === 'bodega' || commerceType() === 'colmado' || commerceType() === 'supermercado') {
          <section class="section">
            <h2 class="section-title">📦 Detalles adicionales</h2>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" formControlName="realtime_inventory" />
                Mantiene inventario en tiempo real en la app
              </label>
            </div>
            <div class="form-group">
              <label class="label">Unidades de medida que maneja</label>
              <div class="tag-grid">
                @for (u of unitTypes; track u) {
                  <button type="button" class="tag-btn" [class.active]="isUnitTypeSelected(u)" (click)="toggleUnitType(u)">
                    {{ u }}
                  </button>
                }
              </div>
            </div>
          </section>
        }

        <div class="step-actions">
          <button type="button" class="btn-secondary" (click)="back()">← Atrás</button>
          <button type="submit" class="btn-primary" [disabled]="form.invalid">
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

    .details-form { display: flex; flex-direction: column; gap: 0.5rem; }

    .section {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 1.25rem;
      margin-bottom: 1rem;
    }

    .section-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #374151;
      margin: 0 0 1rem;
    }

    .form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.75rem; }

    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

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

    .day-pills { display: flex; gap: 0.5rem; flex-wrap: wrap; }

    .day-pill {
      padding: 0.4rem 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      background: white;
      color: #374151;
      transition: all 0.15s;
    }

    .day-pill.active {
      background: #FF3C97;
      border-color: #FF3C97;
      color: white;
    }

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

    .slider {
      width: 100%;
      accent-color: #FF3C97;
      cursor: pointer;
    }

    .slider-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.72rem;
      color: #9ca3af;
      margin-top: 0.15rem;
    }

    .schedule-preview {
      font-size: 0.82rem;
      color: #374151;
      background: #f0fdf4;
      border: 1px solid #6ee7b7;
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
      margin-top: 0.5rem;
    }

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
export class RegisterStepDetailsComponent implements OnInit {
    private readonly registerService = inject(RegisterService);
    private readonly router = inject(Router);
    private readonly fb = inject(FormBuilder);

    readonly allDays = ALL_DAYS;
    readonly dayLabel = (d: string) => DAY_LABELS[d] ?? d;
    readonly unitTypes = UNIT_TYPES;

    private selectedDays: string[] = [];
    private selectedUnitTypes: string[] = [];

    readonly commerceType = computed<CommerceType | null>(() => this.registerService.registrationData().commerce_type);

    readonly schedulePreview = computed(() => {
        if (!this.selectedDays.length) return '';
        const open = this.form?.value.opening_time ?? '';
        const close = this.form?.value.closing_time ?? '';
        const days = this.selectedDays.map(d => DAY_LABELS[d] ?? d).join(', ');
        return open && close ? `✓ Abierto ${days} de ${open} a ${close}` : `✓ Días: ${days}`;
    });

    readonly form = this.fb.group({
        opening_time: ['08:00', Validators.required],
        closing_time: ['22:00', Validators.required],
        avg_delivery_minutes: [30, [Validators.required, Validators.min(15)]],
        min_order_amount: [0, [Validators.required, Validators.min(0)]],
        free_delivery_enabled: [false],
        free_delivery_threshold: [0],
        // farmacia
        requires_prescription: [false],
        urgent_delivery: [false],
        // ropa
        handles_sizes: [false],
        handles_colors: [false],
        return_policy: [''],
        sells_secondhand: [false],
        // electronica
        offers_warranty: [false],
        // bodega/colmado/supermercado
        realtime_inventory: [false],
    });

    ngOnInit(): void {
        const draft = this.registerService.registrationData();
        if (!draft.name) {
            this.router.navigate(['/register/info']);
            return;
        }

        this.selectedDays = [...draft.open_days];
        this.selectedUnitTypes = [...(draft.unit_types ?? [])];

        this.form.patchValue({
            opening_time: draft.opening_time,
            closing_time: draft.closing_time,
            avg_delivery_minutes: draft.avg_delivery_minutes,
            min_order_amount: draft.min_order_amount,
            free_delivery_enabled: draft.free_delivery_enabled,
            free_delivery_threshold: draft.free_delivery_threshold,
            requires_prescription: draft.requires_prescription ?? false,
            urgent_delivery: draft.urgent_delivery ?? false,
            handles_sizes: draft.handles_sizes ?? false,
            handles_colors: draft.handles_colors ?? false,
            return_policy: draft.return_policy ?? '',
            sells_secondhand: draft.sells_secondhand ?? false,
            offers_warranty: draft.offers_warranty ?? false,
            realtime_inventory: draft.realtime_inventory ?? false,
        });
    }

    isDaySelected(day: string): boolean {
        return this.selectedDays.includes(day);
    }

    toggleDay(day: string): void {
        if (this.isDaySelected(day)) {
            this.selectedDays = this.selectedDays.filter(d => d !== day);
        } else {
            this.selectedDays = [...this.selectedDays, day];
        }
    }

    isUnitTypeSelected(u: string): boolean { return this.selectedUnitTypes.includes(u); }

    toggleUnitType(u: string): void {
        if (this.isUnitTypeSelected(u)) {
            this.selectedUnitTypes = this.selectedUnitTypes.filter(x => x !== u);
        } else {
            this.selectedUnitTypes = [...this.selectedUnitTypes, u];
        }
    }

    next(): void {
        if (this.form.invalid) return;
        const v = this.form.value;
        this.registerService.update({
            opening_time: v.opening_time ?? '08:00',
            closing_time: v.closing_time ?? '22:00',
            open_days: this.selectedDays,
            avg_delivery_minutes: v.avg_delivery_minutes ?? 30,
            min_order_amount: v.min_order_amount ?? 0,
            free_delivery_enabled: v.free_delivery_enabled ?? false,
            free_delivery_threshold: v.free_delivery_threshold ?? 0,
            requires_prescription: v.requires_prescription ?? false,
            urgent_delivery: v.urgent_delivery ?? false,
            handles_sizes: v.handles_sizes ?? false,
            handles_colors: v.handles_colors ?? false,
            return_policy: v.return_policy ?? undefined,
            sells_secondhand: v.sells_secondhand ?? false,
            offers_warranty: v.offers_warranty ?? false,
            realtime_inventory: v.realtime_inventory ?? false,
            unit_types: this.selectedUnitTypes,
        });
        this.router.navigate(['/register/account']);
    }

    back(): void {
        this.router.navigate(['/register/info']);
    }
}
