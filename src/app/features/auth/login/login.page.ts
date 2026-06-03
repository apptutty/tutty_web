import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
    selector: 'app-login-page',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    template: `
    <div class="min-h-screen bg-gray-50 flex font-inter">

      <!-- Left panel — brand illustration (hidden on mobile) -->
      <div class="hidden lg:flex lg:w-1/2 bg-gray-dark flex-col items-center justify-center p-12 relative overflow-hidden">
        <!-- Decorative circles -->
        <div class="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-brand-500/20"></div>
        <div class="absolute -bottom-16 -right-16 w-72 h-72 rounded-full bg-brand-600/15"></div>

        <div class="relative z-10 text-center">
          <div class="w-20 h-20 bg-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-theme-xl">
            <span class="text-white text-4xl font-bold">T</span>
          </div>
          <h2 class="text-3xl font-bold text-white mb-3">Tutty Admin</h2>
          <p class="text-gray-400 text-base max-w-xs mx-auto leading-relaxed">
            Panel de control para gestionar pedidos, restaurantes, excursiones y repartidores de la plataforma.
          </p>

          <!-- Feature list -->
          <div class="mt-10 space-y-3 text-left max-w-xs mx-auto">
            @for (feat of features; track feat.label) {
              <div class="flex items-center gap-3">
                <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center">
                  <svg class="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="feat.icon" />
                  </svg>
                </div>
                <span class="text-gray-300 text-sm">{{ feat.label }}</span>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Right panel — login form -->
      <div class="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 lg:p-12">
        <!-- Mobile logo -->
        <div class="lg:hidden text-center mb-8">
          <div class="inline-flex items-center justify-center w-14 h-14 bg-brand-500 rounded-2xl shadow-theme-md mb-3">
            <span class="text-white text-2xl font-bold">T</span>
          </div>
          <h1 class="text-2xl font-bold text-gray-800">Tutty Admin</h1>
        </div>

        <div class="w-full max-w-md">
          <div class="mb-8">
            <h2 class="text-2xl font-bold text-gray-800">Bienvenido de vuelta</h2>
            <p class="text-gray-500 mt-1.5 text-sm">Ingresa tus credenciales para acceder al panel</p>
          </div>

          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="space-y-5">
            <!-- Email -->
            <div>
              <label class="label" for="email">Correo electrónico</label>
              <div class="relative">
                <span class="absolute inset-y-0 left-3 flex items-center text-gray-400">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </span>
                <input
                  id="email"
                  type="email"
                  formControlName="email"
                  class="input-field pl-9"
                  placeholder="admin@tutty.do"
                  autocomplete="email"
                />
              </div>
              @if (loginForm.get('email')?.touched && loginForm.get('email')?.invalid) {
                <p class="mt-1.5 text-xs text-error-600">Ingresa un correo válido</p>
              }
            </div>

            <!-- Password -->
            <div>
              <label class="label" for="password">Contraseña</label>
              <div class="relative">
                <span class="absolute inset-y-0 left-3 flex items-center text-gray-400">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </span>
                <input
                  id="password"
                  type="password"
                  formControlName="password"
                  class="input-field pl-9"
                  placeholder="••••••••"
                  autocomplete="current-password"
                />
              </div>
              @if (loginForm.get('password')?.touched && loginForm.get('password')?.invalid) {
                <p class="mt-1.5 text-xs text-error-600">Mínimo 6 caracteres</p>
              }
            </div>

            <!-- Error message -->
            @if (errorMessage()) {
              <div class="rounded-lg bg-error-50 border border-error-200 p-3.5 flex items-start gap-3">
                <svg class="w-4 h-4 text-error-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
                <p class="text-sm text-error-700">{{ errorMessage() }}</p>
              </div>
            }

            <!-- Submit -->
            <button
              type="submit"
              class="btn-primary w-full justify-center py-3 text-base"
              [disabled]="isLoading() || loginForm.invalid"
            >
              @if (isLoading()) {
                <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Ingresando...
              } @else {
                Ingresar al panel
              }
            </button>
          </form>

          <p class="text-center text-gray-400 text-xs mt-8">
            © {{ currentYear }} Tutty · República Dominicana
          </p>
        </div>
      </div>
    </div>
  `,
})
export class LoginPageComponent {
    private readonly fb = inject(FormBuilder);
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);

    readonly currentYear = new Date().getFullYear();
    readonly isLoading = signal(false);
    readonly errorMessage = signal<string | null>(null);

    readonly features = [
        { label: 'Gestión de pedidos en tiempo real', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
        { label: 'Administración de restaurantes', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5' },
        { label: 'Reportes y estadísticas', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    ];

    readonly loginForm = this.fb.group({
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
    });

    async onSubmit(): Promise<void> {
        if (this.loginForm.invalid) return;

        this.isLoading.set(true);
        this.errorMessage.set(null);

        const { email, password } = this.loginForm.getRawValue();

        try {
            await this.authService.signIn(email!, password!);
            // Wait for the profile to load before navigating
            await new Promise<void>(resolve => {
                const check = () => {
                    if (!this.authService.isLoading()) { resolve(); return; }
                    setTimeout(check, 50);
                };
                check();
            });
            if (this.authService.isAuthenticated()) {
                await this.router.navigate(['/dashboard']);
            } else {
                this.errorMessage.set('No se encontró el perfil de usuario. Contacta al administrador.');
            }
        } catch (err: any) {
            this.errorMessage.set(
                err?.message === 'Invalid login credentials'
                    ? 'Correo o contraseña incorrectos'
                    : 'Error al iniciar sesión. Intenta de nuevo.'
            );
        } finally {
            this.isLoading.set(false);
        }
    }
}
