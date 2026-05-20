ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_clinic_external_uniq UNIQUE (clinic_id, external_id);
ALTER TABLE public.payables ADD CONSTRAINT payables_clinic_external_uniq UNIQUE (clinic_id, external_id);
ALTER TABLE public.payable_installments ADD CONSTRAINT payable_installments_clinic_external_uniq UNIQUE (clinic_id, external_id);