import {
  Component, Input, Output, EventEmitter, signal, computed,
  OnChanges, SimpleChanges, HostListener, ElementRef, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommerceCategory } from '../../../core/supabase/database.types';

// Backward compat alias
type StoreCategory = CommerceCategory;

/** Fallback emoji per commerce_type when domain icon is absent */
const TYPE_EMOJI: Record<string, string> = {
  restaurante:        '🍽️',
  farmacia:           '💊',
  bodega:             '🛒',
  colmado:            '🏪',
  tienda_ropa:        '👕',
  supermercado:       '🛍️',
  electronica:        '📱',
  tienda_utilidades:  '🔧',
  otro:               '🏬',
};

/**
 * CommerceCategoryPickerComponent
 *
 * Visual picker for global commerce categories (table: restaurant_categories).
 * Used for:
 *  - Commerce profile form → "Categoría del comercio"
 *  - Product form          → "Tipo de alimento"
 *
 * Inputs:
 *   categories        List of StoreCategory (filtered by commerce_type by caller)
 *   selectedId        Currently selected category id (null = none)
 *   label             Field label text
 *   placeholder       Placeholder when nothing is selected
 *   allowClear        Show "Ninguna" option (default true)
 *   loading           Show skeleton while loading
 *
 * Output:
 *   categorySelected  Emits selected StoreCategory, or null if cleared
 */
@Component({
  selector: 'app-commerce-category-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host { display: block; }

    .ccp { position: relative; }

    /* Trigger pill — closed state */
    .ccp__trigger {
      display: flex; align-items: center; gap: 8px;
      width: 100%; padding: 8px 12px;
      background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
      cursor: pointer; text-align: left; transition: border-color .15s;
      font-size: 0.875rem; color: #374151; min-height: 44px;
    }
    .ccp__trigger:hover, .ccp__trigger:focus { border-color: #e91e8c; outline: none; }
    .ccp__trigger--open { border-color: #e91e8c; box-shadow: 0 0 0 3px rgba(233,30,140,.1); }

    .ccp__icon { font-size: 1.25rem; flex-shrink: 0; line-height: 1; }
    .ccp__name { flex: 1; font-weight: 500; }
    .ccp__placeholder { flex: 1; color: #9ca3af; }
    .ccp__chevron { flex-shrink: 0; color: #9ca3af; transition: transform .2s; }
    .ccp__chevron--up { transform: rotate(180deg); }

    /* Dropdown panel */
    .ccp__panel {
      position: absolute; top: calc(100% + 4px); left: 0; right: 0;
      background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,.12); z-index: 200;
      overflow: hidden; max-height: 340px; display: flex; flex-direction: column;
    }

    /* Mobile: full bottom sheet */
    @media (max-width: 575px) {
      .ccp__panel {
        position: fixed; top: auto; bottom: 0; left: 0; right: 0;
        border-radius: 16px 16px 0 0; max-height: 75vh;
        box-shadow: 0 -4px 32px rgba(0,0,0,.15);
      }
      .ccp__overlay {
        display: block;
        position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 199;
      }
    }
    .ccp__overlay { display: none; }

    /* Search */
    .ccp__search-wrap {
      padding: 10px 12px; border-bottom: 1px solid #f3f4f6; flex-shrink: 0;
    }
    .ccp__search {
      width: 100%; padding: 7px 10px 7px 32px; border: 1px solid #e5e7eb;
      border-radius: 8px; font-size: 0.8125rem; outline: none;
      background: #f9fafb url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%239ca3af' viewBox='0 0 24 24' stroke-width='2' width='14' height='14'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.804 7.5 7.5 0 0 0 15.803 15.803Z'/%3E%3C/svg%3E") 9px center no-repeat;
    }
    .ccp__search:focus { border-color: #e91e8c; background-color: #fff; }

    /* Grid */
    .ccp__grid {
      overflow-y: auto; padding: 10px; flex: 1;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
    }
    @media (min-width: 576px) { .ccp__grid { grid-template-columns: repeat(3, 1fr); } }
    @media (min-width: 992px) { .ccp__grid { grid-template-columns: repeat(4, 1fr); } }

    /* Card */
    .ccp__card {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 5px; padding: 10px 6px; border: 1.5px solid #e5e7eb; border-radius: 10px;
      cursor: pointer; transition: all .15s; text-align: center; min-height: 72px;
      background: #fff;
    }
    .ccp__card:hover { border-color: #e91e8c; background: #fdf0f7; }
    .ccp__card--selected {
      border-color: #e91e8c; background: #fce7f3;
      box-shadow: 0 0 0 2px rgba(233,30,140,.15);
    }
    .ccp__card-icon { font-size: 1.5rem; line-height: 1; }
    .ccp__card-img { width: 28px; height: 28px; object-fit: contain; }
    .ccp__card-name {
      font-size: 0.75rem; font-weight: 500; color: #374151;
      line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2;
      -webkit-box-orient: vertical; overflow: hidden;
    }
    .ccp__card--selected .ccp__card-name { color: #9d174d; }

    /* Domain badge inside card */
    .ccp__domain-badge {
      font-size: 0.625rem; color: #9ca3af; line-height: 1;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
    }
    .ccp__card--selected .ccp__domain-badge { color: #db2777; }

    /* None / clear option */
    .ccp__clear {
      padding: 8px 12px; border-top: 1px solid #f3f4f6; flex-shrink: 0;
      font-size: 0.8125rem; color: #9ca3af; cursor: pointer;
      display: flex; align-items: center; gap: 6px;
    }
    .ccp__clear:hover { background: #f9fafb; color: #6b7280; }

    /* Empty state */
    .ccp__empty { padding: 24px; text-align: center; color: #9ca3af; font-size: 0.8125rem; }

    /* Skeleton */
    .ccp__skeleton { height: 44px; border-radius: 10px; background: #f3f4f6; animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.5 } }
  `],
  template: `
    @if (loading) {
      <div class="ccp__skeleton"></div>
    } @else {
      <div class="ccp" #root>
        <!-- Overlay for mobile bottom-sheet backdrop -->
        @if (isOpen()) {
          <div class="ccp__overlay" (click)="close()"></div>
        }

        <!-- Trigger -->
        <button type="button" class="ccp__trigger" [class.ccp__trigger--open]="isOpen()"
          (click)="toggle()" [attr.aria-expanded]="isOpen()">
          @if (selected()) {
            <span class="ccp__icon">{{ iconFor(selected()!) }}</span>
            <span class="ccp__name">{{ selected()!.name }}</span>
          } @else {
            <span class="ccp__placeholder">{{ placeholder }}</span>
          }
          <svg class="ccp__chevron" [class.ccp__chevron--up]="isOpen()"
            width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        <!-- Dropdown panel -->
        @if (isOpen()) {
          <div class="ccp__panel" role="dialog" [attr.aria-label]="label" aria-modal="true">

            <!-- Search -->
            <div class="ccp__search-wrap">
              <input class="ccp__search" type="text" [placeholder]="'Buscar ' + label.toLowerCase() + '...'"
                [(ngModel)]="searchQuery" (ngModelChange)="onSearch($event)"
                autofocus autocomplete="off" />
            </div>

            <!-- Grid -->
            <div class="ccp__grid" role="listbox">
              @for (cat of filtered(); track cat.id) {
                <button type="button" class="ccp__card" role="option"
                  [class.ccp__card--selected]="selectedId === cat.id"
                  [attr.aria-selected]="selectedId === cat.id"
                  (click)="select(cat)">
                  @if (cat.icon_url) {
                    <img class="ccp__card-img" [src]="cat.icon_url" [alt]="cat.name" />
                  } @else {
                    <span class="ccp__card-icon">{{ iconFor(cat) }}</span>
                  }
                  <span class="ccp__card-name">{{ cat.name }}</span>
                  @if (cat.domain?.name) {
                    <span class="ccp__domain-badge">{{ cat.domain!.name }}</span>
                  }
                  @if (selectedId === cat.id) {
                    <svg width="12" height="12" fill="#e91e8c" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                  }
                </button>
              }
              @if (filtered().length === 0) {
                <div class="ccp__empty" style="grid-column: 1 / -1">
                  Sin resultados para "<strong>{{ searchQuery }}</strong>"
                </div>
              }
            </div>

            <!-- Clear option -->
            @if (allowClear && selected()) {
              <div class="ccp__clear" (click)="clear()">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
                Quitar selección
              </div>
            }
          </div>
        }
      </div>
    }
  `,
})
export class CommerceCategoryPickerComponent implements OnChanges {
  @Input() categories: CommerceCategory[] = [];
  @Input() selectedId: string | null = null;
  @Input() label = 'Categoría';
  @Input() placeholder = 'Seleccionar categoría...';
  @Input() allowClear = true;
  @Input() loading = false;

  @Output() categorySelected = new EventEmitter<CommerceCategory | null>();

  private readonly el = inject(ElementRef);

  searchQuery = '';
  readonly isOpen = signal(false);

  readonly selected = computed(() =>
    this.categories.find(c => c.id === this.selectedId) ?? null,
  );

  readonly filtered = signal<CommerceCategory[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['categories']) this.applyFilter();
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.searchQuery = '';
      this.applyFilter();
      this.isOpen.set(true);
    }
  }

  close(): void {
    this.isOpen.set(false);
    this.searchQuery = '';
  }

  onSearch(q: string): void {
    this.applyFilter(q);
  }

  select(cat: CommerceCategory): void {
    this.categorySelected.emit(cat);
    this.close();
  }

  clear(): void {
    this.categorySelected.emit(null);
    this.close();
  }

  iconFor(cat: CommerceCategory): string {
    // Priority: domain emoji > commerce_type fallback
    return cat.domain?.icon ?? TYPE_EMOJI[cat.commerce_type] ?? '🏬';
  }

  private applyFilter(q = this.searchQuery): void {
    const query = q.trim().toLowerCase();
    this.filtered.set(
      query
        ? this.categories.filter(c => c.name.toLowerCase().includes(query))
        : [...this.categories],
    );
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.close(); }

  @HostListener('document:click', ['$event'])
  onClickOutside(e: MouseEvent): void {
    if (this.isOpen() && !this.el.nativeElement.contains(e.target)) {
      this.close();
    }
  }
}
