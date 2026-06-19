import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ExcursionsService } from './excursions.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PageHeaderComponent } from '../../layout/admin-shell/page-header.component';
import { StatCardComponent } from '../../shared/ui/stat-card/stat-card.component';
import { ExcursionStats } from '../../core/supabase/database.types';

@Component({
  selector: 'app-excursions-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent, StatCardComponent],
  template: `
    <app-page-header title="Excursiones" subtitle="Panel de control del módulo de turismo">
      <a routerLink="/excursions" class="btn-primary">Ver módulo completo →</a>
    </app-page-header>

    @if (loading()) {
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        @for (i of [1,2,3,4,5,6,7,8]; track i) {
          <div class="bg-white rounded-xl border border-gray-200 p-5 animate-pulse h-28"></div>
        }
      </div>
    } @else if (stats()) {
      <!-- Operators -->
      <div class="mb-6">
        <h2 class="text-sm font-semibold text-gray-400 uppercase mb-3">Operadores</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <app-stat-card title="Total operadores" [value]="stats()!.totalOperators" icon="🏢" color="blue" />
          <app-stat-card title="Pendientes" [value]="stats()!.pendingOperators" icon="⏳" color="yellow" />
          <app-stat-card title="Aprobados" [value]="stats()!.approvedOperators" icon="✅" color="green" />
        </div>
      </div>

      <!-- Excursions -->
      <div class="mb-6">
        <h2 class="text-sm font-semibold text-gray-400 uppercase mb-3">Excursiones</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <app-stat-card title="Total excursiones" [value]="stats()!.totalExcursions" icon="🏔️" color="blue" />
          <app-stat-card title="Activas" [value]="stats()!.activeExcursions" icon="✅" color="green" />
          <app-stat-card title="Salidas próximas" [value]="stats()!.upcomingDepartures" icon="🗓️" color="purple" />
          <app-stat-card title="Cupos bajos" [value]="stats()!.lowSpotsCount" icon="⚠️" color="red" />
        </div>
      </div>

      <!-- Bookings -->
      <div class="mb-6">
        <h2 class="text-sm font-semibold text-gray-400 uppercase mb-3">Reservas</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <app-stat-card title="Total reservas" [value]="stats()!.totalBookings" icon="🎫" color="blue" />
          <app-stat-card title="Pendientes" [value]="stats()!.pendingBookings" icon="⏳" color="yellow" />
          <app-stat-card title="Confirmadas" [value]="stats()!.confirmedBookings" icon="✅" color="green" />
          <app-stat-card title="Canceladas" [value]="stats()!.cancelledBookings" icon="✗" color="red" />
          <app-stat-card title="Completadas" [value]="stats()!.completedBookings" icon="🏁" color="purple" />
          <app-stat-card title="Ingresos (confirmadas)" [value]="'RD$ ' + stats()!.totalRevenue.toLocaleString('es-DO', {maximumFractionDigits: 0})" icon="💰" color="green" />
        </div>
      </div>

      <!-- Quick links -->
      <div class="mb-2">
        <h2 class="text-sm font-semibold text-gray-400 uppercase mb-3">Acceso rápido</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <a routerLink="/excursions" [queryParams]="{tab: 'operadores'}" class="card p-4 text-center hover:border-brand-300 transition-colors cursor-pointer">
            <p class="text-2xl mb-1">🏢</p>
            <p class="text-sm font-medium text-gray-700">Operadores</p>
          </a>
          <a routerLink="/excursions" [queryParams]="{tab: 'excursiones'}" class="card p-4 text-center hover:border-brand-300 transition-colors cursor-pointer">
            <p class="text-2xl mb-1">🏔️</p>
            <p class="text-sm font-medium text-gray-700">Excursiones</p>
          </a>
          <a routerLink="/excursions" [queryParams]="{tab: 'reservas'}" class="card p-4 text-center hover:border-brand-300 transition-colors cursor-pointer">
            <p class="text-2xl mb-1">🎫</p>
            <p class="text-sm font-medium text-gray-700">Reservas</p>
          </a>
          <a routerLink="/excursions" [queryParams]="{tab: 'categorias'}" class="card p-4 text-center hover:border-brand-300 transition-colors cursor-pointer">
            <p class="text-2xl mb-1">🏷️</p>
            <p class="text-sm font-medium text-gray-700">Categorías</p>
          </a>
        </div>
      </div>
    } @else {
      <div class="card p-12 text-center text-gray-400">
        <p class="text-3xl mb-2">🏔️</p>
        <p>No se pudieron cargar las estadísticas</p>
        <button class="btn-secondary mt-4 text-sm" (click)="load()">Reintentar</button>
      </div>
    }
  `,
})
export class ExcursionsDashboardPageComponent implements OnInit {
  private readonly service = inject(ExcursionsService);
  private readonly toastService = inject(ToastService);

  readonly stats = signal<ExcursionStats | null>(null);
  readonly loading = signal(true);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.service.getExcursionStats().subscribe({
      next: s => { this.stats.set(s); this.loading.set(false); },
      error: () => { this.toastService.error('Error al cargar estadísticas'); this.loading.set(false); },
    });
  }
}
