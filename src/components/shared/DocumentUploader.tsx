import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileUp, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { loadStorageDocumentPdf } from '@/lib/clientDocumentStorage';

interface DocumentUploaderProps {
  bucket: 'client-documents' | 'product-documents';
  entityCode: string; // SKU or Client Code
  documentType: 'patente' | 'rc' | 'fiche_technique';
  /** Overrides the default title for this document type (e.g. RNE label). */
  titleOverride?: string;
  currentUrl?: string | null;
  onUploadSuccess: (url: string) => void;
  /** When set, opens in-app preview instead of a new tab (recommended in Electron). */
  onConsult?: (url: string) => void;
}

export const DocumentUploader = ({ 
  bucket, 
  entityCode, 
  documentType, 
  titleOverride,
  currentUrl,
  onUploadSuccess,
  onConsult,
}: DocumentUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [consulting, setConsulting] = useState(false);

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
    try {
      setUploading(true);
      setProgress(10);
      
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (file.type !== 'application/pdf') {
        toast.error("Seuls les fichiers PDF sont acceptés.");
        return;
      }

      // 1. Rename logic
      const fileExt = file.name.split('.').pop();
      const fileName = `${documentType}_${entityCode.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${fileExt}`;
      const filePath = `${fileName}`;

      // 2. Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          upsert: true,
          contentType: 'application/pdf'
        });

      if (uploadError) throw uploadError;

      setProgress(90);

      // 3. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      toast.success("Document mis à jour avec succès !");
      onUploadSuccess(publicUrl);
      setProgress(100);
    } catch (error: any) {
      toast.error("Erreur lors de l'upload : " + error.message);
    } finally {
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 1000);
    }
  };

  return (
    <div className="space-y-3 p-4 border rounded-xl bg-muted/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-background rounded-lg border shadow-sm text-primary">
            {documentType === 'fiche_technique' ? <FileText className="w-5 h-5" /> : <FileUp className="w-5 h-5" />}
          </div>
          <div>
            <p className="text-sm font-medium leading-none">
              {titleOverride ||
                (documentType === 'patente'
                  ? 'Patente Fiscale'
                  : documentType === 'rc'
                    ? 'Registre du Commerce'
                    : 'Fiche Technique')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Format requis : PDF uniquement
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {currentUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={consulting}
              onClick={() => void handleConsult()}
            >
              {consulting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Consulter'}
            </Button>
          )}
          
          <div className="relative">
            <input
              type="file"
              id={`upload-${entityCode}-${documentType}`}
              className="hidden"
              accept=".pdf"
              onChange={handleUpload}
              disabled={uploading}
            />
            <Button 
              variant={currentUrl ? "secondary" : "default"} 
              size="sm" 
              disabled={uploading}
              className="h-8 gap-2 text-xs"
              onClick={() => document.getElementById(`upload-${entityCode}-${documentType}`)?.click()}
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
