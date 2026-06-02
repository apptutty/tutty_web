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

    constructor() {
        this.initAuthListener();
    }

    private initAuthListener(): void {
        this.supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session?.user) {
                await this.loadUserProfile(session.user.id);
            }
            this.isLoading.set(false);
        });

        this.supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                await this.loadUserProfile(session.user.id);
            } else {
                this.currentUser.set(null);
            }
            // Ensure loading is false after any auth state change
            this.isLoading.set(false);
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
