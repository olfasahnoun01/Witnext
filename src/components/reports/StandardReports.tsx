import { memo, useMemo, useState } from 'react';
import { FileText, Download, AlertTriangle, Filter, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Product } from '@/types';
import { generateInventoryPDF, generateLowStockPDF } from '@/utils/pdfGenerator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StandardReportsProps {
  products: Product[];
  lowStockProducts: Product[];
}

interface SupplierOption {
  value: string;
  label: string;
  aliases: string[];
}

const normalizeSupplierName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getLevenshteinDistance = (source: string, target: string) => {
  if (source === target) return 0;
  if (!source.length) return target.length;
  if (!target.length) return source.length;

  const matrix = Array.from({ length: source.length + 1 }, () =>
    Array(target.length + 1).fill(0)
  );

  for (let row = 0; row <= source.length; row += 1) {
    matrix[row][0] = row;
  }

  for (let column = 0; column <= target.length; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row <= source.length; row += 1) {
    for (let column = 1; column <= target.length; column += 1) {
      const substitutionCost = source[row - 1] === target[column - 1] ? 0 : 1;

      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitutionCost
      );
    }
  }

  return matrix[source.length][target.length];
};

const areSupplierNamesEquivalent = (left: string, right: string) => {
  const normalizedLeft = normalizeSupplierName(left);
  const normalizedRight = normalizeSupplierName(right);

  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  const compactLeft = normalizedLeft.replace(/\s+/g, '');
  const compactRight = normalizedRight.replace(/\s+/g, '');

  if (compactLeft === compactRight) return true;

  const sameFirstWord = normalizedLeft.split(' ')[0] === normalizedRight.split(' ')[0];
  const samePrefix = compactLeft.slice(0, 5) === compactRight.slice(0, 5);

  if (!sameFirstWord && !samePrefix) return false;

  const maxLength = Math.max(compactLeft.length, compactRight.length);
  const distanceThreshold = Math.max(2, Math.ceil(maxLength * 0.15));

  return getLevenshteinDistance(compactLeft, compactRight) <= distanceThreshold;
};

const downloadJSON = (data: any, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const StandardReports = memo(({ products, lowStockProducts }: StandardReportsProps) => {
  const totalValue = products.reduce((s, p) => s + p.price * (1 - (p.remise || 0) / 100) * p.quantity, 0);
  const [selectedFournisseur, setSelectedFournisseur] = useState<string>('');
  const [isExportingTransactions, setIsExportingTransactions] = useState(false);
  const [isExportingDocuments, setIsExportingDocuments] = useState(false);

  const supplierOptions = useMemo(() => {
    const groups: Array<{ value: string; label: string; aliases: Set<string> }> = [];

    products.forEach(({ fournisseur }) => {
      const supplierName = fournisseur?.trim();
      if (!supplierName) return;

      const normalizedName = normalizeSupplierName(supplierName);
      const existingGroup = groups.find(group =>
        Array.from(group.aliases).some(alias => areSupplierNamesEquivalent(alias, normalizedName))
      );

      if (existingGroup) {
        existingGroup.aliases.add(normalizedName);

        if (
          supplierName.length > existingGroup.label.length ||
          (supplierName.length === existingGroup.label.length &&
            supplierName.localeCompare(existingGroup.label, 'fr', { sensitivity: 'base' }) < 0)
        ) {
          existingGroup.label = supplierName;
        }

        return;
      }

      groups.push({
        value: normalizedName,
        label: supplierName,
        aliases: new Set([normalizedName]),
      });
    });

    return groups
      .map<SupplierOption>(group => ({
        value: group.value,
        label: group.label,
        aliases: Array.from(group.aliases),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));
  }, [products]);

  const selectedSupplierOption = useMemo(
    () => supplierOptions.find(option => option.value === selectedFournisseur) ?? null,
    [supplierOptions, selectedFournisseur]
  );

  const filteredProducts = useMemo(() => {
    if (!selectedSupplierOption) return [];

    const aliases = new Set(selectedSupplierOption.aliases);

    return products.filter(product => {
      const supplierName = product.fournisseur?.trim();
      if (!supplierName) return false;

      return aliases.has(normalizeSupplierName(supplierName));
    });
  }, [products, selectedSupplierOption]);

  const filteredValue = filteredProducts.reduce((s, p) => s + p.price * (1 - (p.remise || 0) / 100) * p.quantity, 0);

  const exportInventoryJSON = () => {
    const date = new Date().toISOString().split('T')[0];
    downloadJSON(products, `inventaire_${date}.json`);
    toast.success(`${products.length} produits exportés en JSON`);
  };

  const exportTransactionsJSON = async () => {
    setIsExportingTransactions(true);
    try {
      const allData: any[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .order('date', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      const date = new Date().toISOString().split('T')[0];
      downloadJSON(allData, `transactions_${date}.json`);
      toast.success(`${allData.length} transactions exportées en JSON`);
    } catch {
      toast.error("Erreur lors de l'export des transactions");
    } finally {
      setIsExportingTransactions(false);
    }
  };

  const exportDocumentsJSON = async () => {
    setIsExportingDocuments(true);
    try {
      const allData: any[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      const date = new Date().toISOString().split('T')[0];
      downloadJSON(allData, `documents_${date}.json`);
      toast.success(`${allData.length} documents exportés en JSON`);
    } catch {
      toast.error("Erreur lors de l'export des documents");
    } finally {
      setIsExportingDocuments(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Inventory Report */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">Liste Inventaire Complet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Génère un rapport PDF contenant tous les produits avec leurs quantités et valeurs.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {products.length} produits • Valeur (Net): {totalValue.toFixed(3)} TND
              </p>
              <Button onClick={() => generateInventoryPDF(products)} className="mt-4">
                <Download className="w-4 h-4 mr-2" />
                Télécharger PDF
              </Button>
            </div>
          </div>
        </div>

        {/* Inventory by Supplier */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-accent/10">
              <Filter className="w-8 h-8 text-accent-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">Inventaire par Fournisseur</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Liste d'inventaire filtrée par fournisseur sélectionné.
              </p>
              <Select value={selectedFournisseur} onValueChange={setSelectedFournisseur}>
                <SelectTrigger className="mt-3">
                  <SelectValue placeholder="Choisir un fournisseur" />
                </SelectTrigger>
                <SelectContent>
                  {supplierOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSupplierOption && (
                <p className="text-xs text-muted-foreground mt-2">
                  {filteredProducts.length} produits • Valeur (Net): {filteredValue.toFixed(3)} TND
                </p>
              )}
              <Button
                onClick={() => generateInventoryPDF(filteredProducts, selectedSupplierOption?.label)}
                className="mt-4"
                disabled={!selectedSupplierOption || filteredProducts.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Télécharger PDF
              </Button>
            </div>
          </div>
        </div>

        {/* Low Stock Report */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-warning/10">
              <AlertTriangle className="w-8 h-8 text-warning" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">Rapport Stock Faible</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Liste tous les produits en rupture ou avec un stock inférieur au minimum.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {lowStockProducts.length} produits nécessitent attention
              </p>
              <Button onClick={() => generateLowStockPDF(lowStockProducts)} variant="outline" className="mt-4">
                <Download className="w-4 h-4 mr-2" />
                Télécharger PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* JSON Export Section */}
      <h3 className="text-lg font-semibold text-foreground">Export JSON (pour application bureau)</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Export Inventory JSON */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <FileJson className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">Inventaire (JSON)</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Exporte tous les produits au format JSON.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {products.length} produits
              </p>
              <Button onClick={exportInventoryJSON} variant="outline" className="mt-4">
                <FileJson className="w-4 h-4 mr-2" />
                Exporter JSON
              </Button>
            </div>
          </div>
        </div>

        {/* Export Transactions JSON */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-success/10">
              <FileJson className="w-8 h-8 text-success" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">Transactions (JSON)</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Exporte tout l'historique des transactions.
              </p>
              <Button onClick={exportTransactionsJSON} variant="outline" className="mt-4" disabled={isExportingTransactions}>
                <FileJson className="w-4 h-4 mr-2" />
                {isExportingTransactions ? 'Export...' : 'Exporter JSON'}
              </Button>
            </div>
          </div>
        </div>

        {/* Export Documents JSON */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-accent/10">
              <FileJson className="w-8 h-8 text-accent-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">Documents (JSON)</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Exporte tout l'historique des documents (BL, BS, BE).
              </p>
              <Button onClick={exportDocumentsJSON} variant="outline" className="mt-4" disabled={isExportingDocuments}>
                <FileJson className="w-4 h-4 mr-2" />
                {isExportingDocuments ? 'Export...' : 'Exporter JSON'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

StandardReports.displayName = 'StandardReports';
