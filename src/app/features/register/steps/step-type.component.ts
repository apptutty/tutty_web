import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RegisterService } from '../register.service';
import { CommerceType } from '../../../core/supabase/database.types';

interface CommerceOption {
    type: CommerceType;
    icon: string;
    label: string;
    desc: string;
}

const COMMERCE_OPTIONS: CommerceOption[] = [
    { type: 'restaurante', icon: '🍽️', label: 'Restaurante', desc: 'Comida y bebidas para delivery' },
    { type: 'farmacia', icon: '💊', label: 'Farmacia', desc: 'Medicamentos y cuidado personal' },
    { type: 'bodega', icon: '📦', label: 'Bodega', desc: 'Abarrotes y productos del hogar' },
    { type: 'colmado', icon: '🛒', label: 'Colmado', desc: 'Bebidas, snacks y víveres' },
    { type: 'tienda_ropa', icon: '👗', label: 'Tienda de Ropa', desc: 'Moda, ropa y accesorios' },
    { type: 'electronica', icon: '📱', label: 'Electrónica', desc: 'Dispositivos y accesorios tecnológicos' },
    { type: 'supermercado', icon: '🏪', label: 'Supermercado', desc: 'Alimentos, limpieza y más' },
    { type: 'otro', icon: '🏬', label: 'Otro', desc: 'Otro tipo de comercio' },
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
            <span class="card-icon">{{ option.icon }}</span>
            <span class="card-label">{{ option.label }}</span>
            <span class="card-desc">{{ option.desc }}</span>
            @if (selected === option.type) {
              <span class="check-badge">✓</span>
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

    .card-icon { font-size: 2rem; line-height: 1; }

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
      font-size: 0.75rem;
      color: #FF3C97;
      font-weight: 700;
    }

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
