import { Product, Transaction } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { createProductGroup, createVariant } from './productGroupService';
import { createTransaction as dbCreateTransaction } from './dbService';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AIResponse {
  response: string;
  tool_calls?: ToolCall[];
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

// Execute a tool call and return the result
export const executeToolCall = async (toolCall: ToolCall): Promise<ActionResult> => {
  const { name, arguments: args } = toolCall;

  try {
    switch (name) {
      case 'create_product_group': {
        const result = await createProductGroup({
          name: args.name as string,
          category: args.category as string,
          base_sku: (args.base_sku as string) || null,
          fournisseur: (args.fournisseur as string) || null,
          image: null,
          min_stock: (args.min_stock as number) || 5
        });
        
        if (result.success) {
          return {
            success: true,
            message: `✅ Produit "${args.name}" créé dans la catégorie "${args.category}"`,
            data: { id: result.id }
          };
        }
        return { success: false, message: `❌ Erreur: ${result.error}` };
      }

      case 'create_variant': {
        const result = await createVariant(
          args.product_group_id as number,
          {
            sku: args.sku as string,
            size: args.size as string | undefined,
            color: args.color as string | undefined,
            quantity: args.quantity as number,
            price: args.price as number,
            remise: 0
          }
        );
        
        if (result.success) {
          return {
            success: true,
            message: `✅ Variante créée avec SKU "${args.sku}"`,
            data: { id: result.id }
          };
        }
        return { success: false, message: `❌ Erreur: ${result.error}` };
      }

      case 'create_fournisseur': {
        const { error } = await supabase.from('fournisseurs').insert({
          nom: args.nom as string,
          specialite: args.specialite as string,
          phone: (args.phone as string) || null,
          location: (args.location as string) || null,
          matricule_fiscale: (args.matricule_fiscale as string) || null
        });
        
        if (!error) {
          return {
            success: true,
            message: `✅ Fournisseur "${args.nom}" ajouté avec la spécialité "${args.specialite}"`
          };
        }
        return { success: false, message: `❌ Erreur: ${error.message}` };
      }

      case 'create_transaction': {
        const productId = args.product_id as number;
        // Get product name first
        const { data: product } = await supabase
          .from('products')
          .select('name, quantity')
          .eq('id', productId)
          .single();
        
        if (!product) {
          return { success: false, message: `❌ Produit non trouvé` };
        }

        // Check stock for OUT transactions
        if (args.type === 'OUT' && product.quantity < (args.quantity as number)) {
          return { 
            success: false, 
            message: `❌ Stock insuffisant. Disponible: ${product.quantity} unités` 
          };
        }

        const result = await dbCreateTransaction({
          product_id: productId,
          product_name: product.name,
          type: args.type as 'IN' | 'OUT',
          quantity: args.quantity as number,
          date: new Date().toISOString(),
          note: (args.note as string) || `Mouvement via Assistant IA`
        });
        
        if (result.success) {
          const typeLabel = args.type === 'IN' ? 'Entrée' : 'Sortie';
          return {
            success: true,
            message: `✅ ${typeLabel} de ${args.quantity} unités pour "${product.name}" enregistrée`
          };
        }
        return { success: false, message: `❌ Erreur: ${result.error}` };
      }

      case 'search_products': {
        let query = supabase.from('products').select('id, name, sku, category, quantity, price');
        
        const searchTerm = args.query as string;
        if (searchTerm) {
          query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`);
        }
        if (args.category) {
          query = query.ilike('category', args.category as string);
        }
        
        const { data, error } = await query.limit(10);
        
        if (!error && data && data.length > 0) {
          const results = data.map(p => `• ${p.name} (${p.sku}): ${p.quantity} unités - ${p.price.toFixed(3)} TND`).join('\n');
          return {
            success: true,
            message: `📦 Résultats pour "${searchTerm}":\n${results}`,
            data
          };
        }
        return { 
          success: true, 
          message: `🔍 Aucun produit trouvé pour "${searchTerm}"` 
        };
      }

      case 'get_stock_summary': {
        const { data: products } = await supabase
          .from('products')
          .select('name, quantity, price, min_stock, category');
        
        if (!products) {
          return { success: false, message: '❌ Impossible de charger l\'inventaire' };
        }

        const totalValue = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
        const outOfStock = products.filter(p => p.quantity === 0);
        const lowStock = products.filter(p => p.quantity > 0 && p.quantity <= p.min_stock);
        const categories = [...new Set(products.map(p => p.category))];

        const summary = `📊 **Résumé de l'inventaire**
        
• **Valeur totale**: ${totalValue.toFixed(3)} TND
• **Nombre de produits**: ${products.length}
• **Catégories**: ${categories.length}
• **En rupture**: ${outOfStock.length} produits
• **Stock faible**: ${lowStock.length} produits

${lowStock.length > 0 ? `\n⚠️ **Alertes stock faible**:\n${lowStock.slice(0, 5).map(p => `• ${p.name}: ${p.quantity}/${p.min_stock}`).join('\n')}` : ''}
${outOfStock.length > 0 ? `\n🚨 **En rupture**:\n${outOfStock.slice(0, 5).map(p => `• ${p.name}`).join('\n')}` : ''}`;

        return { success: true, message: summary };
      }

      default:
        return { success: false, message: `❌ Action non reconnue: ${name}` };
    }
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    return { 
      success: false, 
      message: `❌ Erreur lors de l'exécution: ${error instanceof Error ? error.message : 'Erreur inconnue'}` 
    };
  }
};

export const generateStrategicAnalysis = async (
  products: Product[],
  transactions: Transaction[]
): Promise<string> => {
  const inventorySummary = products.map(p => 
    `- ${p.name} (${p.sku}): ${p.quantity} unités, ${p.price.toFixed(3)} TND, Stock min: ${p.min_stock}`
  ).join('\n');

  const recentMovements = transactions.slice(0, 20).map(t =>
    `- ${t.type === 'IN' ? 'Entrée' : 'Sortie'}: ${t.product_name}, Qté: ${t.quantity}`
  ).join('\n');

  const lowStock = products.filter(p => p.quantity <= p.min_stock);
  const outOfStock = products.filter(p => p.quantity === 0);
  const totalValue = products.reduce((sum, p) => sum + p.price * p.quantity, 0);

  const prompt = `Analyse cet inventaire et fournis une analyse stratégique complète:

## État de l'inventaire:
- Valeur totale: ${totalValue.toFixed(3)} TND
- Nombre de produits: ${products.length}
- Produits en rupture: ${outOfStock.length}
- Produits en stock faible: ${lowStock.length}

## Liste des produits:
${inventorySummary}

## Mouvements récents:
${recentMovements || 'Aucun mouvement récent'}

## Produits en alerte:
${lowStock.length > 0 ? lowStock.map(p => `- ${p.name}: ${p.quantity}/${p.min_stock} unités`).join('\n') : 'Aucun produit en alerte'}

Fournis une analyse stratégique avec:
1. Résumé de la situation
2. Alertes prioritaires
3. Recommandations d'action
4. Opportunités d'optimisation`;

  try {
    const { data, error } = await supabase.functions.invoke('gemini-chat', {
      body: { prompt, type: 'analysis' }
    });

    if (error) {
      console.error('Error calling AI:', error);
      throw error;
    }

    return data.response;
  } catch (error) {
    console.error('AI API error:', error);
    return `## 📊 Analyse Stratégique de l'Inventaire Grosafe

### État Actuel
- **Valeur totale du stock**: ${totalValue.toFixed(3)} TND
- **Nombre de produits**: ${products.length}
- **Produits en rupture**: ${outOfStock.length}
- **Produits en stock faible**: ${lowStock.length}

### ⚠️ Alertes Prioritaires
${lowStock.length > 0 ? lowStock.map(p => `- **${p.name}**: Seulement ${p.quantity} unités (minimum: ${p.min_stock})`).join('\n') : '- Aucune alerte de stock faible'}

### 💡 Recommandations
1. **Réapprovisionnement urgent**: ${outOfStock.length > 0 ? outOfStock.map(p => p.name).join(', ') : 'Aucun produit en rupture'}
2. **Optimisation des stocks**: Considérez d'augmenter le stock minimum pour les articles à forte rotation

*Analyse générée le ${new Date().toLocaleDateString('fr-TN')}*

⚠️ *Note: Cette analyse est basée sur un mode hors-ligne.*`;
  }
};

export const chatWithInventory = async (
  message: string,
  products: Product[],
  chatHistory: ChatMessage[]
): Promise<AIResponse> => {
  const inventoryContext = products.slice(0, 50).map(p => 
    `${p.name} (ID:${p.id}, SKU:${p.sku}): ${p.quantity} unités, ${p.price.toFixed(3)} TND, Catégorie: ${p.category}, Fournisseur: ${p.fournisseur || 'N/A'}`
  ).join('\n');

  const historyContext = chatHistory.slice(-5).map(m => 
    `${m.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${m.content}`
  ).join('\n');

  // Get available categories
  const categories = [...new Set(products.map(p => p.category))];

  const prompt = `Contexte de l'inventaire (${products.length} produits):
${inventoryContext}

Catégories disponibles: ${categories.join(', ')}

Historique de conversation récent:
${historyContext}

Demande de l'utilisateur: ${message}

IMPORTANT: Si l'utilisateur demande de créer un produit, une catégorie, un fournisseur ou un mouvement de stock, utilise les outils disponibles pour effectuer l'action. Sinon, réponds de manière informative.`;

  try {
    const { data, error } = await supabase.functions.invoke('gemini-chat', {
      body: { prompt, type: 'chat' }
    });

    if (error) {
      console.error('Error calling AI:', error);
      throw error;
    }

    return {
      response: data.response,
      tool_calls: data.tool_calls
    };
  } catch (error) {
    console.error('Chat API error:', error);
    
    const messageLower = message.toLowerCase();

    if (messageLower.includes('rupture') || messageLower.includes('stock')) {
      const outOfStock = products.filter(p => p.quantity === 0);
      if (outOfStock.length === 0) {
        return { response: "Excellente nouvelle ! Aucun produit n'est actuellement en rupture de stock." };
      }
      return { response: `Les produits suivants sont en rupture de stock:\n${outOfStock.map(p => `- ${p.name} (${p.sku})`).join('\n')}` };
    }

    if (messageLower.includes('valeur') || messageLower.includes('total')) {
      const totalValue = products.reduce((sum, p) => sum + p.price * p.quantity, 0);
      return { response: `La valeur totale de votre inventaire est de **${totalValue.toFixed(3)} TND**.` };
    }

    return { response: "Je suis l'assistant IA de Grosafe. L'API n'est pas disponible actuellement, mais vous pouvez me poser des questions simples sur votre inventaire." };
  }
};
