import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { CustomerProfileService } from './profile.service';

interface MenuItem {
    label: string;
    sublabel?: string;
    icon: string;
    route?: string;
    action?: () => void;
    badge?: string;
    danger?: boolean;
}

@Component({
    selector: 'app-customer-profile',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, RouterLink],
    template: `
    <div class="min-h-screen bg-gray-50">

      <!-- Header -->
      <header class="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div class="flex items-center justify-between px-4 h-14">
          <h1 class="text-base font-semibold text-gray-900 tracking-tight">Mi perfil</h1>
          <a routerLink="/customer/settings" class="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.75">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </a>
        </div>
      </header>

      @if (svc.isLoading()) {
        <!-- Skeleton -->
        <div class="px-4 pt-6 space-y-4 animate-pulse">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-full bg-gray-200"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-gray-200 rounded w-32"></div>
              <div class="h-3 bg-gray-200 rounded w-48"></div>
            </div>
          </div>
          <div class="h-24 bg-gray-200 rounded-2xl"></div>
          <div class="h-48 bg-gray-200 rounded-2xl"></div>
        </div>
      } @else {

        <!-- Profile hero -->
        <section class="bg-white px-4 pt-6 pb-5 mb-3">
          <div class="flex items-center gap-4">

            <!-- Avatar -->
            <div class="relative flex-shrink-0">
              @if (svc.profile()?.avatar_url) {
                <img
                  [src]="svc.profile()!.avatar_url"
                  [alt]="svc.profile()!.full_name"
                  loading="lazy"
                  class="w-16 h-16 rounded-full object-cover ring-2 ring-brand-100" />
              } @else {
                <div class="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white"
                  style="background-color: #6B2059;">
                  {{ svc.initials(svc.profile()?.full_name ?? null) }}
                </div>
              }
              <!-- Edit avatar button -->
              <button
                class="absolute bottom-0 right-0 w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center ring-2 ring-white"
                aria-label="Cambiar foto">
                <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>

            <!-- Info -->
            <div class="min-w-0 flex-1">
              <h2 class="text-base font-semibold text-gray-900 truncate tracking-tight">
                {{ svc.profile()?.full_name || 'Usuario' }}
                @if (svc.profile()?.nationality_flag) {
                  <span class="ml-1">{{ svc.profile()!.nationality_flag }}</span>
                }
              </h2>
              <p class="text-sm text-gray-500 truncate mt-0.5">{{ svc.profile()?.email }}</p>
              @if (svc.profile()?.phone) {
                <p class="text-sm text-gray-400 mt-0.5">{{ svc.profile()!.phone }}</p>
              }
            </div>

            <!-- Edit button -->
            <a routerLink="/customer/edit-profile"
              class="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
              </svg>
              Editar
            </a>
          </div>

          <!-- Stats strip -->
          <div class="flex items-center gap-4 mt-5 pt-4 border-t border-gray-100">
            <div class="flex-1 text-center">
              <p class="text-xl font-bold text-gray-900">{{ svc.profile()?.total_orders ?? 0 }}</p>
              <p class="text-xs text-gray-500 mt-0.5">Pedidos</p>
            </div>
            <div class="w-px h-8 bg-gray-200"></div>
            <div class="flex-1 text-center">
              <p class="text-xl font-bold text-gray-900">{{ svc.addresses().length }}</p>
              <p class="text-xs text-gray-500 mt-0.5">Direcciones</p>
            </div>
            <div class="w-px h-8 bg-gray-200"></div>
            <div class="flex-1 text-center">
              <p class="text-xl font-bold text-brand-500">{{ svc.profile()?.referral_code ?? '–' }}</p>
              <p class="text-xs text-gray-500 mt-0.5">Mi código</p>
            </div>
          </div>
        </section>

        <!-- Referral card -->
        @if (svc.profile()?.referral_code) {
          <section class="mx-4 mb-3">
            <div class="rounded-2xl p-4 border border-brand-100"
              style="background: linear-gradient(135deg, #fff0f7 0%, #fff 60%);">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <svg class="w-4 h-4 text-brand-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                    </svg>
                    <p class="text-xs font-semibold text-brand-600 uppercase tracking-wider">Invita amigos</p>
                  </div>
                  <p class="text-sm text-gray-600">Comparte tu código y ambos ganan</p>
                  <div class="flex items-center gap-2 mt-2">
                    <span class="text-base font-bold tracking-widest text-gray-900 bg-white rounded-lg px-3 py-1 border border-brand-100">
                      {{ svc.profile()!.referral_code }}
                    </span>
                    <button
                      (click)="svc.copyReferralCode()"
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      [class]="svc.copySuccess()
                        ? 'bg-mint-50 text-mint-700 border border-mint-500'
                        : 'bg-brand-500 text-white hover:bg-brand-600'">
                      @if (svc.copySuccess()) {
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Copiado
                      } @else {
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                        Copiar
                      }
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        }

        <!-- Main menu -->
        <section class="mx-4 mb-3">
          <div class="bg-white rounded-2xl overflow-hidden divide-y divide-gray-100 shadow-theme-xs border border-gray-100">
            @for (item of menuItems; track item.label) {
              @if (item.route) {
                <a
                  [routerLink]="item.route"
                  class="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors group">
                  <div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    [class]="item.danger ? 'bg-coral-50' : 'bg-gray-50 group-hover:bg-brand-50'">
                    <svg class="w-4 h-4 transition-colors"
                      [class]="item.danger ? 'text-coral-500' : 'text-gray-500 group-hover:text-brand-500'"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.75">
                      <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="item.icon" />
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">{{ item.label }}</p>
                    @if (item.sublabel) {
                      <p class="text-xs text-gray-400 mt-0.5 truncate">{{ item.sublabel }}</p>
                    }
                  </div>
                  @if (item.badge) {
                    <span class="flex-shrink-0 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-brand-500 text-white text-xs font-bold">
                      {{ item.badge }}
                    </span>
                  }
                  <svg class="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </a>
              } @else {
                <button
                  (click)="item.action?.()"
                  class="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors group text-left">
                  <div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    [class]="item.danger ? 'bg-coral-50' : 'bg-gray-50 group-hover:bg-brand-50'">
                    <svg class="w-4 h-4 transition-colors"
                      [class]="item.danger ? 'text-coral-500' : 'text-gray-500 group-hover:text-brand-500'"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.75">
                      <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="item.icon" />
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate"
                      [class]="item.danger ? 'text-coral-600' : 'text-gray-900'">
                      {{ item.label }}
                    </p>
                    @if (item.sublabel) {
                      <p class="text-xs text-gray-400 mt-0.5 truncate">{{ item.sublabel }}</p>
                    }
                  </div>
                  <svg class="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              }
            }
          </div>
        </section>

        <!-- Sign out -->
        <section class="mx-4 mb-6">
          <div class="bg-white rounded-2xl overflow-hidden shadow-theme-xs border border-gray-100">
            <button
              (click)="signOut()"
              class="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-coral-50 active:bg-coral-100 transition-colors group text-left">
              <div class="w-8 h-8 rounded-xl bg-coral-50 flex items-center justify-center flex-shrink-0">
                <svg class="w-4 h-4 text-coral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.75">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
              </div>
              <p class="flex-1 text-sm font-medium text-coral-600">Cerrar sesión</p>
              <svg class="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </section>

        <!-- App version -->
        <p class="text-center text-xs text-gray-300 pb-4 tracking-wide">Tutty v1.0</p>

      } <!-- end @else -->

    </div>
  `,
})
export class CustomerProfilePageComponent implements OnInit {
    readonly svc = inject(CustomerProfileService);
    private readonly auth = inject(AuthService);

    readonly menuItems: MenuItem[] = [
        {
            label: 'Mis pedidos',
            sublabel: 'Ver historial de órdenes',
            icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z',
            route: '/customer/orders',
        },
        {
            label: 'Mis direcciones',
            sublabel: 'Gestiona tus lugares de entrega',
            icon: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
            route: '/customer/addresses',
        },
        {
            label: 'Métodos de pago',
            sublabel: 'Tarjetas y billeteras',
            icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z',
            route: '/customer/payment-methods',
        },
        {
            label: 'Idioma',
            sublabel: 'Español (RD)',
            icon: 'M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802',
            route: '/customer/settings',
        },
        {
            label: 'Notificaciones',
            sublabel: 'Alertas de pedidos y promociones',
            icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
            route: '/customer/notifications',
        },
        {
            label: 'Ayuda y soporte',
            sublabel: '¿Necesitas ayuda?',
            icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z',
            route: '/customer/support',
        },
    ];

    ngOnInit(): void {
        this.svc.loadProfile();
    }

    signOut(): void {
        this.auth.signOut();
    }
}
