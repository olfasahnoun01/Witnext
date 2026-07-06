/** @deprecated Use Finance → Documents sources → Suivi des opérations (CommercialOperationsTrackerPanel). */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatAppDate, formatAppDateTime, formatAppMonthYear } from '@/lib/formatAppDate';
import { supabase } from '@/integrations/supabase/client';
import { 
  Search, 
  Clock, 
  Truck, 
  PackageCheck, 
  CheckCircle2, 
  ArrowRight,
  ReceiptText,
  AlertCircle,
  Package
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UnifiedDocument } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PipelineItem {
  bc: UnifiedDocument;
  quotes: UnifiedDocument[];
  orders: UnifiedDocument[];
  receipts: UnifiedDocument[];
  deliveries: UnifiedDocument[];
  currentStep: number;
}

export const SalesPipeline = () => {
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pipelineData, setPipelineData] = useState<PipelineItem[]>([]);

  const loadPipeline = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch all BC_CLIENT
      const { data: bcs, error: bcsError } = await supabase
        .from('documents')
        .select('*, clients(nom)')
        .eq('type', 'BC_CLIENT')
        .order('created_at', { ascending: false });

      if (bcsError) throw bcsError;

      // 2. Fetch all related documents to build the chain
      // We'll fetch everything that has a parent_id to map them in memory
      const { data: allDocsRaw, error: docsError } = await supabase
        .from('documents')
        .select('*')
        .not('parent_id', 'is', null);

      if (docsError) throw docsError;

      // Ensure all docs follow the UnifiedDocument interface (especially metadata type)
      const allDocs: UnifiedDocument[] = (allDocsRaw || []).map(d => ({
        ...d,
        metadata: d.metadata as any
      })) as any[];

      // 3. Build the mapping
      const mappedResults: PipelineItem[] = bcs.map(bc => {
        const { clients, ...bcData } = bc;
        const bcInternal: UnifiedDocument = { 
          ...(bcData as any), 
          client_name: clients?.nom,
          metadata: bcData.metadata as any
        };
        
        // Find children of this BC
        const directChildren = allDocs.filter(d => d.parent_id === bc.id);
        
        // Stage 1: Quotes
        const quotes = directChildren.filter(d => d.type === 'DEVIS_FOURNISSEUR');
        
        // Stage 2: Orders (linked to quotes)
        const quoteIds = quotes.map(q => q.id);
        const orders = allDocs.filter(d => d.type === 'BC_FOURNISSEUR' && quoteIds.includes(d.parent_id));
        
        // Stage 3: Receipts (linked to orders)
        const orderIds = orders.map(o => o.id);
        const receipts = allDocs.filter(d => d.type === 'BE' && orderIds.includes(d.parent_id) && d.status === 'VALIDATED');
        
        // Stage 4: Deliveries/Billing (linked to original BC)
        const deliveries = directChildren.filter(d => d.type === 'BL_CLIENT' || d.type === 'FACTURE');

        // Calculate current step (1 to 4)
        let step = 0;
        if (deliveries.length > 0) step = 4;
        else if (receipts.length > 0) step = 3;
        else if (orders.length > 0) step = 2;
        else if (quotes.length > 0) step = 1;

        return {
          bc: bcInternal,
          quotes,
          orders,
          receipts,
          deliveries,
          currentStep: step
        };
      });

      setPipelineData(mappedResults);
    } catch (error: any) {
      toast.error("Erreur pipeline : " + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPipeline();
  }, [loadPipeline]);

  const filteredData = useMemo(() => {
    return pipelineData.filter(item => 
      item.bc.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.bc.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [pipelineData, searchTerm]);

  const PipelineStep = ({ 
    active, 
    completed, 
    icon: Icon, 
    label, 
    count 
  }: { 
    active: boolean; 
    completed: boolean; 
    icon: any; 
    label: string;
    count?: number;
  }) => (
    <div className={cn(
      "flex flex-col items-center gap-2 relative flex-1",
      completed ? "text-green-600" : (active ? "text-blue-600" : "text-muted-foreground/40")
    )}>
      <div className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center border-2 z-10 bg-background transition-all duration-300",
        completed ? "border-green-600 bg-green-50" : (active ? "border-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.2)]" : "border-muted/20")
      )}>
        {completed ? <CheckCircle2 className="w-6 h-6" /> : <Icon className={cn("w-5 h-5", active && "animate-pulse")} />}
      </div>
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-tighter">{label}</p>
        {count !== undefined && count > 0 && (
          <Badge variant="outline" className="h-4 text-[9px] px-1 mt-0.5">{count} doc(s)</Badge>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-muted/20 p-4 rounded-xl border border-dashed">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Pipeline de Suivi des Commandes
          </h2>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="N° Commande ou Client..." 
            className="pl-9 h-9 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="py-20 text-center animate-pulse">Chargement du pipeline...</div>
        ) : filteredData.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed rounded-2xl bg-muted/10">
            <Package className="w-12 h-12 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-muted-foreground italic">Aucune commande en cours dans le pipeline.</p>
          </div>
        ) : filteredData.map((item) => (
          <Card key={item.bc.id} className="overflow-hidden border-l-4 border-l-primary group">
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row items-stretch">
                {/* BC Info */}
                <div className="p-4 bg-muted/5 min-w-[200px] border-r border-muted/20 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">BC CLIENT</span>
                    <span className="text-xs text-muted-foreground">{formatAppDate(item.bc.created_at)}</span>
                  </div>
                  <h3 className="font-bold text-lg">{item.bc.numero}</h3>
                  <p className="text-sm text-muted-foreground truncate">{item.bc.client_name || "Client Inconnu"}</p>
                </div>

                {/* Pipeline Steps */}
                <div className="flex-1 p-6 flex items-start relative bg-background">
                  {/* Progress Line */}
                  <div className="absolute top-[35px] left-[10%] right-[10%] h-[2px] bg-muted/20 -z-0" />
                  <div 
                    className="absolute top-[35px] left-[10%] h-[2px] bg-green-500 transition-all duration-500 -z-0" 
                    style={{ width: `${Math.max(0, (item.currentStep - 1) * 26.6)}%` }}
                  />

                  <PipelineStep 
                    label="Sourcing" 
                    icon={Clock} 
                    active={item.currentStep === 1}
                    completed={item.currentStep > 1}
                    count={item.quotes.length}
                  />
                  <PipelineStep 
                    label="Commandé" 
                    icon={Truck} 
                    active={item.currentStep === 2}
                    completed={item.currentStep > 2}
                    count={item.orders.length}
                  />
                  <PipelineStep 
                    label="En Stock" 
                    icon={PackageCheck} 
                    active={item.currentStep === 3}
                    completed={item.currentStep > 3}
                    count={item.receipts.length}
                  />
                  <PipelineStep 
                    label="Clôture" 
                    icon={ReceiptText} 
                    active={item.currentStep === 4}
                    completed={item.currentStep > 4}
                    count={item.deliveries.length}
                  />
                </div>

                {/* Action / Quick Info */}
                <div className="p-4 border-l border-muted/20 min-w-[150px] flex items-center justify-center bg-muted/5">
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Status Global</p>
                    <Badge className={cn(
                      item.currentStep === 4 ? "bg-green-600" : "bg-blue-600"
                    )}>
                      {item.currentStep === 4 ? "Terminé" : `${Math.round((item.currentStep / 4) * 100)}% Effectué`}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// Simple icon for the dashboard
const TrendingUp = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);
