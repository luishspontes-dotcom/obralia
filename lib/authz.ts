export type OrganizationRole = "owner" | "admin" | "engineer" | "viewer";

export const WRITER_ROLES: OrganizationRole[] = ["owner", "admin", "engineer"];
export const ADMIN_ROLES: OrganizationRole[] = ["owner", "admin"];

export function canWrite(role: string | null | undefined): boolean {
  return WRITER_ROLES.includes(role as OrganizationRole);
}

export function canAdmin(role: string | null | undefined): boolean {
  return ADMIN_ROLES.includes(role as OrganizationRole);
}
