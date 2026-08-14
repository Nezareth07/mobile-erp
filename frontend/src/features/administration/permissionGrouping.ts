export interface PermissionGroup<T> {
  module: string
  items: T[]
}

// Permission codes follow a "<module>.<action>" convention across the
// entire backend (e.g. "brands.create", "inventory.adjust") -- confirmed
// across all 29 seeded codes during the F11 audit. Grouping by the prefix
// before the first "." is a presentation-only convenience, not a backend
// concept.
export function groupPermissionsByModule<T extends { code: string }>(
  permissions: T[],
): PermissionGroup<T>[] {
  const groups = new Map<string, T[]>()

  for (const permission of permissions) {
    const module = permission.code.split('.')[0] || permission.code
    const existing = groups.get(module)

    if (existing) {
      existing.push(permission)
    } else {
      groups.set(module, [permission])
    }
  }

  return Array.from(groups.entries())
    .map(([module, items]) => ({ module, items }))
    .sort((a, b) => a.module.localeCompare(b.module))
}
