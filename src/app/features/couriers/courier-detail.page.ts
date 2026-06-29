import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CouriersService } from './couriers.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { StatusBadgeComponent } from '../../shared/ui/badge/status-badge.component';
import { AuthService } from '../../core/auth/auth.service';
import {
  Courier, RepartidorWallet, WalletTransaction, RepartidorBankAccount,
  RepartidorAbsence, RepartidorSanction, RepartidorSession, DriverLocationHistory,
} from '../../core/supabase/database.types';

type DetailTab = 'overview' | 'documents' | 'vehicle' | 'location' | 'wallet' | 'bank' | 'ratings' | 'sessions' | 'zones' | 'absences' | 'sanctions' | 'orders';

@Component({
  selector: 'app-courier-detail-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, StatusBadgeComponent],
  template: `
    <app-page-header
      [title]="courier()?.full_name ?? 'Repartidor'"
      subtitle="Detalle del repartidor">
      <button class="btn-secondary" (click)="router.navigate(['/couriers'])">← Volver</button>
    </app-page-header>

    @if (loading()) {
      <div class="flex items-center justify-center py-24">
        <svg class="animate-spin h-8 w-8 text-brand-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
      </div>
    } @else if (!courier()) {
      <div class="py-24 text-center text-gray-400">
        <p class="text-3xl mb-2">🛵</p>
        <p>Repartidor no encontrado</p>
      </div>
    } @else {
      <!-- Header summary -->
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div class="card p-5 flex items-center gap-4 sm:col-span-2">
          @if (courier()!.photo_url || courier()!.avatar_url) {
            <img [src]="courier()!.photo_url ?? courier()!.avatar_url" class="w-16 h-16 rounded-full object-cover ring-2 ring-brand-200" alt="" />
          } @else {
            <div class="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center text-2xl font-bold text-brand-600">
              {{ courier()!.full_name?.charAt(0) ?? '?' }}
            </div>
          }
          <div class="min-w-0">
            <p class="font-semibold text-gray-900 truncate">{{ courier()!.full_name }}</p>
            <p class="text-sm text-gray-500">{{ courier()!.email }}</p>
            <p class="text-xs text-gray-400 mt-0.5">{{ courier()!.phone }}</p>
            <div class="mt-1">
              <app-status-badge [status]="courier()!.approval_status ?? 'pendiente'" type="approval" />
            </div>
          </div>
        </div>
        <div class="card p-5">
          <p class="text-xs text-gray-400 uppercase font-semibold mb-1">Rating / Entregas</p>
          <p class="text-2xl font-bold text-gray-800">⭐ {{ courier()!.avg_rating.toFixed(1) }}</p>
          <p class="text-sm text-gray-500 mt-1">{{ courier()!.total_deliveries }} entregas</p>
        </div>
        <div class="card p-5">
          <p class="text-xs text-gray-400 uppercase font-semibold mb-1">Ganancias totales</p>
          <p class="text-2xl font-bold text-gray-800">RD$ {{ courier()!.total_earnings.toFixed(0) }}</p>
          <div class="mt-1">
            <span class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
              [class]="courier()!.is_available ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-500'">
              {{ courier()!.is_available ? '● Disponible' : '○ No disponible' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Approval Actions -->
      @if (courier()!.approval_status === 'pendiente') {
        <div class="card p-4 mb-6 bg-warning-50 border-warning-200 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div class="flex-1">
            <p class="font-medium text-warning-800">Repartidor pendiente de aprobación</p>
            <p class="text-sm text-warning-600">Revisa sus documentos antes de aprobar.</p>
          </div>
          <div class="flex gap-2">
            <button class="px-4 py-2 text-sm rounded-lg bg-success-600 text-white hover:bg-success-700 transition-colors font-medium" (click)="confirmApprove()">✓ Aprobar</button>
            <button class="px-4 py-2 text-sm rounded-lg bg-error-600 text-white hover:bg-error-700 transition-colors font-medium" (click)="showRejectModal.set(true)">✗ Rechazar</button>
          </div>
        </div>
      }

      <!-- Tabs -->
      <div class="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 overflow-x-auto">
        @for (tab of tabs; track tab.key) {
          <button
            class="px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
            [class]="activeTab() === tab.key ? 'bg-white text-gray-800 shadow-theme-xs' : 'text-gray-500 hover:text-gray-700'"
            (click)="setTab(tab.key)">{{ tab.label }}</button>
        }
      </div>

      <!-- TAB: Overview -->
      @if (activeTab() === 'overview') {
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card p-5 space-y-4">
            <h3 class="font-semibold text-gray-800">Identidad</h3>
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between"><dt class="text-gray-500">Nombre completo</dt><dd class="font-medium text-gray-800">{{ courier()!.full_name }}</dd></div>
              <div class="flex justify-between"><dt class="text-gray-500">Cédula</dt><dd class="font-medium text-gray-800">{{ courier()!.cedula ?? '—' }}</dd></div>
              <div class="flex justify-between"><dt class="text-gray-500">Género</dt><dd class="font-medium text-gray-800">{{ courier()!.gender ?? '—' }}</dd></div>
              <div class="flex justify-between"><dt class="text-gray-500">Email</dt><dd class="font-medium text-gray-800">{{ courier()!.email }}</dd></div>
              <div class="flex justify-between"><dt class="text-gray-500">Teléfono</dt><dd class="font-medium text-gray-800">{{ courier()!.phone }}</dd></div>
            </dl>
          </div>
          <div class="card p-5 space-y-4">
            <h3 class="font-semibold text-gray-800">Contacto de emergencia</h3>
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between"><dt class="text-gray-500">Nombre</dt><dd class="font-medium text-gray-800">{{ courier()!.emergency_contact_name ?? '—' }}</dd></div>
              <div class="flex justify-between"><dt class="text-gray-500">Teléfono</dt><dd class="font-medium text-gray-800">{{ courier()!.emergency_contact_phone ?? '—' }}</dd></div>
              <div class="flex justify-between"><dt class="text-gray-500">Relación</dt><dd class="font-medium text-gray-800">{{ courier()!.emergency_contact_rel ?? '—' }}</dd></div>
            </dl>
          </div>
          <div class="card p-5 space-y-4">
            <h3 class="font-semibold text-gray-800">Dirección</h3>
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between"><dt class="text-gray-500">Dirección</dt><dd class="font-medium text-gray-800">{{ courier()!.home_address ?? '—' }}</dd></div>
              <div class="flex justify-between"><dt class="text-gray-500">Sector</dt><dd class="font-medium text-gray-800">{{ courier()!.home_sector ?? '—' }}</dd></div>
              <div class="flex justify-between"><dt class="text-gray-500">Ciudad</dt><dd class="font-medium text-gray-800">{{ courier()!.home_city ?? '—' }}</dd></div>
            </dl>
          </div>
          <div class="card p-5 space-y-4">
            <h3 class="font-semibold text-gray-800">RRHH</h3>
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between"><dt class="text-gray-500">Fecha ingreso</dt><dd class="font-medium text-gray-800">{{ courier()!.hire_date ?? '—' }}</dd></div>
              <div class="flex justify-between"><dt class="text-gray-500">Fecha baja</dt><dd class="font-medium text-gray-800">{{ courier()!.termination_date ?? '—' }}</dd></div>
              <div class="flex justify-between"><dt class="text-gray-500">Razón baja</dt><dd class="font-medium text-gray-800">{{ courier()!.termination_reason ?? '—' }}</dd></div>
              <div class="flex justify-between"><dt class="text-gray-500">Selfie verificada</dt><dd class="font-medium text-gray-800">{{ courier()!.daily_selfie_verified ? 'Sí' : 'No' }}</dd></div>
            </dl>
          </div>
        </div>
      }

      <!-- TAB: Documents -->
      @if (activeTab() === 'documents') {
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          @for (doc of docItems(); track doc.key) {
            <div class="card p-5">
              <div class="flex items-center justify-between mb-3">
                <h3 class="font-semibold text-gray-800">{{ doc.label }}</h3>
                @if (!doc.url) {
                  <span class="text-xs px-2 py-0.5 rounded-full bg-error-50 text-error-700 font-medium">Faltante</span>
                } @else {
                  <span class="text-xs px-2 py-0.5 rounded-full bg-success-50 text-success-700 font-medium">✓ Disponible</span>
                }
              </div>
              @if (doc.url) {
                <img [src]="doc.url" class="w-full h-48 object-cover rounded-lg border border-gray-200" alt="" loading="lazy" />
                <a [href]="doc.url" target="_blank" class="block mt-2 text-xs text-brand-600 hover:underline text-center">Ver imagen completa ↗</a>
              } @else {
                <div class="w-full h-48 rounded-lg bg-gray-100 border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400">
                  <p class="text-3xl mb-1">📄</p>
                  <p class="text-sm">No disponible</p>
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- TAB: Vehicle -->
      @if (activeTab() === 'vehicle') {
        <div class="card p-5 max-w-lg">
          <h3 class="font-semibold text-gray-800 mb-4">Información del vehículo</h3>
          <dl class="space-y-3 text-sm">
            <div class="flex justify-between"><dt class="text-gray-500">Tipo</dt><dd class="font-medium text-gray-800">{{ vehicleLabel(courier()!.vehicle_type) }}</dd></div>
            <div class="flex justify-between"><dt class="text-gray-500">Placa</dt><dd class="font-medium text-gray-800">{{ courier()!.vehicle_plate ?? '—' }}</dd></div>
          </dl>
        </div>
      }

      <!-- TAB: Location -->
      @if (activeTab() === 'location') {
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card p-5">
            <h3 class="font-semibold text-gray-800 mb-4">Última ubicación conocida</h3>
            @if (courier()!.last_lat && courier()!.last_lng) {
              <dl class="space-y-2 text-sm mb-4">
                <div class="flex justify-between"><dt class="text-gray-500">Latitud</dt><dd class="font-mono text-gray-800">{{ courier()!.last_lat }}</dd></div>
                <div class="flex justify-between"><dt class="text-gray-500">Longitud</dt><dd class="font-mono text-gray-800">{{ courier()!.last_lng }}</dd></div>
                <div class="flex justify-between"><dt class="text-gray-500">Rumbo</dt><dd class="text-gray-800">{{ courier()!.heading ?? '—' }}°</dd></div>
                <div class="flex justify-between"><dt class="text-gray-500">Velocidad</dt><dd class="text-gray-800">{{ courier()!.speed_kmh ?? 0 }} km/h</dd></div>
                <div class="flex justify-between"><dt class="text-gray-500">Última actualización</dt><dd class="text-gray-800">{{ courier()!.last_location_at | date:'dd/MM/yy HH:mm' }}</dd></div>
              </dl>
              @if (isLocationStale()) {
                <div class="rounded-lg bg-warning-50 border border-warning-200 px-3 py-2 text-xs text-warning-700">
                  ⚠️ Ubicación desactualizada — última señal hace {{ staleMinutes() }} min
                </div>
              }
              <a [href]="'https://maps.google.com/?q=' + courier()!.last_lat + ',' + courier()!.last_lng" target="_blank"
                class="block mt-3 text-xs text-brand-600 hover:underline">Ver en Google Maps ↗</a>
            } @else {
              <p class="text-gray-400 text-sm py-8 text-center">Sin ubicación registrada</p>
            }
          </div>
          <div class="card p-0 overflow-hidden">
            <div class="px-5 py-4 border-b border-gray-100">
              <h3 class="font-semibold text-gray-800">Historial de ubicaciones recientes</h3>
            </div>
            @if (locationLoading()) {
              <div class="p-5 space-y-3">@for (i of [1,2,3]; track i){<div class="animate-pulse h-8 bg-gray-200 rounded"></div>}</div>
            } @else if (locationHistory().length === 0) {
              <p class="px-5 py-8 text-center text-gray-400 text-sm">Sin historial disponible</p>
            } @else {
              <ul class="divide-y divide-gray-100">
                @for (loc of locationHistory(); track loc.id) {
                  <li class="px-5 py-3 flex items-center justify-between text-sm">
                    <span class="font-mono text-xs text-gray-500">{{ loc.lat.toFixed(5) }}, {{ loc.lng.toFixed(5) }}</span>
                    <div class="text-right text-xs text-gray-400">
                      <p>{{ loc.speed_kmh ?? 0 }} km/h</p>
                      <p>{{ loc.recorded_at | date:'dd/MM HH:mm' }}</p>
                    </div>
                  </li>
                }
              </ul>
            }
          </div>
        </div>
      }

      <!-- TAB: Wallet -->
      @if (activeTab() === 'wallet') {
        @if (walletLoading()) {
          <div class="animate-pulse h-32 bg-gray-200 rounded-xl"></div>
        } @else if (wallet()) {
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="card p-5">
              <p class="text-xs text-gray-400 uppercase font-semibold mb-1">Balance actual</p>
              <p class="text-3xl font-bold text-gray-800">RD$ {{ wallet()!.balance.toFixed(2) }}</p>
              <span class="mt-2 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                [class]="wallet()!.is_active ? 'bg-success-50 text-success-700' : 'bg-error-50 text-error-700'">
                {{ wallet()!.is_active ? '● Activa' : '○ Inactiva' }}
              </span>
            </div>
            <div class="card p-0 overflow-hidden lg:col-span-2">
              <div class="px-5 py-4 border-b border-gray-100"><h3 class="font-semibold text-gray-800">Transacciones recientes</h3></div>
              @if (transactionsLoading()) {
                <div class="p-5">@for (i of [1,2,3]; track i){<div class="animate-pulse h-8 bg-gray-200 rounded mb-2"></div>}</div>
              } @else if (transactions().length === 0) {
                <p class="px-5 py-8 text-center text-gray-400 text-sm">Sin transacciones</p>
              } @else {
                <ul class="divide-y divide-gray-100">
                  @for (t of transactions(); track t.id) {
                    <li class="px-5 py-3 flex items-center justify-between text-sm">
                      <div>
                        <p class="font-medium text-gray-800">{{ t.description ?? t.type }}</p>
                        <p class="text-xs text-gray-400">{{ t.created_at | date:'dd/MM/yy HH:mm' }}</p>
                      </div>
                      <span class="font-semibold" [class]="t.amount >= 0 ? 'text-success-600' : 'text-error-600'">
                        {{ t.amount >= 0 ? '+' : '' }}RD$ {{ t.amount.toFixed(2) }}
                      </span>
                    </li>
                  }
                </ul>
              }
            </div>
          </div>
        } @else {
          <div class="card p-8 text-center text-gray-400"><p class="text-2xl mb-2">💰</p><p class="text-sm">Sin billetera registrada</p></div>
        }
      }

      <!-- TAB: Bank Accounts -->
      @if (activeTab() === 'bank') {
        @if (bankLoading()) {
          <div class="space-y-3">@for (i of [1,2]; track i){<div class="animate-pulse h-20 bg-gray-200 rounded-xl"></div>}</div>
        } @else if (bankAccounts().length === 0) {
          <div class="card p-8 text-center text-gray-400"><p class="text-2xl mb-2">🏦</p><p class="text-sm">Sin cuentas bancarias registradas</p></div>
        } @else {
          <div class="space-y-4">
            @for (acc of bankAccounts(); track acc.id) {
              <div class="card p-5">
                <div class="flex items-start justify-between">
                  <div>
                    <p class="font-semibold text-gray-800">{{ acc.bank_name }}</p>
                    <p class="text-sm text-gray-500 mt-0.5">{{ acc.account_type }}</p>
                  </div>
                  <p class="font-mono text-sm text-gray-700">****&nbsp;{{ acc.account_number.slice(-4) }}</p>
                </div>
                @if (acc.is_primary) {
                  <span class="mt-2 inline-flex text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">Principal</span>
                }
              </div>
            }
          </div>
        }
      }

      <!-- TAB: Ratings -->
      @if (activeTab() === 'ratings') {
        @if (ratingsLoading()) {
          <div class="space-y-3">@for (i of [1,2,3]; track i){<div class="animate-pulse h-16 bg-gray-200 rounded-xl"></div>}</div>
        } @else if (ratings().length === 0) {
          <div class="card p-8 text-center text-gray-400"><p class="text-2xl mb-2">⭐</p><p class="text-sm">Sin calificaciones aún</p></div>
        } @else {
          <div class="card p-0 overflow-hidden">
            <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 class="font-semibold text-gray-800">Calificaciones</h3>
              <span class="text-sm text-gray-500">⭐ {{ courier()!.avg_rating.toFixed(1) }} promedio</span>
            </div>
            <ul class="divide-y divide-gray-100">
              @for (r of ratings(); track r.id) {
                <li class="px-5 py-4">
                  <div class="flex justify-between items-start">
                    <div>
                      <p class="text-sm font-medium text-gray-800">{{ r.customer_name }}</p>
                      @if (r.comment) { <p class="text-sm text-gray-500 mt-0.5">{{ r.comment }}</p> }
                    </div>
                    <div class="text-right">
                      <p class="text-sm font-semibold text-warning-600">⭐ {{ r.rating }}</p>
                      <p class="text-xs text-gray-400 mt-0.5">{{ r.created_at | date:'dd/MM/yy' }}</p>
                    </div>
                  </div>
                </li>
              }
            </ul>
          </div>
        }
      }

      <!-- TAB: Sessions -->
      @if (activeTab() === 'sessions') {
        @if (sessionsLoading()) {
          <div class="animate-pulse h-40 bg-gray-200 rounded-xl"></div>
        } @else if (sessions().length === 0) {
          <div class="card p-8 text-center text-gray-400"><p class="text-2xl mb-2">📋</p><p class="text-sm">Sin sesiones registradas</p></div>
        } @else {
          <div class="card p-0 overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Multiplicador</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Pedidos</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Inicio</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fin</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                @for (s of sessions(); track s.id) {
                  <tr>
                    <td class="px-4 py-3 text-sm text-gray-800">{{ s.session_type ?? '—' }}</td>
                    <td class="px-4 py-3 text-sm text-gray-700">{{ s.earnings_multiplier ?? 1 }}x</td>
                    <td class="px-4 py-3 text-sm text-gray-700">{{ s.orders_completed ?? 0 }}</td>
                    <td class="px-4 py-3 text-xs text-gray-400">{{ s.started_at ? (s.started_at | date:'dd/MM/yy HH:mm') : '—' }}</td>
                    <td class="px-4 py-3 text-xs text-gray-400">{{ s.ended_at ? (s.ended_at | date:'dd/MM/yy HH:mm') : '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }

      <!-- TAB: Zones -->
      @if (activeTab() === 'zones') {
        @if (zonesLoading()) {
          <div class="animate-pulse h-32 bg-gray-200 rounded-xl"></div>
        } @else if (zones().length === 0) {
          <div class="card p-8 text-center text-gray-400"><p class="text-2xl mb-2">🗺️</p><p class="text-sm">Sin zonas asignadas</p></div>
        } @else {
          <div class="space-y-3">
            @for (z of zones(); track z.id) {
              <div class="card p-4 flex items-center justify-between">
                <div>
                  <p class="font-medium text-gray-800">{{ z.zone?.name ?? 'Zona #' + z.zone_id }}</p>
                  @if (z.zone?.sector_list?.length) {
                    <p class="text-xs text-gray-400">{{ z.zone.sector_list.join(', ') }}</p>
                  }
                </div>
                <span class="text-xs text-gray-500">RD$ {{ z.zone?.delivery_fee ?? '—' }}</span>
              </div>
            }
          </div>
        }
      }

      <!-- TAB: Absences -->
      @if (activeTab() === 'absences') {
        <div class="flex justify-end mb-4">
          <button class="btn-primary text-sm" (click)="showAbsenceForm.set(true)">+ Registrar ausencia</button>
        </div>
        @if (absencesLoading()) {
          <div class="animate-pulse h-32 bg-gray-200 rounded-xl"></div>
        } @else if (absences().length === 0) {
          <div class="card p-8 text-center text-gray-400"><p class="text-2xl mb-2">📅</p><p class="text-sm">Sin ausencias registradas</p></div>
        } @else {
          <div class="card p-0 overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Razón</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Registrado</th>
                  <th class="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                @for (a of absences(); track a.id) {
                  <tr>
                    <td class="px-4 py-3 text-sm font-medium text-gray-800">{{ a.date }}</td>
                    <td class="px-4 py-3 text-sm text-gray-600">{{ a.reason ?? '—' }}</td>
                    <td class="px-4 py-3 text-xs text-gray-400">{{ a.created_at | date:'dd/MM/yy' }}</td>
                    <td class="px-4 py-3">
                      <button class="text-xs text-error-500 hover:text-error-700" (click)="deleteAbsence(a.id)">Eliminar</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        @if (showAbsenceForm()) {
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-black/50" (click)="showAbsenceForm.set(false)"></div>
            <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
              <h3 class="font-semibold text-gray-800 mb-4">Registrar ausencia</h3>
              <div class="space-y-4">
                <div><label class="label">Fecha *</label><input type="date" class="input-field" [(ngModel)]="newAbsenceDate" /></div>
                <div><label class="label">Razón</label><textarea class="input-field resize-none" rows="2" [(ngModel)]="newAbsenceReason"></textarea></div>
              </div>
              <div class="flex gap-3 justify-end mt-4">
                <button class="btn-secondary" (click)="showAbsenceForm.set(false)">Cancelar</button>
                <button class="btn-primary" [disabled]="!newAbsenceDate || formLoading()" (click)="saveAbsence()">
                  {{ formLoading() ? 'Guardando...' : 'Guardar' }}
                </button>
              </div>
            </div>
          </div>
        }
      }

      <!-- TAB: Sanctions -->
      @if (activeTab() === 'sanctions') {
        <div class="flex justify-end mb-4">
          <button class="btn-primary text-sm" (click)="showSanctionForm.set(true)">+ Registrar sanción</button>
        </div>
        @if (sanctionsLoading()) {
          <div class="animate-pulse h-32 bg-gray-200 rounded-xl"></div>
        } @else if (sanctions().length === 0) {
          <div class="card p-8 text-center text-gray-400"><p class="text-2xl mb-2">⚠️</p><p class="text-sm">Sin sanciones registradas</p></div>
        } @else {
          <div class="card p-0 overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Severidad</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Puntos</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Razón</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                @for (s of sanctions(); track s.id) {
                  <tr>
                    <td class="px-4 py-3 text-sm font-medium text-gray-800">{{ s.type }}</td>
                    <td class="px-4 py-3">
                      <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                        [class]="sanctionSeverityClass(s.severity)">{{ s.severity ?? '—' }}</span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-700">{{ s.points ?? '—' }}</td>
                    <td class="px-4 py-3 text-sm text-gray-600">{{ s.reason ?? '—' }}</td>
                    <td class="px-4 py-3 text-xs text-gray-400">{{ s.created_at | date:'dd/MM/yy' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        @if (showSanctionForm()) {
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-black/50" (click)="showSanctionForm.set(false)"></div>
            <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
              <h3 class="font-semibold text-gray-800 mb-4">Registrar sanción</h3>
              <div class="space-y-4">
                <div><label class="label">Tipo *</label><input class="input-field" [(ngModel)]="newSanctionType" placeholder="ej: Tardanza" /></div>
                <div><label class="label">Severidad</label>
                  <select class="input-field" [(ngModel)]="newSanctionSeverity">
                    <option value="">Sin clasificar</option>
                    <option value="leve">Leve</option>
                    <option value="moderada">Moderada</option>
                    <option value="grave">Grave</option>
                  </select>
                </div>
                <div><label class="label">Puntos</label><input type="number" class="input-field" [(ngModel)]="newSanctionPoints" min="0" /></div>
                <div><label class="label">Razón</label><textarea class="input-field resize-none" rows="2" [(ngModel)]="newSanctionReason"></textarea></div>
              </div>
              <div class="flex gap-3 justify-end mt-4">
                <button class="btn-secondary" (click)="showSanctionForm.set(false)">Cancelar</button>
                <button class="btn-primary" [disabled]="!newSanctionType || formLoading()" (click)="saveSanction()">
                  {{ formLoading() ? 'Guardando...' : 'Guardar' }}
                </button>
              </div>
            </div>
          </div>
        }
      }

      <!-- TAB: Orders -->
      @if (activeTab() === 'orders') {
        <div class="card p-0 overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h3 class="font-semibold text-gray-800">Historial de entregas</h3>
            <span class="text-sm text-gray-400">{{ historyTotal() }} entregas</span>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Pedido</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Comercio</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                @if (historyLoading()) {
                  @for (i of [1,2,3,4,5]; track i) {
                    <tr class="animate-pulse">
                      @for (j of [1,2,3,4,5]; track j) { <td class="px-4 py-3"><div class="h-4 bg-gray-200 rounded w-3/4"></div></td> }
                    </tr>
                  }
                } @else if (history().length === 0) {
                  <tr><td colspan="5" class="px-4 py-8 text-center text-gray-400 text-sm">Sin entregas registradas</td></tr>
                } @else {
                  @for (order of history(); track order.id) {
                    <tr class="hover:bg-gray-50">
                      <td class="px-4 py-3 text-sm font-medium text-gray-800">{{ order.order_number }}</td>
                      <td class="px-4 py-3 text-sm text-gray-600">{{ order.restaurant_name }}</td>
                      <td class="px-4 py-3 text-sm text-gray-600">{{ order.customer_name }}</td>
                      <td class="px-4 py-3 text-sm font-medium text-gray-700">RD$ {{ order.total }}</td>
                      <td class="px-4 py-3 text-sm text-gray-400">{{ order.created_at | date:'dd/MM/yy HH:mm' }}</td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
          @if (historyTotal() > pageSize) {
            <div class="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <p class="text-xs text-gray-400">{{ (historyPage() - 1) * pageSize + 1 }}–{{ Math.min(historyPage() * pageSize, historyTotal()) }} de {{ historyTotal() }}</p>
              <div class="flex gap-2">
                <button class="btn-secondary text-xs px-3 py-1" [disabled]="historyPage() === 1" (click)="changePage(historyPage() - 1)">←</button>
                <button class="btn-secondary text-xs px-3 py-1" [disabled]="historyPage() * pageSize >= historyTotal()" (click)="changePage(historyPage() + 1)">→</button>
              </div>
            </div>
          }
        </div>
      }
    }

    <!-- Reject/Suspend confirmation modal -->
    @if (showRejectModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="showRejectModal.set(false)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
          <h3 class="font-semibold text-gray-800 mb-2">Rechazar repartidor</h3>
          <p class="text-sm text-gray-500 mb-4">Esta acción cambiará el estado de {{ courier()?.full_name }} a rechazado.</p>
          <div class="mb-4">
            <label class="label">Razón (opcional)</label>
            <textarea class="input-field resize-none" rows="2" [(ngModel)]="rejectReason"></textarea>
          </div>
          <div class="flex gap-3 justify-end">
            <button class="btn-secondary" (click)="showRejectModal.set(false)">Cancelar</button>
            <button class="btn-danger" [disabled]="actionLoading()" (click)="executeReject()">
              {{ actionLoading() ? 'Procesando...' : 'Rechazar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CourierDetailPageComponent implements OnInit {
  readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(CouriersService);
  private readonly toastService = inject(ToastService);
  private readonly authService = inject(AuthService);

  readonly courier = signal<Courier | null>(null);
  readonly loading = signal(true);
  readonly activeTab = signal<DetailTab>('overview');
  readonly showRejectModal = signal(false);
  readonly actionLoading = signal(false);

  // Data signals per tab
  readonly history = signal<any[]>([]);
  readonly historyTotal = signal(0);
  readonly historyPage = signal(1);
  readonly historyLoading = signal(false);
  readonly ratings = signal<any[]>([]);
  readonly ratingsLoading = signal(false);
  readonly wallet = signal<RepartidorWallet | null>(null);
  readonly walletLoading = signal(false);
  readonly transactions = signal<WalletTransaction[]>([]);
  readonly transactionsLoading = signal(false);
  readonly bankAccounts = signal<RepartidorBankAccount[]>([]);
  readonly bankLoading = signal(false);
  readonly sessions = signal<RepartidorSession[]>([]);
  readonly sessionsLoading = signal(false);
  readonly zones = signal<any[]>([]);
  readonly zonesLoading = signal(false);
  readonly absences = signal<RepartidorAbsence[]>([]);
  readonly absencesLoading = signal(false);
  readonly sanctions = signal<RepartidorSanction[]>([]);
  readonly sanctionsLoading = signal(false);
  readonly locationHistory = signal<DriverLocationHistory[]>([]);
  readonly locationLoading = signal(false);
  readonly formLoading = signal(false);
  readonly showAbsenceForm = signal(false);
  readonly showSanctionForm = signal(false);

  // Form state
  newAbsenceDate = '';
  newAbsenceReason = '';
  newSanctionType = '';
  newSanctionSeverity = '';
  newSanctionPoints: number | null = null;
  newSanctionReason = '';
  rejectReason = '';

  readonly pageSize = 15;
  readonly Math = Math;
  private courierId = '';

  readonly tabs = [
    { key: 'overview' as DetailTab, label: 'Resumen' },
    { key: 'documents' as DetailTab, label: 'Documentos' },
    { key: 'vehicle' as DetailTab, label: 'Vehículo' },
    { key: 'location' as DetailTab, label: 'Ubicación' },
    { key: 'wallet' as DetailTab, label: 'Billetera' },
    { key: 'bank' as DetailTab, label: 'Cuentas bancarias' },
    { key: 'ratings' as DetailTab, label: 'Calificaciones' },
    { key: 'sessions' as DetailTab, label: 'Sesiones' },
    { key: 'zones' as DetailTab, label: 'Zonas' },
    { key: 'absences' as DetailTab, label: 'Ausencias' },
    { key: 'sanctions' as DetailTab, label: 'Sanciones' },
    { key: 'orders' as DetailTab, label: 'Pedidos' },
  ];

  readonly docItems = () => {
    const c = this.courier();
    return [
      { key: 'photo', label: 'Foto del repartidor', url: c?.photo_url ?? c?.avatar_url ?? null },
      { key: 'cedula', label: 'Cédula', url: c?.cedula_photo_url ?? null },
      { key: 'vehicle', label: 'Foto del vehículo', url: c?.vehicle_photo_url ?? null },
      { key: 'license', label: 'Licencia de conducir', url: c?.license_photo_url ?? null },
    ];
  };

  readonly isLocationStale = () => {
    const t = this.courier()?.last_location_at;
    if (!t) return false;
    return (Date.now() - new Date(t).getTime()) > 30 * 60 * 1000;
  };

  readonly staleMinutes = () => {
    const t = this.courier()?.last_location_at;
    if (!t) return 0;
    return Math.round((Date.now() - new Date(t).getTime()) / 60000);
  };

  ngOnInit(): void {
    this.courierId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadCourier();
  }

  loadCourier(): void {
    this.loading.set(true);
    this.service.getCourierById(this.courierId).subscribe({
      next: data => { this.courier.set(data); this.loading.set(false); },
      error: () => { this.toastService.error('Error al cargar el repartidor'); this.loading.set(false); },
    });
  }

  setTab(tab: DetailTab): void {
    this.activeTab.set(tab);
    if (tab === 'orders' && this.history().length === 0) this.loadHistory();
    if (tab === 'ratings' && this.ratings().length === 0) this.loadRatings();
    if (tab === 'wallet' && !this.wallet()) this.loadWallet();
    if (tab === 'bank' && this.bankAccounts().length === 0) this.loadBankAccounts();
    if (tab === 'sessions' && this.sessions().length === 0) this.loadSessions();
    if (tab === 'zones' && this.zones().length === 0) this.loadZones();
    if (tab === 'absences' && this.absences().length === 0) this.loadAbsences();
    if (tab === 'sanctions' && this.sanctions().length === 0) this.loadSanctions();
    if (tab === 'location' && this.locationHistory().length === 0) this.loadLocationHistory();
  }

  loadHistory(page = 1): void {
    this.historyLoading.set(true);
    this.historyPage.set(page);
    this.service.getDeliveryHistory(this.courierId, page, this.pageSize).subscribe(({ data, count }) => {
      this.history.set(data);
      this.historyTotal.set(count);
      this.historyLoading.set(false);
    });
  }

  changePage(page: number): void { this.loadHistory(page); }

  loadRatings(): void {
    this.ratingsLoading.set(true);
    this.service.getRatings(this.courierId).subscribe(data => { this.ratings.set(data); this.ratingsLoading.set(false); });
  }

  loadWallet(): void {
    this.walletLoading.set(true);
    this.service.getDriverWallet(this.courierId).subscribe(w => {
      this.wallet.set(w);
      this.walletLoading.set(false);
      if (w) {
        this.transactionsLoading.set(true);
        this.service.getWalletTransactions(w.id).subscribe(t => { this.transactions.set(t); this.transactionsLoading.set(false); });
      }
    });
  }

  loadBankAccounts(): void {
    this.bankLoading.set(true);
    this.service.getDriverBankAccounts(this.courierId).subscribe(data => { this.bankAccounts.set(data); this.bankLoading.set(false); });
  }

  loadSessions(): void {
    this.sessionsLoading.set(true);
    this.service.getDriverSessions(this.courierId).subscribe(data => { this.sessions.set(data); this.sessionsLoading.set(false); });
  }

  loadZones(): void {
    this.zonesLoading.set(true);
    this.service.getDriverZones(this.courierId).subscribe(data => { this.zones.set(data); this.zonesLoading.set(false); });
  }

  loadAbsences(): void {
    this.absencesLoading.set(true);
    this.service.getDriverAbsences(this.courierId).subscribe(data => { this.absences.set(data); this.absencesLoading.set(false); });
  }

  loadSanctions(): void {
    this.sanctionsLoading.set(true);
    this.service.getDriverSanctions(this.courierId).subscribe(data => { this.sanctions.set(data); this.sanctionsLoading.set(false); });
  }

  loadLocationHistory(): void {
    this.locationLoading.set(true);
    this.service.getDriverLocationHistory(this.courierId).subscribe(data => { this.locationHistory.set(data); this.locationLoading.set(false); });
  }

  async confirmApprove(): Promise<void> {
    this.actionLoading.set(true);
    try {
      await this.service.approveDriver(this.courierId, this.authService.currentUser()?.id ?? '');
      this.toastService.success('Repartidor aprobado');
      this.loadCourier();
    } catch { this.toastService.error('Error al aprobar'); }
    finally { this.actionLoading.set(false); }
  }

  async executeReject(): Promise<void> {
    this.actionLoading.set(true);
    try {
      await this.service.rejectDriver(this.courierId, this.rejectReason || undefined);
      this.toastService.success('Repartidor rechazado');
      this.showRejectModal.set(false);
      this.loadCourier();
    } catch { this.toastService.error('Error al rechazar'); }
    finally { this.actionLoading.set(false); }
  }

  async saveAbsence(): Promise<void> {
    this.formLoading.set(true);
    try {
      await this.service.createDriverAbsence({ repartidor_id: this.courierId, date: this.newAbsenceDate, reason: this.newAbsenceReason || null, registered_by: this.authService.currentUser()?.id ?? null });
      this.toastService.success('Ausencia registrada');
      this.showAbsenceForm.set(false);
      this.newAbsenceDate = '';
      this.newAbsenceReason = '';
      this.absences.set([]);
      this.loadAbsences();
    } catch { this.toastService.error('Error al guardar'); }
    finally { this.formLoading.set(false); }
  }

  async deleteAbsence(id: string): Promise<void> {
    try {
      await this.service.deleteDriverAbsence(id);
      this.toastService.success('Ausencia eliminada');
      this.absences.update(list => list.filter(a => a.id !== id));
    } catch { this.toastService.error('Error al eliminar'); }
  }

  async saveSanction(): Promise<void> {
    if (!this.newSanctionType) return;
    this.formLoading.set(true);
    try {
      await this.service.createDriverSanction({
        repartidor_id: this.courierId,
        type: this.newSanctionType,
        severity: this.newSanctionSeverity || null,
        points: this.newSanctionPoints ?? null,
        reason: this.newSanctionReason || null,
        applied_by: this.authService.currentUser()?.id ?? null,
      });
      this.toastService.success('Sanción registrada');
      this.showSanctionForm.set(false);
      this.newSanctionType = '';
      this.newSanctionSeverity = '';
      this.newSanctionPoints = null;
      this.newSanctionReason = '';
      this.sanctions.set([]);
      this.loadSanctions();
    } catch { this.toastService.error('Error al guardar'); }
    finally { this.formLoading.set(false); }
  }

  vehicleLabel(type?: string | null): string {
    const map: Record<string, string> = {
      moto: '🏍️ Moto', bicicleta: '🚲 Bicicleta', carro: '🚗 Carro', a_pie: '🚶 A pie',
    };
    return type ? (map[type] ?? type) : '—';
  }

  sanctionSeverityClass(severity?: string | null): string {
    if (severity === 'grave') return 'bg-error-100 text-error-700';
    if (severity === 'moderada') return 'bg-warning-100 text-warning-700';
    return 'bg-gray-100 text-gray-600';
  }
}
