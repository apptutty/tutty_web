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
                path: 'excursions',
                loadComponent: () => import('./features/excursions/excursions.page').then(m => m.ExcursionsPageComponent),
            },
            {
                path: 'repartidores',
                loadComponent: () => import('./features/repartidores/repartidores.page').then(m => m.RepartidoresPageComponent),
            },
            {
                path: 'repartidores/:id',
                loadComponent: () => import('./features/repartidores/repartidor-detail.page').then(m => m.RepartidorDetailPageComponent),
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
                path: 'settings',
                loadComponent: () => import('./features/settings/settings.page').then(m => m.SettingsPageComponent),
            },
        ],
    },
    { path: '**', redirectTo: '' },
];

