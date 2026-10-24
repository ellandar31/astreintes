/** Any departure date disables new assignments; historical references remain readable. */
export function isUserAssignable(user: { deletedAt?: string | null }): boolean {
  return !user.deletedAt;
}
