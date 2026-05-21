CREATE OR REPLACE FUNCTION public.create_virtuosa_signup_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_clinic_id UUID := '310d3829-d256-4906-a5c8-0faa7836c7e3';
  requested_name TEXT;
BEGIN
  requested_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.email,
    'Usuario'
  );

  INSERT INTO public.profiles (
    user_id,
    email,
    full_name,
    job_title,
    password_setup_required
  )
  VALUES (
    NEW.id,
    NEW.email,
    requested_name,
    'reception',
    false
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    updated_at = now();

  INSERT INTO public.clinic_members (
    clinic_id,
    user_id,
    role,
    active
  )
  VALUES (
    target_clinic_id,
    NEW.id,
    'reception',
    false
  )
  ON CONFLICT (clinic_id, user_id)
  DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_virtuosa_request ON auth.users;
CREATE TRIGGER on_auth_user_created_virtuosa_request
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_virtuosa_signup_request();

INSERT INTO public.profiles (
  user_id,
  email,
  full_name,
  job_title,
  password_setup_required
)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email, 'Usuario'),
  'reception',
  false
FROM auth.users u
WHERE u.email IS NOT NULL
ON CONFLICT (user_id)
DO UPDATE SET
  email = EXCLUDED.email,
  full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
  updated_at = now();

INSERT INTO public.clinic_members (
  clinic_id,
  user_id,
  role,
  active
)
SELECT
  '310d3829-d256-4906-a5c8-0faa7836c7e3'::uuid,
  u.id,
  'reception',
  false
FROM auth.users u
WHERE u.email IS NOT NULL
ON CONFLICT (clinic_id, user_id)
DO NOTHING;

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
  )
);
