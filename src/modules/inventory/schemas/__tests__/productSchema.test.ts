import { describe, expect, it } from 'vitest';
import { productCreateSchema } from '@/modules/inventory/schemas/productSchema';

describe('productCreateSchema', () => {
  it('accepts valid product payload', () => {
    const result = productCreateSchema.safeParse({
      name: 'Casque',
      sku: 'CAS-01',
      category: 'Casques',
      price: 100,
      quantity: 5,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = productCreateSchema.safeParse({
      name: '  ',
      sku: 'CAS-01',
      category: 'Casques',
      price: 10,
    });
    expect(result.success).toBe(false);
  });

  it('rejects remise above 100', () => {
    const result = productCreateSchema.safeParse({
      name: 'Gilet',
      sku: 'GIL-01',
      category: 'Gilets',
      price: 10,
      remise: 150,
    });
    expect(result.success).toBe(false);
  });
});
