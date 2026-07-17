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
                console.log('[Auth] effect redirect from /login', { role: user.role, userId: user.id });
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
            console.log('[Auth] resolveReady', { hasSession });
            this.sessionExists.set(hasSession);
            this.isLoading.set(false);
            this._readyResolve();
            if (!hasSession) this._profileResolve();
        };

        this.supabase.auth.onAuthStateChange(async (event, session) => {
            const hasSession = !!session?.user;
            console.log('[Auth] onAuthStateChange', {
                event,
                hasSession,
                userId: session?.user?.id ?? null,
                email: session?.user?.email ?? null,
            });
            this.sessionExists.set(hasSession);

            if (!readyResolved) {
                if (hasSession) {
                    if (noSessionTimer) clearTimeout(noSessionTimer);
                    resolveReady(true);
                } else if (event === 'INITIAL_SESSION') {
                    noSessionTimer = setTimeout(() => {
                        initialSessionReceived = true;
                        console.log('[Auth] INITIAL_SESSION without user -> resolveReady(false)');
                        resolveReady(false);
                    }, 800);
                    return;
                } else {
                    resolveReady(false);
                }
            }

            if (event === 'SIGNED_OUT') {
                console.log('[Auth] SIGNED_OUT -> clearing currentUser and redirecting /login');
                this.currentUser.set(null);
                this.router.navigate(['/login']);
                return;
            }

            if (!session?.user) {
                console.log('[Auth] event without session.user; skipping profile load', { event });
                return;
            }

            // During startup Supabase fires SIGNED_IN (token refresh) before INITIAL_SESSION.
            // The HTTP client is busy at that point — defer DB calls to INITIAL_SESSION.
            if (event === 'SIGNED_IN' && !initialSessionReceived) {
                console.log('[Auth] SIGNED_IN before INITIAL_SESSION; deferring profile load');
                return;
            }

            if (event === 'INITIAL_SESSION') initialSessionReceived = true;

            if (this.currentUser()?.id === session.user.id) {
                console.log('[Auth] currentUser already loaded for session user', { userId: session.user.id });
                this._profileResolve();
                return;
            }

            const seq = ++this.profileLoadSeq;
            console.log('[Auth] loading profile', { userId: session.user.id, seq });
            try {
                await this.loadUserProfile(session.user.id, seq);
                console.log('[Auth] profile load completed', {
                    userId: session.user.id,
                    seq,
                    resolvedUserId: this.currentUser()?.id ?? null,
                    resolvedRole: this.currentUser()?.role ?? null,
                });
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

        if (seq !== this.profileLoadSeq) {
            console.log('[Auth] stale profile response ignored', { userId, seq, currentSeq: this.profileLoadSeq });
            return;
        }

        const roleData = roleResult.data;
        const profileData = profileResult.data;
        console.log('[Auth] loadUserProfile results', {
            userId,
            hasProfileData: !!profileData,
            roleData: roleData ?? null,
            roleError: roleResult.error?.message ?? null,
            profileError: profileResult.error?.message ?? null,
        });

        if (profileData) {
            this.currentUser.set(profileData as User);
            console.log('[Auth] currentUser set from users table', {
                userId: (profileData as User).id,
                role: (profileData as User).role,
            });
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
            console.log('[Auth] currentUser synthesized from role RPC', { userId, role: roleData });
        } else {
            console.error('[Auth] loadUserProfile: both RPC and DB timed out for uid:', userId);
            this.currentUser.set(null);
        }
    }

    async signIn(email: string, password: string): Promise<void> {
        console.log('[Auth] signIn start', { email });
        const { error } = await this.supabase.auth.signInWithPassword({ email, password });
        if (!error) console.log('[Auth] signIn success', { email });
        if (error) throw error;
    }

    async signOut(): Promise<void> {
        console.log('[Auth] signOut start');
        await this.supabase.auth.signOut();
        this.currentUser.set(null);
        this.router.navigate(['/login']);
    }

    hasRole(roles: UserRole[]): boolean {
        const role = this.userRole();
        return role !== null && roles.includes(role);
    }
}
