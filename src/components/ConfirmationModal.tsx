import { useConfirmationModal } from '../hooks/useConfirmationModal';

export function ConfirmationModal() {
  const { isVisible, message, onConfirm, onCancel } = useConfirmationModal();

  if (!isVisible) return null;

  return (
    <div className="confirmation-modal-overlay">
      <div className="confirmation-modal">
        <div className="confirmation-modal-header">
          <h3>Confirmar Ação</h3>
        </div>
        <div className="confirmation-modal-body">
          <p>{message}</p>
        </div>
        <div className="confirmation-modal-actions">
          <button className="cta ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button className="cta danger" onClick={onConfirm}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}