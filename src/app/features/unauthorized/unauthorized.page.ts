import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
    selector: 'app-unauthorized-page',
    standalone: true,
    template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div class="text-center max-w-md">
        <div class="w-20 h-20 mx-auto mb-6 rounded-2xl bg-error-50 flex items-center justify-center">
          <svg class="w-10 h-10 text-error-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p class="text-gray-500 mb-6">
          You don't have permission to view this page.<br />
          Contact your administrator if you believe this is an error.
        </p>
        <div class="flex gap-3 justify-center">
          <button
            class="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-medium text-sm transition-colors"
            (click)="goHome()"
          >
            Go to Dashboard
          </button>
          <button
            class="px-5 py-2.5 border border-gray-300 hover:border-gray-400 text-gray-700 rounded-xl font-medium text-sm transition-colors"
            (click)="logout()"
          >
            Sign Out
          </button>
        </div>
        <p class="mt-6 text-xs text-gray-400">
          Signed in as <span class="font-medium">{{ userEmail() }}</span>
          &middot; Role: <span class="font-medium">{{ userRole() }}</span>
        </p>
      </div>
    </div>
  `,
})
export class UnauthorizedPageComponent {
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);

    userEmail = () => this.auth.currentUser()?.email ?? '—';
    userRole = () => this.auth.currentUser()?.role ?? '—';

    goHome(): void {
        const role = this.auth.currentUser()?.role;
        if (role === 'store_admin') this.router.navigate(['/store']);
        else if (role === 'excursion_operator') this.router.navigate(['/operator']);
        else this.router.navigate(['/dashboard']);
    }

    async logout(): Promise<void> {
        await this.auth.signOut();
    }
}
