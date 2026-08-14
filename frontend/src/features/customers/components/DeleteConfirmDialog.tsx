import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'

export interface DeleteConfirmDialogProps {
  open: boolean
  description: string
  onCancel: () => void
  onConfirm: () => void
  submitting: boolean
  error: string | null
}

export function DeleteConfirmDialog({
  open,
  description,
  onCancel,
  onConfirm,
  submitting,
  error,
}: DeleteConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title="Confirmar eliminación">
      <p className="text-sm text-ink">{description}</p>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button
          variant="destructive"
          onClick={onConfirm}
          disabled={submitting}
        >
          {submitting ? 'Eliminando…' : 'Eliminar'}
        </Button>
      </div>
    </Modal>
  )
}
