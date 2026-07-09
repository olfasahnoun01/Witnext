import { z } from 'zod';

export const clientUpsertSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom du client est requis'),
  code: z.string().trim().min(1, 'Le code client est requis'),
  matricule_fiscale: z.string().trim().min(1, 'Le matricule fiscal est requis'),
  tva_status: z.string().trim().min(1, 'Le statut TVA est obligatoire'),
  company_id: z.string().uuid('Société active invalide'),
  phone: z.string().nullable(),
  email: z.string().trim().optional().default(''),
  location: z.string().nullable(),
  patente_url: z.string().nullable().optional(),
  registre_commerce_url: z.string().nullable().optional(),
  nature_activite: z.string().nullable().optional(),
  attestation_exoneration_url: z.string().nullable().optional(),
});

export const fournisseurUpsertSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom du fournisseur est requis'),
  code: z.string().nullable(),
  matricule_fiscale: z.string().trim().optional().default(''),
  specialite: z.string().optional(),
  tva_status: z.string().trim().optional(),
  company_id: z.string().uuid('Société active invalide'),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  patente_url: z.string().nullable().optional(),
  registre_commerce_url: z.string().nullable().optional(),
});

export type ClientUpsertInput = z.infer<typeof clientUpsertSchema>;
export type FournisseurUpsertInput = z.infer<typeof fournisseurUpsertSchema>;
