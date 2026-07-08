import { useRef, useState } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { Loader2, CheckCircle2 } from 'lucide-react';
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
import { MODULE_OPTIONS, getPlanByCode } from '@/marketing/config/pricing';
import {
  submitMarketingLead,
  type MarketingLeadDeployment,
  type MarketingLeadType,
} from '@/services/marketingLeadService';
import { useToast } from '@/hooks/use-toast';

const isWebTarget = import.meta.env.VITE_APP_TARGET !== 'electron';
const hcaptchaSiteKey = import.meta.env.VITE_HCAPTCHA_SITE_KEY?.trim() ?? '';
const captchaConfigured = isWebTarget && hcaptchaSiteKey.length > 0;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormState = {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  teamSize: string;
  message: string;
  userCount: string;
  deployment: MarketingLeadDeployment | '';
};

type Props = {
  type: MarketingLeadType;
  planCode?: string;
  sourcePath?: string;
  title: string;
  subtitle: string;
};

const emptyForm = (): FormState => ({
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  teamSize: '',
  message: '',
  userCount: '',
  deployment: '',
});

export function LeadCaptureForm({ type, planCode, sourcePath, title, subtitle }: Props) {
  const { toast } = useToast();
  const captchaRef = useRef<HCaptcha>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const plan = getPlanByCode(planCode);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const toggleModule = (id: string, checked: boolean) => {
    setSelectedModules((prev) =>
      checked ? [...prev, id] : prev.filter((m) => m !== id)
    );
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (form.companyName.trim().length < 2) next.companyName = 'Nom de société requis';
    if (form.contactName.trim().length < 2) next.contactName = 'Nom du contact requis';
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Email invalide';
    if (type === 'license' && form.userCount) {
      const n = Number(form.userCount);
      if (!Number.isFinite(n) || n < 1) next.userCount = 'Nombre invalide';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (captchaConfigured && !captchaToken) {
      toast({
        variant: 'destructive',
        title: 'Captcha requis',
        description: 'Veuillez compléter la vérification anti-spam.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const userCount =
        type === 'license' && form.userCount ? Number(form.userCount) : undefined;
      await submitMarketingLead({
        type,
        companyName: form.companyName.trim(),
        contactName: form.contactName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        teamSize: form.teamSize.trim() || undefined,
        userCount,
        deployment: form.deployment || undefined,
        planCode: planCode || undefined,
        modules: selectedModules.length > 0 ? selectedModules : plan?.modules,
        message: form.message.trim() || undefined,
        sourcePath: sourcePath || window.location.pathname,
        captchaToken: captchaToken || undefined,
      });
      setSuccess(true);
      setForm(emptyForm());
      setSelectedModules([]);
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Envoi impossible',
        description: err instanceof Error ? err.message : 'Réessayez plus tard.',
      });
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 mb-4" />
        <h3 className="text-xl font-bold mb-2">Demande envoyée</h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          {type === 'trial'
            ? 'Merci ! Notre équipe vous contactera sous 48 h pour activer votre essai gratuit.'
            : 'Merci ! Notre équipe commerciale vous contactera pour finaliser votre licence.'}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-6"
          onClick={() => setSuccess(false)}
        >
          Envoyer une autre demande
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
        {plan && (
          <p className="text-sm font-medium text-primary mt-2">
            Offre sélectionnée : {plan.name}
          </p>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="companyName">Société *</Label>
            <Input
              id="companyName"
              value={form.companyName}
              onChange={(e) => setField('companyName', e.target.value)}
              placeholder="Raison sociale"
            />
            {errors.companyName && (
              <p className="text-xs text-destructive">{errors.companyName}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactName">Nom du contact *</Label>
            <Input
              id="contactName"
              value={form.contactName}
              onChange={(e) => setField('contactName', e.target.value)}
              placeholder="Prénom Nom"
            />
            {errors.contactName && (
              <p className="text-xs text-destructive">{errors.contactName}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              placeholder="contact@societe.tn"
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="98 123 456"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="teamSize">Taille de l&apos;équipe</Label>
            <Input
              id="teamSize"
              value={form.teamSize}
              onChange={(e) => setField('teamSize', e.target.value)}
              placeholder="Ex. 10-25 personnes"
            />
          </div>
          {type === 'license' && (
            <div className="space-y-2">
              <Label htmlFor="userCount">Nombre d&apos;utilisateurs</Label>
              <Input
                id="userCount"
                type="number"
                min={1}
                value={form.userCount}
                onChange={(e) => setField('userCount', e.target.value)}
                placeholder="Ex. 15"
              />
              {errors.userCount && (
                <p className="text-xs text-destructive">{errors.userCount}</p>
              )}
            </div>
          )}
        </div>

        {type === 'license' && (
          <div className="space-y-2">
            <Label>Déploiement souhaité</Label>
            <Select
              value={form.deployment || undefined}
              onValueChange={(v) => setField('deployment', v as MarketingLeadDeployment)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir une option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="web">Application web</SelectItem>
                <SelectItem value="desktop">Application desktop (Windows)</SelectItem>
                <SelectItem value="both">Web + Desktop</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Modules intéressés</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {MODULE_OPTIONS.map((mod) => (
              <label
                key={mod.id}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
              >
                <Checkbox
                  checked={selectedModules.includes(mod.id)}
                  onCheckedChange={(c) => toggleModule(mod.id, c === true)}
                />
                {mod.label}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message">Message (optionnel)</Label>
          <Textarea
            id="message"
            rows={4}
            value={form.message}
            onChange={(e) => setField('message', e.target.value)}
            placeholder="Décrivez vos besoins ou posez vos questions..."
          />
        </div>

        {captchaConfigured && (
          <div className="flex justify-center">
            <HCaptcha
              ref={captchaRef}
              sitekey={hcaptchaSiteKey}
              onVerify={(token) => setCaptchaToken(token)}
              onExpire={() => setCaptchaToken(null)}
            />
          </div>
        )}

        <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {type === 'trial' ? 'Demander mon essai gratuit' : 'Demander un devis licence'}
        </Button>
      </form>
    </div>
  );
}
