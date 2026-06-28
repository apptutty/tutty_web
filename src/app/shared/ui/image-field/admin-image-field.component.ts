import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  Output,
  EventEmitter,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { validateImageFile, revokeObjectUrl, ALLOWED_IMAGE_TYPES } from '../../utils/media-utils';

export type ImageFieldAspect = '1/1' | '16/9' | '4/3' | '3/2';

/**
 * Reusable image field for the Admin web.
 *
 * Usage:
 * ```html
 * <app-admin-image-field
 *   label="Logo"
 *   aspect="1/1"
 *   [maxMb]="3"
 *   [currentUrl]="form.logo_url"
 *   [uploading]="uploadingLogo()"
 *   (fileSelected)="onLogoSelected($event)"
 *   (removed)="onLogoRemoved()">
 * </app-admin-image-field>
 * ```
 *
 * The parent is responsible for the actual upload (to get the storeId etc).
 * The component handles: drag-drop UX, preview, validation, loading state.
 */
@Component({
  selector: 'app-admin-image-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="aif">
      <!-- Label -->
      @if (label) {
        <p class="aif__label">{{ label }}</p>
      }

      <!-- Drop zone -->
      <div
        class="aif__zone"
        [class.aif__zone--dragging]="isDragging()"
        [class.aif__zone--has-image]="!!previewUrl()"
        [style.aspect-ratio]="aspect"
        (click)="openPicker()"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave()"
        (drop)="onDrop($event)"
        role="button"
        tabindex="0"
        [attr.aria-label]="label + ': seleccionar imagen'"
        (keydown.enter)="openPicker()"
        (keydown.space)="openPicker()">

        <!-- Preview image -->
        @if (previewUrl()) {
          <img
            [src]="previewUrl()!"
            [alt]="label"
            class="aif__preview"
            (error)="onImgError()" />
        } @else {
          <!-- Empty placeholder -->
          <div class="aif__placeholder">
            <svg class="aif__placeholder-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.3">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 18h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v10.5A1.5 1.5 0 0 0 3.75 18Z" />
            </svg>
            <span class="aif__placeholder-text">Arrastrar imagen o <u>explorar</u></span>
            <span class="aif__placeholder-hint">{{ hintText }}</span>
          </div>
        }

        <!-- Uploading overlay -->
        @if (isUploading()) {
          <div class="aif__overlay">
            <svg class="aif__spinner" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5"
                stroke-linecap="round" stroke-dasharray="56.5" stroke-dashoffset="14" />
            </svg>
            <span>Subiendo…</span>
          </div>
        }

        <!-- Hover overlay (only when image present) -->
        @if (previewUrl() && !isUploading()) {
          <div class="aif__hover-overlay">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
            </svg>
            <span>Cambiar</span>
          </div>
        }

      </div><!-- /zone -->

      <!-- Error message -->
      @if (validationError()) {
        <p class="aif__error">{{ validationError() }}</p>
      }

      <!-- Remove button -->
      @if (previewUrl() && !isUploading()) {
        <button
          type="button"
          class="aif__remove"
          (click)="remove($event)"
          aria-label="Quitar imagen">
          Quitar imagen
        </button>
      }

      <!-- Hidden file input -->
      <input
        #fileInput
        type="file"
        [accept]="acceptAttr"
        class="aif__input"
        (change)="onInputChange($event)" />
    </div>
  `,
  styles: [`
    .aif { display: flex; flex-direction: column; gap: 6px; }

    .aif__label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
    }

    .aif__zone {
      position: relative;
      border-radius: 12px;
      border: 2px dashed #d1d5db;
      background: #f9fafb;
      overflow: hidden;
      cursor: pointer;
      transition: border-color 0.15s ease, background 0.15s ease;
      outline: none;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 80px;

      &:hover, &:focus-visible { border-color: #FF3C97; background: #fff5fa; }
      &--dragging { border-color: #FF3C97; background: #fff0f7; }
      &--has-image { border-style: solid; border-color: #e5e7eb; background: transparent; }
    }

    .aif__preview {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .aif__placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 20px;
      text-align: center;
      pointer-events: none;
    }

    .aif__placeholder-icon {
      width: 36px;
      height: 36px;
      color: #9ca3af;
    }

    .aif__placeholder-text {
      font-size: 0.8125rem;
      color: #6b7280;
      u { color: #FF3C97; }
    }

    .aif__placeholder-hint {
      font-size: 0.75rem;
      color: #9ca3af;
    }

    .aif__overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: #fff;
      font-size: 0.8125rem;
      font-weight: 500;
    }

    .aif__spinner {
      width: 28px;
      height: 28px;
      color: #fff;
      animation: aif-spin 0.8s linear infinite;
    }

    @keyframes aif-spin { to { transform: rotate(360deg); } }

    .aif__hover-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.45);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      color: #fff;
      font-size: 0.8125rem;
      font-weight: 500;
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .aif__zone:hover .aif__hover-overlay { opacity: 1; }

    .aif__error {
      font-size: 0.75rem;
      color: #ef4444;
      margin: 0;
    }

    .aif__remove {
      align-self: flex-start;
      font-size: 0.75rem;
      color: #ef4444;
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      text-decoration: underline;
      &:hover { color: #dc2626; }
    }

    .aif__input { display: none; }
  `],
})
export class AdminImageFieldComponent implements OnDestroy {
  @ViewChild('fileInput') private fileInput!: ElementRef<HTMLInputElement>;

  /** Descriptive label shown above the zone. */
  @Input() label = '';

  /** CSS aspect-ratio for the drop zone. */
  @Input() aspect: ImageFieldAspect = '16/9';

  /** Maximum file size in MB. */
  @Input() maxMb = 5;

  /** Current image URL (from the saved record). */
  @Input()
  set currentUrl(val: string | null | undefined) {
    // Only update preview when not showing a local blob (user picked a file)
    if (!this._blobPreview) {
      this.previewUrl.set(val ?? null);
    }
  }

  /** Whether an upload is in progress (controlled by parent). */
  @Input()
  set uploading(val: boolean) {
    this._uploading.set(val);
  }
  private readonly _uploading = signal(false);
  /** Signal alias used in the template. */
  readonly isUploading = this._uploading.asReadonly();

  /** Emits the File when the user selects/drops a new image. */
  @Output() readonly fileSelected = new EventEmitter<File>();

  /** Emits when the user removes the current image. */
  @Output() readonly removed = new EventEmitter<void>();

  readonly isDragging = signal(false);
  readonly previewUrl = signal<string | null>(null);
  readonly validationError = signal<string | null>(null);

  private _blobPreview: string | null = null;

  get acceptAttr(): string {
    return ALLOWED_IMAGE_TYPES.join(',');
  }

  get hintText(): string {
    return `JPG, PNG, WEBP · Máx ${this.maxMb} MB`;
  }

  openPicker(): void {
    if (this.isUploading()) return;
    this.fileInput?.nativeElement.click();
  }

  onInputChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.processFile(file);
    (event.target as HTMLInputElement).value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(): void {
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.processFile(file);
  }

  remove(event: Event): void {
    event.stopPropagation();
    revokeObjectUrl(this._blobPreview);
    this._blobPreview = null;
    this.previewUrl.set(null);
    this.validationError.set(null);
    this.removed.emit();
  }

  onImgError(): void {
    this.previewUrl.set(null);
  }

  ngOnDestroy(): void {
    revokeObjectUrl(this._blobPreview);
  }

  private processFile(file: File): void {
    this.validationError.set(null);
    const err = validateImageFile(file, this.maxMb);
    if (err) { this.validationError.set(err.message); return; }

    revokeObjectUrl(this._blobPreview);
    this._blobPreview = URL.createObjectURL(file);
    this.previewUrl.set(this._blobPreview);
    this.fileSelected.emit(file);
  }
}
