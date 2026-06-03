import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SettingsService, AdminUser } from './settings.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { AppSetting, Holiday } from '../../core/supabase/database.types';

type SettingsTab = 'general' | 'delivery' | 'notificaciones' | 'feriados' | 'usuarios';

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
  }

  loadSettings() {
    this.loadingSettings.set(true);
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
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
        this.loadingSettings.set(false);
      },
      error: () => this.loadingSettings.set(false)
    });
  }

  saveGeneralSettings() {
    this.savingGeneral.set(true);
    const rows = Object.entries(this.generalForm).map(([key, value]) => ({ key, value: String(value) }));
    this.settingsService.upsertSettings(rows).subscribe({
      next: () => { this.toast.success('Configuración general guardada'); this.savingGeneral.set(false); },
      error: () => { this.toast.error('Error al guardar'); this.savingGeneral.set(false); }
    });
  }

  saveDeliverySettings() {
    this.savingDelivery.set(true);
    const rows = Object.entries(this.deliveryForm).map(([key, value]) => ({ key, value: String(value) }));
    this.settingsService.upsertSettings(rows).subscribe({
      next: () => { this.toast.success('Configuración de delivery guardada'); this.savingDelivery.set(false); },
      error: () => { this.toast.error('Error al guardar'); this.savingDelivery.set(false); }
    });
  }

  saveNotifSettings() {
    this.savingNotif.set(true);
    const rows = Object.entries(this.notifForm).map(([key, value]) => ({ key, value: String(value) }));
    this.settingsService.upsertSettings(rows).subscribe({
      next: () => { this.toast.success('Configuración de notificaciones guardada'); this.savingNotif.set(false); },
      error: () => { this.toast.error('Error al guardar'); this.savingNotif.set(false); }
    });
  }

  loadHolidays() {
    this.loadingHolidays.set(true);
    this.settingsService.getHolidays().subscribe({
      next: (h) => { this.holidays.set(h); this.loadingHolidays.set(false); },
      error: () => this.loadingHolidays.set(false)
    });
  }

  openHolidayForm(h?: Holiday) {
    this.editingHoliday.set(h ?? null);
    this.holidayForm = h ? { name: h.name, date: h.date, surcharge: h.surcharge ?? 0 } : { name: '', date: '', surcharge: 0 };
    this.showHolidayModal.set(true);
  }

  saveHoliday() {
    this.savingHoliday.set(true);
    const payload = { ...this.holidayForm, id: this.editingHoliday()?.id };
    this.settingsService.saveHoliday(payload).subscribe({
      next: () => {
        this.toast.success('Feriado guardado');
        this.showHolidayModal.set(false);
        this.savingHoliday.set(false);
        this.loadHolidays();
      },
      error: () => { this.toast.error('Error al guardar feriado'); this.savingHoliday.set(false); }
    });
  }

  deleteHoliday(id: string) {
    this.settingsService.deleteHoliday(id).subscribe({
      next: () => { this.toast.success('Feriado eliminado'); this.loadHolidays(); },
      error: () => this.toast.error('Error al eliminar')
    });
  }

  loadUsers() {
    this.loadingUsers.set(true);
    this.settingsService.getAdminUsers().subscribe({
      next: (u) => { this.adminUsers.set(u); this.loadingUsers.set(false); },
      error: () => this.loadingUsers.set(false)
    });
  }

  openUserForm() {
    this.userForm = { full_name: '', email: '', password: '', role: 'restaurant_admin' };
    this.createUserError.set('');
    this.showUserModal.set(true);
  }

  createUser() {
    this.creatingUser.set(true);
    this.createUserError.set('');
    this.settingsService.createAdminUser(this.userForm).subscribe({
      next: () => {
        this.toast.success('Usuario creado exitosamente');
        this.showUserModal.set(false);
        this.creatingUser.set(false);
        this.loadUsers();
      },
      error: (err) => {
        this.createUserError.set(err?.message ?? 'Error al crear usuario');
        this.creatingUser.set(false);
      }
    });
  }

  toggleUser(u: AdminUser) {
    this.settingsService.toggleAdminUser(u.id, !u.is_active).subscribe({
      next: () => { this.toast.success(`Usuario ${!u.is_active ? 'activado' : 'desactivado'}`); this.loadUsers(); },
      error: () => this.toast.error('Error al actualizar usuario')
    });
  }
}
