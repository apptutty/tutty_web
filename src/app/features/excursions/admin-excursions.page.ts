import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ExcursionsService } from './excursions.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { DataTableComponent, TableColumn } from '../../shared/ui/data-table/data-table.component';
import { AdminEmptyStateComponent } from '../../shared/ui/admin-empty-state/admin-empty-state.component';
import { ExcursionOperator, Excursion, ExcursionDate, BookingStatus } from '../../core/supabase/database.types';

type ActiveTab = 'operadores' | 'excursiones' | 'reservas' | 'categorias';

@Component({
  selector: 'app-excursions-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DataTableComponent, RouterLink, AdminEmptyStateComponent],
  template: `
    <section class="rounded-[28px] border border-[#e7eaf1] bg-[radial-gradient(circle_at_94%_12%,rgba(235,27,141,.12),transparent_25%),linear-gradient(180deg,#fff,#fbfcff)] shadow-[0_8px_24px_rgba(18,24,40,.07)] px-6 py-5 mb-5">
      <div class="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
        <div>
          <p class="inline-flex items-center rounded-full bg-[#ffe7f4] px-3 py-1 text-[11px] font-extrabold tracking-wide text-[#c71473]">Operations · Excursions Network</p>
          <h1 class="mt-2 text-[30px] leading-[1.08] tracking-[-0.04em] font-bold text-[#111827]">Excursiones</h1>
          <p class="mt-2 max-w-4xl text-[15px] leading-6 text-[#667085]">
            Gestiona operadores, excursiones, reservas y categorías turísticas desde un centro operativo premium para experiencias en la plataforma.
          </p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 xl:flex xl:flex-wrap xl:justify-end">
          <button class="h-11 inline-flex items-center justify-center rounded-2xl border border-[#e7eaf1] bg-white px-4 text-sm font-bold text-[#344054] hover:bg-[#f8fafc]" (click)="exportOperatorsCsv()">Exportar CSV</button>
          <button class="h-11 inline-flex items-center justify-center rounded-2xl border border-[#ffd8a8] bg-[#fff6e6] px-4 text-sm font-bold text-[#b54708] hover:bg-[#ffefcf]" (click)="setOperatorStatusFilter('pendiente')">Revisar pendientes</button>
          @if (activeTab() === 'operadores') {
            <button class="h-11 inline-flex items-center justify-center rounded-2xl bg-[#eb1b8d] hover:bg-[#c71473] text-white px-4 text-sm font-black" (click)="openOperatorModal()">+ Operador</button>
          } @else if (activeTab() === 'excursiones') {
            <button class="h-11 inline-flex items-center justify-center rounded-2xl bg-[#eb1b8d] hover:bg-[#c71473] text-white px-4 text-sm font-black" (click)="router.navigate(['/excursions/excursion/new'])">+ Excursión</button>
          }
        </div>
      </div>
    </section>

    <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
      <article class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4 flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-[#eef4ff] text-[#2451c7] grid place-items-center text-lg">🧭</div>
        <div>
          <p class="text-xs font-extrabold text-[#7b8496]">Operadores</p>
          <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ operators().length }}</p>
          <p class="text-xs text-[#98a2b3]">aprobados en plataforma</p>
        </div>
      </article>
      <article class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4 flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-[#eafbf1] text-[#087b3c] grid place-items-center text-lg">⭐</div>
        <div>
          <p class="text-xs font-extrabold text-[#7b8496]">Rating promedio</p>
          <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ avgOperatorRating() }}</p>
          <p class="text-xs text-[#98a2b3]">basado en reseñas</p>
        </div>
      </article>
      <article class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4 flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-[#fff6e6] text-[#e46300] grid place-items-center text-lg">📝</div>
        <div>
          <p class="text-xs font-extrabold text-[#7b8496]">Reseñas</p>
          <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ totalOperatorReviews() }}</p>
          <p class="text-xs text-[#98a2b3]">en operadores activos</p>
        </div>
      </article>
      <article class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4 flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-[#ffe7f4] text-[#c71473] grid place-items-center text-lg">✅</div>
        <div>
          <p class="text-xs font-extrabold text-[#7b8496]">Activos</p>
          <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ activeOperatorsCount() }}</p>
          <p class="text-xs text-[#98a2b3]">disponibles para reservas</p>
        </div>
      </article>
    </section>

    <section class="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start">
      <aside class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] overflow-hidden">
        <div class="px-5 py-4 border-b border-[#eef1f6]">
          <h2 class="text-[16px] leading-tight tracking-[-0.02em] font-black text-[#111827]">Centro de excursiones</h2>
          <p class="mt-2 text-sm leading-5 text-[#667085]">Filtra operadores, reservas y categorías por estado operativo.</p>
        </div>
        <div class="p-3">
          <button type="button" class="w-full h-11 rounded-2xl px-3 mb-1 flex items-center justify-between text-left text-sm font-extrabold transition-colors"
                  [class]="activeTab() === 'operadores' ? 'bg-[#111827] text-white shadow-[0_8px_18px_rgba(17,24,39,.16)]' : 'text-[#475467] hover:bg-[#f8fafc]'"
                  (click)="setTab('operadores')">
            <span class="inline-flex items-center gap-2">🧭 Operadores</span><span [class]="activeTab() === 'operadores' ? 'text-white/80' : 'text-[#98a2b3]'">{{ operators().length }}</span>
          </button>
          <button type="button" class="w-full h-11 rounded-2xl px-3 mb-1 flex items-center justify-between text-left text-sm font-extrabold transition-colors"
                  [class]="activeTab() === 'excursiones' ? 'bg-[#111827] text-white shadow-[0_8px_18px_rgba(17,24,39,.16)]' : 'text-[#475467] hover:bg-[#f8fafc]'"
                  (click)="setTab('excursiones')">
            <span class="inline-flex items-center gap-2">🌴 Excursiones</span><span [class]="activeTab() === 'excursiones' ? 'text-white/80' : 'text-[#98a2b3]'">{{ excursions().length }}</span>
          </button>
          <button type="button" class="w-full h-11 rounded-2xl px-3 mb-1 flex items-center justify-between text-left text-sm font-extrabold transition-colors"
                  [class]="activeTab() === 'reservas' ? 'bg-[#111827] text-white shadow-[0_8px_18px_rgba(17,24,39,.16)]' : 'text-[#475467] hover:bg-[#f8fafc]'"
                  (click)="setTab('reservas')">
            <span class="inline-flex items-center gap-2">📅 Reservas</span><span [class]="activeTab() === 'reservas' ? 'text-white/80' : 'text-[#98a2b3]'">{{ bookings().length }}</span>
          </button>
          <button type="button" class="w-full h-11 rounded-2xl px-3 mb-2 flex items-center justify-between text-left text-sm font-extrabold transition-colors"
                  [class]="activeTab() === 'categorias' ? 'bg-[#111827] text-white shadow-[0_8px_18px_rgba(17,24,39,.16)]' : 'text-[#475467] hover:bg-[#f8fafc]'"
                  (click)="setTab('categorias')">
            <span class="inline-flex items-center gap-2">🏷️ Categorías</span><span [class]="activeTab() === 'categorias' ? 'text-white/80' : 'text-[#98a2b3]'">{{ excursionCategories().length }}</span>
          </button>

          <p class="mt-3 mb-2 px-2 text-[11px] tracking-[0.12em] uppercase text-[#98a2b3] font-black">Por estado</p>
          <button type="button" class="w-full h-10 rounded-xl px-3 mb-1 flex items-center justify-between text-left text-sm font-bold transition-colors"
                  [class]="operatorStatusFilter === 'aprobado' ? 'bg-[#111827] text-white' : 'text-[#475467] hover:bg-[#f8fafc]'"
                  (click)="setOperatorStatusFilter('aprobado')">✅ Aprobados <span [class]="operatorStatusFilter === 'aprobado' ? 'text-white/80' : 'text-[#98a2b3]'">{{ approvedOperatorsCount() }}</span></button>
          <button type="button" class="w-full h-10 rounded-xl px-3 mb-1 flex items-center justify-between text-left text-sm font-bold transition-colors"
                  [class]="operatorStatusFilter === 'pendiente' ? 'bg-[#111827] text-white' : 'text-[#475467] hover:bg-[#f8fafc]'"
                  (click)="setOperatorStatusFilter('pendiente')">🟡 Pendientes <span [class]="operatorStatusFilter === 'pendiente' ? 'text-white/80' : 'text-[#98a2b3]'">{{ pendingOperatorsCount() }}</span></button>
          <button type="button" class="w-full h-10 rounded-xl px-3 mb-2 flex items-center justify-between text-left text-sm font-bold transition-colors"
                  [class]="operatorStatusFilter === 'suspendido' ? 'bg-[#111827] text-white' : 'text-[#475467] hover:bg-[#f8fafc]'"
                  (click)="setOperatorStatusFilter('suspendido')">⛔ Suspendidos <span [class]="operatorStatusFilter === 'suspendido' ? 'text-white/80' : 'text-[#98a2b3]'">{{ suspendedOperatorsCount() }}</span></button>

          <p class="mt-3 mb-2 px-2 text-[11px] tracking-[0.12em] uppercase text-[#98a2b3] font-black">Categorías</p>
          @for (cat of sideCategoryItems; track cat.key) {
            <button type="button" class="w-full h-10 rounded-xl px-3 mb-1 flex items-center justify-between text-left text-sm font-bold transition-colors"
                    [class]="operatorCategoryFilter === cat.key ? 'bg-[#111827] text-white' : 'text-[#475467] hover:bg-[#f8fafc]'"
                    (click)="setOperatorCategoryFilter(cat.key)">
              <span>{{ cat.icon }} {{ cat.label }}</span>
              <span [class]="operatorCategoryFilter === cat.key ? 'text-white/80' : 'text-[#98a2b3]'">{{ categoryCount(cat.key) }}</span>
            </button>
          }
        </div>
      </aside>

      <div class="space-y-4 min-w-0">
        <div class="rounded-2xl border border-[#e7eaf1] bg-[#fbfcff] p-1.5 inline-flex flex-wrap gap-1 max-w-full overflow-x-auto">
          @for (tab of tabs; track tab.key) {
            <button class="h-10 px-4 rounded-xl text-sm font-bold transition-all whitespace-nowrap"
                    [class]="activeTab() === tab.key ? 'bg-[#111827] text-white shadow-[0_8px_18px_rgba(17,24,39,.16)]' : 'text-[#667085] hover:bg-white/70'"
                    [attr.aria-current]="activeTab() === tab.key ? 'page' : null"
                    (click)="setTab(tab.key)">
              {{ tab.label }}
            </button>
          }
        </div>

        @if (activeTab() === 'operadores') {
          @let operatorRows = filteredOperators();
          <section class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4">
            <div class="grid grid-cols-1 xl:grid-cols-[minmax(260px,1fr)_220px_220px_220px_auto] gap-2 mb-3">
              <label class="h-12 rounded-2xl border border-[#e7eaf1] bg-[#fbfcff] px-3 inline-flex items-center gap-2 min-w-0">
                <span class="text-[#667085]">⌕</span>
                <input type="search" class="bg-transparent border-0 outline-0 w-full min-w-0 text-sm"
                       placeholder="Buscar operador, categoría o destino..."
                       [(ngModel)]="operatorSearch"
                       aria-label="Buscar operador, categoría o destino" />
              </label>
              <select class="input-field text-sm !h-12 !rounded-2xl" [(ngModel)]="operatorCategorySelect" (ngModelChange)="setOperatorCategoryFromSelect()" aria-label="Todas las categorías">
                <option value="all">Todas las categorías</option>
                <option value="aventura">Aventura</option>
                <option value="playa">Playa</option>
                <option value="cultural">Cultural</option>
                <option value="montana">Montaña</option>
                <option value="none">Sin categoría</option>
              </select>
              <select class="input-field text-sm !h-12 !rounded-2xl" [(ngModel)]="operatorStatusSelect" (ngModelChange)="setOperatorStatusFromSelect()" aria-label="Todos los estados">
                <option value="all">Todos los estados</option>
                <option value="aprobado">Aprobado</option>
                <option value="pendiente">Pendiente</option>
                <option value="suspendido">Suspendido</option>
              </select>
              <select class="input-field text-sm !h-12 !rounded-2xl" [(ngModel)]="operatorSort" aria-label="Más reseñas">
                <option value="reviews_desc">Más reseñas</option>
                <option value="rating_desc">Mejor rating</option>
                <option value="name_asc">Nombre A-Z</option>
              </select>
              <button class="h-12 px-4 rounded-2xl border border-[#e7eaf1] text-sm font-bold text-[#344054] hover:bg-[#f8fafc]" (click)="exportOperatorsCsv()">Exportar</button>
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="h-9 rounded-full border px-3 text-sm font-bold transition-colors"
                      [class]="operatorQuickFilter === 'all' ? 'bg-[#111827] border-[#111827] text-white' : 'border-[#e7eaf1] text-[#475467]'"
                      (click)="setOperatorQuickFilter('all')">Todos {{ operators().length }}</button>
              <button class="h-9 rounded-full border px-3 text-sm font-bold transition-colors"
                      [class]="operatorQuickFilter === 'approved' ? 'bg-[#eafbf1] border-[#b7efcc] text-[#087b3c]' : 'border-[#e7eaf1] text-[#475467]'"
                      (click)="setOperatorQuickFilter('approved')">Aprobados {{ approvedOperatorsCount() }}</button>
              <button class="h-9 rounded-full border px-3 text-sm font-bold transition-colors"
                      [class]="operatorQuickFilter === 'active' ? 'bg-[#eafbf1] border-[#b7efcc] text-[#087b3c]' : 'border-[#e7eaf1] text-[#475467]'"
                      (click)="setOperatorQuickFilter('active')">Activos {{ activeOperatorsCount() }}</button>
              <button class="h-9 rounded-full border px-3 text-sm font-bold transition-colors"
                      [class]="operatorQuickFilter === 'pending' ? 'bg-[#fff6e6] border-[#ffd8a8] text-[#b54708]' : 'border-[#e7eaf1] text-[#475467]'"
                      (click)="setOperatorQuickFilter('pending')">Pendientes {{ pendingOperatorsCount() }}</button>
              <button class="h-9 rounded-full border px-3 text-sm font-bold transition-colors"
                      [class]="operatorQuickFilter === 'rating48' ? 'bg-[#111827] border-[#111827] text-white' : 'border-[#e7eaf1] text-[#475467]'"
                      (click)="setOperatorQuickFilter('rating48')">Rating 4.8+</button>
            </div>
          </section>

          <section class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] overflow-hidden">
            <div class="px-5 py-4 border-b border-[#eef1f6] flex items-center justify-between gap-2">
              <div>
                <h3 class="text-base font-black text-[#111827]">Operadores de excursiones</h3>
                <p class="text-sm font-semibold text-[#98a2b3]">{{ operatorRows.length }} operadores encontrados</p>
              </div>
              <button class="h-11 rounded-2xl border border-[#e7eaf1] bg-white px-4 text-sm font-bold text-[#344054]">Vista tabla</button>
            </div>

            @if (loading()) {
              <div class="p-4 space-y-2 animate-pulse">
                @for (_ of [1,2,3,4,5,6]; track $index) {
                  <div class="h-12 rounded-xl bg-gray-100"></div>
                }
              </div>
            } @else if (loadError()) {
              <div class="p-6">
                <div class="rounded-2xl border border-[#fee2e2] bg-[#fff7f7] p-4 text-center">
                  <p class="text-sm font-black text-[#b42318]">No se pudieron cargar las excursiones</p>
                  <p class="text-xs text-[#98a2b3] mt-1">Intenta refrescar la página o vuelve a intentarlo más tarde.</p>
                  <button class="h-9 mt-3 px-4 rounded-xl border border-[#e7eaf1] bg-white text-sm font-bold text-[#344054]" (click)="loadTabData()">Reintentar</button>
                </div>
              </div>
            } @else if (operatorRows.length === 0) {
              <div class="p-6">
                <app-admin-empty-state
                  icon="search"
                  [title]="operators().length === 0 ? 'No hay operadores registrados' : 'No hay operadores para estos filtros'"
                  [description]="operators().length === 0 ? 'Los operadores de excursiones aparecerán aquí cuando sean creados o aprobados.' : 'Prueba cambiando la búsqueda, categoría, estado o filtros activos.'"
                  variant="soft" />
              </div>
            } @else {
              <div class="overflow-x-auto">
                <table class="min-w-full text-sm">
                  <thead class="bg-[#fbfcff] border-b border-[#e7eaf1]">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-black text-[#667085] uppercase">Operador</th>
                      <th class="px-4 py-3 text-left text-xs font-black text-[#667085] uppercase">Categoría</th>
                      <th class="px-4 py-3 text-left text-xs font-black text-[#667085] uppercase">Rating</th>
                      <th class="px-4 py-3 text-left text-xs font-black text-[#667085] uppercase">Reseñas</th>
                      <th class="px-4 py-3 text-left text-xs font-black text-[#667085] uppercase">Estado</th>
                      <th class="px-4 py-3 text-left text-xs font-black text-[#667085] uppercase">Activo</th>
                      <th class="px-4 py-3 text-right text-xs font-black text-[#667085] uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-[#eef1f6]">
                    @for (op of operatorRows; track op.id) {
                      <tr class="hover:bg-[#fbfcff] transition-colors">
                        <td class="px-4 py-3">
                          <div class="flex items-center gap-3 min-w-0">
                            <div class="w-11 h-11 rounded-2xl bg-[#f4f6f9] border border-[#eef1f6] overflow-hidden grid place-items-center text-lg flex-shrink-0">
                              @if ($any(op).logo_url) {
                                <img [src]="$any(op).logo_url" class="w-full h-full object-cover" alt="" />
                              } @else { 🧭 }
                            </div>
                            <div class="min-w-0">
                              <p class="font-black text-[#111827] truncate">{{ op.name }}</p>
                              <p class="text-xs text-[#98a2b3] truncate">{{ operatorSubtitle(op) }}</p>
                            </div>
                          </div>
                        </td>
                        <td class="px-4 py-3">
                          <span class="inline-flex rounded-full px-2.5 py-1 text-[11px] font-black"
                                [class]="categoryBadgeClass(op.category)">
                            {{ displayCategory(op.category) }}
                          </span>
                        </td>
                        <td class="px-4 py-3 font-black text-[#111827]">⭐ {{ operatorRating(op) }}</td>
                        <td class="px-4 py-3 font-black text-[#111827]">{{ operatorReviews(op) }}</td>
                        <td class="px-4 py-3">
                          <span class="inline-flex rounded-full px-2.5 py-1 text-[11px] font-black"
                                [class]="statusBadgeClass(operatorApprovalStatus(op))">
                            {{ displayStatus(operatorApprovalStatus(op)) }}
                          </span>
                        </td>
                        <td class="px-4 py-3">
                          <button class="relative w-11 h-6 rounded-full transition-colors"
                                  [class]="op.is_active ? 'bg-success-400' : 'bg-gray-300'"
                                  (click)="toggleOperatorActive(op)"
                                  role="switch"
                                  [attr.aria-checked]="op.is_active"
                                  [attr.aria-label]="op.is_active ? 'Desactivar operador ' + op.name : 'Activar operador ' + op.name">
                            <span class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                                  [style.left]="op.is_active ? '21px' : '2px'"></span>
                          </button>
                        </td>
                        <td class="px-4 py-3">
                          <div class="flex items-center justify-end gap-1">
                            <button class="w-9 h-9 rounded-xl border border-[#e7eaf1] text-[#667085] hover:bg-[#f8fafc]" [attr.aria-label]="'Editar operador ' + op.name" (click)="openOperatorModal(op)">✎</button>
                            <button class="w-9 h-9 rounded-xl border border-[#e7eaf1] text-[#667085] hover:bg-[#f8fafc]" [attr.aria-label]="'Ver operador ' + op.name" (click)="router.navigate(['/excursions/operators', op.id])">⌕</button>
                            <button class="w-9 h-9 rounded-xl border border-[#e7eaf1] text-[#667085] hover:bg-[#f8fafc]" [attr.aria-label]="'Más acciones de ' + op.name">…</button>
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>
        }

    <!-- Excursions tab -->
    @if (activeTab() === 'excursiones') {
      @let excursionRows = filteredExcursions();
      <div class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4">
        <div class="flex flex-wrap gap-3 mb-4">
          <input type="search" class="input-field max-w-xs" placeholder="Buscar excursión..." [(ngModel)]="excursionSearch" aria-label="Buscar excursiones por nombre u operador" />
          <select class="input-field w-44" [(ngModel)]="difficultyFilter" aria-label="Filtrar excursiones por dificultad">
            <option value="">Todas las dificultades</option>
            <option value="facil">Fácil</option>
            <option value="moderado">Moderado</option>
            <option value="dificil">Difícil</option>
          </select>
        </div>

        @if (loadError()) {
          <div class="rounded-2xl border border-[#fee2e2] bg-[#fff7f7] p-4 text-center">
            <p class="text-sm font-black text-[#b42318]">No se pudieron cargar las excursiones</p>
            <p class="text-xs text-[#98a2b3] mt-1">Intenta refrescar la página o vuelve a intentarlo más tarde.</p>
            <button class="h-9 mt-3 px-4 rounded-xl border border-[#e7eaf1] bg-white text-sm font-bold text-[#344054]" (click)="loadTabData()">Reintentar</button>
          </div>
        } @else if (!loading() && excursionRows.length === 0) {
          <app-admin-empty-state
            icon="search"
            title="No hay excursiones para mostrar"
            description="Crea o revisa excursiones para que aparezcan en esta sección."
            variant="soft" />
        } @else {
          <div class="admin-table-card">
            <app-data-table
              [columns]="excursionColumns"
              [data]="excursionRows"
              [loading]="loading()"
              [totalCount]="excursionRows.length"
              [pageSize]="excursionRows.length || 10"
              (rowClick)="router.navigate(['/excursions/excursion', $event.id])"
            />
          </div>
          <p class="text-xs text-gray-400 mt-1">Haz clic en una excursión para editarla. Para gestionar fechas, usa el botón de fechas en la tabla.</p>
        }
      </div>
    }

    <!-- Bookings tab -->
    @if (activeTab() === 'reservas') {
      @let bookingRows = filteredBookings();
      <div class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4">
        <div class="flex flex-col sm:flex-row flex-wrap gap-3 mb-4">
          <select class="input-field sm:w-48" [(ngModel)]="bookingStatusFilter" (ngModelChange)="loadBookings()" aria-label="Filtrar reservas por estado">
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="confirmada">Confirmada</option>
            <option value="cancelada">Cancelada</option>
            <option value="completada">Completada</option>
          </select>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Desde</label>
            <input type="date" class="input-field sm:w-44" [(ngModel)]="bookingDateFrom" aria-label="Fecha inicial de reservas" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
            <input type="date" class="input-field sm:w-44" [(ngModel)]="bookingDateTo" aria-label="Fecha final de reservas" />
          </div>
          @if (bookingDateFrom || bookingDateTo) {
            <button class="btn-secondary text-sm self-end" (click)="bookingDateFrom = ''; bookingDateTo = ''">✕ Fechas</button>
          }
        </div>

        @if (loadError()) {
          <div class="rounded-2xl border border-[#fee2e2] bg-[#fff7f7] p-4 text-center">
            <p class="text-sm font-black text-[#b42318]">No se pudieron cargar las excursiones</p>
            <p class="text-xs text-[#98a2b3] mt-1">Intenta refrescar la página o vuelve a intentarlo más tarde.</p>
            <button class="h-9 mt-3 px-4 rounded-xl border border-[#e7eaf1] bg-white text-sm font-bold text-[#344054]" (click)="loadTabData()">Reintentar</button>
          </div>
        } @else if (!loading() && bookingRows.length === 0) {
          <app-admin-empty-state
            icon="search"
            title="No hay reservas registradas"
            description="Las reservas de experiencias aparecerán aquí."
            variant="soft" />
        } @else {
          <div class="admin-table-card">
            <app-data-table
              [columns]="bookingColumns"
              [data]="bookingRows"
              [loading]="loading()"
              [totalCount]="bookingRows.length"
              [pageSize]="bookingRows.length || 10"
              (rowClick)="openBookingDetail($event)"
            />
          </div>
        }
      </div>
    }

    <!-- Categories tab -->
    @if (activeTab() === 'categorias') {
      <div class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4">
        <div class="flex justify-end mb-4">
          <a routerLink="/excursions/categories" class="h-10 inline-flex items-center rounded-xl bg-[#eb1b8d] px-4 text-sm font-bold text-white">Gestionar categorías →</a>
        </div>
        @if (loadError()) {
          <div class="rounded-2xl border border-[#fee2e2] bg-[#fff7f7] p-4 text-center">
            <p class="text-sm font-black text-[#b42318]">No se pudieron cargar las excursiones</p>
            <p class="text-xs text-[#98a2b3] mt-1">Intenta refrescar la página o vuelve a intentarlo más tarde.</p>
            <button class="h-9 mt-3 px-4 rounded-xl border border-[#e7eaf1] bg-white text-sm font-bold text-[#344054]" (click)="loadTabData()">Reintentar</button>
          </div>
        } @else if (excursionCategories().length === 0) {
          <app-admin-empty-state
            icon="default"
            title="No hay categorías de excursiones"
            description="Crea categorías para organizar las experiencias turísticas."
            variant="soft" />
        } @else {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            @for (cat of excursionCategories(); track cat.id) {
              <div class="rounded-2xl border border-[#eef1f6] px-3 py-2">
                <p class="text-sm font-bold text-[#111827]">{{ cat.name }}</p>
                <p class="text-xs text-[#98a2b3]">Orden {{ cat.display_order ?? 0 }}</p>
              </div>
            }
          </div>
        }
      </div>
    }
      </div>
    </section>

    <!-- Operator Modal -->
    @if (showOperatorModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="showOperatorModal.set(false)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10">
          <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between">
            <h3 class="font-semibold text-gray-800">{{ editingOperator() ? 'Editar operador' : 'Nuevo operador' }}</h3>
            <button aria-label="Cerrar modal de operador" class="text-gray-400" (click)="showOperatorModal.set(false)">✕</button>
          </div>
          <form [formGroup]="operatorForm" (ngSubmit)="saveOperator()" class="p-6 space-y-5">

            <!-- Información básica -->
            <div>
              <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Información básica</h4>
              <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2">
                  <label class="label">Nombre *</label>
                  <input class="input-field" formControlName="name" />
                </div>
                <div>
                  <label class="label">Categoría</label>
                  <select class="input-field" formControlName="category">
                    <option value="Playa">Playa</option>
                    <option value="Montaña">Montaña</option>
                    <option value="Ciudad">Ciudad</option>
                    <option value="Aventura">Aventura</option>
                    <option value="Cultural">Cultural</option>
                    <option value="Gastronomía">Gastronomía</option>
                    <option value="Ecoturismo">Ecoturismo</option>
                  </select>
                </div>
                <div>
                  <label class="label">WhatsApp</label>
                  <input class="input-field" formControlName="whatsapp_number" placeholder="+1 809 000 0000" />
                </div>
                <div>
                  <label class="label">Dirección</label>
                  <input class="input-field" formControlName="address" placeholder="Dirección física" />
                </div>
                <div>
                  <label class="label">Años de experiencia</label>
                  <input class="input-field" formControlName="years_experience" placeholder="ej. 10 años" />
                </div>
                <div class="col-span-2">
                  <label class="label">Descripción</label>
                  <textarea class="input-field resize-none" rows="2" formControlName="description"></textarea>
                </div>
                <div>
                  <label class="label">URL del logo</label>
                  <input class="input-field" formControlName="logo_url" placeholder="https://..." />
                </div>
                <div>
                  <label class="label">URL del banner</label>
                  <input class="input-field" formControlName="banner_url" placeholder="https://..." />
                </div>
              </div>
            </div>

            <!-- Comisión y legal -->
            <div>
              <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Comisión y legal</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="label">Tipo de comisión</label>
                  <select class="input-field" formControlName="management_fee_type">
                    <option value="">Sin comisión</option>
                    <option value="percentage">Porcentaje (%)</option>
                    <option value="fixed">Monto fijo (RD$)</option>
                  </select>
                </div>
                <div>
                  <label class="label">Valor de comisión</label>
                  <input class="input-field" type="number" min="0" formControlName="management_fee_value" placeholder="ej. 15" />
                </div>
                <div>
                  <label class="label flex items-center gap-2">
                    <input type="checkbox" formControlName="has_tourism_license" class="rounded" />
                    <span>Licencia de turismo</span>
                  </label>
                </div>
                <div>
                  <label class="label">Nº de licencia</label>
                  <input class="input-field" formControlName="tourism_license_number" placeholder="Número de licencia" />
                </div>
                <div class="col-span-2">
                  <label class="label flex items-center gap-2">
                    <input type="checkbox" formControlName="has_insurance" class="rounded" />
                    <span>Cuenta con seguro de actividad</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="flex gap-3 justify-end">
              <button type="button" class="btn-secondary" (click)="showOperatorModal.set(false)">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="operatorForm.invalid || saveLoading()">
                {{ saveLoading() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Booking detail modal -->
    @if (selectedBooking()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="selectedBooking.set(null); bookingDetail.set(null)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10">
          <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between">
            <h3 class="font-semibold text-gray-800">Reserva {{ selectedBooking()!.booking_number }}</h3>
            <button aria-label="Cerrar detalle de reserva" class="text-gray-400" (click)="selectedBooking.set(null); bookingDetail.set(null)">✕</button>
          </div>
          <div class="p-6 space-y-5">
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p class="text-gray-400 text-xs">Excursión</p>
                <p class="font-medium">{{ selectedBooking()!.excursion_name }}</p>
              </div>
              <div>
                <p class="text-gray-400 text-xs">Fecha excursión</p>
                <p class="font-medium">{{ selectedBooking()!.excursion_date_str }}</p>
              </div>
              <div>
                <p class="text-gray-400 text-xs">Cliente</p>
                <p class="font-medium">{{ selectedBooking()!.customer_name }}</p>
              </div>
              <div>
                <p class="text-gray-400 text-xs">Personas</p>
                <p class="font-medium">{{ selectedBooking()!.num_people }}</p>
              </div>
              <div>
                <p class="text-gray-400 text-xs">Total</p>
                <p class="font-bold text-lg">RD$ {{ selectedBooking()!.total }}</p>
              </div>
              <div>
                <p class="text-gray-400 text-xs">Estado</p>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  [class]="bookingStatusClass(selectedBooking()!.status)">
                  {{ selectedBooking()!.status }}
                </span>
              </div>
            </div>
            @if (selectedBooking()!.special_requests) {
              <p class="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">{{ selectedBooking()!.special_requests }}</p>
            }

            <!-- Participants -->
            @if (bookingDetailLoading()) {
              <div class="animate-pulse h-20 bg-gray-100 rounded-lg"></div>
            } @else if (bookingDetail()?.participants?.length) {
              <div>
                <h4 class="text-sm font-semibold text-gray-700 mb-2">Participantes</h4>
                <table class="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500">#</th>
                      <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500">Nombre</th>
                      <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500">Cédula</th>
                      <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500">Teléfono</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    @for (p of bookingDetail()!.participants; track p.id; let i = $index) {
                      <tr>
                        <td class="px-3 py-2 text-xs text-gray-400">{{ i + 1 }}</td>
                        <td class="px-3 py-2 text-sm font-medium text-gray-800">{{ p.full_name }}</td>
                        <td class="px-3 py-2 text-sm text-gray-600">{{ p.cedula ?? '—' }}</td>
                        <td class="px-3 py-2 text-sm text-gray-600">{{ p.phone ?? '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            <div class="flex gap-3 pt-2 border-t border-gray-100">
              @if (selectedBooking()!.status === 'pendiente') {
                <button class="btn-primary flex-1" (click)="updateStatus('confirmada')">✓ Confirmar</button>
                <button class="btn-danger flex-1" (click)="updateStatus('cancelada')">✗ Cancelar</button>
              }
              @if (selectedBooking()!.status === 'confirmada') {
                <button class="btn-secondary flex-1" (click)="updateStatus('completada')">✓ Completar</button>
                <button class="btn-danger flex-1" (click)="updateStatus('cancelada')">✗ Cancelar</button>
              }
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Excursion Dates Modal -->
    @if (showDatesModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="closeDatesModal()"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10">
          <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between">
            <div>
              <h3 class="font-semibold text-gray-800">Fechas disponibles</h3>
              <p class="text-xs text-gray-400">{{ selectedExcursion()?.name }}</p>
            </div>
            <div class="flex gap-2">
              <button class="btn-primary text-sm" (click)="showAddDatesModal.set(true)">+ Agregar fechas</button>
              <button aria-label="Cerrar fechas de excursión" class="text-gray-400 hover:text-gray-600" (click)="closeDatesModal()">✕</button>
            </div>
          </div>
          <div class="p-6">
            @if (excursionDatesLoading()) {
              <div class="space-y-3">
                @for (i of [1,2,3]; track i) {
                  <div class="animate-pulse h-12 bg-gray-200 rounded"></div>
                }
              </div>
            } @else if (excursionDates().length === 0) {
              <p class="text-center text-gray-400 py-8">Sin fechas programadas</p>
            } @else {
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500">Fecha</th>
                    <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500">Hora salida</th>
                    <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500">Cupos totales</th>
                    <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500">Disponibles</th>
                    <th class="px-4 py-2 text-left text-xs font-semibold text-gray-500">Estado</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  @for (d of excursionDates(); track d.id) {
                    <tr>
                      <td class="px-4 py-3 text-sm font-medium text-gray-800">{{ d.date }}</td>
                      <td class="px-4 py-3 text-sm text-gray-600">{{ d.departure_time }}</td>
                      <td class="px-4 py-3 text-sm text-gray-600">{{ d.total_spots }}</td>
                      <td class="px-4 py-3 text-sm text-gray-600">{{ d.spots_left }}</td>
                      <td class="px-4 py-3">
                        <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                          [class]="d.is_active ? 'bg-success-50 text-success-700' : 'bg-error-50 text-error-700'">
                          {{ d.is_active ? 'Activo' : 'Inactivo' }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>
      </div>
    }

    <!-- Add Dates Modal -->
    @if (showAddDatesModal()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="showAddDatesModal.set(false)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10">
          <div class="px-6 py-4 border-b border-gray-200 flex justify-between">
            <h3 class="font-semibold">Agregar fechas</h3>
            <button aria-label="Cerrar modal para agregar fechas" class="text-gray-400" (click)="showAddDatesModal.set(false)">✕</button>
          </div>
          <form (ngSubmit)="addExcursionDates()" class="p-6 space-y-4">
            <div>
              <label class="label">Fechas (selecciona varias)</label>
              <input type="date" class="input-field" [(ngModel)]="newDateInput" name="newDate"
                (change)="addDateToList($event)" />
              <div class="flex flex-wrap gap-2 mt-2">
                @for (d of newDates; track d) {
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-xs">
                    {{ d }}
                    <button type="button" (click)="removeDate(d)" class="text-brand-400" [attr.aria-label]="'Quitar fecha ' + d">×</button>
                  </span>
                }
              </div>
            </div>
            <div>
              <label class="label">Hora de salida</label>
              <input type="time" class="input-field" [(ngModel)]="newDepartureTime" name="departureTime" />
            </div>
            <div>
              <label class="label">Cupos totales</label>
              <input type="number" class="input-field" [(ngModel)]="newTotalSpots" name="totalSpots" min="1" />
            </div>
            <div class="flex gap-3 justify-end">
              <button type="button" class="btn-secondary" (click)="showAddDatesModal.set(false)">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="newDates.length === 0 || saveLoading()">
                {{ saveLoading() ? 'Guardando...' : 'Agregar ' + newDates.length + ' fecha(s)' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
    `,
})
export class ExcursionsPageComponent implements OnInit {
  private readonly service = inject(ExcursionsService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  readonly router = inject(Router);

  readonly activeTab = signal<ActiveTab>('operadores');
  readonly operators = signal<ExcursionOperator[]>([]);
  readonly excursions = signal<any[]>([]);
  readonly bookings = signal<any[]>([]);
  readonly excursionCategories = signal<any[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly showOperatorModal = signal(false);
  readonly editingOperator = signal<ExcursionOperator | null>(null);
  readonly selectedBooking = signal<any | null>(null);
  readonly bookingDetail = signal<any | null>(null);
  readonly bookingDetailLoading = signal(false);
  readonly saveLoading = signal(false);

  // Dates
  readonly selectedExcursion = signal<any | null>(null);
  readonly excursionDates = signal<ExcursionDate[]>([]);
  readonly excursionDatesLoading = signal(false);
  readonly showDatesModal = signal(false);
  readonly showAddDatesModal = signal(false);
  newDateInput = '';
  newDates: string[] = [];
  newDepartureTime = '08:00';
  newTotalSpots = 20;

  bookingStatusFilter: BookingStatus | '' = '';
  operatorSearch = '';
  operatorStatusFilter: 'all' | 'aprobado' | 'pendiente' | 'suspendido' = 'all';
  operatorCategoryFilter: 'all' | 'aventura' | 'playa' | 'cultural' | 'montana' | 'none' = 'all';
  operatorQuickFilter: 'all' | 'approved' | 'active' | 'pending' | 'rating48' = 'all';
  operatorSort: 'reviews_desc' | 'rating_desc' | 'name_asc' = 'reviews_desc';
  operatorStatusSelect: 'all' | 'aprobado' | 'pendiente' | 'suspendido' = 'all';
  operatorCategorySelect: 'all' | 'aventura' | 'playa' | 'cultural' | 'montana' | 'none' = 'all';
  excursionSearch = '';
  difficultyFilter = '';
  bookingDateFrom = '';
  bookingDateTo = '';
  readonly sideCategoryItems = [
    { key: 'aventura' as const, label: 'Aventura', icon: '⛰️' },
    { key: 'playa' as const, label: 'Playa', icon: '🏖️' },
    { key: 'cultural' as const, label: 'Cultural', icon: '🏛️' },
    { key: 'montana' as const, label: 'Montaña', icon: '🌲' },
  ];

  readonly filteredOperators = () => {
    let result = [...this.operators()];
    if (this.operatorSearch.trim()) {
      const q = this.operatorSearch.toLowerCase();
      result = result.filter(op =>
        op.name?.toLowerCase().includes(q) ||
        op.category?.toLowerCase().includes(q) ||
        this.operatorSubtitle(op).toLowerCase().includes(q)
      );
    }
    if (this.operatorStatusFilter !== 'all') {
      result = result.filter(op => {
        const status = String((op as any).approval_status ?? '').toLowerCase();
        if (this.operatorStatusFilter === 'suspendido') return status === 'suspendido' || status === 'rechazado';
        return status === this.operatorStatusFilter;
      });
    }
    if (this.operatorCategoryFilter !== 'all') {
      result = result.filter(op => this.normalizeCategory(op.category) === this.operatorCategoryFilter);
    }
    if (this.operatorQuickFilter === 'approved') {
      result = result.filter(op => String((op as any).approval_status ?? '').toLowerCase() === 'aprobado');
    } else if (this.operatorQuickFilter === 'active') {
      result = result.filter(op => !!op.is_active);
    } else if (this.operatorQuickFilter === 'pending') {
      result = result.filter(op => String((op as any).approval_status ?? '').toLowerCase() === 'pendiente');
    } else if (this.operatorQuickFilter === 'rating48') {
      result = result.filter(op => Number(op.avg_rating ?? 0) >= 4.8);
    }

    if (this.operatorSort === 'rating_desc') {
      result.sort((a, b) => Number(b.avg_rating ?? 0) - Number(a.avg_rating ?? 0));
    } else if (this.operatorSort === 'name_asc') {
      result.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')));
    } else {
      result.sort((a, b) => Number(b.total_reviews ?? 0) - Number(a.total_reviews ?? 0));
    }
    return result;
  };

  readonly filteredExcursions = () => {
    let result = this.excursions();
    if (this.excursionSearch.trim()) {
      const q = this.excursionSearch.toLowerCase();
      result = result.filter(e => e.name?.toLowerCase().includes(q) || e.operator_name?.toLowerCase().includes(q));
    }
    if (this.difficultyFilter) result = result.filter(e => e.difficulty_level === this.difficultyFilter);
    return result;
  };

  readonly filteredBookings = () => {
    let result = this.bookings();
    if (this.bookingDateFrom) result = result.filter(b => b.excursion_date_str >= this.bookingDateFrom);
    if (this.bookingDateTo) result = result.filter(b => b.excursion_date_str <= this.bookingDateTo);
    return result;
  };

  readonly tabs = [
    { key: 'operadores' as ActiveTab, label: 'Operadores' },
    { key: 'excursiones' as ActiveTab, label: 'Excursiones' },
    { key: 'reservas' as ActiveTab, label: 'Reservas' },
    { key: 'categorias' as ActiveTab, label: 'Categorías' },
  ];

  readonly operatorColumns: TableColumn[] = [
    { key: 'name', label: 'Nombre' },
    { key: 'category', label: 'Categoría' },
    { key: 'avg_rating', label: 'Rating' },
    { key: 'total_reviews', label: 'Reseñas' },
    { key: 'approval_status', label: 'Estado', type: 'badge', badgeType: 'approval' as any },
    { key: 'is_active', label: 'Activo', type: 'boolean' },
  ];

  readonly excursionColumns: TableColumn[] = [
    { key: 'name', label: 'Nombre' },
    { key: 'operator_name', label: 'Operador' },
    { key: 'price_per_person', label: 'Precio/persona', type: 'currency' },
    { key: 'duration_hours', label: 'Duración (h)' },
    { key: 'difficulty_level', label: 'Dificultad' },
    { key: 'min_people', label: 'Mín' },
    { key: 'max_people', label: 'Máx' },
    { key: 'is_active', label: 'Activo', type: 'boolean' },
  ];

  readonly bookingColumns: TableColumn[] = [
    { key: 'booking_number', label: '# Reserva' },
    { key: 'excursion_name', label: 'Excursión' },
    { key: 'customer_name', label: 'Cliente' },
    { key: 'excursion_date_str', label: 'Fecha excursión' },
    { key: 'num_people', label: 'Personas' },
    { key: 'total', label: 'Total', type: 'currency' },
    { key: 'status', label: 'Estado', type: 'badge', badgeType: 'booking' },
    { key: 'created_at', label: 'Reservado', type: 'date' },
  ];

  readonly operatorForm = this.fb.group({
    name: ['', Validators.required],
    category: ['Playa'],
    whatsapp_number: [''],
    description: [''],
    address: [''],
    years_experience: [''],
    logo_url: [''],
    banner_url: [''],
    management_fee_type: [''],
    management_fee_value: [null as number | null],
    has_tourism_license: [false],
    tourism_license_number: [''],
    has_insurance: [false],
  });

  ngOnInit(): void {
    this.loadTabData();
    this.loadCategoriesData();
  }

  loadTabData(): void {
    this.loading.set(true);
    this.loadError.set(false);
    if (this.activeTab() === 'operadores') this.loadOperators();
    else if (this.activeTab() === 'excursiones') this.loadExcursions();
    else if (this.activeTab() === 'reservas') this.loadBookings();
    else this.loadCategoriesData();
  }

  loadOperators(): void {
    this.service.getOperators().subscribe({
      next: data => {
        this.operators.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  loadExcursions(): void {
    if (this.operators().length === 0) {
      this.service.getOperators().subscribe(ops => this.operators.set(ops));
    }
    this.service.getExcursions().subscribe({
      next: data => {
        this.excursions.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  loadBookings(): void {
    this.service.getBookings(this.bookingStatusFilter ? { status: this.bookingStatusFilter as BookingStatus } : {})
      .subscribe({
        next: data => {
          this.bookings.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadError.set(true);
        },
      });
  }

  loadCategoriesData(): void {
    this.service.getCategories().subscribe({
      next: data => {
        this.excursionCategories.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  openOperatorModal(op?: ExcursionOperator): void {
    this.editingOperator.set(op ?? null);
    this.operatorForm.reset({
      category: 'Playa',
      has_tourism_license: false,
      has_insurance: false,
    });
    if (op) {
      this.operatorForm.patchValue({
        name: op.name,
        category: op.category ?? 'Playa',
        whatsapp_number: op.whatsapp_number ?? '',
        description: op.description ?? '',
        address: (op as any).address ?? '',
        years_experience: (op as any).years_experience ?? '',
        logo_url: (op as any).logo_url ?? '',
        banner_url: (op as any).banner_url ?? '',
        management_fee_type: (op as any).management_fee_type ?? '',
        management_fee_value: (op as any).management_fee_value ?? null,
        has_tourism_license: (op as any).has_tourism_license ?? false,
        tourism_license_number: (op as any).tourism_license_number ?? '',
        has_insurance: (op as any).has_insurance ?? false,
      });
    }
    this.showOperatorModal.set(true);
  }

  async saveOperator(): Promise<void> {
    if (this.operatorForm.invalid) return;
    this.saveLoading.set(true);
    try {
      const val = this.operatorForm.getRawValue();
      await this.service.saveOperator({
        ...(this.editingOperator() ? { id: this.editingOperator()!.id } : {}),
        name: val.name!,
        slug: val.name!.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        category: val.category || null,
        whatsapp_number: val.whatsapp_number || null,
        description: val.description || null,
        address: val.address || null,
        years_experience: val.years_experience || null,
        logo_url: val.logo_url || null,
        banner_url: val.banner_url || null,
        management_fee_type: (val.management_fee_type as 'percentage' | 'fixed' | null) || null,
        management_fee_value: val.management_fee_value ?? null,
        has_tourism_license: val.has_tourism_license ?? false,
        tourism_license_number: val.tourism_license_number || null,
        has_insurance: val.has_insurance ?? false,
        is_active: true,
        avg_rating: 0,
        total_reviews: 0,
      } as any);
      this.toastService.success('Operador guardado');
      this.showOperatorModal.set(false);
      this.loadOperators();
    } catch { this.toastService.error('Error al guardar'); }
    finally { this.saveLoading.set(false); }
  }

  setTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
    this.loadTabData();
  }

  avgOperatorRating(): string {
    const list = this.operators();
    if (!list.length) return '0.0';
    const sum = list.reduce((acc, op) => acc + Number(op.avg_rating ?? 0), 0);
    return (sum / list.length).toFixed(1);
  }

  totalOperatorReviews(): string {
    const total = this.operators().reduce((acc, op) => acc + Number(op.total_reviews ?? 0), 0);
    return total.toLocaleString('es-DO');
  }

  activeOperatorsCount(): number {
    return this.operators().filter(op => op.is_active).length;
  }

  approvedOperatorsCount(): number {
    return this.operators().filter(op => String((op as any).approval_status ?? '').toLowerCase() === 'aprobado').length;
  }

  pendingOperatorsCount(): number {
    return this.operators().filter(op => String((op as any).approval_status ?? '').toLowerCase() === 'pendiente').length;
  }

  suspendedOperatorsCount(): number {
    return this.operators().filter(op => {
      const status = String((op as any).approval_status ?? '').toLowerCase();
      return status === 'suspendido' || status === 'rechazado';
    }).length;
  }

  setOperatorStatusFilter(status: 'all' | 'aprobado' | 'pendiente' | 'suspendido'): void {
    this.setTab('operadores');
    this.operatorStatusFilter = status;
    this.operatorStatusSelect = status;
    this.operatorQuickFilter = 'all';
  }

  setOperatorCategoryFilter(category: 'all' | 'aventura' | 'playa' | 'cultural' | 'montana' | 'none'): void {
    this.setTab('operadores');
    this.operatorCategoryFilter = category;
    this.operatorCategorySelect = category;
  }

  setOperatorStatusFromSelect(): void {
    this.operatorStatusFilter = this.operatorStatusSelect;
    this.operatorQuickFilter = 'all';
  }

  setOperatorCategoryFromSelect(): void {
    this.operatorCategoryFilter = this.operatorCategorySelect;
  }

  setOperatorQuickFilter(filter: 'all' | 'approved' | 'active' | 'pending' | 'rating48'): void {
    this.operatorQuickFilter = filter;
  }

  categoryCount(category: 'aventura' | 'playa' | 'cultural' | 'montana' | 'none'): number {
    return this.operators().filter(op => this.normalizeCategory(op.category) === category).length;
  }

  normalizeCategory(category: string | null | undefined): 'aventura' | 'playa' | 'cultural' | 'montana' | 'none' {
    const c = String(category ?? '').toLowerCase();
    if (c.includes('aventura')) return 'aventura';
    if (c.includes('playa')) return 'playa';
    if (c.includes('cultural') || c.includes('cultura')) return 'cultural';
    if (c.includes('montaña') || c.includes('montana')) return 'montana';
    return 'none';
  }

  displayCategory(category: string | null | undefined): string {
    const mapped = this.normalizeCategory(category);
    if (mapped === 'aventura') return 'aventura';
    if (mapped === 'playa') return 'playa';
    if (mapped === 'cultural') return 'cultural';
    if (mapped === 'montana') return 'montaña';
    return 'Sin categoría';
  }

  categoryBadgeClass(category: string | null | undefined): string {
    const mapped = this.normalizeCategory(category);
    if (mapped === 'aventura') return 'bg-[#eef4ff] text-[#2451c7]';
    if (mapped === 'playa') return 'bg-[#eef4ff] text-[#2451c7]';
    if (mapped === 'cultural') return 'bg-[#f4ecff] text-[#6d28d9]';
    if (mapped === 'montana') return 'bg-[#eef4ff] text-[#2451c7]';
    return 'bg-[#f4f6f9] text-[#667085]';
  }

  displayStatus(status: string | null | undefined): string {
    const s = String(status ?? '').toLowerCase();
    if (s === 'aprobado') return 'Aprobado';
    if (s === 'pendiente') return 'Pendiente';
    if (s === 'rechazado') return 'Rechazado';
    if (s === 'suspendido') return 'Suspendido';
    return 'Pendiente';
  }

  statusBadgeClass(status: string | null | undefined): string {
    const s = String(status ?? '').toLowerCase();
    if (s === 'aprobado') return 'bg-[#eafbf1] text-[#087b3c]';
    if (s === 'pendiente') return 'bg-[#fff7dc] text-[#b54708]';
    return 'bg-[#fee2e2] text-[#b42318]';
  }

  operatorApprovalStatus(op: ExcursionOperator): string {
    return String((op as any).approval_status ?? '');
  }

  operatorRating(op: ExcursionOperator): string {
    return Number(op.avg_rating ?? 0).toFixed(1);
  }

  operatorReviews(op: ExcursionOperator): number {
    return Number(op.total_reviews ?? 0);
  }

  operatorSubtitle(op: ExcursionOperator): string {
    const category = this.displayCategory(op.category).toLowerCase();
    if (category === 'sin categoría') return 'Operador general';
    if (category === 'playa') return 'Playas y tours marítimos';
    if (category === 'cultural') return 'Experiencias culturales';
    if (category === 'montaña') return 'Rutas de montaña';
    return `Operador de ${category}`;
  }

  async toggleOperatorActive(op: ExcursionOperator): Promise<void> {
    try {
      await this.service.saveOperator({ id: op.id, is_active: !op.is_active } as any);
      this.operators.update(prev => prev.map(item => item.id === op.id ? { ...item, is_active: !item.is_active } : item));
      this.toastService.success('Estado de operador actualizado');
    } catch {
      this.toastService.error('Error al actualizar operador');
    }
  }

  exportOperatorsCsv(): void {
    const rows = this.filteredOperators();
    if (!rows.length) {
      this.toastService.error('No hay operadores para exportar');
      return;
    }
    const headers = ['nombre', 'categoria', 'rating', 'reseñas', 'estado', 'activo'];
    const lines = rows.map(op => [
      op.name ?? '',
      op.category ?? '',
      op.avg_rating ?? 0,
      op.total_reviews ?? 0,
      (op as any).approval_status ?? '',
      op.is_active ? 'si' : 'no',
    ]);
    const csv = [headers, ...lines]
      .map(cols => cols.map(col => `"${String(col).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `operadores-excursiones-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  openBookingDetail(booking: any): void {
    this.router.navigate(['/excursions/bookings', booking.id]);
  }

  openDatesModal(excursion: any): void {
    this.selectedExcursion.set(excursion);
    this.showDatesModal.set(true);
    this.excursionDatesLoading.set(true);
    this.service.getExcursionDates(excursion.id).subscribe(dates => {
      this.excursionDates.set(dates);
      this.excursionDatesLoading.set(false);
    });
  }

  closeDatesModal(): void {
    this.showDatesModal.set(false);
    this.showAddDatesModal.set(false);
    this.selectedExcursion.set(null);
    this.newDates = [];
    this.newDateInput = '';
  }

  addDateToList(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (val && !this.newDates.includes(val)) {
      this.newDates = [...this.newDates, val].sort();
    }
    this.newDateInput = '';
    (event.target as HTMLInputElement).value = '';
  }

  removeDate(d: string): void { this.newDates = this.newDates.filter(x => x !== d); }

  bookingCountByStatus(status: BookingStatus): number {
    return this.bookings().filter(b => b.status === status).length;
  }

  async addExcursionDates(): Promise<void> {
    if (!this.newDates.length || !this.selectedExcursion()) return;
    this.saveLoading.set(true);
    try {
      await this.service.addExcursionDates(
        this.selectedExcursion()!.id,
        this.newDates,
        this.newDepartureTime,
        this.newTotalSpots,
      );
      this.toastService.success(`${this.newDates.length} fecha(s) agregadas`);
      this.newDates = [];
      this.newDateInput = '';
      this.showAddDatesModal.set(false);
      this.excursionDatesLoading.set(true);
      this.service.getExcursionDates(this.selectedExcursion()!.id).subscribe(dates => {
        this.excursionDates.set(dates);
        this.excursionDatesLoading.set(false);
      });
    } catch { this.toastService.error('Error al agregar fechas'); }
    finally { this.saveLoading.set(false); }
  }

  bookingStatusClass(status: string): string {
    const map: Record<string, string> = {
      pendiente: 'bg-warning-100 text-warning-700',
      confirmada: 'bg-brand-100 text-brand-700',
      completada: 'bg-success-100 text-success-700',
      cancelada: 'bg-error-100 text-error-700',
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  }

  async updateStatus(status: BookingStatus): Promise<void> {
    if (!this.selectedBooking()) return;
    try {
      await this.service.updateBookingStatus(this.selectedBooking()!.id, status);
      this.toastService.success('Estado actualizado');
      this.selectedBooking.set(null);
      this.bookingDetail.set(null);
      this.loadBookings();
    } catch { this.toastService.error('Error al actualizar'); }
  }
}
