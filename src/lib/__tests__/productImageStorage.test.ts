import { describe, expect, it } from 'vitest';
import {
  isInlineProductImage,
  parseProductImageStoragePath,
} from '@/lib/productImageStorage';

describe('isInlineProductImage', () => {
  it('detects data URLs', () => {
    expect(isInlineProductImage('data:image/webp;base64,abc')).toBe(true);
  });

  it('rejects storage paths and http URLs', () => {
    expect(isInlineProductImage('company-id/product-images/foo.webp')).toBe(false);
    expect(isInlineProductImage('https://example.com/x.png')).toBe(false);
    expect(isInlineProductImage(null)).toBe(false);
    expect(isInlineProductImage('')).toBe(false);
  });
});

describe('parseProductImageStoragePath', () => {
  it('returns relative paths as-is', () => {
    expect(parseProductImageStoragePath('abc/product-images/x.webp')).toBe(
      'abc/product-images/x.webp'
    );
  });

  it('parses signed storage URLs', () => {
    const url =
      'https://proj.supabase.co/storage/v1/object/sign/fiches-techniques/co/img.webp?token=t';
    expect(parseProductImageStoragePath(url)).toBe('co/img.webp');
  });

  it('returns null for inline images', () => {
    expect(parseProductImageStoragePath('data:image/png;base64,xx')).toBeNull();
  });
});
