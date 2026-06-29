import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { StoresService } from './stores.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../shared/ui/modal/confirm.service';
import {
    Restaurant, MenuItem, MenuCategory,
    CommissionTier, ApprovalStatus, CommerceType,
    StoreFinanceKpi, StoreOrderSummary, StoreApprovalHistory,
} from '../../core/supabase/database.types';
import { COMMERCE_ICONS, COMMERCE_LABELS } from './stores.page';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import { TuttyMapComponent } from '../../shared/ui/map/tutty-map.component';
import { AdminEmptyStateComponent } from '../../shared/ui/admin-empty-state/admin-empty-state.component';

type StoreTab = 'info' | 'catalog' | 'zones' | 'orders' | 'finance' | 'admins' | 'history';

const APPROVAL_COLORS: Record<ApprovalStatus, string> = {
    pendiente: 'bg-warning-100 text-warning-700',
    aprobado: 'bg-success-100 text-success-700',
    rechazado: 'bg-error-100 text-error-700',
    suspendido: 'bg-gray-100 text-gray-600',
};

@Component({
    selector: 'app-store-detail-page',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, DecimalPipe, DatePipe, TuttyMapComponent, AdminEmptyStateComponent],
    template: `
    @if (loading()) {
      <div class="space-y-4 animate-pulse">
        @for (i of [1,2,3]; track i) {
          <div class="h-24 bg-gray-100 rounded-3xl"></div>
        }
      </div>
    } @else if (!store()) {
      <div class="py-10">
        <app-admin-empty-state
          icon="search"
          title="Comercio no encontrado"
          description="No se pudo cargar la información del comercio."
          variant="soft" />
      </div>
    } @else {
      <!-- Header card -->
      <div class="rounded-[28px] border border-[#e7eaf1] bg-[radial-gradient(circle_at_92%_12%,rgba(235,27,141,.12),transparent_24%),linear-gradient(180deg,#fff,#fbfcff)] shadow-[0_8px_24px_rgba(18,24,40,.07)] overflow-hidden mb-4">
        @if (store()!.banner_url) {
          <img [src]="store()!.banner_url" class="w-full h-32 object-cover" />
        } @else {
          <div class="w-full h-20 bg-gradient-to-r from-[#ffd6ec] to-[#e7ebff]"></div>
        }
        <div class="px-6 pb-6 pt-0">
          <div class="flex items-end gap-4 -mt-8 mb-3">
            <div class="w-16 h-16 rounded-xl border-2 border-white shadow bg-white flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
              @if (store()!.logo_url) {
                <img [src]="store()!.logo_url" class="w-full h-full object-cover" />
              } @else {
                {{ icon(store()!.commerce_type) }}
              }
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h1 class="text-[32px] leading-[1.06] tracking-[-0.03em] font-bold text-[#111827]">{{ store()!.name }}</h1>
                <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                  {{ icon(store()!.commerce_type) }} {{ label(store()!.commerce_type) }}
                </span>
                <span class="px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
                  [class]="approvalColor(store()!.approval_status)">
                  {{ store()!.approval_status }}
                </span>
                <span class="px-2 py-0.5 rounded-full text-xs font-semibold" [class]="store()!.is_open ? 'bg-success-100 text-success-700' : 'bg-gray-100 text-gray-600'">
                  {{ store()!.is_open ? 'Abierto' : 'Cerrado' }}
                </span>
                <span class="px-2 py-0.5 rounded-full text-xs font-semibold" [class]="store()!.is_active ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700'">
                  {{ store()!.is_active ? 'Activo' : 'Inactivo' }}
                </span>
              </div>
              <p class="text-sm text-[#667085] mt-0.5">{{ store()!.address }}</p>
            </div>
            <!-- Quick action buttons -->
            <div class="flex gap-2 flex-shrink-0">
              <a routerLink="/stores" class="h-10 px-4 inline-flex items-center rounded-xl border border-[#d0d5dd] bg-white text-sm font-semibold text-[#344054] hover:bg-[#f9fafb]">← Volver</a>
              <button class="h-10 px-4 rounded-xl border border-[#d0d5dd] bg-white text-sm font-semibold text-[#344054] hover:bg-[#f9fafb]" (click)="openEditForm()">Editar</button>
              <button class="h-10 px-4 rounded-xl border border-[#d0d5dd] bg-white text-sm font-semibold text-[#344054] hover:bg-[#f9fafb]" (click)="router.navigate(['/stores', store()!.id, 'catalog'])">Ver catálogo</button>
              <button class="h-10 px-4 rounded-xl border border-[#d0d5dd] bg-white text-sm font-semibold text-[#344054] hover:bg-[#f9fafb]" (click)="editingCommission.set(true)">Configurar tier</button>
              @if (store()!.approval_status === 'aprobado') {
                <button class="h-10 px-4 rounded-xl border border-[#fecaca] bg-[#fff1f1] text-sm font-semibold text-[#b42318] hover:bg-[#fee2e2]" (click)="promptApproval('suspendido')">Suspender</button>
              }
              @if (store()!.approval_status === 'pendiente') {
                <button class="h-10 px-4 rounded-xl bg-[#087b3c] text-white text-sm font-semibold hover:bg-[#066a33]" (click)="promptApproval('aprobado')">✓ Aprobar</button>
                <button class="h-10 px-4 rounded-xl border border-error-300 text-error-600 hover:bg-error-50 text-sm font-semibold transition-colors"
                  (click)="promptApproval('rechazado')">✕ Rechazar</button>
              }
              @if (store()!.approval_status === 'rechazado' || store()!.approval_status === 'suspendido') {
                <button class="h-10 px-4 rounded-xl bg-[#087b3c] text-white text-sm font-semibold hover:bg-[#066a33]" (click)="promptApproval('aprobado')">Reactivar</button>
              }
            </div>
          </div>
        </div>
      </div>

      <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <article class="rounded-3xl border border-[#e7eaf1] bg-white p-4 shadow-[0_8px_24px_rgba(18,24,40,.07)] flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-[#f4ecff] text-[#6d28d9] grid place-items-center text-lg">⭐</div>
          <div>
            <p class="text-xs font-extrabold text-[#7b8496]">Rating</p>
            <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ store()!.avg_rating | number:'1.1-1' }}</p>
            <p class="text-xs text-[#98a2b3]">{{ store()!.total_reviews }} reseñas</p>
          </div>
        </article>
        <article class="rounded-3xl border border-[#e7eaf1] bg-white p-4 shadow-[0_8px_24px_rgba(18,24,40,.07)] flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-[#eafbf1] text-[#087b3c] grid place-items-center text-lg">🛎️</div>
          <div>
            <p class="text-xs font-extrabold text-[#7b8496]">Estado operativo</p>
            <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ store()!.is_open ? 'Abierto' : 'Cerrado' }}</p>
            <p class="text-xs text-[#98a2b3]">{{ store()!.is_active ? 'Comercio activo' : 'Comercio inactivo' }}</p>
          </div>
        </article>
        <article class="rounded-3xl border border-[#e7eaf1] bg-white p-4 shadow-[0_8px_24px_rgba(18,24,40,.07)] flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-[#ffe7f4] text-[#c71473] grid place-items-center text-lg">%</div>
          <div>
            <p class="text-xs font-extrabold text-[#7b8496]">Tier / comisión</p>
            <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ tierLabel(store()!.commission_tier) }}</p>
            <p class="text-xs text-[#98a2b3]">{{ (store()!.commission_rate * 100) | number:'1.0-1' }}%</p>
          </div>
        </article>
        <article class="rounded-3xl border border-[#e7eaf1] bg-white p-4 shadow-[0_8px_24px_rgba(18,24,40,.07)] flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-[#eef4ff] text-[#2451c7] grid place-items-center text-lg">📍</div>
          <div>
            <p class="text-xs font-extrabold text-[#7b8496]">Ubicación</p>
            <p class="text-[22px] leading-none tracking-[-0.04em] font-black text-[#111827]">{{ store()!.city }}</p>
            <p class="text-xs text-[#98a2b3]">{{ store()!.sector ?? 'Sin sector' }}</p>
          </div>
        </article>
      </section>

      <!-- Tabs -->
      <div class="flex gap-1 rounded-2xl border border-[#e7eaf1] bg-white p-1.5 mb-6 overflow-x-auto">
        @for (tab of tabs; track tab.id) {
          <button
            (click)="activeTab.set(tab.id)"
            class="px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors"
            [class]="activeTab() === tab.id
              ? 'bg-[#111827] text-white shadow-[0_8px_16px_rgba(17,24,39,.25)]'
              : 'text-[#667085] hover:text-[#344054]'"
          >{{ tab.label }}</button>
        }
      </div>

      <!-- Tab: Información -->
      @if (activeTab() === 'info') {
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <!-- Left: fields -->
          <div class="lg:col-span-2 bg-white rounded-3xl border border-[#e7eaf1] p-6 shadow-[0_8px_24px_rgba(18,24,40,.07)] space-y-5">
            <div class="flex items-center justify-between">
              <h3 class="font-semibold text-gray-800">Información del comercio</h3>
              <button class="btn-secondary text-sm" (click)="openEditForm()">✏️ Editar</button>
            </div>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div><p class="text-gray-400 text-xs mb-0.5">Nombre</p><p class="font-medium">{{ store()!.name }}</p></div>
              <div><p class="text-gray-400 text-xs mb-0.5">Slug</p><p class="font-medium">{{ store()!.slug }}</p></div>
              <div><p class="text-gray-400 text-xs mb-0.5">Tipo</p><p>{{ label(store()!.commerce_type) }}</p></div>
              <div><p class="text-gray-400 text-xs mb-0.5">WhatsApp</p><p>{{ store()!.whatsapp_number ?? '—' }}</p></div>
              <div class="col-span-2"><p class="text-gray-400 text-xs mb-0.5">Dirección</p><p>{{ store()!.address }}</p></div>
              <div><p class="text-gray-400 text-xs mb-0.5">Sector</p><p>{{ store()!.sector ?? '—' }}</p></div>
              <div><p class="text-gray-400 text-xs mb-0.5">Ciudad</p><p>{{ store()!.city }}</p></div>
              @if (store()!.lat && store()!.lng) {
                <div class="col-span-2">
                  <p class="text-gray-400 text-xs mb-0.5">Coordenadas</p>
                  <p class="font-mono text-xs text-gray-600">{{ store()!.lat | number:'1.5-6' }}, {{ store()!.lng | number:'1.5-6' }}</p>
                </div>
              } @else {
                <div class="col-span-2">
                  <div class="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                    <span>⚠️</span>
                    <span>Comercio sin coordenadas — el delivery no funcionará correctamente.</span>
                    <button class="ml-auto underline hover:no-underline" (click)="openEditForm()">Configurar</button>
                  </div>
                </div>
              }
              <div><p class="text-gray-400 text-xs mb-0.5">Rating promedio</p><p>⭐ {{ store()!.avg_rating | number:'1.1-1' }}</p></div>
              <div><p class="text-gray-400 text-xs mb-0.5">Total reseñas</p><p>{{ store()!.total_reviews }}</p></div>
              <div><p class="text-gray-400 text-xs mb-0.5">Horario</p>
                <p>{{ store()!.opening_time ?? '—' }} – {{ store()!.closing_time ?? '—' }}</p></div>
              <div><p class="text-gray-400 text-xs mb-0.5">Tiempo delivery</p><p>{{ store()!.avg_delivery_time ?? 30 }} min</p></div>
              @if (store()!.description) {
                <div class="col-span-2"><p class="text-gray-400 text-xs mb-0.5">Descripción</p><p>{{ store()!.description }}</p></div>
              }
            </div>
            <!-- Read-only location map -->
            @if (store()!.lat && store()!.lng) {
              <div class="border-t border-gray-100 pt-4">
                <p class="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Ubicación</p>
                <app-tutty-map
                  mode="view"
                  [lat]="store()!.lat"
                  [lng]="store()!.lng"
                  height="220px"
                />
              </div>
            }
          </div>
          <!-- Right: commission card -->
          <div class="space-y-4">
            <div class="bg-white rounded-3xl border border-[#e7eaf1] p-5 shadow-[0_8px_24px_rgba(18,24,40,.07)]">
              <div class="flex items-center justify-between mb-4">
                <h3 class="font-semibold text-gray-800">Comisión</h3>
                <button class="btn-secondary text-xs" (click)="editingCommission.set(true)">Editar</button>
              </div>
              @if (!editingCommission()) {
                <div class="space-y-3 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-500">Tier</span>
                    <span class="font-medium capitalize">{{ store()!.commission_tier ?? '—' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">Tasa</span>
                    <span class="font-semibold text-brand-500">{{ (store()!.commission_rate * 100).toFixed(1) }}%</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">Activado</span>
                    <span>{{ store()!.activated_at ? (store()!.activated_at | date:'dd/MM/yy') : '—' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">Delivery gratis desde</span>
                    <span>{{ store()!.free_delivery_threshold ? ('RD$ ' + (store()!.free_delivery_threshold | number)) : '—' }}</span>
                  </div>
                </div>
              } @else {
                <form [formGroup]="commissionForm" (ngSubmit)="saveCommission()" class="space-y-3 text-sm">
                  <div>
                    <label class="label text-xs">Tier</label>
                    <select class="input-field" formControlName="tier">
                      <option value="onboarding">Onboarding</option>
                      <option value="estandar">Estándar</option>
                      <option value="medio">Medio</option>
                      <option value="alto">Alto</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>
                  <div>
                    <label class="label text-xs">Tasa (%)</label>
                    <input class="input-field" type="number" step="0.1" min="1" max="99" formControlName="rate_pct" />
                  </div>
                  <div class="flex gap-2">
                    <button type="submit" class="btn-primary text-xs flex-1" [disabled]="commSaving()">
                      {{ commSaving() ? '...' : 'Guardar' }}
                    </button>
                    <button type="button" class="btn-secondary text-xs" (click)="editingCommission.set(false)">Cancelar</button>
                  </div>
                </form>
              }
            </div>
            <!-- Approval status card -->
            <div class="bg-white rounded-3xl border border-[#e7eaf1] p-5 shadow-[0_8px_24px_rgba(18,24,40,.07)]">
              <h3 class="font-semibold text-gray-800 mb-3">Estado de aprobación</h3>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-500">Estado</span>
                  <span class="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                    [class]="approvalColor(store()!.approval_status)">{{ store()!.approval_status }}</span>
                </div>
                @if (store()!.submitted_at) {
                  <div class="flex justify-between">
                    <span class="text-gray-500">Enviado</span>
                    <span>{{ store()!.submitted_at | date:'dd/MM/yy' }}</span>
                  </div>
                }
                @if (store()!.approved_at) {
                  <div class="flex justify-between">
                    <span class="text-gray-500">Decidido</span>
                    <span>{{ store()!.approved_at | date:'dd/MM/yy' }}</span>
                  </div>
                }
                @if (store()!.rejection_reason) {
                  <div class="pt-2 border-t">
                    <p class="text-gray-400 text-xs mb-1">Motivo</p>
                    <p class="text-error-600 text-xs">{{ store()!.rejection_reason }}</p>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Tab: Catálogo -->
      @if (activeTab() === 'catalog') {
        <div class="admin-table-card">
          <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 class="font-semibold text-gray-800">Catálogo de productos</h3>
            <button class="btn-primary text-sm"
              (click)="router.navigate(['/stores', store()!.id, 'catalog'])">
              Gestionar catálogo completo
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-100 text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Producto</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Precio</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Disponible</th>
                  <!-- Columns vary by commerce_type -->
                  @if (store()!.commerce_type === 'farmacia') {
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Receta</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Controlado</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Marca</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Código</th>
                  }
                  @if (store()!.commerce_type === 'bodega' || store()!.commerce_type === 'colmado') {
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Unidad</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Stock</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Código</th>
                  }
                  @if (store()!.commerce_type === 'tienda_ropa' || store()!.commerce_type === 'electronica') {
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Variantes</th>
                  }
                  @if (store()!.commerce_type === 'restaurante') {
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Prep.</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Calorías</th>
                  }
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-100">
                @if (catalogLoading()) {
                  @for (i of [1,2,3]; track i) {
                    <tr class="animate-pulse">
                      <td colspan="8" class="px-4 py-3"><div class="h-4 bg-gray-200 rounded w-full"></div></td>
                    </tr>
                  }
                } @else if (items().length === 0) {
                  <tr>
                    <td colspan="8" class="px-4 py-6">
                      <app-admin-empty-state
                        icon="search"
                        title="Sin productos"
                        description="Este comercio todavía no tiene productos."
                        variant="soft" />
                    </td>
                  </tr>
                } @else {
                  @for (item of items(); track item.id) {
                    <tr class="hover:bg-gray-50">
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-2">
                          @if (item.photo_url) {
                            <img [src]="item.photo_url" class="w-8 h-8 rounded object-cover flex-shrink-0" />
                          }
                          <div>
                            <p class="font-medium text-gray-800">{{ item.name }}</p>
                            @if (item.tags && item.tags.length) {
                              <div class="flex gap-1 mt-0.5">
                                @for (tag of item.tags; track tag) {
                                  <span class="px-1.5 py-0 rounded text-[10px] bg-brand-100 text-brand-600">{{ tag }}</span>
                                }
                              </div>
                            }
                          </div>
                        </div>
                      </td>
                      <td class="px-4 py-3">
                        <p class="text-gray-800 font-medium">RD$ {{ item.price | number:'1.0-0' }}</p>
                        @if (item.discount_price) {
                          <p class="text-xs text-success-600">RD$ {{ item.discount_price | number:'1.0-0' }}</p>
                        }
                      </td>
                      <td class="px-4 py-3">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          [class]="item.is_available ? 'bg-success-100 text-success-700' : 'bg-gray-100 text-gray-500'">
                          {{ item.is_available ? 'Sí' : 'No' }}
                        </span>
                      </td>
                      @if (store()!.commerce_type === 'farmacia') {
                        <td class="px-4 py-3 text-xs">{{ item.requires_prescription ? '✓' : '—' }}</td>
                        <td class="px-4 py-3 text-xs">{{ item.controlled_substance ? '⚠️' : '—' }}</td>
                        <td class="px-4 py-3 text-xs text-gray-600">{{ item.brand ?? '—' }}</td>
                        <td class="px-4 py-3 text-xs text-gray-600 font-mono">{{ item.barcode ?? '—' }}</td>
                      }
                      @if (store()!.commerce_type === 'bodega' || store()!.commerce_type === 'colmado') {
                        <td class="px-4 py-3 text-xs text-gray-600">{{ item.unit_type }}</td>
                        <td class="px-4 py-3 text-xs">{{ item.stock_count ?? '∞' }}</td>
                        <td class="px-4 py-3 text-xs text-gray-600 font-mono">{{ item.barcode ?? '—' }}</td>
                      }
                      @if (store()!.commerce_type === 'tienda_ropa' || store()!.commerce_type === 'electronica') {
                        <td class="px-4 py-3 text-xs">{{ item.has_variants ? '✓' : '—' }}</td>
                      }
                      @if (store()!.commerce_type === 'restaurante') {
                        <td class="px-4 py-3 text-xs text-gray-600">{{ item.preparation_time ?? 15 }} min</td>
                        <td class="px-4 py-3 text-xs text-gray-600">{{ item.calories ?? '—' }}</td>
                      }
                      <td class="px-4 py-3">
                        <button class="btn-secondary text-xs px-2 py-1"
                          (click)="openCatalogOverride(item)">Moderar</button>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- Tab: Zonas -->
      @if (activeTab() === 'zones') {
        <div class="bg-white rounded-3xl border border-[#e7eaf1] p-6 text-center text-gray-500 shadow-[0_8px_24px_rgba(18,24,40,.07)]">
          <p class="text-2xl mb-2">📍</p>
          <p class="text-sm mb-3">Gestión de zonas de delivery</p>
          <button class="btn-primary text-sm"
            (click)="router.navigate(['/restaurants', store()!.id, 'zones'])">
            Abrir gestor de zonas
          </button>
        </div>
      }

      <!-- Tab: Pedidos -->
      @if (activeTab() === 'orders') {
        <div class="bg-white rounded-3xl border border-[#e7eaf1] shadow-[0_8px_24px_rgba(18,24,40,.07)] overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 class="text-sm font-semibold text-gray-800">Pedidos recientes (últimos 30)</h3>
            <a [routerLink]="['/orders']" [queryParams]="{commerce_id: store()!.id}"
              class="text-xs text-brand-500 hover:text-brand-700 font-medium">Ver todos en pedidos →</a>
          </div>
          @if (storeOrdersLoading()) {
            <div class="p-6 space-y-3">
              @for (i of [1,2,3]; track i) {
                <div class="h-10 bg-gray-100 rounded animate-pulse"></div>
              }
            </div>
          } @else if (storeOrders().length === 0) {
            <div class="py-8 px-4">
              <app-admin-empty-state
                icon="orders"
                title="Sin pedidos para este comercio"
                description="No hay pedidos recientes en los últimos 30 registros."
                variant="soft" />
            </div>
          } @else {
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-100 text-sm">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                    <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                    <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
                    <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Total</th>
                    <th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                    <th class="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                  @for (o of storeOrders(); track o.id) {
                    <tr class="hover:bg-gray-50 transition-colors">
                      <td class="px-4 py-2.5 font-mono text-xs text-gray-500">{{ o.order_number }}</td>
                      <td class="px-4 py-2.5 text-gray-700">{{ o.customer_name }}</td>
                      <td class="px-4 py-2.5">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize
                          {{ o.status === 'entregado' ? 'bg-success-50 text-success-700' :
                             o.status === 'cancelado' ? 'bg-error-50 text-error-700' :
                             'bg-warning-50 text-warning-700' }}">
                          {{ o.status }}
                        </span>
                      </td>
                      <td class="px-4 py-2.5 font-medium text-gray-800">RD$ {{ o.total | number:'1.0-0' }}</td>
                      <td class="px-4 py-2.5 text-gray-400 text-xs">{{ o.created_at | date:'MMM d, y h:mm a' }}</td>
                      <td class="px-4 py-2.5">
                        <a [routerLink]="['/orders', o.id]" class="text-xs text-brand-500 hover:text-brand-700">Ver</a>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }

      <!-- Tab: Finanzas -->
      @if (activeTab() === 'finance') {
        <div class="space-y-4">
          <!-- Date range -->
          <div class="flex gap-3 items-center">
            <input type="date" class="input-field w-44" [(ngModel)]="financeFrom" />
            <span class="text-gray-400">—</span>
            <input type="date" class="input-field w-44" [(ngModel)]="financeTo" />
            <button class="btn-primary text-sm" (click)="loadFinance()">Ver</button>
          </div>
          <!-- KPIs -->
          @if (financeKpi()) {
            <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div class="bg-white rounded-2xl border border-[#e7eaf1] p-4 text-center shadow-[0_6px_16px_rgba(18,24,40,.05)]">
                <p class="text-2xl font-bold text-gray-800">{{ financeKpi()!.totalOrders }}</p>
                <p class="text-xs text-gray-500 mt-1">Pedidos entregados</p>
              </div>
              <div class="bg-white rounded-2xl border border-[#e7eaf1] p-4 text-center shadow-[0_6px_16px_rgba(18,24,40,.05)]">
                <p class="text-xl font-bold text-gray-800">RD$ {{ financeKpi()!.grossSales | number:'1.0-0' }}</p>
                <p class="text-xs text-gray-500 mt-1">Ventas brutas</p>
              </div>
              <div class="bg-white rounded-2xl border border-[#e7eaf1] p-4 text-center shadow-[0_6px_16px_rgba(18,24,40,.05)]">
                <p class="text-xl font-bold text-brand-500">RD$ {{ financeKpi()!.commission | number:'1.0-0' }}</p>
                <p class="text-xs text-gray-500 mt-1">Comisión generada</p>
              </div>
              <div class="bg-white rounded-2xl border border-[#e7eaf1] p-4 text-center shadow-[0_6px_16px_rgba(18,24,40,.05)]">
                <p class="text-xl font-bold text-gray-800">RD$ {{ financeKpi()!.deliveryFees | number:'1.0-0' }}</p>
                <p class="text-xs text-gray-500 mt-1">Tarifas de delivery</p>
              </div>
              <div class="bg-white rounded-2xl border border-[#e7eaf1] p-4 text-center shadow-[0_6px_16px_rgba(18,24,40,.05)]">
                <p class="text-xl font-bold text-success-600">RD$ {{ financeKpi()!.netPayout | number:'1.0-0' }}</p>
                <p class="text-xs text-gray-500 mt-1">Neto al comercio</p>
              </div>
            </div>
          }
          <!-- Liquidation table -->
          @if (orderSummaries().length > 0) {
            <div class="bg-white rounded-3xl border border-[#e7eaf1] overflow-hidden shadow-[0_8px_24px_rgba(18,24,40,.07)]">
              <div class="px-4 py-3 border-b border-gray-100">
                <h3 class="font-semibold text-gray-800 text-sm">Liquidación de pedidos</h3>
              </div>
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-100 text-sm">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Pedido</th>
                      <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Subtotal</th>
                      <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Comisión</th>
                      <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Neto</th>
                      <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-100">
                    @for (o of orderSummaries(); track o.id) {
                      <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3 font-mono text-xs text-gray-600">{{ o.order_number }}</td>
                        <td class="px-4 py-3 text-right">RD$ {{ o.subtotal | number:'1.0-0' }}</td>
                        <td class="px-4 py-3 text-right text-brand-500">RD$ {{ o.commission_amount | number:'1.0-0' }}</td>
                        <td class="px-4 py-3 text-right text-success-600 font-medium">RD$ {{ (o.subtotal - o.commission_amount) | number:'1.0-0' }}</td>
                        <td class="px-4 py-3 text-xs text-gray-500">{{ o.created_at | date:'dd/MM/yy HH:mm' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>
      }

      <!-- Tab: Admins -->
      @if (activeTab() === 'admins') {
        <div class="bg-white rounded-3xl border border-[#e7eaf1] p-6 shadow-[0_8px_24px_rgba(18,24,40,.07)]">
          <h3 class="font-semibold text-gray-800 mb-4">Administradores del comercio</h3>
          @if (store()!.admin_name) {
            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-sm">
                {{ store()!.admin_name!.charAt(0) }}
              </div>
              <div>
                <p class="font-medium text-sm text-gray-800">{{ store()!.admin_name }}</p>
                <p class="text-xs text-gray-500">{{ store()!.admin_email }}</p>
              </div>
            </div>
          } @else {
            <app-admin-empty-state
              icon="users"
              title="Sin administradores asignados"
              description="Este comercio no tiene un administrador vinculado."
              variant="soft" />
          }
        </div>
      }

      <!-- Tab: Historial -->
      @if (activeTab() === 'history') {
        <div class="bg-white rounded-3xl border border-[#e7eaf1] overflow-hidden shadow-[0_8px_24px_rgba(18,24,40,.07)]">
          <div class="px-4 py-3 border-b border-gray-100">
            <h3 class="font-semibold text-gray-800 text-sm">Historial de aprobación</h3>
          </div>
          @if (approvalHistory().length === 0) {
            <div class="px-4 py-6">
              <app-admin-empty-state
                icon="search"
                title="Sin historial"
                description="Aún no hay eventos de aprobación registrados."
                variant="soft" />
            </div>
          } @else {
            <div class="divide-y divide-gray-100">
              @for (ev of approvalHistory(); track ev.date) {
                <div class="px-4 py-3 flex gap-3 text-sm">
                  <span class="px-2 py-0.5 rounded-full text-xs font-medium self-start capitalize"
                    [class]="approvalColor(ev.status)">{{ ev.status }}</span>
                  <div class="flex-1">
                    <p class="text-gray-800 font-medium">{{ ev.event }}</p>
                    @if (ev.notes) { <p class="text-xs text-gray-500 mt-0.5">{{ ev.notes }}</p> }
                    <p class="text-xs text-gray-400 mt-1">{{ ev.by }} · {{ ev.date | date:'dd/MM/yyyy HH:mm' }}</p>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    }

    <!-- Approval action modal -->
    @if (approvalModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="approvalModal.set(null)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6">
          <h3 class="font-semibold text-gray-800 mb-1">
            {{ approvalModal() === 'aprobado' ? 'Aprobar comercio' : approvalModal() === 'rechazado' ? 'Rechazar solicitud' : 'Suspender comercio' }}
          </h3>
          <p class="text-sm text-gray-500 mb-4">
            {{ approvalModal() === 'aprobado' ? 'El comercio quedará habilitado en la plataforma.' : 'Indique el motivo (opcional).' }}
          </p>
          <textarea class="input-field resize-none w-full" rows="3"
            placeholder="Notas / motivo de la decisión..."
            [(ngModel)]="approvalNote"></textarea>
          <div class="flex gap-3 mt-4 justify-end">
            <button class="btn-secondary" (click)="approvalModal.set(null)">Cancelar</button>
            <button class="btn-primary" (click)="confirmApproval()" [disabled]="approvalSaving()">
              {{ approvalSaving() ? 'Guardando...' : 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Edit form modal -->
    @if (showEditForm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="showEditForm.set(false)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10">
          <div class="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <h3 class="font-semibold text-gray-800">Editar comercio</h3>
            <button aria-label="Cerrar edición de comercio" class="text-gray-400 hover:text-gray-600" (click)="showEditForm.set(false)">✕</button>
          </div>
          <form [formGroup]="editForm" (ngSubmit)="saveEdit()" class="p-6 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label class="label">Nombre *</label><input class="input-field" formControlName="name" /></div>
              <div><label class="label">Slug *</label><input class="input-field" formControlName="slug" /></div>
              <div><label class="label">WhatsApp</label><input class="input-field" formControlName="whatsapp_number" /></div>
              <div><label class="label">Ciudad</label><input class="input-field" formControlName="city" /></div>
              <div class="sm:col-span-2"><label class="label">Dirección</label><input class="input-field" formControlName="address" /></div>
              <div><label class="label">Sector</label><input class="input-field" formControlName="sector" /></div>
              <div><label class="label">Pedido mínimo (RD$)</label><input class="input-field" type="number" formControlName="min_order_amount" /></div>
              <div class="sm:col-span-2"><label class="label">Descripción</label>
                <textarea class="input-field resize-none" rows="2" formControlName="description"></textarea></div>
              <div>
                <label class="label">Latitud</label>
                <input class="input-field font-mono" type="number" step="0.000001" formControlName="lat" placeholder="18.4718" />
              </div>
              <div>
                <label class="label">Longitud</label>
                <input class="input-field font-mono" type="number" step="0.000001" formControlName="lng" placeholder="-69.9513" />
              </div>
              @if (!editForm.get('lat')!.value || !editForm.get('lng')!.value) {
                <div class="sm:col-span-2">
                  <p class="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    ⚠️ Sin coordenadas. El cálculo de delivery para este comercio no funcionará.
                  </p>
                </div>
              }
            </div>
            <div class="flex gap-3 justify-end pt-2">
              <button type="button" class="btn-secondary" (click)="showEditForm.set(false)">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="editSaving()">
                {{ editSaving() ? 'Guardando...' : 'Guardar cambios' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Catalog override modal -->
    @if (overrideItem()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="overrideItem.set(null)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6">
          <h3 class="font-semibold text-gray-800 mb-4">Moderación: {{ overrideItem()!.name }}</h3>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">Disponible</span>
              <button
                class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                [class]="overrideAvailable() ? 'bg-success-500' : 'bg-gray-200'"
                (click)="overrideAvailable.set(!overrideAvailable())"
                role="switch"
                [attr.aria-checked]="overrideAvailable()"
                [attr.aria-label]="overrideAvailable() ? 'Marcar producto como no disponible' : 'Marcar producto como disponible'"
              ><span class="inline-block w-4 h-4 transform rounded-full bg-white shadow transition-transform"
                [class]="overrideAvailable() ? 'translate-x-4' : 'translate-x-0.5'"></span></button>
            </div>
            <div>
              <label class="label text-xs">Tags de moderación</label>
              <div class="flex flex-wrap gap-2">
                @for (tag of moderationTags; track tag) {
                  <button type="button"
                    class="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                    [class]="selectedTags().includes(tag)
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'"
                    (click)="toggleTag(tag)">{{ tag }}</button>
                }
              </div>
            </div>
            <div>
              <label class="label text-xs">Motivo de la acción *</label>
              <textarea class="input-field resize-none w-full" rows="2"
                placeholder="Describe el motivo del cambio..."
                [(ngModel)]="overrideReason"></textarea>
            </div>
          </div>
          <div class="flex gap-3 mt-5 justify-end">
            <button class="btn-secondary" (click)="overrideItem.set(null)">Cancelar</button>
            <button class="btn-primary" (click)="applyOverride()" [disabled]="!overrideReason || overrideSaving()">
              {{ overrideSaving() ? 'Aplicando...' : 'Aplicar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class StoreDetailPageComponent implements OnInit {
    private readonly service = inject(StoresService);
    private readonly toast = inject(ToastService);
    private readonly route = inject(ActivatedRoute);
    private readonly fb = inject(FormBuilder);
    readonly router = inject(Router);

    readonly store = signal<Restaurant | null>(null);
    readonly loading = signal(true);
    readonly activeTab = signal<StoreTab>('info');
    readonly items = signal<MenuItem[]>([]);
    readonly catalogLoading = signal(false);
    readonly financeKpi = signal<StoreFinanceKpi | null>(null);
    readonly orderSummaries = signal<StoreOrderSummary[]>([]);
    readonly approvalHistory = signal<StoreApprovalHistory[]>([]);
    readonly editingCommission = signal(false);
    readonly commSaving = signal(false);
    readonly showEditForm = signal(false);
    readonly editSaving = signal(false);
    readonly approvalModal = signal<ApprovalStatus | null>(null);
    readonly approvalSaving = signal(false);
    readonly overrideItem = signal<MenuItem | null>(null);
    readonly overrideAvailable = signal(true);
    readonly selectedTags = signal<string[]>([]);
    readonly overrideSaving = signal(false);

    // Orders tab
    private readonly supabase = getSupabaseClient();
    readonly storeOrders = signal<any[]>([]);
    readonly storeOrdersLoading = signal(false);

    approvalNote = '';
    overrideReason = '';
    financeFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    financeTo = new Date().toISOString().slice(0, 10);

    readonly moderationTags = ['verificado', 'destacado_plataforma', 'bajo_revision'];

    readonly tabs: { id: StoreTab; label: string }[] = [
        { id: 'info', label: 'Información' },
        { id: 'catalog', label: 'Catálogo' },
        { id: 'zones', label: 'Zonas' },
        { id: 'orders', label: 'Pedidos' },
        { id: 'finance', label: 'Finanzas' },
        { id: 'admins', label: 'Admins' },
        { id: 'history', label: 'Historial' },
    ];

    readonly commissionForm = this.fb.group({
        tier: ['estandar' as CommissionTier, Validators.required],
        rate_pct: [10, [Validators.min(1), Validators.max(99)]],
    });

    readonly editForm = this.fb.group({
        name: ['', Validators.required],
        slug: ['', Validators.required],
        description: [''],
        whatsapp_number: [''],
        address: ['', Validators.required],
        sector: [''],
        city: ['Santo Domingo', Validators.required],
        min_order_amount: [200],
        lat: [null as number | null],
        lng: [null as number | null],
    });

    ngOnInit(): void {
        const id = this.route.snapshot.paramMap.get('id')!;
        this.service.getStoreById(id).subscribe({
            next: (s) => { this.store.set(s as any); this.loading.set(false); this.loadTabData(); },
            error: () => { this.toast.error('Error al cargar el comercio'); this.loading.set(false); },
        });
    }

    private loadTabData(): void {
        const id = this.store()!.id;
        // Load catalog
        this.catalogLoading.set(true);
        this.service.getMenuItems(id).subscribe({
            next: (data) => { this.items.set(data); this.catalogLoading.set(false); },
            error: () => this.catalogLoading.set(false),
        });
        // Load approval history
        this.service.getApprovalHistory(id).subscribe({
            next: (h) => this.approvalHistory.set(h),
        });
        // Load recent orders
        this.loadStoreOrders(id);
    }

    async loadStoreOrders(commerceId: string): Promise<void> {
        this.storeOrdersLoading.set(true);
        const { data } = await this.supabase
            .from('orders_full')
            .select('id, order_number, status, total, created_at, customer_name, repartidor_name')
            .eq('commerce_id', commerceId)
            .order('created_at', { ascending: false })
            .limit(30);
        this.storeOrders.set(data ?? []);
        this.storeOrdersLoading.set(false);
    }

    loadFinance(): void {
        const id = this.store()!.id;
        this.service.getFinanceKpi(id, this.financeFrom, this.financeTo).subscribe({
            next: (kpi) => this.financeKpi.set(kpi),
            error: () => this.toast.error('Error al cargar datos financieros'),
        });
        this.service.getOrderSummaries(id, this.financeFrom, this.financeTo).subscribe({
            next: (data) => this.orderSummaries.set(data),
        });
    }

    promptApproval(status: ApprovalStatus): void {
        this.approvalNote = '';
        this.approvalModal.set(status);
    }

    async confirmApproval(): Promise<void> {
        this.approvalSaving.set(true);
        try {
            await this.service.updateApproval(this.store()!.id, this.approvalModal()!, this.approvalNote || undefined);
            this.store.update(s => s ? { ...s, approval_status: this.approvalModal()! } : s);
            this.toast.success('Estado de aprobación actualizado');
            this.approvalModal.set(null);
        } catch {
            this.toast.error('Error al actualizar aprobación');
        } finally {
            this.approvalSaving.set(false);
        }
    }

    async saveCommission(): Promise<void> {
        const val = this.commissionForm.getRawValue();
        this.commSaving.set(true);
        try {
            await this.service.updateCommission(
                this.store()!.id,
                (val.rate_pct ?? 10) / 100,
                val.tier as CommissionTier
            );
            this.store.update(s => s ? { ...s, commission_tier: val.tier as CommissionTier, commission_rate: (val.rate_pct ?? 10) / 100 } : s);
            this.editingCommission.set(false);
            this.toast.success('Comisión actualizada');
        } catch {
            this.toast.error('Error al actualizar comisión');
        } finally {
            this.commSaving.set(false);
        }
    }

    openEditForm(): void {
        const s = this.store()!;
        this.editForm.patchValue({
            name: s.name,
            slug: s.slug,
            description: s.description ?? '',
            whatsapp_number: s.whatsapp_number ?? '',
            address: s.address ?? '',
            sector: s.sector ?? '',
            city: s.city,
            min_order_amount: s.min_order_amount,
            lat: s.lat ?? null,
            lng: s.lng ?? null,
        });
        this.showEditForm.set(true);
    }

    async saveEdit(): Promise<void> {
        if (this.editForm.invalid) return;
        this.editSaving.set(true);
        const val = this.editForm.getRawValue();
        try {
            const updated = await this.service.saveStore({ id: this.store()!.id, ...val as any });
            this.store.update(s => s ? { ...s, ...updated } : s);
            this.showEditForm.set(false);
            this.toast.success('Comercio actualizado');
        } catch {
            this.toast.error('Error al guardar cambios');
        } finally {
            this.editSaving.set(false);
        }
    }

    openCatalogOverride(item: MenuItem): void {
        this.overrideItem.set(item);
        this.overrideAvailable.set(item.is_available);
        this.selectedTags.set((item.tags ?? []).filter(t => this.moderationTags.includes(t)));
        this.overrideReason = '';
    }

    toggleTag(tag: string): void {
        this.selectedTags.update(tags =>
            tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag]
        );
    }

    async applyOverride(): Promise<void> {
        if (!this.overrideReason) return;
        this.overrideSaving.set(true);
        const item = this.overrideItem()!;
        const existingTags = (item.tags ?? []).filter(t => !this.moderationTags.includes(t));
        const newTags = [...existingTags, ...this.selectedTags()];
        try {
            await this.service.updateItemModeration(item.id, {
                is_available: this.overrideAvailable(),
                tags: newTags,
            });
            this.items.update(list => list.map(i => i.id === item.id
                ? { ...i, is_available: this.overrideAvailable(), tags: newTags }
                : i
            ));
            this.toast.success('Moderación aplicada');
            this.overrideItem.set(null);
        } catch {
            this.toast.error('Error al aplicar moderación');
        } finally {
            this.overrideSaving.set(false);
        }
    }

    icon(type: CommerceType): string { return COMMERCE_ICONS[type] ?? '🏪'; }
    label(type: CommerceType): string { return COMMERCE_LABELS[type] ?? type; }
    tierLabel(tier: CommissionTier | null | undefined): string {
        const map: Record<CommissionTier, string> = {
            onboarding: 'Onb.',
            estandar: 'Est.',
            medio: 'Med.',
            alto: 'Alto',
            premium: 'Prem.',
        };
        return tier ? (map[tier] ?? tier) : '—';
    }
    approvalColor(status: ApprovalStatus): string { return APPROVAL_COLORS[status] ?? 'bg-gray-100 text-gray-600'; }
}
