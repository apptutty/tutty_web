import { Routes } from '@angular/router';
import { authGuard, noAuthGuard } from './core/auth/auth.guard';
import { AdminShellComponent } from './layout/admin-shell/admin-shell.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.page').then(m => m.LoginPageComponent),
    canActivate: [noAuthGuard],
  },
  {
    path: '',
    component: AdminShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.page').then(m => m.DashboardPageComponent),
      },
      {
        path: 'orders',
        loadComponent: () => import('./features/orders/orders.page').then(m => m.OrdersPageComponent),
      },
      {
        path: 'orders/:id',
        loadComponent: () => import('./features/orders/order-detail.page').then(m => m.OrderDetailPageComponent),
      },
      {
        path: 'approvals',
        loadComponent: () => import('./features/approvals/approval-queue.page').then(m => m.ApprovalQueuePageComponent),
      },
      {
        path: 'restaurants',
        loadComponent: () => import('./features/restaurants/restaurants.page').then(m => m.RestaurantsPageComponent),
      },
      {
        path: 'restaurants/:id/menu',
        loadComponent: () => import('./features/restaurants/menu-manager.page').then(m => m.MenuManagerPageComponent),
      },
      {
        path: 'restaurants/:id/zones',
        loadComponent: () => import('./features/restaurants/delivery-zones.page').then(m => m.DeliveryZonesPageComponent),
      },
      {
        path: 'stores',
        loadComponent: () => import('./features/stores/stores.page').then(m => m.StoresPageComponent),
      },
      {
        path: 'stores/:id',
        loadComponent: () => import('./features/stores/store-detail.page').then(m => m.StoreDetailPageComponent),
      },
      {
        path: 'stores/:id/catalog',
        loadComponent: () => import('./features/stores/global-catalog-override.page').then(m => m.GlobalCatalogOverrideComponent),
      },
      {
        path: 'excursions',
        loadComponent: () => import('./features/excursions/excursions.page').then(m => m.ExcursionsPageComponent),
      },
      {
        path: 'couriers',
        loadComponent: () => import('./features/couriers/couriers.page').then(m => m.CouriersPageComponent),
      },
      {
        path: 'couriers/:id',
        loadComponent: () => import('./features/couriers/courier-detail.page').then(m => m.CourierDetailPageComponent),
      },
      {
        path: 'promotions',
        loadComponent: () => import('./features/promotions/promotions.page').then(m => m.PromotionsPageComponent),
      },
      {
        path: 'reports',
        loadComponent: () => import('./features/reports/reports.page').then(m => m.ReportsPageComponent),
      },
      {
        path: 'finances',
        loadComponent: () => import('./features/finances/finances.page').then(m => m.FinancesPageComponent),
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings.page').then(m => m.SettingsPageComponent),
      },
    ],
  },
  {
    path: 'register',
    loadComponent: () => import('./features/register/register-shell.component').then(m => m.RegisterShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/register/steps/step-type.component').then(m => m.RegisterStepTypeComponent),
      },
      {
        path: 'info',
        loadComponent: () => import('./features/register/steps/step-info.component').then(m => m.RegisterStepInfoComponent),
      },
      {
        path: 'details',
        loadComponent: () => import('./features/register/steps/step-details.component').then(m => m.RegisterStepDetailsComponent),
      },
      {
        path: 'account',
        loadComponent: () => import('./features/register/steps/step-account.component').then(m => m.RegisterStepAccountComponent),
      },
      {
        path: 'pending',
        loadComponent: () => import('./features/register/register-pending.component').then(m => m.RegisterPendingComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

