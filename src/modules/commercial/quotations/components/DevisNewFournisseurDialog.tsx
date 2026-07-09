import type { Dispatch, SetStateAction } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { DocumentUploader } from '@/components/shared/DocumentUploader';
import { PhoneLinesEditor } from '@/components/shared/PhoneLinesEditor';
import { SPECIALITES } from '@/constants/fournisseurs';
import { TUNISIA_LOCATIONS } from '@/constants/tunisia';

export type DevisNewFournisseurDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  setName: Dispatch<SetStateAction<string>>;
  code: string;
  setCode: Dispatch<SetStateAction<string>>;
  matricule: string;
  setMatricule: Dispatch<SetStateAction<string>>;
  specialite: string;
  setSpecialite: Dispatch<SetStateAction<string>>;
  governorate: string;
  setGovernorate: Dispatch<SetStateAction<string>>;
  city: string;
  setCity: Dispatch<SetStateAction<string>>;
  phoneLines: string[];
  setPhoneLines: Dispatch<SetStateAction<string[]>>;
  patenteUrl: string | null;
  setPatenteUrl: Dispatch<SetStateAction<string | null>>;
  rneUrl: string | null;
  setRneUrl: Dispatch<SetStateAction<string | null>>;
  cities: string[];
  onCreate: () => void | Promise<void>;
  onCancel: () => void;
  openDocumentPreview: (storedUrl: string | null | undefined, title: string) => void | Promise<void>;
};

export function DevisNewFournisseurDialog({
  open,
  onOpenChange,
  name,
  setName,
  code,
  setCode,
  matricule,
  setMatricule,
  specialite,
  setSpecialite,
  governorate,
  setGovernorate,
  city,
  setCity,
  phoneLines,
  setPhoneLines,
  patenteUrl,
  setPatenteUrl,
  rneUrl,
  setRneUrl,
  cities,
  onCreate,
  onCancel,
  openDocumentPreview,
}: DevisNewFournisseurDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau Fournisseur</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nom (Société) *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nom du fournisseur" />
          </div>
          <div className="space-y-2">
            <Label>Code fournisseur *</Label>
            <Input value={code} onChange={e => setCode(e.target.value)} placeholder="Ex: FRN-001" />
          </div>
          <div className="space-y-2">
            <Label>Matricule Fiscale *</Label>
            <Input value={matricule} onChange={e => setMatricule(e.target.value)} placeholder="Ex: 1234567/A/B/C/000" />
          </div>
          <div className="space-y-2">
            <Label>Spécialité *</Label>
            <Select value={specialite} onValueChange={setSpecialite}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une spécialité" />
              </SelectTrigger>
              <SelectContent>
                {SPECIALITES.map(spec => (
                  <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <PhoneLinesEditor
            idPrefix="devis-fournisseur"
            label="Téléphone(s)"
            required
            lines={phoneLines}
            onChange={setPhoneLines}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Gouvernorat *</Label>
              <Select value={governorate} onValueChange={val => { setGovernorate(val); setCity(''); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Région" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {TUNISIA_LOCATIONS.map(r => (
                    <SelectItem key={r.governorate} value={r.governorate}>{r.governorate}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ville *</Label>
              <Select value={city} onValueChange={setCity} disabled={!governorate}>
                <SelectTrigger>
                  <SelectValue placeholder={governorate ? "Ville" : "Choisir région"} />
                </SelectTrigger>
                <SelectContent>
                  {cities.map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-3 pt-2 border-t border-dashed">
            <Label className="text-sm font-semibold">Documents (PDF, JPG, PNG) — optionnel</Label>
            {code.trim() ? (
              <div className="space-y-3">
                <DocumentUploader
                  bucket="client-documents"
                  entityCode={`FRN_${code.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`}
                  documentType="patente"
                  currentUrl={patenteUrl}
                  onUploadSuccess={(url) => setPatenteUrl(url)}
                  onRemove={() => setPatenteUrl(null)}
                  onConsult={(url) => void openDocumentPreview(url, `Patente — ${name.trim() || code}`)}
                />
                <DocumentUploader
                  bucket="client-documents"
                  entityCode={`FRN_${code.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`}
                  documentType="rc"
                  titleOverride="RNE (Registre national des entreprises)"
                  currentUrl={rneUrl}
                  onUploadSuccess={(url) => setRneUrl(url)}
                  onRemove={() => setRneUrl(null)}
                  onConsult={(url) => void openDocumentPreview(url, `RNE — ${name.trim() || code}`)}
                />
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 flex items-start gap-2 text-amber-800 text-xs">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>Saisissez le code fournisseur pour activer l&apos;envoi Patente et RNE.</p>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Annuler</Button>
          <Button onClick={() => void onCreate()}>Ajouter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
