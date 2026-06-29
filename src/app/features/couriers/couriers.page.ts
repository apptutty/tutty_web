import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CouriersService } from './couriers.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { StatusBadgeComponent } from '../../shared/ui/badge/status-badge.component';
import { Courier, VehicleType, DriverStats } from '../../core/supabase/database.types';
import { AuthService } from '../../core/auth/auth.service';
import { AdminEmptyStateComponent } from '../../shared/ui/admin-empty-state/admin-empty-state.component';

@Component({
  selector: 'app-couriers-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, StatusBadgeComponent, AdminEmptyStateComponent],
  template: `
    <section class="rounded-[28px] border border-[#e7eaf1] bg-[radial-gradient(circle_at_90%_12%,rgba(235,27,141,.12),transparent_24%),linear-gradient(180deg,#fff,#fbfcff)] shadow-[0_8px_24px_rgba(18,24,40,.07)] px-6 py-5 mb-5">
      <div class="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
        <div>
          <p class="inline-flex items-center rounded-full bg-[#ffe7f4] px-3 py-1 text-[11px] font-extrabold tracking-wide text-[#c71473]">Operations · Driver Network</p>
          <h1 class="mt-2 text-[30px] leading-[1.08] tracking-[-0.04em] font-bold text-[#111827]">Gestión de Repartidores</h1>
          <p class="mt-2 max-w-4xl text-[15px] leading-6 text-[#667085]">Administra repartidores, disponibilidad, vehículos, ganancias, entregas, sesiones y zonas operativas desde un centro logístico premium.</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 xl:flex xl:flex-wrap xl:justify-end">
          <button class="h-11 inline-flex items-center justify-center rounded-2xl border border-[#e7eaf1] bg-white px-4 text-sm font-bold text-[#344054] hover:bg-[#f8fafc]" (click)="exportCsv()">Exportar CSV</button>
          <button class="h-11 inline-flex items-center justify-center rounded-2xl border border-[#ffd8a8] bg-[#fff6e6] px-4 text-sm font-bold text-[#b54708] hover:bg-[#ffefcf]" (click)="activateAlertsFilter()">Revisar alertas</button>
          <button class="h-11 inline-flex items-center justify-center rounded-2xl bg-[#eb1b8d] hover:bg-[#c71473] text-white px-4 text-sm font-black" (click)="openForm()">+ Repartidor</button>
        </div>
      </div>
    </section>

    <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
      <article class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4 flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-[#eef4ff] text-[#2451c7] grid place-items-center text-lg">👥</div>
        <div>
          <p class="text-xs font-extrabold text-[#7b8496]">Repartidores</p>
          <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ stats()?.total ?? couriers().length }}</p>
          <p class="text-xs text-[#98a2b3]">registrados en plataforma</p>
        </div>
      </article>
      <article class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4 flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-[#eafbf1] text-[#087b3c] grid place-items-center text-lg">🟢</div>
        <div>
          <p class="text-xs font-extrabold text-[#7b8496]">Disponibles</p>
          <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ stats()?.available ?? availableCount(true) }}</p>
          <p class="text-xs text-[#98a2b3]">listos para asignación</p>
        </div>
      </article>
      <article class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4 flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-[#fff6e6] text-[#b54708] grid place-items-center text-lg">⚠️</div>
        <div>
          <p class="text-xs font-extrabold text-[#7b8496]">Sin GPS / alertas</p>
          <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ alertsCount() }}</p>
          <p class="text-xs text-[#98a2b3]">requieren seguimiento</p>
        </div>
      </article>
      <article class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4 flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-[#ffe7f4] text-[#c71473] grid place-items-center text-lg">💰</div>
        <div>
          <p class="text-xs font-extrabold text-[#7b8496]">Ganancias</p>
          <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ compactMoney(stats()?.totalEarnings ?? totalEarnings()) }}</p>
          <p class="text-xs text-[#98a2b3]">total acumulado</p>
        </div>
      </article>
    </section>

    <section class="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-4 mb-4">
      <aside class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] overflow-hidden self-start">
        <div class="px-5 py-5 border-b border-[#eef1f6]">
          <h3 class="text-[32px] leading-none mb-2 text-[#111827]">Red de repartidores</h3>
          <p class="text-sm text-[#667085]">Filtra por disponibilidad, estado, vehículo y alertas operativas.</p>
        </div>
        <div class="p-3 space-y-5">
          <div class="space-y-1.5">
            <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition-colors" [class]="isAllFiltersActive() ? 'bg-[#111827] text-white shadow-[0_8px_16px_rgba(17,24,39,.25)]' : 'text-[#344054] hover:bg-[#f8fafc]'" (click)="resetQuickFilters()">
              <span>Todos</span><span class="text-xs opacity-80">{{ couriers().length }}</span>
            </button>
            <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition-colors" [class]="availableFilter === 'true' && !alertOnly ? 'bg-[#111827] text-white shadow-[0_8px_16px_rgba(17,24,39,.25)]' : 'text-[#344054] hover:bg-[#f8fafc]'" (click)="setAvailableFilter('true')">
              <span>Disponibles</span><span class="text-xs opacity-80">{{ availableCount(true) }}</span>
            </button>
            <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition-colors" [class]="availableFilter === 'false' && !alertOnly ? 'bg-[#111827] text-white shadow-[0_8px_16px_rgba(17,24,39,.25)]' : 'text-[#344054] hover:bg-[#f8fafc]'" (click)="setAvailableFilter('false')">
              <span>No disponibles</span><span class="text-xs opacity-80">{{ availableCount(false) }}</span>
            </button>
            <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition-colors" [class]="alertOnly ? 'bg-[#111827] text-white shadow-[0_8px_16px_rgba(17,24,39,.25)]' : 'text-[#344054] hover:bg-[#f8fafc]'" (click)="activateAlertsFilter()">
              <span>Sin GPS / alerta</span><span class="text-xs opacity-80">{{ alertsCount() }}</span>
            </button>
          </div>
          <div class="space-y-1.5">
            <p class="px-2 text-xs font-black uppercase tracking-[0.08em] text-[#98a2b3]">Por vehículo</p>
            <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors" [class]="vehicleFilter === 'moto' ? 'bg-[#eef4ff] text-[#1d4ed8]' : 'text-[#475467] hover:bg-[#f8fafc]'" (click)="setVehicleFilter('moto')">
              <span>Moto</span><span class="text-xs">{{ vehicleCount('moto') }}</span>
            </button>
            <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors" [class]="vehicleFilter === 'bicicleta' ? 'bg-[#eef4ff] text-[#1d4ed8]' : 'text-[#475467] hover:bg-[#f8fafc]'" (click)="setVehicleFilter('bicicleta')">
              <span>Bicicleta</span><span class="text-xs">{{ vehicleCount('bicicleta') }}</span>
            </button>
            <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors" [class]="vehicleFilter === 'carro' ? 'bg-[#eef4ff] text-[#1d4ed8]' : 'text-[#475467] hover:bg-[#f8fafc]'" (click)="setVehicleFilter('carro')">
              <span>Carro</span><span class="text-xs">{{ vehicleCount('carro') }}</span>
            </button>
          </div>
          <div class="space-y-1.5">
            <p class="px-2 text-xs font-black uppercase tracking-[0.08em] text-[#98a2b3]">Por estado</p>
            <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors" [class]="approvalFilter === 'aprobado' ? 'bg-[#eafbf1] text-[#087b3c]' : 'text-[#475467] hover:bg-[#f8fafc]'" (click)="setApprovalFilter('aprobado')">
              <span>Aprobados</span><span class="text-xs">{{ approvalCount('aprobado') }}</span>
            </button>
            <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors" [class]="approvalFilter === 'pendiente' ? 'bg-[#fff6e6] text-[#b54708]' : 'text-[#475467] hover:bg-[#f8fafc]'" (click)="setApprovalFilter('pendiente')">
              <span>Pendientes</span><span class="text-xs">{{ approvalCount('pendiente') }}</span>
            </button>
            <button type="button" class="w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors" [class]="approvalFilter === 'suspendido' ? 'bg-[#fee2e2] text-[#b42318]' : 'text-[#475467] hover:bg-[#f8fafc]'" (click)="setApprovalFilter('suspendido')">
              <span>Suspendidos</span><span class="text-xs">{{ approvalCount('suspendido') }}</span>
            </button>
          </div>
        </div>
      </aside>

      <div class="min-w-0 space-y-4">
        <section class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] p-4">
          <div class="grid grid-cols-1 xl:grid-cols-[minmax(260px,1fr)_220px_220px_220px_120px] gap-2 mb-3">
            <label class="h-12 rounded-2xl border border-[#e7eaf1] bg-[#fbfcff] px-3 inline-flex items-center gap-2 min-w-0">
              <span class="text-[#667085]">⌕</span>
              <input type="search" class="bg-transparent border-0 outline-0 w-full min-w-0 text-sm" placeholder="Buscar por nombre, cédula, teléfono o placa..." [(ngModel)]="searchText" aria-label="Buscar por nombre, cédula, teléfono o placa" />
            </label>
            <select class="input-field text-sm !h-12 !rounded-2xl" [(ngModel)]="approvalFilter" (ngModelChange)="loadCouriers()" aria-label="Filtrar por estado">
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="aprobado">Aprobado</option>
              <option value="rechazado">Rechazado</option>
              <option value="suspendido">Suspendido</option>
            </select>
            <select class="input-field text-sm !h-12 !rounded-2xl" [(ngModel)]="availableFilter" (ngModelChange)="loadCouriers()" aria-label="Filtrar por disponibilidad">
              <option value="">Disponibilidad</option>
              <option value="true">Disponibles</option>
              <option value="false">No disponibles</option>
            </select>
            <select class="input-field text-sm !h-12 !rounded-2xl" [(ngModel)]="vehicleFilter" (ngModelChange)="loadCouriers()" aria-label="Filtrar por vehículo">
              <option value="">Todos los vehículos</option>
              <option value="moto">Moto</option>
              <option value="bicicleta">Bicicleta</option>
              <option value="carro">Carro</option>
              <option value="a_pie">A pie</option>
            </select>
            <button class="h-12 rounded-2xl border border-[#e7eaf1] bg-[#fbfcff] text-sm font-bold text-[#475467] hover:bg-[#f4f6fb]" (click)="resetQuickFilters()">Limpiar</button>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="h-9 rounded-full border px-3 text-sm font-bold transition-colors" [class]="isAllFiltersActive() ? 'bg-[#111827] border-[#111827] text-white' : 'border-[#e7eaf1] text-[#475467]'" (click)="resetQuickFilters()">Todos {{ couriers().length }}</button>
            <button type="button" class="h-9 rounded-full border px-3 text-sm font-bold transition-colors" [class]="availableFilter === 'true' && !alertOnly ? 'bg-[#eafbf1] border-[#b7efcc] text-[#087b3c]' : 'border-[#e7eaf1] text-[#475467]'" (click)="setAvailableFilter('true')">Disponibles {{ availableCount(true) }}</button>
            <button type="button" class="h-9 rounded-full border px-3 text-sm font-bold transition-colors" [class]="availableFilter === 'false' && !alertOnly ? 'bg-[#f4f6f9] border-[#e7eaf1] text-[#344054]' : 'border-[#e7eaf1] text-[#475467]'" (click)="setAvailableFilter('false')">No disponibles {{ availableCount(false) }}</button>
            <button type="button" class="h-9 rounded-full border px-3 text-sm font-bold transition-colors" [class]="alertOnly ? 'bg-[#fff6e6] border-[#ffd8a8] text-[#b54708]' : 'border-[#e7eaf1] text-[#475467]'" (click)="activateAlertsFilter()">Sin GPS {{ alertsCount() }}</button>
            <button type="button" class="h-9 rounded-full border px-3 text-sm font-bold transition-colors" [class]="rating45Only ? 'bg-[#eef4ff] border-[#d7e3ff] text-[#2451c7]' : 'border-[#e7eaf1] text-[#475467]'" (click)="toggleRating45()">Rating 4.5+</button>
          </div>
        </section>

        <div class="rounded-3xl border border-[#e7eaf1] bg-white shadow-[0_8px_24px_rgba(18,24,40,.07)] overflow-hidden">
          <div class="px-5 py-4 border-b border-[#eef1f6]">
            <h3 class="text-base font-black text-[#111827]">Repartidores</h3>
            <p class="text-sm font-semibold text-[#98a2b3]">{{ filteredCouriers().length }} repartidores encontrados</p>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-[1100px] w-full divide-y divide-gray-200">
              <thead class="bg-[#f8fafc]">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Repartidor</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cédula</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Vehículo</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Disponible</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rating</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Entregas</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ganancias</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-100">
                @if (loading()) {
                  @for (i of [1,2,3,4,5]; track i) {
                    <tr class="animate-pulse">
                      @for (j of [1,2,3,4,5,6,7,8,9]; track j) { <td class="px-4 py-4"><div class="h-4 bg-gray-200 rounded w-3/4"></div></td> }
                    </tr>
                  }
                } @else if (filteredCouriers().length === 0) {
                  <tr>
                    <td colspan="9" class="px-4 py-6">
                      <app-admin-empty-state
                        icon="search"
                        [title]="couriers().length === 0 ? 'No hay repartidores registrados' : 'No hay repartidores para estos filtros'"
                        description="Prueba ajustando la búsqueda, disponibilidad, vehículo o estado."
                        variant="soft" />
                    </td>
                  </tr>
                } @else {
                  @for (r of filteredCouriers(); track r.id) {
                    <tr class="hover:bg-[#fcfcfd] transition-colors">
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-3">
                          @if (r.photo_url || r.avatar_url) {
                            <img [src]="r.photo_url ?? r.avatar_url" class="w-10 h-10 rounded-2xl object-cover border border-[#e7eaf1]" alt="" />
                          } @else {
                            <div class="w-10 h-10 rounded-2xl bg-[#ffe7f4] flex items-center justify-center text-sm font-black text-[#c71473]">{{ r.full_name?.charAt(0) ?? '?' }}</div>
                          }
                          <div>
                            <p class="text-[15px] font-bold text-[#101828] leading-tight">{{ r.full_name }}</p>
                            <p class="text-xs text-[#98a2b3]">{{ r.phone }}</p>
                          </div>
                          @if (hasOpsAlert(r)) {
                            <span class="text-[13px] text-[#b54708]" title="Sin GPS o alertas operativas" aria-label="Sin GPS o alertas operativas">⚠</span>
                          }
                        </div>
                      </td>
                      <td class="px-4 py-3 text-sm text-[#475467]">{{ r.cedula ?? '—' }}</td>
                      <td class="px-4 py-3">
                        <p class="text-sm font-semibold text-[#101828]">{{ vehicleLabel(r.vehicle_type!) }}</p>
                        <p class="text-xs text-[#98a2b3]">{{ r.vehicle_plate ?? '—' }}</p>
                      </td>
                      <td class="px-4 py-3">
                        <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold" [class]="r.is_available ? 'bg-[#eafbf1] text-[#087b3c]' : 'bg-[#f2f4f7] text-[#475467]'">{{ r.is_available ? '● Disponible' : '○ No disponible' }}</span>
                      </td>
                      <td class="px-4 py-3"><app-status-badge [status]="r.approval_status ?? 'pendiente'" type="approval" /></td>
                      <td class="px-4 py-3 text-sm font-bold text-[#1d2939]">⭐ {{ r.avg_rating.toFixed(1) }}</td>
                      <td class="px-4 py-3 text-sm text-[#344054]">{{ r.total_deliveries }}</td>
                      <td class="px-4 py-3 text-sm font-black text-[#111827]">{{ money(r.total_earnings) }}</td>
                      <td class="px-4 py-3">
                        <div class="flex gap-1">
                          <button class="btn-secondary px-2 py-1 text-xs" (click)="router.navigate(['/couriers', r.id])">Ver</button>
                          <button class="btn-secondary px-2 py-1 text-xs" (click)="openForm(r)">Editar</button>
                          @if (r.approval_status === 'pendiente') {
                            <button class="px-2 py-1 text-xs rounded-lg bg-success-50 text-success-700 hover:bg-success-100 transition-colors" (click)="confirmApprove(r)">✓ Aprobar</button>
                            <button class="px-2 py-1 text-xs rounded-lg bg-error-50 text-error-700 hover:bg-error-100 transition-colors" (click)="confirmReject(r)">✗ Rechazar</button>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <!-- Form modal -->
    @if (showForm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="showForm.set(false)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 z-10">
          <h3 class="font-semibold text-gray-800 mb-4">
            {{ editingId() ? 'Editar repartidor' : 'Nuevo repartidor' }}
          </h3>
          <form [formGroup]="courierForm" (ngSubmit)="save()" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">Cédula *</label>
                <input class="input-field" formControlName="cedula" placeholder="001-1234567-8" />
              </div>
              <div>
                <label class="label">Tipo vehículo *</label>
                <select class="input-field" formControlName="vehicle_type">
                  <option value="moto">Moto</option>
                  <option value="bicicleta">Bicicleta</option>
                  <option value="carro">Carro</option>
                  <option value="a_pie">A pie</option>
                </select>
              </div>
              <div>
                <label class="label">Placa</label>
                <input class="input-field" formControlName="vehicle_plate" placeholder="A123456" />
              </div>
            </div>
            <div class="flex gap-3 justify-end">
              <button type="button" class="btn-secondary" (click)="showForm.set(false)">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="courierForm.invalid || saveLoading()">
                {{ saveLoading() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Confirm Approve Modal -->
    @if (confirmAction()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="confirmAction.set(null)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
          <h3 class="font-semibold text-gray-800 mb-2">{{ confirmTitle() }}</h3>
          <p class="text-sm text-gray-500 mb-4">{{ confirmMessage() }}</p>
          @if (confirmAction() === 'reject' || confirmAction() === 'suspend') {
            <div class="mb-4">
              <label class="label">Razón (opcional)</label>
              <textarea class="input-field resize-none" rows="2" [(ngModel)]="actionReason"></textarea>
            </div>
          }
          <div class="flex gap-3 justify-end">
            <button class="btn-secondary" (click)="confirmAction.set(null)">Cancelar</button>
            <button [class]="confirmAction() === 'approve' ? 'btn-primary' : 'btn-danger'"
              [disabled]="actionLoading()"
              (click)="executeAction()">
              {{ actionLoading() ? 'Procesando...' : confirmAction() === 'approve' ? 'Aprobar' : confirmAction() === 'reject' ? 'Rechazar' : 'Suspender' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CouriersPageComponent implements OnInit {
  private readonly service = inject(CouriersService);
  private readonly toastService = inject(ToastService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  readonly router = inject(Router);

  readonly couriers = signal<Courier[]>([]);
  readonly loading = signal(true);
  readonly stats = signal<DriverStats | null>(null);
  readonly statsLoading = signal(true);
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saveLoading = signal(false);
  readonly confirmAction = signal<'approve' | 'reject' | 'suspend' | null>(null);
  readonly actionLoading = signal(false);

  approvalFilter = '';
  availableFilter = '';
  searchText = '';
  vehicleFilter = '';
  alertOnly = false;
  rating45Only = false;
  actionReason = '';
  private actionTargetId = '';

  readonly confirmTitle = () => {
    if (this.confirmAction() === 'approve') return 'Aprobar repartidor';
    if (this.confirmAction() === 'reject') return 'Rechazar repartidor';
    return 'Suspender repartidor';
  };
  readonly confirmMessage = () => {
    const name = this.couriers().find(c => c.id === this.actionTargetId)?.full_name ?? 'este repartidor';
    if (this.confirmAction() === 'approve') return `¿Aprobar a ${name}? Se habilitará su acceso a la plataforma.`;
    if (this.confirmAction() === 'reject') return `¿Rechazar a ${name}? Esta acción cambia su estado a rechazado.`;
    return `¿Suspender a ${name}?`;
  };

  readonly filteredCouriers = () => {
    let result = this.couriers();
    if (this.searchText.trim()) {
      const q = this.searchText.toLowerCase();
      result = result.filter(r =>
        r.full_name?.toLowerCase().includes(q) ||
        r.cedula?.includes(q) ||
        r.phone?.includes(q) ||
        r.vehicle_plate?.toLowerCase().includes(q)
      );
    }
    if (this.vehicleFilter) result = result.filter(r => r.vehicle_type === this.vehicleFilter);
    if (this.alertOnly) result = result.filter(r => this.hasOpsAlert(r));
    if (this.rating45Only) result = result.filter(r => (r.avg_rating ?? 0) >= 4.5);
    return result;
  };

  readonly courierForm = this.fb.group({
    cedula: ['', Validators.required],
    vehicle_type: ['moto' as VehicleType, Validators.required],
    vehicle_plate: [''],
  });

  ngOnInit(): void {
    this.loadCouriers();
    this.loadStats();
  }

  loadCouriers(): void {
    this.loading.set(true);
    const filters: any = {};
    if (this.availableFilter !== '') filters.available = this.availableFilter === 'true';
    if (this.approvalFilter) filters.approvalStatus = this.approvalFilter;
    if (this.vehicleFilter) filters.vehicleType = this.vehicleFilter;
    this.service.getCouriers(filters).subscribe({
      next: list => { this.couriers.set(list); this.loading.set(false); },
      error: () => { this.toastService.error('Error al cargar repartidores'); this.loading.set(false); },
    });
  }

  loadStats(): void {
    this.statsLoading.set(true);
    this.service.getDriverStats().subscribe({
      next: s => { this.stats.set(s); this.statsLoading.set(false); },
      error: () => this.statsLoading.set(false),
    });
  }

  openForm(r?: Courier): void {
    this.editingId.set(r?.id ?? null);
    if (r) { this.courierForm.patchValue(r as any); }
    else { this.courierForm.reset({ vehicle_type: 'moto' }); }
    this.showForm.set(true);
  }

  confirmApprove(r: Courier): void {
    this.actionTargetId = r.id;
    this.actionReason = '';
    this.confirmAction.set('approve');
  }

  confirmReject(r: Courier): void {
    this.actionTargetId = r.id;
    this.actionReason = '';
    this.confirmAction.set('reject');
  }

  async executeAction(): Promise<void> {
    const action = this.confirmAction();
    if (!action || !this.actionTargetId) return;
    this.actionLoading.set(true);
    try {
      if (action === 'approve') {
        await this.service.approveDriver(this.actionTargetId, this.authService.currentUser()?.id ?? '');
        this.toastService.success('Repartidor aprobado');
      } else if (action === 'reject') {
        await this.service.rejectDriver(this.actionTargetId, this.actionReason || undefined);
        this.toastService.success('Repartidor rechazado');
      } else {
        await this.service.suspendDriver(this.actionTargetId, this.actionReason || undefined);
        this.toastService.success('Repartidor suspendido');
      }
      this.confirmAction.set(null);
      this.loadCouriers();
      this.loadStats();
    } catch {
      this.toastService.error('Error al procesar la acción');
    } finally {
      this.actionLoading.set(false);
    }
  }

  async save(): Promise<void> {
    if (this.courierForm.invalid) return;
    this.saveLoading.set(true);
    const val = this.courierForm.getRawValue();
    try {
      await this.service.saveCourier({
        ...(this.editingId() ? { id: this.editingId()! } : {}),
        cedula: val.cedula!,
        vehicle_type: val.vehicle_type as VehicleType,
        vehicle_plate: val.vehicle_plate ?? null,
        is_available: true,
      });
      this.toastService.success('Repartidor guardado');
      this.showForm.set(false);
      this.loadCouriers();
    } catch { this.toastService.error('Error al guardar'); }
    finally { this.saveLoading.set(false); }
  }

  vehicleLabel(type: VehicleType): string {
    const map: Record<VehicleType, string> = {
      moto: '🏍️ Moto', bicicleta: '🚲 Bicicleta', carro: '🚗 Carro', a_pie: '🚶 A pie',
    };
    return map[type] ?? type;
  }

  setApprovalFilter(value: string): void {
    this.alertOnly = false;
    this.approvalFilter = value;
    this.loadCouriers();
  }

  setAvailableFilter(value: string): void {
    this.alertOnly = false;
    this.availableFilter = value;
    this.loadCouriers();
  }

  setVehicleFilter(value: string): void {
    this.vehicleFilter = value;
    this.alertOnly = false;
    this.loadCouriers();
  }

  resetQuickFilters(): void {
    this.approvalFilter = '';
    this.availableFilter = '';
    this.vehicleFilter = '';
    this.alertOnly = false;
    this.rating45Only = false;
    this.loadCouriers();
  }

  approvalCount(status: string): number {
    return this.couriers().filter(c => c.approval_status === status).length;
  }

  availableCount(available: boolean): number {
    return this.couriers().filter(c => !!c.is_available === available).length;
  }

  vehicleCount(type: VehicleType | 'a_pie'): number {
    return this.couriers().filter(c => c.vehicle_type === type).length;
  }

  alertsCount(): number {
    return this.couriers().filter(c => this.hasOpsAlert(c)).length;
  }

  hasOpsAlert(courier: Courier): boolean {
    return this.hasGpsAlert(courier) || this.hasMissingDocs(courier);
  }

  hasGpsAlert(courier: Courier): boolean {
    if (!courier.last_location_at) return true;
    return (Date.now() - new Date(courier.last_location_at).getTime()) > 30 * 60 * 1000;
  }

  hasMissingDocs(courier: Courier): boolean {
    return !courier.photo_url || !courier.cedula_photo_url || !courier.vehicle_photo_url || !courier.license_photo_url;
  }

  toggleRating45(): void {
    this.rating45Only = !this.rating45Only;
  }

  activateAlertsFilter(): void {
    this.alertOnly = true;
    this.approvalFilter = '';
    this.availableFilter = '';
    this.vehicleFilter = '';
    this.loadCouriers();
  }

  isAllFiltersActive(): boolean {
    return !this.approvalFilter && !this.availableFilter && !this.vehicleFilter && !this.alertOnly && !this.rating45Only;
  }

  totalEarnings(): number {
    return this.couriers().reduce((sum, c) => sum + (c.total_earnings ?? 0), 0);
  }

  compactMoney(value: number): string {
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', notation: 'compact', maximumFractionDigits: 1 }).format(value);
  }

  money(value: number): string {
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(value);
  }

  exportCsv(): void {
    const rows = this.filteredCouriers();
    const header = ['nombre', 'cedula', 'telefono', 'vehiculo', 'placa', 'disponible', 'estado', 'rating', 'entregas', 'ganancias'];
    const csv = [
      header.join(','),
      ...rows.map(r => [
        this.escapeCsv(r.full_name ?? ''),
        this.escapeCsv(r.cedula ?? ''),
        this.escapeCsv(r.phone ?? ''),
        this.escapeCsv(r.vehicle_type ?? ''),
        this.escapeCsv(r.vehicle_plate ?? ''),
        r.is_available ? 'si' : 'no',
        this.escapeCsv(r.approval_status ?? ''),
        (r.avg_rating ?? 0).toFixed(1),
        String(r.total_deliveries ?? 0),
        String(r.total_earnings ?? 0),
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'repartidores.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  private escapeCsv(value: string): string {
    return `"${value.replaceAll('"', '""')}"`;
  }
}
