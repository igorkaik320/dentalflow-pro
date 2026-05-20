ALTER TABLE public.receivables
ADD COLUMN IF NOT EXISTS category TEXT;
