// Auto-generated Supabase database types
// Run: npx supabase gen types typescript --project-id <your-project-id> > src/app/core/supabase/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type OrderStatus =
    | 'recibido'
    | 'confirmado'
    | 'en_preparacion'
    | 'en_camino'
    | 'entregado'
    | 'cancelado';

export type BookingStatus = 'pendiente' | 'confirmada' | 'cancelada' | 'completada';

export type PromoType = 'percentage' | 'fixed_amount' | 'free_delivery';

export type CommissionTier = 'onboarding' | 'estandar' | 'medio' | 'alto' | 'premium';

export type VehicleType = 'moto' | 'bicicleta' | 'carro' | 'a_pie';

export type ExcursionDifficulty = 'facil' | 'moderado' | 'dificil';

export interface Order {
    id: string;
    order_number: string;
    status: OrderStatus;
    total: number;
    subtotal: number;
    delivery_fee: number;
    discount_amount: number;
    itbis_amount: number;
    created_at: string;
    updated_at: string;
    restaurant_id: string;
    user_id: string;
    repartidor_id?: string | null;
    delivery_address: string;
    delivery_address_detail?: string | null;
    delivery_lat?: number | null;
    delivery_lng?: number | null;
    special_instructions?: string | null;
    promo_code?: string | null;
    promo_id?: string | null;
    estimated_delivery_time?: string | null;
}

export interface OrderDetail extends Order {
    restaurant: { id: string; name: string; address: string; phone?: string };
    customer: { id: string; full_name: string; phone?: string };
    repartidor?: { id: string; full_name: string; vehicle_type: VehicleType; plate?: string; rating: number } | null;
    items: OrderItem[];
    status_history: OrderStatusHistory[];
}

export interface OrderItem {
    id: string;
    order_id: string;
    menu_item_snapshot: Json;
    quantity: number;
    unit_price: number;
    subtotal: number;
}

export interface OrderStatusHistory {
    id: string;
    order_id: string;
    status: OrderStatus;
    changed_by: string;
    notes?: string | null;
    created_at: string;
}

export interface Restaurant {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    category: string;
    logo_url?: string | null;
    banner_url?: string | null;
    whatsapp?: string | null;
    address: string;
    sector?: string | null;
    city: string;
    lat?: number | null;
    lng?: number | null;
    is_open: boolean;
    is_active: boolean;
    commission_rate: number;
    commission_tier: CommissionTier;
    min_order_amount: number;
    free_delivery_threshold?: number | null;
    avg_delivery_time: number;
    avg_service_time: number;
    rating: number;
    total_reviews: number;
    created_at: string;
}

export interface MenuCategory {
    id: string;
    restaurant_id: string;
    name: string;
    description?: string | null;
    display_order: number;
    is_active: boolean;
}

export interface MenuItem {
    id: string;
    restaurant_id: string;
    category_id: string;
    name: string;
    description?: string | null;
    price: number;
    discount_price?: number | null;
    image_url?: string | null;
    is_available: boolean;
    preparation_time: number;
    tags: string[];
    calories?: number | null;
    is_featured: boolean;
    display_order: number;
    has_variants: boolean;
    track_stock: boolean;
    stock_count?: number | null;
}

export interface DeliveryZone {
    id: string;
    restaurant_id: string;
    name: string;
    sector_list: string[];
    delivery_fee: number;
    min_order: number;
    estimated_time: number;
    max_distance_km?: number | null;
    extra_km_fee?: number | null;
    available_from?: string | null;
    available_until?: string | null;
    weather_surcharge_override?: number | null;
    priority: number;
    is_active: boolean;
}

export interface Repartidor {
    id: string;
    user_id: string;
    cedula: string;
    vehicle_type: VehicleType;
    plate?: string | null;
    photo_url?: string | null;
    is_available: boolean;
    rating: number;
    total_deliveries: number;
    total_earnings: number;
    zone_ids: string[];
    created_at: string;
    full_name?: string;
    phone?: string;
}

export interface ExcursionOperator {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    logo_url?: string | null;
    banner_url?: string | null;
    category: string;
    whatsapp?: string | null;
    address?: string | null;
    rating: number;
    total_reviews: number;
    is_active: boolean;
    created_at: string;
}

export interface Excursion {
    id: string;
    operator_id: string;
    name: string;
    short_description?: string | null;
    long_description?: string | null;
    difficulty: ExcursionDifficulty;
    language: string;
    duration_hours: number;
    price_per_person: number;
    min_people: number;
    max_people: number;
    meeting_point?: string | null;
    meeting_lat?: number | null;
    meeting_lng?: number | null;
    min_hours_advance: number;
    cancellation_hours: number;
    photos: string[];
    is_active: boolean;
    created_at: string;
}

export interface ExcursionDate {
    id: string;
    excursion_id: string;
    date: string;
    departure_time: string;
    total_spots: number;
    available_spots: number;
    status: 'disponible' | 'lleno' | 'cancelado';
}

export interface Booking {
    id: string;
    booking_number: string;
    excursion_id: string;
    excursion_date_id: string;
    user_id: string;
    num_people: number;
    total: number;
    status: BookingStatus;
    special_instructions?: string | null;
    created_at: string;
}

export interface BookingDetail extends Booking {
    excursion: { id: string; name: string; operator: { name: string } };
    excursion_date: { date: string; departure_time: string };
    customer: { full_name: string; phone?: string };
    participants: BookingParticipant[];
}

export interface BookingParticipant {
    id: string;
    booking_id: string;
    full_name: string;
    cedula?: string | null;
    phone?: string | null;
}

export interface Promotion {
    id: string;
    name: string;
    description?: string | null;
    code: string;
    type: PromoType;
    value: number;
    min_order_amount?: number | null;
    max_discount?: number | null;
    max_uses?: number | null;
    current_uses: number;
    valid_from?: string | null;
    valid_until?: string | null;
    restaurant_id?: string | null;
    is_active: boolean;
    created_at: string;
}

export interface AppSetting {
    key: string;
    value: string;
    description?: string | null;
    updated_at: string;
}

export interface Holiday {
    id: string;
    date: string;
    name: string;
    surcharge_rate: number;
    is_active: boolean;
}

export interface PromoUse {
    id: string;
    promotion_id: string;
    order_id?: string | null;
    user_id?: string | null;
    discount_applied: number;
    created_at: string;
    user_name?: string;
    order_number?: string;
}

export interface StatusCount {
    status: string;
    count: number;
}

export interface DashboardKPIs {
    ventas_hoy: number;
    pedidos_hoy: number;
    pedidos_activos: number;
    restaurantes_abiertos: number;
}

export interface OrderFilters {
    status?: OrderStatus | 'activos' | null;
    restaurant_id?: string | null;
    date_from?: string | null;
    date_to?: string | null;
    search?: string | null;
    page?: number;
    pageSize?: number;
}
