import { describe, expect, it } from 'vitest';
import { validateBrandImage, MAX_BRAND_IMAGE_LENGTH } from '../../shared/branding';
import { validateBackupSettings } from './backup';
import { defaults } from '../data/defaults';
import { validateSettings } from '../../server/agendaService';
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGQAAAABJRU5ErkJggg==';
describe('imagens da página de agendamento', () => {
  it('valida no servidor e permite remover imagens sem exigir fotos para contas antigas', () => {
    const base = { ...defaults, services: [] };
    expect(validateSettings({ ...base, professionalPhoto: png, studioLogo: png }).studioLogo).toBe(png);
    expect(validateSettings(base).studioLogo).toBeUndefined();
    expect(() => validateSettings({ ...base, studioLogo: 'https://example.com/image' })).toThrow('Use uma imagem');
  });
  it('aceita imagem raster limitada e ausência da imagem', () => {
    expect(validateBrandImage(png)).toBe(png);
    expect(validateBrandImage(undefined)).toBeUndefined();
    expect(validateBrandImage(null)).toBeUndefined();
  });
  it('rejeita URL externa, SVG, base64 inválido e excesso de tamanho', () => {
    for (const value of [
      'https://example.com/photo.jpg',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'data:image/png;base64,SGVsbG8=',
      'data:image/png;base64,???',
      'x'.repeat(MAX_BRAND_IMAGE_LENGTH + 1),
      {},
    ])
      expect(() => validateBrandImage(value)).toThrow();
  });
  it('preserva fotos no backup e mantém compatibilidade com configurações antigas', () => {
    const value = validateBackupSettings({ ...defaults, professionalPhoto: png, studioLogo: png });
    expect(value.professionalPhoto).toBe(png);
    expect(value.studioLogo).toBe(png);
    expect(validateBackupSettings(defaults).professionalPhoto).toBeUndefined();
  });
});
