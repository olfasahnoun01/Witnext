/**
 * Générateur XML TEJ — certificats de retenue à la source (CCT-RS V2).
 * Structure conforme à TEJDeclarationRS_v1.0 (dépôt https://tej.finances.gov.tn).
 */

import { round3 } from '../money';
import type {
  WithholdingBeneficiaire,
  WithholdingCertificate,
  WithholdingOperationLine,
} from '../../types/financeDomain';
import {
  TEJ_SCHEMA_VERSION,
  buildTejFilename,
  dtToMillimes,
  formatTejDate,
  formatTejTaux,
  hasForbiddenTejText,
  isKnownTejOperationCode,
  isValidMatriculeFiscal,
  isValidTejEmail,
  normalizeMatriculeFiscal,
  sanitizeTejText,
} from './tejCodes';

export type TejActeDepot = '0' | '1';

export interface TejDeclarant {
  matriculeFiscal: string;
  categorieContribuable: 'PM' | 'PP';
}

export interface TejExportInput {
  declarant: TejDeclarant;
  year: number;
  month: number;
  acteDepot: TejActeDepot;
  certificates: WithholdingCertificate[];
}

export interface TejValidationIssue {
  level: 'error' | 'warning';
  message: string;
  certificateId?: string;
}

export interface TejExportResult {
  xml: string;
  filename: string;
  issues: TejValidationIssue[];
  ok: boolean;
}

function esc(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function indent(level: number): string {
  return '  '.repeat(level);
}

function lineTag(level: number, name: string, value: string | number): string {
  return `${indent(level)}<${name}>${esc(value)}</${name}>`;
}

function requiredBeneficiaire(cert: WithholdingCertificate): WithholdingBeneficiaire | null {
  return cert.beneficiaire ?? null;
}

function normalizeLine(raw: WithholdingOperationLine | Record<string, unknown>): WithholdingOperationLine {
  const r = raw as WithholdingOperationLine & {
    montantTtc?: number;
    assiette?: number;
    taux?: number;
    montantRetenue?: number;
    factureNumero?: string;
    montantHt?: number;
    montantTva?: number;
    idTypeOperation?: string;
    anneeFacturation?: string;
    tauxTva?: number;
    cnpc?: '0' | '1';
    pCharge?: '0' | '1';
  };
  const montantHt = Number(r.montantHt ?? r.assiette ?? 0);
  const montantTtc = Number(r.montantTtc ?? (montantHt > 0 ? montantHt : 0));
  const montantTva = Number(r.montantTva ?? Math.max(0, round3(montantTtc - montantHt)));
  const taux = Number(r.taux ?? 0);
  const montantRetenue = Number(r.montantRetenue ?? 0);

  return {
    factureNumero: String(r.factureNumero ?? ''),
    anneeFacturation: String(r.anneeFacturation ?? ''),
    idTypeOperation: String(r.idTypeOperation ?? ''),
    montantHt,
    montantTva,
    montantTtc,
    assiette: Number(r.assiette ?? 0),
    taux,
    montantRetenue,
    tauxTva: Number(r.tauxTva ?? (montantHt > 0 ? round3((montantTva / montantHt) * 100) : 0)),
    cnpc: r.cnpc ?? '0',
    pCharge: r.pCharge ?? '0',
  };
}

/** Normalise uniquement les types; ne fabrique jamais de données fiscales manquantes. */
export function hydrateCertificateForTej(cert: WithholdingCertificate): WithholdingCertificate {
  return {
    ...cert,
    lignes: (cert.lignes ?? []).map(normalizeLine),
  };
}

function isValidIsoPaymentDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function pushForbiddenTextIssue(
  issues: TejValidationIssue[],
  cert: WithholdingCertificate,
  label: string,
  value: string | null | undefined
): void {
  if (hasForbiddenTejText(value)) {
    issues.push({
      level: 'error',
      certificateId: cert.id,
      message: `${label} contient un caractère ou une séquence interdite par TEJ (${cert.counterpartyName}).`,
    });
  }
}

/** Valide les données avant génération (erreurs bloquantes + warnings). */
export function validateTejExport(input: TejExportInput): TejValidationIssue[] {
  const issues: TejValidationIssue[] = [];
  const mf = normalizeMatriculeFiscal(input.declarant.matriculeFiscal);

  if (!mf || !isValidMatriculeFiscal(mf)) {
    issues.push({
      level: 'error',
      message:
        'Matricule fiscal du déclarant invalide — format attendu : 7 chiffres + lettre (ex. 0001238L).',
    });
  }
  if (input.declarant.categorieContribuable !== 'PM' && input.declarant.categorieContribuable !== 'PP') {
    issues.push({ level: 'error', message: 'Catégorie déclarant requise (PM ou PP).' });
  }
  if (input.month < 1 || input.month > 12) {
    issues.push({ level: 'error', message: 'Mois de dépôt invalide (01–12).' });
  }
  if (input.year < 2000 || input.year > 2099) {
    issues.push({ level: 'error', message: 'Année de dépôt invalide.' });
  }

  const payeur = input.certificates
    .filter((c) => c.mode === 'PAYEUR')
    .map(hydrateCertificateForTej);
  if (payeur.length === 0) {
    issues.push({
      level: 'error',
      message: 'Aucun certificat PAYEUR pour la période sélectionnée.',
    });
  }

  const references = new Set<string>();
  for (const cert of payeur) {
    const id = cert.id;
    if (!isValidMatriculeFiscal(cert.matriculeFiscal)) {
      issues.push({
        level: 'error',
        certificateId: id,
        message: `MF bénéficiaire invalide pour « ${cert.counterpartyName} ».`,
      });
    }
    if (!isValidIsoPaymentDate(cert.paymentDate)) {
      issues.push({
        level: 'error',
        certificateId: id,
        message: `Date de paiement invalide (${cert.counterpartyName}).`,
      });
    } else {
      const [y, m] = cert.paymentDate.split('-').map(Number);
      if (y !== input.year || m !== input.month) {
        issues.push({
          level: 'error',
          certificateId: id,
          message: `Paiement ${cert.paymentDate} hors période ${input.year}-${String(input.month).padStart(2, '0')}.`,
        });
      }
    }
    if (!cert.lignes?.length) {
      issues.push({
        level: 'error',
        certificateId: id,
        message: `Aucune opération sur le certificat ${cert.refCertif || id}.`,
      });
    }
    if (!sanitizeTejText(cert.refCertif)) {
      issues.push({ level: 'error', certificateId: id, message: `Référence certificat manquante (${cert.counterpartyName}).` });
    } else if (references.has(sanitizeTejText(cert.refCertif))) {
      issues.push({ level: 'error', certificateId: id, message: `Référence certificat dupliquée : ${cert.refCertif}.` });
    } else {
      references.add(sanitizeTejText(cert.refCertif));
    }
    if (!sanitizeTejText(cert.counterpartyName)) {
      issues.push({ level: 'error', certificateId: id, message: 'Nom ou raison sociale bénéficiaire manquant.' });
    }
    const ben = requiredBeneficiaire(cert);
    if (!ben) {
      issues.push({
        level: 'error',
        certificateId: id,
        message: `Informations bénéficiaire TEJ manquantes (${cert.counterpartyName}).`,
      });
    } else {
      if (!sanitizeTejText(ben.adresse)) {
        issues.push({ level: 'error', certificateId: id, message: `Adresse bénéficiaire manquante (${cert.counterpartyName}).` });
      }
      if (!isValidTejEmail(ben.email)) {
        issues.push({ level: 'error', certificateId: id, message: `Email bénéficiaire invalide (${cert.counterpartyName}).` });
      }
      if (!sanitizeTejText(ben.tel)) {
        issues.push({ level: 'error', certificateId: id, message: `Téléphone bénéficiaire manquant (${cert.counterpartyName}).` });
      }
      if (!['PM', 'PP'].includes(ben.categorieContribuable) || !['0', '1'].includes(ben.resident)) {
        issues.push({ level: 'error', certificateId: id, message: `Catégorie ou résidence bénéficiaire invalide (${cert.counterpartyName}).` });
      }
      for (const [label, value] of [
        ['Raison sociale', cert.counterpartyName],
        ['Adresse', ben.adresse],
        ['Activité', ben.activite],
        ['Email', ben.email],
        ['Téléphone', ben.tel],
        ['Référence certificat', cert.refCertif],
      ] as const) {
        pushForbiddenTextIssue(issues, cert, label, value);
      }
    }
    let linesRs = 0;
    for (const raw of cert.lignes ?? []) {
      const line = normalizeLine(raw);
      linesRs = round3(linesRs + line.montantRetenue);
      if (!isKnownTejOperationCode(line.idTypeOperation)) {
        issues.push({
          level: 'error',
          certificateId: id,
          message: `Code opération TEJ invalide ou manquant (facture ${line.factureNumero || '—'}).`,
        });
      }
      if (!/^20\d{2}$/.test(line.anneeFacturation)) {
        issues.push({
          level: 'error',
          certificateId: id,
          message: `Année de facturation invalide (facture ${line.factureNumero || '—'}).`,
        });
      }
      if (line.montantHt < 0 || line.montantTva < 0 || line.montantTtc <= 0 || line.montantRetenue <= 0) {
        issues.push({
          level: 'error',
          certificateId: id,
          message: `Montants TEJ incomplets ou invalides (facture ${line.factureNumero || '—'}).`,
        });
      }
      if (line.taux < 0 || line.taux > 100 || line.tauxTva < 0 || line.tauxTva > 100) {
        issues.push({
          level: 'error',
          certificateId: id,
          message: `Taux RS/TVA invalide (facture ${line.factureNumero || '—'}).`,
        });
      }
      if (!['0', '1'].includes(line.cnpc ?? '') || !['0', '1'].includes(line.pCharge ?? '')) {
        issues.push({
          level: 'error',
          certificateId: id,
          message: `CNPC ou prise en charge invalide (facture ${line.factureNumero || '—'}).`,
        });
      }
      if (dtToMillimes(line.montantTtc) !== dtToMillimes(line.montantHt) + dtToMillimes(line.montantTva)) {
        issues.push({
          level: 'error',
          certificateId: id,
          message: `HT + TVA ne correspond pas au TTC (facture ${line.factureNumero || '—'}).`,
        });
      }
      const expectedRs = round3(line.montantTtc * (line.taux / 100));
      if (Math.abs(expectedRs - line.montantRetenue) > 0.001) {
        issues.push({
          level: 'error',
          certificateId: id,
          message: `Montant RS incohérent avec le TTC et le taux (facture ${line.factureNumero || '—'}).`,
        });
      }
      pushForbiddenTextIssue(issues, cert, 'Numéro de facture', line.factureNumero);
    }
    if (Math.abs(linesRs - Number(cert.totalRetenue)) > 0.001) {
      issues.push({
        level: 'error',
        certificateId: id,
        message: `Le total RS du certificat ne correspond pas à la somme des opérations (${cert.counterpartyName}).`,
      });
    }
  }

  return issues;
}

function renderBeneficiaire(cert: WithholdingCertificate, level: number): string[] {
  const ben = requiredBeneficiaire(cert);
  if (!ben) return [];
  const mf = normalizeMatriculeFiscal(cert.matriculeFiscal) ?? '';
  const lines: string[] = [];
  lines.push(`${indent(level)}<Beneficiaire>`);
  lines.push(`${indent(level + 1)}<IdTaxpayer>`);
  lines.push(`${indent(level + 2)}<MatriculeFiscal>`);
  lines.push(lineTag(level + 3, 'TypeIdentifiant', '1'));
  lines.push(lineTag(level + 3, 'Identifiant', mf));
  lines.push(lineTag(level + 3, 'CategorieContribuable', ben.categorieContribuable));
  lines.push(`${indent(level + 2)}</MatriculeFiscal>`);
  lines.push(`${indent(level + 1)}</IdTaxpayer>`);
  lines.push(lineTag(level + 1, 'Resident', ben.resident));
  lines.push(lineTag(level + 1, 'NometprenonOuRaisonsociale', sanitizeTejText(cert.counterpartyName)));
  lines.push(lineTag(level + 1, 'Adresse', sanitizeTejText(ben.adresse)));
  if (ben.activite) {
    lines.push(lineTag(level + 1, 'Activite', sanitizeTejText(ben.activite)));
  }
  lines.push(`${indent(level + 1)}<InfosContact>`);
  lines.push(lineTag(level + 2, 'AdresseMail', ben.email));
  lines.push(lineTag(level + 2, 'NumTel', sanitizeTejText(ben.tel)));
  lines.push(`${indent(level + 1)}</InfosContact>`);
  lines.push(`${indent(level)}</Beneficiaire>`);
  return lines;
}

function renderOperation(line: WithholdingOperationLine, level: number): string[] {
  const ht = dtToMillimes(line.montantHt);
  const tva = dtToMillimes(line.montantTva);
  const ttc = dtToMillimes(line.montantTtc);
  const rs = dtToMillimes(line.montantRetenue);
  const net = line.pCharge === '1' ? ttc : Math.max(0, ttc - rs);
  const lines: string[] = [];
  lines.push(`${indent(level)}<Operation IdTypeOperation="${esc(line.idTypeOperation)}">`);
  lines.push(lineTag(level + 1, 'AnneeFacturation', line.anneeFacturation));
  lines.push(lineTag(level + 1, 'CNPC', line.cnpc ?? '0'));
  lines.push(lineTag(level + 1, 'P_Charge', line.pCharge ?? '0'));
  lines.push(lineTag(level + 1, 'MontantHT', ht));
  lines.push(lineTag(level + 1, 'TauxRS', formatTejTaux(line.taux)));
  lines.push(lineTag(level + 1, 'TauxTVA', formatTejTaux(line.tauxTva)));
  lines.push(lineTag(level + 1, 'MontantTVA', tva));
  lines.push(lineTag(level + 1, 'MontantTTC', ttc));
  lines.push(lineTag(level + 1, 'MontantRS', rs));
  lines.push(lineTag(level + 1, 'MontantNetServi', net));
  lines.push(`${indent(level)}</Operation>`);
  return lines;
}

function renderCertificat(cert: WithholdingCertificate, level: number): string[] {
  const ops = (cert.lignes ?? []).map(normalizeLine);
  let totalHt = 0;
  let totalTva = 0;
  let totalTtc = 0;
  let totalRs = 0;
  let totalNet = 0;
  for (const op of ops) {
    const ht = dtToMillimes(op.montantHt);
    const tva = dtToMillimes(op.montantTva);
    const ttc = dtToMillimes(op.montantTtc);
    const rs = dtToMillimes(op.montantRetenue);
    totalHt += ht;
    totalTva += tva;
    totalTtc += ttc;
    totalRs += rs;
    totalNet += op.pCharge === '1' ? ttc : Math.max(0, ttc - rs);
  }

  const lines: string[] = [];
  lines.push(`${indent(level)}<Certificat>`);
  lines.push(...renderBeneficiaire(cert, level + 1));
  lines.push(lineTag(level + 1, 'DatePayement', formatTejDate(cert.paymentDate)));
  lines.push(lineTag(level + 1, 'Ref_certif_chez_declarant', sanitizeTejText(cert.refCertif)));
  lines.push(`${indent(level + 1)}<ListeOperations>`);
  for (const op of ops) {
    lines.push(...renderOperation(op, level + 2));
  }
  lines.push(`${indent(level + 1)}</ListeOperations>`);
  lines.push(`${indent(level + 1)}<TotalPayement>`);
  lines.push(lineTag(level + 2, 'TotalMontantHT', totalHt));
  lines.push(lineTag(level + 2, 'TotalMontantTVA', totalTva));
  lines.push(lineTag(level + 2, 'TotalMontantTTC', totalTtc));
  lines.push(lineTag(level + 2, 'TotalMontantRS', totalRs));
  lines.push(lineTag(level + 2, 'TotalMontantNetServi', totalNet));
  lines.push(`${indent(level + 1)}</TotalPayement>`);
  lines.push(`${indent(level)}</Certificat>`);
  return lines;
}

/** Construit le XML TEJ UTF-8 (XML 1.0). */
export function buildTejXml(input: TejExportInput): TejExportResult {
  const issues = validateTejExport(input);
  const mf = normalizeMatriculeFiscal(input.declarant.matriculeFiscal) ?? '';
  const filename = buildTejFilename(mf || 'INVALID', input.year, input.month, input.acteDepot);
  const hasErrors = issues.some((i) => i.level === 'error');

  const payeur = input.certificates
    .filter((c) => c.mode === 'PAYEUR')
    .map(hydrateCertificateForTej);
  const mm = String(input.month).padStart(2, '0');

  const body: string[] = [];
  body.push('<?xml version="1.0" encoding="UTF-8"?>');
  body.push(`<DeclarationsRS VersionSchema="${TEJ_SCHEMA_VERSION}">`);
  body.push(`${indent(1)}<Declarant>`);
  body.push(lineTag(2, 'TypeIdentifiant', '1'));
  body.push(lineTag(2, 'Identifiant', mf));
  body.push(lineTag(2, 'CategorieContribuable', input.declarant.categorieContribuable));
  body.push(`${indent(1)}</Declarant>`);
  body.push(`${indent(1)}<ReferenceDeclaration>`);
  body.push(lineTag(2, 'ActeDepot', input.acteDepot));
  body.push(lineTag(2, 'AnneeDepot', String(input.year)));
  body.push(lineTag(2, 'MoisDepot', mm));
  body.push(`${indent(1)}</ReferenceDeclaration>`);
  body.push(`${indent(1)}<AjouterCertificats>`);
  for (const cert of payeur) {
    body.push(...renderCertificat(cert, 2));
  }
  body.push(`${indent(1)}</AjouterCertificats>`);
  body.push('</DeclarationsRS>');

  return {
    xml: body.join('\n') + '\n',
    filename,
    issues,
    ok: !hasErrors,
  };
}

/** Télécharge un Blob XML côté navigateur. */
export function downloadTejXmlFile(xml: string, filename: string): void {
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Filtre les certificats d'une période (mois de paymentDate). */
export function filterCertificatesForPeriod(
  certificates: WithholdingCertificate[],
  year: number,
  month: number
): WithholdingCertificate[] {
  const mm = String(month).padStart(2, '0');
  const prefix = `${year}-${mm}`;
  return certificates.filter((c) => {
    const d = c.paymentDate || c.createdAt?.slice(0, 10) || '';
    return d.startsWith(prefix) && c.mode === 'PAYEUR' && c.totalRetenue > 0;
  });
}
