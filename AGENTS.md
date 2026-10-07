# Architecture rules

- Financial sections use explicit guarded URLs backed by the shared FinancialPage; preserve existing financial permissions and data workflows.
- AuditPage is read-only and administrator-only; database policies enforce access and triggers own event creation.
- Removing a module from navigation must remove its route and overview widgets while preserving historical records.
- Clinic branding in navigation comes from ClinicContext without rendering a logo image.