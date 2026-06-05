import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OperatorRegisterService } from './operator-register.service';

type ScreenState = 'loading' | 'pending' | 'approved' | 'rejected';

@Component({
    selector: 'app-operator-pending',
    standalone: true,
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
          <h1>¡Bienvenido a Tutty Tours!</h1>
          <p>Tu perfil de operador fue aprobado. Puedes comenzar a publicar excursiones y gestionar reservas desde tu panel.</p>
          <button class="btn-primary" (click)="goPanel()">Ir a mi panel de operador →</button>
        </div>
      }
      @case ('pending') {
        <div class="state-card pending">
          <div class="state-icon">⏳</div>
          <h1>Tu perfil está en revisión</h1>
          <p>
            Nuestro equipo verificará tus credenciales turísticas en las próximas
            <strong>24–48 horas hábiles</strong>. Te notificaremos por WhatsApp y correo electrónico.
          </p>
          <div class="info-box">
            <dl class="info-list">
              <dt>Operadora</dt><dd>{{ svc.draft().name || '—' }}</dd>
              <dt>Categoría</dt><dd>{{ svc.draft().category || '—' }}</dd>
              <dt>Email</dt><dd>{{ svc.draft().email || '—' }}</dd>
            </dl>
            <p class="info-close">Puedes cerrar esta ventana. Te contactaremos pronto.</p>
          </div>
          <button class="btn-outline" (click)="checkStatus()">Verificar estado</button>
        </div>
      }
      @case ('rejected') {
        <div class="state-card rejected">
          <div class="state-icon">❌</div>
          <h1>Solicitud rechazada</h1>
          <p>Lo sentimos, tu solicitud no fue aprobada en esta ocasión.</p>
          <p class="help-text">
            Si crees que hay un error contáctanos al
            <a href="https://wa.me/18099000000" class="link" target="_blank">+1 809-900-0000</a>
            o escríbenos a <a href="mailto:soporte@tutty.do" class="link">soporte@tutty.do</a>.
          </p>
          <button class="btn-outline" (click)="restart()">Volver al inicio</button>
        </div>
      }
    }
  </div>
  `,
    styles: [`
    .pending-container { max-width:520px; margin:2rem auto; padding:0 1rem; }
    .state-card { background:white; border:1px solid #e5e7eb; border-radius:16px; padding:2.5rem 2rem; text-align:center; display:flex; flex-direction:column; align-items:center; gap:1rem; }
    .state-card.approved { border-color:#6ee7b7; background:#f0fdf4; }
    .state-card.rejected { border-color:#fca5a5; background:#fef2f2; }
    .state-card.pending { border-color:#fde68a; background:#fffbeb; }
    .state-icon { font-size:3.5rem; line-height:1; }
    h1 { font-size:1.5rem; font-weight:700; color:#111827; margin:0; }
    p { color:#4b5563; font-size:.9rem; line-height:1.6; margin:0; }
    .spinner { width:40px; height:40px; border:4px solid #f3f4f6; border-top-color:#e91e8c; border-radius:50%; animation:spin .7s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .loading-text { color:#6b7280; font-size:.9rem; }
    .info-box { background:rgba(255,255,255,.7); border:1px solid rgba(0,0,0,.08); border-radius:12px; padding:1rem 1.25rem; width:100%; text-align:left; }
    .info-list { display:grid; grid-template-columns:auto 1fr; gap:.4rem .75rem; font-size:.875rem; margin:0 0 .75rem; }
    .info-list dt { color:#6b7280; font-weight:500; }
    .info-list dd { color:#111827; font-weight:600; margin:0; }
    .info-close { font-size:.78rem; color:#9ca3af; margin:0; }
    .help-text a { color:#e91e8c; }
    .link { color:#e91e8c; text-decoration:none; }
  `],
})
export class OperatorPendingComponent implements OnInit {
    readonly svc = inject(OperatorRegisterService);
    private readonly router = inject(Router);
    readonly state = signal<ScreenState>('loading');

    ngOnInit() { this.checkStatus(); }

    async checkStatus() {
        this.state.set('loading');
        const id = this.svc.lastOperatorId();
        if (!id) { this.state.set('pending'); return; }
        try {
            const status = await this.svc.getOperatorStatus(id);
            if (!status) { this.state.set('pending'); return; }
            if (status['is_active']) { this.state.set('approved'); return; }
            const approval = (status as Record<string, unknown>)['approval_status'];
            this.state.set(approval === 'rechazado' ? 'rejected' : 'pending');
        } catch {
            this.state.set('pending');
        }
    }

    goPanel() { this.router.navigate(['/operator/dashboard']); }
    restart() { this.router.navigate(['/register/operator']); }
}
