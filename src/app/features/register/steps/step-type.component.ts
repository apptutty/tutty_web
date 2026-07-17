import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RegisterService } from '../register.service';
import { CommerceType } from '../../../core/supabase/database.types';

interface CommerceOption {
    type: CommerceType;
    iconKey: string;
    label: string;
    desc: string;
}

const COMMERCE_OPTIONS: CommerceOption[] = [
    { type: 'restaurante', iconKey: 'restaurante', label: 'Restaurante', desc: 'Comida y bebidas para delivery' },
    { type: 'farmacia', iconKey: 'farmacia', label: 'Farmacia', desc: 'Medicamentos y cuidado personal' },
    { type: 'bodega', iconKey: 'bodega', label: 'Bodega', desc: 'Abarrotes y productos del hogar' },
    { type: 'colmado', iconKey: 'colmado', label: 'Colmado', desc: 'Bebidas, snacks y víveres' },
    { type: 'tienda_ropa', iconKey: 'tienda_ropa', label: 'Tienda de Ropa', desc: 'Moda, ropa y accesorios' },
    { type: 'electronica', iconKey: 'electronica', label: 'Electrónica', desc: 'Dispositivos y accesorios tecnológicos' },
    { type: 'supermercado', iconKey: 'supermercado', label: 'Supermercado', desc: 'Alimentos, limpieza y más' },
    { type: 'otro', iconKey: 'otro', label: 'Otro', desc: 'Otro tipo de comercio' },
];

@Component({
    selector: 'app-register-step-type',
    standalone: true,
    template: `
    <div class="step-container">
      <div class="step-header">
        <h1>¿Qué tipo de comercio tienes?</h1>
        <p>Selecciona la categoría que mejor describe tu negocio. Esto personaliza tu experiencia de registro.</p>
      </div>

      <div class="commerce-grid">
        @for (option of options; track option.type) {
          <button
            type="button"
            class="commerce-card"
            [class.selected]="selected === option.type"
            (click)="select(option.type)">
            <span class="card-icon" aria-hidden="true">
              @switch (option.iconKey) {
                @case ('restaurante') {
                  <svg viewBox="0 0 24 24" fill="none"><path d="M7 3v8M11 3v8M7 7h4M17 3v18M17 3c2.2 0 4 1.8 4 4v2h-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                }
                @case ('farmacia') {
                  <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" stroke-width="1.6"/></svg>
                }
                @case ('bodega') {
                  <svg viewBox="0 0 24 24" fill="none"><path d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" stroke="currentColor" stroke-width="1.8"/><path d="M9 8V6a3 3 0 1 1 6 0v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                }
                @case ('colmado') {
                  <svg viewBox="0 0 24 24" fill="none"><path d="M4 6h2l2 9h9l2-6H7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="19" r="1.5" fill="currentColor"/><circle cx="17" cy="19" r="1.5" fill="currentColor"/></svg>
                }
                @case ('tienda_ropa') {
                  <svg viewBox="0 0 24 24" fill="none"><path d="M9 5l3 2 3-2 3 3-2 3v8H8v-8L6 8l3-3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
                }
                @case ('electronica') {
                  <svg viewBox="0 0 24 24" fill="none"><rect x="7" y="3" width="10" height="18" rx="2.5" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="17.5" r="1" fill="currentColor"/></svg>
                }
                @case ('supermercado') {
                  <svg viewBox="0 0 24 24" fill="none"><path d="M3 11l9-7 9 7v8a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2v-8z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
                }
                @default {
                  <svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="15" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M8 5v4M16 5v4M4 10h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                }
              }
            </span>
            <span class="card-label">{{ option.label }}</span>
            <span class="card-desc">{{ option.desc }}</span>
            @if (selected === option.type) {
              <span class="check-badge" aria-hidden="true">
                <svg viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
            }
          </button>
        }
      </div>

      <div class="step-actions">
        <button
          type="button"
          class="btn-primary"
          [disabled]="!selected"
          (click)="next()">
          Continuar →
        </button>
      </div>
    </div>
  `,
    styles: [`
    .step-container { max-width: 720px; margin: 0 auto; }

    .step-header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .step-header h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #111827;
      margin: 0 0 0.5rem;
    }

    .step-header p {
      color: #6b7280;
      font-size: 0.9rem;
      margin: 0;
    }

    .commerce-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .commerce-card {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 1.25rem 1rem;
      background: white;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
      text-align: center;
    }

    .commerce-card:hover {
      border-color: #FF3C97;
      box-shadow: 0 2px 8px rgba(255,60,151,0.12);
      transform: translateY(-2px);
    }

    .commerce-card.selected {
      border-color: #FF3C97;
      background: #fff5f9;
      box-shadow: 0 2px 12px rgba(255,60,151,0.18);
    }

    .card-icon { width: 2rem; height: 2rem; color: #6b7280; line-height: 1; }
    .commerce-card.selected .card-icon { color: #FF3C97; }
    .card-icon svg { width: 100%; height: 100%; display: block; }

    .card-label {
      font-weight: 600;
      font-size: 0.875rem;
      color: #111827;
    }

    .card-desc {
      font-size: 0.75rem;
      color: #9ca3af;
      line-height: 1.3;
    }

    .check-badge {
      position: absolute;
      top: 8px;
      right: 10px;
      width: 14px;
      height: 14px;
      color: #FF3C97;
    }
    .check-badge svg { width: 100%; height: 100%; display: block; }

    .step-actions {
      display: flex;
      justify-content: flex-end;
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
      transition: background 0.15s;
    }

    .btn-primary:hover:not(:disabled) { background: #e6007a; }

    .btn-primary:disabled {
      background: #d1d5db;
      cursor: not-allowed;
    }
  `],
})
export class RegisterStepTypeComponent {
    private readonly registerService = inject(RegisterService);
    private readonly router = inject(Router);

    readonly options = COMMERCE_OPTIONS;
    selected: CommerceType | null = this.registerService.registrationData().commerce_type;

    select(type: CommerceType): void {
        this.selected = type;
    }

    next(): void {
        if (!this.selected) return;
        this.registerService.update({ commerce_type: this.selected });
        this.router.navigate(['/register/info']);
    }
}
