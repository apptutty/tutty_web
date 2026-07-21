import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { StoresService, StoreFilters } from './stores.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../shared/ui/modal/confirm.service';
import { Restaurant, CommerceType, CommissionTier, ApprovalStatus } from '../../core/supabase/database.types';
import { AdminEmptyStateComponent } from '../../shared/ui/admin-empty-state/admin-empty-state.component';

const COMMERCE_TABS: { label: string; value: CommerceType | '' }[] = [
    { label: 'Todos', value: '' },
    { label: 'Restaurantes', value: 'restaurante' },
    { label: 'Farmacias', value: 'farmacia' },
    { label: 'Bodegas', value: 'bodega' },
    { label: 'Colmados', value: 'colmado' },
    { label: 'Tiendas', value: 'tienda_ropa' },
    { label: 'Electrónica', value: 'electronica' },
    { label: 'Supermercados', value: 'supermercado' },
];

export const COMMERCE_ICONS: Record<string, string> = {
    restaurante: '🍽️',
    farmacia: '💊',
    bodega: '📦',
    colmado: '🛒',
    tienda_ropa: '👗',
    supermercado: '🛒',
    electronica: '📱',
    otro: '🏪',
};

export const COMMERCE_LABELS: Record<string, string> = {
    restaurante: 'Restaurante',
    farmacia: 'Farmacia',
    bodega: 'Bodega',
    colmado: 'Colmado',
    tienda_ropa: 'Tienda',
    supermercado: 'Supermercado',
    electronica: 'Electrónica',
    otro: 'Otro',
};

const APPROVAL_COLORS: Record<ApprovalStatus, string> = {
    pendiente: 'bg-warning-100 text-warning-700',
    aprobado: 'bg-success-100 text-success-700',
    rechazado: 'bg-error-100 text-error-700',
    suspendido: 'bg-gray-100 text-gray-600',
};

@Component({
    selector: 'app-stores-page',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule, AdminEmptyStateComponent],
    template: `
    <section class="rounded-[28px] border border-[#e7eaf1] bg-[radial-gradient(circle_at_94%_12%,rgba(235,27,141,.12),transparent_25%),linear-gradient(180deg,#fff,#fbfcff)] shadow-[0_8px_24px_rgba(18,24,40,.07)] px-6 py-5 mb-5">
      <div class="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
        <div>
          <p class="inline-flex items-center rounded-full bg-[#ffe7f4] px-3 py-1 text-[11px] font-extrabold tracking-wide text-[#c71473]">Operations · Commerce Network</p>
          <h1 class="mt-2 text-[30px] leading-[1.08] tracking-[-0.04em] font-bold text-[#111827]">Gestión de Comercios</h1>
          <p class="mt-2 max-w-4xl text-[15px] leading-6 text-[#667085]">Administra comercios, categorías, aprobación, actividad, comisión, rating y estado operativo desde un centro premium de control comercial.</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 xl:flex xl:flex-wrap xl:justify-end">
          <button class="h-11 inline-flex items-center justify-center rounded-2xl border border-[#e7eaf1] bg-white px-4 text-sm font-bold text-[#344054] hover:bg-[#f8fafc]" (click)="exportCsv()">Exportar CSV</button>
          <button class="h-11 inline-flex items-center justify-center rounded-2xl border border-[#ffd8a8] bg-[#fff6e6] px-4 text-sm font-bold text-[#b54708] hover:bg-[#ffefcf]" (click)="setApprovalFilter('pendiente')">Aprobaciones pendientes</button>
          <button class="h-11 inline-flex items-center justify-center rounded-2xl bg-[#eb1b8d] hover:bg-[#c71473] text-white px-4 text-sm font-black" (click)="openForm()">+ Nuevo comercio</button>
        </div>
      </div>
    </section>

    <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
      <article class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4 flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-[#eef4ff] text-[#2451c7] grid place-items-center text-lg">🏪</div>
        <div>
          <p class="text-xs font-extrabold text-[#7b8496]">Comercios</p>
          <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ stores().length }}</p>
          <p class="text-xs text-[#98a2b3]">registrados</p>
        </div>
      </article>
      <article class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4 flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-[#eafbf1] text-[#087b3c] grid place-items-center text-lg">🟢</div>
        <div>
          <p class="text-xs font-extrabold text-[#7b8496]">Abiertos</p>
          <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ openCount(true) }}</p>
          <p class="text-xs text-[#98a2b3]">operando ahora</p>
        </div>
      </article>
      <article class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4 flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-[#fff6e6] text-[#e46300] grid place-items-center text-lg">⏳</div>
        <div>
          <p class="text-xs font-extrabold text-[#7b8496]">Por aprobar</p>
          <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ approvalCount('pendiente') }}</p>
          <p class="text-xs text-[#98a2b3]">pendientes</p>
        </div>
      </article>
      <article class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4 flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-[#f4ecff] text-[#6d28d9] grid place-items-center text-lg">⭐</div>
        <div>
          <p class="text-xs font-extrabold text-[#7b8496]">Rating promedio</p>
          <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ averageRating() }}</p>
          <p class="text-xs text-[#98a2b3]">comercios activos</p>
        </div>
      </article>
    </section>

    <section class="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-4 mb-4">
      <aside class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] overflow-hidden self-start">
        <div class="px-5 py-5 border-b border-[#eef1f6]">
          <h3 class="text-[32px] leading-none mb-2 text-[#111827]">Red comercial</h3>
          <p class="text-sm text-[#667085]">Filtra por categoría, estado operativo, aprobación y tier.</p>
        </div>
        <div class="p-3 space-y-5">
          <div class="space-y-1.5">
            @for (tab of commerceTabs; track tab.value) {
              <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors"
                [class]="activeType() === tab.value ? 'bg-[#111827] text-white shadow-[0_8px_16px_rgba(17,24,39,.25)]' : 'text-[#344054] hover:bg-[#f8fafc]'"
                (click)="setCommerceType(tab.value)">
                <span>{{ tab.label }}</span>
                <span class="text-xs opacity-80">{{ categoryCount(tab.value) }}</span>
              </button>
            }
          </div>
          <div class="space-y-1.5">
            <p class="px-2 text-xs font-black uppercase tracking-[0.08em] text-[#98a2b3]">Estado</p>
            <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors" [class]="openFilter === 'open' ? 'bg-[#eafbf1] text-[#087b3c]' : 'text-[#475467] hover:bg-[#f8fafc]'" (click)="setOpenFilter('open')">
              <span>Abiertos</span><span class="text-xs">{{ openCount(true) }}</span>
            </button>
            <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors" [class]="openFilter === 'closed' ? 'bg-[#f4f6f9] text-[#344054]' : 'text-[#475467] hover:bg-[#f8fafc]'" (click)="setOpenFilter('closed')">
              <span>Cerrados</span><span class="text-xs">{{ openCount(false) }}</span>
            </button>
            <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors" [class]="activeStateFilter === 'active' ? 'bg-[#eafbf1] text-[#087b3c]' : 'text-[#475467] hover:bg-[#f8fafc]'" (click)="setActiveStateFilter('active')">
              <span>Activos</span><span class="text-xs">{{ activeCount(true) }}</span>
            </button>
            <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors" [class]="activeStateFilter === 'inactive' ? 'bg-[#fee2e2] text-[#b42318]' : 'text-[#475467] hover:bg-[#f8fafc]'" (click)="setActiveStateFilter('inactive')">
              <span>Inactivos</span><span class="text-xs">{{ activeCount(false) }}</span>
            </button>
          </div>
          <div class="space-y-1.5">
            <p class="px-2 text-xs font-black uppercase tracking-[0.08em] text-[#98a2b3]">Aprobación</p>
            <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors" [class]="approvalFilter === 'aprobado' ? 'bg-[#eafbf1] text-[#087b3c]' : 'text-[#475467] hover:bg-[#f8fafc]'" (click)="setApprovalFilter('aprobado')">
              <span>Aprobados</span><span class="text-xs">{{ approvalCount('aprobado') }}</span>
            </button>
            <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors" [class]="approvalFilter === 'pendiente' ? 'bg-[#fff6e6] text-[#b54708]' : 'text-[#475467] hover:bg-[#f8fafc]'" (click)="setApprovalFilter('pendiente')">
              <span>Pendientes</span><span class="text-xs">{{ approvalCount('pendiente') }}</span>
            </button>
            <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors" [class]="approvalFilter === 'rechazado' ? 'bg-[#fee2e2] text-[#b42318]' : 'text-[#475467] hover:bg-[#f8fafc]'" (click)="setApprovalFilter('rechazado')">
              <span>Rechazados</span><span class="text-xs">{{ approvalCount('rechazado') }}</span>
            </button>
          </div>
        </div>
      </aside>

      <div class="min-w-0 space-y-4">
        <section class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4">
          <div class="overflow-x-auto max-w-full mb-3">
            <div class="inline-flex gap-1 rounded-2xl border border-[#e7eaf1] bg-[#fbfcff] p-1.5 min-w-max">
              @for (tab of commerceTabs; track tab.value) {
                <button
                  (click)="setCommerceType(tab.value)"
                  class="h-10 px-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap"
                  [class]="activeType() === tab.value ? 'bg-[#111827] text-white shadow-[0_8px_18px_rgba(17,24,39,.16)]' : 'text-[#667085] hover:bg-white'"
                  [attr.aria-current]="activeType() === tab.value ? 'page' : null"
                  [attr.aria-label]="'Filtrar comercios por ' + tab.label.toLowerCase()"
                >{{ tab.label }}</button>
              }
            </div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-[minmax(300px,1fr)_220px_220px_220px_auto] gap-2 mb-3">
            <label class="h-12 rounded-2xl border border-[#e7eaf1] bg-[#fbfcff] px-3 inline-flex items-center gap-2 min-w-0">
              <span class="text-[#667085]">⌕</span>
              <input type="search" class="bg-transparent border-0 outline-0 w-full min-w-0 text-sm" placeholder="Buscar por nombre, slug, admin o categoría..." [(ngModel)]="searchText" (ngModelChange)="onSearch()" aria-label="Buscar por nombre, slug, admin o categoría" />
            </label>
            <select class="input-field text-sm !h-12 !rounded-2xl" [(ngModel)]="approvalFilter" (ngModelChange)="loadStores()" aria-label="Filtrar por aprobación">
              <option value="">Todas las aprobaciones</option>
              <option value="pendiente">Pendiente</option>
              <option value="aprobado">Aprobado</option>
              <option value="rechazado">Rechazado</option>
              <option value="suspendido">Suspendido</option>
            </select>
            <select class="input-field text-sm !h-12 !rounded-2xl" [(ngModel)]="openFilter" (ngModelChange)="loadStores()" aria-label="Filtrar por estado operativo">
              <option value="">Todos los estados</option>
              <option value="open">Abiertos</option>
              <option value="closed">Cerrados</option>
            </select>
            <select class="input-field text-sm !h-12 !rounded-2xl" [(ngModel)]="tierFilter" aria-label="Filtrar por tier">
              <option value="">Todos los tiers</option>
              <option value="onboarding">Onboarding</option>
              <option value="estandar">Estándar</option>
              <option value="medio">Medio</option>
              <option value="alto">Alto</option>
              <option value="premium">Premium</option>
            </select>
            <button class="h-12 px-4 rounded-2xl border border-[#e7eaf1] text-sm font-bold text-[#344054] hover:bg-[#f8fafc]" (click)="clearFilters()">Limpiar</button>
          </div>

          <div class="flex flex-wrap gap-2">
            <button type="button" class="h-9 rounded-full border px-3 text-sm font-bold transition-colors" [class]="isAllFiltersActive() ? 'bg-[#111827] border-[#111827] text-white' : 'border-[#e7eaf1] text-[#475467]'" (click)="resetAllFilters()">Todos {{ stores().length }}</button>
            <button type="button" class="h-9 rounded-full border px-3 text-sm font-bold transition-colors" [class]="openFilter === 'open' ? 'bg-[#eafbf1] border-[#b7efcc] text-[#087b3c]' : 'border-[#e7eaf1] text-[#475467]'" (click)="setOpenFilter('open')">Abiertos {{ openCount(true) }}</button>
            <button type="button" class="h-9 rounded-full border px-3 text-sm font-bold transition-colors" [class]="activeStateFilter === 'active' ? 'bg-[#eafbf1] border-[#b7efcc] text-[#087b3c]' : 'border-[#e7eaf1] text-[#475467]'" (click)="setActiveStateFilter('active')">Activos {{ activeCount(true) }}</button>
            <button type="button" class="h-9 rounded-full border px-3 text-sm font-bold transition-colors" [class]="approvalFilter === 'pendiente' ? 'bg-[#fff6e6] border-[#ffd8a8] text-[#b54708]' : 'border-[#e7eaf1] text-[#475467]'" (click)="setApprovalFilter('pendiente')">Pendientes {{ approvalCount('pendiente') }}</button>
            <button type="button" class="h-9 rounded-full border px-3 text-sm font-bold transition-colors" [class]="rating45Only ? 'bg-[#eef4ff] border-[#d7e3ff] text-[#2451c7]' : 'border-[#e7eaf1] text-[#475467]'" (click)="toggleRating45()">Rating 4.5+</button>
            <button type="button" class="h-9 rounded-full border px-3 text-sm font-bold transition-colors" [class]="beachDeliveryOnly ? 'bg-[#ecfeff] border-[#bae6fd] text-[#0369a1]' : 'border-[#e7eaf1] text-[#475467]'" (click)="toggleBeachDeliveryOnly()">Entrega a playa {{ beachDeliveryCount() }}</button>
          </div>
        </section>

        <div class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] overflow-hidden">
      <div class="px-5 py-4 border-b border-[#eef1f6]">
        <h3 class="text-base font-black text-[#111827]">Comercios</h3>
        <p class="text-sm font-semibold text-[#98a2b3]">{{ visibleStores().length }} comercios encontrados</p>
      </div>
      @if (loadError()) {
        <div class="p-6">
          <div class="rounded-2xl border border-[#fee2e2] bg-[#fff7f7] p-4 text-center">
            <p class="text-sm font-black text-[#b42318]">No se pudieron cargar los comercios</p>
            <p class="text-xs text-[#98a2b3] mt-1">Intenta refrescar la página o vuelve a intentarlo más tarde.</p>
            <button class="h-9 mt-3 px-4 rounded-xl border border-[#e7eaf1] bg-white text-sm font-bold text-[#344054]" (click)="loadStores()">Reintentar</button>
          </div>
        </div>
      } @else {
      <div class="overflow-x-auto">
        <table class="min-w-[1020px] w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Comercio</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Admin</th>
              <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Abierto</th>
              <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Activo</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Aprobación</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Rating</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tier</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">Acción</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-100">
            @if (loading()) {
              @for (i of [1,2,3,4,5]; track i) {
                <tr class="animate-pulse">
                  @for (j of [1,2,3,4,5,6,7,8]; track j) {
                    <td class="px-4 py-3"><div class="h-4 bg-gray-200 rounded w-3/4"></div></td>
                  }
                </tr>
              }
            } @else if (visibleStores().length === 0) {
              <tr>
                <td colspan="8" class="px-4 py-12 text-center text-gray-400">
                  <app-admin-empty-state
                    icon="map"
                    [title]="stores().length === 0 ? 'No hay comercios registrados' : 'No hay comercios para estos filtros'"
                    [description]="stores().length === 0 ? 'Los comercios aparecerán aquí cuando sean creados o aprobados.' : 'Prueba ajustando la búsqueda, categoría, aprobación o estado.'" />
                </td>
              </tr>
            } @else {
              @for (s of visibleStores(); track s.id) {
                <tr class="hover:bg-gray-50 transition-colors">
                  <!-- Comercio: logo + name + type badge -->
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      @if (s.logo_url) {
                        <img [src]="s.logo_url" class="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                      } @else {
                        <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">
                          {{ icon(s.commerce_type) }}
                        </div>
                      }
                      <div class="min-w-0">
                        <p class="font-semibold text-[#101828] truncate">{{ s.name }}</p>
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500">
                          {{ label(s.commerce_type) }}
                        </span>
                        @if (hasBeachDelivery(s)) {
                          <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 ml-1">
                            Entrega a playa
                          </span>
                        }
                      </div>
                    </div>
                  </td>
                  <!-- Admin -->
                  <td class="px-4 py-3">
                    <p class="text-gray-700">{{ s.admin_name ?? '—' }}</p>
                    <p class="text-xs text-gray-400">{{ s.admin_email ?? '—' }}</p>
                  </td>
                  <!-- Toggle is_open -->
                  <td class="px-4 py-3 text-center">
                    <button
                      class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                      [class]="s.is_open ? 'bg-success-500' : 'bg-gray-200'"
                      (click)="toggleOpen(s)"
                      [title]="s.is_open ? 'Cerrar comercio' : 'Abrir comercio'"
                      role="switch"
                      [attr.aria-checked]="s.is_open"
                      [attr.aria-label]="s.is_open ? 'Cerrar comercio ' + s.name : 'Abrir comercio ' + s.name"
                    >
                      <span class="inline-block w-4 h-4 transform rounded-full bg-white shadow transition-transform"
                        [class]="s.is_open ? 'translate-x-4' : 'translate-x-0.5'"></span>
                    </button>
                  </td>
                  <!-- Toggle is_active -->
                  <td class="px-4 py-3 text-center">
                    <button
                      class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                      [class]="s.is_active ? 'bg-success-500' : 'bg-gray-200'"
                      (click)="toggleActive(s)"
                      [title]="s.is_active ? 'Desactivar' : 'Activar'"
                      role="switch"
                      [attr.aria-checked]="s.is_active"
                      [attr.aria-label]="s.is_active ? 'Desactivar comercio ' + s.name : 'Activar comercio ' + s.name"
                    >
                      <span class="inline-block w-4 h-4 transform rounded-full bg-white shadow transition-transform"
                        [class]="s.is_active ? 'translate-x-4' : 'translate-x-0.5'"></span>
                    </button>
                  </td>
                  <!-- Approval -->
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                      [class]="approvalColor(s.approval_status)">
                      {{ s.approval_status }}
                    </span>
                  </td>
                  <!-- Rating -->
                  <td class="px-4 py-3 text-gray-600">⭐ {{ s.avg_rating | number:'1.1-1' }}</td>
                  <!-- Tier -->
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {{ tierLabel(s.commission_tier!) }} ({{ (s.commission_rate * 100).toFixed(0) }}%)
                    </span>
                  </td>
                  <!-- Actions dropdown -->
                  <td class="px-4 py-3 text-right">
                    <div class="relative inline-block">
                      <button
                        class="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                        (click)="$event.stopPropagation(); toggleMenu(s.id)"
                        title="Acciones"
                        aria-label="Abrir acciones del comercio"
                        aria-haspopup="menu"
                        [attr.aria-expanded]="openMenuId === s.id"
                        [attr.aria-controls]="'store-actions-menu-' + s.id"
                      >
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                        </svg>
                      </button>
                      @if (openMenuId === s.id) {
                        <div [id]="'store-actions-menu-' + s.id" role="menu" class="absolute right-0 top-9 z-50 bg-white rounded-xl shadow-theme-lg border border-gray-100 py-1 min-w-[168px]">
                          <button (click)="router.navigate(['/stores', s.id]); closeMenu()"
                            class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">
                            👁 Ver detalle
                          </button>
                          <button (click)="openForm(s); closeMenu()"
                            class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">
                            ✏️ Editar
                          </button>
                          <button (click)="router.navigate(['/stores', s.id, 'catalog']); closeMenu()"
                            class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">
                            📦 Ver catálogo
                          </button>
                          <button (click)="router.navigate(['/restaurants', s.id, 'zones']); closeMenu()"
                            class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">
                            📍 Zonas
                          </button>
                          <div class="border-t border-gray-100 my-1"></div>
                          <button (click)="deleteStore(s); closeMenu()"
                            class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-error-600 hover:bg-error-50 text-left">
                            🗑️ Eliminar
                          </button>
                        </div>
                      }
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
      <!-- Footer count -->
      @if (!loading() && visibleStores().length > 0) {
        <div class="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
          {{ visibleStores().length }} comercio{{ visibleStores().length !== 1 ? 's' : '' }}
        </div>
      }
      }
        </div>
      </div>
    </section>

    <!-- Form Modal -->
    @if (showForm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="showForm.set(false)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10">
          <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <h3 class="font-semibold text-gray-800">
              {{ editingStore() ? 'Editar comercio' : 'Nuevo comercio' }}
            </h3>
            <button aria-label="Cerrar modal de comercio" class="text-gray-400 hover:text-gray-600" (click)="showForm.set(false)">✕</button>
          </div>
          <form [formGroup]="storeForm" (ngSubmit)="saveStore()" class="p-6 space-y-6">
            <!-- Basic -->
            <div>
              <h4 class="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">Información básica</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="label">Nombre *</label>
                  <input class="input-field" formControlName="name" placeholder="Ej: Farmacia Cruz Verde" />
                </div>
                <div>
                  <label class="label">Slug *</label>
                  <input class="input-field" formControlName="slug" placeholder="farmacia-cruz-verde" />
                </div>
                <div>
                  <label class="label">Tipo de comercio *</label>
                  <select class="input-field" formControlName="commerce_type">
                    <option value="restaurante">🍽️ Restaurante</option>
                    <option value="farmacia">💊 Farmacia</option>
                    <option value="bodega">📦 Bodega</option>
                    <option value="colmado">🛒 Colmado</option>
                    <option value="tienda_ropa">👗 Tienda de Ropa</option>
                    <option value="supermercado">🛒 Supermercado</option>
                    <option value="electronica">📱 Electrónica</option>
                    <option value="otro">🏪 Otro</option>
                  </select>
                </div>
                <div>
                  <label class="label">WhatsApp</label>
                  <input class="input-field" formControlName="whatsapp_number" placeholder="8091234567" />
                </div>
                <div class="sm:col-span-2">
                  <label class="label">Descripción</label>
                  <textarea class="input-field resize-none" rows="2" formControlName="description"></textarea>
                </div>
              </div>
            </div>
            <!-- Location -->
            <div>
              <h4 class="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">Ubicación</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="sm:col-span-2">
                  <label class="label">Dirección *</label>
                  <input class="input-field" formControlName="address" />
                </div>
                <div>
                  <label class="label">Sector</label>
                  <input class="input-field" formControlName="sector" />
                </div>
                <div>
                  <label class="label">Ciudad *</label>
                  <input class="input-field" formControlName="city" />
                </div>
              </div>
            </div>
            <!-- Commission -->
            <div>
              <h4 class="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">Comisión</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="label">Tier</label>
                  <select class="input-field" formControlName="commission_tier">
                    <option value="onboarding">Onboarding</option>
                    <option value="estandar">Estándar</option>
                    <option value="medio">Medio</option>
                    <option value="alto">Alto</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div>
                  <label class="label">Tasa (%)</label>
                  <input class="input-field" type="number" step="0.1" min="1" max="99" formControlName="commission_rate_pct" />
                </div>
                <div>
                  <label class="label">Pedido mínimo (RD$)</label>
                  <input class="input-field" type="number" formControlName="min_order_amount" />
                </div>
                <div>
                  <label class="label">Tiempo delivery (min)</label>
                  <input class="input-field" type="number" formControlName="avg_delivery_time" />
                </div>
              </div>
            </div>
            <div class="flex gap-3 justify-end pt-2">
              <button type="button" class="btn-secondary" (click)="showForm.set(false)">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="storeForm.invalid || saveLoading()">
                {{ saveLoading() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class StoresPageComponent implements OnInit, OnDestroy {
    private readonly service = inject(StoresService);
    private readonly toast = inject(ToastService);
    private readonly confirm = inject(ConfirmService);
    private readonly fb = inject(FormBuilder);
    readonly router = inject(Router);

    readonly stores = signal<Restaurant[]>([]);
    readonly loading = signal(true);
    readonly loadError = signal(false);
    readonly showForm = signal(false);
    readonly editingStore = signal<Restaurant | null>(null);
    readonly saveLoading = signal(false);
    readonly activeType = signal<CommerceType | ''>('');

    searchText = '';
    approvalFilter: ApprovalStatus | '' = '';
    openFilter: 'open' | 'closed' | '' = '';
    tierFilter: CommissionTier | '' = '';
    activeStateFilter: 'active' | 'inactive' | '' = '';
    rating45Only = false;
    beachDeliveryOnly = false;
    openMenuId: string | null = null;
    private searchTimeout: any;

    toggleMenu(id: string): void {
        this.openMenuId = this.openMenuId === id ? null : id;
    }

    closeMenu(): void {
        this.openMenuId = null;
    }

    readonly commerceTabs = COMMERCE_TABS;
    readonly visibleStores = computed(() => {
        let list = this.stores();

        if (this.tierFilter) {
            list = list.filter((s) => s.commission_tier === this.tierFilter);
        }

        if (this.activeStateFilter === 'active') {
            list = list.filter((s) => !!s.is_active);
        } else if (this.activeStateFilter === 'inactive') {
            list = list.filter((s) => !s.is_active);
        }

        if (this.rating45Only) {
            list = list.filter((s) => Number(s.avg_rating ?? 0) >= 4.5);
        }
        if (this.beachDeliveryOnly) {
            list = list.filter((s) => this.hasBeachDelivery(s));
        }

        return list;
    });

    readonly storeForm = this.fb.group({
        name: ['', Validators.required],
        slug: ['', Validators.required],
        description: [''],
        commerce_type: ['restaurante' as CommerceType, Validators.required],
        whatsapp_number: [''],
        address: ['', Validators.required],
        sector: [''],
        city: ['Santo Domingo', Validators.required],
        commission_tier: ['estandar' as CommissionTier],
        commission_rate_pct: [10, [Validators.min(1), Validators.max(99)]],
        min_order_amount: [200],
        avg_delivery_time: [30],
    });

    ngOnInit(): void { this.loadStores(); }
    ngOnDestroy(): void { clearTimeout(this.searchTimeout); }

    loadStores(): void {
        this.loading.set(true);
        this.loadError.set(false);
        const filters: StoreFilters = {
            commerce_type: this.activeType(),
            approval_status: this.approvalFilter,
            open_status: this.openFilter,
            search: this.searchText || undefined,
            beach_delivery_only: this.beachDeliveryOnly,
        };
        this.service.getStores(filters).subscribe({
            next: (data) => { this.stores.set(data); this.loading.set(false); },
            error: () => { this.toast.error('Error al cargar comercios'); this.loading.set(false); this.loadError.set(true); },
        });
    }

    setCommerceType(type: CommerceType | ''): void {
        this.activeType.set(type);
        this.loadStores();
    }

    onSearch(): void {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => this.loadStores(), 300);
    }

    clearFilters(): void {
        this.approvalFilter = '';
        this.openFilter = '';
        this.tierFilter = '';
        this.activeStateFilter = '';
        this.rating45Only = false;
        this.beachDeliveryOnly = false;
        this.loadStores();
    }

    resetAllFilters(): void {
        this.activeType.set('');
        this.clearFilters();
    }

    setApprovalFilter(value: ApprovalStatus | ''): void {
        this.approvalFilter = value;
        this.loadStores();
    }

    setOpenFilter(value: 'open' | 'closed' | ''): void {
        this.openFilter = value;
        this.loadStores();
    }

    setActiveStateFilter(value: 'active' | 'inactive' | ''): void {
        this.activeStateFilter = value;
    }

    approvalCount(status: ApprovalStatus): number {
        return this.stores().filter(s => s.approval_status === status).length;
    }

    openCount(isOpen: boolean): number {
        return this.stores().filter(s => !!s.is_open === isOpen).length;
    }

    activeCount(isActive: boolean): number {
        return this.stores().filter(s => !!s.is_active === isActive).length;
    }

    categoryCount(type: CommerceType | ''): number {
        if (!type) return this.stores().length;
        return this.stores().filter((s) => s.commerce_type === type).length;
    }

    averageRating(): string {
        const list = this.stores();
        if (!list.length) return '0.0';
        const sum = list.reduce((acc, store) => acc + Number(store.avg_rating ?? 0), 0);
        return (sum / list.length).toFixed(1);
    }

    toggleRating45(): void {
        this.rating45Only = !this.rating45Only;
    }

    isAllFiltersActive(): boolean {
        return !this.activeType() && !this.approvalFilter && !this.openFilter && !this.tierFilter && !this.activeStateFilter && !this.rating45Only && !this.beachDeliveryOnly;
    }

    toggleBeachDeliveryOnly(): void {
        this.beachDeliveryOnly = !this.beachDeliveryOnly;
        this.loadStores();
    }

    hasBeachDelivery(store: Restaurant): boolean {
        return (store as any)?.is_beach_delivery === true;
    }

    beachDeliveryCount(): number {
        return this.stores().filter((store) => this.hasBeachDelivery(store)).length;
    }

    exportCsv(): void {
        const rows = this.visibleStores();
        const header = ['comercio', 'categoria', 'admin', 'admin_email', 'abierto', 'activo', 'playa', 'aprobacion', 'rating', 'tier'];
        const csv = [
            header.join(','),
            ...rows.map((s) => [
                this.escapeCsv(s.name),
                this.escapeCsv(this.label(s.commerce_type)),
                this.escapeCsv(s.admin_name ?? ''),
                this.escapeCsv(s.admin_email ?? ''),
                s.is_open ? 'si' : 'no',
                s.is_active ? 'si' : 'no',
                this.hasBeachDelivery(s) ? 'si' : 'no',
                this.escapeCsv(s.approval_status ?? ''),
                Number(s.avg_rating ?? 0).toFixed(1),
                this.escapeCsv(this.tierLabel(s.commission_tier)),
            ].join(',')),
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'comercios.csv';
        anchor.click();
        URL.revokeObjectURL(url);
    }

    openForm(store?: Restaurant): void {
        this.editingStore.set(store ?? null);
        if (store) {
            this.storeForm.patchValue({
                ...store,
                commission_rate_pct: Math.round(store.commission_rate * 100),
            });
        } else {
            this.storeForm.reset({
                city: 'Santo Domingo',
                commerce_type: 'restaurante',
                commission_tier: 'estandar',
                commission_rate_pct: 10,
                min_order_amount: 200,
                avg_delivery_time: 30,
            });
        }
        this.showForm.set(true);
    }

    async saveStore(): Promise<void> {
        if (this.storeForm.invalid) return;
        this.saveLoading.set(true);
        const val = this.storeForm.getRawValue();
        const payload: Partial<Restaurant> = {
            ...(this.editingStore() ? { id: this.editingStore()!.id } : {}),
            name: val.name!,
            slug: val.slug!.toLowerCase().replace(/\s+/g, '-'),
            description: val.description ?? null,
            commerce_type: val.commerce_type as CommerceType,
            whatsapp_number: val.whatsapp_number ?? null,
            address: val.address!,
            sector: val.sector ?? null,
            city: val.city!,
            commission_tier: val.commission_tier as CommissionTier,
            commission_rate: (val.commission_rate_pct ?? 10) / 100,
            min_order_amount: val.min_order_amount ?? 200,
            avg_delivery_time: val.avg_delivery_time ?? 30,
        };
        try {
            await this.service.saveStore(payload);
            this.toast.success(this.editingStore() ? 'Comercio actualizado' : 'Comercio creado');
            this.showForm.set(false);
            this.loadStores();
        } catch {
            this.toast.error('Error al guardar comercio');
        } finally {
            this.saveLoading.set(false);
        }
    }

    async toggleOpen(store: Restaurant): Promise<void> {
        try {
            await this.service.toggleOpen(store.id, !store.is_open);
            this.stores.update(list => list.map(s => s.id === store.id ? { ...s, is_open: !s.is_open } : s));
        } catch { this.toast.error('Error al cambiar estado'); }
    }

    async toggleActive(store: Restaurant): Promise<void> {
        try {
            await this.service.toggleActive(store.id, !store.is_active);
            this.stores.update(list => list.map(s => s.id === store.id ? { ...s, is_active: !s.is_active } : s));
        } catch { this.toast.error('Error al cambiar estado'); }
    }

    async deleteStore(store: Restaurant): Promise<void> {
        const ok = await this.confirm.confirm({ title: `¿Eliminar "${store.name}"?`, message: 'Esta acción no se puede deshacer.', danger: true });
        if (!ok) return;
        try {
            await this.service.deleteStore(store.id);
            this.stores.update(list => list.filter(s => s.id !== store.id));
            this.toast.success('Comercio eliminado');
        } catch { this.toast.error('Error al eliminar (puede tener pedidos asociados)'); }
    }

    icon(type: CommerceType): string { return COMMERCE_ICONS[type] ?? '🏪'; }
    label(type: CommerceType): string { return COMMERCE_LABELS[type] ?? type; }
    approvalColor(status: ApprovalStatus): string { return APPROVAL_COLORS[status] ?? 'bg-gray-100 text-gray-600'; }
    tierLabel(tier: CommissionTier | null | undefined): string {
        const map: Record<CommissionTier, string> = { onboarding: 'Onb.', estandar: 'Est.', medio: 'Med.', alto: 'Alto', premium: 'Prem.' };
        return tier ? (map[tier] ?? tier) : '—';
    }

    private escapeCsv(value: string): string {
        return `"${value.replaceAll('"', '""')}"`;
    }
}
