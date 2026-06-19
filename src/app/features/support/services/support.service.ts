import { Injectable, inject, signal } from '@angular/core';
import { Observable, from } from 'rxjs';
import { getSupabaseClient } from '../../../core/supabase/supabase.client';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TicketStatus =
    | 'abierto'
    | 'en_revision'
    | 'esperando_respuesta'
    | 'escalado'
    | 'resuelto'
    | 'cerrado';

export type TicketType =
    | 'pedido'
    | 'pago'
    | 'repartidor'
    | 'comercio'
    | 'cuenta'
    | 'excursion'
    | 'otro';

export type TicketPriority = 'baja' | 'media' | 'alta' | 'urgente';

export type ReporterType = 'cliente' | 'store_admin' | 'repartidor' | 'excursion_operator';

export interface SupportTicket {
    id: string;
    ticket_number: string;
    reporter: { id: string; full_name: string; email: string; role: string; avatar_url?: string };
    reporter_type: ReporterType;
    type: TicketType;
    priority: TicketPriority;
    status: TicketStatus;
    subject: string;
    description: string;
    order?: { id: string; order_number: string; total: number };
    store?: { id: string; name: string; commerce_type: string };
    repartidor?: { id: string; full_name: string };
    booking?: { id: string; booking_number: string };
    assigned_to?: { id: string; full_name: string };
    first_response_at?: string;
    sla_deadline: string;
    sla_breached: boolean;
    satisfaction_rating?: number;
    zendesk_id?: string;
    created_at: string;
    updated_at: string;
    message_count: number;
    unread_count: number;
}

export interface SupportTicketDetail extends SupportTicket {
    messages: TicketMessage[];
}

export interface TicketMessage {
    id: string;
    ticket_id: string;
    sender?: { id: string; full_name: string; avatar_url?: string };
    sender_role: 'usuario' | 'soporte' | 'sistema';
    message: string;
    attachments: string[];
    is_internal: boolean;
    read_by_user: boolean;
    read_by_support: boolean;
    created_at: string;
}

export interface TicketFilters {
    status?: TicketStatus | 'all';
    type?: TicketType | 'all';
    priority?: TicketPriority | 'all';
    reporter_type?: ReporterType | 'all';
    assigned_to?: string | 'me' | 'unassigned';
    sla_breached?: boolean;
    search?: string;
    date_from?: string;
    date_to?: string;
    page: number;
    page_size?: number;
}

export interface SupportKPIs {
    open_tickets: number;
    in_review: number;
    awaiting_response: number;
    escalated: number;
    resolved_today: number;
    avg_resolution_hours: number;
    sla_breached_open: number;
    satisfaction_avg: number;
    by_type: { type: string; count: number }[];
    by_reporter_type: { reporter_type: string; count: number }[];
}

export interface TicketVolumeDay {
    date: string;
    total: number;
    by_type: Partial<Record<TicketType, number>>;
}

export interface TypeStats {
    type: TicketType;
    count: number;
    pct: number;
    avg_resolution_hours: number;
    satisfaction_avg: number;
}

export interface AgentPerformance {
    agent_id: string;
    full_name: string;
    assigned_count: number;
    resolved_today: number;
    avg_resolution_hours: number;
    satisfaction_avg: number;
}

export interface BreachedTicketRow extends SupportTicket {
    overdue_hours: number;
}

export interface UserSearchResult {
    id: string;
    full_name: string;
    email: string;
    role: string;
    avatar_url?: string;
    phone?: string;
    referral_code?: string;
}

export interface OrderSearchResult {
    id: string;
    order_number: string;
    total: number;
    status: string;
    created_at: string;
    store_name: string;
}

export interface BookingSearchResult {
    id: string;
    booking_number: string;
    excursion_name: string;
    booking_date: string;
    total: number;
    status: string;
}

export interface StoreSearchResult {
    id: string;
    name: string;
    commerce_type: string;
}

export interface CourierSearchResult {
    id: string;
    user_id: string;
    full_name: string;
    phone?: string;
}

export interface AgentResult {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
}

export type TicketSubtype = 'reembolso' | 'fraude' | 'cancelacion';

export type TemplateCategory = 'reembolso' | 'compensacion' | 'seguimiento' | 'cierre';

export interface ReplyTemplate {
    id: string;
    name: string;
    category: TemplateCategory;
    subject?: string;
    body: string;
    is_active: boolean;
    created_by?: string;
    created_at: string;
}

export interface TemplatePayload {
    name: string;
    category: TemplateCategory;
    subject?: string;
    body: string;
}

export interface NewTicketPayload {
    reporter_id?: string;
    external_name?: string;
    external_contact?: string;
    type: TicketType;
    subtype?: TicketSubtype | null;
    subject: string;
    description: string;
    order_id?: string;
    store_id?: string;
    repartidor_id?: string;
    booking_id?: string;
    assigned_to?: string;
    priority?: TicketPriority;
    attachments?: File[];
}

// ─── Priority sort order ──────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<TicketPriority, number> = {
    urgente: 0,
    alta: 1,
    media: 2,
    baja: 3,
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class SupportService {
    private readonly supabase = getSupabaseClient();
    private readonly auth = inject(AuthService);
    private readonly toast = inject(ToastService);

    // ─── State signals ────────────────────────────────────────────────────────

    readonly tickets = signal<SupportTicket[]>([]);
    readonly activeTicket = signal<SupportTicketDetail | null>(null);
    readonly messages = signal<TicketMessage[]>([]);
    readonly unreadCount = signal<number>(0);
    readonly loadingTickets = signal<boolean>(false);
    readonly loadingMessages = signal<boolean>(false);

    private ticketsChannel: ReturnType<typeof this.supabase.channel> | null = null;
    private messagesChannel: ReturnType<typeof this.supabase.channel> | null = null;

    // ─── getTickets ───────────────────────────────────────────────────────────

    getTickets(filters: TicketFilters): Observable<{ data: SupportTicket[]; count: number }> {
        return from(this.fetchTickets(filters));
    }

    private async fetchTickets(filters: TicketFilters): Promise<{ data: SupportTicket[]; count: number }> {
        const pageSize = filters.page_size ?? 20;
        const from_ = (filters.page - 1) * pageSize;
        const to = from_ + pageSize - 1;

        let query = this.supabase
            .from('support_tickets')
            .select(
                `*,
                reporter:users!reporter_id(id, full_name, email, role, avatar_url),
                order:orders(id, order_number, total),
                store:commerces(id, name, commerce_type),
                repartidor:repartidores(id, user:users!repartidores_user_id_fkey(full_name)),
                booking:excursion_bookings(id, booking_number),
                assigned_to:users!assigned_to(id, full_name),
                message_count:ticket_messages(count),
                unread_count:ticket_messages(count).filter(read_by_support.eq.false)`,
                { count: 'exact' }
            );

        if (filters.status && filters.status !== 'all') {
            query = query.eq('status', filters.status);
        }
        if (filters.type && filters.type !== 'all') {
            query = query.eq('type', filters.type);
        }
        if (filters.priority && filters.priority !== 'all') {
            query = query.eq('priority', filters.priority);
        }
        if (filters.reporter_type && filters.reporter_type !== 'all') {
            query = query.eq('reporter_type', filters.reporter_type);
        }
        if (filters.sla_breached !== undefined) {
            query = query.eq('sla_breached', filters.sla_breached);
        }
        if (filters.assigned_to) {
            if (filters.assigned_to === 'unassigned') {
                query = query.is('assigned_to', null);
            } else if (filters.assigned_to === 'me') {
                const userId = this.auth.currentUser()?.id;
                if (userId) query = query.eq('assigned_to', userId);
            } else {
                query = query.eq('assigned_to', filters.assigned_to);
            }
        }
        if (filters.search) {
            query = query.or(
                `ticket_number.ilike.%${filters.search}%,subject.ilike.%${filters.search}%`
            );
        }
        if (filters.date_from) {
            query = query.gte('created_at', `${filters.date_from}T00:00:00`);
        }
        if (filters.date_to) {
            query = query.lte('created_at', `${filters.date_to}T23:59:59`);
        }

        const { data, count, error } = await query
            .order('sla_deadline', { ascending: true })
            .range(from_, to);

        if (error) throw error;

        const mapped = (data ?? [])
            .map(this.mapTicket)
            .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

        return { data: mapped, count: count ?? 0 };
    }

    // ─── getTicketById ────────────────────────────────────────────────────────

    getTicketById(id: string): Observable<SupportTicketDetail> {
        return from(this.fetchTicketById(id));
    }

    private async fetchTicketById(id: string): Promise<SupportTicketDetail> {
        const isSuperAdmin = this.auth.userRole() === 'super_admin';

        const { data, error } = await this.supabase
            .from('support_tickets')
            .select(
                `*,
                reporter:users!reporter_id(id, full_name, email, role, avatar_url),
                order:orders(id, order_number, total),
                store:commerces(id, name, commerce_type),
                repartidor:repartidores(id, user:users!repartidores_user_id_fkey(full_name)),
                booking:excursion_bookings(id, booking_number),
                assigned_to:users!assigned_to(id, full_name),
                messages:ticket_messages(
                    id, ticket_id, sender:users(id, full_name, avatar_url),
                    sender_role, message, attachments, is_internal,
                    read_by_user, read_by_support, created_at
                )`
            )
            .eq('id', id)
            .single();

        if (error) throw error;

        const ticket = this.mapTicket(data);
        const allMessages: TicketMessage[] = (data.messages ?? []).map(this.mapMessage);
        const messages = isSuperAdmin
            ? allMessages
            : allMessages.filter(m => !m.is_internal);

        return { ...ticket, messages };
    }

    // ─── getMessages ──────────────────────────────────────────────────────────

    getMessages(ticketId: string): Observable<TicketMessage[]> {
        return from(this.fetchMessages(ticketId));
    }

    private async fetchMessages(ticketId: string): Promise<TicketMessage[]> {
        const isSuperAdmin = this.auth.userRole() === 'super_admin';

        let query = this.supabase
            .from('ticket_messages')
            .select('*, sender:users(id, full_name, avatar_url)')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });

        if (!isSuperAdmin) {
            query = query.eq('is_internal', false);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []).map(this.mapMessage);
    }

    // ─── sendMessage ──────────────────────────────────────────────────────────

    async sendMessage(
        ticketId: string,
        message: string,
        isInternal: boolean,
        attachments: File[] = []
    ): Promise<void> {
        const user = this.auth.currentUser();
        if (!user) throw new Error('No autenticado');

        // 1. Upload attachments to Supabase Storage
        const attachmentUrls: string[] = [];
        for (const file of attachments) {
            const path = `support/${ticketId}/${crypto.randomUUID()}-${file.name}`;
            const { error: uploadError } = await this.supabase.storage
                .from('attachments')
                .upload(path, file);
            if (uploadError) throw uploadError;

            const { data: urlData } = this.supabase.storage
                .from('attachments')
                .getPublicUrl(path);
            attachmentUrls.push(urlData.publicUrl);
        }

        // 2. Insert message
        const { error: msgError } = await this.supabase
            .from('ticket_messages')
            .insert({
                ticket_id: ticketId,
                sender_id: user.id,
                sender_role: 'soporte',
                message,
                attachments: attachmentUrls,
                is_internal: isInternal,
                read_by_user: false,
                read_by_support: true,
            });
        if (msgError) throw msgError;

        // 3. If first support response, record it
        const { data: ticketData } = await this.supabase
            .from('support_tickets')
            .select('first_response_at, reporter_id')
            .eq('id', ticketId)
            .single();

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (!ticketData?.first_response_at) {
            updates['first_response_at'] = new Date().toISOString();
        }

        await this.supabase.from('support_tickets').update(updates).eq('id', ticketId);

        // 4. Notify reporter for non-internal messages
        if (!isInternal && ticketData?.reporter_id) {
            await this.supabase.from('notifications').insert({
                user_id: ticketData.reporter_id,
                type: 'ticket_reply',
                title: 'Respuesta a tu ticket de soporte',
                body: message.length > 100 ? `${message.slice(0, 97)}…` : message,
                data: { ticket_id: ticketId },
            });
        }
    }

    // ─── updateTicketStatus ───────────────────────────────────────────────────

    async updateTicketStatus(ticketId: string, status: TicketStatus, notes?: string): Promise<void> {
        const user = this.auth.currentUser();
        if (!user) throw new Error('No autenticado');

        const now = new Date().toISOString();
        const updates: Record<string, unknown> = { status, updated_at: now };

        if (status === 'resuelto') {
            updates['resolved_at'] = now;
            updates['resolved_by'] = user.id;
        } else if (status === 'cerrado') {
            updates['closed_at'] = now;
        }

        const { error: updateError } = await this.supabase
            .from('support_tickets')
            .update(updates)
            .eq('id', ticketId);
        if (updateError) throw updateError;

        // System message
        const statusLabels: Record<TicketStatus, string> = {
            abierto: 'abierto',
            en_revision: 'en revisión',
            esperando_respuesta: 'esperando respuesta',
            escalado: 'escalado',
            resuelto: 'resuelto',
            cerrado: 'cerrado',
        };
        const systemMsg = notes
            ? `Ticket marcado como ${statusLabels[status]}. Nota: ${notes}`
            : `Ticket marcado como ${statusLabels[status]}.`;

        await this.supabase.from('ticket_messages').insert({
            ticket_id: ticketId,
            sender_id: null,
            sender_role: 'sistema',
            message: systemMsg,
            attachments: [],
            is_internal: false,
            read_by_user: false,
            read_by_support: true,
        });

        // Notify reporter
        const { data: ticketData } = await this.supabase
            .from('support_tickets')
            .select('reporter_id')
            .eq('id', ticketId)
            .single();

        if (ticketData?.reporter_id) {
            await this.supabase.from('notifications').insert({
                user_id: ticketData.reporter_id,
                type: 'ticket_status_changed',
                title: `Tu ticket fue ${statusLabels[status]}`,
                body: systemMsg,
                data: { ticket_id: ticketId },
            });
        }
    }

    // ─── assignTicket ─────────────────────────────────────────────────────────

    async assignTicket(ticketId: string, agentId: string): Promise<void> {
        const { error } = await this.supabase
            .from('support_tickets')
            .update({ assigned_to: agentId, assigned_at: new Date().toISOString() })
            .eq('id', ticketId);
        if (error) throw error;
    }

    // ─── updatePriority ───────────────────────────────────────────────────────

    async updatePriority(ticketId: string, priority: TicketPriority): Promise<void> {
        const { error } = await this.supabase
            .from('support_tickets')
            .update({ priority, updated_at: new Date().toISOString() })
            .eq('id', ticketId);
        if (error) throw error;
    }

    // ─── getKPIs ──────────────────────────────────────────────────────────────

    getKPIs(): Observable<SupportKPIs> {
        return from(this.fetchKPIs());
    }

    private async fetchKPIs(): Promise<SupportKPIs> {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [
            openRes,
            inReviewRes,
            awaitingRes,
            escalatedRes,
            resolvedTodayRes,
            slaBreachedRes,
            allResolved,
            satisfactionRes,
            byTypeRes,
            byReporterRes,
        ] = await Promise.all([
            this.supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'abierto'),
            this.supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'en_revision'),
            this.supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'esperando_respuesta'),
            this.supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'escalado'),
            this.supabase.from('support_tickets').select('id', { count: 'exact', head: true })
                .eq('status', 'resuelto')
                .gte('resolved_at', todayStart.toISOString()),
            this.supabase.from('support_tickets').select('id', { count: 'exact', head: true })
                .eq('sla_breached', true)
                .not('status', 'in', '("resuelto","cerrado")'),
            this.supabase.from('support_tickets').select('created_at, resolved_at')
                .eq('status', 'resuelto')
                .not('resolved_at', 'is', null),
            this.supabase.from('support_tickets').select('satisfaction_rating')
                .not('satisfaction_rating', 'is', null),
            this.supabase.from('support_tickets').select('type'),
            this.supabase.from('support_tickets').select('reporter_type'),
        ]);

        // avg resolution hours
        const resolvedRows = allResolved.data ?? [];
        const avgResolutionHours = resolvedRows.length
            ? resolvedRows.reduce((sum, r) => {
                const ms = new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime();
                return sum + ms / 3_600_000;
            }, 0) / resolvedRows.length
            : 0;

        // avg satisfaction
        const ratings = (satisfactionRes.data ?? []).map(r => r.satisfaction_rating as number);
        const satisfactionAvg = ratings.length
            ? ratings.reduce((s, r) => s + r, 0) / ratings.length
            : 0;

        // by_type
        const typeMap = new Map<string, number>();
        for (const row of byTypeRes.data ?? []) {
            typeMap.set(row.type, (typeMap.get(row.type) ?? 0) + 1);
        }

        // by_reporter_type
        const reporterMap = new Map<string, number>();
        for (const row of byReporterRes.data ?? []) {
            reporterMap.set(row.reporter_type, (reporterMap.get(row.reporter_type) ?? 0) + 1);
        }

        return {
            open_tickets: openRes.count ?? 0,
            in_review: inReviewRes.count ?? 0,
            awaiting_response: awaitingRes.count ?? 0,
            escalated: escalatedRes.count ?? 0,
            resolved_today: resolvedTodayRes.count ?? 0,
            avg_resolution_hours: Math.round(avgResolutionHours * 10) / 10,
            sla_breached_open: slaBreachedRes.count ?? 0,
            satisfaction_avg: Math.round(satisfactionAvg * 10) / 10,
            by_type: [...typeMap.entries()].map(([type, count]) => ({ type, count })),
            by_reporter_type: [...reporterMap.entries()].map(([reporter_type, count]) => ({ reporter_type, count })),
        };
    }

    // ─── watchNewTickets ──────────────────────────────────────────────────────

    watchNewTickets(): void {
        this.ticketsChannel?.unsubscribe();

        this.ticketsChannel = this.supabase
            .channel('support-tickets-realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'support_tickets' },
                (payload) => {
                    const ticket = payload.new as any;
                    this.unreadCount.update(n => n + 1);
                    this.toast.info(`🎫 Nuevo ticket ${ticket.ticket_number} — ${ticket.subject}`);
                }
            )
            .subscribe();
    }

    stopWatchingTickets(): void {
        this.ticketsChannel?.unsubscribe();
        this.ticketsChannel = null;
    }

    // ─── watchNewMessages ─────────────────────────────────────────────────────

    watchNewMessages(ticketId: string): void {
        this.messagesChannel?.unsubscribe();

        this.messagesChannel = this.supabase
            .channel(`ticket-messages-${ticketId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'ticket_messages',
                    filter: `ticket_id=eq.${ticketId}`,
                },
                (payload) => {
                    const msg = this.mapMessage(payload.new as any);
                    this.messages.update(prev => [...prev, msg]);
                    if (msg.sender_role === 'usuario') {
                        // New user message — unread for support
                        this.messages.update(prev =>
                            prev.map(m => m.id === msg.id ? { ...m, read_by_support: false } : m)
                        );
                    }
                }
            )
            .subscribe();
    }

    stopWatchingMessages(): void {
        this.messagesChannel?.unsubscribe();
        this.messagesChannel = null;
    }

    // ─── exportTickets ────────────────────────────────────────────────────────

    async exportTickets(filters: TicketFilters): Promise<void> {
        const allFilters: TicketFilters = { ...filters, page: 1, page_size: 10_000 };
        const { data } = await this.fetchTickets(allFilters);

        if (!data.length) {
            this.toast.error('Sin datos para exportar');
            return;
        }

        const headers = [
            '# Ticket', 'Tipo', 'Prioridad', 'Estado',
            'Reporter', 'Asignado', 'Comercio', 'SLA', 'Creado', 'Resuelto',
        ];

        const rows = data.map(t => [
            t.ticket_number,
            t.type,
            t.priority,
            t.status,
            t.reporter.full_name,
            t.assigned_to?.full_name ?? '—',
            t.store?.name ?? '—',
            t.sla_deadline,
            t.created_at,
            (t as any).resolved_at ?? '—',
        ]);

        const csv = [headers, ...rows]
            .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tickets-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ─── getTicketVolumeByDay ──────────────────────────────────────────────────

    getTicketVolumeByDay(days: number): Observable<TicketVolumeDay[]> {
        return from(this.fetchVolumeByDay(days));
    }

    private async fetchVolumeByDay(days: number): Promise<TicketVolumeDay[]> {
        const from_ = new Date();
        from_.setDate(from_.getDate() - days + 1);
        const fromStr = from_.toISOString().slice(0, 10);

        const { data, error } = await this.supabase
            .from('support_tickets')
            .select('created_at, type')
            .gte('created_at', `${fromStr}T00:00:00`);

        if (error) throw error;

        const map = new Map<string, Partial<Record<TicketType, number>> & { total: number }>();
        for (const row of data ?? []) {
            const date = (row.created_at as string).slice(0, 10);
            if (!map.has(date)) map.set(date, { total: 0 });
            const entry = map.get(date)!;
            entry.total = (entry.total ?? 0) + 1;
            entry[row.type as TicketType] = ((entry[row.type as TicketType] ?? 0) as number) + 1;
        }

        // Fill in all days, including empty ones
        const result: TicketVolumeDay[] = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(from_);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().slice(0, 10);
            const entry = map.get(dateStr);
            result.push({ date: dateStr, total: entry?.total ?? 0, by_type: entry ?? {} });
        }
        return result;
    }

    // ─── getBreachedTickets ────────────────────────────────────────────────────

    getBreachedTickets(): Observable<BreachedTicketRow[]> {
        return from(this.fetchBreachedTickets());
    }

    private async fetchBreachedTickets(): Promise<BreachedTicketRow[]> {
        const { data, error } = await this.supabase
            .from('support_tickets')
            .select(
                `*,
                reporter:users!reporter_id(id, full_name, email, role, avatar_url),
                assigned_to:users!assigned_to(id, full_name)`
            )
            .eq('sla_breached', true)
            .not('status', 'in', '("resuelto","cerrado")')
            .order('sla_deadline', { ascending: true });

        if (error) throw error;

        const now = Date.now();
        return (data ?? []).map(raw => {
            const ticket = this.mapTicket(raw);
            const overdue_hours = Math.round((now - new Date(raw.sla_deadline).getTime()) / 3_600_000);
            return { ...ticket, overdue_hours };
        });
    }

    // ─── getTypeStats ──────────────────────────────────────────────────────────

    getTypeStats(): Observable<TypeStats[]> {
        return from(this.fetchTypeStats());
    }

    private async fetchTypeStats(): Promise<TypeStats[]> {
        const { data, error } = await this.supabase
            .from('support_tickets')
            .select('type, created_at, resolved_at, satisfaction_rating');

        if (error) throw error;

        const rows = data ?? [];
        const total = rows.length || 1;

        const map = new Map<string, { count: number; resHours: number[]; ratings: number[] }>();
        for (const row of rows) {
            if (!map.has(row.type)) map.set(row.type, { count: 0, resHours: [], ratings: [] });
            const entry = map.get(row.type)!;
            entry.count++;
            if (row.resolved_at) {
                const h = (new Date(row.resolved_at).getTime() - new Date(row.created_at).getTime()) / 3_600_000;
                entry.resHours.push(h);
            }
            if (row.satisfaction_rating) entry.ratings.push(row.satisfaction_rating);
        }

        const avg = (arr: number[]) => arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0;

        return [...map.entries()].map(([type, e]) => ({
            type: type as TicketType,
            count: e.count,
            pct: Math.round((e.count / total) * 100),
            avg_resolution_hours: Math.round(avg(e.resHours) * 10) / 10,
            satisfaction_avg: Math.round(avg(e.ratings) * 10) / 10,
        })).sort((a, b) => b.count - a.count);
    }

    // ─── getAgentPerformance ───────────────────────────────────────────────────

    getAgentPerformance(): Observable<AgentPerformance[]> {
        return from(this.fetchAgentPerformance());
    }

    private async fetchAgentPerformance(): Promise<AgentPerformance[]> {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data, error } = await this.supabase
            .from('support_tickets')
            .select('assigned_to, created_at, resolved_at, satisfaction_rating, status, users!assigned_to(id, full_name)')
            .not('assigned_to', 'is', null);

        if (error) throw error;

        const map = new Map<string, {
            full_name: string;
            assigned: number;
            resolvedToday: number;
            resHours: number[];
            ratings: number[];
        }>();

        for (const row of data ?? []) {
            const id = row.assigned_to as string;
            const name = (row as any).users?.full_name ?? 'Agente';
            if (!map.has(id)) map.set(id, { full_name: name, assigned: 0, resolvedToday: 0, resHours: [], ratings: [] });
            const e = map.get(id)!;
            e.assigned++;
            if (row.status === 'resuelto' && row.resolved_at) {
                if (new Date(row.resolved_at) >= todayStart) e.resolvedToday++;
                const h = (new Date(row.resolved_at).getTime() - new Date(row.created_at).getTime()) / 3_600_000;
                e.resHours.push(h);
            }
            if (row.satisfaction_rating) e.ratings.push(row.satisfaction_rating as number);
        }

        const avg = (arr: number[]) => arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0;

        return [...map.entries()]
            .map(([id, e]) => ({
                agent_id: id,
                full_name: e.full_name,
                assigned_count: e.assigned,
                resolved_today: e.resolvedToday,
                avg_resolution_hours: Math.round(avg(e.resHours) * 10) / 10,
                satisfaction_avg: Math.round(avg(e.ratings) * 10) / 10,
            }))
            .sort((a, b) => b.assigned_count - a.assigned_count);
    }

    // ─── assignToCurrentUser ───────────────────────────────────────────────────

    async assignToCurrentUser(ticketId: string): Promise<void> {
        const user = this.auth.currentUser();
        if (!user) throw new Error('No autenticado');
        await this.assignTicket(ticketId, user.id);
    }

    // ─── searchUsers ───────────────────────────────────────────────────────────

    searchUsers(query: string): Observable<UserSearchResult[]> {
        return from(
            this.supabase
                .from('users')
                .select('id, full_name, email, role, avatar_url, phone, referral_code')
                .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%,referral_code.ilike.%${query}%`)
                .limit(8)
                .then(({ data, error }) => {
                    if (error) throw error;
                    return (data ?? []).map(u => ({
                        id: u.id,
                        full_name: u.full_name ?? '—',
                        email: u.email ?? '—',
                        role: u.role ?? 'cliente',
                        avatar_url: u.avatar_url ?? undefined,
                        phone: u.phone ?? undefined,
                        referral_code: u.referral_code ?? undefined,
                    })) as UserSearchResult[];
                })
        );
    }

    // ─── searchOrders ──────────────────────────────────────────────────────────

    searchOrders(query: string): Observable<OrderSearchResult[]> {
        return from(
            this.supabase
                .from('orders')
                .select('id, order_number, total, status, created_at, commerce:commerces(name)')
                .ilike('order_number', `%${query}%`)
                .limit(6)
                .then(({ data, error }) => {
                    if (error) throw error;
                    return (data ?? []).map(row => ({
                        id: row.id,
                        order_number: row.order_number,
                        total: row.total ?? 0,
                        status: row.status,
                        created_at: row.created_at,
                        store_name: (row as any).commerce?.name ?? '—',
                    })) as OrderSearchResult[];
                })
        );
    }

    // ─── searchBookings ────────────────────────────────────────────────────────

    searchBookings(query: string): Observable<BookingSearchResult[]> {
        return from(
            this.supabase
                .from('excursion_bookings')
                .select('id, booking_number, total, status, booking_date, excursion:excursions(name)')
                .ilike('booking_number', `%${query}%`)
                .limit(6)
                .then(({ data, error }) => {
                    if (error) throw error;
                    return (data ?? []).map(row => ({
                        id: row.id,
                        booking_number: row.booking_number,
                        excursion_name: (row as any).excursion?.name ?? '—',
                        booking_date: row.booking_date ?? '—',
                        total: row.total ?? 0,
                        status: row.status,
                    })) as BookingSearchResult[];
                })
        );
    }

    // ─── searchCommerces ───────────────────────────────────────────────────────

    searchCommerces(query: string): Observable<StoreSearchResult[]> {
        return from(
            this.supabase
                .from('commerces')
                .select('id, name, commerce_type')
                .ilike('name', `%${query}%`)
                .limit(6)
                .then(({ data, error }) => {
                    if (error) throw error;
                    return (data ?? []).map(row => ({
                        id: row.id,
                        name: row.name ?? '—',
                        commerce_type: row.commerce_type ?? '—',
                    })) as StoreSearchResult[];
                })
        );
    }

    // ─── searchCouriers ────────────────────────────────────────────────────────

    searchCouriers(query: string): Observable<CourierSearchResult[]> {
        return from(
            this.supabase
                .from('users')
                .select('id, full_name, phone, repartidores:repartidores!user_id(id)')
                .eq('role', 'repartidor')
                .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%`)
                .limit(8)
                .then(({ data, error }) => {
                    if (error) throw error;
                    return (data ?? [])
                        .filter(u => (u as any).repartidores?.length > 0)
                        .map(u => ({
                            id: (u as any).repartidores?.[0]?.id ?? u.id,
                            user_id: u.id,
                            full_name: u.full_name ?? '—',
                            phone: u.phone ?? undefined,
                        })) as CourierSearchResult[];
                })
        );
    }

    // ─── getAgents ─────────────────────────────────────────────────────────────

    getAgents(): Observable<AgentResult[]> {
        return from(
            this.supabase
                .from('users')
                .select('id, full_name, email, avatar_url')
                .eq('role', 'super_admin')
                .order('full_name')
                .then(({ data, error }) => {
                    if (error) throw error;
                    return (data ?? []).map(u => ({
                        id: u.id,
                        full_name: u.full_name ?? '—',
                        email: u.email ?? '—',
                        avatar_url: u.avatar_url ?? undefined,
                    })) as AgentResult[];
                })
        );
    }

    // ─── createTicket ──────────────────────────────────────────────────────────

    async createTicket(payload: NewTicketPayload): Promise<SupportTicket> {
        const currentUser = this.auth.currentUser();
        if (!currentUser) throw new Error('No autenticado');

        // Determine priority
        const priority = payload.priority ?? this.autoAssignPriority(payload);
        const slaDeadline = this.computeSlaDeadline(priority);

        // Upload attachments
        const attachmentUrls: string[] = [];
        for (const file of payload.attachments ?? []) {
            const path = `support/attachments/${crypto.randomUUID()}-${file.name}`;
            const { error: uploadError } = await this.supabase.storage
                .from('attachments')
                .upload(path, file);
            if (uploadError) throw uploadError;
            const { data: urlData } = this.supabase.storage
                .from('attachments')
                .getPublicUrl(path);
            attachmentUrls.push(urlData.publicUrl);
        }

        // Determine reporter_type from role
        let reporter_type: ReporterType = 'cliente';
        if (payload.reporter_id) {
            const { data: userData } = await this.supabase
                .from('users')
                .select('role')
                .eq('id', payload.reporter_id)
                .single();
            const role = userData?.role ?? '';
            if (role === 'store_admin') reporter_type = 'store_admin';
            else if (role === 'repartidor') reporter_type = 'repartidor';
            else if (role === 'excursion_operator') reporter_type = 'excursion_operator';
        }

        // Build insert payload — only include fields the schema expects
        const insertData: Record<string, unknown> = {
            reporter_id: payload.reporter_id ?? null,
            reporter_type,
            type: payload.type,
            subject: payload.subject,
            description: payload.description,
            priority,
            status: 'abierto' as TicketStatus,
            sla_deadline: slaDeadline,
            sla_breached: false,
            assigned_to: payload.assigned_to ?? null,
            order_id: payload.order_id ?? null,
            store_id: payload.store_id ?? null,
            repartidor_id: payload.repartidor_id ?? null,
            booking_id: payload.booking_id ?? null,
            updated_at: new Date().toISOString(),
        };

        if (payload.external_name) {
            insertData['external_name'] = payload.external_name;
            insertData['external_contact'] = payload.external_contact ?? null;
        }

        const { data: newTicket, error: insertError } = await this.supabase
            .from('support_tickets')
            .insert(insertData)
            .select(
                `*, reporter:users!reporter_id(id, full_name, email, role, avatar_url),
                assigned_to:users!assigned_to(id, full_name)`
            )
            .single();

        if (insertError) throw insertError;

        // Insert initial message from description
        await this.supabase.from('ticket_messages').insert({
            ticket_id: newTicket.id,
            sender_id: currentUser.id,
            sender_role: 'soporte',
            message: payload.description,
            attachments: attachmentUrls,
            is_internal: false,
            read_by_user: false,
            read_by_support: true,
        });

        // Notify reporter if linked
        if (payload.reporter_id) {
            await this.supabase.from('notifications').insert({
                user_id: payload.reporter_id,
                type: 'ticket_created',
                title: 'Se abrió un ticket de soporte para ti',
                body: payload.subject,
                data: { ticket_id: newTicket.id },
            });
        }

        return this.mapTicket({ ...newTicket, message_count: 1, unread_count: 0 });
    }

    private computeSlaDeadline(priority: TicketPriority): string {
        const hours: Record<TicketPriority, number> = { urgente: 2, alta: 8, media: 24, baja: 72 };
        return new Date(Date.now() + hours[priority] * 3_600_000).toISOString();
    }

    private autoAssignPriority(payload: NewTicketPayload): TicketPriority {
        if (payload.subtype === 'fraude') return 'urgente';
        if (payload.subtype === 'reembolso' || payload.type === 'pago') return 'alta';
        return 'media';
    }

    // ─── getTemplates ──────────────────────────────────────────────────────────

    getTemplates(): Observable<ReplyTemplate[]> {
        return from(
            this.supabase
                .from('support_reply_templates')
                .select('*, created_by_user:users!created_by(full_name)')
                .order('category')
                .order('name')
                .then(({ data, error }) => {
                    if (error) throw error;
                    return (data ?? []).map(r => ({
                        id: r.id,
                        name: r.name,
                        category: r.category as TemplateCategory,
                        subject: r.subject ?? undefined,
                        body: r.body,
                        is_active: r.is_active ?? true,
                        created_by: (r as any).created_by_user?.full_name ?? undefined,
                        created_at: r.created_at,
                    })) as ReplyTemplate[];
                })
        );
    }

    // ─── createTemplate ────────────────────────────────────────────────────────

    async createTemplate(data: TemplatePayload): Promise<ReplyTemplate> {
        const user = this.auth.currentUser();
        const { data: row, error } = await this.supabase
            .from('support_reply_templates')
            .insert({
                name: data.name,
                category: data.category,
                subject: data.subject ?? null,
                body: data.body,
                is_active: true,
                created_by: user?.id ?? null,
            })
            .select()
            .single();
        if (error) throw error;
        return {
            id: row.id,
            name: row.name,
            category: row.category as TemplateCategory,
            subject: row.subject ?? undefined,
            body: row.body,
            is_active: row.is_active ?? true,
            created_at: row.created_at,
        };
    }

    // ─── updateTemplate ────────────────────────────────────────────────────────

    async updateTemplate(id: string, data: TemplatePayload): Promise<void> {
        const { error } = await this.supabase
            .from('support_reply_templates')
            .update({
                name: data.name,
                category: data.category,
                subject: data.subject ?? null,
                body: data.body,
            })
            .eq('id', id);
        if (error) throw error;
    }

    // ─── toggleTemplate ────────────────────────────────────────────────────────

    async toggleTemplate(id: string, is_active: boolean): Promise<void> {
        const { error } = await this.supabase
            .from('support_reply_templates')
            .update({ is_active })
            .eq('id', id);
        if (error) throw error;
    }

    // ─── duplicateTemplate ─────────────────────────────────────────────────────

    async duplicateTemplate(template: ReplyTemplate): Promise<ReplyTemplate> {
        return this.createTemplate({
            name: `${template.name} (copia)`,
            category: template.category,
            subject: template.subject,
            body: template.body,
        });
    }

    // ─── deleteTemplate ────────────────────────────────────────────────────────

    async deleteTemplate(id: string): Promise<void> {
        const { error } = await this.supabase
            .from('support_reply_templates')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    // ─── Mappers ──────────────────────────────────────────────────────────────

    private mapTicket(raw: any): SupportTicket {
        return {
            id: raw.id,
            ticket_number: raw.ticket_number,
            reporter: raw.reporter ?? { id: raw.reporter_id, full_name: '—', email: '—', role: '—' },
            reporter_type: raw.reporter_type,
            type: raw.type,
            priority: raw.priority,
            status: raw.status,
            subject: raw.subject,
            description: raw.description,
            order: raw.order ?? undefined,
            store: raw.store ?? undefined,
            repartidor: raw.repartidor
                ? { id: raw.repartidor.id, full_name: raw.repartidor.user?.full_name ?? '—' }
                : undefined,
            booking: raw.booking ?? undefined,
            assigned_to: raw.assigned_to ?? undefined,
            first_response_at: raw.first_response_at ?? undefined,
            sla_deadline: raw.sla_deadline,
            sla_breached: raw.sla_breached ?? false,
            satisfaction_rating: raw.satisfaction_rating ?? undefined,
            zendesk_id: raw.zendesk_id ?? undefined,
            created_at: raw.created_at,
            updated_at: raw.updated_at,
            message_count: Array.isArray(raw.message_count)
                ? (raw.message_count[0]?.count ?? 0)
                : (raw.message_count ?? 0),
            unread_count: Array.isArray(raw.unread_count)
                ? (raw.unread_count[0]?.count ?? 0)
                : (raw.unread_count ?? 0),
        };
    }

    private mapMessage(raw: any): TicketMessage {
        return {
            id: raw.id,
            ticket_id: raw.ticket_id,
            sender: raw.sender ?? undefined,
            sender_role: raw.sender_role,
            message: raw.message,
            attachments: raw.attachments ?? [],
            is_internal: raw.is_internal ?? false,
            read_by_user: raw.read_by_user ?? false,
            read_by_support: raw.read_by_support ?? false,
            created_at: raw.created_at,
        };
    }
}
