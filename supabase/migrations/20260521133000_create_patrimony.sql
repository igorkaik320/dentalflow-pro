CREATE TABLE IF NOT EXISTS public.patrimonies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  environment TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  color TEXT,
  supplier TEXT,
  model TEXT,
  photo_url TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Bom' CHECK (status IN ('Otimo', 'Bom', 'Regular', 'Danificado', 'Descartado')),
  source_sheet TEXT,
  source_row INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS patrimonies_clinic_source_key
ON public.patrimonies(clinic_id, source_sheet, source_row)
WHERE source_sheet IS NOT NULL AND source_row IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patrimonies_clinic_environment
ON public.patrimonies(clinic_id, environment);

CREATE INDEX IF NOT EXISTS idx_patrimonies_clinic_status
ON public.patrimonies(clinic_id, status);

DROP TRIGGER IF EXISTS update_patrimonies_updated_at ON public.patrimonies;
CREATE TRIGGER update_patrimonies_updated_at
BEFORE UPDATE ON public.patrimonies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS log_patrimonies_changes ON public.patrimonies;
CREATE TRIGGER log_patrimonies_changes
AFTER INSERT OR UPDATE OR DELETE ON public.patrimonies
FOR EACH ROW
EXECUTE FUNCTION public.log_clinic_change();

ALTER TABLE public.patrimonies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read patrimonies" ON public.patrimonies;
CREATE POLICY "Members can read patrimonies"
ON public.patrimonies
FOR SELECT TO authenticated
USING (public.is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "Members can create patrimonies" ON public.patrimonies;
CREATE POLICY "Members can create patrimonies"
ON public.patrimonies
FOR INSERT TO authenticated
WITH CHECK (public.is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "Members can update patrimonies" ON public.patrimonies;
CREATE POLICY "Members can update patrimonies"
ON public.patrimonies
FOR UPDATE TO authenticated
USING (public.is_clinic_member(clinic_id))
WITH CHECK (public.is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "Members can delete patrimonies" ON public.patrimonies;
CREATE POLICY "Members can delete patrimonies"
ON public.patrimonies
FOR DELETE TO authenticated
USING (public.is_clinic_member(clinic_id));

INSERT INTO storage.buckets (id, name, public)
VALUES ('patrimony-photos', 'patrimony-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Patrimony photos are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Clinic members can upload patrimony photos" ON storage.objects;
DROP POLICY IF EXISTS "Clinic members can update patrimony photos" ON storage.objects;
DROP POLICY IF EXISTS "Clinic members can delete patrimony photos" ON storage.objects;

CREATE POLICY "Patrimony photos are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'patrimony-photos');

CREATE POLICY "Clinic members can upload patrimony photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'patrimony-photos'
  AND EXISTS (
    SELECT 1
    FROM public.clinic_members cm
    WHERE cm.clinic_id::text = (storage.foldername(name))[1]
      AND cm.user_id = auth.uid()
      AND cm.active = true
  )
);

CREATE POLICY "Clinic members can update patrimony photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'patrimony-photos'
  AND EXISTS (
    SELECT 1
    FROM public.clinic_members cm
    WHERE cm.clinic_id::text = (storage.foldername(name))[1]
      AND cm.user_id = auth.uid()
      AND cm.active = true
  )
)
WITH CHECK (
  bucket_id = 'patrimony-photos'
  AND EXISTS (
    SELECT 1
    FROM public.clinic_members cm
    WHERE cm.clinic_id::text = (storage.foldername(name))[1]
      AND cm.user_id = auth.uid()
      AND cm.active = true
  )
);

CREATE POLICY "Clinic members can delete patrimony photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'patrimony-photos'
  AND EXISTS (
    SELECT 1
    FROM public.clinic_members cm
    WHERE cm.clinic_id::text = (storage.foldername(name))[1]
      AND cm.user_id = auth.uid()
      AND cm.active = true
  )
);
