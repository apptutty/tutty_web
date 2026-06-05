import { Injectable, signal } from '@angular/core';
import { getSupabaseClient } from '../supabase/supabase.client';
import { ExcursionCategory } from '../supabase/database.types';

export interface DifficultyOption {
  key: string;
  label: string;
  icon: string;
}

export interface ExperienceOption {
  key: string;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly supabase = getSupabaseClient();
  private loaded = false;

  // ── Signals (readonly externally) ────────────────────────────────────────
  readonly categories = signal<ExcursionCategory[]>([]);
  readonly languages = signal<string[]>(['Español', 'English']);
  readonly difficulties = signal<DifficultyOption[]>([
    { key: 'facil', label: 'Fácil', icon: '🟢' },
    { key: 'moderado', label: 'Moderado', icon: '🟡' },
    { key: 'dificil', label: 'Difícil', icon: '🔴' },
  ]);
  readonly experienceOptions = signal<ExperienceOption[]>([
    { key: '<1', label: 'Menos de 1 año' },
    { key: '1-3', label: '1–3 años' },
    { key: '3-5', label: '3–5 años' },
    { key: '+5', label: 'Más de 5 años' },
  ]);
  readonly commissionRate = signal<number>(10);

  private readonly settingsMap = new Map<string, string>();

  /** Load config from DB. Idempotent — only fetches once per app session. */
  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;

    await Promise.all([this.loadCategories(), this.loadSettings()]);
  }

  getSetting(key: string, fallback = ''): string {
    return this.settingsMap.get(key) ?? fallback;
  }

  private async loadCategories(): Promise<void> {
    const { data } = await this.supabase
      .from('excursion_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (data && data.length > 0) {
      this.categories.set(data as ExcursionCategory[]);
    }
  }

  private async loadSettings(): Promise<void> {
    const KEYS = [
      'excursion_languages',
      'excursion_difficulties',
      'excursion_experience_options',
      'operator_commission_rate',
    ];
    const { data } = await this.supabase
      .from('app_settings')
      .select('key, value')
      .in('key', KEYS);

    for (const row of data ?? []) {
      this.settingsMap.set(row.key, row.value);
    }

    const langsRaw = this.settingsMap.get('excursion_languages');
    if (langsRaw) {
      try { this.languages.set(JSON.parse(langsRaw)); } catch { /* keep default */ }
    }

    const diffsRaw = this.settingsMap.get('excursion_difficulties');
    if (diffsRaw) {
      try { this.difficulties.set(JSON.parse(diffsRaw)); } catch { /* keep default */ }
    }

    const expRaw = this.settingsMap.get('excursion_experience_options');
    if (expRaw) {
      try { this.experienceOptions.set(JSON.parse(expRaw)); } catch { /* keep default */ }
    }

    const rate = this.settingsMap.get('operator_commission_rate');
    if (rate) this.commissionRate.set(Number(rate) || 10);
  }
}
