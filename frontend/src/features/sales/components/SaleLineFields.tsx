import type { UseFormReturn } from 'react-hook-form'
import { useWatch } from 'react-hook-form'
import { Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { formatCurrency } from '../format'
import { useAvailableStockQuery, useInStockUnitsQuery } from '../hooks/useSales'
import type { ProductRef } from '../types/sale'
import type { SaleFormValues } from './SaleForm'

export interface SaleLineFieldsProps {
  form: UseFormReturn<SaleFormValues>
  index: number
  products: ProductRef[]
  canRemove: boolean
  onRemove: () => void
}

export function SaleLineFields({
  form,
  index,
  products,
  canRemove,
  onRemove,
}: SaleLineFieldsProps) {
  const productId = useWatch({ control: form.control, name: `lines.${index}.product_id` })
  const quantity = useWatch({ control: form.control, name: `lines.${index}.quantity` })
  const unitPrice = useWatch({ control: form.control, name: `lines.${index}.unit_price` })

  const selectedProduct = products.find((product) => product.id === productId)
  const trackingType = selectedProduct?.tracking_type

  const errors = form.formState.errors.lines?.[index]

  // Auxiliary, read-only Inventory lookups -- UX only. If inventory.read
  // isn't granted (403) or the call otherwise fails, these simply stay
  // unavailable and the corresponding field falls back to a plain input;
  // POST /sales remains the only write this feature ever performs.
  const isSerial = trackingType === 'serial'
  const unitsQuery = useInStockUnitsQuery(productId, isSerial && Boolean(productId))
  const stockQuery = useAvailableStockQuery(
    productId,
    !isSerial && Boolean(productId),
  )
  const availableUnits = unitsQuery.data ?? []

  function handleProductChange(newProductId: string) {
    const product = products.find((item) => item.id === newProductId)

    if (product?.tracking_type === 'serial') {
      form.setValue(`lines.${index}.quantity`, '1')
    } else {
      form.setValue(`lines.${index}.imei`, '')
    }
  }

  const subtotal =
    unitPrice &&
    quantity &&
    !Number.isNaN(Number(unitPrice)) &&
    !Number.isNaN(Number(quantity))
      ? Number(unitPrice) * Number(quantity)
      : null

  return (
    <div className="rounded-md border border-line p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`sale-line-${index}-product`}
              className="block text-sm font-medium text-ink"
            >
              Producto
            </label>
            <Select
              id={`sale-line-${index}-product`}
              className="mt-1"
              error={Boolean(errors?.product_id)}
              {...form.register(`lines.${index}.product_id`, {
                onChange: (event) => handleProductChange(event.target.value),
              })}
            >
              <option value="">Selecciona…</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.sku})
                </option>
              ))}
            </Select>
            {errors?.product_id ? (
              <p role="alert" className="mt-1 text-sm text-danger">
                {errors.product_id.message}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor={`sale-line-${index}-quantity`}
              className="block text-sm font-medium text-ink"
            >
              Cantidad
            </label>
            <Input
              id={`sale-line-${index}-quantity`}
              type="text"
              inputMode="numeric"
              className="mt-1"
              disabled={isSerial}
              error={Boolean(errors?.quantity)}
              {...form.register(`lines.${index}.quantity`)}
            />
            {errors?.quantity ? (
              <p role="alert" className="mt-1 text-sm text-danger">
                {errors.quantity.message}
              </p>
            ) : !isSerial && stockQuery.isSuccess ? (
              <p className="mt-1 text-xs text-ink-muted">
                Disponible: {stockQuery.data.available_quantity}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor={`sale-line-${index}-unit-price`}
              className="block text-sm font-medium text-ink"
            >
              Precio unitario (opcional)
            </label>
            <Input
              id={`sale-line-${index}-unit-price`}
              type="text"
              inputMode="decimal"
              className="mt-1"
              placeholder={selectedProduct ? selectedProduct.sale_price : undefined}
              error={Boolean(errors?.unit_price)}
              {...form.register(`lines.${index}.unit_price`)}
            />
            {errors?.unit_price ? (
              <p role="alert" className="mt-1 text-sm text-danger">
                {errors.unit_price.message}
              </p>
            ) : (
              <p className="mt-1 text-xs text-ink-muted">
                Si se deja vacío, el backend usa el precio de venta del
                producto.
              </p>
            )}
          </div>

          {isSerial ? (
            <div>
              <label
                htmlFor={`sale-line-${index}-imei`}
                className="block text-sm font-medium text-ink"
              >
                IMEI
              </label>
              {unitsQuery.isSuccess && availableUnits.length > 0 ? (
                <Select
                  id={`sale-line-${index}-imei`}
                  className="mt-1"
                  error={Boolean(errors?.imei)}
                  {...form.register(`lines.${index}.imei`)}
                >
                  <option value="">Selecciona…</option>
                  {availableUnits.map((unit) => (
                    <option key={unit.id} value={unit.imei}>
                      {unit.imei}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id={`sale-line-${index}-imei`}
                  className="mt-1"
                  error={Boolean(errors?.imei)}
                  {...form.register(`lines.${index}.imei`)}
                />
              )}
              {errors?.imei ? (
                <p role="alert" className="mt-1 text-sm text-danger">
                  {errors.imei.message}
                </p>
              ) : unitsQuery.isSuccess && availableUnits.length === 0 ? (
                <p className="mt-1 text-xs text-ink-muted">
                  No hay unidades en stock para este producto según
                  Inventario.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Eliminar línea ${index + 1}`}
          disabled={!canRemove}
          onClick={onRemove}
        >
          <Trash2 size={16} aria-hidden="true" />
        </Button>
      </div>

      {subtotal !== null ? (
        <p className="mt-2 text-right text-xs text-ink-muted">
          Subtotal (referencial): {formatCurrency(subtotal)}
        </p>
      ) : null}
    </div>
  )
}
