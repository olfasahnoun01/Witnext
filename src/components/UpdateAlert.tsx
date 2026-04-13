import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RefreshCw } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const UpdateAlert = () => {
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [dbVersion, setDbVersion] = useState<string | null>(null);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const { data, error } = await supabase
          .from('app_config' as any)
          .select('value')
          .eq('key', 'update_alert_version')
          .maybeSingle();

        if (error) throw error;
        
        const currentVersion = (data as any)?.value || '1.0.0';
        setDbVersion(currentVersion);

        const hiddenVersion = localStorage.getItem("lastHiddenUpdateVersion");
        
        if (hiddenVersion !== currentVersion) {
          // New version detected or never hidden
          const timer = setTimeout(() => setOpen(true), 1500);
          return () => clearTimeout(timer);
        }
      } catch (err) {
        console.error("Error checking app version:", err);
      }
    };

    checkVersion();
  }, []);

  const handleClose = () => {
    if (dontShowAgain && dbVersion) {
      localStorage.setItem("lastHiddenUpdateVersion", dbVersion);
    }
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="max-w-[400px]">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-primary mb-2">
            <RefreshCw className="w-5 h-5" />
            <AlertDialogTitle className="text-xl">Mise à jour importante</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild className="text-base text-foreground space-y-4">
            <div>
              <p>
                Pour garantir que vous utilisez toujours la version la plus récente avec toutes les corrections et nouveautés :
              </p>
              <div className="p-4 bg-muted rounded-xl border-2 border-primary/20 flex flex-col items-center justify-center gap-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Combinaison Recommandée</p>
                <div className="flex items-center gap-3 font-mono text-xl font-bold">
                  <span className="bg-background border-2 border-primary/50 text-primary px-3 py-1.5 rounded-lg shadow-sm">CTRL</span>
                  <span className="text-muted-foreground">+</span>
                  <span className="bg-background border-2 border-primary/50 text-primary px-3 py-1.5 rounded-lg shadow-sm">F5</span>
                </div>
              </div>
              <p className="text-sm italic text-muted-foreground text-center">
                Cette action recharge proprement le cache du navigateur.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="flex items-center space-x-3 py-4 px-1">
          <Checkbox 
            id="dontShow" 
            checked={dontShowAgain} 
            onCheckedChange={(checked) => setDontShowAgain(!!checked)}
            className="w-5 h-5"
          />
          <Label 
            htmlFor="dontShow" 
            className="text-sm font-medium leading-none cursor-pointer hover:text-primary transition-colors"
          >
            Ne plus montrer ce message
          </Label>
        </div>

        <AlertDialogFooter>
          <AlertDialogAction 
            onClick={handleClose} 
            className="w-full h-11 text-base font-semibold transition-all hover:scale-[1.02]"
          >
            J'ai compris
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
