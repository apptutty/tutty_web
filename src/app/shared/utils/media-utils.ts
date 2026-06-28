/** Shared media/image utilities for the Admin web. */

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;

export interface FileValidationError {
  code: 'size' | 'type';
  message: string;
}

/**
 * Validates a file against allowed types and maximum size.
 * Returns an error object or null if valid.
 */
export function validateImageFile(
  file: File,
  maxMb = 5,
  allowedTypes: readonly string[] = ALLOWED_IMAGE_TYPES,
): FileValidationError | null {
  if (!allowedTypes.includes(file.type)) {
    const exts = allowedTypes.map((t) => t.split('/')[1].toUpperCase()).join(', ');
    return { code: 'type', message: `Tipo no permitido. Use: ${exts}` };
  }
  if (file.size > maxMb * 1024 * 1024) {
    return { code: 'size', message: `El archivo supera el límite de ${maxMb} MB` };
  }
  return null;
}

/** Produces a safe, URL-friendly path segment from a filename. */
export function safePath(filename: string): string {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

/** Revoke an object URL once no longer needed to avoid memory leaks. */
export function revokeObjectUrl(url: string | null | undefined): void {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
}
