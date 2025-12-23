import { Product, Transaction } from '@/types';
import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

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
      console.error('Error calling Gemini:', error);
      throw error;
    }

    return data.response;
  } catch (error) {
    console.error('Gemini API error:', error);
    // Return fallback analysis if API fails
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

⚠️ *Note: Cette analyse est basée sur un mode hors-ligne. Connectez-vous à l'API Gemini pour des analyses plus détaillées.*`;
  }
};

export const chatWithInventory = async (
  message: string,
  products: Product[],
  chatHistory: ChatMessage[]
): Promise<string> => {
  const inventoryContext = products.map(p => 
    `${p.name} (${p.sku}): ${p.quantity} unités, ${p.price.toFixed(3)} TND, Catégorie: ${p.category}, Fournisseur: ${p.fournisseur || 'N/A'}`
  ).join('\n');

  const historyContext = chatHistory.slice(-5).map(m => 
    `${m.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${m.content}`
  ).join('\n');

  const prompt = `Contexte de l'inventaire:
${inventoryContext}

Historique de conversation:
${historyContext}

Question de l'utilisateur: ${message}

Réponds de manière concise et utile en français.`;

  try {
    const { data, error } = await supabase.functions.invoke('gemini-chat', {
      body: { prompt, type: 'chat' }
    });

    if (error) {
      console.error('Error calling Gemini:', error);
      throw error;
    }

    return data.response;
  } catch (error) {
    console.error('Chat API error:', error);
    
    // Fallback to simple keyword-based responses
    const messageLower = message.toLowerCase();

    if (messageLower.includes('rupture') || messageLower.includes('stock')) {
      const outOfStock = products.filter(p => p.quantity === 0);
      if (outOfStock.length === 0) {
        return "Excellente nouvelle ! Aucun produit n'est actuellement en rupture de stock.";
      }
      return `Les produits suivants sont en rupture de stock:\n${outOfStock.map(p => `- ${p.name} (${p.sku})`).join('\n')}`;
    }

    if (messageLower.includes('valeur') || messageLower.includes('total')) {
      const totalValue = products.reduce((sum, p) => sum + p.price * p.quantity, 0);
      return `La valeur totale de votre inventaire est de **${totalValue.toFixed(3)} TND**.`;
    }

    return "Je suis l'assistant IA de Grosafe. L'API Gemini n'est pas disponible actuellement, mais vous pouvez me poser des questions simples sur votre inventaire.";
  }
};
