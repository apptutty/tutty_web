import { Component, inject, signal, computed, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { StoreAdminService, TimeRange } from './store-admin.service';
import { CommerceType } from '../../core/supabase/database.types';

interface NavItem {
    label: string;
    path: string;
    svgPath: string;
    badge?: boolean;
    commerceTypes?: CommerceType[];
}

const BASE_NAV: NavItem[] = [
    {
        label: 'Dashboard',
        path: 'dashboard',
        svgPath: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
    },
    {
        label: 'Pedidos',
        path: 'orders',
        badge: true,
        svgPath: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
    },
    {
        label: 'Catálogo',
        path: 'catalog',
        svgPath: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z',
    },
    {
        label: 'Inventario',
        path: 'catalog',
        svgPath: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
        commerceTypes: ['farmacia'],
    },
    {
        label: 'Variantes',
        path: 'catalog',
        svgPath: 'M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42',
        commerceTypes: ['tienda_ropa', 'electronica'],
    },
    {
        label: 'Zonas de Entrega',
        path: 'zones',
        svgPath: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
    },
    {
        label: 'Reportes',
        path: 'reports',
        svgPath: 'M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z',
    },
    {
        label: 'Configuración',
        path: 'settings',
        svgPath: 'M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    },
];

@Component({
    selector: 'app-store-admin-shell',
    standalone: true,
    imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
    styles: [`
    .is-open-btn {
      @apply relative inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all duration-300 cursor-pointer select-none;
    }
    .is-open-btn.open {
      @apply bg-success-50 text-success-700 ring-2 ring-success-200;
    }
    .is-open-btn.closed {
      @apply bg-gray-100 text-gray-500 ring-2 ring-gray-200;
    }
    .pulse-dot {
      @apply w-2.5 h-2.5 rounded-full bg-success-500;
      animation: pulse-ring 1.5s ease-in-out infinite;
    }
    @keyframes pulse-ring {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(0.85); }
    }
  `],
    template: `
    <div class="flex h-screen bg-gray-50 overflow-hidden font-inter">

      <!-- Mobile overlay -->
      @if (isMobileOpen()) {
        <div class="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm lg:hidden"
          (click)="isMobileOpen.set(false)"></div>
      }

      <!-- Sidebar -->
      <aside
        class="flex-shrink-0 flex flex-col bg-gray-dark z-30 transition-all duration-300 no-scrollbar overflow-y-auto"
        [class]="sidebarClass()"
      >
        <!-- Logo -->
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
          @if (!collapsed()) {
            <div class="min-w-0">
              <span class="font-bold text-base tracking-tight leading-none" style="background: linear-gradient(90deg, #FF3C97, #FFC107); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Tutty</span>
              <span class="block text-gray-400 text-xs truncate">{{ storeService.activeStore()?.name ?? 'Mi Comercio' }}</span>
            </div>
          }
        </div>

        <!-- Nav -->
        <nav class="flex-1 px-3 py-4 space-y-0.5">
          @for (item of visibleNav(); track item.path + item.label) {
            <a
              [routerLink]="'/store/' + item.path"
              routerLinkActive="bg-white/10 text-white"
              [routerLinkActiveOptions]="{ exact: false }"
              class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-gray-400 hover:bg-white/5 hover:text-gray-300 transition-colors text-sm font-medium"
              [class.justify-center]="collapsed()"
              [title]="collapsed() ? item.label : ''"
            >
              <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="item.svgPath" />
              </svg>
              @if (!collapsed()) {
                <span class="flex-1">{{ catalogLabel(item) }}</span>
                @if (item.badge && storeService.activeOrdersCount() > 0) {
                  <span class="flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-brand-500 text-white text-[10px] font-bold">
                    {{ storeService.activeOrdersCount() > 9 ? '9+' : storeService.activeOrdersCount() }}
                  </span>
                }
              }
            </a>
          }
        </nav>

        <!-- Collapse toggle -->
        <div class="flex-shrink-0 p-3 border-t border-white/10">
          <button
            class="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-gray-500 hover:bg-white/5 hover:text-gray-300 transition-colors text-xs"
            (click)="collapsed.update(v => !v)"
          >
            <svg class="w-4 h-4 transition-transform" [class.rotate-180]="collapsed()" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
            </svg>
            @if (!collapsed()) { <span>Contraer</span> }
          </button>
        </div>
      </aside>

      <!-- Main content -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">

        <!-- Topbar -->
        <header class="flex-shrink-0 h-16 bg-white border-b border-gray-200 flex items-center gap-3 px-4 lg:px-6">

          <!-- Mobile hamburger -->
          <button
            class="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            (click)="isMobileOpen.set(true)"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          <!-- Store name + multi-store dropdown -->
          <div class="relative">
            <button
              class="flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-brand-600 transition-colors"
              (click)="storeDropOpen.update(v => !v)"
              [disabled]="storeService.approvedStores().length <= 1"
            >
              @if (storeService.activeStore()?.logo_url) {
                <img [src]="storeService.activeStore()!.logo_url" class="w-7 h-7 rounded-lg object-cover flex-shrink-0" [alt]="storeService.activeStore()!.name" />
              } @else {
                <div class="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
                  <svg class="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                  </svg>
                </div>
              }
              <span class="hidden sm:block max-w-[140px] truncate">{{ storeService.activeStore()?.name ?? 'Mi Comercio' }}</span>
              @if (storeService.approvedStores().length > 1) {
                <svg class="w-4 h-4 text-gray-400 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              }
            </button>

            @if (storeDropOpen() && storeService.approvedStores().length > 1) {
              <div class="absolute left-0 top-10 w-60 bg-white rounded-xl shadow-theme-lg border border-gray-200 py-2 z-50">
                <p class="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Mis comercios</p>
                @for (s of storeService.approvedStores(); track s.id) {
                  <button
                    class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors"
                    [class.text-brand-600]="storeService.activeStoreId() === s.id"
                    [class.font-semibold]="storeService.activeStoreId() === s.id"
                    (click)="switchStore(s.id)"
                  >
                    @if (s.logo_url) {
                      <img [src]="s.logo_url" class="w-6 h-6 rounded object-cover flex-shrink-0" [alt]="s.name" />
                    } @else {
                      <div class="w-6 h-6 rounded bg-gray-100 flex-shrink-0"></div>
                    }
                    <span class="truncate">{{ s.name }}</span>
                    @if (storeService.activeStoreId() === s.id) {
                      <svg class="w-4 h-4 text-brand-500 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    }
                  </button>
                }
              </div>
            }
          </div>

          <div class="flex-1"></div>

          <!-- Time range selector -->
          <div class="hidden md:flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
            @for (range of timeRanges; track range.value) {
              <button
                class="px-3 py-1 rounded-md text-xs font-semibold transition-all"
                [class.bg-white]="storeService.timeRange() === range.value"
                [class.text-gray-800]="storeService.timeRange() === range.value"
                [class.shadow-sm]="storeService.timeRange() === range.value"
                [class.text-gray-500]="storeService.timeRange() !== range.value"
                (click)="storeService.timeRange.set(range.value)"
              >{{ range.label }}</button>
            }
          </div>

          <!-- is_open toggle -->
          <button
            class="is-open-btn"
            [class.open]="storeService.activeStore()?.is_open"
            [class.closed]="!storeService.activeStore()?.is_open"
            (click)="handleToggleOpen()"
            [title]="outsideScheduleWarning()"
          >
            @if (storeService.activeStore()?.is_open) {
              <span class="pulse-dot"></span>
              <span>ABIERTO</span>
            } @else {
              <span class="w-2.5 h-2.5 rounded-full bg-gray-400"></span>
              <span>CERRADO</span>
            }
          </button>

          <!-- Schedule warning icon -->
          @if (showScheduleWarning()) {
            <div class="relative group hidden md:block">
              <svg class="w-5 h-5 text-warning-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div class="absolute right-0 top-7 w-56 bg-gray-800 text-white text-xs rounded-lg p-2.5 z-50 hidden group-hover:block shadow-lg">
                Fuera del horario configurado. El comercio aparecerá como cerrado para los clientes.
              </div>
            </div>
          }

          <!-- Notifications -->
          <button class="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </button>

          <!-- User -->
          <div class="relative">
            <button
              class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              (click)="userDropOpen.update(v => !v)"
            >
              <div class="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-semibold">
                {{ initials() }}
              </div>
            </button>

            @if (userDropOpen()) {
              <div class="absolute right-0 top-12 w-52 bg-white rounded-xl shadow-theme-lg border border-gray-200 py-2 z-50">
                <div class="px-4 py-2.5 border-b border-gray-100">
                  <p class="text-sm font-semibold text-gray-800 truncate">{{ auth.currentUser()?.full_name }}</p>
                  <p class="text-xs text-gray-500 truncate mt-0.5">{{ auth.currentUser()?.email }}</p>
                </div>
                <button
                  class="w-full text-left px-4 py-2.5 text-sm text-error-600 hover:bg-error-50 transition-colors flex items-center gap-2"
                  (click)="auth.signOut()"
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

        <!-- Schedule warning banner -->
        @if (showScheduleWarning() && storeService.activeStore()?.is_open) {
          <div class="flex-shrink-0 bg-warning-50 border-b border-warning-200 px-4 py-2 flex items-center gap-2 text-sm text-warning-700">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            El comercio está marcado como abierto pero está fuera del horario configurado ({{ storeService.activeStore()?.opening_time }} – {{ storeService.activeStore()?.closing_time }}).
          </div>
        }

        <!-- Page content -->
        <main class="flex-1 overflow-y-auto">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class StoreAdminShellComponent {
    readonly auth = inject(AuthService);
    readonly storeService = inject(StoreAdminService);
    private readonly router = inject(Router);

    readonly collapsed = signal(false);
    readonly isMobileOpen = signal(false);
    readonly storeDropOpen = signal(false);
    readonly userDropOpen = signal(false);

    readonly timeRanges: { label: string; value: TimeRange }[] = [
        { label: 'Hoy', value: 'hoy' },
        { label: 'Semana', value: 'semana' },
        { label: 'Mes', value: 'mes' },
    ];

    readonly sidebarClass = computed(() => {
        if (this.isMobileOpen()) {
            return 'fixed inset-y-0 left-0 w-64';
        }
        return `hidden lg:flex ${this.collapsed() ? 'w-16' : 'w-60'}`;
    });

    readonly initials = computed(() => {
        const name = this.auth.currentUser()?.full_name ?? '';
        return name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase()).join('');
    });

    readonly visibleNav = computed(() => {
        const type = this.storeService.activeStore()?.commerce_type ?? null;
        return BASE_NAV.filter(item => {
            if (!item.commerceTypes) return true;
            return type && item.commerceTypes.includes(type as CommerceType);
        });
    });

    readonly showScheduleWarning = computed(() => this.storeService.isOutsideSchedule());

    readonly outsideScheduleWarning = computed(() =>
        this.showScheduleWarning()
            ? 'Fuera del horario configurado'
            : this.storeService.activeStore()?.is_open ? 'Marcar como cerrado' : 'Marcar como abierto'
    );

    catalogLabel(item: NavItem): string {
        if (item.path !== 'catalog' || item.label !== 'Catálogo') return item.label;
        const type = this.storeService.activeStore()?.commerce_type;
        if (type === 'restaurante') return 'Mi Menú';
        if (type === 'farmacia') return 'Mis Productos';
        return 'Mi Catálogo';
    }

    async handleToggleOpen() {
        await this.storeService.toggleIsOpen();
    }

    switchStore(id: string) {
        this.storeDropOpen.set(false);
        this.storeService.setActiveStore(id);
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-dropdown]')) {
            this.storeDropOpen.set(false);
            this.userDropOpen.set(false);
        }
    }
}
