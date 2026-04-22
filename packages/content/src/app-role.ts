/**
 * App-level roles stored on `users.role` (TASK-028) + auth helpers.
 * Keep in sync with migration `0008_content_authoring_workflow.sql` `users_role_check`.
 */
export const APP_ROLES = [
  "caregiver",
  "content_writer",
  "content_lead",
  "medical_director",
  "care_specialist",
  "caregiver_support_clinician",
  "lived_experience_reviewer",
  "admin",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export function isAppRole(s: string): s is AppRole {
  return (APP_ROLES as readonly string[]).includes(s);
}

export function isPrivilegedContentRole(role: AppRole): boolean {
  return role === "admin" || role === "content_lead";
}

/**
 * `admin` passes any role gate; others must be listed.
 */
export function hasAnyRole(userRole: AppRole, allowed: readonly AppRole[]): boolean {
  if (userRole === "admin") {
    return true;
  }
  return allowed.includes(userRole);
}
