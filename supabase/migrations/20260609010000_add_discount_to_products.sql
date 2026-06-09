-- Ajoute une colonne pour le pourcentage de solde (par défaut à 0)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS discount_percentage INT DEFAULT 0;
