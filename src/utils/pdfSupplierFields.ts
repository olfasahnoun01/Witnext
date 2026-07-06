/**
 * Extract fournisseur identity fields from devis PDF text.
 * MF → matricule fiscale only. Phone from tel labels only. RIB/IBAN ignored.
 */

const MF_VALUE =
  /\b(\d{6,7}\/[A-Za-z]\/[A-Za-z]\/[A-Za-z]\/\d{3})\b/i;
const MF_LABEL =
  /(?:^|\s)(?:mf|m\.f\.|matricule\s+fiscale?|matricule\s+fiscal)\s*:?\s*/i;
const PHONE_LABEL =
  /(?:tél|tel|téléphone|telephone|gsm|mobile|portable|fax)\s*:?\s*(.+)$/i;
const RIB_CONTEXT =
  /\b(?:rib|iban|bic|swift|banque|compte\s+bancaire|bank\s+account|code\s+banque)\b/i;
const RIB_NUMBER =
  /\b\d{2}[\s.-]?\d{3}[\s.-]?\d{13}[\s.-]?\d{2}\b/;
const IBAN_PATTERN = /\bTN\d{2}[\s\dA-Z]{10,}\b/i;

export function isBankingLine(line: string): boolean {
  const compact = line.replace(/\s/g, '');
  if (RIB_CONTEXT.test(line)) return true;
  if (RIB_NUMBER.test(line)) return true;
  if (IBAN_PATTERN.test(line)) return true;
  if (/^\d{20}$/.test(compact)) return true;
  return false;
}

export function extractMatriculeFiscale(lines: string[], fullText: string): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isBankingLine(line)) continue;

    const inlineLabel = line.match(
      /(?:mf|m\.f\.|matricule\s+fiscale?|matricule\s+fiscal)\s*:?\s*(\d{6,7}\/[A-Za-z]\/[A-Za-z]\/[A-Za-z]\/\d{3})/i
    );
    if (inlineLabel?.[1]) return inlineLabel[1].toUpperCase();

    if (MF_LABEL.test(line)) {
      const sameLine = line.match(MF_VALUE);
      if (sameLine?.[1]) return sameLine[1].toUpperCase();

      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const next = lines[j];
        if (isBankingLine(next)) continue;
        const nextMatch = next.match(MF_VALUE);
        if (nextMatch?.[1]) return nextMatch[1].toUpperCase();
      }
    }
  }

  const safeText = lines.filter((l) => !isBankingLine(l)).join('\n');
  const fallback = safeText.match(MF_VALUE) ?? fullText.match(MF_VALUE);
  return fallback?.[1]?.toUpperCase();
}

/** Tunisian mobile/landline: 8 digits (optionally prefixed +216). Rejects RIB-length strings. */
export function normalizeTunisiaPhone(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed || isBankingLine(trimmed)) return undefined;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 18) return undefined;

  let local = digits;
  if (local.startsWith('00216')) local = local.slice(5);
  else if (local.startsWith('216') && local.length >= 11) local = local.slice(3);

  if (local.length !== 8) return undefined;
  if (!/^[24579]/.test(local)) return undefined;

  return `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
}

export function extractPhoneNumber(lines: string[], fullText: string): string | undefined {
  for (const line of lines) {
    if (isBankingLine(line)) continue;

    const labeled = line.match(PHONE_LABEL);
    if (labeled?.[1]) {
      const fragment = labeled[1].split(/[,;|/]/)[0].trim();
      const phone = normalizeTunisiaPhone(fragment);
      if (phone) return phone;
    }
  }

  for (const m of fullText.matchAll(
    /(?:tél|tel|téléphone|telephone|gsm|mobile|portable|fax)\s*:?\s*([+\d][\d\s./\-]{6,16})/gi
  )) {
    if (isBankingLine(m[0])) continue;
    const phone = normalizeTunisiaPhone(m[1]);
    if (phone) return phone;
  }

  return undefined;
}

export function extractEmail(lines: string[], fullText: string): string | undefined {
  for (const line of lines) {
    if (isBankingLine(line)) continue;
    const m = line.match(/(?:e-?mail|courriel)\s*:?\s*([\w.+-]+@[\w.-]+\.\w{2,})/i);
    if (m?.[1]) return m[1];
  }
  const m = fullText.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
  return m?.[0];
}
