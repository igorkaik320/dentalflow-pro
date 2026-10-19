ALTER TABLE public.procedures ADD COLUMN bonus_type text NOT NULL DEFAULT 'none' CHECK (bonus_type IN ('none','fixed','percent'));
ALTER TABLE public.procedures ADD COLUMN bonus_value numeric NOT NULL DEFAULT 0;
ALTER TABLE public.receivables ADD COLUMN seller_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.receivables ADD COLUMN executor_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.payables ADD COLUMN commission_period text;