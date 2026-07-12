import { describe, it, expect } from 'vitest';
import {
  buildTejFilename,
  dtToMillimes,
  formatTejDate,
  isValidMatriculeFiscal,
  normalizeMatriculeFiscal,
} from '../tejCodes';
import { buildTejXml, filterCertificatesForPeriod } from '../tejXml';
import type { WithholdingCertificate } from '../../../types/financeDomain';

const sampleCert = (overrides?: Partial<WithholdingCertificate>): WithholdingCertificate => ({
  id: 'rs-1',
  companyId: 'co-1',
  mode: 'PAYEUR',
  counterpartyId: 1,
  counterpartyName: 'Fournisseur Test',
  matriculeFiscal: '7654321Y',
  paymentId: 'pay-1',
  paymentDate: '2026-06-15',
  refCertif: 'RS-2026-06-001',
  beneficiaire: {
    categorieContribuable: 'PM',
    resident: '1',
    adresse: 'Tunis',
    activite: 'fournisseur',
    email: 'fournisseur@example.tn',
    tel: '71123456',
  },
  lignes: [
    {
      factureNumero: 'FA-100',
      anneeFacturation: '2026',
      idTypeOperation: 'RS7_000002',
      montantHt: 1000,
      montantTva: 190,
      montantTtc: 1190,
      assiette: 1190,
      taux: 1,
      montantRetenue: 11.9,
      tauxTva: 19,
      cnpc: '0',
      pCharge: '0',
    },
  ],
  totalRetenue: 11.9,
  createdAt: '2026-06-15T10:00:00.000Z',
  ...overrides,
});

describe('tejCodes', () => {
  it('normalizes and validates matricule fiscal', () => {
    expect(normalizeMatriculeFiscal('0001238l')).toBe('0001238L');
    expect(isValidMatriculeFiscal('0001238L')).toBe(true);
    expect(isValidMatriculeFiscal('123')).toBe(false);
  });

  it('converts DT to millimes and formats dates/filenames', () => {
    expect(dtToMillimes(10.5)).toBe(10500);
    expect(formatTejDate('2026-06-15')).toBe('15/06/2026');
    expect(buildTejFilename('0001238L', 2026, 1, '0')).toBe('0001238L-2026-01-0.xml');
  });
});

describe('buildTejXml', () => {
  it('builds a well-formed DeclarationsRS document', () => {
    const result = buildTejXml({
      declarant: { matriculeFiscal: '0001238L', categorieContribuable: 'PM' },
      year: 2026,
      month: 6,
      acteDepot: '0',
      certificates: [sampleCert()],
    });

    expect(result.ok).toBe(true);
    expect(result.filename).toBe('0001238L-2026-06-0.xml');
    expect(result.xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result.xml).toContain('<DeclarationsRS VersionSchema="1.0">');
    expect(result.xml).toContain('<Identifiant>0001238L</Identifiant>');
    expect(result.xml).toContain('<MoisDepot>06</MoisDepot>');
    expect(result.xml).toContain('IdTypeOperation="RS7_000002"');
    expect(result.xml).toContain('<MontantHT>1000000</MontantHT>');
    expect(result.xml).toContain('<MontantRS>11900</MontantRS>');
    expect(result.xml).toContain('<DatePayement>15/06/2026</DatePayement>');
    expect(result.xml).toContain(
      '<Ref_certif_chez_declarant>RS-2026-06-001</Ref_certif_chez_declarant>'
    );
    expect(result.xml).toContain(
      '<NometprenonOuRaisonsociale>Fournisseur Test</NometprenonOuRaisonsociale>'
    );
    expect(result.xml).toContain('<InfosContact>');
    expect(result.xml).not.toContain('<InfoContact>');
  });

  it('rejects invalid declarant MF', () => {
    const result = buildTejXml({
      declarant: { matriculeFiscal: 'BAD', categorieContribuable: 'PM' },
      year: 2026,
      month: 6,
      acteDepot: '0',
      certificates: [sampleCert()],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.level === 'error')).toBe(true);
  });

  it('rejects incomplete legacy data instead of inventing fiscal values', () => {
    const result = buildTejXml({
      declarant: { matriculeFiscal: '0001238L', categorieContribuable: 'PM' },
      year: 2026,
      month: 6,
      acteDepot: '0',
      certificates: [
        sampleCert({
          beneficiaire: null,
          lignes: [
            {
              ...sampleCert().lignes[0],
              idTypeOperation: '',
              montantHt: 0,
              montantTtc: 0,
              montantRetenue: 0,
            },
          ],
        }),
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes('Informations bénéficiaire'))).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes('Code opération TEJ'))).toBe(true);
  });

  it('transliterates accents forbidden by the CCT-RS', () => {
    const result = buildTejXml({
      declarant: { matriculeFiscal: '0001238L', categorieContribuable: 'PM' },
      year: 2026,
      month: 6,
      acteDepot: '0',
      certificates: [sampleCert({ counterpartyName: 'Société Test' })],
    });

    expect(result.ok).toBe(true);
    expect(result.xml).toContain(
      '<NometprenonOuRaisonsociale>Societe Test</NometprenonOuRaisonsociale>'
    );
  });

  it('rejects dangerous sequences forbidden by the CCT-RS', () => {
    const result = buildTejXml({
      declarant: { matriculeFiscal: '0001238L', categorieContribuable: 'PM' },
      year: 2026,
      month: 6,
      acteDepot: '0',
      certificates: [sampleCert({ counterpartyName: "Test' OR 1=1" })],
    });

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes('interdite'))).toBe(true);
  });
});

describe('filterCertificatesForPeriod', () => {
  it('keeps PAYEUR certs of the selected month', () => {
    const list = [
      sampleCert(),
      sampleCert({ id: 'rs-2', paymentDate: '2026-05-01', totalRetenue: 5 }),
      sampleCert({ id: 'rs-3', mode: 'BENEFICIAIRE', totalRetenue: 8 }),
    ];
    const filtered = filterCertificatesForPeriod(list, 2026, 6);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('rs-1');
  });
});
