import { Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet, RouterLink } from '@angular/router';

interface Step { index: number; label: string; }

const STEPS: Step[] = [
    { index: 0, label: 'Perfil' },
    { index: 1, label: 'Primera excursión' },
    { index: 2, label: 'Cuenta' },
];

@Component({
    selector: 'app-operator-register-shell',
    standalone: true,
    imports: [RouterOutlet, RouterLink],
    template: `
  <div class="register-shell">
    <header class="register-header">
      <a routerLink="/login" class="logo-link"><span class="logo-text">tuttys</span></a>
      <p class="register-tagline">Registro de operador turístico</p>
    </header>

    @if (activeStepIndex() >= 0) {
      <div class="progress-container">
        <div class="steps-track">
          @for (step of steps; track step.index) {
            <div class="step-item" [class.active]="step.index === activeStepIndex()" [class.done]="step.index < activeStepIndex()">
              <div class="step-bubble">
                @if (step.index < activeStepIndex()) {
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                } @else { {{ step.index + 1 }} }
              </div>
              <span class="step-label">{{ step.label }}</span>
            </div>
            @if (step.index < steps.length - 1) {
              <div class="step-connector" [class.done]="step.index < activeStepIndex()"></div>
            }
          }
        </div>
      </div>
    }

    <main class="register-content"><router-outlet /></main>

    <footer class="register-footer">
      <span>¿Ya tienes una cuenta? <a routerLink="/login">Inicia sesión</a></span>
    </footer>
  </div>
  `,
    styles: [`
    .register-shell { min-height:100vh; display:flex; flex-direction:column; background:#f8f9fc; }
    .register-header { display:flex; align-items:center; justify-content:space-between; padding:1.25rem 2rem; background:white; border-bottom:1px solid #e5e7eb; }
    .logo-link { text-decoration:none; }
    .logo-text { font-size:1.5rem; font-weight:800; color:#e91e8c; letter-spacing:-0.5px; }
    .register-tagline { font-size:0.875rem; color:#6b7280; margin:0; }
    .progress-container { background:white; border-bottom:1px solid #e5e7eb; padding:1.25rem 2rem; }
    .steps-track { display:flex; align-items:center; max-width:720px; margin:0 auto; }
    .step-item { display:flex; align-items:center; gap:0.5rem; flex-shrink:0; }
    .step-bubble { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:600; background:#e5e7eb; color:#9ca3af; transition:background 0.2s, color 0.2s; }
    .step-item.active .step-bubble { background:#e91e8c; color:white; }
    .step-item.done .step-bubble { background:#10b981; color:white; }
    .step-label { font-size:0.8rem; color:#9ca3af; white-space:nowrap; }
    .step-item.active .step-label { color:#111827; font-weight:600; }
    .step-item.done .step-label { color:#10b981; }
    .step-connector { flex:1; height:2px; background:#e5e7eb; margin:0 0.5rem; transition:background 0.2s; }
    .step-connector.done { background:#10b981; }
    .register-content { flex:1; padding:2rem 1rem; max-width:860px; width:100%; margin:0 auto; }
    .register-footer { text-align:center; padding:1.5rem; font-size:0.875rem; color:#6b7280; }
    .register-footer a { color:#e91e8c; font-weight:600; text-decoration:none; }
    @media (max-width:640px) {
      .register-header { padding:1rem; }
      .progress-container { padding:1rem; }
      .step-label { display:none; }
      .register-content { padding:1.5rem 1rem; }
    }
  `],
})
export class OperatorRegisterShellComponent {
    private readonly router = inject(Router);
    readonly steps = STEPS;

    readonly activeStepIndex = computed(() => {
        const url = this.router.url.split('?')[0];
        if (url.endsWith('/register/operator') || url.endsWith('/register/operator/')) return 0;
        if (url.includes('/register/operator/tours')) return 1;
        if (url.includes('/register/operator/account')) return 2;
        return -1;
    });
}
