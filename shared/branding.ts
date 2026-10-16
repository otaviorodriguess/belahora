// Two optimized images remain comfortably below the API and Firestore document limits.
export const MAX_BRAND_IMAGE_LENGTH = 140_000;
export function validateBrandImage(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > MAX_BRAND_IMAGE_LENGTH)
    throw new Error('A imagem é muito grande. Selecione novamente uma foto ou logo.');
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) throw new Error('Use uma imagem JPG, PNG ou WebP.');
  let bytes: string;
  try {
    bytes = atob(match[2].slice(0, 32));
  } catch {
    throw new Error('Imagem inválida.');
  }
  const valid =
    match[1] === 'png'
      ? bytes.startsWith('\x89PNG\r\n\x1a\n')
      : match[1] === 'jpeg'
        ? bytes.startsWith('\xff\xd8\xff')
        : bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP';
  if (!valid) throw new Error('O arquivo não contém uma imagem válida.');
  return value;
}
