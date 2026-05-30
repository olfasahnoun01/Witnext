import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileUp, Loader2, FileText, CheckCircle2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { loadStorageDocumentPdf, parseSupabaseStorageObjectUrl } from '@/lib/clientDocumentStorage';
import {
  LEGAL_DOCUMENT_ACCEPT,
  LEGAL_DOCUMENT_MIME_TYPES,
  resolveUploadMimeType,
  validateUploadFile,
} from '@/lib/uploadValidation';

interface DocumentUploaderProps {
  bucket: 'client-documents' | 'product-documents';
  entityCode: string;
  documentType: 'patente' | 'rc' | 'fiche_technique';
  titleOverride?: string;
  currentUrl?: string | null;
  onUploadSuccess: (url: string) => void;
  /** Clears the document from the form (and optionally the database via parent). */
  onRemove?: () => void;
  onConsult?: (url: string) => void;
}

const FICHE_MIME_TYPES = ['application/pdf'] as const;
const FICHE_ACCEPT = '.pdf,application/pdf';

export const DocumentUploader = ({
  bucket,
  entityCode,
  documentType,
  titleOverride,
  currentUrl,
  onUploadSuccess,
  onRemove,
  onConsult,
}: DocumentUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [consulting, setConsulting] = useState(false);

  const isLegalDocument = documentType === 'patente' || documentType === 'rc';
  const canRemove = isLegalDocument && !!currentUrl && !!onRemove;
  const allowedMimeTypes = isLegalDocument ? LEGAL_DOCUMENT_MIME_TYPES : FICHE_MIME_TYPES;
  const accept = isLegalDocument ? LEGAL_DOCUMENT_ACCEPT : FICHE_ACCEPT;
  const formatHint = isLegalDocument
    ? 'PDF, JPG, JPEG ou PNG (max 10 Mo)'
    : 'PDF uniquement (max 10 Mo)';

  const handleConsult = async () => {
    if (!currentUrl) return;
    if (onConsult) {
      onConsult(currentUrl);
      return;
    }
    setConsulting(true);
    try {
      const loaded = await loadStorageDocumentPdf(currentUrl);
      if (!loaded) {
        toast.error('Impossible d\'ouvrir le document');
        return;
      }
      window.open(loaded.downloadUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(loaded.downloadUrl), 60_000);
    } finally {
      setConsulting(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    try {
      setUploading(true);
      setProgress(10);

      const file = input.files?.[0];
      if (!file) return;

      const validation = validateUploadFile(file, allowedMimeTypes);
      if (!validation.ok) {
        toast.error(validation.message);
        return;
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const fileName = `${documentType}_${entityCode.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${fileExt}`;
      const contentType = resolveUploadMimeType(file);

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          upsert: true,
          contentType,
        });

      if (uploadError) throw uploadError;

      setProgress(90);

      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);

      onUploadSuccess(publicUrl);
      toast.success('Document téléversé avec succès');
      setProgress(100);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Erreur lors de l'upload : ${message}`);
    } finally {
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 1000);
      input.value = '';
    }
  };

  const openFilePicker = () => {
    document.getElementById(`upload-${entityCode}-${documentType}`)?.click();
  };

  const handleRemove = async () => {
    if (!currentUrl || !onRemove) return;
    const label = titleOverride || (documentType === 'patente' ? 'Patente' : 'RNE');
    if (!confirm(`Supprimer ${label} ?`)) return;

    setRemoving(true);
    try {
      const ref = parseSupabaseStorageObjectUrl(currentUrl);
      if (ref) {
        const { error } = await supabase.storage.from(ref.bucket).remove([ref.path]);
        if (error) console.warn('[DocumentUploader] storage remove failed', error);
      }
      onRemove();
      toast.success('Document supprimé');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Erreur lors de la suppression : ${message}`);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-3 p-4 border rounded-xl bg-muted/20">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-background rounded-lg border shadow-sm text-primary shrink-0">
            {documentType === 'fiche_technique' ? <FileText className="w-5 h-5" /> : <FileUp className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-none">
              {titleOverride ||
                (documentType === 'patente'
                  ? 'Patente Fiscale'
                  : documentType === 'rc'
                    ? 'Registre du Commerce'
                    : 'Fiche Technique')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Format requis : {formatHint}
            </p>
            {currentUrl && (
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                Document chargé
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {currentUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={consulting || removing}
              onClick={() => void handleConsult()}
            >
              {consulting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Consulter'}
            </Button>
          )}

          {canRemove && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs text-destructive hover:text-destructive"
              disabled={uploading || removing}
              onClick={() => void handleRemove()}
            >
              {removing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            </Button>
          )}

          <div className="relative">
            <input
              type="file"
              id={`upload-${entityCode}-${documentType}`}
              className="hidden"
              accept={accept}
              onChange={handleUpload}
              disabled={uploading || removing}
            />
            <Button
              type="button"
              variant={currentUrl ? 'secondary' : 'default'}
              size="sm"
              disabled={uploading || removing}
              className="h-8 gap-2 text-xs"
              onClick={openFilePicker}
            >
              {uploading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Upload className="w-3 h-3" />
              )}
              {currentUrl ? 'Modifier' : 'Ajouter'}
            </Button>
          </div>
        </div>
      </div>

      {uploading && (
        <div className="space-y-1">
          <Progress value={progress} className="h-1" />
          <p className="text-[10px] text-center text-muted-foreground animate-pulse">
            Envoi en cours... {progress}%
          </p>
        </div>
      )}
    </div>
  );
};
