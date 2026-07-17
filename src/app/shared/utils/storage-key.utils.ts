const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

function sanitizeExtension(ext: string): string {
  return ext.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function extractFileExtension(file: Pick<File, 'name' | 'type'>): string {
  const dotIndex = file.name.lastIndexOf('.');
  if (dotIndex > -1 && dotIndex < file.name.length - 1) {
    const fromName = sanitizeExtension(file.name.slice(dotIndex + 1));
    if (fromName) return fromName;
  }

  const fromMime = sanitizeExtension(MIME_EXTENSION_MAP[file.type] ?? file.type.split('/')[1] ?? '');
  return fromMime || 'bin';
}

export function buildStorageObjectKey(folder: string, file: Pick<File, 'name' | 'type'>): string {
  const normalizedFolder = folder.replace(/^\/+|\/+$/g, '');
  const ext = extractFileExtension(file);
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  return normalizedFolder ? `${normalizedFolder}/${fileName}` : fileName;
}
