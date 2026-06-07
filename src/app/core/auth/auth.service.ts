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
        // Use getSession() for the initial state — reads from localStorage without
        // calling /auth/v1/user, preventing the 401 that onAuthStateChange triggers
        // internally. The try/finally guarantees ready always resolves.
        this.supabase.auth.getSession()
            .then(async ({ data: { session } }) => {
                try {
                    if (session?.user) {
                        await this.loadUserProfile(session.user.id);
                    } else {
                        this.currentUser.set(null);
                    }
                } catch (err) {
                    console.error('[AuthService] Session init error:', err);
                    this.currentUser.set(null);
                } finally {
                    this.isLoading.set(false);
                    this._readyResolve();
                }
            })
            .catch(() => {
                this.currentUser.set(null);
                this.isLoading.set(false);
                this._readyResolve();
            });

        // Listen for subsequent auth changes (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED…).
        // Skip INITIAL_SESSION — already handled via getSession() above.
        this.supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'INITIAL_SESSION') return;
            try {
                if (session?.user) {
                    await this.loadUserProfile(session.user.id);
                } else {
                    this.currentUser.set(null);
                    if (event === 'SIGNED_OUT') {
                        this.router.navigate(['/login']);
                    }
                }
            } catch (err) {
                console.error('[AuthService] Auth state change error:', err);
                this.currentUser.set(null);
            }
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
