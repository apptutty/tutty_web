import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OperatorAdminService } from '../operator-admin.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AppConfigService } from '../../../core/config/app-config.service';
import { OperatorProfileService, TeamMember } from '../operator-profile.service';
import { ExcursionOperatorNotifPrefs } from '../../../core/supabase/database.types';
import { ConfirmService } from '../../../shared/ui/modal/confirm.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';

type SettingsTab = 'perfil' | 'financiero' | 'notificaciones' | 'equipo';

@Component({
    selector: 'app-operator-settings',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">⚙️ Perfil y Configuración</h1>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      @for (tab of tabs; track tab.key) {
        <button class="tab-btn" [class.active]="activeTab() === tab.key" (click)="activeTab.set(tab.key)">
          {{ tab.label }}
        </button>
      }
    </div>

    <!-- ── PERFIL ─────────────────────────────────────────────────────────── -->
    @if (activeTab() === 'perfil') {
      <div class="card">
        @if (saving()) { <div class="banner-info">Guardando…</div> }

        <!-- Nombre y descripción -->
        <section class="form-section">
          <h3 class="section-title">Información general</h3>
          <div class="form-group">
            <label class="label">Nombre del operador *</label>
            <input class="input-field" type="text" [(ngModel)]="profile.name" />
          </div>
          <div class="form-group">
            <label class="label">Descripción</label>
            <textarea class="input-field textarea" rows="4" [(ngModel)]="profile.description"></textarea>
          </div>
          <div class="form-group">
            <label class="label">WhatsApp (con código de país)</label>
            <input class="input-field" type="text" [(ngModel)]="profile.whatsapp_number" placeholder="+1 809 000 0000" />
          </div>
          <div class="form-group">
            <label class="label">Dirección / punto de encuentro</label>
            <input class="input-field" type="text" [(ngModel)]="profile.address" />
          </div>
        </section>

        <!-- Categoría -->
        <section class="form-section">
          <h3 class="section-title">Categoría principal</h3>
          <div class="cat-grid">
            @for (cat of categories(); track cat.key) {
              <button class="cat-btn" [class.active]="profile.category === cat.key" (click)="profile.category = cat.key">
                {{ cat.icon }} {{ cat.label }}
              </button>
            }
          </div>
        </section>

        <!-- Idiomas -->
        <section class="form-section">
          <h3 class="section-title">Idiomas que ofrecen</h3>
          <div class="lang-chips">
            @for (lang of languageOptions(); track lang) {
              <button class="lang-chip" [class.active]="profileLanguages().includes(lang)" (click)="toggleLanguage(lang)">{{ lang }}</button>
            }
          </div>
        </section>

        <!-- Certificaciones -->
        <section class="form-section">
          <h3 class="section-title">Certificaciones</h3>
          <div class="toggle-row">
            <label class="label">Seguro de responsabilidad civil</label>
            <label class="toggle-switch">
              <input type="checkbox" [(ngModel)]="profile.has_insurance" />
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="toggle-row">
            <label class="label">Licencia de turismo</label>
            <label class="toggle-switch">
              <input type="checkbox" [(ngModel)]="profile.has_tourism_license" />
              <span class="toggle-track"></span>
            </label>
          </div>
          @if (profile.has_tourism_license) {
            <div class="form-group" style="margin-top:.75rem">
              <label class="label">Número de licencia</label>
              <input class="input-field" type="text" [(ngModel)]="profile.tourism_license_number" />
            </div>
          }
        </section>

        <!-- Logo + Banner -->
        <section class="form-section">
          <h3 class="section-title">Imágenes de marca</h3>
          <div class="media-grid">
            <div class="media-item">
              <p class="label">Logo</p>
              @if (profile.logo_url) {
                <img [src]="profile.logo_url" class="preview-img logo-preview" alt="Logo" />
              }
              <input type="file" accept="image/*" class="file-input" (change)="onLogoChange($event)" />
            </div>
            <div class="media-item">
              <p class="label">Banner / portada</p>
              @if (profile.banner_url) {
                <img [src]="profile.banner_url" class="preview-img banner-preview" alt="Banner" />
              }
              <input type="file" accept="image/*" class="file-input" (change)="onBannerChange($event)" />
            </div>
          </div>
        </section>

        <div class="form-footer">
          <button class="btn-primary" (click)="saveProfile()" [disabled]="saving()">
            {{ saving() ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </div>
    }

    <!-- ── FINANCIERO ─────────────────────────────────────────────────────── -->
    @if (activeTab() === 'financiero') {
      <div class="card">
        <section class="form-section">
          <h3 class="section-title">Comisión de la plataforma</h3>
          <p class="info-text">La comisión acordada con Tutty es:</p>
          <div class="commission-badge">{{ commissionRate() }}%</div>
          <p class="info-text muted">Sobre el ingreso bruto de cada reserva confirmada.</p>
        </section>

        <section class="form-section">
          <h3 class="section-title">Resumen financiero</h3>
          @if (finLoading()) { <p class="info-text">Cargando…</p> }
          @else {
            <div class="fin-stats">
              <div class="fin-stat">
                <p class="fin-label">Ingresos brutos</p>
                <p class="fin-value">RD$ {{ finStats().gross | number:'1.0-0' }}</p>
              </div>
              <div class="fin-stat">
                <p class="fin-label">Comisión ({{ commissionRate() }}%)</p>
                <p class="fin-value text-pink">– RD$ {{ finStats().commission | number:'1.0-0' }}</p>
              </div>
              <div class="fin-stat">
                <p class="fin-label">Neto estimado</p>
                <p class="fin-value">RD$ {{ finStats().net | number:'1.0-0' }}</p>
              </div>
            </div>
            <table class="fin-table">
              <thead><tr><th>Fecha</th><th>Cliente</th><th>Excursión</th><th>Bruto</th><th>Comisión</th><th>Neto</th></tr></thead>
              <tbody>
                @for (b of finBookings().slice(0,20); track b.id) {
                  <tr>
                    <td>{{ b.created_at.slice(0,10) }}</td>
                    <td>{{ b.clientName }}</td>
                    <td>{{ b.excursionName }}</td>
                    <td>RD$ {{ b.total | number:'1.0-0' }}</td>
                    <td class="text-pink">RD$ {{ (b.total * commissionRate() / 100) | number:'1.0-0' }}</td>
                    <td>RD$ {{ (b.total * (1 - commissionRate() / 100)) | number:'1.0-0' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
          <p class="info-text muted" style="margin-top:1rem">Para consultas sobre pagos: <a href="mailto:soporte@tutty.do">soporte@tutty.do</a></p>
        </section>
      </div>
    }

    <!-- ── NOTIFICACIONES ─────────────────────────────────────────────────── -->
    @if (activeTab() === 'notificaciones') {
      <div class="card">
        <section class="form-section">
          <h3 class="section-title">Alertas por WhatsApp</h3>
          <div class="toggle-row">
            <div>
              <p class="label">Nueva reserva</p>
              <p class="info-text muted" style="margin:0">Notificación al recibir una reserva</p>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" [(ngModel)]="notifPrefs.nuevaReservaWA" />
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="toggle-row">
            <div>
              <p class="label">Cancelación</p>
              <p class="info-text muted" style="margin:0">Cuando un cliente cancela</p>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" [(ngModel)]="notifPrefs.cancelacionWA" />
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="toggle-row">
            <div>
              <p class="label">Recordatorio día anterior</p>
              <p class="info-text muted" style="margin:0">Lista de pasajeros del día siguiente</p>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" [(ngModel)]="notifPrefs.recordatorioAnterior" />
              <span class="toggle-track"></span>
            </label>
          </div>
        </section>

        <section class="form-section">
          <h3 class="section-title">Número para notificaciones</h3>
          <p class="info-text muted">Puede ser diferente al número público del operador.</p>
          <div class="form-group">
            <label class="label">WhatsApp (con código de país)</label>
            <input class="input-field" type="text" [(ngModel)]="notifPrefs.notifWhatsapp" placeholder="+1 809 000 0000" />
          </div>
        </section>

        <div class="form-footer">
          <button class="btn-primary" (click)="saveNotifPrefs()" [disabled]="saving()">
            {{ saving() ? 'Guardando…' : 'Guardar preferencias' }}
          </button>
        </div>
      </div>
    }

    <!-- ── EQUIPO ──────────────────────────────────────────────────────────── -->
    @if (activeTab() === 'equipo') {
      <div class="card">
        <div class="card-header-row">
          <h3 class="section-title" style="margin:0">Administradores</h3>
          <button class="btn-primary btn-sm" (click)="inviteModal.set(true)">+ Invitar admin</button>
        </div>

        @if (teamLoading()) { <p class="info-text">Cargando equipo…</p> }
        @else if (teamMembers().length === 0) {
          <div class="empty-state">
            <p>👥</p><p>Solo tú tienes acceso por ahora.</p>
          </div>
        } @else {
          <div class="team-list">
            @for (member of teamMembers(); track member.id) {
              <div class="team-row">
                <div class="team-avatar">
                  @if (member.avatarUrl) { <img [src]="member.avatarUrl" alt="" /> }
                  @else { <span>{{ member.name.charAt(0).toUpperCase() }}</span> }
                </div>
                <div class="team-info">
                  <p class="team-name">{{ member.name }}</p>
                  <p class="team-email">{{ member.email }}</p>
                </div>
                <span class="team-role">{{ member.role }}</span>
                <button class="remove-btn" (click)="removeMember(member)">Quitar</button>
              </div>
            }
          </div>
        }
      </div>
    }

    <!-- Invite modal -->
    @if (inviteModal()) {
      <div class="modal-overlay" (click)="inviteModal.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3 class="modal-title">Invitar administrador</h3>
          <div class="form-group">
            <label class="label">Email *</label>
            <input class="input-field" type="email" [(ngModel)]="inviteEmail" placeholder="correo@ejemplo.com" />
          </div>
          <div class="form-group">
            <label class="label">Rol</label>
            <select class="input-field" [(ngModel)]="inviteRole">
              <option value="admin">Admin (acceso completo)</option>
              <option value="staff">Staff (solo lectura)</option>
            </select>
          </div>
          @if (inviteError()) { <p class="field-error">{{ inviteError() }}</p> }
          <div class="modal-actions">
            <button class="btn-secondary" (click)="inviteModal.set(false)">Cancelar</button>
            <button class="btn-primary" (click)="inviteMember()" [disabled]="saving()">
              {{ saving() ? 'Agregando…' : 'Agregar' }}
            </button>
          </div>
        </div>
      </div>
    }
  </div>
  `,
    styles: [`
    .page { max-width:900px; margin:0 auto; }
    .page-header { margin-bottom:1.25rem; }
    .page-title { font-size:1.5rem; font-weight:800; color:#111827; margin:0; }
    .tabs { display:flex; gap:.25rem; border-bottom:1px solid #e5e7eb; margin-bottom:1.5rem; }
    .tab-btn { background:none; border:none; padding:.6rem 1rem; font-size:.875rem; cursor:pointer; color:#6b7280; border-bottom:2px solid transparent; margin-bottom:-1px; }
    .tab-btn.active { color:#e91e8c; border-bottom-color:#e91e8c; font-weight:700; }
    .form-section { border-bottom:1px solid #f3f4f6; padding-bottom:1.25rem; margin-bottom:1.25rem; }
    .form-section:last-of-type { border-bottom:none; margin-bottom:0; padding-bottom:0; }
    .section-title { font-size:.875rem; font-weight:700; color:#111827; margin:0 0 1rem; }
    .textarea { resize:vertical; }
    .info-text { font-size:.8rem; color:#6b7280; margin:.25rem 0; }
    .muted { color:#9ca3af; }

    /* Categories */
    .cat-grid { display:flex; flex-wrap:wrap; gap:.5rem; }
    .cat-btn { background:white; border:1px solid #e5e7eb; border-radius:10px; padding:.4rem .85rem; font-size:.8rem; cursor:pointer; }
    .cat-btn.active { background:#e91e8c; border-color:#e91e8c; color:white; font-weight:600; }

    /* Languages */
    .lang-chips { display:flex; flex-wrap:wrap; gap:.4rem; }
    .lang-chip { background:#f9fafb; border:1px solid #e5e7eb; border-radius:999px; padding:.25rem .75rem; font-size:.775rem; cursor:pointer; }
    .lang-chip.active { background:#fce7f3; border-color:#e91e8c; color:#e91e8c; font-weight:600; }

    /* Toggle */
    .toggle-row { display:flex; align-items:center; justify-content:space-between; padding:.65rem 0; border-bottom:1px solid #f9fafb; }

    /* Media */
    .media-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
    @media(max-width:480px){ .media-grid { grid-template-columns:1fr; } }
    .preview-img { border-radius:10px; object-fit:cover; border:1px solid #e5e7eb; display:block; margin-bottom:.5rem; }
    .logo-preview { width:80px; height:80px; }
    .banner-preview { width:100%; height:80px; }
    .file-input { font-size:.75rem; color:#6b7280; }

    /* Footer */
    .form-footer { display:flex; justify-content:flex-end; margin-top:1.5rem; }

    /* Commission */
    .commission-badge { display:inline-block; background:#e91e8c; color:white; border-radius:999px; padding:.35rem 1.5rem; font-size:1.5rem; font-weight:800; margin:.5rem 0; }
    .fin-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; margin-bottom:1.25rem; }
    @media(max-width:600px){ .fin-stats { grid-template-columns:1fr; } }
    .fin-stat { background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:.85rem 1rem; }
    .fin-label { font-size:.72rem; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:.05em; margin:0 0 .35rem; }
    .fin-value { font-size:1.25rem; font-weight:800; color:#111827; margin:0; }
    .text-pink { color:#e91e8c; }
    .fin-table { width:100%; border-collapse:collapse; font-size:.75rem; }
    .fin-table th { background:#f9fafb; padding:.4rem .6rem; text-align:left; color:#9ca3af; font-weight:700; font-size:.68rem; text-transform:uppercase; }
    .fin-table td { padding:.45rem .6rem; border-bottom:1px solid #f3f4f6; color:#374151; }

    /* Team */
    .team-list { display:flex; flex-direction:column; gap:.5rem; }
    .team-row { display:flex; align-items:center; gap:.75rem; padding:.65rem .85rem; background:#f9fafb; border-radius:12px; }
    .team-avatar { width:36px; height:36px; border-radius:50%; background:#fce7f3; display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0; font-weight:700; color:#e91e8c; font-size:.875rem; }
    .team-avatar img { width:100%; height:100%; object-fit:cover; }
    .team-info { flex:1; }
    .team-name { font-size:.875rem; font-weight:600; color:#111827; margin:0; }
    .team-email { font-size:.75rem; color:#6b7280; margin:0; }
    .team-role { font-size:.72rem; background:#e5e7eb; border-radius:4px; padding:2px 7px; color:#374151; flex-shrink:0; }
    .remove-btn { background:white; border:1px solid #fca5a5; border-radius:8px; padding:.25rem .6rem; font-size:.72rem; color:#ef4444; cursor:pointer; flex-shrink:0; }
    .remove-btn:hover { background:#fee2e2; }

    /* Modal size override */
    .modal { max-width:400px; }
  `],
})
export class OperatorSettingsPageComponent implements OnInit {
    private readonly operatorSvc = inject(OperatorAdminService);
    private readonly authSvc = inject(AuthService);
    private readonly profileSvc = inject(OperatorProfileService);
    private readonly confirmSvc = inject(ConfirmService);
    private readonly toast = inject(ToastService);
    readonly configSvc = inject(AppConfigService);

    readonly activeTab = signal<SettingsTab>('perfil');
    readonly tabs: { key: SettingsTab; label: string }[] = [
        { key: 'perfil', label: '🏢 Perfil' },
        { key: 'financiero', label: '💰 Financiero' },
        { key: 'notificaciones', label: '🔔 Notificaciones' },
        { key: 'equipo', label: '👥 Equipo' },
    ];

    readonly categories = this.configSvc.categories;
    readonly languageOptions = this.configSvc.languages;

    // Perfil
    profile = {
        name: '', description: '', whatsapp_number: '', address: '',
        category: '', logo_url: '', banner_url: '',
        has_insurance: false, has_tourism_license: false, tourism_license_number: '',
        languages: [] as string[],
    };
    private logoFile: File | null = null;
    private bannerFile: File | null = null;
    private notifPrefsObj: ExcursionOperatorNotifPrefs = { nuevaReservaWA: true, cancelacionWA: true, recordatorioAnterior: true, notifWhatsapp: '' };

    readonly saving = signal(false);

    readonly profileLanguages = computed(() => this.profile.languages);

    // Notificaciones
    get notifPrefs() { return this.notifPrefsObj; }

    // Financiero
    readonly finLoading = signal(false);
    readonly commissionRate = signal(10);
    readonly finBookings = signal<{ id: string; created_at: string; clientName: string; excursionName: string; total: number }[]>([]);
    readonly finStats = computed(() => {
        const gross = this.finBookings().reduce((s, b) => s + b.total, 0);
        const rate = this.commissionRate() / 100;
        return { gross, commission: gross * rate, net: gross * (1 - rate) };
    });

    // Equipo
    readonly teamLoading = signal(false);
    readonly teamMembers = signal<TeamMember[]>([]);
    readonly inviteModal = signal(false);
    inviteEmail = '';
    inviteRole = 'admin';
    readonly inviteError = signal<string | null>(null);

    ngOnInit() {
        this.configSvc.load();
        this.loadProfile();
        this.loadFinanciero();
        this.loadTeam();
    }

    private async loadProfile() {
        const op = this.operatorSvc.activeOperator();
        if (!op) return;
        const data = await this.profileSvc.loadProfile(op.id);
        if (!data) return;
        Object.assign(this.profile, {
            name: data.name, description: data.description,
            whatsapp_number: data.whatsapp_number, address: data.address,
            category: data.category, logo_url: data.logo_url, banner_url: data.banner_url,
            has_insurance: data.has_insurance, has_tourism_license: data.has_tourism_license,
            tourism_license_number: data.tourism_license_number, languages: data.languages,
        });
        Object.assign(this.notifPrefsObj, data.notification_prefs);
        if (!this.notifPrefsObj.notifWhatsapp) this.notifPrefsObj.notifWhatsapp = op.whatsapp_number ?? '';
    }

    private async loadFinanciero() {
        const opId = this.operatorSvc.activeOperatorId();
        if (!opId) return;
        this.finLoading.set(true);
        try {
            this.commissionRate.set(this.configSvc.commissionRate());
            const rows = await this.profileSvc.loadFinancials(opId);
            this.finBookings.set(rows);
        } finally { this.finLoading.set(false); }
    }

    private async loadTeam() {
        const opId = this.operatorSvc.activeOperatorId();
        if (!opId) return;
        this.teamLoading.set(true);
        try {
            this.teamMembers.set(await this.profileSvc.loadTeam(opId));
        } finally { this.teamLoading.set(false); }
    }

    toggleLanguage(lang: string) {
        if (this.profile.languages.includes(lang)) {
            this.profile.languages = this.profile.languages.filter(l => l !== lang);
        } else {
            this.profile.languages = [...this.profile.languages, lang];
        }
    }

    onLogoChange(event: Event) {
        const f = (event.target as HTMLInputElement).files?.[0];
        if (f) { this.logoFile = f; this.profile.logo_url = URL.createObjectURL(f); }
    }

    onBannerChange(event: Event) {
        const f = (event.target as HTMLInputElement).files?.[0];
        if (f) { this.bannerFile = f; this.profile.banner_url = URL.createObjectURL(f); }
    }

    async saveProfile() {
        const op = this.operatorSvc.activeOperator();
        if (!op) return;
        this.saving.set(true);
        try {
            const { logo_url, banner_url } = await this.profileSvc.saveProfile(
                op.id, this.profile, this.logoFile, this.bannerFile, op.slug,
            );
            this.profile.logo_url = logo_url;
            this.profile.banner_url = banner_url;
            this.logoFile = null;
            this.bannerFile = null;
            await this.operatorSvc.loadUserOperators(this.authSvc.currentUser()?.id ?? '');
            this.toast.success('✔ Cambios guardados');
        } catch (e: unknown) {
            this.toast.error((e as Error).message ?? 'Error al guardar el perfil.');
        } finally { this.saving.set(false); }
    }

    async saveNotifPrefs() {
        const op = this.operatorSvc.activeOperator();
        if (!op) return;
        this.saving.set(true);
        try {
            await this.profileSvc.saveNotifPrefs(op.id, this.notifPrefsObj);
            this.toast.success('✔ Preferencias guardadas');
        } catch (e: unknown) {
            this.toast.error((e as Error).message ?? 'Error al guardar preferencias.');
        } finally { this.saving.set(false); }
    }

    async inviteMember() {
        const opId = this.operatorSvc.activeOperatorId();
        if (!opId || !this.inviteEmail.trim()) { this.inviteError.set('Ingresa un email válido.'); return; }
        this.saving.set(true); this.inviteError.set(null);
        try {
            await this.profileSvc.inviteMember(opId, this.inviteEmail, this.inviteRole);
            this.toast.success('✔ Administrador agregado');
            this.inviteEmail = '';
            this.inviteModal.set(false);
            await this.loadTeam();
        } catch (e: unknown) {
            this.inviteError.set((e as Error).message);
        } finally { this.saving.set(false); }
    }

    async removeMember(member: TeamMember) {
        const ok = await this.confirmSvc.confirm({
            title: `¿Quitar a ${member.name}?`,
            message: 'El usuario perderá acceso al panel de este operador.',
            danger: true, confirmText: 'Quitar',
        });
        if (!ok) return;
        await this.profileSvc.removeMember(member.id);
        await this.loadTeam();
    }
}
