import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer, ScanBarcode, Loader2, Package } from 'lucide-react';
import { useAppCompany } from '@/contexts/AppCompanyContext';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  findProductByBarcode,
  generateBarcodeValue,
  updateProductBarcode,
} from '@/services/barcodeService';
import type { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type LabelSize = '58x40' | '50x30' | '40x25';

const LABEL_SIZES: Record<LabelSize, { widthMm: number; heightMm: number; label: string }> = {
  '58x40': { widthMm: 58, heightMm: 40, label: '58 × 40 mm (standard)' },
  '50x30': { widthMm: 50, heightMm: 30, label: '50 × 30 mm' },
  '40x25': { widthMm: 40, heightMm: 25, label: '40 × 25 mm (compact)' },
};

function BarcodeSvg({ value, height = 40 }: { value: string; height?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        width: 1.4,
        height,
        displayValue: true,
        fontSize: 11,
        margin: 4,
      });
    } catch {
      /* invalid barcode value */
    }
  }, [value, height]);

  return <svg ref={svgRef} className="max-w-full h-auto" />;
}

export function BarcodeLabelsPage() {
  const { currentCompanyId } = useAppCompany();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [labelSize, setLabelSize] = useState<LabelSize>('58x40');
  const [scanResult, setScanResult] = useState<Product | null>(null);
  const [manualScan, setManualScan] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const loadProducts = useCallback(async () => {
    if (!currentCompanyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', currentCompanyId)
        .order('name');
      if (error) throw error;
      setProducts((data ?? []) as Product[]);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Chargement impossible',
      });
    } finally {
      setLoading(false);
    }
  }, [currentCompanyId, toast]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const handleScan = useCallback(
    async (code: string) => {
      if (!currentCompanyId) return;
      try {
        const product = await findProductByBarcode(code, currentCompanyId);
        if (product) {
          setScanResult(product);
          setSelected((prev) => new Set(prev).add(product.id));
          toast({ title: 'Produit scanné', description: product.name });
        } else {
          toast({
            variant: 'destructive',
            title: 'Code inconnu',
            description: `Aucun produit pour : ${code}`,
          });
        }
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Erreur scan',
          description: err instanceof Error ? err.message : 'Recherche impossible',
        });
      }
    },
    [currentCompanyId, toast]
  );

  useBarcodeScanner({ enabled: true, onScan: handleScan });

  const selectedProducts = useMemo(
    () => products.filter((p) => selected.has(p.id)),
    [products, selected]
  );

  const toggleProduct = (id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const assignBarcodes = async () => {
    if (!currentCompanyId) return;
    const toAssign = products.filter((p) => selected.has(p.id) && !p.barcode);
    for (const p of toAssign) {
      const code = generateBarcodeValue(p.sku, p.id);
      await updateProductBarcode(p.id, code, currentCompanyId);
    }
    toast({ title: `${toAssign.length} code(s)-barres généré(s)` });
    void loadProducts();
  };

  const printLabels = () => {
    const el = printRef.current;
    if (!el || selectedProducts.length === 0) return;
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return;
    const size = LABEL_SIZES[labelSize];
    win.document.write(`
      <!DOCTYPE html><html><head><title>Étiquettes</title>
      <style>
        @page { size: ${size.widthMm}mm ${size.heightMm}mm; margin: 0; }
        body { margin: 0; font-family: Arial, sans-serif; }
        .label {
          width: ${size.widthMm}mm;
          height: ${size.heightMm}mm;
          box-sizing: border-box;
          padding: 2mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          page-break-after: always;
          overflow: hidden;
        }
        .name { font-size: 8pt; font-weight: bold; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .meta { font-size: 6pt; color: #444; margin-top: 1mm; }
        svg { max-width: 100%; height: auto; }
      </style></head><body>${el.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const getBarcode = (p: Product) => p.barcode || generateBarcodeValue(p.sku, p.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScanBarcode className="h-6 w-6 text-primary" />
          Étiquettes code-barres
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Génération d&apos;étiquettes thermiques et scan douchette USB/Bluetooth.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scan douchette</CardTitle>
          <CardDescription>
            Scannez un code-barres (hors champ de saisie) ou saisissez-le manuellement.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Code-barres manuel + Entrée"
            value={manualScan}
            onChange={(e) => setManualScan(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && manualScan.trim()) {
                void handleScan(manualScan.trim());
                setManualScan('');
              }
            }}
            className="max-w-sm"
          />
          {scanResult && (
            <div className="flex items-center gap-2 text-sm text-success">
              <Package className="h-4 w-4" />
              Dernier scan : <strong>{scanResult.name}</strong>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label>Format étiquette</Label>
          <Select value={labelSize} onValueChange={(v) => setLabelSize(v as LabelSize)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(LABEL_SIZES) as LabelSize[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {LABEL_SIZES[k].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={() => void assignBarcodes()} disabled={selected.size === 0}>
          Générer codes manquants
        </Button>
        <Button onClick={printLabels} disabled={selectedProducts.length === 0}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimer ({selectedProducts.length})
        </Button>
      </div>

      <div className="grid gap-2 max-h-[420px] overflow-y-auto border rounded-lg p-3">
        {products.map((p) => (
          <label
            key={p.id}
            className="flex items-center gap-3 rounded-md border border-border px-3 py-2 hover:bg-muted/40 cursor-pointer"
          >
            <Checkbox
              checked={selected.has(p.id)}
              onCheckedChange={(c) => toggleProduct(p.id, c === true)}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                SKU : {p.sku} · Code : {getBarcode(p)}
              </p>
            </div>
          </label>
        ))}
      </div>

      <div ref={printRef} className="hidden">
        {selectedProducts.map((p) => {
          const code = getBarcode(p);
          return (
            <div key={p.id} className="label">
              <div className="name">{p.name}</div>
              <BarcodeSvg value={code} height={32} />
              <div className="meta">{p.sku} · {p.size}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {selectedProducts.slice(0, 8).map((p) => (
          <div key={p.id} className="rounded-lg border border-border p-3 text-center bg-card">
            <p className="text-xs font-medium truncate mb-2">{p.name}</p>
            <BarcodeSvg value={getBarcode(p)} />
          </div>
        ))}
      </div>
    </div>
  );
}
