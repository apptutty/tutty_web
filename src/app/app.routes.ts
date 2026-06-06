import { Routes } from '@angular/router';
import { authGuard, noAuthGuard } from './core/auth/auth.guard';
import { storeApprovedGuard } from './core/auth/store-approved.guard';
import { operatorApprovedGuard } from './core/auth/operator-approved.guard';
import { operatorGuard } from './core/auth/operator.guard';
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
    canActivate: [authGuard, operatorGuard],
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
        path: 'support',
        loadComponent: () => import('./features/support/support.page').then(m => m.SupportPageComponent),
      },
      {
        path: 'support-dashboard',
        loadComponent: () => import('./features/support/support-dashboard.page').then(m => m.SupportDashboardPageComponent),
      },
      {
        path: 'support/templates',
        loadComponent: () => import('./features/support/templates/ticket-templates.page').then(m => m.TicketTemplatesPageComponent),
      },
      {
        path: 'catalog',
        loadComponent: () => import('./features/catalog-admin/catalog-manager.page').then(m => m.CatalogManagerPageComponent),
      },
      {
        path: 'catalog/search',
        loadComponent: () => import('./features/catalog-admin/catalog-global-search.page').then(m => m.CatalogGlobalSearchPageComponent),
      },
      {
        path: 'catalog/price-approvals',
        loadComponent: () => import('./features/catalog-admin/price-approval-dashboard.page').then(m => m.PriceApprovalDashboardComponent),
      },
      {
        path: 'catalog/:storeId',
        loadComponent: () => import('./features/catalog-admin/store-product-manager.page').then(m => m.StoreProductManagerPageComponent),
      },
      {
        path: 'catalog/:storeId/products/new',
        loadComponent: () => import('./features/catalog-admin/product-form.page').then(m => m.ProductFormPageComponent),
      },
      {
        path: 'catalog/:storeId/products/:productId',
        loadComponent: () => import('./features/catalog-admin/product-form.page').then(m => m.ProductFormPageComponent),
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings-shell.component').then(m => m.SettingsShellComponent),
        children: [
          { path: '', redirectTo: 'general', pathMatch: 'full' },
          { path: 'general', loadComponent: () => import('./features/settings/pages/general.page').then(m => m.GeneralSettingsPageComponent) },
          { path: 'delivery', loadComponent: () => import('./features/settings/pages/delivery.page').then(m => m.DeliverySettingsPageComponent) },
          { path: 'feriados', loadComponent: () => import('./features/settings/pages/holidays.page').then(m => m.HolidaysPageComponent) },
          { path: 'notificaciones', loadComponent: () => import('./features/settings/pages/notifications.page').then(m => m.NotificationsSettingsPageComponent) },
          { path: 'usuarios', loadComponent: () => import('./features/settings/pages/users.page').then(m => m.UsersPageComponent) },
          { path: 'comercios', loadComponent: () => import('./features/settings/pages/commerce.page').then(m => m.CommercePageComponent) },
          { path: 'categorias', loadComponent: () => import('./features/settings/pages/categories.page').then(m => m.CategoriesPageComponent) },
          { path: 'auditoria', loadComponent: () => import('./features/settings/pages/audit.page').then(m => m.AuditPageComponent) },
          { path: 'surcharge', loadComponent: () => import('./features/settings/pages/surcharge.page').then(m => m.SurchargePageComponent) },
        ],
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
  {
    path: 'store',
    loadComponent: () => import('./features/store-admin/store-admin-shell.component').then(m => m.StoreAdminShellComponent),
    canActivate: [authGuard, storeApprovedGuard],
    children: [
      { path: 'dashboard', loadComponent: () => import('./features/store-admin/dashboard/store-dashboard.page').then(m => m.StoreDashboardPageComponent) },
      { path: 'orders', loadComponent: () => import('./features/store-admin/orders/store-orders.page').then(m => m.StoreOrdersPageComponent) },
      { path: 'orders/:id', loadComponent: () => import('./features/store-admin/orders/store-order-detail.page').then(m => m.StoreOrderDetailPageComponent) },
      { path: 'catalog', loadComponent: () => import('./features/store-admin/catalog/store-catalog.page').then(m => m.StoreCatalogPageComponent) },
      { path: 'catalog/new', loadComponent: () => import('./features/store-admin/catalog/store-product-form.page').then(m => m.StoreProductFormPageComponent) },
      { path: 'catalog/:id', loadComponent: () => import('./features/store-admin/catalog/store-product-form.page').then(m => m.StoreProductFormPageComponent) },
      { path: 'zones', loadComponent: () => import('./features/store-admin/zones/store-zones.page').then(m => m.StoreZonesPageComponent) },
      { path: 'promotions', loadComponent: () => import('./features/store-admin/promotions/store-promotions.page').then(m => m.StorePromotionsPageComponent) },
      { path: 'reviews', loadComponent: () => import('./features/store-admin/reviews/store-reviews.page').then(m => m.StoreReviewsPageComponent) },
      { path: 'reports', loadComponent: () => import('./features/store-admin/reports/store-reports.page').then(m => m.StoreReportsPageComponent) },
      { path: 'settings', loadComponent: () => import('./features/store-admin/settings/store-settings.page').then(m => m.StoreSettingsPageComponent) },
      { path: 'select-store', loadComponent: () => import('./features/store-admin/store-select.page').then(m => m.StoreSelectPageComponent) },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  {
    path: 'register/operator',
    loadComponent: () => import('./features/operator-register/operator-register-shell.component').then(m => m.OperatorRegisterShellComponent),
    children: [
      { path: '', loadComponent: () => import('./features/operator-register/steps/operator-step1.component').then(m => m.OperatorStep1Component) },
      { path: 'tours', loadComponent: () => import('./features/operator-register/steps/operator-step2.component').then(m => m.OperatorStep2Component) },
      { path: 'account', loadComponent: () => import('./features/operator-register/steps/operator-step3.component').then(m => m.OperatorStep3Component) },
      { path: 'pending', loadComponent: () => import('./features/operator-register/operator-pending.component').then(m => m.OperatorPendingComponent) },
    ],
  },
  {
    path: 'operator',
    loadComponent: () => import('./features/operator-admin/operator-shell.component').then(m => m.OperatorShellComponent),
    canActivate: [authGuard, operatorApprovedGuard],
    children: [
      { path: 'dashboard', loadComponent: () => import('./features/operator-admin/dashboard/operator-dashboard.page').then(m => m.OperatorDashboardPageComponent) },
      { path: 'excursions', loadComponent: () => import('./features/operator-admin/excursions/excursions-list.page').then(m => m.ExcursionsListPageComponent) },
      { path: 'excursions/new', loadComponent: () => import('./features/operator-admin/excursions/excursion-form.page').then(m => m.ExcursionFormPageComponent) },
      { path: 'excursions/:id', loadComponent: () => import('./features/operator-admin/excursions/excursion-detail.page').then(m => m.ExcursionDetailPageComponent) },
      { path: 'excursions/:id/edit', loadComponent: () => import('./features/operator-admin/excursions/excursion-form.page').then(m => m.ExcursionFormPageComponent) },
      { path: 'excursions/:id/dates', loadComponent: () => import('./features/operator-admin/excursions/excursion-dates.page').then(m => m.ExcursionDatesPageComponent) },
      { path: 'bookings', loadComponent: () => import('./features/operator-admin/bookings/operator-bookings.page').then(m => m.OperatorBookingsPageComponent) },
      { path: 'bookings/:id', loadComponent: () => import('./features/operator-admin/bookings/booking-detail.page').then(m => m.BookingDetailPageComponent) },
      { path: 'calendar', loadComponent: () => import('./features/operator-admin/calendar/operator-calendar.page').then(m => m.OperatorCalendarPageComponent) },
      { path: 'reports', loadComponent: () => import('./features/operator-admin/reports/operator-reports.page').then(m => m.OperatorReportsPageComponent) },
      { path: 'settings', loadComponent: () => import('./features/operator-admin/settings/operator-settings.page').then(m => m.OperatorSettingsPageComponent) },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '' },
];

