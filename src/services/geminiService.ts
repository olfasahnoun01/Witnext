import { Product, Transaction } from '@/types';

const GEMINI_API_KEY = 'YOUR_API_KEY'; // User should add their own key

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

  // For demo purposes, return a mock analysis
  // In production, this would call the actual Gemini API
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
3. **Analyse des tendances**: Les mouvements récents montrent une activité ${transactions.length > 10 ? 'soutenue' : 'modérée'}

### 📈 Opportunités
- Négocier des remises volume avec les fournisseurs pour les articles à forte demande
- Établir des alertes automatiques pour le réapprovisionnement

*Analyse générée le ${new Date().toLocaleDateString('fr-TN')}*`;
};

export const chatWithInventory = async (
  message: string,
  products: Product[],
  _chatHistory: ChatMessage[]
): Promise<string> => {
  const messageLower = message.toLowerCase();

  // Simple keyword-based responses for demo
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

  if (messageLower.includes('catégorie') || messageLower.includes('categorie')) {
    const categories: Record<string, number> = {};
    products.forEach(p => {
      categories[p.category] = (categories[p.category] || 0) + 1;
    });
    return `Répartition par catégorie:\n${Object.entries(categories).map(([cat, count]) => `- ${cat}: ${count} produits`).join('\n')}`;
  }

  if (messageLower.includes('fournisseur')) {
    const suppliers = [...new Set(products.map(p => p.fournisseur))];
    return `Vos fournisseurs:\n${suppliers.map(s => `- ${s}`).join('\n')}`;
  }

  return "Je suis l'assistant IA de Grosafe. Vous pouvez me poser des questions sur votre inventaire, comme:\n- Quels produits sont en rupture?\n- Quelle est la valeur totale du stock?\n- Quelles sont les catégories?\n- Qui sont mes fournisseurs?";
};
