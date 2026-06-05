import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { getSupabaseClient } from '../supabase/supabase.client';
import { User, UserRole } from './user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly supabase = getSupabaseClient();
    private readonly router = inject(Router);

    readonly currentUser = signal<User | null>(null);
    readonly isAuthenticated = computed(() => !!this.currentUser());
    readonly userRole = computed<UserRole | null>(() => this.currentUser()?.role ?? null);
    readonly isLoading = signal<boolean>(true);

    private _readyResolve!: () => void;
    /** Resolves once the initial auth state has been determined. Use in guards. */
    readonly ready: Promise<void> = new Promise(resolve => {
        this._readyResolve = resolve;
    });

    constructor() {
        this.initAuthListener();
    }

    private initAuthListener(): void {
        // onAuthStateChange fires INITIAL_SESSION first, so getSession() is redundant.
        // Using a single listener avoids double loadUserProfile calls on startup.
        this.supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                await this.loadUserProfile(session.user.id);
            } else {
                this.currentUser.set(null);
                // Navigate to login only for active sign-outs (not the initial no-session state)
                if (!this.isLoading() && event === 'SIGNED_OUT') {
                    this.router.navigate(['/login']);
                }
            }
            this.isLoading.set(false);
            this._readyResolve();
        });
    }

    private async loadUserProfile(userId: string): Promise<void> {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !data) {
            console.error('Error loading user profile:', error);
            this.currentUser.set(null);
            return;
        }

        this.currentUser.set(data as User);
    }

    async signIn(email: string, password: string): Promise<void> {
        const { error } = await this.supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
    }

    async signOut(): Promise<void> {
        await this.supabase.auth.signOut();
        this.currentUser.set(null);
        this.router.navigate(['/login']);
    }

    hasRole(roles: UserRole[]): boolean {
        const role = this.userRole();
        return role !== null && roles.includes(role);
    }
}
