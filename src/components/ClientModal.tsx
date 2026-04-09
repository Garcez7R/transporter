import type { FormEvent } from 'react';
import type { ClientFormState } from '../types';

type ClientModalProps = {
  activeClientId: number | null;
  clientForm: ClientFormState;
  setClientForm: React.Dispatch<React.SetStateAction<ClientFormState>>;
  clientModalOpen: boolean;
  handleModalUpdateClient: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleDeleteClient: (id: number) => Promise<void>;
  setClientModalOpen: (value: boolean) => void;
  handleLookupCep: (value: string, onSuccess: (data: { street?: string; neighborhood?: string; city?: string }) => void) => Promise<void>;
  formatCep: (value: string) => string;
  formatDocument: (value: string) => string;
};

export function ClientModal({
  activeClientId,
  clientForm,
  setClientForm,
  clientModalOpen,
  handleModalUpdateClient,
  handleDeleteClient,
  setClientModalOpen,
  handleLookupCep,
  formatCep,
  formatDocument
}: ClientModalProps) {
  if (!clientModalOpen || !activeClientId) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setClientModalOpen(false)}>
      <div className="glass-card modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Paciente</p>
            <h2>Dados cadastrais</h2>
          </div>
          <button className="cta ghost" type="button" onClick={() => setClientModalOpen(false)}>
            Fechar
          </button>
        </div>
        <form className="request-form" onSubmit={handleModalUpdateClient}>
          <input placeholder="Nome completo" value={clientForm.name} onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })} />
          <input placeholder="CPF" value={clientForm.document} onChange={(event) => setClientForm({ ...clientForm, document: formatDocument(event.target.value) })} />
          <input placeholder="Telefone" value={clientForm.phone} onChange={(event) => setClientForm({ ...clientForm, phone: event.target.value })} />
          <div className="input-action">
            <input
              placeholder="CEP"
              value={clientForm.cep}
              onChange={(event) => setClientForm({ ...clientForm, cep: formatCep(event.target.value) })}
              onBlur={(event) =>
                handleLookupCep(event.target.value, (data) =>
                  setClientForm((current) => ({
                    ...current,
                    street: data.street || current.street,
                    neighborhood: data.neighborhood || current.neighborhood,
                    city: data.city || current.city
                  }))
                )
              }
            />
            <button
              className="cta ghost"
              type="button"
              onClick={() =>
                handleLookupCep(clientForm.cep, (data) =>
                  setClientForm((current) => ({
                    ...current,
                    street: data.street || current.street,
                    neighborhood: data.neighborhood || current.neighborhood,
                    city: data.city || current.city
                  }))
                )
              }
            >
              Buscar CEP
            </button>
          </div>
          <input placeholder="Rua" value={clientForm.street} onChange={(event) => setClientForm({ ...clientForm, street: event.target.value })} />
          <input placeholder="Número" value={clientForm.number} onChange={(event) => setClientForm({ ...clientForm, number: event.target.value })} />
          <input placeholder="Bairro" value={clientForm.neighborhood} onChange={(event) => setClientForm({ ...clientForm, neighborhood: event.target.value })} />
          <input placeholder="Cidade" value={clientForm.city} onChange={(event) => setClientForm({ ...clientForm, city: event.target.value })} />
          <div className="form-actions">
            <button className="cta ghost danger" type="button" onClick={() => handleDeleteClient(activeClientId)}>
              Excluir
            </button>
            <button className="cta" type="submit">
              Salvar alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
