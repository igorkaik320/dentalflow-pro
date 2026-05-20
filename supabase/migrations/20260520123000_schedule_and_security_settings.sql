CREATE TABLE IF NOT EXISTS public.clinic_working_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_open BOOLEAN NOT NULL DEFAULT true,
  start_time TIME NOT NULL DEFAULT '08:00',
  end_time TIME NOT NULL DEFAULT '18:00',
  slot_minutes INTEGER NOT NULL DEFAULT 60 CHECK (slot_minutes IN (15, 30, 45, 60, 90, 120)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_clinic_working_hours_clinic_day
ON public.clinic_working_hours(clinic_id, day_of_week);

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS job_title TEXT,
ADD COLUMN IF NOT EXISTS password_setup_required BOOLEAN NOT NULL DEFAULT false;

DROP TRIGGER IF EXISTS update_clinic_working_hours_updated_at ON public.clinic_working_hours;
CREATE TRIGGER update_clinic_working_hours_updated_at
BEFORE UPDATE ON public.clinic_working_hours
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.clinic_working_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read clinic working hours" ON public.clinic_working_hours;
CREATE POLICY "Members can read clinic working hours"
ON public.clinic_working_hours
FOR SELECT TO authenticated
USING (public.is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "Admins can create clinic working hours" ON public.clinic_working_hours;
CREATE POLICY "Admins can create clinic working hours"
ON public.clinic_working_hours
FOR INSERT TO authenticated
WITH CHECK (public.has_clinic_role(clinic_id, 'admin'));

DROP POLICY IF EXISTS "Admins can update clinic working hours" ON public.clinic_working_hours;
CREATE POLICY "Admins can update clinic working hours"
ON public.clinic_working_hours
FOR UPDATE TO authenticated
USING (public.has_clinic_role(clinic_id, 'admin'))
WITH CHECK (public.has_clinic_role(clinic_id, 'admin'));

DROP POLICY IF EXISTS "Admins can delete clinic working hours" ON public.clinic_working_hours;
CREATE POLICY "Admins can delete clinic working hours"
ON public.clinic_working_hours
FOR DELETE TO authenticated
USING (public.has_clinic_role(clinic_id, 'admin'));

DROP POLICY IF EXISTS "Members can view fellow member profiles" ON public.profiles;
CREATE POLICY "Members can view fellow member profiles"
ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.clinic_members viewer
    JOIN public.clinic_members subject
      ON subject.clinic_id = viewer.clinic_id
    WHERE viewer.user_id = auth.uid()
      AND viewer.active = true
      AND subject.user_id = public.profiles.user_id
      AND subject.active = true
  )
);

DROP POLICY IF EXISTS "Admins can add clinic members" ON public.clinic_members;
CREATE POLICY "Admins can add clinic members"
ON public.clinic_members
FOR INSERT TO authenticated
WITH CHECK (public.has_clinic_role(clinic_id, 'admin'));

DROP POLICY IF EXISTS "Admins can delete clinic members" ON public.clinic_members;
CREATE POLICY "Admins can delete clinic members"
ON public.clinic_members
FOR DELETE TO authenticated
USING (public.has_clinic_role(clinic_id, 'admin') AND user_id <> auth.uid());
