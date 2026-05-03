import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';

interface PhoneLinesEditorProps {
  idPrefix: string;
  label: string;
  required?: boolean;
  lines: string[];
  onChange: (lines: string[]) => void;
}

export function PhoneLinesEditor({
  idPrefix,
  label,
  required,
  lines,
  onChange,
}: PhoneLinesEditorProps) {
  const safeLines = lines.length > 0 ? lines : [''];

  const setLine = (index: number, value: string) => {
    const next = [...safeLines];
    next[index] = value;
    onChange(next);
  };

  const addLine = () => {
    onChange([...safeLines, '']);
  };

  const removeLine = (index: number) => {
    if (safeLines.length <= 1) {
      onChange(['']);
      return;
    }
    onChange(safeLines.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? ' *' : ''}
      </Label>
      {safeLines.map((line, i) => (
        <div key={`${idPrefix}-phone-${i}`} className="flex gap-2">
          <Input
            id={`${idPrefix}-phone-${i}`}
            value={line}
            onChange={(e) => setLine(i, e.target.value)}
            placeholder="Ex: +216 XX XXX XXX"
            className="flex-1"
          />
          {safeLines.length > 1 && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => removeLine(i)}
              aria-label="Supprimer ce numéro"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" className="gap-1" onClick={addLine}>
        <Plus className="w-4 h-4" />
        Ajouter un numéro
      </Button>
    </div>
  );
}
