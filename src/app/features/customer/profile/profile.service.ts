import { Injectable, inject, signal } from '@angular/core';
import { getSupabaseClient } from '../../../core/supabase/supabase.client';
import { AuthService } from '../../../core/auth/auth.service';

export interface CustomerAddress {
    id: string;
    label: string;
    street: string;
    sector: string | null;
    city: string;
    is_default: boolean;
    address_type: string | null;
}

export interface CustomerProfile {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
    referral_code: string | null;
    total_orders: number;
    nationality: string | null;
    nationality_flag: string | null;
}

@Injectable({ providedIn: 'root' })
export class CustomerProfileService {
    private readonly supabase = getSupabaseClient();
    private readonly auth = inject(AuthService);

    readonly profile = signal<CustomerProfile | null>(null);
    readonly addresses = signal<CustomerAddress[]>([]);
    readonly isLoading = signal(false);
    readonly error = signal<string | null>(null);
    readonly copySuccess = signal(false);

    async loadProfile(): Promise<void> {
        const user = this.auth.currentUser();
        if (!user) return;

        this.isLoading.set(true);
        this.error.set(null);

        const [profileResult, addressResult] = await Promise.all([
            this.supabase
                .from('users')
                .select('id, full_name, email, phone, avatar_url, referral_code, total_orders, nationality, nationality_flag')
                .eq('id', user.id)
                .single(),
            this.supabase
                .from('addresses')
                .select('id, label, street, sector, city, is_default, address_type')
                .eq('user_id', user.id)
                .order('is_default', { ascending: false }),
        ]);

        if (profileResult.data) {
            this.profile.set(profileResult.data as CustomerProfile);
        } else {
            this.error.set('No se pudo cargar el perfil.');
        }

        if (addressResult.data) {
            this.addresses.set(addressResult.data as CustomerAddress[]);
        }

        this.isLoading.set(false);
    }

    async copyReferralCode(): Promise<void> {
        const code = this.profile()?.referral_code;
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
            this.copySuccess.set(true);
            setTimeout(() => this.copySuccess.set(false), 2000);
        } catch (_) {
            // Clipboard API not available — silent fail
        }
    }

    initials(name: string | null): string {
        if (!name) return '?';
        return name
            .split(' ')
            .slice(0, 2)
            .map(w => w[0])
            .join('')
            .toUpperCase();
    }
}
