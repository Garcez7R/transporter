import { useEffect, useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { BannerState, ClientFormState, ClientRow, SessionUser, ToastState } from '../types';
import { createClient, deleteClient, listClients, updateClient } from '../lib/api';
import { formatCep, formatDocument, normalizeDocument } from '../lib/persistence';
import { buildAddressFromFields, parseAddress } from '../lib/utils';

export type UseClientsResult = {
  clients: ClientRow[];
  clientFilter: string;
  setClientFilter: (value: string) => void;
  operatorClientFilter: string;
  setOperatorClientFilter: (value: string) => void;
  activeClientId: number | null;
  setActiveClientId: (value: number | null) => void;
  clientForm: ClientFormState;
  setClientForm: Dispatch<SetStateAction<ClientFormState>>;
  clientModalOpen: boolean;
  setClientModalOpen: (value: boolean) => void;
  showInlinePatient: boolean;
  setShowInlinePatient: (value: boolean) => void;
  cpfLookupStatus: 'idle' | 'found' | 'missing';
  setCpfLookupStatus: (value: 'idle' | 'found' | 'missing') => void;
  refreshClients: (token?: string, query?: string) => Promise<ClientRow[]>;
  handleCreateClient: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleUpdateClient: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleModalUpdateClient: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleDeleteClient: (id: number) => Promise<void>;
  openClientModal: (client: ClientRow) => void;
};

export function useClients(session: SessionUser | null, showBanner: (type: BannerState['type'], message: string) => void, pushToast: (type: ToastState['type'], message: string) => void, confirmAction?: (message: string, onConfirm: () => void) => void): UseClientsResult {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientFilter, setClientFilter] = useState('');
  const [activeClientId, setActiveClientId] = useState<number | null>(null);
  const [clientForm, setClientForm] = useState<ClientFormState>({
    name: '',
    document: '',
    phone: '',
    cep: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    address: ''
  });
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [showInlinePatient, setShowInlinePatient] = useState(false);
  const [cpfLookupStatus, setCpfLookupStatus] = useState<'idle' | 'found' | 'missing'>('idle');

  useEffect(() => {
    if (!session?.token) {
      setClients([]);
      return;
    }

    let cancelled = false;
    listClients(session.token)
      .then((response) => {
        if (!cancelled) setClients(response.rows ?? []);
      })
      .catch(() => {
        if (!cancelled) showBanner('error', 'Não foi possível carregar os pacientes.');
      });

    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  async function refreshClients(token = session?.token, query = '') {
    if (!token) {
      setClients([]);
      return [];
    }

    const response = await listClients(token, query);
    setClients(response.rows ?? []);
    return response.rows ?? [];
  }

  async function handleCreateClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.token) return;

    try {
      if (!clientForm.cep.trim() || !clientForm.street.trim() || !clientForm.number.trim() || !clientForm.neighborhood.trim() || !clientForm.city.trim()) {
        showBanner('error', 'CEP, rua, número, bairro e cidade são obrigatórios.');
        return;
      }
      await createClient(
        {
          name: clientForm.name.trim(),
          document: normalizeDocument(clientForm.document),
          phone: clientForm.phone.trim(),
          cep: clientForm.cep.trim(),
          address: buildAddressFromFields(clientForm)
        },
        session.token
      );
      setClientForm({ name: '', document: '', phone: '', cep: '', street: '', number: '', neighborhood: '', city: '', address: '' });
      pushToast('success', 'Paciente cadastrado.');
      await refreshClients(session.token, clientFilter);
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Não foi possível cadastrar o paciente.');
    }
  }

  async function handleUpdateClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.token || !activeClientId) return;

    try {
      await updateClient(
        activeClientId,
        {
          name: clientForm.name.trim(),
          document: normalizeDocument(clientForm.document),
          phone: clientForm.phone.trim(),
          cep: clientForm.cep.trim(),
          address: buildAddressFromFields(clientForm)
        },
        session.token
      );
      pushToast('success', 'Paciente atualizado.');
      await refreshClients(session.token, clientFilter);
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Não foi possível atualizar o paciente.');
    }
  }

  async function handleModalUpdateClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.token || !activeClientId) return;
    
    const performUpdate = async () => {
      try {
        await updateClient(
          activeClientId,
          {
          name: clientForm.name.trim(),
          document: normalizeDocument(clientForm.document),
          phone: clientForm.phone.trim(),
          cep: clientForm.cep.trim(),
          address: buildAddressFromFields(clientForm)
        },
        session.token
      );
      pushToast('success', 'Paciente atualizado.');
      await refreshClients(session.token, clientFilter);
      setClientModalOpen(false);
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Não foi possível atualizar o paciente.');
    }
    };

    if (confirmAction) {
      confirmAction('Confirmar atualização do cadastro deste paciente?', performUpdate);
    } else if (window.confirm('Confirmar atualização do cadastro deste paciente?')) {
      await performUpdate();
    }
  }

  async function handleDeleteClient(id: number) {
    if (!session?.token) return;

    const performDelete = async () => {
      try {
        await deleteClient(id, session.token);
        pushToast('success', 'Paciente excluído.');
        await refreshClients(session.token, clientFilter);
        if (activeClientId === id) {
          setActiveClientId(null);
          setClientForm({ name: '', document: '', phone: '', cep: '', street: '', number: '', neighborhood: '', city: '', address: '' });
        }
        setClientModalOpen(false);
      } catch (error) {
        showBanner('error', error instanceof Error ? error.message : 'Não foi possível excluir o paciente.');
      }
    };

    if (confirmAction) {
      confirmAction('Deseja excluir este paciente? Essa ação não poderá ser desfeita.', performDelete);
    } else if (window.confirm('Deseja excluir este paciente? Essa ação não poderá ser desfeita.')) {
      await performDelete();
    }
  }

  function openClientModal(client: ClientRow) {
    const parsedAddress = parseAddress(client.address ?? '');
    setActiveClientId(client.id);
    setClientForm({
      name: client.name ?? '',
      document: formatDocument(client.document ?? ''),
      phone: client.phone ?? '',
      cep: formatCep(client.cep ?? ''),
      street: parsedAddress.street,
      number: parsedAddress.number,
      neighborhood: parsedAddress.neighborhood,
      city: parsedAddress.city,
      address: client.address ?? ''
    });
    setClientModalOpen(true);
  }

  return {
    clients,
    clientFilter,
    setClientFilter,
    operatorClientFilter: clientFilter,
    setOperatorClientFilter: setClientFilter,
    activeClientId,
    setActiveClientId,
    clientForm,
    setClientForm,
    clientModalOpen,
    setClientModalOpen,
    showInlinePatient,
    setShowInlinePatient,
    cpfLookupStatus,
    setCpfLookupStatus,
    refreshClients,
    handleCreateClient,
    handleUpdateClient,
    handleModalUpdateClient,
    handleDeleteClient,
    openClientModal
  };
}
