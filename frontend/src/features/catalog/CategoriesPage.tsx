import { SimpleCatalogEntityPage } from './components/SimpleCatalogEntityPage'
import { categoryApi } from './api'
import type { Category } from './types/catalog'

export function CategoriesPage() {
  return (
    <SimpleCatalogEntityPage<Category>
      title="Categorías"
      singularLabel="categoría"
      createLabel="Nueva categoría"
      searchPlaceholder="Buscar por nombre…"
      emptyTitle="No hay categorías todavía"
      queryKeyName="categories"
      entityApi={categoryApi}
    />
  )
}
