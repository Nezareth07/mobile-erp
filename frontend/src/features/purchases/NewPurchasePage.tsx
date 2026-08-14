import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { PurchaseForm } from './components/PurchaseForm'
import { useCreatePurchase } from './hooks/usePurchases'
import { extractErrorDetail } from './errors'
import type { PurchaseCreatePayload } from './types/purchase'

export function NewPurchasePage() {
  const navigate = useNavigate()
  const createMutation = useCreatePurchase()
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(payload: PurchaseCreatePayload) {
    setFormError(null)

    try {
      const purchase = await createMutation.mutateAsync(payload)
      navigate(`/compras/${purchase.id}`)
    } catch (error) {
      setFormError(
        extractErrorDetail(
          error,
          'No se pudo registrar la compra. Intenta nuevamente.',
        ),
      )
    }
  }

  return (
    <>
      <PageHeader title="Nueva compra" />

      <Card className="mt-4 p-5">
        <PurchaseForm
          submitting={createMutation.isPending}
          rootError={formError}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/compras')}
        />
      </Card>
    </>
  )
}
