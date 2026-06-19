import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { getSupabaseClient } from '../../../core/supabase/supabase.client';

const ADDRESS_TYPE_ICONS: Record<string, string> = {
    residencia: '🏠',
    hotel: '🏨',
    playa: '🏖️',
    trabajo: '💼',
    otro: '📍',
};

interface Address {
    id: string;
    label: string;
    street: string;
    sector: string | null;
    city: string;
    notes: string | null;
    is_default: boolean;
    address_type: string | null;
}

@Component({
    selector: 'app-customer-addresses',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, FormsModule, RouterLink],
    template: `
    <div class="min-h-screen bg-gray-50">

      <!-- Header -->
      <header class="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div class="flex items-center gap-3 px-4 h-14">
          <a routerLink="/customer/profile"
            class="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 transition-colors -ml-1">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </a>
          <h1 class="text-base font-semibold text-gray-900 tracking-tight flex-1">Mis direcciones</h1>
          <button
            (click)="openAdd()"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-medium hover:bg-brand-600 transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Agregar
          </button>
        </div>
      </header>

      <!-- Add form -->
      @if (showForm()) {
        <div class="bg-white border-b border-gray-100 px-4 py-5 space-y-3">
          <h2 class="text-sm font-semibold text-gray-800">Nueva dirección</h2>

          <!-- Type chips -->
          <div class="flex gap-2 flex-wrap">
            @for (type of addressTypes; track type.value) {
              <button
                (click)="form.address_type = type.value"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                [class]="form.address_type === type.value
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'">
                {{ type.emoji }} {{ type.label }}
              </button>
            }
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Etiqueta *</label>
              <input
                [(ngModel)]="form.label"
                placeholder="Ej: Casa"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Sector</label>
              <input
                [(ngModel)]="form.sector"
                placeholder="Ej: Naco"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Dirección *</label>
            <input
              [(ngModel)]="form.street"
              placeholder="Calle, número, apartamento..."
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent" />
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Notas de entrega</label>
            <input
              [(ngModel)]="form.notes"
              placeholder="Ej: Timbre 2, portón azul"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent" />
          </div>

          <div class="flex items-center gap-2">
            <input type="checkbox" id="is_default" [(ngModel)]="form.is_default"
              class="w-4 h-4 accent-brand-500 rounded" />
            <label for="is_default" class="text-sm text-gray-600">Usar como dirección predeterminada</label>
          </div>

          @if (formError()) {
            <p class="text-xs text-coral-600">{{ formError() }}</p>
          }

          <div class="flex gap-2 pt-1">
            <button
              (click)="saveAddress()"
              [disabled]="saving()"
              class="flex-1 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors">
              {{ saving() ? 'Guardando...' : 'Guardar dirección' }}
            </button>
            <button
              (click)="cancelForm()"
              class="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      }

      <!-- Content -->
      <div class="px-4 py-4 space-y-3">

        @if (isLoading()) {
          @for (n of [1,2,3]; track n) {
            <div class="bg-white rounded-2xl p-4 animate-pulse space-y-2 border border-gray-100">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-xl bg-gray-200"></div>
                <div class="flex-1 space-y-1.5">
                  <div class="h-3 bg-gray-200 rounded w-20"></div>
                  <div class="h-3 bg-gray-200 rounded w-40"></div>
                </div>
              </div>
            </div>
          }
        } @else if (addresses().length === 0) {
          <div class="flex flex-col items-center justify-center py-16 text-center">
            <div class="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
              <svg class="w-7 h-7 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <h3 class="text-sm font-semibold text-gray-800 mb-1">Sin direcciones guardadas</h3>
            <p class="text-xs text-gray-400 mb-4">Agrega una dirección para recibir pedidos</p>
            <button
              (click)="openAdd()"
              class="px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors">
              Agregar dirección
            </button>
          </div>
        } @else {
          @for (addr of addresses(); track addr.id) {
            <div class="bg-white rounded-2xl p-4 border shadow-theme-xs transition-all"
              [class]="addr.is_default ? 'border-brand-200' : 'border-gray-100'">
              <div class="flex items-start gap-3">

                <!-- Icon -->
                <div class="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  [class]="addr.is_default ? 'bg-brand-50' : 'bg-gray-50'">
                  {{ typeIcon(addr.address_type) }}
                </div>

                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-0.5">
                    <p class="text-sm font-semibold text-gray-900">{{ addr.label }}</p>
                    @if (addr.is_default) {
                      <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500 text-white">
                        Predeterminada
                      </span>
                    }
                  </div>
                  <p class="text-xs text-gray-600 leading-relaxed">{{ addr.street }}</p>
                  @if (addr.sector) {
                    <p class="text-xs text-gray-400 mt-0.5">{{ addr.sector }}, {{ addr.city }}</p>
                  }
                  @if (addr.notes) {
                    <p class="text-xs text-gray-400 mt-1 italic">{{ addr.notes }}</p>
                  }
                </div>

                <!-- Actions -->
                <div class="flex flex-col gap-1.5 flex-shrink-0">
                  @if (!addr.is_default) {
                    <button
                      (click)="setDefault(addr.id)"
                      class="text-[10px] font-medium text-brand-600 hover:text-brand-700 transition-colors whitespace-nowrap">
                      Predeterminar
                    </button>
                  }
                  <button
                    (click)="deleteAddress(addr.id)"
                    class="text-[10px] font-medium text-coral-500 hover:text-coral-600 transition-colors">
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          }
        }

      </div>
    </div>
  `,
})
export class CustomerAddressesPageComponent implements OnInit {
    private readonly supabase = getSupabaseClient();
    private readonly auth = inject(AuthService);

    readonly isLoading = signal(true);
    readonly addresses = signal<Address[]>([]);
    readonly showForm = signal(false);
    readonly saving = signal(false);
    readonly formError = signal<string | null>(null);

    form = {
        label: '',
        street: '',
        sector: '',
        notes: '',
        is_default: false,
        address_type: 'residencia',
    };

    readonly addressTypes = [
        { value: 'residencia', label: 'Casa', emoji: '🏠' },
        { value: 'trabajo', label: 'Trabajo', emoji: '💼' },
        { value: 'hotel', label: 'Hotel', emoji: '🏨' },
        { value: 'playa', label: 'Playa', emoji: '🏖️' },
        { value: 'otro', label: 'Otro', emoji: '📍' },
    ];

    async ngOnInit(): Promise<void> {
        await this.loadAddresses();
    }

    private async loadAddresses(): Promise<void> {
        const user = this.auth.currentUser();
        if (!user) return;
        this.isLoading.set(true);
        const { data } = await this.supabase
            .from('addresses')
            .select('id, label, street, sector, city, notes, is_default, address_type')
            .eq('user_id', user.id)
            .order('is_default', { ascending: false });
        this.addresses.set((data ?? []) as Address[]);
        this.isLoading.set(false);
    }

    openAdd(): void {
        this.form = { label: '', street: '', sector: '', notes: '', is_default: false, address_type: 'residencia' };
        this.formError.set(null);
        this.showForm.set(true);
    }

    cancelForm(): void {
        this.showForm.set(false);
        this.formError.set(null);
    }

    async saveAddress(): Promise<void> {
        if (!this.form.label.trim() || !this.form.street.trim()) {
            this.formError.set('Etiqueta y dirección son obligatorias.');
            return;
        }
        const user = this.auth.currentUser();
        if (!user) return;

        this.saving.set(true);
        this.formError.set(null);

        if (this.form.is_default) {
            await this.supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
        }

        const { error } = await this.supabase.from('addresses').insert({
            user_id: user.id,
            label: this.form.label.trim(),
            street: this.form.street.trim(),
            sector: this.form.sector.trim() || null,
            notes: this.form.notes.trim() || null,
            is_default: this.form.is_default,
            city: 'Santo Domingo',
            address_type: this.form.address_type,
        });

        if (error) {
            this.formError.set('No se pudo guardar. Intenta de nuevo.');
        } else {
            this.showForm.set(false);
            await this.loadAddresses();
        }
        this.saving.set(false);
    }

    async setDefault(id: string): Promise<void> {
        const user = this.auth.currentUser();
        if (!user) return;
        await this.supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
        await this.supabase.from('addresses').update({ is_default: true }).eq('id', id);
        await this.loadAddresses();
    }

    async deleteAddress(id: string): Promise<void> {
        await this.supabase.from('addresses').delete().eq('id', id);
        this.addresses.update(list => list.filter(a => a.id !== id));
    }

    typeIcon(type: string | null): string {
        return ADDRESS_TYPE_ICONS[type ?? 'otro'] ?? '📍';
    }
}
