/** Les profils Directeur (3) et RH (4) partagent les mêmes habilitations métier. */
export function hasDirectorRights(role: number | undefined): boolean {
  return role === 3 || role === 4;
}
