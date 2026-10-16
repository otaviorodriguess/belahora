import { MAX_BRAND_IMAGE_LENGTH, validateBrandImage } from '../../shared/branding';

export async function prepareBrandImage(file: File, kind: 'photo' | 'logo'): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Escolha uma imagem JPG, PNG ou WebP.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Escolha uma imagem de até 8 MB.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Não foi possível abrir essa imagem. Tente outra foto ou logo.');
  }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40_000_000)
      throw new Error('Essa imagem é grande demais. Escolha uma versão menor.');
    const crop = kind === 'photo' ? Math.min(bitmap.width, bitmap.height) : 0;
    const sourceW = crop || bitmap.width,
      sourceH = crop || bitmap.height;
    for (const size of [512, 384, 256]) {
      const scale = Math.min(1, size / Math.max(sourceW, sourceH));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sourceW * scale));
      canvas.height = Math.max(1, Math.round(sourceH * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Seu navegador não conseguiu preparar a imagem.');
      ctx.drawImage(
        bitmap,
        (bitmap.width - sourceW) / 2,
        (bitmap.height - sourceH) / 2,
        sourceW,
        sourceH,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const data = canvas.toDataURL('image/webp', 0.82);
      if (data.length <= MAX_BRAND_IMAGE_LENGTH) return validateBrandImage(data)!;
    }
    throw new Error('Não foi possível reduzir a imagem. Escolha um arquivo mais simples.');
  } finally {
    bitmap.close();
  }
}
