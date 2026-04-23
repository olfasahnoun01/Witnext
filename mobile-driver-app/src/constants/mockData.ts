export interface Voucher {
  id: string;
  numBon: string;
  date: string;
  montant: number;
  vehicule: string;
  conducteur: string;
  typeCarburant: 'essence' | 'gasoil';
  status: 'en_attente' | 'utilise';
  proofUrl?: string;
}

export const MOCK_USER = {
  id: 'driver-123',
  fullName: 'Ahmed Mansour',
  email: 'ahmed.mansour@grosafe.tn',
  role: 'chauffeur',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmed',
};

export const MOCK_VOUCHERS: Voucher[] = [
  {
    id: 'v1',
    numBon: 'BON-2024-101',
    date: new Date().toISOString(),
    montant: 150,
    vehicule: 'Peugeot Partner (256 TN 4852)',
    conducteur: 'Ahmed Mansour',
    typeCarburant: 'gasoil',
    status: 'en_attente',
  },
  {
    id: 'v2',
    numBon: 'BON-2024-105',
    date: new Date().toISOString(),
    montant: 80,
    vehicule: 'Renault Kangoo (198 TN 7531)',
    conducteur: 'Ahmed Mansour',
    typeCarburant: 'essence',
    status: 'en_attente',
  },
  {
    id: 'v3',
    numBon: 'BON-2024-098',
    date: new Date(Date.now() - 86400000).toISOString(),
    montant: 200,
    vehicule: 'Dacia Dokker (212 TN 6542)',
    conducteur: 'Ahmed Mansour',
    typeCarburant: 'gasoil',
    status: 'utilise',
    proofUrl: 'https://images.unsplash.com/photo-1599420186946-7b6fb4e297f0?q=80&w=300&auto=format&fit=crop',
  },
];
