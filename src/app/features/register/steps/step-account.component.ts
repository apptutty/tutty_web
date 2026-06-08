import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RegisterService } from '../register.service';
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
    selector: 'app-register-step-account',
    standalone: true,
    imports: [ReactiveFormsModule],
    template: `
    <div class="step-container">
      <div class="step-header">
        <h1>Crea tu cuenta de administrador</h1>
        <p>Esta cuenta te permitirá gestionar tu comercio en Tuttys.</p>
      </div>

      @if (errorMessage()) {
        <div class="error-banner" role="alert">
          {{ errorMessage() }}
        </div>
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
          <p class="auth-hint">Ya tienes sesión iniciada. Al continuar, el comercio se asociará a tu cuenta actual.</p>
          <div class="summary-card">
            <h3>Resumen del registro</h3>
            <dl class="summary-list">
              <dt>Comercio</dt><dd>{{ draft().name || '—' }}</dd>
              <dt>Tipo</dt><dd>{{ draft().commerce_type || '—' }}</dd>
              <dt>Ciudad</dt><dd>{{ draft().city || '—' }}</dd>
            </dl>
          </div>
          <div class="step-actions">
            <button type="button" class="btn-secondary" (click)="back()" [disabled]="submitting()">← Atrás</button>
            <button type="button" class="btn-primary" [disabled]="submitting()" (click)="submitAuthenticated()">
              @if (submitting()) { <span>Registrando…</span> } @else { <span>Registrar mi comercio 🚀</span> }
            </button>
          </div>
        </div>
      } @else {

      <form [formGroup]="form" (ngSubmit)="submit()" class="account-form">

        <!-- Full name -->
        <div class="form-group">
          <label class="label" for="full_name">Nombre completo *</label>
          <input id="full_name" type="text" class="input-field" formControlName="full_name" placeholder="Ej. María García" autocomplete="name" />
          @if (f['full_name'].touched && f['full_name'].errors?.['required']) {
            <span class="field-error">El nombre es requerido</span>
          }
        </div>

        <!-- Phone -->
        <div class="form-group">
          <label class="label" for="phone">Teléfono de contacto *</label>
          <input id="phone" type="tel" class="input-field" formControlName="phone" placeholder="+1 809 000 0000" autocomplete="tel" />
          @if (f['phone'].touched && f['phone'].errors?.['required']) {
            <span class="field-error">El teléfono es requerido</span>
          }
        </div>

        <!-- Email -->
        <div class="form-group">
          <label class="label" for="email">Correo electrónico *</label>
          <input id="email" type="email" class="input-field" formControlName="email" placeholder="correo@ejemplo.com" autocomplete="email" />
          @if (f['email'].touched && f['email'].errors?.['required']) {
            <span class="field-error">El correo es requerido</span>
          }
          @if (f['email'].touched && f['email'].errors?.['email']) {
            <span class="field-error">Ingresa un correo válido</span>
          }
        </div>

        <!-- Password -->
        <div class="form-group">
          <label class="label" for="password">Contraseña *</label>
          <div class="password-wrapper">
            <input
              id="password"
              [type]="showPassword() ? 'text' : 'password'"
              class="input-field password-input"
              formControlName="password"
              placeholder="Mínimo 8 caracteres"
              autocomplete="new-password" />
            <button type="button" class="toggle-pass" (click)="showPassword.set(!showPassword())" tabindex="-1">
              {{ showPassword() ? '🙈' : '👁️' }}
            </button>
          </div>
          @if (f['password'].value) {
            <div class="strength-bar">
              <div class="strength-fill" [class]="strengthClass()"></div>
            </div>
            <span class="strength-label" [class]="strengthClass()">
              Contraseña {{ strengthLabel() }}
            </span>
          }
          @if (f['password'].touched && f['password'].errors?.['required']) {
            <span class="field-error">La contraseña es requerida</span>
          }
          @if (f['password'].touched && f['password'].errors?.['minlength']) {
            <span class="field-error">Mínimo 8 caracteres</span>
          }
        </div>

        <!-- Confirm password -->
        <div class="form-group">
          <label class="label" for="confirm">Confirmar contraseña *</label>
          <input id="confirm" [type]="showPassword() ? 'text' : 'password'" class="input-field" formControlName="confirm_password" placeholder="Repite tu contraseña" autocomplete="new-password" />
          @if (f['confirm_password'].touched && f['confirm_password'].errors?.['mismatch']) {
            <span class="field-error">Las contraseñas no coinciden</span>
          }
        </div>

        <!-- Terms -->
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" formControlName="accept_terms" />
            Acepto los <a href="#" class="link" target="_blank">Términos de servicio</a> y la <a href="#" class="link" target="_blank">Política de privacidad</a>
          </label>
          @if (f['accept_terms'].touched && f['accept_terms'].errors?.['required']) {
            <span class="field-error">Debes aceptar los términos para continuar</span>
          }
        </div>

        <!-- Summary preview -->
        <div class="summary-card">
          <h3>Resumen del registro</h3>
          <dl class="summary-list">
            <dt>Comercio</dt><dd>{{ draft().name || '—' }}</dd>
            <dt>Tipo</dt><dd>{{ draft().commerce_type || '—' }}</dd>
            <dt>Ciudad</dt><dd>{{ draft().city || '—' }}</dd>
          </dl>
        </div>

        <div class="step-actions">
          <button type="button" class="btn-secondary" (click)="back()" [disabled]="submitting()">← Atrás</button>
          <button type="submit" class="btn-primary" [disabled]="form.invalid || submitting()">
            @if (submitting()) {
              <span>Registrando…</span>
            } @else {
              <span>Registrar mi comercio 🚀</span>
            }
          </button>
        </div>
      </form>

      } <!-- end @else (not authenticated) -->
    </div>
  `,
    styles: [`
    .step-container { max-width: 520px; margin: 0 auto; }

    .step-header { margin-bottom: 2rem; }
    .step-header h1 { font-size: 1.5rem; font-weight: 700; color: #111827; margin: 0 0 0.5rem; }
    .step-header p { color: #6b7280; font-size: 0.9rem; margin: 0; }

    .account-form { display: flex; flex-direction: column; gap: 1.25rem; }

    .form-group { display: flex; flex-direction: column; gap: 0.4rem; }

    .field-error { font-size: 0.78rem; color: #ef4444; }

    .password-wrapper { position: relative; }

    .password-input { padding-right: 2.5rem !important; }

    .toggle-pass {
      position: absolute;
      right: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1rem;
      padding: 0;
    }

    .strength-bar {
      height: 4px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 0.25rem;
    }

    .strength-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s;
    }

    .strength-fill.weak   { width: 33%; background: #ef4444; }
    .strength-fill.medium { width: 66%; background: #f59e0b; }
    .strength-fill.strong { width: 100%; background: #10b981; }

    .strength-label { font-size: 0.75rem; }
    .strength-label.weak   { color: #ef4444; }
    .strength-label.medium { color: #f59e0b; }
    .strength-label.strong { color: #10b981; }

    .checkbox-label {
      display: flex;
      align-items: flex-start;
      gap: 0.6rem;
      font-size: 0.875rem;
      color: #374151;
      cursor: pointer;
    }

    .checkbox-label input[type="checkbox"] {
      width: 16px;
      height: 16px;
      margin-top: 1px;
      accent-color: #FF3C97;
      flex-shrink: 0;
    }

    .link { color: #FF3C97; text-decoration: none; font-weight: 600; }

    .summary-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 1rem;
    }

    .summary-card h3 {
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #9ca3af;
      margin: 0 0 0.75rem;
    }

    .summary-list {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.3rem 1rem;
      font-size: 0.875rem;
    }

    .summary-list dt { color: #9ca3af; }
    .summary-list dd { color: #111827; font-weight: 500; margin: 0; text-transform: capitalize; }

    .step-actions {
      display: flex;
      justify-content: space-between;
      margin-top: 0.5rem;
    }

    .auth-card {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .auth-user-info {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 1rem;
    }

    .auth-avatar { font-size: 2rem; }

    .auth-name {
      font-weight: 600;
      color: #111827;
      margin: 0;
      font-size: 0.95rem;
    }

    .auth-email {
      color: #6b7280;
      font-size: 0.82rem;
      margin: 0;
    }

    .auth-hint {
      font-size: 0.82rem;
      color: #6b7280;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 0.6rem 0.75rem;
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

    .btn-secondary:hover:not(:disabled) { background: #f9fafb; }
    .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }

    .error-banner {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
      border-radius: 10px;
      padding: 0.875rem 1rem;
      font-size: 0.875rem;
      line-height: 1.5;
      font-weight: 500;
    }
  `],
})
export class RegisterStepAccountComponent implements OnInit {
    private readonly registerService = inject(RegisterService);
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);
    private readonly fb = inject(FormBuilder);

    readonly submitting = signal(false);
    readonly errorMessage = signal<string | null>(null);
    readonly showPassword = signal(false);
    readonly draft = this.registerService.registrationData;
    readonly isAuthenticated = this.auth.isAuthenticated;
    readonly currentUser = this.auth.currentUser;

    readonly form = this.fb.group({
        full_name: ['', Validators.required],
        phone: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirm_password: ['', [Validators.required, confirmPasswordValidator]],
        accept_terms: [false, Validators.requiredTrue],
    });

    get f() { return this.form.controls; }

    readonly strengthClass = computed<'weak' | 'medium' | 'strong'>(() =>
        passwordStrength(this.form.controls['password'].value ?? '')
    );

    readonly strengthLabel = computed(() => {
        const s = this.strengthClass();
        return s === 'weak' ? 'débil' : s === 'medium' ? 'media' : 'fuerte';
    });

    ngOnInit(): void {
        const draft = this.registerService.registrationData();
        if (!draft.opening_time) {
            this.router.navigate(['/register/details']);
            return;
        }

        this.form.patchValue({
            full_name: draft.full_name,
            phone: draft.phone,
            email: draft.email,
        });

        // Re-validate confirm when password changes
        this.form.controls['password'].valueChanges.subscribe(() => {
            this.form.controls['confirm_password'].updateValueAndValidity();
        });
    }

    async submitAuthenticated(): Promise<void> {
        if (this.submitting()) return;
        const user = this.auth.currentUser();
        if (!user) return;

        this.submitting.set(true);
        this.errorMessage.set(null);
        try {
            const result = await this.registerService.submitRegistrationForExistingUser(user.id);
            this.router.navigate(['/register/pending'], { queryParams: { approved: result.approved, id: result.commerceId } });
        } catch (err: unknown) {
            const msg = err instanceof Error
                ? err.message
                : (err as any)?.message ?? 'Error al registrar.';
            this.errorMessage.set(msg);
        } finally {
            this.submitting.set(false);
        }
    }

    async submit(): Promise<void> {
        if (this.form.invalid || this.submitting()) return;

        const v = this.form.value;
        this.registerService.update({
            full_name: v.full_name ?? '',
            phone: v.phone ?? '',
            email: v.email ?? '',
            password: v.password ?? '',
        });

        this.submitting.set(true);
        this.errorMessage.set(null);

        try {
            const result = await this.registerService.submitRegistration();
            this.router.navigate(['/register/pending'], { queryParams: { approved: result.approved, id: result.commerceId } });
        } catch (err: unknown) {
            const msg = err instanceof Error
                ? err.message
                : (err as any)?.message ?? 'Error al registrar. Por favor intenta de nuevo.';
            this.errorMessage.set(msg);
        } finally {
            this.submitting.set(false);
        }
    }

    back(): void {
        this.router.navigate(['/register/details']);
    }
}
