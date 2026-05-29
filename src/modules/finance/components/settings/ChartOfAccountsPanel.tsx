import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PLAN_COMPTABLE_TUNISIE } from '../../lib/chartOfAccounts';

/** Référentiel plan comptable tunisien (extrait PCG). */
export function ChartOfAccountsPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan comptable (PCG Tunisie)</CardTitle>
        <CardDescription>
          Comptes utilisés par les écritures automatiques du module Finance. Étendre selon votre liasse fiscale.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead>Classe</TableHead>
              <TableHead>Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PLAN_COMPTABLE_TUNISIE.map((a) => (
              <TableRow key={a.code}>
                <TableCell className="font-mono">{a.code}</TableCell>
                <TableCell>{a.libelle}</TableCell>
                <TableCell>{a.classe}</TableCell>
                <TableCell>
                  <Badge variant="outline">{a.type}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
