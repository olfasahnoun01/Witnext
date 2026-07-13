import { z } from 'zod';

export const productCreateSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis'),
  sku: z.string().trim().min(1, 'Le code article est requis'),
  category: z.string().trim().min(1, 'La catégorie est requise'),
  fournisseur: z.string().optional().default(''),
  size: z.string().optional().default(''),
  price: z.number().finite().nonnegative('Le prix doit être positif ou nul'),
  remise: z.number().finite().min(0).max(100).optional().default(0),
  min_stock: z.number().int().nonnegative().optional().default(0),
  color: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  quantity: z.number().int().nonnegative().optional().default(0),
  subject_to_fodec: z.boolean().optional().default(false),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;

export const productUpdateSchema = productCreateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Aucune donnée à mettre à jour',
  });
