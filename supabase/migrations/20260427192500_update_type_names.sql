-- Update devis types
UPDATE public.devis SET type = 'achat' WHERE type = 'entrant';
UPDATE public.devis SET type = 'vente' WHERE type = 'sortant';

-- Update bons_commande types
UPDATE public.bons_commande SET type = 'achat' WHERE type = 'entrant';
UPDATE public.bons_commande SET type = 'vente' WHERE type = 'sortant';

-- Note: add similar updates to other tables if they use the same enum/type names
