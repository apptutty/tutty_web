import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { RestaurantsService } from './restaurants.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../shared/ui/modal/confirm.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { MenuCategory, MenuItem } from '../../core/supabase/database.types';
import { AdminEmptyStateComponent } from '../../shared/ui/admin-empty-state/admin-empty-state.component';

@Component({
  selector: 'app-menu-manager-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PageHeaderComponent, AdminEmptyStateComponent],
  template: `
    <app-page-header [title]="'Menú — ' + commerceId" subtitle="Gestión de categorías e ítems">
      <button class="btn-secondary" (click)="openCategoryModal()">+ Categoría</button>
    </app-page-header>

    <div class="flex gap-4 h-[calc(100vh-160px)]">
      <!-- Categories panel -->
      <div class="w-64 flex-shrink-0 card !p-0 overflow-y-auto">
        <div class="p-4 border-b border-gray-200">
          <h3 class="text-sm font-semibold text-gray-800">Categorías</h3>
        </div>
        <ul class="divide-y divide-gray-100">
          @for (cat of categories(); track cat.id) {
            <li>
              <button
                class="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between"
                [class.bg-brand-50]="selectedCategoryId() === cat.id"
                [class.text-brand-700]="selectedCategoryId() === cat.id"
                (click)="selectCategory(cat.id)"
              >
                <span class="font-medium truncate">{{ cat.name }}</span>
                <span class="text-xs px-1.5 py-0.5 rounded-full"
                  [class]="cat.is_active ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-500'">
                  {{ cat.is_active ? 'Activa' : 'Inactiva' }}
                </span>
              </button>
            </li>
          }
          @if (categories().length === 0 && !categoriesLoading()) {
            <li class="px-3 py-3">
              <app-admin-empty-state
                icon="search"
                title="Sin categorías"
                description="Crea una categoría para empezar."
                variant="soft" />
            </li>
          }
        </ul>
      </div>

      <!-- Items panel -->
      <div class="flex-1 overflow-hidden flex flex-col gap-3">
        @if (selectedCategoryId()) {
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium text-gray-600">
              {{ selectedCategory()?.name }} — {{ items().length }} ítems
            </p>
            <button class="btn-primary" (click)="openItemModal()">+ Nuevo ítem</button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto pb-4">
            @for (item of items(); track item.id) {
              <div class="card !p-4 flex flex-col gap-2">
                @if (item.photo_url) {
                  <img [src]="item.photo_url" class="w-full h-28 object-cover rounded-lg" />
                }
                <div class="flex items-start justify-between gap-2">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-gray-800 truncate">{{ item.name }}</p>
                    <p class="text-xs text-gray-500 line-clamp-2">{{ item.description }}</p>
                  </div>
                  <div class="flex flex-col items-end flex-shrink-0">
                    <p class="text-sm font-bold text-gray-800">RD$ {{ item.price }}</p>
                    @if (item.discount_price) {
                      <p class="text-xs text-success-600 line-through">RD$ {{ item.discount_price }}</p>
                    }
                  </div>
                </div>
                <div class="flex items-center gap-1 flex-wrap">
                  @if (item.is_featured) { <span class="text-xs bg-warning-50 text-warning-700 px-1.5 py-0.5 rounded-full">Destacado</span> }
                  @if (item.track_stock && item.stock_count === 0) { <span class="text-xs bg-error-50 text-error-700 px-1.5 py-0.5 rounded-full">Sin stock</span> }
                  <span class="text-xs px-1.5 py-0.5 rounded-full ml-auto"
                    [class]="item.is_available ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-500'">
                    {{ item.is_available ? 'Disponible' : 'No disponible' }}
                  </span>
                </div>
                <div class="flex gap-1 pt-1 border-t border-gray-100">
                  <button class="btn-secondary flex-1 py-1 text-xs" (click)="openItemModal(item)">Editar</button>
                  <button class="btn-danger py-1 px-2 text-xs" (click)="deleteItem(item)">🗑</button>
                </div>
              </div>
            }
            @if (items().length === 0 && !itemsLoading()) {
              <div class="sm:col-span-2 xl:col-span-3 py-6">
                <app-admin-empty-state
                  icon="search"
                  title="Sin ítems en esta categoría"
                  description="Agrega un nuevo ítem para comenzar."
                  variant="soft" />
              </div>
            }
          </div>
        } @else {
          <div class="flex-1 flex items-center justify-center px-6">
            <app-admin-empty-state
              icon="search"
              title="Selecciona una categoría"
              description="Elige una categoría para administrar sus ítems."
              variant="soft" />
          </div>
        }
      </div>
    </div>

    <!-- Category modal -->
    @if (showCategoryModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="showCategoryModal.set(false)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10">
          <h3 class="font-semibold text-gray-800 mb-4">Nueva categoría</h3>
          <div class="space-y-4">
            <div>
              <label class="label">Nombre *</label>
              <input class="input-field" [(ngModel)]="categoryName" placeholder="Ej: Hamburguesas" />
            </div>
          </div>
          <div class="flex gap-3 justify-end mt-6">
            <button class="btn-secondary" (click)="showCategoryModal.set(false)">Cancelar</button>
            <button class="btn-primary" [disabled]="!categoryName.trim()" (click)="saveCategory()">Guardar</button>
          </div>
        </div>
      </div>
    }

    <!-- Item modal -->
    @if (showItemModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="showItemModal.set(false)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto z-10">
          <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between">
            <h3 class="font-semibold text-gray-800">{{ editingItem() ? 'Editar ítem' : 'Nuevo ítem' }}</h3>
            <button class="text-gray-400 hover:text-gray-600" (click)="showItemModal.set(false)">✕</button>
          </div>
          <form [formGroup]="itemForm" (ngSubmit)="saveItem()" class="p-6 space-y-4">
            <div>
              <label class="label">Nombre *</label>
              <input class="input-field" formControlName="name" />
            </div>
            <div>
              <label class="label">Descripción</label>
              <textarea class="input-field resize-none" rows="2" formControlName="description"></textarea>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">Precio (RD$) *</label>
                <input class="input-field" type="number" formControlName="price" />
              </div>
              <div>
                <label class="label">Precio descuento</label>
                <input class="input-field" type="number" formControlName="discount_price" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">Tiempo prep. (min)</label>
                <input class="input-field" type="number" formControlName="preparation_time" />
              </div>
              <div class="flex items-center gap-3 pt-5">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" formControlName="is_featured" class="rounded" />
                  <span class="text-sm text-gray-700">Destacado</span>
                </label>
              </div>
            </div>
            <div class="flex items-center gap-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" formControlName="is_available" class="rounded" />
                <span class="text-sm text-gray-700">Disponible</span>
              </label>
            </div>
            <div class="flex gap-3 justify-end pt-2">
              <button type="button" class="btn-secondary" (click)="showItemModal.set(false)">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="itemForm.invalid">
                Guardar
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class MenuManagerPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(RestaurantsService);
  private readonly toastService = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  readonly commerceId = this.route.snapshot.paramMap.get('id')!;

  readonly categories = signal<MenuCategory[]>([]);
  readonly items = signal<MenuItem[]>([]);
  readonly selectedCategoryId = signal<string | null>(null);
  readonly categoriesLoading = signal(true);
  readonly itemsLoading = signal(false);
  readonly showCategoryModal = signal(false);
  readonly showItemModal = signal(false);
  readonly editingItem = signal<MenuItem | null>(null);

  categoryName = '';

  readonly selectedCategory = () => this.categories().find(c => c.id === this.selectedCategoryId());

  readonly itemForm = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    price: [0, [Validators.required, Validators.min(0)]],
    discount_price: [null as number | null],
    preparation_time: [15],
    is_available: [true],
    is_featured: [false],
  });

  ngOnInit(): void { this.loadCategories(); }

  loadCategories(): void {
    this.service.getCategories(this.commerceId).subscribe(cats => {
      this.categories.set(cats);
      this.categoriesLoading.set(false);
    });
  }

  selectCategory(id: string): void {
    this.selectedCategoryId.set(id);
    this.itemsLoading.set(true);
    this.service.getMenuItems(id).subscribe(items => {
      this.items.set(items);
      this.itemsLoading.set(false);
    });
  }

  openCategoryModal(): void {
    this.categoryName = '';
    this.showCategoryModal.set(true);
  }

  async saveCategory(): Promise<void> {
    if (!this.categoryName.trim()) return;
    try {
      await this.service.saveCategory({
        commerce_id: this.commerceId,
        name: this.categoryName.trim(),
        display_order: this.categories().length,
        is_active: true,
      });
      this.toastService.success('Categoría creada');
      this.showCategoryModal.set(false);
      this.loadCategories();
    } catch { this.toastService.error('Error al guardar categoría'); }
  }

  openItemModal(item?: MenuItem): void {
    this.editingItem.set(item ?? null);
    if (item) {
      this.itemForm.patchValue(item as any);
    } else {
      this.itemForm.reset({ is_available: true, is_featured: false, preparation_time: 15, price: 0 });
    }
    this.showItemModal.set(true);
  }

  async saveItem(): Promise<void> {
    if (this.itemForm.invalid) return;
    const val = this.itemForm.getRawValue();
    const payload: Partial<MenuItem> = {
      ...(this.editingItem() ? { id: this.editingItem()!.id } : {}),
      commerce_id: this.commerceId,
      category_id: this.selectedCategoryId()!,
      name: val.name!,
      description: val.description ?? null,
      price: val.price ?? 0,
      discount_price: val.discount_price ?? null,
      preparation_time: val.preparation_time ?? 15,
      is_available: val.is_available ?? true,
      is_featured: val.is_featured ?? false,
      display_order: this.items().length,
      tags: [],
      has_variants: false,
      track_stock: false,
    };
    try {
      await this.service.saveMenuItem(payload);
      this.toastService.success(this.editingItem() ? 'Ítem actualizado' : 'Ítem creado');
      this.showItemModal.set(false);
      if (this.selectedCategoryId()) this.selectCategory(this.selectedCategoryId()!);
    } catch { this.toastService.error('Error al guardar ítem'); }
  }

  async deleteItem(item: MenuItem): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: '¿Eliminar ítem?',
      message: `Se eliminará "${item.name}" permanentemente.`,
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.service.deleteMenuItem(item.id);
      this.toastService.success('Ítem eliminado');
      if (this.selectedCategoryId()) this.selectCategory(this.selectedCategoryId()!);
    } catch { this.toastService.error('Error al eliminar'); }
  }
}
