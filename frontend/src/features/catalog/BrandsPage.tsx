import { SimpleCatalogEntityPage } from './components/SimpleCatalogEntityPage'
import { brandApi } from './api'
import type { Brand } from './types/catalog'

export function BrandsPage() {
  return (
    <SimpleCatalogEntityPage<Brand>
      title="Marcas"
      singularLabel="marca"
      createLabel="Nueva marca"
      searchPlaceholder="Buscar por nombre…"
      emptyTitle="No hay marcas todavía"
      queryKeyName="brands"
      entityApi={brandApi}
    />
  )
}
