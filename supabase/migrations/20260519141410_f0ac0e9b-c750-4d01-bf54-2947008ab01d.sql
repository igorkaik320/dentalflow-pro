DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'reception', 'dentist', 'finance');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clinics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'OdontoSaaS',
  cnpj TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  logo_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clinic_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL DEFAULT 'admin',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cpf TEXT,
  birth_date DATE,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  medical_notes TEXT,
  insurance TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.procedures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  average_duration INTEGER NOT NULL DEFAULT 30,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cnpj TEXT,
  phone TEXT,
  email TEXT,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financial_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, name, type)
);

CREATE TABLE IF NOT EXISTS public.professionals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  specialty TEXT,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  phone TEXT,
  email TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  procedure_id UUID REFERENCES public.procedures(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  professional_name TEXT NOT NULL,
  procedure_name TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration INTEGER NOT NULL DEFAULT 30,
  value NUMERIC(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'attended', 'missed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.receivables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  professional_name TEXT,
  procedure_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  installments INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'overdue')),
  due_date DATE NOT NULL,
  paid_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'overdue')),
  due_date DATE NOT NULL,
  paid_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id UUID,
  table_name TEXT NOT NULL,
  action TEXT NOT NULL,
  record_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_members_user_id ON public.clinic_members(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON public.patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_date ON public.appointments(clinic_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_receivables_clinic_due ON public.receivables(clinic_id, due_date);
CREATE INDEX IF NOT EXISTS idx_payables_clinic_due ON public.payables(clinic_id, due_date);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_clinic_member(_clinic_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_members
    WHERE clinic_id = _clinic_id
      AND user_id = auth.uid()
      AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_clinic_role(_clinic_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_members
    WHERE clinic_id = _clinic_id
      AND user_id = auth.uid()
      AND role = _role
      AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.log_clinic_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_clinic UUID;
  target_id UUID;
BEGIN
  target_clinic := COALESCE(NEW.clinic_id, OLD.clinic_id);
  target_id := COALESCE(NEW.id, OLD.id);
  INSERT INTO public.activity_logs (clinic_id, user_id, table_name, action, record_id, details)
  VALUES (target_clinic, auth.uid(), TG_TABLE_NAME, TG_OP, target_id, jsonb_build_object('at', now()));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','clinics','patients','procedures','suppliers','financial_categories','professionals','appointments','receivables','payables'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
  END LOOP;
END $$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['patients','procedures','suppliers','financial_categories','professionals','appointments','receivables','payables'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS log_%I_changes ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER log_%I_changes AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_clinic_change()', t, t);
  END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Clinic creators can create clinics" ON public.clinics FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Clinic members can view clinics" ON public.clinics FOR SELECT TO authenticated USING (public.is_clinic_member(id) OR created_by = auth.uid());
CREATE POLICY "Clinic admins can update clinics" ON public.clinics FOR UPDATE TO authenticated USING (public.has_clinic_role(id, 'admin') OR created_by = auth.uid()) WITH CHECK (public.has_clinic_role(id, 'admin') OR created_by = auth.uid());

CREATE POLICY "Members can view clinic memberships" ON public.clinic_members FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id) OR user_id = auth.uid());
CREATE POLICY "Creators can add their own initial admin membership" ON public.clinic_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND role = 'admin' AND EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_id AND c.created_by = auth.uid()));
CREATE POLICY "Admins can manage memberships" ON public.clinic_members FOR UPDATE TO authenticated USING (public.has_clinic_role(clinic_id, 'admin')) WITH CHECK (public.has_clinic_role(clinic_id, 'admin'));

CREATE POLICY "Members can read patients" ON public.patients FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can create patients" ON public.patients FOR INSERT TO authenticated WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can update patients" ON public.patients FOR UPDATE TO authenticated USING (public.is_clinic_member(clinic_id)) WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can delete patients" ON public.patients FOR DELETE TO authenticated USING (public.is_clinic_member(clinic_id));

CREATE POLICY "Members can read procedures" ON public.procedures FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can create procedures" ON public.procedures FOR INSERT TO authenticated WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can update procedures" ON public.procedures FOR UPDATE TO authenticated USING (public.is_clinic_member(clinic_id)) WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can delete procedures" ON public.procedures FOR DELETE TO authenticated USING (public.is_clinic_member(clinic_id));

CREATE POLICY "Members can read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can create suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (public.is_clinic_member(clinic_id)) WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (public.is_clinic_member(clinic_id));

CREATE POLICY "Members can read categories" ON public.financial_categories FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can create categories" ON public.financial_categories FOR INSERT TO authenticated WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can update categories" ON public.financial_categories FOR UPDATE TO authenticated USING (public.is_clinic_member(clinic_id)) WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can delete categories" ON public.financial_categories FOR DELETE TO authenticated USING (public.is_clinic_member(clinic_id));

CREATE POLICY "Members can read professionals" ON public.professionals FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can create professionals" ON public.professionals FOR INSERT TO authenticated WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can update professionals" ON public.professionals FOR UPDATE TO authenticated USING (public.is_clinic_member(clinic_id)) WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can delete professionals" ON public.professionals FOR DELETE TO authenticated USING (public.is_clinic_member(clinic_id));

CREATE POLICY "Members can read appointments" ON public.appointments FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can create appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can update appointments" ON public.appointments FOR UPDATE TO authenticated USING (public.is_clinic_member(clinic_id)) WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can delete appointments" ON public.appointments FOR DELETE TO authenticated USING (public.is_clinic_member(clinic_id));

CREATE POLICY "Members can read receivables" ON public.receivables FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can create receivables" ON public.receivables FOR INSERT TO authenticated WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can update receivables" ON public.receivables FOR UPDATE TO authenticated USING (public.is_clinic_member(clinic_id)) WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can delete receivables" ON public.receivables FOR DELETE TO authenticated USING (public.is_clinic_member(clinic_id));

CREATE POLICY "Members can read payables" ON public.payables FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can create payables" ON public.payables FOR INSERT TO authenticated WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can update payables" ON public.payables FOR UPDATE TO authenticated USING (public.is_clinic_member(clinic_id)) WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can delete payables" ON public.payables FOR DELETE TO authenticated USING (public.is_clinic_member(clinic_id));

CREATE POLICY "Members can view activity logs" ON public.activity_logs FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));

INSERT INTO storage.buckets (id, name, public)
VALUES ('clinic-logos', 'clinic-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Clinic logos are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'clinic-logos');
CREATE POLICY "Authenticated users can upload clinic logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'clinic-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Authenticated users can update own clinic logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'clinic-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Authenticated users can delete own clinic logos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'clinic-logos' AND auth.uid()::text = (storage.foldername(name))[1]);