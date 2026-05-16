/**
 * Checks whether a given resource + action is present in a permissions object.
 * Permission objects use the D-01 format: { [resource]: string[] }
 * e.g. { vouchers: ['read', 'write'], settings: ['read'] }
 */
export function hasPermission(
  permissions: unknown,
  resource: string,
  action: string
): boolean {
  if (permissions === null || permissions === undefined) return false
  if (typeof permissions !== 'object' || Array.isArray(permissions)) return false

  const permsMap = permissions as Record<string, unknown>
  const actions = permsMap[resource]

  if (!Array.isArray(actions)) return false

  return (actions as string[]).includes(action)
}
