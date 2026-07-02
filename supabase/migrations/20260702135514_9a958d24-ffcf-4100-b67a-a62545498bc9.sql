GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT SELECT ON public.stories TO anon;
GRANT ALL ON public.stories TO service_role;