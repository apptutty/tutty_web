import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../settings.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { StoreCategory, CommerceType } from '../../../core/supabase/database.types';
import { AdminEmptyStateComponent } from '../../../shared/ui/admin-empty-state/admin-empty-state.component';

@Component({
  selector: 'app-settings-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminEmptyStateComponent],
  template: `
    <div>
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <select class="input-field w-auto text-sm" [(ngModel)]="typeFilter" (ngModelChange)="load()">
          <option value="all">Todos los tipos</option>
          @for (ct of commerceTypes; track ct.value) {
            <option [value]="ct.value">{{ ct.label }}</option>
          }
        </select>
        <button class="btn-primary text-sm ml-auto" (click)="openForm()">+ Nueva Categoría</button>
      </div>

      @if (loading()) {
        <div class="card p-6 space-y-3">
          @for (i of skeleton4; track i) {
            <div class="animate-pulse h-12 bg-gray-200 rounded"></div>
          }
        </div>
      } @else if (categories().length === 0) {
        <div class="card p-10 text-center text-gray-400">
          <app-admin-empty-state
            icon="search"
            title="No hay categorías registradas"
            description="Crea la primera categoría para organizar los comercios."
            actionLabel="+ Nueva Categoría"
            (action)="openForm()" />
        </div>
      } @else {
        <div class="admin-table-card">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-3 py-3 w-8"></th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Slug</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Ícono</th>
                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Orden</th>
                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Activo</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-100">
              @for (cat of categories(); track cat.id; let i = $index) {
                <tr draggable="true"
                  (dragstart)="onDragStart(i)" (dragover)="onDragOver($event)" (drop)="onDrop(i)"
                  class="transition-colors"
                  [class]="draggedIndex() === i ? 'opacity-40 bg-brand-50' : 'hover:bg-gray-50 cursor-grab'">
                  <td class="px-3 py-3 text-gray-300 text-lg select-none">
                    <span aria-hidden="true">⠿</span>
                    <span class="sr-only">Arrastrar para reordenar categoría</span>
                  </td>
                  <td class="px-4 py-3 font-medium text-gray-800">{{ cat.name }}</td>
                  <td class="px-4 py-3 text-gray-400 font-mono text-xs">{{ cat.slug }}</td>
                  <td class="px-4 py-3 text-gray-600">{{ typeLabel(cat.commerce_type) }}</td>
                  <td class="px-4 py-3 text-center text-xl">{{ getCategoryIcon(cat.slug) }}</td>
                  <td class="px-4 py-3 text-center text-gray-500">{{ cat.display_order }}</td>
                  <td class="px-4 py-3 text-center">
                    <span [class]="cat.is_active ? 'text-success-600' : 'text-error-500'" class="font-medium text-xs">{{ cat.is_active ? 'Sí' : 'No' }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex gap-2">
                      <button class="text-brand-500 hover:text-brand-700 text-sm" (click)="openForm(cat)">Editar</button>
                      <button class="text-error-500 hover:text-error-700 text-sm"
                        (click)="delete(cat.id)" [disabled]="deleting() === cat.id">
                        {{ deleting() === cat.id ? '...' : 'Eliminar' }}
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

    @if (showModal()) {
      <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="admin-modal w-full max-w-lg">
          <div class="admin-modal__header">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="text-lg font-semibold mb-0">{{ editing()?.id ? 'Editar Categoría' : 'Nueva Categoría' }}</h3>
                <p class="text-sm text-gray-500 mt-1">Gestiona metadatos de categoría y visibilidad en el catálogo.</p>
              </div>
              <button type="button" class="admin-icon-btn" aria-label="Cerrar modal de categoría" (click)="showModal.set(false)">✕</button>
            </div>
          </div>
          <form (ngSubmit)="save()" class="admin-modal__body space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="label">Nombre</label>
                <input type="text" class="input-field" [(ngModel)]="form.name"
                  (ngModelChange)="autoSlug($event)" name="cat_name" required />
              </div>
              <div>
                <label class="label">Slug</label>
                <input type="text" class="input-field font-mono text-sm"
                  [(ngModel)]="form.slug" name="cat_slug" required />
              </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="label">Tipo de Comercio</label>
                <select class="input-field" [(ngModel)]="form.commerce_type" name="cat_type">
                  @for (ct of commerceTypes; track ct.value) {
                    <option [value]="ct.value">{{ ct.label }}</option>
                  }
                </select>
              </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="label">Orden de visualización</label>
                <input type="number" class="input-field" [(ngModel)]="form.display_order" name="cat_order" min="0" step="1" />
              </div>
              <div class="flex items-center gap-3 pt-6">
                <button type="button"
                  (click)="form.is_active = !form.is_active"
                  class="admin-switch"
                  aria-label="Alternar estado de categoría"
                  role="switch"
                  [attr.aria-checked]="form.is_active"
                  [class.admin-switch--on]="form.is_active">
                  <span class="admin-switch__thumb" [class.admin-switch__thumb--on]="form.is_active"></span>
                </button>
                <span class="text-sm text-gray-700">{{ form.is_active ? 'Activa' : 'Inactiva' }}</span>
              </div>
            </div>
            <div class="admin-modal__footer">
              <button type="button" class="btn-secondary flex-1" (click)="showModal.set(false)">Cancelar</button>
              <button type="submit" class="btn-primary flex-1" [disabled]="saving()">
                {{ saving() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class CategoriesPageComponent implements OnInit {
  private readonly svc = inject(SettingsService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal<string | null>(null);
  readonly categories = signal<StoreCategory[]>([]);
  readonly showModal = signal(false);
  readonly editing = signal<StoreCategory | null>(null);
  readonly draggedIndex = signal<number | null>(null);
  readonly skeleton4 = [1, 2, 3, 4];
  typeFilter: CommerceType | 'all' = 'all';
  form: { name: string; slug: string; commerce_type: CommerceType; display_order: number; is_active: boolean } = {
    name: '', slug: '', commerce_type: 'restaurante', display_order: 0, is_active: true,
  };

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

  ngOnInit() { this.load(); }

  async load() {
    this.loading.set(true);
    const filter = this.typeFilter === 'all' ? undefined : this.typeFilter as CommerceType;
    try {
      this.categories.set(await this.svc.getStoreCategories(filter));
    } catch { } finally { this.loading.set(false); }
  }

  openForm(cat?: StoreCategory) {
    this.editing.set(cat ?? null);
    this.form = cat
      ? { name: cat.name, slug: cat.slug, commerce_type: cat.commerce_type, display_order: cat.display_order, is_active: cat.is_active }
      : { name: '', slug: '', commerce_type: 'restaurante', display_order: this.categories().length, is_active: true };
    this.showModal.set(true);
  }

  async save() {
    this.saving.set(true);
    try {
      await this.svc.saveStoreCategory({ ...this.form, id: this.editing()?.id });
      this.toast.success('Categoría guardada');
      this.showModal.set(false);
      this.load();
    } catch { this.toast.error('Error al guardar categoría'); }
    finally { this.saving.set(false); }
  }

  async delete(id: string) {
    this.deleting.set(id);
    try {
      await this.svc.deleteStoreCategory(id);
      this.toast.success('Categoría eliminada');
      this.load();
    } catch { this.toast.error('Error al eliminar'); }
    finally { this.deleting.set(null); }
  }

  autoSlug(name: string) {
    this.form.slug = name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  typeLabel(type: CommerceType): string {
    return this.commerceTypes.find(ct => ct.value === type)?.label ?? type;
  }

  getCategoryIcon(slug: string): string {
    const icons: Record<string, string> = {
      dominicana: '🍽️', pizza: '🍕', pollo: '🍗', rapida: '🍔', mariscos: '🦞',
      sushi: '🍣', hamburguesas: '🍔', postres: '🍰', bebidas: '🥤', saludable: '🥗',
      farmacia: '💊', bodega: '📦', colmado: '🛒', tienda_ropa: '👗',
      supermercado: '🛒', electronica: '📱', otro: '🏪',
    };
    return icons[slug] ?? '🏪';
  }

  onDragStart(index: number) { this.draggedIndex.set(index); }
  onDragOver(e: DragEvent) { e.preventDefault(); }

  onDrop(targetIndex: number) {
    const from = this.draggedIndex();
    if (from === null || from === targetIndex) { this.draggedIndex.set(null); return; }
    const cats = [...this.categories()];
    const [moved] = cats.splice(from, 1);
    cats.splice(targetIndex, 0, moved);
    const updated = cats.map((c, i) => ({ ...c, display_order: i }));
    this.categories.set(updated);
    this.draggedIndex.set(null);
    this.svc.reorderCategories(updated.map((c, i) => ({ id: c.id, order: i })))
      .catch(() => this.toast.error('Error al reordenar categorías'));
  }
}
