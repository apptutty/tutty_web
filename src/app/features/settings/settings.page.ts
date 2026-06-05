import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SettingsService, AdminUser } from './settings.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { AppSetting, Holiday, StoreCategory, AuditLogEntry, CommerceType } from '../../core/supabase/database.types';

type SettingsTab = 'general' | 'delivery' | 'notificaciones' | 'feriados' | 'usuarios' | 'comercios' | 'categorias' | 'auditoria' | 'surcharge';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, PageHeaderComponent],
  template: `
    <div class="p-6">
      <app-page-header title="Configuración" subtitle="Gestión de parámetros del sistema" />

      <!-- Tabs -->
      <div class="border-b border-gray-200 mb-6">
        <nav class="-mb-px flex space-x-8">
          @for (tab of tabs; track tab.id) {
            <button
              (click)="activeTab.set(tab.id)"
              [class]="activeTab() === tab.id
                ? 'border-brand-500 text-brand-500 border-b-2 py-4 px-1 text-sm font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700 border-b-2 py-4 px-1 text-sm font-medium'">
              {{ tab.label }}
            </button>
          }
        </nav>
      </div>

      <!-- General -->
      @if (activeTab() === 'general') {
        <div class="max-w-2xl">
          <div class="card p-6 mb-6">
            <h3 class="text-lg font-semibold mb-4 text-gray-900">Configuración General</h3>
            @if (loadingSettings()) {
              <div class="space-y-4">
                @for (i of [1,2,3,4]; track i) {
                  <div class="animate-pulse h-10 bg-gray-200 rounded"></div>
                }
              </div>
            } @else {
              <form (ngSubmit)="saveGeneralSettings()" class="space-y-4">
                <div>
                  <label class="label">Monto Mínimo de Pedido (RD$)</label>
                  <input type="number" class="input-field" [(ngModel)]="generalForm.min_order_amount" name="min_order_amount" min="0" step="1" />
                </div>
                <div>
                  <label class="label">Tarifa de Envío Predeterminada (RD$)</label>
                  <input type="number" class="input-field" [(ngModel)]="generalForm.default_delivery_fee" name="default_delivery_fee" min="0" step="1" />
                </div>
                <div>
                  <label class="label">Comisión Predeterminada (%)</label>
                  <input type="number" class="input-field" [(ngModel)]="generalForm.default_commission_rate" name="default_commission_rate" min="0" max="100" step="0.1" />
                </div>
                <div>
                  <label class="label">Tasa ITBIS (%)</label>
                  <input type="number" class="input-field" [(ngModel)]="generalForm.itbis_rate" name="itbis_rate" min="0" max="100" step="0.1" />
                </div>
                <div>
                  <label class="label">Máx. Artículos por Pedido</label>
                  <input type="number" class="input-field" [(ngModel)]="generalForm.max_items_per_order" name="max_items_per_order" min="1" step="1" />
                </div>
                <div>
                  <label class="label">Máx. Pedidos simultáneos</label>
                  <input type="number" class="input-field" [(ngModel)]="generalForm.max_orders_in_flight" name="max_orders_in_flight" min="1" step="1" />
                </div>
                <div>
                  <label class="label">Bono por referido (RD$)</label>
                  <input type="number" class="input-field" [(ngModel)]="generalForm.referral_bonus_amount" name="referral_bonus_amount" min="0" step="1" />
                </div>
                <div>
                  <label class="label">Auto-cancelar pedido sin confirmar (min)</label>
                  <input type="number" class="input-field" [(ngModel)]="generalForm.order_auto_cancel_minutes" name="order_auto_cancel_minutes" min="1" step="1" />
                </div>
                <div>
                  <label class="label">Umbral Envío Gratis (RD$)</label>
                  <input type="number" class="input-field" [(ngModel)]="generalForm.free_delivery_threshold" name="free_delivery_threshold" min="0" step="1" />
                  <p class="text-xs text-gray-500 mt-1">0 = desactivado</p>
                </div>
                <button type="submit" class="btn-primary" [disabled]="savingGeneral()">
                  {{ savingGeneral() ? 'Guardando...' : 'Guardar Cambios' }}
                </button>
              </form>
            }
          </div>
        </div>
      }

      <!-- Delivery & Precios -->
      @if (activeTab() === 'delivery') {
        <div class="max-w-2xl">
          <div class="card p-6 mb-6">
            <h3 class="text-lg font-semibold mb-4 text-gray-900">Tarifas Especiales</h3>
            @if (loadingSettings()) {
              <div class="animate-pulse h-40 bg-gray-200 rounded"></div>
            } @else {
              <form (ngSubmit)="saveDeliverySettings()" class="space-y-6">
                <!-- Recargo Climático -->
                <div class="border rounded-lg p-4">
                  <div class="flex items-center justify-between mb-3">
                    <div>
                      <p class="font-medium text-gray-900">Recargo Climático</p>
                      <p class="text-sm text-gray-500">Aplica tarifa adicional en mal tiempo</p>
                    </div>
                    <button type="button"
                      (click)="deliveryForm.weather_surcharge_enabled = !deliveryForm.weather_surcharge_enabled"
                      [class]="deliveryForm.weather_surcharge_enabled ? 'bg-brand-500 relative inline-flex h-6 w-11 rounded-full transition-colors' : 'bg-gray-200 relative inline-flex h-6 w-11 rounded-full transition-colors'">
                      <span [class]="deliveryForm.weather_surcharge_enabled ? 'translate-x-6 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5' : 'translate-x-0 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'"></span>
                    </button>
                  </div>
                  @if (deliveryForm.weather_surcharge_enabled) {
                    <div>
                      <label class="label">Porcentaje de Recargo (%)</label>
                      <input type="number" class="input-field" [(ngModel)]="deliveryForm.weather_surcharge_rate" name="weather_surcharge_rate" min="0" max="100" step="1" />
                    </div>
                  }
                </div>

                <!-- Recargo Hora Pico -->
                <div class="border rounded-lg p-4">
                  <div class="flex items-center justify-between mb-3">
                    <div>
                      <p class="font-medium text-gray-900">Recargo Hora Pico</p>
                      <p class="text-sm text-gray-500">Tarifa dinámica en horario de alta demanda</p>
                    </div>
                    <button type="button"
                      (click)="deliveryForm.surge_pricing_enabled = !deliveryForm.surge_pricing_enabled"
                      [class]="deliveryForm.surge_pricing_enabled ? 'bg-brand-500 relative inline-flex h-6 w-11 rounded-full transition-colors' : 'bg-gray-200 relative inline-flex h-6 w-11 rounded-full transition-colors'">
                      <span [class]="deliveryForm.surge_pricing_enabled ? 'translate-x-6 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5' : 'translate-x-0 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'"></span>
                    </button>
                  </div>
                  @if (deliveryForm.surge_pricing_enabled) {
                    <div class="space-y-3">
                      <div>
                        <label class="label">Recargo en Pico (%)</label>
                        <input type="number" class="input-field" [(ngModel)]="deliveryForm.peak_surcharge_rate" name="peak_surcharge_rate" min="0" max="200" step="1" />
                      </div>
                      <div>
                        <label class="label">Recargo Nocturno (%)</label>
                        <input type="number" class="input-field" [(ngModel)]="deliveryForm.night_surcharge_rate" name="night_surcharge_rate" min="0" max="200" step="1" />
                      </div>
                      <div>
                        <label class="label">Horario Pico (ej: 12:00-14:00,18:00-21:00)</label>
                        <input type="text" class="input-field" [(ngModel)]="deliveryForm.peak_hours" name="peak_hours" placeholder="12:00-14:00,18:00-21:00" />
                      </div>
                    </div>
                  }
                </div>

                <button type="submit" class="btn-primary" [disabled]="savingDelivery()">
                  {{ savingDelivery() ? 'Guardando...' : 'Guardar Configuración' }}
                </button>
              </form>
            }
          </div>
        </div>
      }

      <!-- Feriados -->
      @if (activeTab() === 'feriados') {
        <div class="max-w-2xl">
          <div class="card p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-gray-900">Feriados Nacionales</h3>
              <button class="btn-primary text-sm" (click)="openHolidayForm()">+ Agregar Feriado</button>
            </div>

            @if (loadingHolidays()) {
              <div class="space-y-2">
                @for (i of [1,2,3]; track i) {
                  <div class="animate-pulse h-12 bg-gray-200 rounded"></div>
                }
              </div>
            } @else if (holidays().length === 0) {
              <p class="text-center text-gray-500 py-8">No hay feriados registrados</p>
            } @else {
              <div class="space-y-2">
                @for (h of holidays(); track h.id) {
                  <div class="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p class="font-medium text-gray-900">{{ h.name }}</p>
                      <p class="text-sm text-gray-500">{{ h.date | date:'dd MMM yyyy':'':'es' }}</p>
                    </div>
                    <div class="flex gap-2">
                      <button class="text-brand-500 hover:text-brand-700 text-sm" (click)="openHolidayForm(h)">Editar</button>
                      <button class="text-error-500 hover:text-error-700 text-sm" (click)="deleteHoliday(h.id)">Eliminar</button>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Holiday modal -->
        @if (showHolidayModal()) {
          <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h3 class="text-lg font-semibold mb-4">{{ editingHoliday()?.id ? 'Editar Feriado' : 'Nuevo Feriado' }}</h3>
              <form (ngSubmit)="saveHoliday()" class="space-y-4">
                <div>
                  <label class="label">Nombre</label>
                  <input type="text" class="input-field" [(ngModel)]="holidayForm.name" name="name" required />
                </div>
                <div>
                  <label class="label">Fecha</label>
                  <input type="date" class="input-field" [(ngModel)]="holidayForm.date" name="date" required />
                </div>
                <div>
                  <label class="label">Recargo Especial (%) — 0 si no aplica</label>
                  <input type="number" class="input-field" [(ngModel)]="holidayForm.surcharge" name="surcharge" min="0" max="200" step="1" />
                </div>
                <div class="flex gap-3 pt-2">
                  <button type="button" class="btn-secondary flex-1" (click)="showHolidayModal.set(false)">Cancelar</button>
                  <button type="submit" class="btn-primary flex-1" [disabled]="savingHoliday()">
                    {{ savingHoliday() ? 'Guardando...' : 'Guardar' }}
                  </button>
                </div>
              </form>
            </div>
          </div>
        }
      }

      <!-- Usuarios Admin -->
      @if (activeTab() === 'notificaciones') {
        <div class="max-w-2xl">
          <div class="card p-6 mb-6">
            <h3 class="text-lg font-semibold mb-4 text-gray-900">Notificaciones del Sistema</h3>
            @if (loadingSettings()) {
              <div class="space-y-4">
                @for (i of [1,2,3]; track i) {
                  <div class="animate-pulse h-16 bg-gray-200 rounded"></div>
                }
              </div>
            } @else {
              <form (ngSubmit)="saveNotifSettings()" class="space-y-5">
                <div class="border rounded-lg p-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="font-medium text-gray-900">Notificaciones Push</p>
                      <p class="text-sm text-gray-500">Enviar push al cliente cuando cambia el estado del pedido</p>
                    </div>
                    <button type="button"
                      (click)="notifForm.push_enabled = !notifForm.push_enabled"
                      [class]="notifForm.push_enabled ? 'bg-brand-500 relative inline-flex h-6 w-11 rounded-full transition-colors' : 'bg-gray-200 relative inline-flex h-6 w-11 rounded-full transition-colors'">
                      <span [class]="notifForm.push_enabled ? 'translate-x-6 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5' : 'translate-x-0 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'"></span>
                    </button>
                  </div>
                </div>
                <div class="border rounded-lg p-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="font-medium text-gray-900">Notificaciones WhatsApp</p>
                      <p class="text-sm text-gray-500">Enviar mensajes de WhatsApp al repartidor</p>
                    </div>
                    <button type="button"
                      (click)="notifForm.whatsapp_enabled = !notifForm.whatsapp_enabled"
                      [class]="notifForm.whatsapp_enabled ? 'bg-brand-500 relative inline-flex h-6 w-11 rounded-full transition-colors' : 'bg-gray-200 relative inline-flex h-6 w-11 rounded-full transition-colors'">
                      <span [class]="notifForm.whatsapp_enabled ? 'translate-x-6 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5' : 'translate-x-0 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'"></span>
                    </button>
                  </div>
                </div>
                <div class="border rounded-lg p-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="font-medium text-gray-900">Notificaciones de Nuevos Pedidos</p>
                      <p class="text-sm text-gray-500">Alertar al restaurante por cada pedido recibido</p>
                    </div>
                    <button type="button"
                      (click)="notifForm.new_order_alert = !notifForm.new_order_alert"
                      [class]="notifForm.new_order_alert ? 'bg-brand-500 relative inline-flex h-6 w-11 rounded-full transition-colors' : 'bg-gray-200 relative inline-flex h-6 w-11 rounded-full transition-colors'">
                      <span [class]="notifForm.new_order_alert ? 'translate-x-6 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5' : 'translate-x-0 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'"></span>
                    </button>
                  </div>
                </div>
                <div class="border rounded-lg p-4">
                  <div class="flex items-center justify-between mb-3">
                    <div>
                      <p class="font-medium text-gray-900">Alertas de Pedidos sin Repartidor</p>
                      <p class="text-sm text-gray-500">Notificar al admin si un pedido lleva X minutos sin asignar</p>
                    </div>
                    <button type="button"
                      (click)="notifForm.unassigned_alert = !notifForm.unassigned_alert"
                      [class]="notifForm.unassigned_alert ? 'bg-brand-500 relative inline-flex h-6 w-11 rounded-full transition-colors' : 'bg-gray-200 relative inline-flex h-6 w-11 rounded-full transition-colors'">
                      <span [class]="notifForm.unassigned_alert ? 'translate-x-6 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5' : 'translate-x-0 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'"></span>
                    </button>
                  </div>
                  @if (notifForm.unassigned_alert) {
                    <div>
                      <label class="label">Minutos de espera antes de alertar</label>
                      <input type="number" class="input-field max-w-xs" [(ngModel)]="notifForm.unassigned_alert_minutes" name="unassigned_minutes" min="1" step="1" />
                    </div>
                  }
                </div>
                <button type="submit" class="btn-primary" [disabled]="savingNotif()">
                  {{ savingNotif() ? 'Guardando...' : 'Guardar Configuración' }}
                </button>
              </form>
            }
          </div>
        </div>
      }

      <!-- Usuarios Admin -->
      @if (activeTab() === 'usuarios') {
        <div>
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900">Usuarios Administradores</h3>
            <button class="btn-primary text-sm" (click)="openUserForm()">+ Nuevo Usuario</button>
          </div>

          @if (loadingUsers()) {
            <div class="card p-6 space-y-3">
              @for (i of [1,2,3]; track i) {
                <div class="animate-pulse h-14 bg-gray-200 rounded"></div>
              }
            </div>
          } @else {
            <div class="card overflow-hidden">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  @for (u of adminUsers(); track u.id) {
                    <tr>
                      <td class="px-6 py-4 text-sm font-medium text-gray-900">{{ u.full_name }}</td>
                      <td class="px-6 py-4 text-sm text-gray-600">{{ u.email }}</td>
                      <td class="px-6 py-4">
                        <span class="px-2 py-1 rounded-full text-xs font-medium"
                          [class]="u.role === 'super_admin' ? 'bg-brand-100 text-brand-700' : u.role === 'restaurant_admin' ? 'bg-brand-50 text-brand-600' : 'bg-success-50 text-success-700'">
                          {{ roleLabels[u.role] || u.role }}
                        </span>
                      </td>
                      <td class="px-6 py-4">
                        <span [class]="u.is_active ? 'text-success-600' : 'text-error-600'" class="text-sm font-medium">
                          {{ u.is_active ? 'Activo' : 'Inactivo' }}
                        </span>
                      </td>
                      <td class="px-6 py-4">
                        <button class="text-sm text-brand-500 hover:text-brand-700" (click)="toggleUser(u)">
                          {{ u.is_active ? 'Desactivar' : 'Activar' }}
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <!-- New User Modal -->
        @if (showUserModal()) {
          <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h3 class="text-lg font-semibold mb-4">Nuevo Usuario Admin</h3>
              <form (ngSubmit)="createUser()" class="space-y-4">
                <div>
                  <label class="label">Nombre Completo</label>
                  <input type="text" class="input-field" [(ngModel)]="userForm.full_name" name="full_name" required />
                </div>
                <div>
                  <label class="label">Email</label>
                  <input type="email" class="input-field" [(ngModel)]="userForm.email" name="email" required />
                </div>
                <div>
                  <label class="label">Contraseña Temporal</label>
                  <input type="password" class="input-field" [(ngModel)]="userForm.password" name="password" required minlength="8" />
                </div>
                <div>
                  <label class="label">Rol</label>
                  <select class="input-field" [(ngModel)]="userForm.role" name="role" required>
                    <option value="super_admin">Superadmin</option>
                    <option value="restaurant_admin">Admin Restaurante</option>
                    <option value="excursion_operator">Admin Operadora</option>
                    <option value="store_admin">Admin Tienda</option>
                  </select>
                </div>
                @if (createUserError()) {
                  <p class="text-sm text-error-600">{{ createUserError() }}</p>
                }
                <div class="flex gap-3 pt-2">
                  <button type="button" class="btn-secondary flex-1" (click)="showUserModal.set(false)">Cancelar</button>
                  <button type="submit" class="btn-primary flex-1" [disabled]="creatingUser()">
                    {{ creatingUser() ? 'Creando...' : 'Crear Usuario' }}
                  </button>
                </div>
              </form>
            </div>
          </div>
        }
      }

      <!-- SA-6.1 Comercios & Aprobación -->
      @if (activeTab() === 'comercios') {
        <div class="max-w-2xl space-y-4">
          <div class="card p-6 border-2 transition-colors"
            [class]="comerciosForm.store_auto_approve ? 'border-warning-400 bg-warning-50' : 'border-gray-200 bg-white'">
            <div class="flex items-start gap-4">
              <div class="flex-1">
                <p class="font-bold text-gray-900 text-base">Aprobación Automática de Comercios</p>
                <p class="text-sm text-gray-500 mt-1">
                  Si está activo, los nuevos comercios se publican inmediatamente sin revisión.
                  Al activar, todos los comercios pendientes se aprobarán.
                </p>
                @if (comerciosForm.store_auto_approve) {
                  <div class="mt-2 flex items-center gap-1.5 text-warning-600 text-sm font-semibold">
                    ⚠️ Modo activo — nuevos comercios se publican sin revisión
                  </div>
                }
              </div>
              <button type="button" (click)="onStoreAutoApproveToggle()"
                class="relative flex-shrink-0 inline-flex h-8 w-16 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-warning-400 focus:ring-offset-2"
                [class]="comerciosForm.store_auto_approve ? 'bg-warning-500' : 'bg-gray-300'">
                <span class="sr-only">Auto-aprobación</span>
                <span class="pointer-events-none inline-block h-7 w-7 rounded-full bg-white shadow-lg transform ring-0 transition-transform duration-300 mt-0.5 ml-0.5"
                  [class]="comerciosForm.store_auto_approve ? 'translate-x-8' : 'translate-x-0'"></span>
              </button>
            </div>
          </div>

          <div class="card p-5">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-gray-900">Aprobación Automática de Repartidores</p>
                <p class="text-sm text-gray-500">Los nuevos repartidores se activan sin revisión manual</p>
              </div>
              <button type="button"
                (click)="comerciosForm.repartidor_auto_approve = !comerciosForm.repartidor_auto_approve"
                class="relative inline-flex h-6 w-11 rounded-full transition-colors"
                [class]="comerciosForm.repartidor_auto_approve ? 'bg-brand-500' : 'bg-gray-200'">
                <span [class]="comerciosForm.repartidor_auto_approve
                  ? 'translate-x-6 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'
                  : 'translate-x-0 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'"></span>
              </button>
            </div>
          </div>

          <div class="card p-5">
            <h4 class="font-semibold text-gray-800 mb-4">Comisión de Onboarding para Nuevos Comercios</h4>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">Días con comisión reducida</label>
                <input type="number" class="input-field" [(ngModel)]="comerciosForm.store_onboarding_commission_days"
                  name="onboarding_days" min="0" max="365" step="1" />
                <p class="text-xs text-gray-400 mt-1">Días desde la apertura del comercio</p>
              </div>
              <div>
                <label class="label">Tasa de comisión reducida (%)</label>
                <input type="number" class="input-field" [(ngModel)]="comerciosForm.store_onboarding_commission_rate"
                  name="onboarding_rate" min="0" max="100" step="0.1" />
                <p class="text-xs text-gray-400 mt-1">Ej: 5 = 5% de comisión</p>
              </div>
            </div>
          </div>

          <button class="btn-primary" (click)="saveComercios()" [disabled]="savingComercios()">
            {{ savingComercios() ? 'Guardando...' : 'Guardar Configuración' }}
          </button>
        </div>

        @if (showAutoApproveConfirm()) {
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-black/50" (click)="showAutoApproveConfirm.set(false)"></div>
            <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
              <div class="text-center mb-4">
                <div class="w-14 h-14 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg class="w-7 h-7 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                </div>
                <h3 class="text-lg font-bold text-gray-900">¿Activar aprobación automática?</h3>
                <p class="text-sm text-gray-500 mt-2">
                  Esto aprobará <strong>todos los comercios pendientes inmediatamente</strong>
                  y los publicará en la plataforma. Esta acción no se puede deshacer automáticamente.
                </p>
              </div>
              <div class="flex gap-3">
                <button class="btn-secondary flex-1" (click)="showAutoApproveConfirm.set(false)">Cancelar</button>
                <button class="flex-1 bg-warning-500 hover:bg-warning-600 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                  (click)="confirmAutoApprove()" [disabled]="approvingAll()">
                  {{ approvingAll() ? 'Aprobando...' : 'Confirmar y Aprobar Todo' }}
                </button>
              </div>
            </div>
          </div>
        }
      }

      <!-- SA-6.2 Categorías de Comercio -->
      @if (activeTab() === 'categorias') {
        <div>
          <div class="flex flex-wrap items-center gap-3 mb-4">
            <select class="input-field w-auto text-sm" [(ngModel)]="categoryTypeFilter"
              (ngModelChange)="loadCategories()">
              <option value="all">Todos los tipos</option>
              @for (ct of commerceTypes; track ct.value) {
                <option [value]="ct.value">{{ ct.label }}</option>
              }
            </select>
            <button class="btn-primary text-sm ml-auto" (click)="openCategoryForm()">+ Nueva Categoría</button>
          </div>

          @if (loadingCategories()) {
            <div class="card p-6 space-y-3">
              @for (i of [1,2,3,4]; track i) {
                <div class="animate-pulse h-12 bg-gray-200 rounded"></div>
              }
            </div>
          } @else if (categories().length === 0) {
            <div class="card p-10 text-center text-gray-400">
              <p class="text-2xl mb-2">🏷</p>
              <p class="font-medium">No hay categorías registradas</p>
              <p class="text-sm mt-1">Crea la primera categoría para organizar los comercios</p>
            </div>
          } @else {
            <div class="card overflow-hidden">
              <table class="min-w-full divide-y divide-gray-200 text-sm">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-3 py-3 w-8"></th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Slug</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo comercio</th>
                    <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Ícono</th>
                    <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Orden</th>
                    <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Activo</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-100">
                  @for (cat of categories(); track cat.id; let i = $index) {
                    <tr
                      draggable="true"
                      (dragstart)="onCategoryDragStart(i)"
                      (dragover)="onCategoryDragOver($event)"
                      (drop)="onCategoryDrop(i)"
                      class="transition-colors"
                      [class]="draggedIndex() === i ? 'opacity-40 bg-brand-50' : 'hover:bg-gray-50 cursor-grab'">
                      <td class="px-3 py-3 text-gray-300 text-lg select-none">⠿</td>
                      <td class="px-4 py-3 font-medium text-gray-800">{{ cat.name }}</td>
                      <td class="px-4 py-3 text-gray-400 font-mono text-xs">{{ cat.slug }}</td>
                      <td class="px-4 py-3 text-gray-600">{{ commerceTypeLabel(cat.commerce_type) }}</td>
                      <td class="px-4 py-3 text-center text-xl">{{ cat.icon }}</td>
                      <td class="px-4 py-3 text-center text-gray-500">{{ cat.display_order }}</td>
                      <td class="px-4 py-3 text-center">
                        <span [class]="cat.is_active ? 'text-success-600' : 'text-error-500'"
                          class="font-medium text-xs">{{ cat.is_active ? 'Sí' : 'No' }}</span>
                      </td>
                      <td class="px-4 py-3">
                        <div class="flex gap-2">
                          <button class="text-brand-500 hover:text-brand-700 text-sm"
                            (click)="openCategoryForm(cat)">Editar</button>
                          <button class="text-error-500 hover:text-error-700 text-sm"
                            (click)="deleteCategory(cat.id)"
                            [disabled]="deletingCategoryId() === cat.id">
                            {{ deletingCategoryId() === cat.id ? '...' : 'Eliminar' }}
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        @if (showCategoryModal()) {
          <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
              <h3 class="text-lg font-semibold mb-4">
                {{ editingCategory()?.id ? 'Editar Categoría' : 'Nueva Categoría' }}
              </h3>
              <form (ngSubmit)="saveCategory()" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="label">Nombre</label>
                    <input type="text" class="input-field" [(ngModel)]="categoryForm.name"
                      (ngModelChange)="generateSlug($event)" name="cat_name" required />
                  </div>
                  <div>
                    <label class="label">Slug</label>
                    <input type="text" class="input-field font-mono text-sm"
                      [(ngModel)]="categoryForm.slug" name="cat_slug" required />
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="label">Tipo de Comercio</label>
                    <select class="input-field" [(ngModel)]="categoryForm.commerce_type" name="cat_type">
                      @for (ct of commerceTypes; track ct.value) {
                        <option [value]="ct.value">{{ ct.label }}</option>
                      }
                    </select>
                  </div>
                  <div>
                    <label class="label">Ícono (emoji o texto)</label>
                    <input type="text" class="input-field" [(ngModel)]="categoryForm.icon"
                      name="cat_icon" placeholder="🍽" />
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="label">Orden de visualización</label>
                    <input type="number" class="input-field" [(ngModel)]="categoryForm.display_order"
                      name="cat_order" min="0" step="1" />
                  </div>
                  <div class="flex items-center gap-3 pt-6">
                    <button type="button"
                      (click)="categoryForm.is_active = !categoryForm.is_active"
                      class="relative inline-flex h-6 w-11 rounded-full transition-colors"
                      [class]="categoryForm.is_active ? 'bg-brand-500' : 'bg-gray-200'">
                      <span [class]="categoryForm.is_active
                        ? 'translate-x-6 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'
                        : 'translate-x-0 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'"></span>
                    </button>
                    <span class="text-sm text-gray-700">{{ categoryForm.is_active ? 'Activa' : 'Inactiva' }}</span>
                  </div>
                </div>
                <div class="flex gap-3 pt-2">
                  <button type="button" class="btn-secondary flex-1"
                    (click)="showCategoryModal.set(false)">Cancelar</button>
                  <button type="submit" class="btn-primary flex-1" [disabled]="savingCategory()">
                    {{ savingCategory() ? 'Guardando...' : 'Guardar' }}
                  </button>
                </div>
              </form>
            </div>
          </div>
        }
      }

      <!-- SA-6.3 Auditoría del Sistema -->
      @if (activeTab() === 'auditoria') {
        <div>
          <div class="flex flex-wrap items-center gap-3 mb-4">
            <input type="text" class="input-field w-44 text-sm" [(ngModel)]="auditFilter.admin"
              placeholder="Filtrar por admin" />
            <input type="date" class="input-field w-40 text-sm" [(ngModel)]="auditFilter.dateFrom" />
            <span class="text-gray-400">—</span>
            <input type="date" class="input-field w-40 text-sm" [(ngModel)]="auditFilter.dateTo" />
            <input type="text" class="input-field w-44 text-sm" [(ngModel)]="auditFilter.action"
              placeholder="Filtrar por acción" />
            <button class="btn-primary text-sm" (click)="loadAuditLog()">Buscar</button>
            <button class="btn-secondary text-sm" (click)="exportAuditCsv()">⬇ Exportar CSV</button>
          </div>

          <div class="card overflow-hidden">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 text-sm">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Admin</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Acción</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tabla afectada</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Valor anterior</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Valor nuevo</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-100">
                  @if (loadingAudit()) {
                    @for (i of [1,2,3,4,5]; track i) {
                      <tr class="animate-pulse">
                        <td colspan="6" class="px-4 py-3">
                          <div class="h-4 bg-gray-200 rounded w-full"></div>
                        </td>
                      </tr>
                    }
                  } @else if (auditLogs().length === 0) {
                    <tr>
                      <td colspan="6" class="px-4 py-12 text-center text-gray-400">
                        Sin registros de auditoría para los filtros seleccionados
                      </td>
                    </tr>
                  } @else {
                    @for (log of auditLogs(); track log.id) {
                      <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                          {{ log.created_at | date:'dd/MM/yyyy HH:mm' }}
                        </td>
                        <td class="px-4 py-3 text-gray-700 text-xs">{{ log.admin_email ?? '—' }}</td>
                        <td class="px-4 py-3 font-medium text-gray-800 text-xs">{{ log.action }}</td>
                        <td class="px-4 py-3">
                          <span class="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                            {{ log.table_name ?? '—' }}
                          </span>
                        </td>
                        <td class="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">
                          {{ log.previous_value ?? '—' }}
                        </td>
                        <td class="px-4 py-3 text-gray-700 text-xs max-w-xs truncate">
                          {{ log.new_value ?? '—' }}
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }

      <!-- SA-6.4 Surcharge Preview -->
      @if (activeTab() === 'surcharge') {
        <div class="max-w-4xl">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <!-- Input panel -->
            <div class="card p-5 space-y-4">
              <h3 class="font-semibold text-gray-800">Parámetros de Tarifa</h3>
              <div>
                <label class="label">Tarifa base (RD$)</label>
                <input type="number" class="input-field" [(ngModel)]="surchargePreviewForm.baseFee"
                  min="0" step="5" />
              </div>
              <div>
                <label class="label">% Recargo Clima/Lluvia</label>
                <input type="number" class="input-field" [(ngModel)]="surchargePreviewForm.weatherPct"
                  min="0" max="200" step="1" />
              </div>
              <div>
                <label class="label">% Recargo Hora Pico</label>
                <input type="number" class="input-field" [(ngModel)]="surchargePreviewForm.peakPct"
                  min="0" max="200" step="1" />
              </div>
              <div>
                <label class="label">% Recargo Nocturno</label>
                <input type="number" class="input-field" [(ngModel)]="surchargePreviewForm.nightPct"
                  min="0" max="200" step="1" />
              </div>
              <div>
                <label class="label">% Recargo Feriado</label>
                <input type="number" class="input-field" [(ngModel)]="surchargePreviewForm.holidayPct"
                  min="0" max="200" step="1" />
              </div>
              <hr class="border-gray-100" />
              <h4 class="font-medium text-gray-700 text-sm">Simulación</h4>
              <div>
                <label class="label">Hora del día</label>
                <div class="flex gap-2 items-center">
                  <input type="number" class="input-field w-20" [(ngModel)]="surchargePreviewForm.hour"
                    min="0" max="23" step="1" />
                  <span class="text-gray-400">:</span>
                  <input type="number" class="input-field w-20" [(ngModel)]="surchargePreviewForm.minute"
                    min="0" max="59" step="5" />
                </div>
              </div>
              <div class="space-y-2">
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span class="text-sm text-gray-700">🌧 ¿Simular lluvia?</span>
                  <button type="button"
                    (click)="surchargePreviewForm.isRaining = !surchargePreviewForm.isRaining"
                    class="relative inline-flex h-6 w-11 rounded-full transition-colors"
                    [class]="surchargePreviewForm.isRaining ? 'bg-brand-500' : 'bg-gray-200'">
                    <span [class]="surchargePreviewForm.isRaining
                      ? 'translate-x-6 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'
                      : 'translate-x-0 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'"></span>
                  </button>
                </div>
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span class="text-sm text-gray-700">🎉 ¿Simular feriado?</span>
                  <button type="button"
                    (click)="surchargePreviewForm.isHoliday = !surchargePreviewForm.isHoliday"
                    class="relative inline-flex h-6 w-11 rounded-full transition-colors"
                    [class]="surchargePreviewForm.isHoliday ? 'bg-brand-500' : 'bg-gray-200'">
                    <span [class]="surchargePreviewForm.isHoliday
                      ? 'translate-x-6 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'
                      : 'translate-x-0 inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5'"></span>
                  </button>
                </div>
              </div>
              <button class="btn-primary w-full" (click)="saveSurchargeParams()" [disabled]="savingSurcharge()">
                {{ savingSurcharge() ? 'Guardando...' : '💾 Guardar estos parámetros' }}
              </button>
            </div>

            <!-- Live output -->
            <div class="card p-5 bg-gray-900 text-white">
              <h3 class="font-semibold text-gray-300 mb-4 text-sm uppercase tracking-wide">
                Resultado en tiempo real
              </h3>
              <div class="mb-4 text-gray-400 text-sm leading-relaxed">
                A las
                <span class="text-white font-mono font-bold">
                  {{ surchargePreviewForm.hour | number:'2.0-0' }}:{{ surchargePreviewForm.minute | number:'2.0-0' }}
                </span>
                @if (surchargePreviewForm.isRaining) {
                  <span class="text-blue-300"> con lluvia</span>
                }
                @if (surchargePreviewForm.isHoliday) {
                  <span class="text-yellow-300"> y feriado</span>
                }
                :
              </div>
              <div class="space-y-1.5 mb-5">
                <div class="flex justify-between items-center py-2 border-b border-gray-700">
                  <span class="text-gray-300">Base</span>
                  <span class="font-mono text-white">RD$ {{ surchargeCalc.base | number:'1.2-2' }}</span>
                </div>
                @for (item of surchargeCalc.breakdown; track item.label) {
                  <div class="flex justify-between items-center py-2 border-b border-gray-700">
                    <span class="text-gray-300">{{ item.label }}</span>
                    <span class="font-mono text-brand-400">+RD$ {{ item.amount | number:'1.2-2' }}</span>
                  </div>
                }
                @if (surchargeCalc.breakdown.length === 0) {
                  <div class="py-3 text-gray-500 text-sm text-center">Sin recargos adicionales</div>
                }
              </div>
              <div class="flex justify-between items-center bg-brand-600 rounded-xl px-4 py-3">
                <span class="font-bold text-white text-sm">TOTAL</span>
                <span class="font-bold text-white text-2xl font-mono">
                  RD$ {{ surchargeCalc.total | number:'1.2-2' }}
                </span>
              </div>
              <p class="text-xs text-gray-600 mt-3 text-center">
                Horas pico configuradas: {{ deliveryForm.peak_hours }}
              </p>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class SettingsPageComponent implements OnInit {
  private settingsService = inject(SettingsService);
  private toast = inject(ToastService);

  activeTab = signal<SettingsTab>('general');
  tabs = [
    { id: 'general' as SettingsTab, label: 'General' },
    { id: 'delivery' as SettingsTab, label: 'Delivery & Precios' },
    { id: 'feriados' as SettingsTab, label: 'Feriados' },
    { id: 'notificaciones' as SettingsTab, label: 'Notificaciones' },
    { id: 'usuarios' as SettingsTab, label: 'Usuarios Admin' },
    { id: 'comercios' as SettingsTab, label: 'Comercios & Aprobación' },
    { id: 'categorias' as SettingsTab, label: 'Categorías' },
    { id: 'auditoria' as SettingsTab, label: 'Auditoría' },
    { id: 'surcharge' as SettingsTab, label: 'Simulador de Tarifas' },
  ];

  loadingSettings = signal(true);
  savingGeneral = signal(false);
  savingDelivery = signal(false);

  generalForm = {
    min_order_amount: 0,
    default_delivery_fee: 0,
    default_commission_rate: 0,
    itbis_rate: 18,
    max_items_per_order: 20,
    max_orders_in_flight: 50,
    referral_bonus_amount: 200,
    order_auto_cancel_minutes: 30,
    free_delivery_threshold: 0,
  };

  deliveryForm = {
    weather_surcharge_enabled: false,
    weather_surcharge_rate: 10,
    surge_pricing_enabled: false,
    peak_surcharge_rate: 20,
    night_surcharge_rate: 15,
    peak_hours: '12:00-14:00,18:00-21:00',
  };

  notifForm = {
    push_enabled: true,
    whatsapp_enabled: false,
    new_order_alert: true,
    unassigned_alert: true,
    unassigned_alert_minutes: 10,
  };
  savingNotif = signal(false);

  loadingHolidays = signal(false);
  savingHoliday = signal(false);
  holidays = signal<Holiday[]>([]);
  showHolidayModal = signal(false);
  editingHoliday = signal<Holiday | null>(null);
  holidayForm: { name: string; date: string; surcharge: number } = { name: '', date: '', surcharge: 0 };

  loadingUsers = signal(false);
  adminUsers = signal<AdminUser[]>([]);
  showUserModal = signal(false);
  creatingUser = signal(false);
  createUserError = signal('');
  userForm = { full_name: '', email: '', password: '', role: 'restaurant_admin' };

  roleLabels: Record<string, string> = {
    super_admin: 'Superadmin',
    restaurant_admin: 'Admin Restaurante',
    excursion_operator: 'Admin Operadora',
    store_admin: 'Admin Tienda'
  };

  ngOnInit() {
    this.loadSettings();
    this.loadHolidays();
    this.loadUsers();
    this.loadCategories();
    this.loadAuditLog();
  }

  async loadSettings() {
    this.loadingSettings.set(true);
    try {
      const settings = await this.settingsService.getSettings();
      const map: Record<string, string> = {};
      settings.forEach(s => map[s.key] = s.value);
      this.generalForm.min_order_amount = Number(map['min_order_amount'] ?? 150);
      this.generalForm.default_delivery_fee = Number(map['default_delivery_fee'] ?? 75);
      this.generalForm.default_commission_rate = Number(map['default_commission_rate'] ?? 15);
      this.generalForm.itbis_rate = Number(map['itbis_rate'] ?? 18);
      this.generalForm.max_items_per_order = Number(map['max_items_per_order'] ?? 20);
      this.generalForm.max_orders_in_flight = Number(map['max_orders_in_flight'] ?? 50);
      this.generalForm.referral_bonus_amount = Number(map['referral_bonus_amount'] ?? 200);
      this.generalForm.order_auto_cancel_minutes = Number(map['order_auto_cancel_minutes'] ?? 30);
      this.generalForm.free_delivery_threshold = Number(map['free_delivery_threshold'] ?? 0);
      this.deliveryForm.weather_surcharge_enabled = map['weather_surcharge_enabled'] === 'true';
      this.deliveryForm.weather_surcharge_rate = Number(map['weather_surcharge_rate'] ?? 10);
      this.deliveryForm.surge_pricing_enabled = map['surge_pricing_enabled'] === 'true';
      this.deliveryForm.peak_surcharge_rate = Number(map['peak_surcharge_rate'] ?? 20);
      this.deliveryForm.night_surcharge_rate = Number(map['night_surcharge_rate'] ?? 15);
      this.deliveryForm.peak_hours = map['peak_hours'] ?? '12:00-14:00,18:00-21:00';
      this.notifForm.push_enabled = map['push_enabled'] !== 'false';
      this.notifForm.whatsapp_enabled = map['whatsapp_enabled'] === 'true';
      this.notifForm.new_order_alert = map['new_order_alert'] !== 'false';
      this.notifForm.unassigned_alert = map['unassigned_alert'] !== 'false';
      this.notifForm.unassigned_alert_minutes = Number(map['unassigned_alert_minutes'] ?? 10);
      // SA-6.1 comercios
      this.comerciosForm.store_auto_approve = map['store_auto_approve'] === 'true';
      this.comerciosForm.repartidor_auto_approve = map['repartidor_auto_approve'] === 'true';
      this.comerciosForm.store_onboarding_commission_days = Number(map['store_onboarding_commission_days'] ?? 30);
      this.comerciosForm.store_onboarding_commission_rate = Number(map['store_onboarding_commission_rate'] ?? 5);
      // SA-6.4 surcharge preview pre-populate from current settings
      this.surchargePreviewForm.baseFee = Number(map['default_delivery_fee'] ?? 150);
      this.surchargePreviewForm.weatherPct = Number(map['weather_surcharge_rate'] ?? 35);
      this.surchargePreviewForm.peakPct = Number(map['peak_surcharge_rate'] ?? 20);
      this.surchargePreviewForm.nightPct = Number(map['night_surcharge_rate'] ?? 15);
    } catch { } finally {
      this.loadingSettings.set(false);
    }
  }

  async saveGeneralSettings() {
    this.savingGeneral.set(true);
    const rows = Object.entries(this.generalForm).map(([key, value]) => ({ key, value: String(value) }));
    try {
      await this.settingsService.upsertSettings(rows);
      this.toast.success('Configuración general guardada');
    } catch { this.toast.error('Error al guardar'); }
    finally { this.savingGeneral.set(false); }
  }

  async saveDeliverySettings() {
    this.savingDelivery.set(true);
    const rows = Object.entries(this.deliveryForm).map(([key, value]) => ({ key, value: String(value) }));
    try {
      await this.settingsService.upsertSettings(rows);
      this.toast.success('Configuración de delivery guardada');
    } catch { this.toast.error('Error al guardar'); }
    finally { this.savingDelivery.set(false); }
  }

  async saveNotifSettings() {
    this.savingNotif.set(true);
    const rows = Object.entries(this.notifForm).map(([key, value]) => ({ key, value: String(value) }));
    try {
      await this.settingsService.upsertSettings(rows);
      this.toast.success('Configuración de notificaciones guardada');
    } catch { this.toast.error('Error al guardar'); }
    finally { this.savingNotif.set(false); }
  }

  async loadHolidays() {
    this.loadingHolidays.set(true);
    try {
      this.holidays.set(await this.settingsService.getHolidays());
    } catch { } finally { this.loadingHolidays.set(false); }
  }

  openHolidayForm(h?: Holiday) {
    this.editingHoliday.set(h ?? null);
    this.holidayForm = h ? { name: h.name, date: h.date, surcharge: h.surcharge ?? 0 } : { name: '', date: '', surcharge: 0 };
    this.showHolidayModal.set(true);
  }

  async saveHoliday() {
    this.savingHoliday.set(true);
    const payload = { ...this.holidayForm, id: this.editingHoliday()?.id };
    try {
      await this.settingsService.saveHoliday(payload);
      this.toast.success('Feriado guardado');
      this.showHolidayModal.set(false);
      this.loadHolidays();
    } catch { this.toast.error('Error al guardar feriado'); }
    finally { this.savingHoliday.set(false); }
  }

  async deleteHoliday(id: string) {
    try {
      await this.settingsService.deleteHoliday(id);
      this.toast.success('Feriado eliminado');
      this.loadHolidays();
    } catch { this.toast.error('Error al eliminar'); }
  }

  async loadUsers() {
    this.loadingUsers.set(true);
    try {
      this.adminUsers.set(await this.settingsService.getAdminUsers());
    } catch { } finally { this.loadingUsers.set(false); }
  }

  openUserForm() {
    this.userForm = { full_name: '', email: '', password: '', role: 'restaurant_admin' };
    this.createUserError.set('');
    this.showUserModal.set(true);
  }

  async createUser() {
    this.creatingUser.set(true);
    this.createUserError.set('');
    try {
      await this.settingsService.createAdminUser(this.userForm);
      this.toast.success('Usuario creado exitosamente');
      this.showUserModal.set(false);
      this.loadUsers();
    } catch (err: unknown) {
      this.createUserError.set((err as Error)?.message ?? 'Error al crear usuario');
    } finally { this.creatingUser.set(false); }
  }

  async toggleUser(u: AdminUser) {
    try {
      await this.settingsService.toggleAdminUser(u.id, !u.is_active);
      this.toast.success(`Usuario ${!u.is_active ? 'activado' : 'desactivado'}`);
      this.loadUsers();
    } catch { this.toast.error('Error al actualizar usuario'); }
  }

  // ── SA-6 properties ────────────────────────────────────────────────────

  readonly commerceTypes: { value: CommerceType; label: string }[] = [
    { value: 'restaurante', label: 'Restaurante' },
    { value: 'farmacia', label: 'Farmacia' },
    { value: 'bodega', label: 'Bodega' },
    { value: 'colmado', label: 'Colmado' },
    { value: 'tienda_ropa', label: 'Tienda de Ropa' },
    { value: 'supermercado', label: 'Supermercado' },
    { value: 'electronica', label: 'Electrónica' },
    { value: 'otro', label: 'Otro' },
  ];

  // SA-6.1
  comerciosForm = {
    store_auto_approve: false,
    repartidor_auto_approve: false,
    store_onboarding_commission_days: 30,
    store_onboarding_commission_rate: 5,
  };
  savingComercios = signal(false);
  showAutoApproveConfirm = signal(false);
  approvingAll = signal(false);

  // SA-6.2
  categories = signal<StoreCategory[]>([]);
  loadingCategories = signal(false);
  savingCategory = signal(false);
  deletingCategoryId = signal<string | null>(null);
  showCategoryModal = signal(false);
  editingCategory = signal<StoreCategory | null>(null);
  categoryTypeFilter: CommerceType | 'all' = 'all';
  categoryForm: { name: string; slug: string; commerce_type: CommerceType; icon: string; display_order: number; is_active: boolean } = {
    name: '', slug: '', commerce_type: 'restaurante', icon: '🍽', display_order: 0, is_active: true,
  };
  draggedIndex = signal<number | null>(null);

  // SA-6.3
  auditLogs = signal<AuditLogEntry[]>([]);
  loadingAudit = signal(false);
  auditFilter = { admin: '', dateFrom: '', dateTo: '', action: '' };

  // SA-6.4
  surchargePreviewForm = {
    baseFee: 150, weatherPct: 35, peakPct: 20, nightPct: 15, holidayPct: 15,
    hour: 19, minute: 30, isRaining: false, isHoliday: false,
  };
  savingSurcharge = signal(false);

  // ── SA-6.1 methods ────────────────────────────────────────────────────

  onStoreAutoApproveToggle() {
    if (!this.comerciosForm.store_auto_approve) {
      this.showAutoApproveConfirm.set(true);
    } else {
      this.comerciosForm.store_auto_approve = false;
    }
  }

  async confirmAutoApprove() {
    this.approvingAll.set(true);
    this.comerciosForm.store_auto_approve = true;
    this.showAutoApproveConfirm.set(false);
    try {
      await this.settingsService.approveAllPendingStores();
      this.toast.success('Todos los comercios pendientes han sido aprobados');
      this.saveComercios();
    } catch { this.toast.error('Error al aprobar comercios pendientes'); }
    finally { this.approvingAll.set(false); }
  }

  async saveComercios() {
    this.savingComercios.set(true);
    const rows = Object.entries(this.comerciosForm).map(([key, value]) => ({ key, value: String(value) }));
    try {
      await this.settingsService.upsertSettings(rows);
      this.toast.success('Configuración de comercios guardada');
    } catch { this.toast.error('Error al guardar'); }
    finally { this.savingComercios.set(false); }
  }

  // ── SA-6.2 methods ────────────────────────────────────────────────────

  async loadCategories() {
    this.loadingCategories.set(true);
    const filter = this.categoryTypeFilter === 'all' ? undefined : this.categoryTypeFilter as CommerceType;
    try {
      this.categories.set(await this.settingsService.getStoreCategories(filter));
    } catch { } finally { this.loadingCategories.set(false); }
  }

  openCategoryForm(cat?: StoreCategory) {
    this.editingCategory.set(cat ?? null);
    this.categoryForm = cat
      ? { name: cat.name, slug: cat.slug, commerce_type: cat.commerce_type, icon: cat.icon ?? '', display_order: cat.display_order, is_active: cat.is_active }
      : { name: '', slug: '', commerce_type: 'restaurante', icon: '🍽', display_order: this.categories().length, is_active: true };
    this.showCategoryModal.set(true);
  }

  async saveCategory() {
    this.savingCategory.set(true);
    const payload = { ...this.categoryForm, id: this.editingCategory()?.id };
    try {
      await this.settingsService.saveStoreCategory(payload);
      this.toast.success('Categoría guardada');
      this.showCategoryModal.set(false);
      this.loadCategories();
    } catch { this.toast.error('Error al guardar categoría'); }
    finally { this.savingCategory.set(false); }
  }

  async deleteCategory(id: string) {
    this.deletingCategoryId.set(id);
    try {
      await this.settingsService.deleteStoreCategory(id);
      this.toast.success('Categoría eliminada');
      this.loadCategories();
    } catch { this.toast.error('Error al eliminar'); }
    finally { this.deletingCategoryId.set(null); }
  }

  generateSlug(name: string) {
    this.categoryForm.slug = name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  commerceTypeLabel(type: CommerceType): string {
    return this.commerceTypes.find(ct => ct.value === type)?.label ?? type;
  }

  onCategoryDragStart(index: number) {
    this.draggedIndex.set(index);
  }

  onCategoryDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onCategoryDrop(targetIndex: number) {
    const from = this.draggedIndex();
    if (from === null || from === targetIndex) { this.draggedIndex.set(null); return; }
    const cats = [...this.categories()];
    const [moved] = cats.splice(from, 1);
    cats.splice(targetIndex, 0, moved);
    const updated = cats.map((c, i) => ({ ...c, display_order: i }));
    this.categories.set(updated);
    this.draggedIndex.set(null);
    this.settingsService.reorderCategories(updated.map((c, i) => ({ id: c.id, order: i })))
      .catch(() => this.toast.error('Error al reordenar categorías'));
  }

  // ── SA-6.3 methods ────────────────────────────────────────────────────

  async loadAuditLog() {
    this.loadingAudit.set(true);
    try {
      this.auditLogs.set(await this.settingsService.getAuditLog(this.auditFilter));
    } catch { } finally { this.loadingAudit.set(false); }
  }

  exportAuditCsv() {
    const logs = this.auditLogs();
    if (!logs.length) { this.toast.error('Sin datos para exportar'); return; }
    const headers = ['Fecha', 'Admin', 'Acción', 'Tabla', 'Valor anterior', 'Valor nuevo'];
    const rows = logs.map(l => [
      `"${l.created_at}"`,
      `"${l.admin_email ?? '—'}"`,
      `"${l.action}"`,
      `"${l.table_name ?? '—'}"`,
      `"${l.previous_value ?? '—'}"`,
      `"${l.new_value ?? '—'}"`,
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── SA-6.4 methods ────────────────────────────────────────────────────

  get surchargeCalc(): { base: number; breakdown: { label: string; amount: number }[]; total: number } {
    const f = this.surchargePreviewForm;
    const base = f.baseFee;
    let total = base;
    const breakdown: { label: string; amount: number }[] = [];

    const isPeak = this.checkPeakHours(f.hour, f.minute);
    if (isPeak) {
      const amount = Math.round(base * f.peakPct / 100 * 100) / 100;
      breakdown.push({ label: `Hora Pico (${f.peakPct}%)`, amount });
      total += amount;
    }
    const isNight = f.hour >= 22 || f.hour < 6;
    if (isNight) {
      const amount = Math.round(base * f.nightPct / 100 * 100) / 100;
      breakdown.push({ label: `Nocturno (${f.nightPct}%)`, amount });
      total += amount;
    }
    if (f.isRaining) {
      const amount = Math.round(base * f.weatherPct / 100 * 100) / 100;
      breakdown.push({ label: `Clima/Lluvia (${f.weatherPct}%)`, amount });
      total += amount;
    }
    if (f.isHoliday) {
      const amount = Math.round(base * f.holidayPct / 100 * 100) / 100;
      breakdown.push({ label: `Feriado (${f.holidayPct}%)`, amount });
      total += amount;
    }
    return { base, breakdown, total: Math.round(total * 100) / 100 };
  }

  private checkPeakHours(hour: number, minute: number): boolean {
    const time = hour * 60 + minute;
    for (const range of (this.deliveryForm.peak_hours ?? '').split(',')) {
      const parts = range.trim().split('-');
      if (parts.length !== 2) continue;
      const [sh, sm] = parts[0].split(':').map(Number);
      const [eh, em] = parts[1].split(':').map(Number);
      if (time >= (sh * 60 + (sm || 0)) && time <= (eh * 60 + (em || 0))) return true;
    }
    return false;
  }

  async saveSurchargeParams() {
    this.savingSurcharge.set(true);
    const f = this.surchargePreviewForm;
    const rows = [
      { key: 'default_delivery_fee', value: String(f.baseFee) },
      { key: 'weather_surcharge_rate', value: String(f.weatherPct) },
      { key: 'peak_surcharge_rate', value: String(f.peakPct) },
      { key: 'night_surcharge_rate', value: String(f.nightPct) },
    ];
    try {
      await this.settingsService.upsertSettings(rows);
      // sync delivery form too
      this.deliveryForm.weather_surcharge_rate = f.weatherPct;
      this.deliveryForm.peak_surcharge_rate = f.peakPct;
      this.deliveryForm.night_surcharge_rate = f.nightPct;
      this.toast.success('Parámetros de tarifa guardados');
    } catch { this.toast.error('Error al guardar'); }
    finally { this.savingSurcharge.set(false); }
  }
}
