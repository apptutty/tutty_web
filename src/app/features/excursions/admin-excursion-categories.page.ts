import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExcursionsService } from './excursions.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { ExcursionCategoryAdmin } from '../../core/supabase/database.types';

@Component({
  selector: 'app-excursion-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent],
  template: `
    <app-page-header title="Categorías de excursiones" subtitle="Gestión de categorías turísticas">
      <button class="btn-primary" (click)="openForm()">+ Nueva categoría</button>
    </app-page-header>

    <div class="bg-white rounded-xl border border-gray-200 shadow-theme-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Icono</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Slug</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Orden</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-100">
            @if (loading()) {
              @for (i of [1,2,3,4]; track i) {
                <tr class="animate-pulse">
                  @for (j of [1,2,3,4,5,6]; track j) {
                    <td class="px-4 py-3"><div class="h-4 bg-gray-200 rounded w-3/4"></div></td>
                  }
                </tr>
              }
            } @else if (categories().length === 0) {
              <tr>
                <td colspan="6" class="px-4 py-12 text-center text-gray-400">
                  <p class="text-3xl mb-2">🏷️</p>
                  <p class="text-sm">Sin categorías creadas</p>
                </td>
              </tr>
            } @else {
              @for (cat of categories(); track cat.id) {
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-3 text-2xl">{{ cat.icon ?? '🏷️' }}</td>
                  <td class="px-4 py-3 text-sm font-medium text-gray-800">{{ cat.name }}</td>
                  <td class="px-4 py-3 text-xs font-mono text-gray-500">{{ cat.slug }}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">{{ cat.display_order }}</td>
                  <td class="px-4 py-3">
                    <button
                      class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full transition-colors"
                      [class]="cat.is_active ? 'bg-success-50 text-success-700 hover:bg-success-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
                      (click)="toggleActive(cat)">
                      {{ cat.is_active ? '● Activa' : '○ Inactiva' }}
                    </button>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex gap-1">
                      <button class="btn-secondary px-2 py-1 text-xs" (click)="openForm(cat)">Editar</button>
                      <button class="px-2 py-1 text-xs rounded-lg bg-error-50 text-error-700 hover:bg-error-100" (click)="confirmDelete(cat)">Eliminar</button>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Form Modal -->
    @if (showForm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="showForm.set(false)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
          <h3 class="font-semibold text-gray-800 mb-4">{{ editing() ? 'Editar categoría' : 'Nueva categoría' }}</h3>
          <div class="space-y-4">
            <div><label class="label">Nombre *</label><input class="input-field" [(ngModel)]="form.name" /></div>
            <div><label class="label">Slug *</label><input class="input-field font-mono" [(ngModel)]="form.slug" /></div>
            <div><label class="label">Icono (emoji)</label><input class="input-field w-20 text-xl text-center" [(ngModel)]="form.icon" /></div>
            <div><label class="label">Orden de visualización</label><input type="number" class="input-field" [(ngModel)]="form.display_order" min="0" /></div>
            <div class="flex items-center gap-3">
              <input type="checkbox" id="catActive" [(ngModel)]="form.is_active" class="w-4 h-4 text-brand-600" />
              <label for="catActive" class="text-sm text-gray-700">Activa</label>
            </div>
          </div>
          <div class="flex gap-3 justify-end mt-6">
            <button class="btn-secondary" (click)="showForm.set(false)">Cancelar</button>
            <button class="btn-primary" [disabled]="!form.name || !form.slug || saveLoading()" (click)="save()">
              {{ saveLoading() ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Delete Confirm Modal -->
    @if (deletingId()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="deletingId.set(null)"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10">
          <h3 class="font-semibold text-gray-800 mb-2">Eliminar categoría</h3>
          <p class="text-sm text-gray-500 mb-4">¿Eliminar "{{ deletingName }}"? Las excursiones asociadas quedarán sin categoría.</p>
          <div class="flex gap-3 justify-end">
            <button class="btn-secondary" (click)="deletingId.set(null)">Cancelar</button>
            <button class="btn-danger" [disabled]="saveLoading()" (click)="deleteCategory()">
              {{ saveLoading() ? 'Eliminando...' : 'Eliminar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AdminExcursionCategoriesPageComponent implements OnInit {
  private readonly service = inject(ExcursionsService);
  private readonly toastService = inject(ToastService);

  readonly categories = signal<ExcursionCategoryAdmin[]>([]);
  readonly loading = signal(true);
  readonly saveLoading = signal(false);
  readonly showForm = signal(false);
  readonly editing = signal<ExcursionCategoryAdmin | null>(null);
  readonly deletingId = signal<string | null>(null);
  deletingName = '';

  form: Partial<ExcursionCategoryAdmin> = { name: '', slug: '', icon: '', display_order: 0, is_active: true };

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.service.getCategories().subscribe({
      next: list => { this.categories.set(list); this.loading.set(false); },
      error: () => { this.toastService.error('Error al cargar categorías'); this.loading.set(false); },
    });
  }

  openForm(cat?: ExcursionCategoryAdmin): void {
    this.editing.set(cat ?? null);
    this.form = cat ? { ...cat } : { name: '', slug: '', icon: '', display_order: this.categories().length, is_active: true };
    this.showForm.set(true);
  }

  async save(): Promise<void> {
    if (!this.form.name || !this.form.slug) return;
    this.saveLoading.set(true);
    try {
      await this.service.saveCategory(this.form);
      this.toastService.success('Categoría guardada');
      this.showForm.set(false);
      this.load();
    } catch { this.toastService.error('Error al guardar'); }
    finally { this.saveLoading.set(false); }
  }

  confirmDelete(cat: ExcursionCategoryAdmin): void {
    this.deletingId.set(cat.id);
    this.deletingName = cat.name;
  }

  async deleteCategory(): Promise<void> {
    if (!this.deletingId()) return;
    this.saveLoading.set(true);
    try {
      await this.service.deleteCategory(this.deletingId()!);
      this.toastService.success('Categoría eliminada');
      this.deletingId.set(null);
      this.load();
    } catch { this.toastService.error('Error al eliminar'); }
    finally { this.saveLoading.set(false); }
  }

  async toggleActive(cat: ExcursionCategoryAdmin): Promise<void> {
    try {
      await this.service.saveCategory({ id: cat.id, is_active: !cat.is_active });
      this.categories.update(list => list.map(c => c.id === cat.id ? { ...c, is_active: !c.is_active } : c));
    } catch { this.toastService.error('Error al actualizar'); }
  }
}
