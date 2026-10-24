/** Only the Director base role grants director rights. RH exports are a separate flag. */
export function hasDirectorRights(role: number | undefined): boolean {
  return role === 3;
}
