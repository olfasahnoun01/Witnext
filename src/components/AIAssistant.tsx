import { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  Loader2,
  User
} from 'lucide-react';
import { getAllProducts, getAllTransactions } from '@/services/dbService';
import { generateStrategicAnalysis, chatWithInventory, ChatMessage } from '@/services/geminiService';
import { Product, Transaction } from '@/types';
import { Button } from '@/components/ui/button';

export const AIAssistant = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Bonjour! Je suis l'assistant IA de Grosafe. Je peux analyser votre inventaire et répondre à vos questions. Essayez:\n\n- \"Quels produits sont en rupture?\"\n- \"Quelle est la valeur totale du stock?\"\n- \"Quelles sont les catégories?\"\n\nOu cliquez sur \"Analyse Stratégique\" pour un rapport complet."
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisContent, setAnalysisContent] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      const [productsData, transactionsData] = await Promise.all([
        getAllProducts(),
        getAllTransactions()
      ]);
      setProducts(productsData);
      setTransactions(transactionsData);
    };
    loadData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleGenerateAnalysis = async () => {
    setIsLoading(true);
    try {
      const analysis = await generateStrategicAnalysis(products, transactions);
      setAnalysisContent(analysis);
      setShowAnalysis(true);
    } catch (error) {
      console.error('Error generating analysis:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: inputMessage };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await chatWithInventory(inputMessage, products, messages);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Désolé, une erreur s'est produite. Veuillez réessayer." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strategic Analysis */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-primary/10">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Analyse Stratégique</h3>
              <p className="text-sm text-muted-foreground">Analyse complète de votre inventaire</p>
            </div>
          </div>

          <Button 
            onClick={handleGenerateAnalysis} 
            disabled={isLoading}
            className="w-full mb-4"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Génération...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Générer Analyse IA
              </>
            )}
          </Button>

          {showAnalysis && (
            <div className="p-4 rounded-xl bg-muted/50 max-h-96 overflow-y-auto">
              <div className="prose prose-sm max-w-none text-foreground">
                {analysisContent.split('\n').map((line, i) => {
                  if (line.startsWith('## ')) {
                    return <h2 key={i} className="text-lg font-bold text-foreground mt-4 mb-2">{line.replace('## ', '')}</h2>;
                  }
                  if (line.startsWith('### ')) {
                    return <h3 key={i} className="text-md font-semibold text-foreground mt-3 mb-1">{line.replace('### ', '')}</h3>;
                  }
                  if (line.startsWith('- **')) {
                    const boldPart = line.match(/\*\*(.*?)\*\*/)?.[1] || '';
                    const rest = line.replace(/- \*\*.*?\*\*:?/, '').trim();
                    return (
                      <p key={i} className="text-sm text-muted-foreground ml-4 my-1">
                        • <strong className="text-foreground">{boldPart}</strong>{rest ? `: ${rest}` : ''}
                      </p>
                    );
                  }
                  if (line.startsWith('- ')) {
                    return <p key={i} className="text-sm text-muted-foreground ml-4 my-1">• {line.replace('- ', '')}</p>;
                  }
                  if (line.startsWith('*')) {
                    return <p key={i} className="text-xs text-muted-foreground italic mt-2">{line.replace(/\*/g, '')}</p>;
                  }
                  if (line.match(/^\d+\./)) {
                    return <p key={i} className="text-sm text-muted-foreground ml-4 my-1">{line}</p>;
                  }
                  if (line.trim()) {
                    return <p key={i} className="text-sm text-muted-foreground my-1">{line}</p>;
                  }
                  return null;
                })}
              </div>
            </div>
          )}
        </div>

        {/* Chat Interface */}
        <div className="bg-card rounded-xl border border-border flex flex-col h-[500px]">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <div className="p-2 rounded-xl bg-success/10">
              <Bot className="w-5 h-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Chat Inventaire</h3>
              <p className="text-xs text-muted-foreground">Posez vos questions sur le stock</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`p-2 rounded-xl h-fit ${
                  msg.role === 'user' ? 'bg-primary/10' : 'bg-muted'
                }`}>
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4 text-primary" />
                  ) : (
                    <Bot className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className={`max-w-[80%] p-3 rounded-xl ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-foreground'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="p-2 rounded-xl bg-muted">
                  <Bot className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="bg-muted p-3 rounded-xl">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Posez votre question sur l'inventaire..."
                className="form-input flex-1"
                disabled={isLoading}
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={isLoading || !inputMessage.trim()}
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Produits Analysés</p>
          <p className="text-2xl font-bold text-foreground">{products.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Mouvements</p>
          <p className="text-2xl font-bold text-foreground">{transactions.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Catégories</p>
          <p className="text-2xl font-bold text-foreground">
            {[...new Set(products.map(p => p.category))].length}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Fournisseurs</p>
          <p className="text-2xl font-bold text-foreground">
            {[...new Set(products.map(p => p.fournisseur))].length}
          </p>
        </div>
      </div>
    </div>
  );
};
