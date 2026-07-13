import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/types';
import {
  getActiveCompanyId,
  getActiveCompanyIdForQuery,
  requireActiveCompanyId,
  withCompany,
} from '@/lib/activeCompany';
import { persistProductImageIfInline } from '@/lib/productImageStorage';
import { filterByCompanyId } from '@/modules/inventory/lib/companyQuery';
import {
  mapProductRow,
  PRODUCT_COLUMNS_LIGHT,
  type ProductRowLight,
} from '@/modules/inventory/lib/productMappers';
import { productCreateSchema } from '@/modules/inventory/schemas/productSchema';
import { createStockTransaction } from '@/modules/inventory/services/stockRepository';

const PAGE_SIZE = 1000;
const MAX_PAGES = 30;

export async function getAllProducts(): Promise<Product[]> {
  const allData: ProductRowLight[] = [];
  let from = 0;
  let pages = 0;

  while (true) {
    pages += 1;
    if (pages > MAX_PAGES) {
      console.warn(`getAllProducts: stopped after ${MAX_PAGES * PAGE_SIZE} rows (safety cap).`);
      break;
    }
    const companyId = getActiveCompanyIdForQuery();
    if (!companyId) {
      if (from === 0) return [];
      break;
    }

    const query = filterByCompanyId(
      supabase
        .from('products')
        .select(PRODUCT_COLUMNS_LIGHT)
        .order('name')
        .range(from, from + PAGE_SIZE - 1),
      companyId
    );

    const { data, error } = await query;

    if (error) {
      console.error('Erreur lors de la récupération des produits:', error);
      throw new Error(error.message || 'Erreur lors de la récupération des produits');
    }

    const batch = (data || []) as ProductRowLight[];
    allData.push(...batch);

    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allData.map((p) => mapProductRow(p));
}

export async function getProductWithImage(id: number): Promise<Product | null> {
  const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();

  if (error || !data) return null;
  return mapProductRow(data as ProductRowLight, true);
}

export async function getProductById(id: number): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS_LIGHT)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    console.error('Erreur lors de la récupération du produit:', error);
    return null;
  }

  return mapProductRow(data as ProductRowLight);
}

export async function createProduct(
  product: Omit<Product, 'id' | 'prix_ttc'>
): Promise<{ success: boolean; id?: number; error?: string }> {
  try {
    const parsed = productCreateSchema.safeParse(product);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message ?? 'Données produit invalides' };
    }
    const valid = parsed.data;

    requireActiveCompanyId();
    const { data, error } = await supabase
      .from('products')
      .insert(
        withCompany({
          name: valid.name,
          sku: valid.sku,
          category: valid.category,
          fournisseur: valid.fournisseur || null,
          size: valid.size || null,
          quantity: 0,
          price: valid.price,
          remise: valid.remise || 0,
          min_stock: valid.min_stock,
          image: null,
          color: valid.color || null,
          subject_to_fodec: valid.subject_to_fodec ?? false,
        })
      )
      .select()
      .single();

    if (error) {
      console.error('Erreur lors de la création du produit:', error);
      if (error.code === '23505') {
        return { success: false, error: 'Ce code article existe déjà' };
      }
      return { success: false, error: error.message };
    }

    if (valid.image) {
      const imagePath = await persistProductImageIfInline(valid.image, `product-${data.id}.webp`);
      if (imagePath) {
        const { error: imageError } = await supabase
          .from('products')
          .update({ image: imagePath })
          .eq('id', data.id);
        if (imageError) {
          console.error('Erreur image produit:', imageError);
        }
      }
    }

    if (valid.quantity > 0) {
      const stockResult = await createStockTransaction({
        product_id: data.id,
        product_name: valid.name,
        type: 'IN',
        quantity: valid.quantity,
        date: new Date().toISOString(),
        note: 'Stock initial',
      });
      if (!stockResult.success) {
        return {
          success: true,
          id: data.id,
          error: `Article créé, mais le stock initial n'a pas pu être enregistré: ${stockResult.error}`,
        };
      }
    }

    return { success: true, id: data.id };
  } catch (error: unknown) {
    console.error('Erreur lors de la création du produit:', error);
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    return { success: false, error: message };
  }
}

export async function updateProduct(id: number, product: Partial<Product>): Promise<void> {
  if (product.quantity !== undefined) {
    throw new Error('La quantité doit être modifiée via une transaction stock (createTransaction).');
  }

  const updateData: Record<string, unknown> = {};

  if (product.name !== undefined) updateData.name = product.name;
  if (product.sku !== undefined) updateData.sku = product.sku;
  if (product.category !== undefined) updateData.category = product.category;
  if (product.fournisseur !== undefined) updateData.fournisseur = product.fournisseur || null;
  if (product.size !== undefined) updateData.size = product.size || null;
  if (product.price !== undefined) updateData.price = product.price;
  if (product.remise !== undefined) updateData.remise = product.remise;
  if (product.min_stock !== undefined) updateData.min_stock = product.min_stock;
  if (product.subject_to_fodec !== undefined) updateData.subject_to_fodec = product.subject_to_fodec;
  if (product.image !== undefined) {
    try {
      updateData.image = product.image
        ? await persistProductImageIfInline(product.image, `product-${id}.webp`)
        : null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error("Erreur lors du téléversement de l'image produit:", error);
      throw new Error(
        message.toLowerCase().includes('failed to fetch')
          ? "Impossible d'envoyer l'image. Vérifiez votre connexion et réessayez."
          : `Impossible d'enregistrer l'image : ${message}`
      );
    }
  }
  if (product.color !== undefined) updateData.color = product.color || null;

  const { error } = await supabase.from('products').update(updateData).eq('id', id);

  if (error) {
    console.error('Erreur lors de la mise à jour du produit:', error);
    throw new Error(error.message);
  }
}

export async function deleteProduct(id: number): Promise<void> {
  const { error } = await supabase.rpc('delete_product', {
    p_product_id: id,
  });

  if (error) {
    console.error('Erreur lors de la suppression du produit:', error);
    throw new Error(error.message || 'Erreur lors de la suppression du produit');
  }
}

export async function getLowStockProducts(): Promise<Product[]> {
  let query = supabase.from('products').select(PRODUCT_COLUMNS_LIGHT).order('quantity', { ascending: true });

  const companyId = getActiveCompanyId();
  if (companyId) query = filterByCompanyId(query, companyId);

  const { data, error } = await query;

  if (error) {
    console.error('Erreur lors de la récupération des produits en stock faible:', error);
    return [];
  }

  return (data as ProductRowLight[])
    .filter((p) => p.quantity <= p.min_stock)
    .map((p) => mapProductRow(p));
}
