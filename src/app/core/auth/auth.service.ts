import { Injectable, signal, computed, inject, effect } from '@angular/core';
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
    /** True when Supabase confirmed an active session exists (set before profile loads). */
    readonly sessionExists = signal<boolean>(false);

    private _readyResolve!: () => void;
    /** Resolves once the initial auth state is known (session check done). Use in guards. */
    readonly ready: Promise<void> = new Promise(resolve => {
        this._readyResolve = resolve;
    });

    private _profileResolve!: () => void;
    /**
     * Resolves once the user profile has been loaded (or confirmed absent).
     * Has a hard 3s timeout so guards never hang if the DB is slow/blocked.
     */
    readonly profileReady: Promise<void> = new Promise(resolve => {
        this._profileResolve = resolve;
        // Hard safety net: resolve after 7s regardless.
        setTimeout(() => resolve(), 7000);
    });

    private profileLoadSeq = 0;

    constructor() {
        this.initAuthListener();

        // When currentUser becomes non-null AFTER ready has resolved (e.g. the
        // INITIAL_SESSION profile load finishes while we're already on /login),
        // redirect the user to the right home page.
        effect(() => {
            const user = this.currentUser();
            if (user && !this.isLoading() && this.router.url === '/login') {
                this.router.navigate([user.role === 'store_admin' ? '/store' : '/dashboard']);
            }
        });
    }

    private initAuthListener(): void {
        let readyResolved = false;
        let initialSessionReceived = false;
        let noSessionTimer: ReturnType<typeof setTimeout> | null = null;

        const resolveReady = (hasSession: boolean) => {
            if (readyResolved) return;
            readyResolved = true;
            this.sessionExists.set(hasSession);
            this.isLoading.set(false);
            this._readyResolve();
            if (!hasSession) this._profileResolve();
        };

        this.supabase.auth.onAuthStateChange(async (event, session) => {
            const hasSession = !!session?.user;
            this.sessionExists.set(hasSession);

            if (!readyResolved) {
                if (hasSession) {
                    if (noSessionTimer) clearTimeout(noSessionTimer);
                    resolveReady(true);
                } else if (event === 'INITIAL_SESSION') {
                    noSessionTimer = setTimeout(() => resolveReady(false), 800);
                    return;
                } else {
                    resolveReady(false);
                }
            }

            if (event === 'SIGNED_OUT') {
                this.currentUser.set(null);
                this.router.navigate(['/login']);
                return;
            }

            if (!session?.user) return;

            // During startup Supabase fires SIGNED_IN (token refresh) before INITIAL_SESSION.
            // The HTTP client is busy at that point — defer DB calls to INITIAL_SESSION.
            if (event === 'SIGNED_IN' && !initialSessionReceived) return;

            if (event === 'INITIAL_SESSION') initialSessionReceived = true;

            if (this.currentUser()?.id === session.user.id) {
                this._profileResolve();
                return;
            }

            const seq = ++this.profileLoadSeq;
            try {
                await this.loadUserProfile(session.user.id, seq);
                this._profileResolve();
            } catch (err) {
                console.error('[Auth] profile load error:', err);
                this.currentUser.set(null);
                this._profileResolve();
            }
        });
    }

    private async loadUserProfile(userId: string, seq: number): Promise<void> {
        const abort = (ms: number, label: string): Promise<{ data: null; error: Error }> =>
            new Promise(resolve => setTimeout(() => resolve({ data: null, error: new Error(label) }), ms));

        const [roleResult, profileResult] = await Promise.all([
            Promise.race([this.supabase.rpc('get_my_role'), abort(5000, 'RPC timeout')]),
            Promise.race([this.supabase.from('users').select('*').eq('id', userId).single(), abort(6000, 'DB timeout')]),
        ]);

        if (seq !== this.profileLoadSeq) return;

        const roleData = roleResult.data;
        const profileData = profileResult.data;

        if (profileData) {
            this.currentUser.set(profileData as User);
        } else if (roleData) {
            const { data: { session } } = await this.supabase.auth.getSession();
            const meta = session?.user?.user_metadata ?? {};
            this.currentUser.set({
                id: userId,
                email: session?.user?.email ?? '',
                full_name: meta['full_name'] ?? meta['name'] ?? '',
                role: roleData as UserRole,
                is_active: true,
                created_at: session?.user?.created_at ?? new Date().toISOString(),
                avatar_url: meta['avatar_url'] ?? null,
            });
        } else {
            console.error('[Auth] loadUserProfile: both RPC and DB timed out for uid:', userId);
            this.currentUser.set(null);
        }
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
