# Architecture rules

- Financial sections use explicit guarded URLs backed by the shared FinancialPage; preserve existing financial permissions and data workflows.
- AuditPage is read-only and administrator-only; database policies enforce access and triggers own event creation.
- Removing a module from navigation must remove its route and overview widgets while preserving historical records.
- Clinic branding in navigation comes from ClinicContext without rendering a logo image.
- Companies are clinic-scoped; accounts and procedures are company-owned while clients, creditors and categories remain shared, so financial selectors must respect company ownership.
- Installment views live as a "Parcelas" toggle inside Contas a Pagar/Receber; receivable installments are derived from count + monthly due dates, not stored.

- CashControl owns account-scoped ledger and sessions; balances derive from initial balance plus manual movements and linked settlements, never mirrored duplicates or clinic-wide totals.
