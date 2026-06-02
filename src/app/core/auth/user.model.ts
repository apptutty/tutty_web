export type UserRole = 'super_admin' | 'restaurant_admin' | 'excursion_operator' | 'repartidor' | 'cliente' | 'store_admin';

export interface User {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    avatar_url?: string | null;
    is_active: boolean;
    created_at: string;
    restaurant_id?: string | null;
    operator_id?: string | null;
}
