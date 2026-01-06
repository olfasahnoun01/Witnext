export const SPECIALITES = [
  'Chaussures',
  'Vêtements',
  'Matériels',
  'Équipements de sécurité',
  'Outillage',
  'Électronique',
  'Fournitures de bureau',
  'Autre'
] as const;

export type Specialite = typeof SPECIALITES[number];
