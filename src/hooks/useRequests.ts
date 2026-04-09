import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { AccessRole, RequestFormState, RequestPatch, RequestStatus, SessionUser, ToastState, BannerState, TripRequest } from '../types';
import { createRequest, deleteRequest, listRequests, updateRequest } from '../lib/api';
import { formatCep, normalizeCep, normalizeDocument } from '../lib/persistence';
import { buildAddressFromFields, buildCompanionPayload, buildDateTime, filteredRequests, formatAddressDisplay, formatSchedule, getInitials, isToday, parseAddress, parseCompanion, splitDateTime, buildMapQuery } from '../lib/utils';
import { defaultRequestForm } from '../data';

export type UseRequestsResult = {
  requests: TripRequest[];
  visibleRequests: TripRequest[];
  activeRequest: TripRequest | null;
  activeRequestId: string;
  setActiveRequestId: (id: string) => void;
  requestFilter: string;
  setRequestFilter: (value: string) => void;
  requestForm: RequestFormState;
  setRequestForm: Dispatch<SetStateAction<RequestFormState>>;
  requestCompanion: 'nao' | 'sim';
  setRequestCompanion: (value: 'nao' | 'sim') => void;
  requestCompanionName: string;
  setRequestCompanionName: (value: string) => void;
  requestCompanionCpf: string;
  setRequestCompanionCpf: (value: string) => void;
  requestDate: string;
  setRequestDate: (value: string) => void;
  requestTime: string;
  setRequestTime: (value: string) => void;
  consultDate: string;
  setConsultDate: (value: string) => void;
  consultTime: string;
  setConsultTime: (value: string) => void;
  messageDraft: string;
  setMessageDraft: (value: string) => void;
  tripForm: {
    destination: string;
    destinationFacility: string;
    boardingPoint: string;
    departureAt: string;
    arrivalEta: string;
    notes: string;
    companions: string;
    status: RequestStatus;
    driver: string;
    vehicle: string;
    phoneVisible: boolean;
  };
  setTripForm: Dispatch<SetStateAction<UseRequestsResult['tripForm']>>;
  tripCompanion: 'nao' | 'sim';
  setTripCompanion: (value: 'nao' | 'sim') => void;
  tripCompanionName: string;
  setTripCompanionName: (value: string) => void;
  tripCompanionCpf: string;
  setTripCompanionCpf: (value: string) => void;
  tripDate: string;
  setTripDate: (value: string) => void;
  tripTime: string;
  setTripTime: (value: string) => void;
  tripConsultDate: string;
  setTripConsultDate: (value: string) => void;
  tripConsultTime: string;
  setTripConsultTime: (value: string) => void;
  managerCep: string;
  setManagerCep: (value: string) => void;
  managerStreet: string;
  setManagerStreet: (value: string) => void;
  managerNumber: string;
  setManagerNumber: (value: string) => void;
  managerNeighborhood: string;
  setManagerNeighborhood: (value: string) => void;
  managerCity: string;
  setManagerCity: (value: string) => void;
  refreshRequests: (token?: string) => Promise<void>;
  handleCreateRequest: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleDeleteRequest: (id: string) => Promise<void>;
  handleSendMessage: () => Promise<void>;
  handleConfirmRead: () => Promise<void>;
  handleResetClientPin: () => Promise<void>;
  handleSaveTrip: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  applyManagerAddress: () => Promise<void>;
  patchRequest: (id: string, patch: RequestPatch) => Promise<void>;
  getInitials: (name: string) => string;
  formatAddressDisplay: (address: string, cep?: string | null) => string;
  formatSchedule: (value: string) => string;
  buildMapQuery: (request: TripRequest) => string;
  pendingToday: number;
  unreadMessages: number;
  pendingDispatch: number;
  inRoute: number;
  pendingConfirmations: number;
  pendingPinChange: number;
};

export function useRequests(session: SessionUser | null, showBanner: (type: BannerState['type'], message: string) => void, pushToast: (type: ToastState['type'], message: string) => void): UseRequestsResult {
  const [requests, setRequests] = useState<TripRequest[]>([]);
  const [activeRequestId, setActiveRequestId] = useState('');
  const [requestFilter, setRequestFilter] = useState('');
  const [requestForm, setRequestForm] = useState<RequestFormState>(defaultRequestForm);
  const [requestCompanion, setRequestCompanion] = useState<'nao' | 'sim'>('nao');
  const [requestCompanionName, setRequestCompanionName] = useState('');
  const [requestCompanionCpf, setRequestCompanionCpf] = useState('');
  const [requestDate, setRequestDate] = useState('');
  const [requestTime, setRequestTime] = useState('');
  const [consultDate, setConsultDate] = useState('');
  const [consultTime, setConsultTime] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const [tripForm, setTripForm] = useState<UseRequestsResult['tripForm']>({
    destination: '',
    destinationFacility: '',
    boardingPoint: '',
    departureAt: '',
    arrivalEta: '',
    notes: '',
    companions: '',
    status: 'em_atendimento',
    driver: '',
    vehicle: '',
    phoneVisible: false
  });
  const [tripCompanion, setTripCompanion] = useState<'nao' | 'sim'>('nao');
  const [tripCompanionName, setTripCompanionName] = useState('');
  const [tripCompanionCpf, setTripCompanionCpf] = useState('');
  const [tripDate, setTripDate] = useState('');
  const [tripTime, setTripTime] = useState('');
  const [tripConsultDate, setTripConsultDate] = useState('');
  const [tripConsultTime, setTripConsultTime] = useState('');
  const [managerCep, setManagerCep] = useState('');
  const [managerStreet, setManagerStreet] = useState('');
  const [managerNumber, setManagerNumber] = useState('');
  const [managerNeighborhood, setManagerNeighborhood] = useState('');
  const [managerCity, setManagerCity] = useState('');

  const visibleRequests = useMemo(() => filteredRequests(requests, session, requestFilter), [requests, session, requestFilter]);
  const activeRequest = visibleRequests.find((request) => request.id === activeRequestId) ?? visibleRequests[0] ?? null;

  useEffect(() => {
    if (!session?.token) {
      setRequests([]);
      return;
    }

    let cancelled = false;

    refreshRequests(session.token).catch(() => {
      if (!cancelled) {
        showBanner('error', 'Não foi possível carregar as solicitações.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  useEffect(() => {
    if (!requests.length) {
      setActiveRequestId('');
      return;
    }

    const visible = filteredRequests(requests, session, requestFilter);
    if (!visible.some((request) => request.id === activeRequestId)) {
      setActiveRequestId(visible[0]?.id ?? '');
    }
  }, [requests, session, requestFilter, activeRequestId]);

  useEffect(() => {
    if (!activeRequest) return;
    setTripForm({
      destination: activeRequest.destination,
      destinationFacility: activeRequest.destinationFacility,
      boardingPoint: activeRequest.boardingPoint,
      departureAt: activeRequest.departureAt,
      arrivalEta: activeRequest.arrivalEta,
      notes: activeRequest.notes,
      companions: activeRequest.companions,
      status: activeRequest.status,
      driver: activeRequest.driver,
      vehicle: activeRequest.vehicle,
      phoneVisible: Boolean(activeRequest.phoneVisible)
    });
    const parsed = parseCompanion(activeRequest.companions ?? '');
    setTripCompanion(parsed.mode);
    setTripCompanionName(parsed.name);
    setTripCompanionCpf(parsed.cpf);
    const departure = splitDateTime(activeRequest.departureAt);
    const consult = splitDateTime(activeRequest.arrivalEta);
    setTripDate(departure.date);
    setTripTime(departure.time);
    setTripConsultDate(consult.date);
    setTripConsultTime(consult.time);
    const parsedBoarding = parseAddress(activeRequest.boardingPoint ?? '');
    setManagerCep(formatCep(activeRequest.boardingCep ?? activeRequest.clientCep ?? ''));
    setManagerStreet(parsedBoarding.street);
    setManagerNumber(parsedBoarding.number);
    setManagerNeighborhood(parsedBoarding.neighborhood);
    setManagerCity(parsedBoarding.city);
  }, [activeRequest?.id]);

  async function refreshRequests(token = session?.token) {
    if (!token) {
      setRequests([]);
      return;
    }

    const response = await listRequests(token);
    setRequests(response.rows ?? []);
  }

  async function handleCreateRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.token || session.role !== 'operador') return;

    try {
      if (!requestForm.street.trim() || !requestForm.number.trim() || !requestForm.neighborhood.trim() || !requestForm.city.trim()) {
        showBanner('error', 'Informe rua, número, bairro e cidade do embarque.');
        return;
      }
      if (normalizeCep(requestForm.cep).length < 8) {
        showBanner('error', 'Informe o CEP do embarque.');
        return;
      }
      if (!requestForm.destinationFacility.trim()) {
        showBanner('error', 'Informe o hospital, clínica ou posto de destino.');
        return;
      }
      if (!requestDate || !requestTime || !consultDate || !consultTime) {
        showBanner('error', 'Informe data e hora da viagem e da consulta.');
        return;
      }

      const companionPayload = buildCompanionPayload(requestCompanion, requestCompanionName, requestCompanionCpf);
      const departureAt = buildDateTime(requestDate, requestTime);
      const arrivalEta = buildDateTime(consultDate, consultTime);
      const response = await createRequest(
        {
          ...requestForm,
          boardingPoint: buildAddressFromFields({
            street: requestForm.street,
            number: requestForm.number,
            neighborhood: requestForm.neighborhood,
            city: requestForm.city
          }),
          boardingCep: requestForm.cep,
          departureAt,
          arrivalEta,
          companions: companionPayload
        },
        session.token
      );
      const createdId = response.row && 'id' in response.row ? String(response.row.id) : '';
      setRequestForm(defaultRequestForm);
      setRequestCompanion('nao');
      setRequestCompanionName('');
      setRequestCompanionCpf('');
      setRequestDate('');
      setRequestTime('');
      setConsultDate('');
      setConsultTime('');
      pushToast('success', 'Solicitação criada com sucesso.');
      await refreshRequests(session.token);
      if (createdId) setActiveRequestId(createdId);
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Não foi possível criar a solicitação.');
    }
  }

  async function patchRequest(id: string, patch: RequestPatch) {
    if (!session?.token || !id) return;

    try {
      await updateRequest(id, patch, session.token);
      await refreshRequests(session.token);
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Não foi possível atualizar a solicitação.');
    }
  }

  async function handleDeleteRequest(id: string) {
    if (!session?.token) return;
    try {
      await deleteRequest(id, session.token);
      pushToast('success', 'Solicitação excluída.');
      await refreshRequests(session.token);
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Não foi possível excluir a solicitação.');
    }
  }

  async function handleSendMessage() {
    if (!activeRequest || !messageDraft.trim()) return;
    await patchRequest(activeRequest.id, { message: messageDraft.trim() });
    setMessageDraft('');
    pushToast('success', 'Mensagem enviada.');
  }

  async function handleConfirmRead() {
    if (!activeRequest) return;
    await patchRequest(activeRequest.id, {
      clientConfirmedAt: new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
      }),
      status: 'agendada'
    });
    pushToast('success', 'Confirmação registrada.');
  }

  async function handleResetClientPin() {
    if (!activeRequest) return;
    await patchRequest(activeRequest.id, { pinStatus: 'reset' });
    pushToast('success', 'PIN resetado para 0000.');
  }

  async function handleSaveTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeRequest || !session?.token) return;

    const departureAt = buildDateTime(tripDate, tripTime);
    const arrivalEta = buildDateTime(tripConsultDate, tripConsultTime);
    const companions = buildCompanionPayload(tripCompanion, tripCompanionName, tripCompanionCpf);

    await patchRequest(activeRequest.id, {
      destination: tripForm.destination,
      destinationFacility: tripForm.destinationFacility,
      boardingPoint: tripForm.boardingPoint,
      departureAt,
      arrivalEta,
      notes: tripForm.notes,
      status: tripForm.status,
      driver: tripForm.driver,
      vehicle: tripForm.vehicle,
      phoneVisible: tripForm.phoneVisible,
      companions
    });
  }

  async function applyManagerAddress() {
    if (!activeRequest) return;
    if (!managerStreet.trim() || !managerNumber.trim() || !managerNeighborhood.trim() || !managerCity.trim()) {
      showBanner('error', 'Informe rua, número, bairro e cidade do embarque.');
      return;
    }
    await patchRequest(activeRequest.id, {
      boardingPoint: buildAddressFromFields({
        street: managerStreet,
        number: managerNumber,
        neighborhood: managerNeighborhood,
        city: managerCity
      }),
      boardingCep: managerCep
    });
  }

  const pendingToday = visibleRequests.filter(
    (request) => isToday(request.departureAt) && !['concluida', 'cancelada'].includes(request.status)
  ).length;
  const unreadMessages = visibleRequests.reduce(
    (total, request) => total + request.messages.filter((message) => !message.internal && !message.readAt).length,
    0
  );
  const pendingDispatch = visibleRequests.filter(
    (request) => !request.driver && ['em_atendimento', 'aguardando_distribuicao'].includes(request.status)
  ).length;
  const inRoute = visibleRequests.filter((request) => request.status === 'em_rota').length;
  const pendingConfirmations = visibleRequests.filter(
    (request) => !request.clientConfirmedAt && ['agendada', 'em_rota'].includes(request.status)
  ).length;
  const pendingPinChange = visibleRequests.filter((request) => request.pinStatus !== 'active').length;

  return {
    requests,
    visibleRequests,
    activeRequest,
    activeRequestId,
    setActiveRequestId,
    requestFilter,
    setRequestFilter,
    requestForm,
    setRequestForm,
    requestCompanion,
    setRequestCompanion,
    requestCompanionName,
    setRequestCompanionName,
    requestCompanionCpf,
    setRequestCompanionCpf,
    requestDate,
    setRequestDate,
    requestTime,
    setRequestTime,
    consultDate,
    setConsultDate,
    consultTime,
    setConsultTime,
    messageDraft,
    setMessageDraft,
    tripForm,
    setTripForm,
    tripCompanion,
    setTripCompanion,
    tripCompanionName,
    setTripCompanionName,
    tripCompanionCpf,
    setTripCompanionCpf,
    tripDate,
    setTripDate,
    tripTime,
    setTripTime,
    tripConsultDate,
    setTripConsultDate,
    tripConsultTime,
    setTripConsultTime,
    managerCep,
    setManagerCep,
    managerStreet,
    setManagerStreet,
    managerNumber,
    setManagerNumber,
    managerNeighborhood,
    setManagerNeighborhood,
    managerCity,
    setManagerCity,
    refreshRequests,
    handleCreateRequest,
    handleDeleteRequest,
    handleSendMessage,
    handleConfirmRead,
    handleResetClientPin,
    handleSaveTrip,
    applyManagerAddress,
    patchRequest,
    getInitials,
    formatAddressDisplay,
    formatSchedule,
    buildMapQuery,
    pendingToday,
    unreadMessages,
    pendingDispatch,
    inRoute,
    pendingConfirmations,
    pendingPinChange
  };
}
