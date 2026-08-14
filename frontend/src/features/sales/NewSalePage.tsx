import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { SaleForm } from './components/SaleForm'
import { useCreateSale } from './hooks/useSales'
import { extractErrorDetail } from './errors'
import type { SaleCreatePayload } from './types/sale'

export function NewSalePage() {
  const navigate = useNavigate()
  const createMutation = useCreateSale()
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(payload: SaleCreatePayload) {
    setFormError(null)

    try {
      const sale = await createMutation.mutateAsync(payload)
      navigate(`/ventas/${sale.id}`)
    } catch (error) {
      setFormError(
        extractErrorDetail(
          error,
          'No se pudo registrar la venta. Intenta nuevamente.',
        ),
      )
    }
  }

  return (
    <>
      <PageHeader title="Nueva venta" />

      <Card className="mt-4 p-5">
        <SaleForm
          submitting={createMutation.isPending}
          rootError={formError}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/ventas')}
        />
      </Card>
    </>
  )
}
