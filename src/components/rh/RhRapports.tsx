import { useCallback, useState } from 'react';
import { FileText, Plus, Trash2, Download, Loader2, Paperclip, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  RH_INCIDENT_TYPES,
  RH_REPORT_KINDS,
  defaultRhReportForm,
  type RhSecurityReportForm,
  type RhReportSection,
} from '@/lib/rhReportTypes';
import { downloadRhSecurityReportPdf } from '@/utils/rhSecurityReportPdf';
import { saveRhSecurityReport } from '@/services/rhReportService';
import { validateUploadFile, MAX_UPLOAD_BYTES } from '@/lib/uploadValidation';

export const RhRapports = () => {
  const { toast } = useToast();
  const [form, setForm] = useState<RhSecurityReportForm>(() => defaultRhReportForm());
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const toggleIncident = (id: (typeof RH_INCIDENT_TYPES)[number]['id'], checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      incidentTypes: checked
        ? [...prev.incidentTypes, id]
        : prev.incidentTypes.filter((x) => x !== id),
    }));
  };

  const updateSection = (index: number, patch: Partial<RhReportSection>) => {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  };

  const addSection = () => {
    setForm((prev) => ({
      ...prev,
      sections: [...prev.sections, { title: `${prev.sections.length + 1}. `, content: '' }],
    }));
  };

  const removeSection = (index: number) => {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index),
    }));
  };

  const onFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const accepted: File[] = [];
    for (const file of Array.from(files)) {
      const check = validateUploadFile(file, [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
      ], MAX_UPLOAD_BYTES);
      if (!check.ok) {
        toast({ variant: 'destructive', title: 'Fichier refusé', description: check.message });
        continue;
      }
      accepted.push(file);
    }
    setForm((prev) => ({
      ...prev,
      attachmentFiles: [...prev.attachmentFiles, ...accepted],
    }));
    e.target.value = '';
  };

  const handleExportPdf = useCallback(async () => {
    if (form.incidentTypes.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Types requis',
        description: 'Sélectionnez au moins une nature de constat (Dormir, Absence, etc.).',
      });
      return;
    }
    if (!form.title.trim()) {
      toast({ variant: 'destructive', title: 'Titre requis' });
      return;
    }
    setExporting(true);
    try {
      await downloadRhSecurityReportPdf(form);
      toast({ title: 'PDF généré', description: 'Le rapport a été téléchargé.' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erreur PDF',
        description: err instanceof Error ? err.message : 'Génération impossible',
      });
    } finally {
      setExporting(false);
    }
  }, [form, toast]);

  const handleSaveAndSend = useCallback(async () => {
    if (form.incidentTypes.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Types requis',
        description: 'Sélectionnez au moins une nature de constat.',
      });
      return;
    }
    if (!form.title.trim() || !form.companyName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Champs requis',
        description: 'Titre et société sont obligatoires.',
      });
      return;
    }
    setSaving(true);
    try {
      await saveRhSecurityReport(form);
      await downloadRhSecurityReportPdf(form);
      toast({
        title: 'Rapport enregistré',
        description: 'Le rapport est sauvegardé et le PDF a été téléchargé pour envoi à la société.',
      });
      setForm(defaultRhReportForm());
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Enregistrement impossible',
      });
    } finally {
      setSaving(false);
    }
  }, [form, toast]);

  const showVehicle = form.incidentTypes.includes('accident');

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileText className="w-7 h-7 text-primary" />
          Rapports de contrôle & incidents
        </h2>
      </div>

      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-foreground">Nature(s) du constat *</h3>
        <p className="text-xs text-muted-foreground">Sélectionnez une ou plusieurs options.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {RH_INCIDENT_TYPES.map((t) => (
            <label
              key={t.id}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 cursor-pointer hover:bg-muted/50"
            >
              <Checkbox
                checked={form.incidentTypes.includes(t.id)}
                onCheckedChange={(c) => toggleIncident(t.id, c === true)}
              />
              <span className="text-sm">{t.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h3 className="font-semibold">En-tête du rapport</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Type de document</Label>
            <Select
              value={form.reportKind}
              onValueChange={(v) => setForm((p) => ({ ...p, reportKind: v as typeof form.reportKind }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RH_REPORT_KINDS.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Titre du rapport *</Label>
            <Input
              placeholder="Ex. RAPPORT DE CONTRÔLE DE SITE"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Sous-titre</Label>
            <Input
              placeholder="Ex. Dégâts au niveau du trottoir extérieur..."
              value={form.subtitle}
              onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))}
            />
          </div>
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h3 className="font-semibold">Informations société & incident</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Société *</Label>
            <Input
              placeholder="Ex. Nutrimix"
              value={form.companyName}
              onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
            />
          </div>
          <div>
            <Label>Date de l&apos;incident</Label>
            <Input
              type="date"
              value={form.incidentDate}
              onChange={(e) => setForm((p) => ({ ...p, incidentDate: e.target.value }))}
            />
          </div>
          <div>
            <Label>Heure</Label>
            <Input
              type="time"
              value={form.incidentTime}
              onChange={(e) => setForm((p) => ({ ...p, incidentTime: e.target.value }))}
            />
          </div>
          <div>
            <Label>Lieu</Label>
            <Input
              placeholder="Site, adresse..."
              value={form.location}
              onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
            />
          </div>
          <div>
            <Label>Type d&apos;incident (détail)</Label>
            <Input
              placeholder="Ex. Incident sécurité, dégradation..."
              value={form.incidentTypeDetail}
              onChange={(e) => setForm((p) => ({ ...p, incidentTypeDetail: e.target.value }))}
            />
          </div>
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Corps du rapport</h3>
          <Button type="button" variant="outline" size="sm" onClick={addSection}>
            <Plus className="w-4 h-4 mr-1" /> Section
          </Button>
        </div>
        {form.sections.map((section, index) => (
          <div key={index} className="border border-border rounded-lg p-4 space-y-3">
            <div className="flex gap-2 items-start">
              <div className="flex-1 space-y-2">
                <Label>Titre de section</Label>
                <Input
                  value={section.title}
                  onChange={(e) => updateSection(index, { title: e.target.value })}
                />
                <Label>Contenu</Label>
                <Textarea
                  rows={4}
                  value={section.content}
                  onChange={(e) => updateSection(index, { content: e.target.value })}
                  placeholder="Rédigez le contenu de cette section..."
                />
              </div>
              {form.sections.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive shrink-0"
                  onClick={() => removeSection(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </section>

      {showVehicle && (
        <section className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Car className="w-5 h-5 text-primary" />
            Informations sur le véhicule concerné
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Immatriculation</Label>
              <Input
                value={form.vehicleInfo.immatriculation}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    vehicleInfo: { ...p.vehicleInfo, immatriculation: e.target.value },
                  }))
                }
              />
            </div>
            <div>
              <Label>Marque / modèle</Label>
              <Input
                value={form.vehicleInfo.marque_modele}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    vehicleInfo: { ...p.vehicleInfo, marque_modele: e.target.value },
                  }))
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Conducteur</Label>
              <Input
                value={form.vehicleInfo.conducteur}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    vehicleInfo: { ...p.vehicleInfo, conducteur: e.target.value },
                  }))
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Description des dégâts</Label>
              <Textarea
                rows={3}
                value={form.vehicleInfo.description_degats}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    vehicleInfo: { ...p.vehicleInfo, description_degats: e.target.value },
                  }))
                }
              />
            </div>
          </div>
        </section>
      )}

      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Paperclip className="w-5 h-5" />
          Pièces jointes
        </h3>
        <Input type="file" accept="image/*,.pdf" multiple onChange={onFilesSelected} />
        {form.attachmentFiles.length > 0 && (
          <ul className="text-sm text-muted-foreground space-y-1">
            {form.attachmentFiles.map((f, i) => (
              <li key={i} className="flex justify-between items-center">
                <span>{f.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      attachmentFiles: p.attachmentFiles.filter((_, j) => j !== i),
                    }))
                  }
                >
                  Retirer
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-3 pb-8">
        <Button onClick={handleSaveAndSend} disabled={saving || exporting}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Enregistrer & télécharger PDF
        </Button>
        <Button variant="outline" onClick={handleExportPdf} disabled={saving || exporting}>
          {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
          PDF uniquement
        </Button>
      </div>
    </div>
  );
};
