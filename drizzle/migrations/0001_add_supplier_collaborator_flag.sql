ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS is_collaborator boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.suppliers.is_collaborator IS 'Marca o credor como colaborador';