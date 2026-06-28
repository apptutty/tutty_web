import {
    Component,
    OnInit,
    signal,
    computed,
    inject,
    effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreAdminService } from '../store-admin.service';
import { StoreSettingsService, TeamMember, StoreNotifPrefs } from './store-settings.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../../shared/ui/modal/confirm.service';
import { Restaurant, CommerceCategory, Payout } from '../../../core/supabase/database.types';
import { TuttyMapComponent, LatLng } from '../../../shared/ui/map/tutty-map.component';
import { AdminGeoService, PlaceSuggestion } from '../../../core/services/admin-geo.service';
import { AdminImageFieldComponent } from '../../../shared/ui/image-field/admin-image-field.component';
import { CommerceCategoryPickerComponent } from '../../../shared/ui/category-picker/commerce-category-picker.component';
import { SettingsService } from '../../settings/settings.service';

type Tab = 'perfil' | 'horarios' | 'delivery' | 'notificaciones' | 'equipo' | 'finanzas';

const DAYS_LIST = [
    { key: 'lunes', label: 'Lun' }, { key: 'martes', label: 'Mar' },
    { key: 'miercoles', label: 'Mié' }, { key: 'jueves', label: 'Jue' },
    { key: 'viernes', label: 'Vie' }, { key: 'sabado', label: 'Sáb' },
    { key: 'domingo', label: 'Dom' },
];

interface ProfileForm {
    name: string; description: string; whatsapp_number: string;
    address: string; sector: string; city: string; category_id: string | null;
    logo_url: string | null; banner_url: string | null;
    lat: number | null; lng: number | null;
}

interface ScheduleForm {
    open_days: string[]; opening_time: string; closing_time: string;
    special_hours: boolean; avg_service_time: number;
    per_day: Record<string, { opening_time: string; closing_time: string }>;
}

interface DeliveryForm {
    min_order_amount: number; free_delivery_enabled: boolean;
    free_delivery_threshold: number; express_delivery: boolean; express_fee: number;
}

@Component({
    selector: 'app-store-settings',
    standalone: true,
    imports: [CommonModule, FormsModule, TuttyMapComponent, AdminImageFieldComponent, CommerceCategoryPickerComponent],
    styles: [`
    .settings-page {
      min-height: 100dvh;
      background: linear-gradient(180deg, #f8f7fb 0%, #f4f6fb 100%);
    }
    .settings-head {
      position: sticky;
      top: 0;
      z-index: 15;
      border-bottom: 1px solid #e7eaf2;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(10px);
    }
    .settings-head-inner {
      max-width: 1180px;
      margin: 0 auto;
      padding: 18px 22px 12px;
    }
    .settings-title {
      font-size: 26px;
      line-height: 1.1;
      font-weight: 900;
      letter-spacing: -0.02em;
      color: #0f172a;
      margin: 0;
    }
    .settings-subtitle {
      margin-top: 4px;
      color: #64748b;
      font-size: 13px;
      font-weight: 600;
    }
    .settings-tabs {
      margin-top: 14px;
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 2px;
    }
    .tab-btn {
      border: 1px solid #e2e8f0;
      background: #fff;
      color: #475569;
      border-radius: 12px;
      padding: 9px 14px;
      font-size: 12px;
      line-height: 1;
      font-weight: 800;
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.18s;
    }
    .tab-btn:hover:not(.active) {
      border-color: #cbd5e1;
      color: #334155;
      transform: translateY(-1px);
    }
    .tab-btn.active {
      background: linear-gradient(135deg, #ff3c97 0%, #d01f78 100%);
      border-color: transparent;
      color: #fff;
      box-shadow: 0 8px 22px rgba(233, 30, 140, 0.28);
    }
    .settings-content {
      max-width: 1180px;
      margin: 0 auto;
      padding: 22px;
    }
    .card {
      border: 1px solid #e7eaf2;
      border-radius: 18px;
      background: #fff;
      box-shadow: 0 8px 30px rgba(15, 23, 42, 0.05);
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: #64748b;
      margin-bottom: 12px;
    }
    .day-btn { width: 38px; height: 38px; border-radius: 50%; border: 2px solid #e5e7eb; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.15s; }
    .day-btn.on { background: #e91e8c; border-color: #e91e8c; color: white; }
    .day-btn:not(.on):hover { border-color: #e91e8c; color: #e91e8c; }
    .toggle-track { position: relative; display: inline-flex; width: 44px; height: 24px; border-radius: 12px; background: #d1d5db; cursor: pointer; transition: background .3s; }
    .toggle-track.on { background: #e91e8c; }
    .toggle-thumb { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: white; transition: transform .3s; }
    .toggle-track.on .toggle-thumb { transform: translateX(20px); }
    @media (max-width: 768px) {
      .settings-head-inner,
      .settings-content {
        padding-left: 14px;
        padding-right: 14px;
      }
      .settings-title {
        font-size: 21px;
      }
      .settings-subtitle {
        font-size: 12px;
      }
    }
  `],
    template: `
  <div class="settings-page">

    <!-- Header + Tabs -->
    <div class="settings-head">
      <div class="settings-head-inner">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="settings-title">Configuración del comercio</h1>
            <p class="settings-subtitle">Ajusta perfil, operación, notificaciones, equipo y finanzas.</p>
          </div>
        @if (isSaving()) {
          <div class="flex items-center gap-2 text-sm text-gray-500">
            <div class="w-4 h-4 border-2 border-pink-300 border-t-pink-600 rounded-full animate-spin"></div>
            Guardando...
          </div>
        }
        </div>
      <div class="settings-tabs" role="tablist" aria-label="Secciones de configuración">
        @for (t of tabs; track t.key) {
          <button class="tab-btn" [class.active]="activeTab() === t.key"
            (click)="setTab(t.key)">{{ t.label }}</button>
        }
      </div>
      </div>
    </div>

    <div class="settings-content space-y-6">

      <!-- ═══ TAB: PERFIL ═══════════════════════════════════════ -->
      @if (activeTab() === 'perfil') {

        <!-- Images -->
        <div class="card p-5 space-y-4">
          <p class="section-title">Imágenes</p>
          <div class="flex gap-4 flex-wrap">
            <!-- Logo -->
            <div class="w-32">
              <app-admin-image-field
                label="Logo (1:1)"
                aspect="1/1"
                [maxMb]="3"
                [currentUrl]="profileForm.logo_url"
                [uploading]="uploadingLogo()"
                (fileSelected)="onLogoSelected($event)"
                (removed)="onLogoRemoved()">
              </app-admin-image-field>
            </div>
            <!-- Banner -->
            <div class="flex-1 min-w-48">
              <app-admin-image-field
                label="Banner (16:9)"
                aspect="16/9"
                [maxMb]="8"
                [currentUrl]="profileForm.banner_url"
                [uploading]="uploadingBanner()"
                (fileSelected)="onBannerSelected($event)"
                (removed)="onBannerRemoved()">
              </app-admin-image-field>
            </div>
          </div>
        </div>

        <!-- Basic info -->
        <div class="card p-5 space-y-4">
          <p class="section-title">Información básica</p>
          <div class="grid grid-cols-2 gap-3">
            <div class="col-span-2">
              <label class="label">Nombre del comercio *</label>
              <input [(ngModel)]="profileForm.name" class="input-field w-full" placeholder="Nombre" />
            </div>
            <div class="col-span-2">
              <label class="label">Descripción</label>
              <textarea [(ngModel)]="profileForm.description" rows="3"
                class="input-field w-full resize-none" placeholder="Cuéntale a tus clientes sobre tu negocio..."></textarea>
            </div>
            <div>
              <label class="label">WhatsApp de contacto</label>
              <input [(ngModel)]="profileForm.whatsapp_number" class="input-field w-full" placeholder="+1809XXXXXXX" />
            </div>
            <div>
              <label class="label">Categoría del comercio</label>
              <app-commerce-category-picker
                label="Categoría del comercio"
                placeholder="Seleccionar categoría..."
                [categories]="storeCategories()"
                [selectedId]="profileForm.category_id"
                [allowClear]="true"
                (categorySelected)="profileForm.category_id = $event?.id ?? null">
              </app-commerce-category-picker>
            </div>
          </div>
        </div>

        <!-- Location -->
        <div class="card p-5 space-y-4">
          <p class="section-title">Ubicación</p>

          @if (!profileForm.lat || !profileForm.lng) {
            <div class="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm text-amber-800">
              <span>⚠️</span>
              <span>Sin coordenadas. El delivery no estará disponible hasta que guardes una ubicación en el mapa.</span>
            </div>
          } @else {
            <div class="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
              <span>📍</span>
              <span>{{ profileForm.lat | number:'1.5-6' }}, {{ profileForm.lng | number:'1.5-6' }}</span>
            </div>
          }

          <!-- Address autocomplete search -->
          <div class="relative">
            <label class="label">Buscar dirección</label>
            <input
              type="text"
              [ngModel]="addressSearch()"
              (ngModelChange)="onAddressSearchChange($event)"
              class="input-field w-full"
              placeholder="Buscar en mapa…"
              autocomplete="off"
            />
            @if (addressSuggestions().length > 0) {
              <div class="absolute z-20 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto">
                @for (s of addressSuggestions(); track s.place_id) {
                  <button type="button"
                    class="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
                    (click)="selectSuggestion(s)">
                    <p class="font-medium text-gray-800 truncate">{{ s.main_text }}</p>
                    <p class="text-xs text-gray-400 truncate">{{ s.secondary_text }}</p>
                  </button>
                }
                <button type="button"
                  class="w-full px-4 py-2 text-xs text-gray-400 hover:bg-gray-50 text-right transition-colors"
                  (click)="clearSuggestions()">Cerrar ✕</button>
              </div>
            }
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="col-span-2">
              <label class="label">Dirección</label>
              <input [(ngModel)]="profileForm.address" class="input-field w-full" placeholder="Calle, número, local..." />
            </div>
            <div>
              <label class="label">Sector</label>
              <input [(ngModel)]="profileForm.sector" class="input-field w-full" placeholder="Ej. Piantini" />
            </div>
            <div>
              <label class="label">Ciudad</label>
              <input [(ngModel)]="profileForm.city" class="input-field w-full" placeholder="Ej. Santo Domingo" />
            </div>
          </div>

          <!-- Map picker -->
          <div>
            <label class="label">Ubicación en mapa</label>
            <p class="text-xs text-gray-400 mb-2">Haz clic en el mapa para ajustar la ubicación exacta del comercio</p>
            @if (isReverseGeocoding()) {
              <div class="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <div class="w-3 h-3 border-2 border-pink-300 border-t-pink-600 rounded-full animate-spin"></div>
                Obteniendo dirección…
              </div>
            }
            <app-tutty-map
              mode="picker"
              [lat]="profileForm.lat"
              [lng]="profileForm.lng"
              height="300px"
              (locationChange)="onMapPick($event)"
            />
          </div>
        </div>

        <!-- Slug (read-only) -->
        <div class="card p-5">
          <p class="section-title">Identificador (slug)</p>
          <div class="flex items-center gap-3">
            <span class="text-gray-500 text-sm">tutty.do/</span>
            <code class="bg-gray-100 px-3 py-1.5 rounded-lg text-sm text-gray-700">{{ store()?.slug }}</code>
            <span class="text-xs text-gray-400 italic">Solo superadmin puede modificarlo</span>
          </div>
        </div>

        <div class="flex justify-end">
          <button (click)="saveProfile()" [disabled]="isSaving()"
            class="btn-primary px-6 py-2 disabled:opacity-50">Guardar perfil</button>
        </div>
      }

      <!-- ═══ TAB: HORARIOS ═══════════════════════════════════════ -->
      @if (activeTab() === 'horarios') {
        <div class="card p-5 space-y-5">
          <p class="section-title">Días de apertura</p>
          <div class="flex gap-2 flex-wrap">
            @for (day of days; track day.key) {
              <button type="button" class="day-btn"
                [class.on]="scheduleForm.open_days.includes(day.key)"
                (click)="toggleDay(day.key)">{{ day.label }}</button>
            }
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label">Hora de apertura</label>
              <input type="time" [(ngModel)]="scheduleForm.opening_time" class="input-field w-full" />
            </div>
            <div>
              <label class="label">Hora de cierre</label>
              <input type="time" [(ngModel)]="scheduleForm.closing_time" class="input-field w-full" />
            </div>
          </div>

          <!-- Preview -->
          @if (scheduleForm.open_days.length > 0) {
            <div class="bg-blue-50 rounded-xl p-3 text-sm text-blue-800">
              📅 {{ schedulePreview() }}
            </div>
          }

          <!-- Avg service time -->
          <div>
            <label class="label">Tiempo promedio de preparación/servicio: <strong>{{ scheduleForm.avg_service_time }} min</strong></label>
            <input type="range" [(ngModel)]="scheduleForm.avg_service_time" min="5" max="120" step="5"
              class="w-full accent-pink-600" />
            <div class="flex justify-between text-xs text-gray-400"><span>5 min</span><span>120 min</span></div>
          </div>

          <!-- Special hours per day -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm font-medium text-gray-700">¿Horarios especiales por día?</span>
              <div class="toggle-track" [class.on]="scheduleForm.special_hours"
                (click)="scheduleForm.special_hours = !scheduleForm.special_hours">
                <div class="toggle-thumb"></div>
              </div>
            </div>
            @if (scheduleForm.special_hours) {
              <div class="space-y-2 pl-2">
                @for (day of openDaysList(); track day.key) {
                  <div class="flex items-center gap-3 py-2 border-b border-gray-100">
                    <span class="text-sm text-gray-600 w-10 font-medium">{{ day.label }}</span>
                    <div class="grid grid-cols-2 gap-2 flex-1">
                      <input type="time" [(ngModel)]="scheduleForm.per_day[day.key].opening_time"
                        class="input-field py-1 text-sm" />
                      <input type="time" [(ngModel)]="scheduleForm.per_day[day.key].closing_time"
                        class="input-field py-1 text-sm" />
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>
        <div class="flex justify-end">
          <button (click)="saveSchedule()" [disabled]="isSaving()"
            class="btn-primary px-6 py-2 disabled:opacity-50">Guardar horarios</button>
        </div>
      }

      <!-- ═══ TAB: DELIVERY ═══════════════════════════════════════ -->
      @if (activeTab() === 'delivery') {
        @if (!profileForm.lat || !profileForm.lng) {
          <div class="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <span class="text-lg">⚠️</span>
            <div>
              <p class="font-medium">Comercio sin ubicación configurada</p>
              <p class="text-xs mt-0.5">Configura la ubicación en la pestaña <strong>Perfil → Ubicación en mapa</strong> para activar el cálculo de delivery.</p>
            </div>
            <button class="ml-auto btn-secondary text-xs py-1" (click)="activeTab.set('perfil')">Ir a ubicación</button>
          </div>
        }
        <div class="card p-5 space-y-5">
          <p class="section-title">Condiciones de pedido</p>

          <div>
            <label class="label">Monto mínimo de pedido (RD\$)</label>
            <div class="relative max-w-xs">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">RD\$</span>
              <input type="number" [(ngModel)]="deliveryForm.min_order_amount"
                min="0" step="50" class="input-field w-full pl-12" />
            </div>
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-700">¿Delivery gratis por monto?</p>
                <p class="text-xs text-gray-400">Al superar el umbral, el delivery es gratis para el cliente</p>
              </div>
              <div class="toggle-track" [class.on]="deliveryForm.free_delivery_enabled"
                (click)="deliveryForm.free_delivery_enabled = !deliveryForm.free_delivery_enabled">
                <div class="toggle-thumb"></div>
              </div>
            </div>
            @if (deliveryForm.free_delivery_enabled) {
              <div class="pl-4">
                <label class="label">Umbral para delivery gratis (RD\$)</label>
                <div class="relative max-w-xs">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">RD\$</span>
                  <input type="number" [(ngModel)]="deliveryForm.free_delivery_threshold"
                    min="0" step="100" class="input-field w-full pl-12" />
                </div>
              </div>
            }
          </div>

          <div class="bg-amber-50 text-amber-800 text-sm rounded-xl p-3">
            💡 El cargo de delivery lo controla Tutty según tus zonas de cobertura configuradas.
          </div>

          <!-- Express: farmacia only -->
          @if (commerceType() === 'farmacia') {
            <div class="border-t border-gray-100 pt-4 space-y-3">
              <p class="section-title">Farmacia — Entregas express</p>
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-700">¿Acepta entregas express (&lt;20 min)?</p>
                </div>
                <div class="toggle-track" [class.on]="deliveryForm.express_delivery"
                  (click)="deliveryForm.express_delivery = !deliveryForm.express_delivery">
                  <div class="toggle-thumb"></div>
                </div>
              </div>
              @if (deliveryForm.express_delivery) {
                <div class="pl-4">
                  <label class="label">Cargo adicional por express (RD\$)</label>
                  <div class="relative max-w-xs">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">RD\$</span>
                    <input type="number" [(ngModel)]="deliveryForm.express_fee"
                      min="0" step="50" class="input-field w-full pl-12" />
                  </div>
                </div>
              }
            </div>
          }
        </div>
        <div class="flex justify-end">
          <button (click)="saveDelivery()" [disabled]="isSaving()"
            class="btn-primary px-6 py-2 disabled:opacity-50">Guardar delivery</button>
        </div>
      }

      <!-- ═══ TAB: NOTIFICACIONES ══════════════════════════════════ -->
      @if (activeTab() === 'notificaciones') {
        <div class="card p-5 space-y-5">
          <p class="section-title">Preferencias de notificación</p>

          <div class="flex items-center justify-between py-2">
            <div>
              <p class="text-sm font-medium text-gray-700">Sonido para nuevos pedidos</p>
              <p class="text-xs text-gray-400">Reproduce un beep cuando entra un nuevo pedido</p>
            </div>
            <div class="toggle-track" [class.on]="notifPrefs().soundEnabled"
              (click)="toggleNotif('soundEnabled')">
              <div class="toggle-thumb"></div>
            </div>
          </div>

          <div class="border-t border-gray-100 pt-4 space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-700">Notificaciones WhatsApp</p>
                <p class="text-xs text-gray-400">Recibe un mensaje cuando llegue un nuevo pedido</p>
              </div>
              <div class="toggle-track" [class.on]="notifPrefs().whatsappEnabled"
                (click)="toggleNotif('whatsappEnabled')">
                <div class="toggle-thumb"></div>
              </div>
            </div>
            @if (notifPrefs().whatsappEnabled) {
              <div class="pl-4">
                <label class="label">Número de WhatsApp para notificaciones</label>
                <input [ngModel]="notifPrefs().whatsappNumber"
                  (ngModelChange)="updateNotif('whatsappNumber', $event)"
                  class="input-field w-full max-w-xs" placeholder="+1809XXXXXXX" />
              </div>
            }
          </div>

          <div class="border-t border-gray-100 pt-4 space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-700">Alertas de stock bajo</p>
                <p class="text-xs text-gray-400">Notifica cuando un producto llega al umbral mínimo</p>
              </div>
              <div class="toggle-track" [class.on]="notifPrefs().lowStockEnabled"
                (click)="toggleNotif('lowStockEnabled')">
                <div class="toggle-thumb"></div>
              </div>
            </div>
            @if (notifPrefs().lowStockEnabled) {
              <div class="pl-4">
                <label class="label">Umbral de alerta (unidades)</label>
                <input type="number" [ngModel]="notifPrefs().lowStockThreshold"
                  (ngModelChange)="updateNotif('lowStockThreshold', +$event)"
                  min="1" class="input-field w-full max-w-xs" />
              </div>
            }
          </div>
        </div>
        <!-- No save button: auto-saved to localStorage on each toggle -->
        <p class="text-center text-xs text-gray-400">Las preferencias se guardan automáticamente en este dispositivo.</p>
      }

      <!-- ═══ TAB: EQUIPO ══════════════════════════════════════════ -->
      @if (activeTab() === 'equipo') {
        <div class="card overflow-hidden">
          <div class="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 class="font-semibold text-gray-800">Administradores del comercio</h3>
            <button (click)="showInvitePanel.set(!showInvitePanel())"
              class="btn-primary text-sm py-1.5 px-4 flex items-center gap-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
              </svg>
              Invitar admin
            </button>
          </div>

          @if (showInvitePanel()) {
            <div class="p-4 bg-blue-50 border-b border-blue-100 flex gap-2">
              <input [(ngModel)]="inviteEmail" placeholder="correo@ejemplo.com"
                (keyup.enter)="inviteAdmin()" class="input-field flex-1 text-sm py-1.5" />
              <button (click)="inviteAdmin()" class="btn-primary text-sm px-4 py-1.5"
                [disabled]="!inviteEmail || isInviting()">
                {{ isInviting() ? 'Buscando...' : 'Vincular' }}
              </button>
              <button (click)="showInvitePanel.set(false)"
                class="px-3 py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg text-sm">✕</button>
            </div>
          }

          @if (teamLoading()) {
            <div class="p-8 text-center">
              <div class="w-6 h-6 border-2 border-pink-300 border-t-pink-600 rounded-full animate-spin mx-auto"></div>
            </div>
          } @else if (teamMembers().length === 0) {
            <div class="p-8 text-center text-gray-400 text-sm">No hay admins vinculados</div>
          } @else {
            <div class="divide-y divide-gray-100">
              @for (member of teamMembers(); track member.user_id) {
                <div class="flex items-center gap-3 px-4 py-3">
                  <div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    @if (member.avatar_url) {
                      <img [src]="member.avatar_url" class="w-full h-full object-cover" [alt]="member.full_name" />
                    } @else {
                      <span class="text-gray-500 font-semibold text-sm">{{ member.full_name[0] | uppercase }}</span>
                    }
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">{{ member.full_name }}</p>
                    <p class="text-xs text-gray-400 truncate">{{ member.email }}</p>
                  </div>
                  <div class="text-right flex-shrink-0">
                    <p class="text-xs text-gray-400">Desde {{ member.joined_at | date:'dd/MM/yy' }}</p>
                    <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{{ member.role }}</span>
                  </div>
                  <button (click)="removeTeamMember(member)"
                    class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-2"
                    title="Eliminar acceso">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                    </svg>
                  </button>
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- ═══ TAB: FINANZAS ════════════════════════════════════════ -->
      @if (activeTab() === 'finanzas') {
        <!-- Commission info -->
        <div class="card p-5 space-y-4">
          <p class="section-title">Comisión y tier</p>
          <div class="flex items-center gap-4 flex-wrap">
            <div class="flex-1">
              <p class="text-xs text-gray-500 mb-1">Tasa de comisión actual</p>
              <p class="text-3xl font-bold text-gray-900">{{ ((store()?.commission_rate ?? 0) * 100).toFixed(1) }}%</p>
            </div>
            <div>
              <p class="text-xs text-gray-500 mb-1">Tier</p>
              <span class="px-3 py-1 rounded-full text-white text-sm font-semibold"
                [style.background]="tierColor()">{{ tierLabel() }}</span>
            </div>
          </div>
          @if (store()?.commission_tier === 'onboarding') {
            <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              ⏳ Días restantes en tarifa especial de onboarding:
              <strong>{{ onboardingDaysLeft() }} días</strong>
            </div>
          }
        </div>

        <!-- Pending balance -->
        <div class="card p-5">
          <p class="section-title">Saldo pendiente de cobro</p>
          @if (pendingBalanceLoading()) {
            <div class="h-8 w-24 bg-gray-100 rounded animate-pulse"></div>
          } @else {
            <p class="text-3xl font-bold text-gray-900">RD\$ {{ pendingBalance() | number:'1.0-0' }}</p>
            <p class="text-xs text-gray-400 mt-1">Pedidos entregados aún no liquidados</p>
          }
        </div>

        <!-- Payouts table -->
        <div class="card overflow-hidden">
          <div class="p-4 border-b border-gray-100">
            <h3 class="font-semibold text-gray-800">Historial de liquidaciones</h3>
          </div>
          @if (payoutsLoading()) {
            <div class="p-8 text-center">
              <div class="w-6 h-6 border-2 border-pink-300 border-t-pink-600 rounded-full animate-spin mx-auto"></div>
            </div>
          } @else if (payouts().length === 0) {
            <div class="p-8 text-center text-gray-400 text-sm">No hay liquidaciones registradas</div>
          } @else {
            <table class="w-full text-sm">
              <thead class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th class="px-4 py-2 text-left">Período</th>
                  <th class="px-4 py-2 text-right">Ventas</th>
                  <th class="px-4 py-2 text-right">Comisión</th>
                  <th class="px-4 py-2 text-right">Neto</th>
                  <th class="px-4 py-2 text-center">Estado</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                @for (p of payouts(); track p.id) {
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-2.5 text-gray-600">
                      {{ p.period_from | date:'dd/MM' }} – {{ p.period_to | date:'dd/MM/yy' }}
                    </td>
                    <td class="px-4 py-2.5 text-right">RD\$ {{ p.gross_sales | number:'1.0-0' }}</td>
                    <td class="px-4 py-2.5 text-right text-red-600">-RD\$ {{ p.commission_total | number:'1.0-0' }}</td>
                    <td class="px-4 py-2.5 text-right font-semibold">RD\$ {{ p.net_amount | number:'1.0-0' }}</td>
                    <td class="px-4 py-2.5 text-center">
                      <span class="px-2 py-0.5 rounded-full text-xs font-semibold"
                        [class]="payoutStatusClass(p.status)">{{ p.status }}</span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      }

    </div>
  </div>
  `,
})
export class StoreSettingsPageComponent implements OnInit {
    private readonly storeAdminSvc = inject(StoreAdminService);
    private readonly settingsSvc = inject(StoreSettingsService);
    private readonly globalSettingsSvc = inject(SettingsService);
    private readonly toast = inject(ToastService);
    private readonly confirmSvc = inject(ConfirmService);
    private readonly geoSvc = inject(AdminGeoService);

    readonly tabs: { key: Tab; label: string }[] = [
        { key: 'perfil', label: 'Perfil' },
        { key: 'horarios', label: 'Horarios' },
        { key: 'delivery', label: 'Delivery' },
        { key: 'notificaciones', label: 'Notificaciones' },
        { key: 'equipo', label: 'Equipo' },
        { key: 'finanzas', label: 'Finanzas' },
    ];

    readonly days = DAYS_LIST;
    readonly activeTab = signal<Tab>('perfil');
    readonly isSaving = computed(() => this.settingsSvc.isSaving());
    readonly store = computed(() => this.storeAdminSvc.activeStore());
    readonly commerceType = computed(() => this.store()?.commerce_type ?? 'otro');

    // Profile
    profileForm: ProfileForm = { name: '', description: '', whatsapp_number: '', address: '', sector: '', city: '', category_id: null, logo_url: null, banner_url: null, lat: null, lng: null };
    readonly storeCategories = signal<CommerceCategory[]>([]);
    private logoFile: File | null = null;
    private bannerFile: File | null = null;
    readonly uploadingLogo = signal(false);
    readonly uploadingBanner = signal(false);

    // Location / map
    readonly addressSearch = signal('');
    readonly addressSuggestions = signal<PlaceSuggestion[]>([]);
    readonly isReverseGeocoding = signal(false);
    private autocompleteTimer: ReturnType<typeof setTimeout> | null = null;

    // Schedule
    scheduleForm: ScheduleForm = { open_days: [], opening_time: '09:00', closing_time: '22:00', special_hours: false, avg_service_time: 30, per_day: {} };

    readonly openDaysList = computed(() =>
        this.days.filter(d => this.scheduleForm.open_days.includes(d.key)),
    );

    readonly schedulePreview = computed(() => {
        const days = this.scheduleForm.open_days;
        if (!days.length) return '';
        const dayLabels = days.map(d => DAYS_LIST.find(x => x.key === d)?.label ?? d);
        const fmt = (t: string) => {
            const [h, m] = t.split(':').map(Number);
            const suffix = h >= 12 ? 'pm' : 'am';
            const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
            return `${h12}:${m.toString().padStart(2, '0')}${suffix}`;
        };
        return `Esta semana estarás abierto ${dayLabels.join('-')} de ${fmt(this.scheduleForm.opening_time)} a ${fmt(this.scheduleForm.closing_time)}`;
    });

    // Delivery
    deliveryForm: DeliveryForm = { min_order_amount: 0, free_delivery_enabled: false, free_delivery_threshold: 500, express_delivery: false, express_fee: 100 };

    // Notifications (reactive)
    private readonly notifPrefsSignal = signal<StoreNotifPrefs>({ soundEnabled: true, whatsappEnabled: false, whatsappNumber: '', lowStockEnabled: false, lowStockThreshold: 5 });
    readonly notifPrefs = this.notifPrefsSignal.asReadonly();

    // Team
    readonly teamMembers = signal<TeamMember[]>([]);
    readonly teamLoading = signal(false);
    readonly showInvitePanel = signal(false);
    readonly isInviting = signal(false);
    inviteEmail = '';

    // Finances
    readonly payouts = signal<Payout[]>([]);
    readonly payoutsLoading = signal(false);
    readonly pendingBalance = signal(0);
    readonly pendingBalanceLoading = signal(false);

    readonly tierLabel = computed(() => this.settingsSvc.tierLabel(this.store()?.commission_tier));
    readonly tierColor = computed(() => this.settingsSvc.tierColor(this.store()?.commission_tier));
    readonly onboardingDaysLeft = computed(() => this.settingsSvc.onboardingDaysLeft(this.store()?.activated_at));
    private initializedStoreId: string | null = null;
    private readonly categoriesCache = new Map<string, CommerceCategory[]>();
    private readonly teamCache = new Map<string, TeamMember[]>();
    private readonly financesCache = new Map<string, { payouts: Payout[]; pendingBalance: number }>();
    private teamRequestInFlightFor: string | null = null;
    private financesRequestInFlightFor: string | null = null;

    constructor() {
        effect(() => {
            const s = this.store();
            if (!s) return;
            if (this.initializedStoreId !== s.id) {
                this.initializedStoreId = s.id;
                this.initFromStore(s);
                this.teamMembers.set([]);
                this.payouts.set([]);
                this.pendingBalance.set(0);
                this.teamLoading.set(false);
                this.payoutsLoading.set(false);
                this.pendingBalanceLoading.set(false);
            }
            const cachedCategories = this.categoriesCache.get(s.commerce_type);
            if (cachedCategories) {
                this.storeCategories.set(cachedCategories);
            } else {
                this.loadStoreCategories(s.commerce_type);
            }
            this.notifPrefsSignal.set(this.settingsSvc.loadNotifPrefs(s.id));
        });

        effect(() => {
            const tab = this.activeTab();
            const storeId = this.storeAdminSvc.activeStoreId();
            if (!storeId) return;
            if (tab === 'equipo') this.loadTeam(storeId);
            if (tab === 'finanzas') this.loadFinances(storeId);
        });
    }

    ngOnInit() { }

    private initFromStore(s: Restaurant) {
        this.profileForm = {
            name: s.name, description: s.description ?? '', whatsapp_number: s.whatsapp_number ?? '',
            address: s.address ?? '', sector: s.sector ?? '', city: s.city,
            category_id: s.category_id ?? null, logo_url: s.logo_url ?? null, banner_url: s.banner_url ?? null,
            lat: s.lat ?? null, lng: s.lng ?? null,
        };
        this.scheduleForm = {
            open_days: s.open_days ?? [], opening_time: s.opening_time ?? '09:00',
            closing_time: s.closing_time ?? '22:00', special_hours: false,
            avg_service_time: s.avg_service_time ?? 30, per_day: {},
        };
        DAYS_LIST.forEach(d => {
            this.scheduleForm.per_day[d.key] = {
                opening_time: s.opening_time ?? '09:00',
                closing_time: s.closing_time ?? '22:00',
            };
        });
        this.deliveryForm = {
            min_order_amount: s.min_order_amount ?? 0,
            free_delivery_enabled: !!(s.free_delivery_threshold && s.free_delivery_threshold > 0),
            free_delivery_threshold: s.free_delivery_threshold ?? 500,
            express_delivery: false, express_fee: 100,
        };
    }

    private loadStoreCategories(type: string) {
        this.globalSettingsSvc.getStoreCategories(type).then(
            cats => {
                this.categoriesCache.set(type, cats);
                this.storeCategories.set(cats);
            },
        ).catch(() => { });
    }

    private loadTeam(storeId: string) {
        const cached = this.teamCache.get(storeId);
        if (cached) {
            this.teamMembers.set(cached);
            return;
        }
        if (this.teamRequestInFlightFor === storeId) return;
        this.teamRequestInFlightFor = storeId;
        this.teamLoading.set(true);
        this.settingsSvc.getTeamMembers(storeId).subscribe({
            next: m => {
                this.teamCache.set(storeId, m);
                this.teamMembers.set(m);
                this.teamLoading.set(false);
                this.teamRequestInFlightFor = null;
            },
            error: () => {
                this.teamLoading.set(false);
                this.teamRequestInFlightFor = null;
            },
        });
    }

    private loadFinances(storeId: string) {
        const cached = this.financesCache.get(storeId);
        if (cached) {
            this.payouts.set(cached.payouts);
            this.pendingBalance.set(cached.pendingBalance);
            return;
        }
        if (this.financesRequestInFlightFor === storeId) return;
        this.financesRequestInFlightFor = storeId;
        this.payoutsLoading.set(true);
        this.pendingBalanceLoading.set(true);
        let payoutsData: Payout[] = [];
        let pendingData = 0;
        this.settingsSvc.getPayouts(storeId).subscribe({
            next: p => {
                payoutsData = p;
                this.payouts.set(p);
                this.payoutsLoading.set(false);
                if (!this.pendingBalanceLoading()) {
                    this.financesCache.set(storeId, { payouts: payoutsData, pendingBalance: pendingData });
                    this.financesRequestInFlightFor = null;
                }
            },
            error: () => {
                this.payoutsLoading.set(false);
                if (!this.pendingBalanceLoading()) this.financesRequestInFlightFor = null;
            },
        });
        this.settingsSvc.getPendingBalance(storeId).then(b => {
            pendingData = b;
            this.pendingBalance.set(b);
            this.pendingBalanceLoading.set(false);
            if (!this.payoutsLoading()) {
                this.financesCache.set(storeId, { payouts: payoutsData, pendingBalance: pendingData });
                this.financesRequestInFlightFor = null;
            }
        }).catch(() => {
            this.pendingBalanceLoading.set(false);
            if (!this.payoutsLoading()) this.financesRequestInFlightFor = null;
        });
    }

    setTab(tab: Tab): void {
        if (this.activeTab() === tab) return;
        this.activeTab.set(tab);
    }

    // ─── Profile images ─────────────────────────────────────────────────────
    onLogoSelected(file: File): void {
        this.logoFile = file;
    }
    onLogoRemoved(): void {
        this.logoFile = null;
        this.profileForm.logo_url = null;
    }
    onBannerSelected(file: File): void {
        this.bannerFile = file;
    }
    onBannerRemoved(): void {
        this.bannerFile = null;
        this.profileForm.banner_url = null;
    }

    async saveProfile() {
        const storeId = this.storeAdminSvc.activeStoreId();
        if (!storeId) return;
        try {
            const patch: Partial<Restaurant> = {
                name: this.profileForm.name, description: this.profileForm.description || null,
                whatsapp_number: this.profileForm.whatsapp_number || null,
                address: this.profileForm.address, sector: this.profileForm.sector, city: this.profileForm.city,
                category_id: this.profileForm.category_id,
                lat: this.profileForm.lat ?? null,
                lng: this.profileForm.lng ?? null,
            };
            if (this.logoFile) {
                this.uploadingLogo.set(true);
                patch.logo_url = await this.settingsSvc.uploadImage(this.logoFile, storeId, 'logo');
                this.uploadingLogo.set(false);
                this.logoFile = null;
            }
            if (this.bannerFile) {
                this.uploadingBanner.set(true);
                patch.banner_url = await this.settingsSvc.uploadImage(this.bannerFile, storeId, 'banner');
                this.uploadingBanner.set(false);
                this.bannerFile = null;
            }
            await this.settingsSvc.updateStore(storeId, patch);
            this.storeAdminSvc.stores.update(list => list.map(s => s.id === storeId ? { ...s, ...patch } : s));
            this.toast.success('Perfil actualizado');
        } catch (err) {
            this.uploadingLogo.set(false);
            this.uploadingBanner.set(false);
            this.toast.error(err instanceof Error ? err.message : 'Error al guardar perfil');
        }
    }

    toggleDay(key: string) {
        this.scheduleForm.open_days = this.scheduleForm.open_days.includes(key)
            ? this.scheduleForm.open_days.filter(d => d !== key)
            : [...this.scheduleForm.open_days, key];
        if (!this.scheduleForm.per_day[key]) {
            this.scheduleForm.per_day[key] = { opening_time: this.scheduleForm.opening_time, closing_time: this.scheduleForm.closing_time };
        }
    }

    // ─── Location / Map ──────────────────────────────────────────────────────

    onAddressSearchChange(value: string): void {
        this.addressSearch.set(value);
        if (this.autocompleteTimer) clearTimeout(this.autocompleteTimer);
        if (value.trim().length < 2) { this.addressSuggestions.set([]); return; }
        this.autocompleteTimer = setTimeout(async () => {
            const suggestions = await this.geoSvc.autocomplete(value);
            this.addressSuggestions.set(suggestions);
        }, 300);
    }

    async selectSuggestion(s: PlaceSuggestion): Promise<void> {
        this.clearSuggestions();
        this.addressSearch.set('');
        const detail = await this.geoSvc.getPlaceDetails(s.place_id);
        if (!detail) { this.toast.error('No se pudo obtener la ubicación'); return; }
        this.profileForm.lat = detail.lat;
        this.profileForm.lng = detail.lng;
        this.profileForm.address = detail.formatted_address;
        if (detail.sector) this.profileForm.sector = detail.sector;
        if (detail.city) this.profileForm.city = detail.city;
    }

    async onMapPick(pos: LatLng): Promise<void> {
        this.profileForm.lat = pos.lat;
        this.profileForm.lng = pos.lng;
        this.isReverseGeocoding.set(true);
        const geo = await this.geoSvc.reverseGeocode(pos.lat, pos.lng);
        this.isReverseGeocoding.set(false);
        if (geo) {
            if (!this.profileForm.address) this.profileForm.address = geo.formatted_address;
            if (geo.sector && !this.profileForm.sector) this.profileForm.sector = geo.sector;
            if (geo.city && !this.profileForm.city) this.profileForm.city = geo.city;
        }
    }

    clearSuggestions(): void {
        this.addressSuggestions.set([]);
    }

    async saveSchedule() {
        const storeId = this.storeAdminSvc.activeStoreId();
        if (!storeId) return;
        try {
            await this.settingsSvc.updateStore(storeId, {
                open_days: this.scheduleForm.open_days,
                opening_time: this.scheduleForm.opening_time,
                closing_time: this.scheduleForm.closing_time,
                avg_service_time: this.scheduleForm.avg_service_time,
            });
            this.storeAdminSvc.stores.update(list => list.map(s => s.id === storeId ? {
                ...s, open_days: this.scheduleForm.open_days,
                opening_time: this.scheduleForm.opening_time, closing_time: this.scheduleForm.closing_time,
            } : s));
            this.toast.success('Horarios actualizados');
        } catch { this.toast.error('Error al guardar horarios'); }
    }

    async saveDelivery() {
        const storeId = this.storeAdminSvc.activeStoreId();
        if (!storeId) return;
        try {
            await this.settingsSvc.updateStore(storeId, {
                min_order_amount: this.deliveryForm.min_order_amount,
                free_delivery_threshold: this.deliveryForm.free_delivery_enabled ? this.deliveryForm.free_delivery_threshold : null,
            });
            this.storeAdminSvc.stores.update(list => list.map(s => s.id === storeId ? {
                ...s, min_order_amount: this.deliveryForm.min_order_amount,
                free_delivery_threshold: this.deliveryForm.free_delivery_enabled ? this.deliveryForm.free_delivery_threshold : null,
            } : s));
            this.toast.success('Delivery actualizado');
        } catch { this.toast.error('Error al guardar delivery'); }
    }

    // ─── Notifications ───────────────────────────────────────────────────────
    toggleNotif(key: keyof StoreNotifPrefs) {
        const storeId = this.storeAdminSvc.activeStoreId();
        if (!storeId) return;
        this.notifPrefsSignal.update(p => ({ ...p, [key]: !p[key] }));
        this.settingsSvc.saveNotifPrefs(storeId, this.notifPrefsSignal());
    }

    updateNotif(key: keyof StoreNotifPrefs, val: string | number | boolean) {
        const storeId = this.storeAdminSvc.activeStoreId();
        if (!storeId) return;
        this.notifPrefsSignal.update(p => ({ ...p, [key]: val }));
        this.settingsSvc.saveNotifPrefs(storeId, this.notifPrefsSignal());
    }

    // ─── Team ────────────────────────────────────────────────────────────────
    async inviteAdmin() {
        const storeId = this.storeAdminSvc.activeStoreId();
        const email = this.inviteEmail.trim();
        if (!storeId || !email) return;
        this.isInviting.set(true);
        try {
            const result = await this.settingsSvc.inviteAdminByEmail(storeId, email);
            if (result === 'linked') {
                this.toast.success(`${email} vinculado como admin`);
                this.inviteEmail = '';
                this.showInvitePanel.set(false);
                this.teamCache.delete(storeId);
                this.loadTeam(storeId);
            } else {
                this.toast.warning('Usuario no encontrado. Pídele que se registre primero en Tutty.');
            }
        } catch { this.toast.error('Error al vincular usuario'); }
        finally { this.isInviting.set(false); }
    }

    async removeTeamMember(member: TeamMember) {
        const storeId = this.storeAdminSvc.activeStoreId();
        if (!storeId) return;
        const ok = await this.confirmSvc.confirm({
            title: 'Eliminar acceso',
            message: `¿Eliminar acceso de ${member.full_name}?`,
            danger: true,
        });
        if (!ok) return;
        try {
            await this.settingsSvc.removeAdmin(storeId, member.user_id);
            this.teamMembers.update(list => list.filter(m => m.user_id !== member.user_id));
            this.teamCache.set(storeId, this.teamMembers());
            this.toast.success('Acceso eliminado');
        } catch { this.toast.error('Error al eliminar acceso'); }
    }

    // ─── Finances helpers ────────────────────────────────────────────────────
    payoutStatusClass(status: string): string {
        if (status === 'pagado') return 'bg-green-100 text-green-700';
        if (status === 'pendiente') return 'bg-amber-100 text-amber-700';
        return 'bg-red-100 text-red-700';
    }
}
