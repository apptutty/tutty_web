import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { OperatorAdminService } from './operator-admin.service';

interface NavItem {
    emoji: string;
    label: string;
    path: string;
    badge?: boolean;
}

const NAV_ITEMS: NavItem[] = [
    { emoji: '📊', label: 'Dashboard', path: 'dashboard' },
    { emoji: '🧭', label: 'Mis Excursiones', path: 'excursions' },
    { emoji: '📅', label: 'Reservas', path: 'bookings', badge: true },
    { emoji: '🗓️', label: 'Calendario', path: 'calendar' },
    { emoji: '📈', label: 'Reportes', path: 'reports' },
    { emoji: '⚙️', label: 'Perfil y Config', path: 'settings' },
];

@Component({
    selector: 'app-operator-shell',
    standalone: true,
    imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
    template: `
  <div class="shell-layout">

    <!-- Mobile overlay -->
    @if (isMobileOpen()) {
      <div class="mobile-overlay" (click)="isMobileOpen.set(false)"></div>
    }

    <!-- Sidebar -->
    <aside class="sidebar" [class.open]="isMobileOpen()">
      <div class="sidebar-header">
        <div class="brand">
          <span class="brand-icon">🗺️</span>
          <span class="brand-name">Tutty Tours</span>
        </div>
        <button class="close-btn" (click)="isMobileOpen.set(false)">✕</button>
      </div>

      <!-- Operator selector (if multiple) -->
      @if (svc.operators().length > 1) {
        <div class="operator-selector">
          <select (change)="switchOperator($event)">
            @for (op of svc.operators(); track op.id) {
              <option [value]="op.id" [selected]="op.id === svc.activeOperatorId()">{{ op.name }}</option>
            }
          </select>
        </div>
      } @else if (svc.activeOperator()) {
        <div class="active-operator-label">
          @if (svc.activeOperator()!.logo_url) {
            <img [src]="svc.activeOperator()!.logo_url!" alt="Logo" class="op-logo" />
          } @else {
            <span class="op-logo-placeholder">🏢</span>
          }
          <div>
            <p class="op-name">{{ svc.activeOperator()!.name }}</p>
            <p class="op-category">{{ svc.activeOperator()!.category ?? '' }}</p>
          </div>
        </div>
      }

      <!-- Nav -->
      <nav class="sidebar-nav">
        @for (item of navItems; track item.path) {
          <a [routerLink]="item.path" routerLinkActive="active" class="nav-item">
            <span class="nav-emoji">{{ item.emoji }}</span>
            <span class="nav-label">{{ item.label }}</span>
            @if (item.badge && svc.pendingBookingsCount() > 0) {
              <span class="badge" [class.pulse]="true">{{ svc.pendingBookingsCount() }}</span>
            }
          </a>
        }
      </nav>

      <div class="sidebar-footer">
        <button class="logout-btn" (click)="logout()">🚪 Cerrar sesión</button>
      </div>
    </aside>

    <!-- Main area -->
    <div class="main-area">
      <!-- Topbar -->
      <header class="topbar">
        <button class="burger-btn" (click)="isMobileOpen.set(true)">☰</button>
        <h1 class="topbar-title">Panel de Operador</h1>
        <div class="topbar-actions">
          @if (svc.pendingBookingsCount() > 0) {
            <div class="notif-chip" [routerLink]="'bookings'">
              📅 {{ svc.pendingBookingsCount() }} reserva{{ svc.pendingBookingsCount() !== 1 ? 's' : '' }} pendiente{{ svc.pendingBookingsCount() !== 1 ? 's' : '' }}
            </div>
          }
          <div class="user-chip">
            <span class="user-avatar">👤</span>
            <span class="user-name">{{ auth.currentUser()?.full_name ?? 'Operador' }}</span>
          </div>
        </div>
      </header>

      <!-- Page content -->
      <main class="page-content">
        <router-outlet />
      </main>
    </div>
  </div>
  `,
    styles: [`
    :host { display:block; height:100vh; overflow:hidden; }
    .shell-layout { display:flex; height:100vh; background:#f9fafb; font-family:Inter,system-ui,sans-serif; overflow:hidden; }
    .mobile-overlay { position:fixed; inset:0; z-index:20; background:rgba(0,0,0,.45); backdrop-filter:blur(3px); }

    /* Sidebar */
    .sidebar { width:240px; min-width:240px; background:white; border-right:1px solid #e5e7eb; display:flex; flex-direction:column; z-index:30; transition:transform .25s ease; }
    @media (max-width:1023px) {
      .sidebar { position:fixed; top:0; left:0; bottom:0; transform:translateX(-100%); }
      .sidebar.open { transform:translateX(0); }
    }

    .sidebar-header { display:flex; align-items:center; justify-content:space-between; padding:.9rem 1rem; border-bottom:1px solid #f3f4f6; }
    .brand { display:flex; align-items:center; gap:.5rem; }
    .brand-icon { font-size:1.4rem; }
    .brand-name { font-size:.9rem; font-weight:700; color:#111827; }
    .close-btn { background:none; border:none; cursor:pointer; font-size:1rem; color:#9ca3af; padding:4px; }
    @media (min-width:1024px) { .close-btn { display:none; } }

    .operator-selector { padding:.6rem .9rem; border-bottom:1px solid #f3f4f6; }
    .operator-selector select { width:100%; border:1px solid #e5e7eb; border-radius:8px; padding:.4rem .6rem; font-size:.8rem; outline:none; }
    .active-operator-label { display:flex; align-items:center; gap:.6rem; padding:.75rem 1rem; border-bottom:1px solid #f3f4f6; }
    .op-logo { width:36px; height:36px; border-radius:50%; object-fit:cover; border:2px solid #e5e7eb; }
    .op-logo-placeholder { font-size:1.5rem; }
    .op-name { font-size:.8rem; font-weight:600; color:#111827; margin:0; }
    .op-category { font-size:.7rem; color:#9ca3af; margin:0; }

    .sidebar-nav { display:flex; flex-direction:column; flex:1; padding:.5rem 0; overflow-y:auto; }
    .nav-item { display:flex; align-items:center; gap:.65rem; padding:.65rem 1rem; text-decoration:none; color:#4b5563; font-size:.875rem; font-weight:500; border-radius:0; transition:background .12s,color .12s; position:relative; }
    .nav-item:hover { background:#fdf2f8; color:#e91e8c; }
    .nav-item.active { background:#fdf2f8; color:#e91e8c; font-weight:600; border-right:3px solid #e91e8c; }
    .nav-emoji { font-size:1.1rem; width:22px; text-align:center; }
    .nav-label { flex:1; }
    .badge { background:#e91e8c; color:white; font-size:.68rem; font-weight:700; border-radius:999px; padding:1px 7px; min-width:18px; text-align:center; }
    .badge.pulse { animation:pulse-badge 1.5s ease-in-out infinite; }
    @keyframes pulse-badge { 0%,100%{opacity:1}50%{opacity:.6} }

    .sidebar-footer { padding:.75rem 1rem; border-top:1px solid #f3f4f6; }
    .logout-btn { width:100%; background:none; border:1px solid #e5e7eb; border-radius:8px; padding:.5rem; font-size:.8rem; color:#6b7280; cursor:pointer; }
    .logout-btn:hover { background:#fef2f2; color:#ef4444; border-color:#fca5a5; }

    /* Main */
    .main-area { flex:1; display:flex; flex-direction:column; overflow:hidden; }
    .topbar { display:flex; align-items:center; gap:.75rem; padding:0 1.25rem; height:56px; background:white; border-bottom:1px solid #e5e7eb; flex-shrink:0; }
    .burger-btn { background:none; border:none; cursor:pointer; font-size:1.2rem; color:#6b7280; padding:4px; }
    @media (min-width:1024px) { .burger-btn { display:none; } }
    .topbar-title { font-size:.95rem; font-weight:700; color:#111827; flex:1; margin:0; }
    .topbar-actions { display:flex; align-items:center; gap:.75rem; }
    .notif-chip { background:#fdf2f8; border:1px solid #f9a8d4; color:#e91e8c; border-radius:999px; padding:.3rem .75rem; font-size:.75rem; font-weight:600; cursor:pointer; }
    .user-chip { display:flex; align-items:center; gap:.4rem; background:#f9fafb; border:1px solid #e5e7eb; border-radius:999px; padding:.3rem .75rem; font-size:.8rem; }
    .user-avatar { font-size:1rem; }
    .user-name { color:#374151; font-weight:500; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

    .page-content { flex:1; overflow-y:auto; padding:1.5rem; }
  `],
})
export class OperatorShellComponent {
    readonly svc = inject(OperatorAdminService);
    readonly auth = inject(AuthService);
    private readonly router = inject(Router);

    readonly navItems = NAV_ITEMS;
    readonly isMobileOpen = signal(false);

    @HostListener('window:resize')
    onResize() {
        if (window.innerWidth >= 1024) this.isMobileOpen.set(false);
    }

    switchOperator(event: Event) {
        const id = (event.target as HTMLSelectElement).value;
        this.svc.setActiveOperator(id);
    }

    async logout() {
        await this.auth.signOut();
        this.router.navigate(['/login']);
    }
}
