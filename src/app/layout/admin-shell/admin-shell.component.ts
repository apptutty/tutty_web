import {
  Component, Input, Output, EventEmitter, signal, inject, computed,
  OnInit, OnDestroy, HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, filter } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ToastContainerComponent } from '../../shared/ui/toast/toast-container.component';
import { ConfirmModalComponent } from '../../shared/ui/modal/confirm-modal.component';
import { ApprovalQueueService } from '../../features/approvals/approval-queue.service';

interface NavItem {
  label: string;
  path: string;
  roles?: string[];
  svgPath: string;
  mobileLabel?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Mobile bottom-nav items (5 most important)
const MOBILE_NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', svgPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { label: 'Pedidos', path: '/orders', svgPath: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
  { label: 'Comercios', path: '/stores', svgPath: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { label: 'Aprob.', path: '/approvals', svgPath: 'M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z' },
  { label: 'Config.', path: '/settings', svgPath: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

const SUPER_ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', path: '/dashboard', roles: ['super_admin'], svgPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Pedidos', path: '/orders', roles: ['super_admin'], svgPath: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
      { label: 'Comercios', path: '/stores', roles: ['super_admin'], svgPath: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
      { label: 'Repartidores', path: '/couriers', roles: ['super_admin'], svgPath: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
      { label: 'Excursiones', path: '/excursions', roles: ['super_admin'], svgPath: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { label: 'Catálogos', path: '/catalog', roles: ['super_admin'], svgPath: 'M4 6.75A2.25 2.25 0 016.25 4.5h11.5A2.25 2.25 0 0120 6.75v10.5A2.25 2.25 0 0117.75 19.5H6.25A2.25 2.25 0 014 17.25V6.75zM8.25 8.25h7.5M8.25 12h7.5M8.25 15.75h4.5' },
      { label: 'Promociones', path: '/promotions', roles: ['super_admin'], svgPath: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Reportes', path: '/reports', roles: ['super_admin'], svgPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
      { label: 'Finanzas', path: '/finances', roles: ['super_admin'], svgPath: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { label: 'Aprobaciones', path: '/approvals', roles: ['super_admin'], svgPath: 'M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z' },
      { label: 'Soporte', path: '/support', roles: ['super_admin'], svgPath: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z' },
      { label: 'Auditoría', path: '/settings/auditoria', roles: ['super_admin'], svgPath: 'M9 12.75l2.25 2.25L15 9.75m6 2.25a8.966 8.966 0 01-5.84 8.394 2.25 2.25 0 01-1.31.126A8.966 8.966 0 013 12V6.873a2.25 2.25 0 011.522-2.137l6-2a2.25 2.25 0 011.456 0l6 2A2.25 2.25 0 0121 6.873V12z' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { label: 'Configuración', path: '/settings', roles: ['super_admin'], svgPath: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
      { label: 'Usuarios', path: '/settings/usuarios', roles: ['super_admin'], svgPath: 'M15 19.128a9.38 9.38 0 002.625.372c1.035 0 2.037-.165 2.976-.47M4.5 19.5a9.38 9.38 0 012.625-.372m0 0a9.373 9.373 0 015.25 0m-5.25 0a9.387 9.387 0 00-2.625.372m2.625-.372V17.25m5.25 1.878V17.25m0 1.878a9.386 9.386 0 012.625.372M9 7.5a3 3 0 116 0 3 3 0 01-6 0z' },
    ],
  },
];

@Component({
  selector: 'app-sidebar-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <div class="space-y-5">
      @for (group of visibleGroups(); track group.label) {
        <section>
          @if (!collapsed) {
            <p class="px-3 mb-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
              {{ group.label }}
            </p>
          }
          <ul class="space-y-1">
            @for (item of group.items; track item.path) {
              <li class="relative group">
                <a
                  [routerLink]="item.path"
                  routerLinkActive="bg-white/10 text-white border border-white/10"
                  [routerLinkActiveOptions]="{ exact: false }"
                  class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-gray-300 hover:bg-white/5 hover:text-white transition-colors text-sm font-medium border border-transparent"
                  [class.justify-center]="collapsed"
                  [class.px-0]="collapsed"
                  (click)="navClick.emit()"
                >
                  <span [class.mx-auto]="collapsed">
                    <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="item.svgPath" />
                    </svg>
                  </span>
                  @if (!collapsed) {
                    <span class="flex-1">{{ item.label }}</span>
                    @if (item.path === '/approvals' && pendingCount() > 0) {
                      <span class="flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-error-500 text-white text-[10px] font-bold">
                        {{ pendingCount() > 9 ? '9+' : pendingCount() }}
                      </span>
                    }
                  }
                  @if (collapsed && item.path === '/approvals' && pendingCount() > 0) {
                    <span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-error-500"></span>
                  }
                </a>
                @if (collapsed) {
                  <div class="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap
                              opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 shadow-lg">
                    {{ item.label }}
                    <div class="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800"></div>
                  </div>
                }
              </li>
            }
          </ul>
        </section>
      }
      @if (!collapsed) {
        <div class="mt-3 px-3">
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-[11px] font-semibold text-white border border-white/10">
            SUPER ADMIN
          </span>
        </div>
      } @else {
        <div class="px-1 flex justify-center">
          <span class="w-2 h-2 rounded-full bg-brand-500" title="SUPER ADMIN" aria-label="Super administrador" role="img"></span>
        </div>
      }
    </div>
  `,
})
export class SidebarNavComponent {
  @Input() collapsed = false;
  @Output() navClick = new EventEmitter<void>();
  private readonly authService = inject(AuthService);
  private readonly approvalService = inject(ApprovalQueueService);

  readonly visibleGroups = computed(() => {
    const role = this.authService.userRole();
    return SUPER_ADMIN_NAV_GROUPS
      .map(group => ({
        ...group,
        items: group.items.filter(item => !item.roles || (role && item.roles.includes(role))),
      }))
      .filter(group => group.items.length > 0);
  });

  readonly pendingCount = toSignal(
    this.approvalService.watchPending().pipe(map(list => list.length)),
    { initialValue: 0 }
  );
}

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="sticky top-0 z-10 flex-shrink-0 h-16 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
      <div class="flex items-center justify-between h-full px-4 md:px-6 gap-3">
        <!-- LEFT: Hamburger + Title -->
        <div class="flex items-center gap-3 min-w-0">
          <button
            class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            (click)="toggleSidebar.emit()"
            aria-label="Toggle sidebar"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div class="min-w-0 hidden sm:block">
            <h1 class="text-base font-semibold text-gray-800 truncate max-w-[260px]">{{ pageTitle }}</h1>
          </div>
        </div>

        <!-- CENTER: status + global search -->
        <div class="hidden lg:flex items-center gap-2 min-w-0">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-50 text-success-700 border border-success-200 text-xs font-semibold">
            <span class="w-1.5 h-1.5 rounded-full bg-success-500"></span>
            Plataforma operativa
          </span>
          <a routerLink="/catalog/search" class="admin-btn admin-btn--secondary text-xs py-1.5 px-3">
            Buscar en catálogo
          </a>
        </div>

        <!-- RIGHT: Notifications + Avatar -->
        <div class="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <!-- Notifications -->
          <button
            aria-label="Notificaciones"
            class="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            @if (notificationCount() > 0) {
              <span class="absolute top-1 right-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-brand-500 text-[10px] text-white font-bold">
                {{ notificationCount() > 9 ? '9+' : notificationCount() }}
              </span>
            }
          </button>

          <!-- Avatar dropdown -->
          <div class="relative">
            <button
              class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px]"
              (click)="dropdownOpen.update(v => !v)"
              aria-label="Abrir menú de usuario"
            >
              <div class="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                {{ initials() }}
              </div>
              <div class="hidden xl:block text-left">
                <p class="text-sm font-medium text-gray-800 leading-none truncate max-w-[120px]">{{ authService.currentUser()?.full_name }}</p>
                <p class="text-xs text-gray-500 mt-0.5">{{ roleLabel() }}</p>
              </div>
              <svg class="w-4 h-4 text-gray-400 hidden xl:block" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            @if (dropdownOpen()) {
              <!-- Click-outside overlay -->
              <div class="fixed inset-0 z-40" (click)="dropdownOpen.set(false)"></div>
              <div class="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-theme-lg border border-gray-200 py-2 z-50">
                <div class="px-4 py-2.5 border-b border-gray-100">
                  <p class="text-sm font-semibold text-gray-800 truncate">{{ authService.currentUser()?.full_name }}</p>
                  <p class="text-xs text-gray-500 truncate mt-0.5">{{ authService.currentUser()?.email }}</p>
                  <p class="text-xs text-brand-500 font-medium mt-0.5">{{ roleLabel() }}</p>
                </div>
                <button
                  class="w-full text-left px-4 py-2.5 text-sm text-error-600 hover:bg-error-50 transition-colors flex items-center gap-2"
                  (click)="authService.signOut()"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                  </svg>
                  Cerrar sesión
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    </header>
  `,
})
export class TopbarComponent {
  @Input() isSidebarOpen = true;
  @Input() pageTitle = '';
  @Output() toggleSidebar = new EventEmitter<void>();
  readonly authService = inject(AuthService);
  private readonly approvalService = inject(ApprovalQueueService);
  readonly dropdownOpen = signal(false);
  readonly notificationCount = toSignal(
    this.approvalService.watchPending().pipe(map(list => list.length)),
    { initialValue: 0 }
  );
  readonly initials = computed(() => {
    const name = this.authService.currentUser()?.full_name ?? '';
    return name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase()).join('');
  });
  readonly roleLabel = computed(() => {
    const roleMap: Record<string, string> = {
      super_admin: 'Super Admin',
      restaurant_admin: 'Admin Restaurante',
      excursion_operator: 'Admin Operadora',
    };
    return roleMap[this.authService.userRole() ?? ''] ?? '';
  });
}

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ToastContainerComponent, ConfirmModalComponent, SidebarNavComponent, TopbarComponent],
  template: `
    <div class="flex h-screen bg-[color:var(--admin-bg)] overflow-hidden font-inter">

      <!-- Mobile overlay (< lg) -->
      @if (mobileOpen()) {
        <div class="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm lg:hidden"
             (click)="mobileOpen.set(false)"></div>
      }

      <!-- Sidebar -->
      <aside
        class="flex-shrink-0 flex flex-col bg-[color:var(--admin-sidebar)] transition-all duration-300 z-30 no-scrollbar overflow-hidden border-r border-white/10"
        [class]="sidebarAsideClass()"
      >
        <!-- Logo header -->
        <div class="flex items-center gap-3 px-4 py-5 border-b border-white/10 flex-shrink-0">
          <div class="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center shadow-theme-sm"
            style="background: linear-gradient(135deg, #FF3C97 0%, #6B2059 100%);">
            <svg viewBox="0 0 24 24" class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.5 2h11a1 1 0 01.894 1.447l-1.5 3A1 1 0 0116 7H8a1 1 0 01-.894-.553l-1.5-3A1 1 0 016.5 2z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 11h18M5 7l-2 14h18L19 7"/>
              <circle cx="9" cy="18" r="1" fill="currentColor"/>
              <circle cx="15" cy="18" r="1" fill="currentColor"/>
            </svg>
          </div>
          @if (sidebarExpanded()) {
            <div class="flex-1 min-w-0">
              <span class="font-bold text-base tracking-tight leading-none" style="background: linear-gradient(90deg, #FF3C97, #FFC107); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Tutty</span>
              <span class="block text-gray-400 text-xs">Admin Panel</span>
            </div>
            <!-- Close button (mobile only) -->
            <button class="lg:hidden text-gray-400 hover:text-white p-1 ml-auto flex-shrink-0"
                    (click)="mobileOpen.set(false)" aria-label="Cerrar menú">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
            <!-- Collapse button (desktop/tablet) -->
            <button class="hidden lg:block text-gray-400 hover:text-white p-1 ml-auto flex-shrink-0"
                    (click)="toggleDesktopCollapse()" aria-label="Colapsar sidebar">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
              </svg>
            </button>
          } @else {
            <!-- Expand button when collapsed -->
            <button class="text-gray-400 hover:text-white p-1 mx-auto"
                    (click)="toggleDesktopCollapse()" aria-label="Expandir sidebar">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
              </svg>
            </button>
          }
        </div>

        <!-- Nav -->
        <nav class="flex-1 overflow-y-auto py-4 px-3 no-scrollbar">
          <app-sidebar-nav [collapsed]="!sidebarExpanded()" (navClick)="onNavClick()" />
        </nav>

        <!-- User bottom -->
        @if (authService.currentUser()) {
          <div class="border-t border-white/10 px-3 py-3 flex-shrink-0">
            <div class="flex items-center gap-3 rounded-lg hover:bg-white/5 p-2 transition-colors"
                 [class.justify-center]="!sidebarExpanded()">
              <div class="flex-shrink-0 w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-semibold">
                {{ initials() }}
              </div>
              @if (sidebarExpanded()) {
                <div class="flex-1 min-w-0">
                  <p class="text-white text-xs font-medium truncate">{{ authService.currentUser()!.full_name }}</p>
                  <p class="text-gray-400 text-xs truncate">{{ roleLabel() }}</p>
                </div>
              }
            </div>
          </div>
        }
      </aside>

      <!-- Main content -->
      <div class="flex-1 flex flex-col overflow-hidden min-w-0">
        <app-topbar
          [isSidebarOpen]="sidebarExpanded()"
          [pageTitle]="currentPageTitle()"
          (toggleSidebar)="onToggleSidebar()"
        />
        <main class="flex-1 overflow-y-auto admin-page pb-20 sm:pb-6">
          <router-outlet />
        </main>
      </div>
    </div>

    <!-- Bottom Navigation Bar (mobile only, < sm) -->
    <nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 sm:hidden z-20 safe-bottom">
      <div class="grid grid-cols-5 h-16">
        @for (item of mobileNavItems; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="text-brand-500"
            [routerLinkActiveOptions]="{ exact: false }"
            class="flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-brand-500 transition-colors active:scale-95 min-h-[44px]"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="item.svgPath" />
            </svg>
            <span class="text-[10px] font-medium leading-none">{{ item.label }}</span>
          </a>
        }
      </div>
    </nav>

    <app-toast-container />
    <app-confirm-modal />
  `,
})
export class AdminShellComponent implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Responsive state
  readonly mobileOpen = signal(false);         // sidebar open on mobile overlay
  readonly desktopCollapsed = signal(false);   // sidebar collapsed on lg+

  // Window width tracking
  private windowWidth = signal(window.innerWidth);

  @HostListener('window:resize')
  onResize() { this.windowWidth.set(window.innerWidth); }

  readonly isMobile = computed(() => this.windowWidth() < 640);
  readonly isTablet = computed(() => this.windowWidth() >= 640 && this.windowWidth() < 1024);
  readonly isDesktop = computed(() => this.windowWidth() >= 1024);

  // Whether the sidebar should show expanded (with labels)
  readonly sidebarExpanded = computed(() => {
    if (this.isDesktop()) return !this.desktopCollapsed();
    if (this.isTablet()) return false; // tablet: always icon-only
    return this.mobileOpen();          // mobile: only when open
  });

  // The aside element classes
  readonly sidebarAsideClass = computed(() => {
    if (this.isMobile()) {
      // Mobile: fixed overlay, slide in/out
      return this.mobileOpen()
        ? 'fixed left-0 top-0 bottom-0 w-64'
        : 'fixed left-0 top-0 bottom-0 w-0';
    }
    if (this.isTablet()) {
      // Tablet: always visible icon-only strip (64px)
      return 'relative w-16';
    }
    // Desktop: relative, full or collapsed
    return this.desktopCollapsed() ? 'relative w-16' : 'relative w-64';
  });

  readonly mobileNavItems = MOBILE_NAV_ITEMS;

  readonly initials = computed(() => {
    const name = this.authService.currentUser()?.full_name ?? '';
    return name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase()).join('');
  });
  readonly roleLabel = computed(() => {
    const roleMap: Record<string, string> = {
      super_admin: 'Super Admin',
      restaurant_admin: 'Admin Restaurante',
      excursion_operator: 'Admin Operadora',
    };
    return roleMap[this.authService.userRole() ?? ''] ?? '';
  });

  // Page title from route data
  readonly currentPageTitle = signal('');
  private routerSub: any;

  ngOnInit() {
    // Load desktop collapsed state from localStorage
    const stored = localStorage.getItem('sidebar_collapsed');
    if (stored === 'true') this.desktopCollapsed.set(true);

    // Track router for page title and mobile close-on-navigate
    this.routerSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe(() => {
      // Close mobile sidebar on navigation
      this.mobileOpen.set(false);
      this.currentPageTitle.set(this.resolvePageTitle(this.router.url));
    });
    this.currentPageTitle.set(this.resolvePageTitle(this.router.url));
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
  }

  onToggleSidebar() {
    if (this.isMobile()) {
      this.mobileOpen.update(v => !v);
    } else {
      this.toggleDesktopCollapse();
    }
  }

  toggleDesktopCollapse() {
    this.desktopCollapsed.update(v => !v);
    localStorage.setItem('sidebar_collapsed', String(this.desktopCollapsed()));
  }

  onNavClick() {
    // Close overlay on mobile when nav item clicked
    if (this.isMobile()) this.mobileOpen.set(false);
  }

  private resolvePageTitle(url: string): string {
    const clean = url.split('?')[0];
    const map: Array<{ match: string; title: string }> = [
      { match: '/dashboard', title: 'Dashboard de Plataforma' },
      { match: '/orders', title: 'Operación de Pedidos' },
      { match: '/stores', title: 'Gestión de Comercios' },
      { match: '/restaurants', title: 'Gestión de Restaurantes' },
      { match: '/couriers', title: 'Gestión de Repartidores' },
      { match: '/approvals', title: 'Bandeja de Aprobaciones' },
      { match: '/promotions', title: 'Promociones' },
      { match: '/reports', title: 'Reportes' },
      { match: '/finances', title: 'Finanzas' },
      { match: '/support-dashboard', title: 'Dashboard de Soporte' },
      { match: '/support/templates', title: 'Plantillas de Soporte' },
      { match: '/support', title: 'Soporte' },
      { match: '/catalog/price-approvals', title: 'Aprobaciones de Precio' },
      { match: '/catalog/search', title: 'Búsqueda Global de Catálogo' },
      { match: '/catalog', title: 'Gestión de Catálogos' },
      { match: '/settings', title: 'Configuración de Plataforma' },
      { match: '/excursions', title: 'Gestión de Excursiones' },
    ];
    const found = map.find(entry => clean.startsWith(entry.match));
    return found?.title ?? 'Panel de Administración';
  }
}
