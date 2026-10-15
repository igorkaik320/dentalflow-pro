# Architecture rules

- Registration codes are database-assigned, immutable and clinic-scoped through atomic counters; selectors must use stored codes rather than list positions or UUID fragments to keep numbers stable under sorting and concurrent creation.

- Financial sections use explicit guarded URLs backed by the shared FinancialPage; preserve existing financial permissions and data workflows.
- AuditPage is read-only and administrator-only; database policies enforce access and triggers own event creation.
- Removing a module from navigation must remove its route and overview widgets while preserving historical records.
- Clinic branding in navigation comes from ClinicContext without rendering a logo image.
- Companies are clinic-scoped; accounts and procedures are company-owned while clients, creditors and categories remain shared, so financial selectors must respect company ownership.
- Installment views live as a "Parcelas" toggle inside Contas a Pagar/Receber; receivable installments are derived from count + monthly due dates, not stored.

- CashControl owns account-scoped ledger and sessions; balances derive from initial balance plus manual movements and linked settlements, never mirrored duplicates or clinic-wide totals.

- Cash movements reference shared creditors and typed financial categories by ID with name snapshots; database validation enforces clinic ownership and income/expense category compatibility.

- Presentation follows the reference through shared layout, form primitives and EntitySearchInput; retain local routes, permissions and database workflows instead of importing reference business logic.
- Registration menu links use the existing guarded registrations route with a tab query parameter, so navigation and the selected registration tab remain synchronized.
