// Shared shape for Brand and Category -- the two catalog entities that
// are structurally identical on the backend (name + is_active +
// timestamps, same CRUD semantics), which is what SimpleCatalogEntityPage
// is parametrized over. Product does not fit this shape and is not
// forced into it.

export interface SimpleEntity {
  id: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SimpleEntityApi<T extends SimpleEntity> {
  list: () => Promise<T[]>
  create: (payload: { name: string }) => Promise<T>
  update: (id: string, payload: { name?: string }) => Promise<T>
  remove: (id: string) => Promise<void>
}
