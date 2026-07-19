import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { removeUserAvatar, uploadUserAvatar } from '@/lib/userAvatarService';
import { formatError } from '@/lib/formatError';
import { toast } from 'sonner';

interface AvatarUploadFieldProps {
  userId: string;
  fullName: string;
  email?: string;
  avatarUrl: string | null;
  onAvatarChange: (url: string | null) => void;
  size?: 'md' | 'lg';
  disabled?: boolean;
}

export function AvatarUploadField({
  userId,
  fullName,
  email,
  avatarUrl,
  onAvatarChange,
  size = 'lg',
  disabled,
}: AvatarUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const initials = (() => {
    const source = (fullName || email || '?').trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return source.slice(0, 2).toUpperCase();
  })();

  const displayUrl = avatarUrl || null;

  const dim = size === 'lg' ? 'h-24 w-24' : 'h-16 w-16';

  const handleFile = async (file: File | undefined) => {
    if (!file || disabled) return;
    setBusy(true);
    try {
      const url = await uploadUserAvatar(userId, file);
      onAvatarChange(url);
      toast.success('Photo de profil mise à jour');
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (disabled) return;
    setBusy(true);
    try {
      await removeUserAvatar(userId);
      onAvatarChange(null);
      toast.success('Photo de profil supprimée');
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <Avatar className={`${dim} border border-border shadow-sm`}>
        {displayUrl ? <AvatarImage src={displayUrl} alt={fullName || 'Avatar'} /> : null}
        <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Photo de profil</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          JPEG, PNG ou WebP — compressée automatiquement (~256px WebP) pour ne pas alourdir
          l’application.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || disabled}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
            {avatarUrl ? 'Changer' : 'Ajouter'}
          </Button>
          {avatarUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy || disabled}
              onClick={() => void handleRemove()}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
