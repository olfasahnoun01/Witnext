import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportReport, type ReportExportPayload } from '@/lib/reportExport';
import { useToast } from '@/hooks/use-toast';

type Props = {
  payload: ReportExportPayload;
};

export function ReportExportActions({ payload }: Props) {
  const { toast } = useToast();

  const run = async (format: 'csv' | 'excel' | 'pdf' | 'print') => {
    try {
      await exportReport(format, payload);
      if (format !== 'print') {
        toast({ title: 'Export réussi', description: payload.filenameBase });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Export impossible',
        description: err instanceof Error ? err.message : 'Erreur inconnue',
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Exporter
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void run('excel')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void run('csv')}>
          <FileText className="h-4 w-4 mr-2" />
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void run('pdf')}>
          <FileText className="h-4 w-4 mr-2" />
          PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void run('print')}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
