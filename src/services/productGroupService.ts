import { supabase } from '@/integrations/supabase/client';
import { ProductGroup, Product, ProductGroupFournisseur } from '@/types';

// Fetch product groups by category with variant aggregations
export const getProductGroupsByCategory = async (category: string): Promise<ProductGroup[]> => {
  try {
    // Handle "Non catégorisé" specially
    let query = supabase
      .from('product_groups')
      .select('*');
    
    if (category === 'Non catégorisé') {
      query = query.or('category.is.null,category.eq.Non catégorisé,category.eq.');
    } else {
      query = query.ilike('category', category);
    }
    
    const { data: groups, error: groupsError } = await query.order('name');
    
    if (groupsError) throw groupsError;
    if (!groups || groups.length === 0) return [];
    
    // Get variant aggregations for each group
    const groupIds = groups.map(g => g.id);
    
    const [variantsResult, fournisseursResult] = await Promise.all([
      supabase
        .from('products')
        .select('product_group_id, quantity, color, size')
        .in('product_group_id', groupIds),
      supabase
        .from('product_group_fournisseurs')
        .select('id, product_group_id, fournisseur_name, prix_ttc, fiche_technique_url')
        .in('product_group_id', groupIds)
    ]);
    
    if (variantsResult.error) throw variantsResult.error;
    
    // Aggregate variant data
    const aggregations: Record<number, {
      variant_count: number;
      total_stock: number;
      colors: Set<string>;
      sizes: Set<string>;
    }> = {};
    
    variantsResult.data?.forEach(v => {
      if (!v.product_group_id) return;
      
      if (!aggregations[v.product_group_id]) {
        aggregations[v.product_group_id] = {
          variant_count: 0,
          total_stock: 0,
          colors: new Set(),
          sizes: new Set()
        };
      }
      
      const agg = aggregations[v.product_group_id];
      agg.variant_count++;
      agg.total_stock += v.quantity || 0;
      if (v.color) agg.colors.add(v.color);
      if (v.size) agg.sizes.add(v.size);
    });
    
    // Group fournisseurs by product_group_id
    const fournisseursByGroup: Record<number, ProductGroupFournisseur[]> = {};
    fournisseursResult.data?.forEach(f => {
      if (!fournisseursByGroup[f.product_group_id]) {
        fournisseursByGroup[f.product_group_id] = [];
      }
      fournisseursByGroup[f.product_group_id].push({
        id: f.id,
        product_group_id: f.product_group_id,
        fournisseur_name: f.fournisseur_name,
        prix: Number(f.prix_ttc),
        remise: 0,
        prix_ttc: Number(f.prix_ttc),
        fiche_technique_url: f.fiche_technique_url || null
      });
    });
    
    // Merge aggregations with groups
    return groups.map(g => ({
      id: g.id,
      name: g.name,
      category: g.category,
      base_sku: g.base_sku,
      fournisseur: g.fournisseur,
      image: g.image,
      min_stock: g.min_stock,
      created_at: g.created_at,
      updated_at: g.updated_at,
      variant_count: aggregations[g.id]?.variant_count || 0,
      total_stock: aggregations[g.id]?.total_stock || 0,
      colors: aggregations[g.id] ? Array.from(aggregations[g.id].colors) : [],
      sizes: aggregations[g.id] ? Array.from(aggregations[g.id].sizes) : [],
      fournisseurs: fournisseursByGroup[g.id] || []
    }));
  } catch (error) {
    console.error('Error fetching product groups:', error);
    return [];
  }
};

// Get single product group with its variants
export const getProductGroupById = async (id: number): Promise<ProductGroup | null> => {
  try {
    const { data: group, error: groupError } = await supabase
      .from('product_groups')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (groupError || !group) return null;
    
    const { data: variants, error: variantsError } = await supabase
      .from('products')
      .select('quantity, color, size')
      .eq('product_group_id', id);
    
    if (variantsError) throw variantsError;
    
    const colors = new Set<string>();
    const sizes = new Set<string>();
    let total_stock = 0;
    
    variants?.forEach(v => {
      total_stock += v.quantity || 0;
      if (v.color) colors.add(v.color);
      if (v.size) sizes.add(v.size);
    });
    
    return {
      id: group.id,
      name: group.name,
      category: group.category,
      base_sku: group.base_sku,
      fournisseur: group.fournisseur,
      image: group.image,
      min_stock: group.min_stock,
      created_at: group.created_at,
      updated_at: group.updated_at,
      variant_count: variants?.length || 0,
      total_stock,
      colors: Array.from(colors),
      sizes: Array.from(sizes)
    };
  } catch (error) {
    console.error('Error fetching product group:', error);
    return null;
  }
};

// Get variants for a product group
export const getVariantsByGroupId = async (groupId: number): Promise<Product[]> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id,name,sku,category,fournisseur,size,color,quantity,price,remise,prix_ttc,min_stock,image,product_group_id,fiche_technique_url,created_at')
      .eq('product_group_id', groupId)
      .order('size')
      .order('color');
    
    if (error) throw error;
    
    return (data || []).map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      fournisseur: p.fournisseur || '',
      size: p.size || '',
      quantity: p.quantity,
      price: Number(p.price),
      remise: Number(p.remise) || 0,
      prix_ttc: Number(p.prix_ttc) || Number(p.price),
      min_stock: p.min_stock,
      image: p.image || null,
      color: p.color || null,
      product_group_id: p.product_group_id,
      fiche_technique_url: p.fiche_technique_url || null,
      created_at: p.created_at ?? null,
    }));
  } catch (error) {
    console.error('Error fetching variants:', error);
    return [];
  }
};

// Count product groups by category
export const getProductGroupCountsByCategory = async (): Promise<Record<string, number>> => {
  try {
    const { data, error } = await supabase
      .from('product_groups')
      .select('category');
    
    if (error) throw error;
    
    const counts: Record<string, number> = {};
    data?.forEach(g => {
      const cat = g.category || 'Non catégorisé';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    
    return counts;
  } catch (error) {
    console.error('Error fetching group counts:', error);
    return {};
  }
};

// Create a new product group
export const createProductGroup = async (group: Omit<ProductGroup, 'id' | 'created_at' | 'updated_at' | 'variant_count' | 'total_stock' | 'colors' | 'sizes'>): Promise<{ success: boolean; id?: number; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('product_groups')
      .insert({
        name: group.name,
        category: group.category,
        base_sku: group.base_sku,
        fournisseur: group.fournisseur,
        image: group.image,
        min_stock: group.min_stock
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Ce produit existe déjà dans cette catégorie' };
      }
      return { success: false, error: error.message };
    }
    
    return { success: true, id: data.id };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur inconnue' };
  }
};

// Update a product group
export const updateProductGroup = async (id: number, updates: Partial<ProductGroup>): Promise<void> => {
  const updateData: Record<string, unknown> = {};
  
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.base_sku !== undefined) updateData.base_sku = updates.base_sku;
  if (updates.fournisseur !== undefined) updateData.fournisseur = updates.fournisseur;
  if (updates.image !== undefined) updateData.image = updates.image;
  if (updates.min_stock !== undefined) updateData.min_stock = updates.min_stock;
  
  const { error } = await supabase
    .from('product_groups')
    .update(updateData)
    .eq('id', id);
  
  if (error) {
    console.error('Error updating product group:', error);
    throw error;
  }
};

// Delete a product group (variants will have product_group_id set to NULL)
export const deleteProductGroup = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from('product_groups')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting product group:', error);
    throw error;
  }
};

// Create a variant for a product group
export const createVariant = async (groupId: number, variant: {
  sku: string;
  size?: string;
  color?: string;
  quantity: number;
  price: number;
  remise?: number;
}): Promise<{ success: boolean; id?: number; error?: string }> => {
  try {
    // Get the group to copy base data
    const group = await getProductGroupById(groupId);
    if (!group) {
      return { success: false, error: 'Groupe de produits non trouvé' };
    }
    
    // Create the product with zero stock; opening stock is applied atomically
    // via the create_stock_transaction RPC so the ledger and products.quantity
    // stay consistent (direct writes to products.quantity / transactions are
    // blocked or unaudited under the hardened stock policies).
    const { data, error } = await supabase
      .from('products')
      .insert({
        name: group.name,
        sku: variant.sku,
        category: group.category,
        fournisseur: group.fournisseur,
        size: variant.size || null,
        color: variant.color || null,
        quantity: 0,
        price: variant.price,
        remise: variant.remise || 0,
        min_stock: group.min_stock,
        image: group.image,
        product_group_id: groupId
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Ce code article existe déjà' };
      }
      return { success: false, error: error.message };
    }

    // Record opening stock through the atomic ledger RPC (skip when zero).
    if (variant.quantity > 0) {
      const { error: stockError } = await supabase.rpc('create_stock_transaction', {
        p_product_id: data.id,
        p_product_name: group.name,
        p_type: 'IN',
        p_quantity: variant.quantity,
        p_date: new Date().toISOString(),
        p_note: 'Stock initial (variante)',
      });
      if (stockError) {
        return {
          success: true,
          id: data.id,
          error: `Article créé, mais le stock initial n'a pas pu être enregistré: ${stockError.message}`,
        };
      }
    }

    return { success: true, id: data.id };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur inconnue' };
  }
};
