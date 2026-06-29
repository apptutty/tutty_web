import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService, AdminUser } from '../settings.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AdminEmptyStateComponent } from '../../../shared/ui/admin-empty-state/admin-empty-state.component';

@Component({
  selector: 'app-settings-users',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminEmptyStateComponent],
  template: `
    <div class="max-w-6xl">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900">Usuarios Administradores</h3>
        <button class="btn-primary text-sm" (click)="openForm()">+ Nuevo Usuario</button>
      </div>

      @if (loading()) {
        <div class="card p-6 space-y-3">
          @for (i of skeleton3; track i) {
            <div class="animate-pulse h-14 bg-gray-200 rounded"></div>
          }
        </div>
      } @else {
        <div class="admin-table-card">
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
              @if (users().length === 0) {
                <tr>
                  <td colspan="5" class="px-6 py-6">
                    <app-admin-empty-state
                      icon="users"
                      title="Sin usuarios administradores"
                      description="Crea el primer usuario para comenzar la gestión."
                      variant="soft" />
                  </td>
                </tr>
              } @else {
                @for (u of users(); track u.id) {
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
                      <button class="text-sm text-brand-500 hover:text-brand-700" (click)="toggle(u)">
                        {{ u.is_active ? 'Desactivar' : 'Activar' }}
                      </button>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    @if (showModal()) {
      <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="admin-modal w-full max-w-md">
          <div class="admin-modal__header">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="text-lg font-semibold mb-0">Nuevo Usuario Admin</h3>
                <p class="text-sm text-gray-500 mt-1">Asigna perfil de acceso y credenciales temporales.</p>
              </div>
              <button type="button" class="admin-icon-btn" aria-label="Cerrar modal de usuario" (click)="showModal.set(false)">✕</button>
            </div>
          </div>
          <form (ngSubmit)="create()" class="admin-modal__body space-y-4">
            <div>
              <label class="label">Nombre Completo</label>
              <input type="text" class="input-field" [(ngModel)]="form.full_name" name="full_name" required />
            </div>
            <div>
              <label class="label">Email</label>
              <input type="email" class="input-field" [(ngModel)]="form.email" name="email" required />
            </div>
            <div>
              <label class="label">Contraseña Temporal</label>
              <input type="password" class="input-field" [(ngModel)]="form.password" name="password" required minlength="8" />
            </div>
            <div>
              <label class="label">Rol</label>
              <select class="input-field" [(ngModel)]="form.role" name="role" required>
                <option value="super_admin">Superadmin</option>
                <option value="restaurant_admin">Admin Restaurante</option>
                <option value="excursion_operator">Admin Operadora</option>
                <option value="store_admin">Admin Tienda</option>
              </select>
            </div>
            @if (createError()) {
              <p class="text-sm text-error-600">{{ createError() }}</p>
            }
            <div class="admin-modal__footer">
              <button type="button" class="btn-secondary flex-1" (click)="showModal.set(false)">Cancelar</button>
              <button type="submit" class="btn-primary flex-1" [disabled]="creating()">
                {{ creating() ? 'Creando...' : 'Crear Usuario' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class UsersPageComponent implements OnInit {
  private readonly svc = inject(SettingsService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly creating = signal(false);
  readonly users = signal<AdminUser[]>([]);
  readonly showModal = signal(false);
  readonly createError = signal('');
  readonly skeleton3 = [1, 2, 3];
  form = { full_name: '', email: '', password: '', role: 'restaurant_admin' };

  readonly roleLabels: Record<string, string> = {
    super_admin: 'Superadmin',
    restaurant_admin: 'Admin Restaurante',
    excursion_operator: 'Admin Operadora',
    store_admin: 'Admin Tienda',
  };

  ngOnInit() { this.load(); }

  private async load() {
    this.loading.set(true);
    try {
      this.users.set(await this.svc.getAdminUsers());
    } catch { } finally { this.loading.set(false); }
  }

  openForm() {
    this.form = { full_name: '', email: '', password: '', role: 'restaurant_admin' };
    this.createError.set('');
    this.showModal.set(true);
  }

  async create() {
    this.creating.set(true);
    this.createError.set('');
    try {
      await this.svc.createAdminUser(this.form);
      this.toast.success('Usuario creado exitosamente');
      this.showModal.set(false);
      this.load();
    } catch (e: unknown) {
      this.createError.set((e as Error)?.message ?? 'Error al crear usuario');
    } finally { this.creating.set(false); }
  }

  async toggle(u: AdminUser) {
    try {
      await this.svc.toggleAdminUser(u.id, !u.is_active);
      this.toast.success(`Usuario ${!u.is_active ? 'activado' : 'desactivado'}`);
      this.load();
    } catch { this.toast.error('Error al actualizar usuario'); }
  }
}
