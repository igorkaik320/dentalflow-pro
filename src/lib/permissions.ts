export type PermissionAction = "view" | "create" | "update" | "delete";
export type PermissionModule = "dashboard" | "agenda" | "registrations" | "patrimony" | "financial" | "payable_installments" | "settings" | "security";
export type AppRole = "admin" | "reception" | "dentist" | "finance";

export type ModulePermissions = Record<PermissionAction, boolean>;
export type PermissionMap = Record<PermissionModule, ModulePermissions>;

export const permissionActions: Array<{ key: PermissionAction; label: string }> = [
  { key: "view", label: "Consultar" },
  { key: "create", label: "Criar" },
  { key: "update", label: "Editar" },
  { key: "delete", label: "Excluir" },
];

export const permissionModules: Array<{ key: PermissionModule; label: string; group: "principal" | "financeiro" | "sistema" }> = [
  { key: "dashboard", label: "Dashboard", group: "principal" },
  { key: "agenda", label: "Agenda", group: "principal" },
  { key: "registrations", label: "Cadastros", group: "principal" },
  { key: "patrimony", label: "Patrimônio", group: "principal" },
  { key: "financial", label: "Financeiro", group: "financeiro" },
  { key: "payable_installments", label: "Parcelas", group: "financeiro" },
  { key: "settings", label: "Configurações", group: "sistema" },
  { key: "security", label: "Segurança", group: "sistema" },
];

export const emptyModulePermissions: ModulePermissions = {
  view: false,
  create: false,
  update: false,
  delete: false,
};

export const fullModulePermissions: ModulePermissions = {
  view: true,
  create: true,
  update: true,
  delete: true,
};

export function buildRolePermissions(role: AppRole | null | undefined): PermissionMap {
  const permissions = Object.fromEntries(
    permissionModules.map((module) => [module.key, { ...emptyModulePermissions }])
  ) as PermissionMap;

  if (role === "admin") {
    for (const module of permissionModules) permissions[module.key] = { ...fullModulePermissions };
    return permissions;
  }

  permissions.dashboard.view = true;

  if (role === "finance") {
    permissions.financial = { ...fullModulePermissions };
    permissions.payable_installments = { ...fullModulePermissions };
    permissions.registrations.view = true;
    permissions.patrimony.view = true;
    return permissions;
  }

  if (role === "dentist") {
    permissions.agenda = { ...fullModulePermissions };
    permissions.registrations = { ...fullModulePermissions };
    permissions.patrimony.view = true;
    return permissions;
  }

  permissions.agenda = { ...fullModulePermissions };
  permissions.registrations = { ...fullModulePermissions };
  permissions.patrimony.view = true;
  return permissions;
}

export function mergePermissionRows(role: AppRole | null | undefined, rows: any[] = []) {
  const permissions = buildRolePermissions(role);
  if (role === "admin") return permissions;

  for (const row of rows) {
    if (!row.module || !(row.module in permissions)) continue;
    permissions[row.module as PermissionModule] = {
      view: Boolean(row.can_view),
      create: Boolean(row.can_create),
      update: Boolean(row.can_update),
      delete: Boolean(row.can_delete),
    };
  }

  return permissions;
}
