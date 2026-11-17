create index if not exists activity_logs_clinic_action_created_idx on public.activity_logs (clinic_id, action, created_at desc);
create index if not exists receivables_clinic_created_idx on public.receivables (clinic_id, created_at desc);
create index if not exists payables_clinic_created_idx on public.payables (clinic_id, created_at desc);
create index if not exists payable_installments_payable_idx on public.payable_installments (payable_id);