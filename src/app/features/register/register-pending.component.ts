import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RegisterService } from './register.service';

type ScreenState = 'loading' | 'approved' | 'pending' | 'rejected';

@Component({
    selector: 'app-register-pending',
    standalone: true,
    imports: [RouterLink],
    template: `
    <div class="pending-container">
      @switch (state()) {
        @case ('loading') {
          <div class="state-card">
            <div class="spinner"></div>
            <p class="loading-text">Verificando el estado de tu solicitud…</p>
          </div>
        }

        @case ('approved') {
          <div class="state-card approved">
            <div class="state-icon">🎉</div>
            <h1>¡Tu comercio fue aprobado!</h1>
            <p>
              Estás listo para comenzar a vender en Tuttys. Configura tu catálogo,
              horarios y opciones de delivery desde tu panel de administración.
            </p>
            <a routerLink="/" class="btn-primary">Ir a mi panel →</a>
          </div>
        }

        @case ('pending') {
          <div class="state-card pending">
            <div class="state-icon">⏳</div>
            <h1>Solicitud en revisión</h1>
            <p>
              Nuestro equipo revisará tu información en las próximas
              <strong>24–48 horas hábiles</strong>. Te notificaremos por WhatsApp
              y correo electrónico cuando sea aprobada.
            </p>
            <div class="info-box">
              <dl class="info-list">
                <dt>Negocio</dt><dd>{{ draft().name || '—' }}</dd>
                <dt>Tipo</dt><dd>{{ draft().commerce_type || '—' }}</dd>
                <dt>Email</dt><dd>{{ draft().email || '—' }}</dd>
              </dl>
              <p class="info-close">Puedes cerrar esta ventana. Te contactaremos pronto.</p>
            </div>
            <button class="btn-outline" (click)="checkStatus()">
              Verificar estado
            </button>
          </div>
        }

        @case ('rejected') {
          <div class="state-card rejected">
            <div class="state-icon">❌</div>
            <h1>Solicitud rechazada</h1>
            <p>
              Lo sentimos, tu solicitud de registro no fue aprobada en esta ocasión.
            </p>
            @if (rejectionReason()) {
              <div class="rejection-box">
                <strong>Motivo:</strong>
                <p>{{ rejectionReason() }}</p>
              </div>
            }
            <p class="help-text">
              Si crees que hay un error o deseas más información, contáctanos al
              <a href="https://wa.me/18090000000" class="link" target="_blank">+1 809-000-0000</a>
              o escríbenos a <a href="mailto:soporte@tuttys.do" class="link">soporte@tuttys.do</a>.
            </p>
            <a routerLink="/register/info" class="btn-outline" (click)="startOver()">Editar y reenviar</a>
          </div>
        }
      }
    </div>
  `,
    styles: [`
    .pending-container {
      max-width: 520px;
      margin: 2rem auto;
      padding: 0 1rem;
    }

    .state-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      padding: 2.5rem 2rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .state-card.approved { border-color: #6ee7b7; background: #f0fdf4; }
    .state-card.rejected { border-color: #fca5a5; background: #fef2f2; }
    .state-card.pending  { border-color: #fde68a; background: #fffbeb; }

    .state-icon { font-size: 3.5rem; line-height: 1; }

    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #111827;
      margin: 0;
    }

    p {
      color: #4b5563;
      font-size: 0.9rem;
      line-height: 1.6;
      margin: 0;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e5e7eb;
      border-top-color: #FF3C97;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .loading-text { color: #6b7280; font-size: 0.9rem; }

    .info-box {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 1rem 1.25rem;
      text-align: left;
      width: 100%;
    }

    .info-list {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.3rem 1rem;
      font-size: 0.875rem;
      margin: 0 0 0.75rem;
    }

    .info-list dt { color: #9ca3af; }
    .info-list dd { color: #374151; font-weight: 500; margin: 0; text-transform: capitalize; }

    .info-close {
      font-size: 0.8rem;
      color: #6b7280;
      margin: 0;
      font-style: italic;
    }

    .rejection-box {
      background: white;
      border: 1px solid #fca5a5;
      border-radius: 10px;
      padding: 1rem;
      text-align: left;
      width: 100%;
    }

    .rejection-box strong { color: #b91c1c; font-size: 0.8rem; text-transform: uppercase; }
    .rejection-box p { margin-top: 0.35rem; color: #374151; font-size: 0.875rem; }

    .help-text { font-size: 0.85rem; }

    .btn-primary {
      display: inline-block;
      padding: 0.75rem 2rem;
      background: #FF3C97;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s;
    }

    .btn-primary:hover { background: #e6007a; }

    .btn-outline {
      display: inline-block;
      padding: 0.75rem 2rem;
      background: white;
      color: #374151;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s;
    }

    .btn-outline:hover { background: #f9fafb; }

    .link { color: #FF3C97; text-decoration: none; font-weight: 600; }
  `],
})
export class RegisterPendingComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly registerService = inject(RegisterService);

    readonly state = signal<ScreenState>('loading');
    readonly rejectionReason = signal<string | null>(null);
    readonly draft = this.registerService.registrationData;

    ngOnInit(): void {
        const params = this.route.snapshot.queryParamMap;
        const approved = params.get('approved');
        const restaurantId = params.get('id') ?? this.registerService.lastRestaurantId();

        if (approved === 'true') {
            this.state.set('approved');
            return;
        }

        if (restaurantId) {
            this.loadStatus(restaurantId);
        } else {
            this.state.set('pending');
        }
    }

    async checkStatus(): Promise<void> {
        const restaurantId = this.route.snapshot.queryParamMap.get('id') ?? this.registerService.lastRestaurantId();
        if (restaurantId) {
            this.state.set('loading');
            await this.loadStatus(restaurantId);
        }
    }

    private async loadStatus(restaurantId: string): Promise<void> {
        const data = await this.registerService.getMyStoreStatus(restaurantId);
        if (!data) {
            this.state.set('pending');
            return;
        }

        if (data.approval_status === 'aprobado') {
            this.state.set('approved');
        } else if (data.approval_status === 'rechazado') {
            this.state.set('rejected');
            this.rejectionReason.set(data.rejection_reason);
        } else {
            this.state.set('pending');
        }
    }

    startOver(): void {
        this.registerService.reset();
    }
}
