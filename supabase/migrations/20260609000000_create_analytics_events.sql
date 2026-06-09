-- Création de la table pour enregistrer l'activité
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  event_type TEXT NOT NULL
);

-- Activation de la sécurité de lecture/écriture
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permettre l'insertion publique" 
ON public.analytics_events FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Permettre la lecture publique" 
ON public.analytics_events FOR SELECT 
USING (true);
