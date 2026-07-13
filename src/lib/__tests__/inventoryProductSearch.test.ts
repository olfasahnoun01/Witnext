import { describe, expect, it } from 'vitest';
import {
  mapLightRowToProduct,
  pickPrixAchatHtFromFournisseurRows,
  prixAchatHtFromVariantProduct,
} from '@/lib/inventoryProductSearch';

describe('pickPrixAchatHtFromFournisseurRows', () => {
  it('returns undefined for empty rows', () => {
    expect(pickPrixAchatHtFromFournisseurRows([], 'Acme')).toBeUndefined();
  });

  it('prefers exact fournisseur match', () => {
    const rows = [
      { prix_ttc: 50, fournisseur_name: 'Other' },
      { prix_ttc: 30, fournisseur_name: 'Acme' },
    ];
    expect(pickPrixAchatHtFromFournisseurRows(rows, 'acme')).toBe(30);
  });

  it('falls back to lowest prix_ttc when no name match', () => {
    const rows = [
      { prix_ttc: 80, fournisseur_name: 'A' },
      { prix_ttc: 45, fournisseur_name: 'B' },
    ];
    expect(pickPrixAchatHtFromFournisseurRows(rows, 'Unknown')).toBe(45);
  });
});

describe('prixAchatHtFromVariantProduct', () => {
  it('returns positive finite price', () => {
    expect(prixAchatHtFromVariantProduct(12.5)).toBe(12.5);
  });

  it('returns undefined for zero or invalid', () => {
    expect(prixAchatHtFromVariantProduct(0)).toBeUndefined();
    expect(prixAchatHtFromVariantProduct('bad')).toBeUndefined();
  });
});

describe('mapLightRowToProduct', () => {
  it('maps row to Product without image', () => {
    const product = mapLightRowToProduct({
      id: 1,
      name: 'Casque',
      sku: 'CAS-01',
      category: 'Casques',
      fournisseur: 'F1',
      size: 'M',
      color: 'Noir',
      price: 100,
      prix_ttc: 119,
      remise: 0,
      quantity: 5,
      min_stock: 2,
      product_group_id: 10,
      prix_achat_ht: 70,
    });

    expect(product.id).toBe(1);
    expect(product.name).toBe('Casque');
    expect(product.image).toBeNull();
    expect(product.prix_achat_ht).toBe(70);
    expect(product.prix_ttc).toBe(119);
    expect(product.subject_to_fodec).toBe(false);
  });

  it('maps subject_to_fodec when set', () => {
    const product = mapLightRowToProduct({
      id: 3,
      name: 'Machine',
      sku: 'MAC-01',
      category: 'Machines',
      fournisseur: 'F1',
      size: null,
      color: null,
      price: 1000,
      prix_ttc: null,
      remise: 0,
      quantity: 1,
      min_stock: 0,
      product_group_id: 1,
      subject_to_fodec: true,
    });
    expect(product.subject_to_fodec).toBe(true);
  });

  it('computes prix_ttc from price and remise when prix_ttc missing', () => {
    const product = mapLightRowToProduct({
      id: 2,
      name: 'Gilet',
      sku: 'GIL-01',
      category: 'Gilets',
      fournisseur: null,
      size: null,
      color: null,
      price: 100,
      prix_ttc: null,
      remise: 10,
      quantity: 1,
      min_stock: null,
      product_group_id: null,
    });

    expect(product.prix_ttc).toBe(90);
  });
});
