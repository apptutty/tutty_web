import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoreOrder } from '../store-orders.service';

@Component({
    selector: 'app-order-kanban-card',
    standalone: true,
    imports: [CommonModule],
    template: `
    <article class="order-card" (click)="select.emit(order.id)">
      <div class="order-card__top">
        <p class="order-card__id">#{{ order.order_number }}</p>
        <p class="order-card__time">{{ elapsedLabel }}</p>
      </div>
      <p class="order-card__customer">{{ order.customer_name }}</p>
      <div class="order-card__products">
        <p>{{ order.items_preview }}</p>
      </div>
      <div class="order-card__total-row">
        <span [class]="statusClass">
          {{ statusText }}
        </span>
        <p class="order-card__total">RD$ {{ order.total | number:'1.0-0' }}</p>
      </div>
      <div class="order-card__actions">
        <button class="order-btn-secondary" (click)="detail.emit(order.id); $event.stopPropagation()">Ver detalle</button>
        @if (primaryActionLabel) {
          <button
            class="order-btn-primary"
            [disabled]="isBusy"
            (click)="advance.emit(order); $event.stopPropagation()"
          >
            @if (isBusy) { Procesando… } @else { {{ primaryActionLabel }} }
          </button>
        }
      </div>
    </article>
  `,
})
export class OrderKanbanCardComponent {
    @Input({ required: true }) order!: StoreOrder;
    @Input({ required: true }) elapsedLabel = '';
    @Input({ required: true }) statusClass = '';
    @Input({ required: true }) statusText = '';
    @Input() primaryActionLabel: string | null = null;
    @Input() isBusy = false;

    @Output() detail = new EventEmitter<string>();
    @Output() advance = new EventEmitter<StoreOrder>();
    @Output() select = new EventEmitter<string>();
}

