import { Component, Input, Output, EventEmitter, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ToastContainerComponent } from '../../shared/ui/toast/toast-container.component';
import { ConfirmModalComponent } from '../../shared/ui/modal/confirm-modal.component';

interface NavItem { label: string; path: string; roles?: string[]; svgPath: string; }

const NAV_ITEMS: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', svgPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { label: 'Pedidos', path: '/orders', svgPath: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
    { label: 'Restaurantes', path: '/restaurants', roles: ['super_admin'], svgPath: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { label: 'Excursiones', path: '/excursions', roles: ['super_admin', 'excursion_operator'], svgPath: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
    { label: 'Repartidores', path: '/repartidores', roles: ['super_admin'], svgPath: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { label: 'Promociones', path: '/promotions', roles: ['super_admin'], svgPath: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
    { label: 'Reportes', path: '/reports', roles: ['super_admin'], svgPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { label: 'Configuración', path: '/settings', roles: ['super_admin'], svgPath: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

@Component({
    selector: 'app-sidebar-nav',
    standalone: true,
    imports: [CommonModule, RouterLink, RouterLinkActive],
    template: `
    <ul class="space-y-0.5">
      @for (item of visibleItems(); track item.path) {
        <li>
          <a
            [routerLink]="item.path"
            routerLinkActive="bg-white/10 text-white"
            [routerLinkActiveOptions]="{ exact: false }"
            class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-gray-400 hover:bg-white/5 hover:text-gray-300 transition-colors text-sm font-medium"
            [class.justify-center]="collapsed"
            [title]="collapsed ? item.label : ''"
          >
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="item.svgPath" />
            </svg>
            @if (!collapsed) { <span>{{ item.label }}</span> }
          </a>
        </li>
      }
    </ul>
  `,
})
export class SidebarNavComponent {
    @Input() collapsed = false;
    private readonly authService = inject(AuthService);
    readonly visibleItems = computed(() => {
        const role = this.authService.userRole();
        return NAV_ITEMS.filter(item => !item.roles || (role && item.roles.includes(role)));
    });
}

@Component({
    selector: 'app-topbar',
    standalone: true,
    imports: [CommonModule],
    template: `
    <header class="flex-shrink-0 h-16 bg-white border-b border-gray-200 flex items-center gap-3 px-4 lg:px-6">
      <button
        class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        (click)="toggleSidebar.emit()"
        title="Toggle sidebar"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      <div class="flex-1"></div>

      <!-- Notifications -->
      <button class="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        @if (notificationCount() > 0) {
          <span class="absolute top-1 right-1 flex items-center justify-center w-4 h-4 rounded-full bg-brand-500 text-white text-[9px] font-bold">
            {{ notificationCount() > 9 ? '9+' : notificationCount() }}
          </span>
        }
      </button>

      <!-- User dropdown -->
      <div class="relative">
        <button
          class="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          (click)="dropdownOpen.update(v => !v)"
        >
          <div class="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-semibold">
            {{ initials() }}
          </div>
          <div class="hidden md:block text-left">
            <p class="text-sm font-medium text-gray-800 leading-none">{{ authService.currentUser()?.full_name }}</p>
            <p class="text-xs text-gray-500 mt-0.5">{{ roleLabel() }}</p>
          </div>
          <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        @if (dropdownOpen()) {
          <div class="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-theme-lg border border-gray-200 py-2 z-50">
            <div class="px-4 py-2.5 border-b border-gray-100">
              <p class="text-sm font-semibold text-gray-800 truncate">{{ authService.currentUser()?.full_name }}</p>
              <p class="text-xs text-gray-500 truncate mt-0.5">{{ authService.currentUser()?.email }}</p>
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
    </header>
  `,
})
export class TopbarComponent {
    @Input() isSidebarOpen = true;
    @Output() toggleSidebar = new EventEmitter<void>();
    readonly authService = inject(AuthService);
    readonly dropdownOpen = signal(false);
    readonly notificationCount = signal(0);
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
    imports: [CommonModule, RouterOutlet, ToastContainerComponent, ConfirmModalComponent, SidebarNavComponent, TopbarComponent],
    template: `
    <div class="flex h-screen bg-gray-50 overflow-hidden font-outfit">

      <!-- Mobile overlay -->
      @if (isMobile() && isSidebarOpen()) {
        <div class="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm" (click)="isSidebarOpen.set(false)"></div>
      }

      <!-- Sidebar -->
      <aside
        class="flex-shrink-0 flex flex-col bg-gray-dark transition-all duration-300 z-30 no-scrollbar"
        [class]="sidebarClass()"
      >
        <!-- Logo -->
        <div class="flex items-center gap-3 px-4 py-5 border-b border-white/10">
          <div class="flex-shrink-0 w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center shadow-theme-sm">
            <span class="text-white font-bold text-sm">T</span>
          </div>
          @if (isSidebarOpen()) {
            <div>
              <span class="text-white font-bold text-base tracking-tight leading-none">Tutty</span>
              <span class="block text-gray-400 text-xs">Admin Panel</span>
            </div>
          }
        </div>

        <!-- Nav -->
        <nav class="flex-1 overflow-y-auto py-4 px-3 no-scrollbar">
          <app-sidebar-nav [collapsed]="!isSidebarOpen()" />
        </nav>

        <!-- User bottom -->
        @if (authService.currentUser()) {
          <div class="border-t border-white/10 px-3 py-3">
            <div class="flex items-center gap-3 rounded-lg hover:bg-white/5 p-2 transition-colors">
              <div class="flex-shrink-0 w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-semibold">
                {{ initials() }}
              </div>
              @if (isSidebarOpen()) {
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
        <app-topbar [isSidebarOpen]="isSidebarOpen()" (toggleSidebar)="isSidebarOpen.update(v => !v)" />
        <main class="flex-1 overflow-y-auto p-4 md:p-6">
          <router-outlet />
        </main>
      </div>
    </div>
    <app-toast-container />
    <app-confirm-modal />
  `,
})
export class AdminShellComponent {
    readonly authService = inject(AuthService);
    readonly isSidebarOpen = signal(true);
    readonly isMobile = signal(window.innerWidth < 768);
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
    readonly sidebarClass = computed(() => {
        if (this.isMobile()) {
            return this.isSidebarOpen() ? 'fixed left-0 top-0 bottom-0 w-64' : 'fixed left-0 top-0 bottom-0 w-0 overflow-hidden';
        }
        return this.isSidebarOpen() ? 'w-64' : 'w-16';
    });
}
