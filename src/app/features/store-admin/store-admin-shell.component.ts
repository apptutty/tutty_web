import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../core/auth/auth.service';
import { StoreAdminService, TimeRange } from './store-admin.service';
import { CommerceType } from '../../core/supabase/database.types';

interface NavItem {
    label: string;
    path: string;
    svgPath: string;
    badge?: boolean;
    commerceTypes?: CommerceType[];
    group: 'ops' | 'mgmt';
}

const BASE_NAV: NavItem[] = [
    {
        label: 'Dashboard',
        path: 'dashboard',
        group: 'ops',
        svgPath: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
    },
    {
        label: 'Pedidos',
        path: 'orders',
        group: 'ops',
        badge: true,
        svgPath: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
    },
    {
        label: 'Catálogo',
        path: 'catalog',
        group: 'ops',
        svgPath: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z',
    },
    {
        label: 'Inventario',
        path: 'catalog',
        group: 'ops',
        svgPath: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
        commerceTypes: ['farmacia'],
    },
    {
        label: 'Zonas de Entrega',
        path: 'zones',
        group: 'mgmt',
        svgPath: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
    },
    {
        label: 'Reportes',
        path: 'reports',
        group: 'mgmt',
        svgPath: 'M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z',
    },
    {
        label: 'Configuración',
        path: 'settings',
        group: 'mgmt',
        svgPath: 'M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    },
];

/** Routes where the global time-range filter is relevant */
const TIME_FILTER_ROUTES = ['/store/dashboard', '/store/reports'];

/** Bottom-nav items shown on mobile */
const BOTTOM_NAV = ['dashboard', 'orders', 'catalog', 'settings'];

@Component({
    selector: 'app-store-admin-shell',
    standalone: true,
    imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
    styles: [`
    /* ── Store-status pill ── */
    .status-btn {
      @apply inline-flex items-center gap-2 px-4 h-11 rounded-[22px] font-bold text-sm transition-all duration-200 cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 border-2;
    }
    .status-btn.open  { @apply bg-success-50 text-success-700 border-success-200; }
    .status-btn.closed{ @apply bg-gray-100 text-gray-500 border-gray-300; }

    /* ── Pulse animation on the live dot ── */
    .pulse-dot {
      @apply w-2 h-2 rounded-full bg-success-500;
      animation: pulse-ring 1.5s ease-in-out infinite;
    }
    @keyframes pulse-ring {
      0%, 100% { opacity:1; transform:scale(1);    }
      50%       { opacity:.6; transform:scale(.85); }
    }

    /* ── Nav link active state ── */
    .nav-active {
      @apply bg-brand-500/20 text-white font-semibold;
    }

    /* ── Sidebar nav-group label ── */
    .nav-group-label {
      @apply px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/30 select-none;
    }

    /* ── Confirmation modal backdrop ── */
    .modal-backdrop {
      @apply fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm;
    }

    .top-range-switch {
      @apply hidden sm:flex items-center gap-[3px] p-[3px] rounded-[14px] border border-gray-200;
      background: #eef1f6;
      height: 36px;
    }
    .top-range-btn {
      @apply px-[14px] rounded-[11px] font-extrabold text-gray-500 transition-all;
      height: 30px;
      font-size: 16px;
    }
    .top-range-btn.active {
      @apply bg-white text-gray-900 shadow-sm;
    }
    .top-bell-btn {
      @apply w-[38px] h-[38px] flex items-center justify-center rounded-[13px] border border-gray-200 bg-white hover:bg-gray-50 transition-colors;
      color: #647084;
      font-size: 18px;
      line-height: 1;
    }
  `],
    template: `
    <div class="flex min-h-[100dvh] bg-gray-50 overflow-hidden font-poppins">

      <!-- ═══════════ MOBILE DRAWER OVERLAY ═══════════ -->
      @if (drawerOpen()) {
        <div
          class="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          (click)="drawerOpen.set(false)"
        ></div>
      }

      <!-- ═══════════ SIDEBAR (desktop + mobile drawer) ═══════════ -->
      <aside
        class="flex-shrink-0 flex flex-col bg-gray-dark z-40 transition-all duration-200 no-scrollbar overflow-y-auto"
        [class]="sidebarClass()"
      >
        <!-- ── Collapse toggle (top) ── -->
        <div class="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
          @if (!collapsed()) {
            <div class="min-w-0 flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center"
                style="background:linear-gradient(135deg,#FF3C97 0%,#6B2059 100%)">
                <svg viewBox="0 0 24 24" class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6.5 2h11a1 1 0 01.894 1.447l-1.5 3A1 1 0 0116 7H8a1 1 0 01-.894-.553l-1.5-3A1 1 0 016.5 2z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 11h18M5 7l-2 14h18L19 7"/>
                </svg>
              </div>
              <span class="font-bold text-sm tracking-tight" style="background:linear-gradient(90deg,#FF3C97,#FFC107);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">Tutty</span>
            </div>
          }
          <button
            class="ml-auto flex items-center justify-center w-8 h-8 rounded-lg text-white/40 hover:bg-white/10 hover:text-white/80 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            (click)="collapsed.update(v => !v)"
            [title]="collapsed() ? 'Expandir menú' : 'Contraer menú'"
          >
            <svg class="w-4 h-4 transition-transform duration-200" [class.rotate-180]="collapsed()"
              fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        </div>

        <!-- ── Store name ── -->
        @if (!collapsed()) {
          <div class="px-4 pb-3 border-b border-white/10 flex-shrink-0">
            <p class="text-xs text-white/50 truncate leading-none">{{ storeService.activeStore()?.name ?? 'Mi Comercio' }}</p>
          </div>
        } @else {
          <div class="border-b border-white/10 mx-3 mb-1"></div>
        }

        <!-- ── Nav ── -->
        <nav class="flex-1 px-2 py-3 overflow-y-auto no-scrollbar">

          <!-- OPERACIONES group -->
          @if (!collapsed()) {
            <p class="nav-group-label">Operaciones</p>
          }
          @for (item of opsNav(); track item.path + item.label) {
            <ng-container *ngTemplateOutlet="navLink; context: { $implicit: item }"></ng-container>
          }

          <!-- GESTIÓN group -->
          <div class="my-2 border-t border-white/10"></div>
          @if (!collapsed()) {
            <p class="nav-group-label">Gestión</p>
          }
          @for (item of mgmtNav(); track item.path + item.label) {
            <ng-container *ngTemplateOutlet="navLink; context: { $implicit: item }"></ng-container>
          }
        </nav>

        <!-- ── User row ── -->
        @if (!collapsed()) {
          <div class="flex-shrink-0 px-3 pb-3 border-t border-white/10 pt-2">
            <button
              class="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors text-sm"
              (click)="userDropOpen.update(v => !v)"
            >
              <div class="w-7 h-7 rounded-full bg-brand-500 flex-shrink-0 flex items-center justify-center text-white text-xs font-semibold">
                {{ initials() }}
              </div>
              <div class="min-w-0 text-left flex-1">
                <p class="text-xs font-semibold text-white truncate leading-none">{{ auth.currentUser()?.full_name }}</p>
                <p class="text-[10px] text-white/40 truncate mt-0.5">{{ auth.currentUser()?.email }}</p>
              </div>
              <svg class="w-3.5 h-3.5 text-white/30 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            @if (userDropOpen()) {
              <div class="mt-1 bg-gray-800 rounded-xl border border-white/10 py-1 shadow-lg">
                <button
                  class="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 transition-colors flex items-center gap-2"
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
        }
      </aside>

      <!-- ═══════════ MAIN COLUMN ═══════════ -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">

        <!-- ── Top bar ── -->
        <header class="flex-shrink-0 h-14 bg-white border-b border-gray-200 flex items-center gap-2 px-3 lg:px-5">

          <!-- Hamburger (mobile only) -->
          <button
            class="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            (click)="drawerOpen.set(true)"
            aria-label="Abrir menú"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          <!-- Store switcher -->
          <div class="relative" data-dropdown>
            <button
              class="flex items-center gap-2 h-9 px-2 rounded-lg text-sm font-semibold text-gray-800 hover:bg-gray-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60 disabled:cursor-default"
              (click)="storeDropOpen.update(v => !v)"
              [disabled]="storeService.approvedStores().length <= 1"
              data-dropdown
            >
              @if (storeService.activeStore()?.logo_url) {
                <img [src]="storeService.activeStore()!.logo_url" class="w-6 h-6 rounded object-cover flex-shrink-0" [alt]="storeService.activeStore()!.name" />
              } @else {
                <div class="w-6 h-6 rounded bg-brand-100 flex items-center justify-center flex-shrink-0">
                  <svg class="w-3.5 h-3.5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                  </svg>
                </div>
              }
              <span class="max-w-[130px] truncate">{{ storeService.activeStore()?.name ?? 'Mi Comercio' }}</span>
              @if (storeService.approvedStores().length > 1) {
                <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              }
            </button>

            @if (storeDropOpen() && storeService.approvedStores().length > 1) {
              <div class="absolute left-0 top-11 w-60 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50" data-dropdown>
                <p class="px-4 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Mis comercios</p>
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
                    <span class="truncate flex-1">{{ s.name }}</span>
                    @if (storeService.activeStoreId() === s.id) {
                      <svg class="w-4 h-4 text-brand-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    }
                  </button>
                }
              </div>
            }
          </div>

          <div class="flex-1"></div>

          <!-- Time range filter (only on Dashboard + Reportes) -->
          @if (showTimeFilter()) {
            <div class="top-range-switch">
              @for (range of timeRanges; track range.value) {
                <button
                  class="top-range-btn focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500"
                  [class.active]="storeService.timeRange() === range.value"
                  (click)="storeService.timeRange.set(range.value)"
                >{{ range.label }}</button>
              }
            </div>
          }

          <!-- Store status toggle (prominent) -->
          <button
            class="status-btn"
            [class.open]="storeService.activeStore()?.is_open"
            [class.closed]="!storeService.activeStore()?.is_open"
            (click)="confirmToggleOpen()"
          >
            @if (storeService.activeStore()?.is_open) {
              <span class="pulse-dot"></span>
            } @else {
              <span class="w-2 h-2 rounded-full bg-gray-400"></span>
            }
            <span class="font-bold tracking-wide">
              {{ storeService.activeStore()?.is_open ? 'ABIERTO' : 'CERRADO' }}
            </span>
            @if (showScheduleWarning()) {
              <svg class="w-3.5 h-3.5 text-warning-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.645c-1.73 0-2.813-1.874-1.948-3.374L10.051 3.378c.866-1.5 3.032-1.5 3.898 0L21.303 16.126z" />
              </svg>
            }
          </button>

          <!-- Notifications -->
          <button
            class="top-bell-btn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            aria-label="Notificaciones"
          >
            🔔
          </button>
        </header>

        <!-- ── Page content ── -->
        <main class="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <router-outlet />
        </main>

        <!-- ── Mobile bottom navigation ── -->
        <nav class="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 flex items-stretch h-16 safe-bottom">
          @for (item of bottomNav(); track item.path) {
            <a
              [routerLink]="'/store/' + item.path"
              routerLinkActive
              #rla="routerLinkActive"
              [routerLinkActiveOptions]="{ exact: false }"
              class="flex-1 flex flex-col items-center justify-center gap-0.5 min-w-0 transition-colors focus-visible:outline-none"
              [class.text-brand-600]="rla.isActive"
              [class.text-gray-500]="!rla.isActive"
            >
              <div class="relative">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="item.svgPath" />
                </svg>
                @if (item.badge && storeService.activeOrdersCount() > 0) {
                  <span class="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full bg-brand-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {{ storeService.activeOrdersCount() > 9 ? '9+' : storeService.activeOrdersCount() }}
                  </span>
                }
              </div>
              <span class="text-[10px] font-medium truncate max-w-full px-1">{{ catalogLabel(item) }}</span>
            </a>
          }
        </nav>
      </div>

      <!-- ═══════════ TOGGLE CONFIRMATION MODAL ═══════════ -->
      @if (toggleModalOpen()) {
        <div class="modal-backdrop" (click)="toggleModalOpen.set(false)">
          <div
            class="bg-white rounded-2xl shadow-xl p-6 w-80 mx-4"
            (click)="$event.stopPropagation()"
          >
            <div class="flex items-center gap-3 mb-4">
              <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                [class.bg-success-100]="!storeService.activeStore()?.is_open"
                [class.bg-red-100]="storeService.activeStore()?.is_open">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"
                  [class.text-success-600]="!storeService.activeStore()?.is_open"
                  [class.text-red-500]="storeService.activeStore()?.is_open">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                </svg>
              </div>
              <div>
                <h3 class="text-sm font-semibold text-gray-900">
                  {{ storeService.activeStore()?.is_open ? 'Cerrar comercio' : 'Abrir comercio' }}
                </h3>
                <p class="text-xs text-gray-500 mt-0.5">
                  {{ storeService.activeStore()?.is_open
                    ? 'Los clientes no podrán hacer nuevos pedidos.'
                    : 'Los clientes podrán ver y ordenar de tu tienda.' }}
                </p>
              </div>
            </div>
            <div class="flex gap-2">
              <button
                class="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                (click)="toggleModalOpen.set(false)"
              >Cancelar</button>
              <button
                class="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
                [class.bg-success-500]="!storeService.activeStore()?.is_open"
                [class.hover:bg-success-600]="!storeService.activeStore()?.is_open"
                [class.bg-red-500]="storeService.activeStore()?.is_open"
                [class.hover:bg-red-600]="storeService.activeStore()?.is_open"
                (click)="confirmAndToggle()"
              >
                {{ storeService.activeStore()?.is_open ? 'Sí, cerrar' : 'Sí, abrir' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>

    <!-- Nav link template -->
    <ng-template #navLink let-item>
      <a
        [routerLink]="'/store/' + item.path"
        routerLinkActive
        #rla="routerLinkActive"
        [routerLinkActiveOptions]="{ exact: false }"
        class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors text-sm"
        [class.nav-active]="rla.isActive"
        [class.justify-center]="collapsed()"
        [title]="collapsed() ? catalogLabel(item) : ''"
        (click)="drawerOpen.set(false)"
      >
        <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="item.svgPath" />
        </svg>
        @if (!collapsed()) {
          <span class="flex-1 truncate">{{ catalogLabel(item) }}</span>
          @if (item.badge && storeService.activeOrdersCount() > 0) {
            <span class="flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-brand-500 text-white text-[10px] font-bold">
              {{ storeService.activeOrdersCount() > 9 ? '9+' : storeService.activeOrdersCount() }}
            </span>
          }
        }
      </a>
    </ng-template>
  `,
})
export class StoreAdminShellComponent {
    readonly auth = inject(AuthService);
    readonly storeService = inject(StoreAdminService);
    private readonly router = inject(Router);

    readonly collapsed = signal(false);
    readonly drawerOpen = signal(false);
    readonly storeDropOpen = signal(false);
    readonly userDropOpen = signal(false);
    readonly toggleModalOpen = signal(false);
    readonly warningDismissed = signal(false);

    /** Current route URL (updated on navigation) */
    private readonly currentUrl = signal(this.router.url);

    readonly timeRanges: { label: string; value: TimeRange }[] = [
        { label: 'Hoy', value: 'hoy' },
        { label: 'Semana', value: 'semana' },
        { label: 'Mes', value: 'mes' },
    ];

    constructor() {
        this.router.events
            .pipe(filter(e => e instanceof NavigationEnd))
            .subscribe(e => {
                this.currentUrl.set((e as NavigationEnd).urlAfterRedirects);
                this.drawerOpen.set(false);
            });
    }

    readonly sidebarClass = computed(() => {
        if (this.drawerOpen()) {
            return 'fixed inset-y-0 left-0 w-64';
        }
        return `hidden lg:flex ${this.collapsed() ? 'w-16' : 'w-60'}`;
    });

    readonly showTimeFilter = computed(() =>
        TIME_FILTER_ROUTES.some(r => this.currentUrl().startsWith(r))
    );

    readonly isDashboard = computed(() =>
        this.currentUrl().startsWith('/store/dashboard')
    );

    readonly isOrders = computed(() =>
        this.currentUrl().startsWith('/store/orders')
    );

    readonly initials = computed(() => {
        const name = this.auth.currentUser()?.full_name ?? '';
        return name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase()).join('');
    });

    private readonly allVisible = computed(() => {
        const type = this.storeService.activeStore()?.commerce_type ?? null;
        return BASE_NAV.filter(item => {
            if (!item.commerceTypes) return true;
            return type && item.commerceTypes.includes(type as CommerceType);
        });
    });

    readonly opsNav = computed(() => this.allVisible().filter(i => i.group === 'ops'));
    readonly mgmtNav = computed(() => this.allVisible().filter(i => i.group === 'mgmt'));

    readonly bottomNav = computed(() =>
        this.allVisible().filter(i => BOTTOM_NAV.includes(i.path)).slice(0, 4)
    );

    readonly showScheduleWarning = computed(() => this.storeService.isOutsideSchedule());
    readonly scheduleWindow = computed(() => {
        const store = this.storeService.activeStore();
        if (!store?.opening_time || !store?.closing_time) return 'Horario no configurado';
        return `${this.fmt12(store.opening_time)} - ${this.fmt12(store.closing_time)}`;
    });

    catalogLabel(item: NavItem): string {
        if (item.path !== 'catalog') return item.label;
        const type = this.storeService.activeStore()?.commerce_type;
        if (type === 'restaurante') return 'Mi Menú';
        if (type === 'farmacia') return 'Mis Productos';
        return 'Mi Catálogo';
    }

    confirmToggleOpen() {
        this.toggleModalOpen.set(true);
    }

    async confirmAndToggle() {
        this.toggleModalOpen.set(false);
        await this.storeService.toggleIsOpen();
    }

    goToSettings() {
        this.router.navigate(['/store/settings']);
    }

    switchStore(id: string) {
        this.storeDropOpen.set(false);
        this.storeService.setActiveStore(id);
    }

    private fmt12(time: string): string {
        const [h, m] = time.split(':').map(Number);
        const ampm = h >= 12 ? 'pm' : 'am';
        const h12 = h % 12 || 12;
        return `${h12}:${String(m).padStart(2, '0')}${ampm}`;
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
