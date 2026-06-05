import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { OperatorRegisterService } from '../operator-register.service';
import { AuthService } from '../../../core/auth/auth.service';

function passwordStrength(pass: string): 'weak' | 'medium' | 'strong' {
    if (pass.length < 6) return 'weak';
    const hasUpper = /[A-Z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecial = /[^A-Za-z0-9]/.test(pass);
    const score = [hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
    if (score >= 2 && pass.length >= 8) return 'strong';
    if (score >= 1 && pass.length >= 6) return 'medium';
    return 'weak';
}

function confirmPasswordValidator(control: AbstractControl): ValidationErrors | null {
    const parent = control.parent;
    if (!parent) return null;
    const password = parent.get('password')?.value as string;
    return control.value === password ? null : { mismatch: true };
}

@Component({
    selector: 'app-operator-step3',
    standalone: true,
    imports: [ReactiveFormsModule],
    template: `
  <div class="step-container">
    <div class="step-header">
      <h1>Crea tu cuenta de operador</h1>
      <p>Esta cuenta te permitirá gestionar tus excursiones en Tutty.</p>
    </div>

    @if (errorMessage()) {
      <div class="error-banner" role="alert">{{ errorMessage() }}</div>
    }

    @if (isAuthenticated()) {
      <div class="auth-card">
        <div class="auth-user-info">
          <div class="auth-avatar">👤</div>
          <div>
            <p class="auth-name">{{ currentUser()?.full_name }}</p>
            <p class="auth-email">{{ currentUser()?.email }}</p>
          </div>
        </div>
        <p class="auth-hint">Ya tienes sesión iniciada. El perfil de operador se asociará a tu cuenta actual.</p>
        <div class="summary-card">
          <h3>Resumen del perfil</h3>
          <dl class="summary-list">
            <dt>Operadora</dt><dd>{{ draft().name || '—' }}</dd>
            <dt>Categoría</dt><dd>{{ draft().category || '—' }}</dd>
            <dt>Excursión inicial</dt><dd>{{ draft().tour_enabled ? draft().tour_name || '—' : 'Sin excursión' }}</dd>
          </dl>
        </div>
        <div class="step-actions">
          <button type="button" class="btn-secondary" (click)="back()" [disabled]="submitting()">← Atrás</button>
          <button type="button" class="btn-primary" [disabled]="submitting()" (click)="submitAuthenticated()">
            @if (submitting()) { <span>Registrando…</span> } @else { <span>Registrar mi operadora 🚀</span> }
          </button>
        </div>
      </div>
    } @else {

    <form [formGroup]="form" (ngSubmit)="submit()" class="account-form">

      <div class="form-group">
        <label class="label" for="op3-name">Nombre completo *</label>
        <input id="op3-name" type="text" class="input-field" formControlName="full_name" placeholder="Ej. Juan Pérez" autocomplete="name" />
        @if (f['full_name'].touched && f['full_name'].errors?.['required']) {
          <span class="field-error">El nombre es requerido</span>
        }
      </div>

      <div class="form-group">
        <label class="label" for="op3-phone">Teléfono *</label>
        <input id="op3-phone" type="tel" class="input-field" formControlName="phone" placeholder="+1 809 000 0000" autocomplete="tel" />
        @if (f['phone'].touched && f['phone'].errors?.['required']) {
          <span class="field-error">El teléfono es requerido</span>
        }
      </div>

      <div class="form-group">
        <label class="label" for="op3-email">Correo electrónico *</label>
        <input id="op3-email" type="email" class="input-field" formControlName="email" placeholder="correo@ejemplo.com" autocomplete="email" />
        @if (f['email'].touched && f['email'].errors?.['required']) {
          <span class="field-error">El correo es requerido</span>
        }
        @if (f['email'].touched && f['email'].errors?.['email']) {
          <span class="field-error">Correo inválido</span>
        }
      </div>

      <div class="form-group">
        <label class="label" for="op3-pass">Contraseña *</label>
        <div class="password-wrapper">
          <input id="op3-pass" [type]="showPassword() ? 'text' : 'password'" class="input-field password-input"
            formControlName="password" placeholder="Mínimo 8 caracteres" autocomplete="new-password" />
          <button type="button" class="toggle-pass" (click)="showPassword.set(!showPassword())" tabindex="-1">
            {{ showPassword() ? '🙈' : '👁️' }}
          </button>
        </div>
        @if (f['password'].value) {
          <div class="strength-bar"><div class="strength-fill" [class]="strengthClass()"></div></div>
          <span class="strength-label" [class]="strengthClass()">Contraseña {{ strengthLabel() }}</span>
        }
        @if (f['password'].touched && f['password'].errors?.['required']) {
          <span class="field-error">La contraseña es requerida</span>
        }
        @if (f['password'].touched && f['password'].errors?.['minlength']) {
          <span class="field-error">Mínimo 8 caracteres</span>
        }
      </div>

      <div class="form-group">
        <label class="label" for="op3-confirm">Confirmar contraseña *</label>
        <input id="op3-confirm" [type]="showPassword() ? 'text' : 'password'" class="input-field"
          formControlName="confirm_password" placeholder="Repite tu contraseña" autocomplete="new-password" />
        @if (f['confirm_password'].touched && f['confirm_password'].errors?.['mismatch']) {
          <span class="field-error">Las contraseñas no coinciden</span>
        }
      </div>

      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" formControlName="accept_terms" />
          Acepto los <a href="#" class="link" target="_blank">Términos de servicio</a> y la <a href="#" class="link" target="_blank">Política de privacidad</a>
        </label>
        @if (f['accept_terms'].touched && f['accept_terms'].errors?.['required']) {
          <span class="field-error">Debes aceptar los términos para continuar</span>
        }
      </div>

      <div class="summary-card">
        <h3>Resumen del perfil</h3>
        <dl class="summary-list">
          <dt>Operadora</dt><dd>{{ draft().name || '—' }}</dd>
          <dt>Categoría</dt><dd>{{ draft().category || '—' }}</dd>
          <dt>Excursión inicial</dt><dd>{{ draft().tour_enabled ? (draft().tour_name || '—') : 'Sin excursión' }}</dd>
        </dl>
      </div>

      <div class="step-actions">
        <button type="button" class="btn-secondary" (click)="back()" [disabled]="submitting()">← Atrás</button>
        <button type="submit" class="btn-primary" [disabled]="form.invalid || submitting()">
          @if (submitting()) { <span>Registrando…</span> } @else { <span>Registrar mi operadora 🚀</span> }
        </button>
      </div>
    </form>

    }
  </div>
  `,
    styles: [`
    .step-container { max-width:520px; margin:0 auto; }
    .step-header { margin-bottom:2rem; }
    .step-header h1 { font-size:1.5rem; font-weight:700; color:#111827; margin:0 0 0.5rem; }
    .step-header p { color:#6b7280; font-size:0.9rem; margin:0; }
    .error-banner { background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:.75rem 1rem; color:#b91c1c; font-size:.875rem; margin-bottom:1.25rem; }
    .account-form { display:flex; flex-direction:column; gap:1.25rem; }
    .form-group { display:flex; flex-direction:column; gap:.4rem; }
    .label { font-size:.8rem; font-weight:600; color:#374151; }
    .password-wrapper { position:relative; }
    .password-input { padding-right:2.5rem; }
    .toggle-pass { position:absolute; right:.6rem; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; font-size:1rem; }
    .strength-bar { height:4px; background:#e5e7eb; border-radius:4px; overflow:hidden; margin-top:4px; }
    .strength-fill { height:100%; border-radius:4px; transition:width .2s,background .2s; }
    .strength-fill.weak { width:30%; background:#ef4444; }
    .strength-fill.medium { width:65%; background:#f59e0b; }
    .strength-fill.strong { width:100%; background:#10b981; }
    .strength-label { font-size:.72rem; }
    .strength-label.weak { color:#ef4444; }
    .strength-label.medium { color:#f59e0b; }
    .strength-label.strong { color:#10b981; }
    .field-error { font-size:.78rem; color:#ef4444; }
    .checkbox-label input { margin-top:2px; accent-color:#e91e8c; }
    .link { color:#e91e8c; text-decoration:none; }
    .summary-card { background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:1rem 1.25rem; }
    .summary-card h3 { margin:0 0 .75rem; font-size:.875rem; font-weight:600; color:#111827; }
    .summary-list { display:grid; grid-template-columns:auto 1fr; gap:.35rem .75rem; font-size:.875rem; margin:0; }
    .summary-list dt { color:#6b7280; font-weight:500; }
    .summary-list dd { color:#111827; font-weight:600; margin:0; }
    .auth-card { background:white; border:1px solid #e5e7eb; border-radius:16px; padding:1.5rem; }
    .auth-user-info { display:flex; align-items:center; gap:.75rem; margin-bottom:1rem; }
    .auth-avatar { font-size:2rem; }
    .auth-name { font-weight:600; color:#111827; margin:0; }
    .auth-email { font-size:.8rem; color:#6b7280; margin:0; }
    .auth-hint { font-size:.8rem; color:#6b7280; background:#f0fdf4; border-radius:8px; padding:.6rem .85rem; margin-bottom:1rem; }
    .step-actions { display:flex; justify-content:space-between; gap:.75rem; margin-top:1.5rem; }
  `],
})
export class OperatorStep3Component implements OnInit {
    private readonly svc = inject(OperatorRegisterService);
    private readonly auth = inject(AuthService);
    private readonly fb = inject(FormBuilder);
    private readonly router = inject(Router);

    readonly draft = this.svc.draft;
    readonly submitting = signal(false);
    readonly errorMessage = signal<string | null>(null);
    readonly showPassword = signal(false);

    readonly isAuthenticated = computed(() => !!this.auth.currentUser());
    readonly currentUser = computed(() => this.auth.currentUser());

    readonly form = this.fb.group({
        full_name: ['', Validators.required],
        phone: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirm_password: ['', [confirmPasswordValidator]],
        accept_terms: [false, Validators.requiredTrue],
    });

    get f() { return this.form.controls; }

    readonly strengthClass = computed(() => passwordStrength(this.f['password'].value ?? ''));
    readonly strengthLabel = computed(() => {
        const s = this.strengthClass();
        return s === 'weak' ? 'débil' : s === 'medium' ? 'media' : 'fuerte';
    });

    ngOnInit() {
        this.form.get('password')?.valueChanges.subscribe(() => {
            this.form.get('confirm_password')?.updateValueAndValidity();
        });
    }

    back() { this.router.navigate(['/register/operator/tours']); }

    async submitAuthenticated() {
        this.errorMessage.set(null);
        this.submitting.set(true);
        try {
            const result = await this.svc.submitRegistration();
            this.router.navigate([result.approved ? '/operator/dashboard' : '/register/operator/pending']);
        } catch (err: unknown) {
            this.errorMessage.set((err as Error).message ?? 'Error al registrar. Intenta de nuevo.');
        } finally {
            this.submitting.set(false);
        }
    }

    async submit() {
        this.form.markAllAsTouched();
        if (this.form.invalid) return;

        this.errorMessage.set(null);
        this.submitting.set(true);
        try {
            const v = this.form.value;
            this.svc.update({
                email: v['email']!,
                password: v['password']!,
                full_name: v['full_name']!,
                phone: v['phone']!,
            });
            const result = await this.svc.submitRegistration();
            this.router.navigate([result.approved ? '/operator/dashboard' : '/register/operator/pending']);
        } catch (err: unknown) {
            this.errorMessage.set((err as Error).message ?? 'Error al registrar. Intenta de nuevo.');
        } finally {
            this.submitting.set(false);
        }
    }
}
