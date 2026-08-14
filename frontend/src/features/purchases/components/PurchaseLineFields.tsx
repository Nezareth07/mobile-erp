import type { UseFormReturn } from 'react-hook-form'
import { useWatch } from 'react-hook-form'
import { Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { formatCurrency } from '../format'
import type { ProductRef } from '../types/purchase'
import type { PurchaseFormValues } from './PurchaseForm'

export interface PurchaseLineFieldsProps {
  form: UseFormReturn<PurchaseFormValues>
  index: number
  products: ProductRef[]
  canRemove: boolean
  onRemove: () => void
}

export function PurchaseLineFields({
  form,
  index,
  products,
  canRemove,
  onRemove,
}: PurchaseLineFieldsProps) {
  const productId = useWatch({ control: form.control, name: `lines.${index}.product_id` })
  const quantity = useWatch({ control: form.control, name: `lines.${index}.quantity` })
  const unitCost = useWatch({ control: form.control, name: `lines.${index}.unit_cost` })

  const selectedProduct = products.find((product) => product.id === productId)
  const trackingType = selectedProduct?.tracking_type

  const errors = form.formState.errors.lines?.[index]

  function handleProductChange(newProductId: string) {
    const product = products.find((item) => item.id === newProductId)

    if (product?.tracking_type === 'serial') {
      form.setValue(`lines.${index}.quantity`, '1')
      form.setValue(`lines.${index}.lot_code`, '')
    } else {
      form.setValue(`lines.${index}.imei`, '')
      form.setValue(`lines.${index}.imei2`, '')
    }
  }

  const subtotal =
    unitCost &&
    quantity &&
    !Number.isNaN(Number(unitCost)) &&
    !Number.isNaN(Number(quantity))
      ? Number(unitCost) * Number(quantity)
      : null

  return (
    <div className="rounded-md border border-line p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`line-${index}-product`}
              className="block text-sm font-medium text-ink"
            >
              Producto
            </label>
            <Select
              id={`line-${index}-product`}
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
              htmlFor={`line-${index}-quantity`}
              className="block text-sm font-medium text-ink"
            >
              Cantidad
            </label>
            <Input
              id={`line-${index}-quantity`}
              type="text"
              inputMode="numeric"
              className="mt-1"
              disabled={trackingType === 'serial'}
              error={Boolean(errors?.quantity)}
              {...form.register(`lines.${index}.quantity`)}
            />
            {errors?.quantity ? (
              <p role="alert" className="mt-1 text-sm text-danger">
                {errors.quantity.message}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor={`line-${index}-unit-cost`}
              className="block text-sm font-medium text-ink"
            >
              Costo unitario
            </label>
            <Input
              id={`line-${index}-unit-cost`}
              type="text"
              inputMode="decimal"
              className="mt-1"
              error={Boolean(errors?.unit_cost)}
              {...form.register(`lines.${index}.unit_cost`)}
            />
            {errors?.unit_cost ? (
              <p role="alert" className="mt-1 text-sm text-danger">
                {errors.unit_cost.message}
              </p>
            ) : null}
          </div>

          {trackingType === 'serial' ? (
            <>
              <div>
                <label
                  htmlFor={`line-${index}-imei`}
                  className="block text-sm font-medium text-ink"
                >
                  IMEI
                </label>
                <Input
                  id={`line-${index}-imei`}
                  className="mt-1"
                  error={Boolean(errors?.imei)}
                  {...form.register(`lines.${index}.imei`)}
                />
                {errors?.imei ? (
                  <p role="alert" className="mt-1 text-sm text-danger">
                    {errors.imei.message}
                  </p>
                ) : null}
              </div>
              <div>
                <label
                  htmlFor={`line-${index}-imei2`}
                  className="block text-sm font-medium text-ink"
                >
                  IMEI 2 (opcional)
                </label>
                <Input
                  id={`line-${index}-imei2`}
                  className="mt-1"
                  error={Boolean(errors?.imei2)}
                  {...form.register(`lines.${index}.imei2`)}
                />
                {errors?.imei2 ? (
                  <p role="alert" className="mt-1 text-sm text-danger">
                    {errors.imei2.message}
                  </p>
                ) : null}
              </div>
            </>
          ) : productId ? (
            <div>
              <label
                htmlFor={`line-${index}-lot-code`}
                className="block text-sm font-medium text-ink"
              >
                Código de lote (opcional)
              </label>
              <Input
                id={`line-${index}-lot-code`}
                className="mt-1"
                error={Boolean(errors?.lot_code)}
                {...form.register(`lines.${index}.lot_code`)}
              />
              {errors?.lot_code ? (
                <p role="alert" className="mt-1 text-sm text-danger">
                  {errors.lot_code.message}
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
