import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'

export interface DeactivateConfirmDialogProps {
  open: boolean
  entityLabel: string
  onCancel: () => void
  onConfirm: () => void
  submitting: boolean
  error: string | null
}

// Unlike catalog/customers/suppliers' DeleteConfirmDialog (soft-delete
// framed as non-destructive, "no borra su historial"), Users and Roles
// have no reactivation endpoint anywhere in the backend -- once
// deactivated, they disappear from every list and there is no way back
// from the application. The copy here says so explicitly, per F11 design.
export function DeactivateConfirmDialog({
  open,
  entityLabel,
  onCancel,
  onConfirm,
  submitting,
  error,
}: DeactivateConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title="Confirmar desactivación">
      <p className="text-sm text-ink">
        ¿Seguro que deseas desactivar {entityLabel}?
      </p>
      <p className="mt-2 text-sm text-ink-muted">
        Quedará inactivo y desaparecerá de los listados. Esta acción no se
        puede deshacer desde la aplicación.
      </p>

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
          {submitting ? 'Desactivando…' : 'Desactivar'}
        </Button>
      </div>
    </Modal>
  )
}
