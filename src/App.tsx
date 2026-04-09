import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { demoUsers, profiles, defaultRequestForm } from './data';
import {
  changePin,
  createClient,
  createRequest,
  createUser,
  deleteClient,
  deleteRequest,
  listClients,
  listRequests,
  listUsers,
  login as loginApi,
  logout as logoutApi,
  me,
  resetUserPin,
  updateClient,
  updateRequest
} from './lib/api';
import { formatCep, formatDocument, formatTime, normalizeCep, normalizeDocument, readJson, removeItem, SESSION_KEY, currentStamp, writeJson } from './lib/persistence';
import type { AccessRole, ClientFormState, RequestFormState, RequestStatus, SessionUser, TripRequest, UserFormState } from './types';
import type { ClientRow, UserRow } from './lib/api';

type BannerState = {
  type: 'success' | 'error';
  message: string;
};

type ToastState = {
  id: string;
  type: 'success' | 'error';
  message: string;
};

type RequestPatch = Partial<
  Pick<
    TripRequest,
    | 'status'
    | 'destination'
    | 'driver'
    | 'vehicle'
    | 'notes'
    | 'companions'
    | 'arrivalEta'
    | 'boardingPoint'
    | 'boardingCep'
    | 'departureAt'
    | 'phoneVisible'
    | 'clientConfirmedAt'
    | 'pinStatus'
  >
> & {
  message?: string;
};

const roleLabels: Record<AccessRole, string> = {
  cliente: 'Paciente',
  operador: 'Operador',
  gerente: 'Gerente',
  motorista: 'Motorista',
  administrador: 'Administrador'
};

const roleDescriptions: Record<AccessRole, string> = {
  cliente: 'Portal do paciente com CPF + PIN.',
  operador: 'Cadastro, triagem e histórico das solicitações de transporte de pacientes.',
  gerente: 'Distribuição da frota e controle operacional da agenda pública.',
  motorista: 'Agenda mobile otimizada para o serviço de transporte.',
  administrador: 'Governança global e acesso irrestrito.'
};

const statusLabels: Record<RequestStatus, string> = {
  rascunho: 'Rascunho',
  em_atendimento: 'Em atendimento',
  aguardando_distribuicao: 'Aguardando distribuição',
  agendada: 'Agendada',
  em_rota: 'Em rota',
  concluida: 'Concluída',
  cancelada: 'Cancelada'
};

function App() {
  const [session, setSession] = useState<SessionUser | null>(() => readJson<SessionUser | null>(SESSION_KEY, null));
  const [requests, setRequests] = useState<TripRequest[]>([]);
  const [loginDocument, setLoginDocument] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinDraft, setPinDraft] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
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
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userRoleFilter, setUserRoleFilter] = useState<AccessRole | 'todos'>('todos');
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
  const [operatorView, setOperatorView] = useState<'novo' | 'recentes' | 'pacientes'>('novo');
  const [operatorClientFilter, setOperatorClientFilter] = useState('');
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [showInlinePatient, setShowInlinePatient] = useState(false);
  const [cpfLookupStatus, setCpfLookupStatus] = useState<'idle' | 'found' | 'missing'>('idle');
  const [tripForm, setTripForm] = useState({
    destination: '',
    boardingPoint: '',
    departureAt: '',
    arrivalEta: '',
    notes: '',
    companions: '',
    status: 'em_atendimento' as RequestStatus,
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
  const [userForm, setUserForm] = useState<UserFormState>({
    name: '',
    document: '',
    role: 'operador'
  });
  const [patientFontLarge, setPatientFontLarge] = useState(() => readJson<boolean>('transporter:patient-font', false));
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() =>
    readJson<'dark' | 'light'>('transporter:theme', 'dark')
  );
  const [activeNav, setActiveNav] = useState('visao');

  const patientView = !session || session.role === 'cliente';

  function buildCompanionPayload(mode: 'nao' | 'sim', name: string, cpf: string) {
    if (mode === 'nao') return 'Não';
    const trimmedName = name.trim();
    const trimmedCpf = formatDocument(cpf.trim());
    if (!trimmedName || !trimmedCpf) return 'Não';
    return `Sim: ${trimmedName} (${trimmedCpf})`;
  }

  function parseCompanion(value: string) {
    if (!value) return { mode: 'nao' as const, name: '', cpf: '' };
    if (!value.toLowerCase().startsWith('sim:')) return { mode: 'nao' as const, name: '', cpf: '' };
    const match = value.match(/sim:\s*(.+)\s+\((.+)\)/i);
    if (!match?.[1] || !match?.[2]) return { mode: 'sim' as const, name: '', cpf: '' };
    return { mode: 'sim' as const, name: match[1].trim(), cpf: match[2].trim() };
  }

  function buildAddressFromFields(fields: { street: string; number: string; neighborhood: string; city: string }) {
    const street = fields.street.trim();
    const number = fields.number.trim();
    const neighborhood = fields.neighborhood.trim();
    const city = fields.city.trim();
    if (!street || !number || !neighborhood || !city) return '';
    return `${street}, ${number} - ${neighborhood}, ${city}`;
  }

  function parseAddress(value: string) {
    const [streetPart = '', rest = ''] = value.split(',');
    const [numberPart = '', tail = ''] = rest.split('-');
    const [neighborhood = '', city = ''] = tail.split(',');
    return {
      street: streetPart.trim(),
      number: numberPart.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim()
    };
  }

  async function handleLookupCep(value: string, onSuccess: (data: { street?: string; neighborhood?: string; city?: string }) => void) {
    const cep = normalizeCep(value);
    if (cep.length !== 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!response.ok) return;
      const data = (await response.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string };
      if (data?.erro) return;
      onSuccess({
        street: data.logradouro ?? '',
        neighborhood: data.bairro ?? '',
        city: data.localidade ?? ''
      });
    } catch {
      return;
    }
  }

  function splitDateTime(value: string) {
    if (!value) return { date: '', time: '' };
    if (value.includes('T')) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return {
          date: parsed.toISOString().slice(0, 10),
          time: parsed.toTimeString().slice(0, 5)
        };
      }
    }
    const [datePart = '', timePart = ''] = value.split(' ');
    if (datePart.includes('/')) {
      const [day, month, year] = datePart.split('/');
      if (day && month && year) {
        return { date: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`, time: timePart.slice(0, 5) };
      }
    }
    if (datePart.includes('-')) {
      return { date: datePart, time: timePart.slice(0, 5) };
    }
    if (timePart) return { date: '', time: timePart.slice(0, 5) };
    if (datePart.includes(':')) return { date: '', time: datePart.slice(0, 5) };
    return { date: '', time: '' };
  }

  function buildDateTime(date: string, time: string) {
    if (!date && !time) return '';
    if (!date) return time;
    if (!time) return date;
    return `${date} ${time}`;
  }

  function formatSchedule(value: string) {
    if (!value) return '-';
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      const date = parsed.toLocaleDateString('pt-BR');
      const time = parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
      return `${date} ${time}`;
    }
    return value;
  }

  useEffect(() => {
    writeJson(SESSION_KEY, session);
  }, [session]);

  useEffect(() => {
    writeJson('transporter:patient-font', patientFontLarge);
  }, [patientFontLarge]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = themeMode;
    }
    writeJson('transporter:theme', themeMode);
  }, [themeMode]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        if (!session?.token) {
          setLoading(false);
          return;
        }

        const sessionResult = await me(session.token);
        if (cancelled) return;

        if (sessionResult.session) {
          setSession({ ...sessionResult.session, token: session.token });
        }

        await refreshRequests(session.token);
      } catch {
        if (!cancelled) {
          setSession(null);
          removeItem(SESSION_KEY);
          setRequests([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;
    refreshRequests(session.token).catch(() => {
      if (!cancelled) showBanner('error', 'Não foi possível carregar as solicitações.');
    });

    if (session.role === 'administrador' || session.role === 'gerente') {
      listUsers(session.token)
        .then((response) => {
          if (!cancelled) setUsers(response.rows ?? []);
        })
        .catch(() => {
          if (!cancelled) showBanner('error', 'Não foi possível carregar os usuários.');
        });
    }

    if (['operador', 'gerente', 'administrador'].includes(session.role)) {
      listClients(session.token)
        .then((response) => {
          if (!cancelled) setClients(response.rows ?? []);
        })
        .catch(() => {
          if (!cancelled) showBanner('error', 'Não foi possível carregar os pacientes.');
        });
    }

    return () => {
      cancelled = true;
    };
  }, [session?.token, session?.role]);

  useEffect(() => {
    if (!session) return;
    if (session.role === 'gerente') {
      setUserRoleFilter('operador');
    }
  }, [session?.role]);

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


  const visibleRequests = useMemo(
    () => filteredRequests(requests, session, requestFilter),
    [requests, session, requestFilter]
  );
  const activeRequest = visibleRequests.find((request) => request.id === activeRequestId) ?? visibleRequests[0] ?? null;

  useEffect(() => {
    if (!activeRequest) return;
    setTripForm({
      destination: activeRequest.destination,
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

  async function refreshClients(token = session?.token, query = '') {
    if (!token) {
      setClients([]);
      return;
    }

    const response = await listClients(token, query);
    setClients(response.rows ?? []);
    return response.rows ?? [];
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError('');
    setBanner(null);

    try {
      const response = await loginApi(normalizeDocument(loginDocument), loginPin);
      if (!response.session) {
        throw new Error('Resposta de login inválida.');
      }

      const nextSession: SessionUser = {
        name: response.session.name ?? '',
        document: response.session.document ?? '',
        role: response.session.role as AccessRole,
        mustChangePin: Boolean(response.session.mustChangePin),
        token: response.session.token ?? ''
      };

      setSession(nextSession);
      writeJson(SESSION_KEY, nextSession);
      setLoginPin('');
      setPinDraft('');
      setPinConfirm('');
      await refreshRequests(nextSession.token);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Falha ao entrar.');
    }
  }

  async function handleChangePin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.token) return;

    if (pinDraft.length < 4 || pinDraft !== pinConfirm) {
      showBanner('error', 'O novo PIN precisa ter ao menos 4 dígitos e deve ser confirmado.');
      return;
    }

    try {
      await changePin(session.token, pinDraft);
      const nextSession = { ...session, mustChangePin: false };
      setSession(nextSession);
      writeJson(SESSION_KEY, nextSession);
      setPinDraft('');
      setPinConfirm('');
      pushToast('success', 'PIN atualizado com sucesso.');
      await refreshRequests(session.token);
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Não foi possível alterar o PIN.');
    }
  }

  async function handleLogout() {
    if (session?.token) {
      await logoutApi(session.token).catch(() => undefined);
    }

    setSession(null);
    removeItem(SESSION_KEY);
    setRequests([]);
    setActiveRequestId('');
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
      setBanner(null);
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
      clientConfirmedAt: currentStamp(),
      status: 'agendada'
    });
    setBanner(null);
    pushToast('success', 'Confirmação registrada.');
  }

  async function handleResetClientPin() {
    if (!activeRequest) return;
    await patchRequest(activeRequest.id, { pinStatus: 'reset' });
    setBanner(null);
    pushToast('success', 'PIN resetado para 0000.');
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

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.token || session.role !== 'administrador') return;

    try {
      await createUser(
        {
          name: userForm.name.trim(),
          document: normalizeDocument(userForm.document),
          role: userForm.role
        },
        session.token
      );

      setUserForm({ name: '', document: '', role: 'operador' });
      const response = await listUsers(session.token);
      setUsers(response.rows ?? []);
      pushToast('success', 'Usuário criado com sucesso.');
      setBanner(null);
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Não foi possível criar o usuário.');
    }
  }

  async function handleResetUserPin(user: UserRow) {
    if (!session?.token) return;
    try {
      await resetUserPin(user.id, session.token);
      pushToast('success', 'PIN resetado para 0000.');
      const response = await listUsers(session.token);
      setUsers(response.rows ?? []);
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Não foi possível resetar o PIN.');
    }
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

  async function handleInlinePatientSave(event: FormEvent<HTMLFormElement>) {
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
      setRequestForm((current) => ({
        ...current,
        clientName: clientForm.name.trim(),
        document: formatDocument(clientForm.document),
        phone: clientForm.phone.trim(),
        cep: formatCep(clientForm.cep),
        street: clientForm.street.trim(),
        number: clientForm.number.trim(),
        neighborhood: clientForm.neighborhood.trim(),
        city: clientForm.city.trim()
      }));
      setShowInlinePatient(false);
      setCpfLookupStatus('found');
      pushToast('success', 'Paciente cadastrado e preenchido na solicitação.');
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Não foi possível cadastrar o paciente.');
    }
  }

  async function handleLookupPatient() {
    if (!session?.token) return;
    const document = normalizeDocument(requestForm.document);
    if (!document) return;

    try {
      const response = await listClients(session.token, document);
      const match = (response.rows ?? []).find((client) => normalizeDocument(client.document) === document);
      if (match) {
        const parsedAddress = parseAddress(match.address ?? '');
        setRequestForm((current) => ({
          ...current,
          clientName: match.name ?? '',
          document: formatDocument(match.document ?? ''),
          phone: match.phone ?? '',
          cep: formatCep(match.cep ?? ''),
          street: parsedAddress.street || current.street,
          number: parsedAddress.number || current.number,
          neighborhood: parsedAddress.neighborhood || current.neighborhood,
          city: parsedAddress.city || current.city
        }));
        setClientForm({
          name: match.name ?? '',
          document: formatDocument(match.document ?? ''),
          phone: match.phone ?? '',
          cep: formatCep(match.cep ?? ''),
          street: parsedAddress.street,
          number: parsedAddress.number,
          neighborhood: parsedAddress.neighborhood,
          city: parsedAddress.city,
          address: match.address ?? ''
        });
        if (match.cep) {
          handleLookupCep(match.cep, (data) => {
            setRequestForm((current) => ({
              ...current,
              street: data.street || current.street,
              neighborhood: data.neighborhood || current.neighborhood,
              city: data.city || current.city
            }));
            setClientForm((current) => ({
              ...current,
              street: data.street || current.street,
              neighborhood: data.neighborhood || current.neighborhood,
              city: data.city || current.city
            }));
          });
        }
        setShowInlinePatient(false);
        setCpfLookupStatus('found');
        pushToast('success', 'Paciente encontrado. Dados preenchidos.');
      } else {
        setCpfLookupStatus('missing');
        setShowInlinePatient(true);
        setClientForm((current) => ({
          ...current,
          document: formatDocument(document)
        }));
        showBanner('error', 'Paciente não encontrado. Complete o cadastro para continuar.');
      }
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Não foi possível buscar o CPF.');
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
    if (!window.confirm('Confirmar atualização do cadastro deste paciente?')) return;

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
      await refreshClients(session.token, operatorClientFilter);
      setClientModalOpen(false);
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Não foi possível atualizar o paciente.');
    }
  }

  async function handleDeleteClient(id: number) {
    if (!session?.token) return;
    if (!window.confirm('Deseja excluir este paciente? Essa ação não poderá ser desfeita.')) return;
    try {
      await deleteClient(id, session.token);
      pushToast('success', 'Paciente excluído.');
      await refreshClients(session.token, operatorClientFilter);
      if (activeClientId === id) {
        setActiveClientId(null);
        setClientForm({ name: '', document: '', phone: '', cep: '', street: '', number: '', neighborhood: '', city: '', address: '' });
      }
      setClientModalOpen(false);
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Não foi possível excluir o paciente.');
    }
  }

  async function handleSaveTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeRequest || !session?.token) return;

    if (!tripForm.boardingPoint.trim()) {
      showBanner('error', 'Informe o endereço completo do embarque.');
      return;
    }
    if (normalizeCep(tripForm.boardingPoint).length < 8) {
      showBanner('error', 'Informe o endereço completo com CEP.');
      return;
    }
    const companionPayload = buildCompanionPayload(tripCompanion, tripCompanionName, tripCompanionCpf);
    const departureAt = buildDateTime(tripDate, tripTime);
    const arrivalEta = buildDateTime(tripConsultDate, tripConsultTime);
    await patchRequest(activeRequest.id, {
      destination: tripForm.destination,
      boardingPoint: tripForm.boardingPoint,
      departureAt,
      arrivalEta,
      notes: tripForm.notes,
      companions: companionPayload,
      status: tripForm.status,
      driver: tripForm.driver,
      vehicle: tripForm.vehicle,
      phoneVisible: tripForm.phoneVisible
    });
    pushToast('success', 'Viagem atualizada.');
  }


  function parseDate(value: string) {
    if (!value) return null;
    if (value.includes('T')) {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const datePart = value.split(' ')[0] ?? '';
    const [day, month, year] = datePart.split('/').map((item) => Number(item));
    if (!day || !month || !year) return null;
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function isToday(value: string) {
    const parsed = parseDate(value);
    if (!parsed) return false;
    const today = new Date();
    return (
      parsed.getFullYear() === today.getFullYear() &&
      parsed.getMonth() === today.getMonth() &&
      parsed.getDate() === today.getDate()
    );
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

  function getInitials(name: string) {
    const cleaned = name.trim().replace(/\s+/g, ' ');
    if (!cleaned) return '??';
    const parts = cleaned.split(' ');
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : parts[0]?.[1] ?? '';
    return `${first}${last}`.toUpperCase();
  }

  function showBanner(type: BannerState['type'], message: string) {
    setBanner({ type, message });
    window.setTimeout(() => {
      setBanner((current) => (current?.message === message ? null : current));
    }, 6500);
  }

  function pushToast(type: ToastState['type'], message: string) {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }

  function buildMapQuery(request: TripRequest) {
    const parts = [request.boardingPoint, request.clientAddress, request.boardingCep, request.clientCep].filter(Boolean);
    if (!parts.length) return '';
    return parts.join(', ');
  }

  function formatAddressDisplay(address: string, cep?: string | null) {
    if (!address) return '-';
    const parsed = parseAddress(address);
    const hasStructured = parsed.street && parsed.number && parsed.neighborhood && parsed.city;
    const base = hasStructured
      ? `${parsed.street}, ${parsed.number} - ${parsed.neighborhood}, ${parsed.city}`
      : address;
    const formattedCep = formatCep(cep ?? '');
    return formattedCep ? `${base} · CEP ${formattedCep}` : base;
  }

  const dashboardTitle = session ? `${roleLabels[session.role]} em operação` : 'Portal de acesso';
  const isFiltered = Boolean(requestFilter.trim());
  const requestEmptyText = isFiltered
    ? 'Nenhuma solicitação corresponde ao filtro aplicado.'
    : session?.role === 'motorista'
      ? 'Nenhuma viagem atribuída até agora.'
      : session?.role === 'cliente'
        ? 'Nenhuma viagem registrada para este CPF.'
        : 'Nenhuma solicitação registrada no momento.';
  const isPatientSession = session?.role === 'cliente';
  const canManagePatients = session ? ['gerente', 'administrador'].includes(session.role) : false;
  const canEditTrip = session ? ['operador', 'gerente', 'administrador'].includes(session.role) : false;
  const canResetUser = (user: UserRow) => {
    if (!session) return false;
    if (session.role === 'administrador') return true;
    if (session.role === 'gerente') return user.role === 'operador';
    return false;
  };
  const canViewUsers = session ? ['administrador', 'gerente'].includes(session.role) : false;
  const internalNavItems = (() => {
    if (!session || isPatientSession) return [];

    const base: Array<{ id: string; label: string }> = [];
    if (session.role === 'operador') {
      base.push(
        { id: 'solicitacoes', label: 'Solicitações' },
        { id: 'pacientes', label: 'Pacientes' }
      );
    } else if (session.role === 'gerente') {
      base.push({ id: 'distribuicao', label: 'Distribuição' }, { id: 'pacientes', label: 'Pacientes' }, { id: 'detalhes', label: 'Detalhes' });
    } else if (session.role === 'motorista') {
      base.push({ id: 'agenda', label: 'Agenda' }, { id: 'detalhes', label: 'Detalhes' });
    } else if (session.role === 'administrador') {
      base.push(
        { id: 'viagens', label: 'Viagens' },
        { id: 'pacientes', label: 'Pacientes' },
        { id: 'detalhes', label: 'Detalhes' },
        { id: 'usuarios', label: 'Usuários' }
      );
    }

    return base;
  })();

  if (loading) {
    return (
      <div className="app-shell">
        <aside className="hero-panel">
          <div className="brand-lockup">
            <span className="brand-mark">T</span>
            <div>
              <p className="eyebrow">Transporter</p>
              <h1>Carregando operação...</h1>
            </div>
          </div>
          <div className="skeleton-block">
            <div className="skeleton-line"></div>
            <div className="skeleton-line wide"></div>
            <div className="skeleton-line"></div>
          </div>
        </aside>
        <main className="content-panel">
          <section className="glass-card">
            <div className="skeleton-grid">
              <div className="skeleton-line wide"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line wide"></div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={`app-shell auth-shell shell-v2 ${patientFontLarge ? 'patient-font-large' : ''}`}>
        <main className="content-panel login-panel">
          <div className="login-hero">
            <div className="brand-lockup">
              <span className="brand-mark">T</span>
              <div>
                <p className="eyebrow">Transporter</p>
                <h1>Portal do paciente</h1>
              </div>
            </div>
          </div>

          <header className="topbar topbar-v2">
            <div>
              <p className="eyebrow">Acesso seguro</p>
              <h2>Entre com CPF e PIN</h2>
            </div>
            <div className="topbar-actions">
              <button
                className="cta ghost"
                type="button"
                onClick={() => setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'))}
              >
                {themeMode === 'dark' ? 'Modo claro' : 'Modo escuro'}
              </button>
              <button className="cta ghost font-toggle" type="button" onClick={() => setPatientFontLarge((prev) => !prev)}>
                {patientFontLarge ? 'Fonte normal' : 'Fonte maior'}
              </button>
              <div className="topbar-note">
                <strong>PIN inicial</strong>
                <span>0000</span>
              </div>
            </div>
          </header>

          <section className="glass-card login-card login-card-v2 patient-access">
            <div className="section-head">
              <h3>{dashboardTitle}</h3>
              <p>{roleDescriptions.cliente}</p>
            </div>

            <form className="login-form" onSubmit={handleLogin}>
              <label>
                <span>CPF</span>
                <input
                  value={loginDocument}
                  onChange={(event) => setLoginDocument(formatDocument(event.target.value))}
                  placeholder="Digite o CPF"
                />
              </label>
              <label>
                <span>PIN</span>
                <input
                  value={loginPin}
                  onChange={(event) => setLoginPin(event.target.value)}
                  onFocus={(event) => event.currentTarget.select()}
                  type="password"
                  inputMode="numeric"
                  placeholder="****"
                />
              </label>
              {loginError ? <p className="form-error">{loginError}</p> : null}
              <button className="cta" type="submit">
                Entrar
              </button>
            </form>

            <div className="demo-access">
              <p className="eyebrow">Acessos de demonstração</p>
              <div className="demo-grid">
                {demoUsers.map((account) => (
                  <button
                    key={account.role}
                    className="demo-card"
                    type="button"
                    onClick={() => {
                      setLoginDocument(formatDocument(account.document));
                      setLoginPin(account.pin);
                    }}
                  >
                    <strong>{account.name}</strong>
                    <span>{roleLabels[account.role]}</span>
                    <small>PIN inicial 0000</small>
                  </button>
                ))}
              </div>
            </div>
          </section>
          {banner ? (
            <section className={`glass-card banner banner-${banner.type}`}>
              <strong>{banner.type === 'error' ? 'Erro' : 'Sucesso'}</strong>
              <p>{banner.message}</p>
            </section>
          ) : null}
        </main>
        {toasts.length ? (
          <div className="toast-stack">
            {toasts.map((toast) => (
              <div key={toast.id} className={`toast toast-${toast.type}`}>
                <strong>{toast.type === 'error' ? 'Erro' : 'Sucesso'}</strong>
                <span>{toast.message}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`app-shell dashboard-shell ${isPatientSession ? 'patient-view' : ''} ${
        patientView && patientFontLarge ? 'patient-font-large' : ''
      } ${!isPatientSession ? 'saas-app-shell internal-shell' : ''}`}
    >
      {isPatientSession ? null : (
        <aside className="saas-sidebar">
          <div className="saas-sidebar-panel">
            <div className="saas-sidebar-brand">
              <div className="saas-sidebar-crest" aria-hidden="true">
                <span>T</span>
              </div>
              <div className="saas-sidebar-copy">
                <strong>Transporter</strong>
                <span>Central operacional</span>
              </div>
            </div>

            <div className="saas-sidebar-meta">
              <section className="saas-sidebar-module">
                <span className="saas-module-label">Operação</span>
                <div className="saas-module-card">
                  <span>Canal</span>
                  <strong>Transporte em saúde</strong>
                </div>
              </section>

              <section className="saas-sidebar-module">
                <span className="saas-module-label">Sessão</span>
                <div className="saas-sidebar-session">
                  <div className="saas-sidebar-row">
                    <span>Perfil</span>
                    <strong>{roleLabels[session.role]}</strong>
                  </div>
                  <div className="saas-sidebar-row">
                    <span>Usuário</span>
                    <strong>{session.name}</strong>
                  </div>
                  <div className="saas-sidebar-row">
                    <span>Solicitações</span>
                    <strong>{visibleRequests.length}</strong>
                  </div>
                </div>
              </section>
            </div>

            <nav className="saas-sidebar-nav" aria-label="Navegação interna">
              {internalNavItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`saas-nav-link ${activeNav === item.id ? 'active' : ''}`}
                  onClick={() => {
                    if (session.role === 'operador' && item.id === 'pacientes') {
                      setActiveNav('solicitacoes');
                      setOperatorView('pacientes');
                    } else {
                      setActiveNav(item.id);
                      if (session.role === 'operador') {
                        if (item.id === 'solicitacoes' && operatorView === 'pacientes') {
                          setOperatorView('novo');
                        }
                      }
                    }
                  }}
                >
                  <span>{item.label}</span>
                </a>
              ))}
            </nav>

            <div className="saas-sidebar-actions">
              {session.role === 'operador' ? (
                <>
                  <div className="saas-action-item">
                    <span>Solicitações hoje</span>
                    <strong>{pendingToday}</strong>
                  </div>
                  <div className="saas-action-item">
                    <span>Mensagens não lidas</span>
                    <strong>{unreadMessages}</strong>
                  </div>
                </>
              ) : null}
              {session.role === 'gerente' ? (
                <>
                  <div className="saas-action-item">
                    <span>Sem motorista</span>
                    <strong>{pendingDispatch}</strong>
                  </div>
                  <div className="saas-action-item">
                    <span>Em rota</span>
                    <strong>{inRoute}</strong>
                  </div>
                </>
              ) : null}
              {session.role === 'administrador' ? (
                <>
                  <div className="saas-action-item">
                    <span>Confirmações pendentes</span>
                    <strong>{pendingConfirmations}</strong>
                  </div>
                  <div className="saas-action-item">
                    <span>PINs para trocar</span>
                    <strong>{pendingPinChange}</strong>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </aside>
      )}

      <main className="content-panel">
        {isPatientSession ? (
          <header className="topbar topbar-v2 patient-topbar">
            <div></div>
            <div className="topbar-actions">
              <button
                className="cta ghost"
                type="button"
                onClick={() => setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'))}
              >
                {themeMode === 'dark' ? 'Modo claro' : 'Modo escuro'}
              </button>
              <button className="cta ghost font-toggle" type="button" onClick={() => setPatientFontLarge((prev) => !prev)}>
                {patientFontLarge ? 'Fonte normal' : 'Fonte maior'}
              </button>
              <button className="cta ghost" onClick={handleLogout} type="button">
                Sair
              </button>
            </div>
          </header>
        ) : (
          <section className="glass-card panel-card internal-header sticky-header">
            <div className="internal-header-top">
              <div className="internal-header-name">
                <strong>{session.name}</strong>
                <span>{roleLabels[session.role]}</span>
              </div>
              <div className="topbar-actions">
                <button
                  className="cta ghost"
                  type="button"
                  onClick={() => setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'))}
                >
                  {themeMode === 'dark' ? 'Modo claro' : 'Modo escuro'}
                </button>
                <button className="cta ghost" onClick={handleLogout} type="button">
                  Sair
                </button>
              </div>
            </div>
          </section>
        )}

        {isPatientSession ? (
          <section className="glass-card panel-card patient-header">
            <div className="brand-lockup">
              <span className="brand-mark">T</span>
              <div>
                <p className="eyebrow">Transporter</p>
                <h2>Portal do paciente</h2>
              </div>
            </div>
            <p className="hero-copy">
              {roleDescriptions[session.role]} O acesso está vinculado ao CPF {formatDocument(session.document)}.
            </p>
            <div className="profile-summary">
              <div className="profile-avatar">{getInitials(session.name)}</div>
              <div>
                <strong>{session.name}</strong>
                <span>{roleLabels[session.role]}</span>
              </div>
            </div>
          </section>
        ) : null}

        {!isPatientSession ? null : null}

        {session.mustChangePin && (
          <section className="glass-card alert-card">
            <div className="section-head">
              <p className="eyebrow">Primeiro acesso</p>
              <h2>Troque seu PIN inicial</h2>
            </div>
            <form className="pin-form" onSubmit={handleChangePin}>
              <label>
                <span>Novo PIN</span>
                <input
                  value={pinDraft}
                  onChange={(event) => setPinDraft(event.target.value)}
                  type="password"
                  inputMode="numeric"
                  placeholder="Crie um PIN novo"
                />
              </label>
              <label>
                <span>Confirmar PIN</span>
                <input
                  value={pinConfirm}
                  onChange={(event) => setPinConfirm(event.target.value)}
                  type="password"
                  inputMode="numeric"
                  placeholder="Repita o PIN"
                />
              </label>
              <button className="cta" type="submit">
                Salvar novo PIN
              </button>
            </form>
          </section>
        )}

        {banner ? (
          <section className={`glass-card banner banner-${banner.type}`}>
            <strong>{banner.type === 'error' ? 'Erro' : 'Sucesso'}</strong>
            <p>{banner.message}</p>
          </section>
        ) : null}

        {session.role === 'operador' && (
          <section className="glass-card panel-card" id="solicitacoes">
            <div className="section-head">
              <p className="eyebrow">Atendimento</p>
              <div className="section-toolbar">
                <h2>Solicitações</h2>
                <div className="toolbar-actions">
                  <button
                    className={`cta ghost ${operatorView === 'novo' ? 'active' : ''}`}
                    type="button"
                    onClick={() => {
                      setOperatorView('novo');
                      setActiveNav('solicitacoes');
                    }}
                  >
                    Nova solicitação
                  </button>
                  <button
                    className={`cta ghost ${operatorView === 'recentes' ? 'active' : ''}`}
                    type="button"
                    onClick={() => {
                      setOperatorView('recentes');
                      setActiveNav('solicitacoes');
                    }}
                  >
                    Solicitações recentes
                  </button>
                  <button
                    className={`cta ghost ${operatorView === 'pacientes' ? 'active' : ''}`}
                    type="button"
                    onClick={() => {
                      setOperatorView('pacientes');
                      setActiveNav('solicitacoes');
                    }}
                  >
                    Pacientes
                  </button>
                </div>
              </div>
            </div>

            {operatorView === 'novo' ? (
              <div className="operator-grid">
                <form className="request-form" onSubmit={handleCreateRequest}>
                  <div className="input-action">
                    <input
                      placeholder="CPF"
                      value={requestForm.document}
                      onChange={(event) => {
                        const value = formatDocument(event.target.value);
                        setRequestForm({ ...requestForm, document: value });
                        setCpfLookupStatus('idle');
                      }}
                    />
                    <button className="cta ghost" type="button" onClick={handleLookupPatient}>
                      Buscar CPF
                    </button>
                  </div>
                  <input placeholder="Nome do paciente" value={requestForm.clientName} onChange={(event) => setRequestForm({ ...requestForm, clientName: event.target.value })} />
                  <input placeholder="Telefone" value={requestForm.phone} onChange={(event) => setRequestForm({ ...requestForm, phone: event.target.value })} />
                  <input placeholder="Destino" value={requestForm.destination} onChange={(event) => setRequestForm({ ...requestForm, destination: event.target.value })} />
                  <div className="input-action">
                    <input
                      placeholder="CEP"
                      value={requestForm.cep}
                      onChange={(event) => setRequestForm({ ...requestForm, cep: formatCep(event.target.value) })}
                      onBlur={(event) =>
                        handleLookupCep(event.target.value, (data) =>
                          setRequestForm((current) => ({
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
                        handleLookupCep(requestForm.cep, (data) =>
                          setRequestForm((current) => ({
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
                  <input placeholder="Rua" value={requestForm.street} onChange={(event) => setRequestForm({ ...requestForm, street: event.target.value })} />
                  <input placeholder="Número" value={requestForm.number} onChange={(event) => setRequestForm({ ...requestForm, number: event.target.value })} />
                  <input placeholder="Bairro" value={requestForm.neighborhood} onChange={(event) => setRequestForm({ ...requestForm, neighborhood: event.target.value })} />
                  <input placeholder="Cidade" value={requestForm.city} onChange={(event) => setRequestForm({ ...requestForm, city: event.target.value })} />
                  <label>
                    <span>Data e hora da viagem</span>
                    <div className="input-group">
                      <input type="date" value={requestDate} onChange={(event) => setRequestDate(event.target.value)} />
                      <input type="time" value={requestTime} onChange={(event) => setRequestTime(formatTime(event.target.value))} />
                    </div>
                  </label>
                  <label>
                    <span>Data e hora da consulta</span>
                    <div className="input-group">
                      <input type="date" value={consultDate} onChange={(event) => setConsultDate(event.target.value)} />
                      <input type="time" value={consultTime} onChange={(event) => setConsultTime(formatTime(event.target.value))} />
                    </div>
                  </label>
                  <label>
                    <span>Acompanhante</span>
                    <select
                      value={requestCompanion}
                      onChange={(event) => setRequestCompanion(event.target.value as 'nao' | 'sim')}
                    >
                      <option value="nao">não</option>
                      <option value="sim">sim</option>
                    </select>
                  </label>
                  {requestCompanion === 'sim' ? (
                    <>
                      <input
                        placeholder="Nome do acompanhante"
                        value={requestCompanionName}
                        onChange={(event) => setRequestCompanionName(event.target.value)}
                      />
                      <input
                        placeholder="CPF do acompanhante"
                        value={requestCompanionCpf}
                        onChange={(event) => setRequestCompanionCpf(formatDocument(event.target.value))}
                      />
                    </>
                  ) : null}
                  <textarea placeholder="Observações" value={requestForm.notes} onChange={(event) => setRequestForm({ ...requestForm, notes: event.target.value })} />
                  <button className="cta" type="submit">
                    Gerar protocolo
                  </button>
                </form>

                {showInlinePatient ? (
                  <div className="glass-card inline-card">
                    <div className="section-head">
                      <p className="eyebrow">Cadastro rápido</p>
                      <h3>Novo paciente</h3>
                    </div>
                    <form className="request-form" onSubmit={handleInlinePatientSave}>
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
                        <button
                          className="cta ghost"
                          type="button"
                          onClick={() => {
                            setShowInlinePatient(false);
                            setCpfLookupStatus('idle');
                          }}
                        >
                          Cancelar
                        </button>
                        <button className="cta" type="submit">
                          Salvar paciente
                        </button>
                      </div>
                    </form>
                  </div>
                ) : null}
              </div>
            ) : operatorView === 'recentes' ? (
              <>
                <div className="filter-row">
                  <input placeholder="Filtrar por paciente, protocolo ou destino" value={requestFilter} onChange={(event) => setRequestFilter(event.target.value)} />
                </div>
                <div className="admin-table">
                  <div className="admin-row admin-row-head">
                    <span>Protocolo</span>
                    <span>Paciente</span>
                    <span>Saída</span>
                    <span>Status</span>
                    <span>Ação</span>
                  </div>
                  <div className="admin-table-body operator-scroll">
                    {visibleRequests.length ? (
                      visibleRequests.map((request) => (
                  <div className="admin-row" key={request.id}>
                          <strong>{request.protocol}</strong>
                          <div className="admin-cell">
                            <strong>{request.clientName}</strong>
                            <small>{formatAddressDisplay(request.boardingPoint, request.boardingCep ?? request.clientCep)}</small>
                          </div>
                          <span>{formatSchedule(request.departureAt)}</span>
                          <span className={`status status-${request.status}`}>{statusLabels[request.status]}</span>
                          <div className="table-actions">
                            <button
                              className="cta ghost"
                              type="button"
                              onClick={() => {
                                setActiveRequestId(request.id);
                              setActiveNav('detalhes');
                            }}
                          >
                            Editar
                          </button>
                            <button
                              className="cta ghost danger"
                              type="button"
                              onClick={() => {
                                if (window.confirm('Deseja excluir esta solicitação?')) {
                                  handleDeleteRequest(request.id);
                                }
                              }}
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">
                        <div className="empty-icon"></div>
                        <strong>Solicitações vazias</strong>
                        <p>{requestEmptyText}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="filter-row">
                  <input
                    placeholder="Buscar por nome ou CPF"
                    value={operatorClientFilter}
                    onChange={(event) => {
                      const value = event.target.value;
                      setOperatorClientFilter(value);
                      if (!session?.token) return;
                      if (!value || value.length >= 3) {
                        refreshClients(session.token, value).catch(() => undefined);
                      }
                    }}
                  />
                </div>
                <div className="admin-table">
                  <div className="admin-row admin-row-head">
                    <span>Paciente</span>
                    <span>CPF</span>
                    <span>Telefone</span>
                    <span>CEP</span>
                    <span>Endereço</span>
                  </div>
                  <div className="admin-table-body operator-scroll">
                    {clients.length ? (
                      clients.map((client) => (
                        <div className="admin-row" key={client.id} onClick={() => openClientModal(client)}>
                          <div className="admin-user">
                            <span className="admin-avatar">{getInitials(client.name ?? '')}</span>
                            <strong>{client.name}</strong>
                          </div>
                          <span>{formatDocument(client.document)}</span>
                          <span>{client.phone || '-'}</span>
                          <span>{formatCep(client.cep ?? '') || '-'}</span>
                          <span>{client.address || '-'}</span>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">
                        <div className="empty-icon"></div>
                        <strong>Nenhum paciente encontrado</strong>
                        <p>Use a busca acima para localizar um CPF cadastrado.</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {canManagePatients && (
          <section className="grid two-col" id="pacientes">
            <article className="glass-card panel-card">
              <div className="section-head">
                <p className="eyebrow">Pacientes</p>
                <h2>Cadastro e consulta</h2>
              </div>
              <div className="filter-row">
                <input
                  placeholder="Buscar por nome, CPF ou telefone"
                  value={clientFilter}
                  onChange={(event) => {
                    const value = event.target.value;
                    setClientFilter(value);
                    if (!session?.token) return;
                    if (!value || value.length >= 3) {
                      refreshClients(session.token, value).catch(() => undefined);
                    }
                  }}
                />
              </div>
              <div className="admin-table">
                <div className="admin-row admin-row-head">
                  <span>Paciente</span>
                  <span>CPF</span>
                  <span>Telefone</span>
                  <span>CEP</span>
                  <span>Endereço</span>
                </div>
                <div className="admin-table-body">
                  {clients.length ? (
                    clients.map((client) => (
                      <div
                        className={`admin-row ${activeClientId === client.id ? 'request-selected' : ''}`}
                        key={client.id}
                        onClick={() => {
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
                        }}
                      >
                        <div className="admin-user">
                          <span className="admin-avatar">{getInitials(client.name ?? '')}</span>
                          <strong>{client.name}</strong>
                        </div>
                        <span>{formatDocument(client.document)}</span>
                        <span>{client.phone || '-'}</span>
                        <span>{formatCep(client.cep ?? '') || '-'}</span>
                        <span>{client.address || '-'}</span>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon"></div>
                      <strong>Nenhum paciente encontrado</strong>
                      <p>Cadastre um novo paciente para começar.</p>
                    </div>
                  )}
                </div>
              </div>
            </article>

            <article className="glass-card panel-card">
              <div className="section-head">
                <p className="eyebrow">Dados do paciente</p>
                <h2>{activeClientId ? 'Editar paciente' : 'Novo paciente'}</h2>
              </div>
              <form className="request-form" onSubmit={activeClientId ? handleUpdateClient : handleCreateClient}>
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
                  <button className="cta ghost" type="button" onClick={() => {
                    setActiveClientId(null);
                    setClientForm({ name: '', document: '', phone: '', cep: '', street: '', number: '', neighborhood: '', city: '', address: '' });
                  }}>
                    Limpar
                  </button>
                  <button className="cta" type="submit">
                    {activeClientId ? 'Salvar alterações' : 'Cadastrar paciente'}
                  </button>
                </div>
              </form>
            </article>
          </section>
        )}

        {session.role === 'gerente' && (
          <section className="glass-card panel-card" id="distribuicao">
            <div className="section-head">
              <p className="eyebrow">Distribuição</p>
              <h2>Configuração operacional da viagem</h2>
            </div>
            <div className="manager-grid">
              {visibleRequests.length ? (
                visibleRequests.map((request) => (
                  <article className={`manager-card ${request.id === activeRequestId ? 'request-selected' : ''}`} key={request.id} onClick={() => setActiveRequestId(request.id)}>
                    <strong>{request.protocol}</strong>
                    <p>{request.clientName}</p>
                    <small>{request.destination}</small>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <div className="empty-icon"></div>
                  <strong>Sem viagens para distribuir</strong>
                  <p>Assim que o operador registrar uma solicitação ela aparecerá aqui.</p>
                </div>
              )}
            </div>

            {activeRequest ? (
              <div className="assignment-panel">
                <div className="assignment-head">
                  <div>
                    <strong>{activeRequest.clientName}</strong>
                    <p>{activeRequest.protocol}</p>
                  </div>
                  <span className={`status status-${activeRequest.status}`}>{statusLabels[activeRequest.status]}</span>
                </div>
                <div className="assignment-grid">
                  <label>
                    <span>CEP do embarque</span>
                    <div className="input-action">
                      <input
                        value={managerCep}
                        onChange={(event) => setManagerCep(formatCep(event.target.value))}
                        onBlur={(event) =>
                          handleLookupCep(event.target.value, (data) => {
                            setManagerStreet(data.street || managerStreet);
                            setManagerNeighborhood(data.neighborhood || managerNeighborhood);
                            setManagerCity(data.city || managerCity);
                          })
                        }
                      />
                      <button
                        className="cta ghost"
                        type="button"
                        onClick={() =>
                          handleLookupCep(managerCep, (data) => {
                            setManagerStreet(data.street || managerStreet);
                            setManagerNeighborhood(data.neighborhood || managerNeighborhood);
                            setManagerCity(data.city || managerCity);
                          })
                        }
                      >
                        Buscar CEP
                      </button>
                    </div>
                  </label>
                  <label>
                    <span>Rua</span>
                    <input
                      value={managerStreet}
                      onChange={(event) => setManagerStreet(event.target.value)}
                      onBlur={applyManagerAddress}
                    />
                  </label>
                  <label>
                    <span>Número</span>
                    <input
                      value={managerNumber}
                      onChange={(event) => setManagerNumber(event.target.value)}
                      onBlur={applyManagerAddress}
                    />
                  </label>
                  <label>
                    <span>Bairro</span>
                    <input
                      value={managerNeighborhood}
                      onChange={(event) => setManagerNeighborhood(event.target.value)}
                      onBlur={applyManagerAddress}
                    />
                  </label>
                  <label>
                    <span>Cidade</span>
                    <input
                      value={managerCity}
                      onChange={(event) => setManagerCity(event.target.value)}
                      onBlur={applyManagerAddress}
                    />
                  </label>
                  <label>
                    <span>Motorista</span>
                    <input value={activeRequest.driver} onChange={(event) => patchRequest(activeRequest.id, { driver: event.target.value })} />
                  </label>
                  <label>
                    <span>Veículo</span>
                    <input value={activeRequest.vehicle} onChange={(event) => patchRequest(activeRequest.id, { vehicle: event.target.value })} />
                  </label>
                  <label>
                    <span>Data e hora da viagem</span>
                    <div className="input-group">
                      <input
                        type="date"
                        value={splitDateTime(activeRequest.departureAt).date}
                        onChange={(event) => patchRequest(activeRequest.id, { departureAt: buildDateTime(event.target.value, splitDateTime(activeRequest.departureAt).time) })}
                      />
                      <input
                        type="time"
                        value={splitDateTime(activeRequest.departureAt).time}
                        onChange={(event) => patchRequest(activeRequest.id, { departureAt: buildDateTime(splitDateTime(activeRequest.departureAt).date, formatTime(event.target.value)) })}
                      />
                    </div>
                  </label>
                  <label>
                    <span>Data e hora da consulta</span>
                    <div className="input-group">
                      <input
                        type="date"
                        value={splitDateTime(activeRequest.arrivalEta).date}
                        onChange={(event) => patchRequest(activeRequest.id, { arrivalEta: buildDateTime(event.target.value, splitDateTime(activeRequest.arrivalEta).time) })}
                      />
                      <input
                        type="time"
                        value={splitDateTime(activeRequest.arrivalEta).time}
                        onChange={(event) => patchRequest(activeRequest.id, { arrivalEta: buildDateTime(splitDateTime(activeRequest.arrivalEta).date, formatTime(event.target.value)) })}
                      />
                    </div>
                  </label>
                  <label>
                    <span>Status</span>
                    <select value={activeRequest.status} onChange={(event) => patchRequest(activeRequest.id, { status: event.target.value as RequestStatus })}>
                      <option value="rascunho">Rascunho</option>
                      <option value="em_atendimento">Em atendimento</option>
                      <option value="aguardando_distribuicao">Aguardando distribuição</option>
                      <option value="agendada">Agendada</option>
                      <option value="em_rota">Em rota</option>
                      <option value="concluida">Concluída</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </label>
                  <label>
                    <span>Telefone visível</span>
                    <select value={activeRequest.phoneVisible ? 'sim' : 'nao'} onChange={(event) => patchRequest(activeRequest.id, { phoneVisible: event.target.value === 'sim' })}>
                      <option value="sim">sim</option>
                      <option value="nao">nao</option>
                    </select>
                  </label>
                </div>
                <label className="full-width">
                  <span>Observações</span>
                  <textarea value={activeRequest.notes} onChange={(event) => patchRequest(activeRequest.id, { notes: event.target.value })} />
                </label>
              </div>
            ) : null}
          </section>
        )}

        {session.role === 'motorista' && (
          <section className="grid two-col" id="agenda">
            <article className="glass-card panel-card">
              <div className="section-head">
                <p className="eyebrow">Agenda mobile</p>
                <h2>Viagens atribuídas</h2>
              </div>
              <div className="request-list">
                {visibleRequests.length ? (
                  visibleRequests.map((request) => (
                    <article className={`request-row ${request.id === activeRequestId ? 'request-selected' : ''}`} key={request.id} onClick={() => setActiveRequestId(request.id)}>
                      <div>
                        <strong>{request.clientName}</strong>
                        <p>{request.destination}</p>
                        <small>
                          {formatAddressDisplay(request.boardingPoint, request.boardingCep ?? request.clientCep)} · {formatSchedule(request.departureAt)}
                        </small>
                      </div>
                      <div className="request-meta">
                        <span className={`status status-${request.status}`}>{statusLabels[request.status]}</span>
                        <small>{request.vehicle || 'Sem veículo'}</small>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon"></div>
                    <strong>Agenda livre</strong>
                    <p>{requestEmptyText}</p>
                  </div>
                )}
              </div>
            </article>

            <article className="glass-card panel-card">
              <div className="section-head">
                <p className="eyebrow">Ações operacionais</p>
                <h2>Detalhes rápidos</h2>
              </div>
              {activeRequest ? (
                <div className="detail-stack">
                  <p><strong>Paciente:</strong> {activeRequest.clientName}</p>
                  <p><strong>CPF:</strong> {formatDocument(activeRequest.document)}</p>
                  <p><strong>Telefone:</strong> {activeRequest.phoneVisible ? activeRequest.phone : 'oculto'}</p>
                  <p><strong>Endereço:</strong> {activeRequest.clientAddress || 'não informado'}</p>
                  <p><strong>CEP:</strong> {activeRequest.clientCep || 'não informado'}</p>
                  <p><strong>Embarque:</strong> {formatAddressDisplay(activeRequest.boardingPoint, activeRequest.boardingCep ?? activeRequest.clientCep)}</p>
                  <p><strong>Destino:</strong> {activeRequest.destination}</p>
                  <p><strong>Acompanhantes / carga:</strong> {activeRequest.companions}</p>
                  <a
                    className="cta"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(buildMapQuery(activeRequest) || activeRequest.boardingPoint)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir mapa
                  </a>
                </div>
              ) : null}
            </article>
          </section>
        )}

        {(session.role === 'cliente' || session.role === 'administrador') && (
          <section className="glass-card panel-card" id="viagens">
            <div className="section-head">
              <p className="eyebrow">Solicitação central</p>
              <h2>{session.role === 'cliente' ? 'Minhas viagens' : 'Visão global'}</h2>
            </div>
            <div className="request-list">
              {visibleRequests.length ? (
                visibleRequests.map((request) => (
                  <article className={`request-row ${request.id === activeRequestId ? 'request-selected' : ''}`} key={request.id} onClick={() => setActiveRequestId(request.id)}>
                    <div>
                      <strong>{request.protocol}</strong>
                      <p>
                        {request.clientName} · {request.destination}
                      </p>
                      <small>
                        Embarque: {formatAddressDisplay(request.boardingPoint, request.boardingCep ?? request.clientCep)} · Saída: {formatSchedule(request.departureAt)}
                      </small>
                    </div>
                    <div className="request-meta">
                      <span className={`status status-${request.status}`}>{statusLabels[request.status]}</span>
                      <small>{request.driver || 'Sem motorista'}</small>
                      <small>{request.vehicle || 'Sem veículo'}</small>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <div className="empty-icon"></div>
                  <strong>Nenhuma viagem encontrada</strong>
                  <p>{requestEmptyText}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {activeRequest && (session.role !== 'operador' || operatorView === 'recentes') ? (
          <section className="grid two-col" id="detalhes">
            <article className="glass-card panel-card">
              <div className="section-head">
                <p className="eyebrow">Detalhe da viagem</p>
                <h2>Central da solicitação</h2>
              </div>
              <div className="detail-stack">
                <p><strong>Protocolo:</strong> {activeRequest.protocol}</p>
                <p><strong>Paciente:</strong> {activeRequest.clientName}</p>
                <p><strong>Destino:</strong> {activeRequest.destination}</p>
                {session.role !== 'operador' ? (
                  <>
                    <p><strong>Motorista:</strong> {activeRequest.driver || 'não atribuído'}</p>
                    <p><strong>Veículo:</strong> {activeRequest.vehicle || 'não atribuído'}</p>
                    <p><strong>PIN do paciente:</strong> {activeRequest.pinStatus}</p>
                    <p><strong>Confirmação:</strong> {activeRequest.clientConfirmedAt ?? 'pendente'}</p>
                  </>
                ) : null}
                <p><strong>Observações:</strong> {activeRequest.notes}</p>
              </div>

              {canEditTrip ? (
                <form className="request-form" onSubmit={handleSaveTrip}>
                  <input
                    placeholder="Destino"
                    value={tripForm.destination}
                    onChange={(event) => setTripForm({ ...tripForm, destination: event.target.value })}
                  />
                  <input
                    placeholder="Endereço completo"
                    value={tripForm.boardingPoint}
                    onChange={(event) => setTripForm({ ...tripForm, boardingPoint: event.target.value })}
                  />
                  <label>
                    <span>Data e hora da viagem</span>
                    <div className="input-group">
                      <input type="date" value={tripDate} onChange={(event) => setTripDate(event.target.value)} />
                      <input type="time" value={tripTime} onChange={(event) => setTripTime(formatTime(event.target.value))} />
                    </div>
                  </label>
                  <label>
                    <span>Data e hora da consulta</span>
                    <div className="input-group">
                      <input type="date" value={tripConsultDate} onChange={(event) => setTripConsultDate(event.target.value)} />
                      <input type="time" value={tripConsultTime} onChange={(event) => setTripConsultTime(formatTime(event.target.value))} />
                    </div>
                  </label>
                  <label>
                    <span>Acompanhante</span>
                    <select
                      value={tripCompanion}
                      onChange={(event) => setTripCompanion(event.target.value as 'nao' | 'sim')}
                    >
                      <option value="nao">não</option>
                      <option value="sim">sim</option>
                    </select>
                  </label>
                  {tripCompanion === 'sim' ? (
                    <>
                      <input
                        placeholder="Nome do acompanhante"
                        value={tripCompanionName}
                        onChange={(event) => setTripCompanionName(event.target.value)}
                      />
                      <input
                        placeholder="CPF do acompanhante"
                        value={tripCompanionCpf}
                        onChange={(event) => setTripCompanionCpf(formatDocument(event.target.value))}
                      />
                    </>
                  ) : null}
                  <textarea
                    placeholder="Observações"
                    value={tripForm.notes}
                    onChange={(event) => setTripForm({ ...tripForm, notes: event.target.value })}
                  />
                  <label>
                    <span>Status</span>
                    <select
                      value={tripForm.status}
                      onChange={(event) => setTripForm({ ...tripForm, status: event.target.value as RequestStatus })}
                    >
                      <option value="rascunho">Rascunho</option>
                      <option value="em_atendimento">Em atendimento</option>
                      <option value="aguardando_distribuicao">Aguardando distribuição</option>
                      <option value="agendada">Agendada</option>
                      <option value="em_rota">Em rota</option>
                      <option value="concluida">Concluída</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </label>
                  {(session?.role === 'gerente' || session?.role === 'administrador') && (
                    <>
                      <input
                        placeholder="Motorista"
                        value={tripForm.driver}
                        onChange={(event) => setTripForm({ ...tripForm, driver: event.target.value })}
                      />
                      <input
                        placeholder="Veículo"
                        value={tripForm.vehicle}
                        onChange={(event) => setTripForm({ ...tripForm, vehicle: event.target.value })}
                      />
                      <label>
                        <span>Telefone visível</span>
                        <select
                          value={tripForm.phoneVisible ? 'sim' : 'nao'}
                          onChange={(event) => setTripForm({ ...tripForm, phoneVisible: event.target.value === 'sim' })}
                        >
                          <option value="sim">sim</option>
                          <option value="nao">nao</option>
                        </select>
                      </label>
                    </>
                  )}
                  <div className="form-actions">
                    <button
                      className="cta ghost"
                      type="button"
                      onClick={() => {
                        if (!activeRequest) return;
                        setTripForm({
                          destination: activeRequest.destination,
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
                      }}
                    >
                      Cancelar
                    </button>
                    <button className="cta" type="submit">
                      Salvar alterações
                    </button>
                  </div>
                </form>
              ) : null}
            </article>

            <article className="glass-card panel-card">
              <div className="section-head">
                <p className="eyebrow">{session.role === 'cliente' ? 'Mensagens' : 'Mensagens e auditoria'}</p>
                <div className="section-toolbar">
                  <h2>{session.role === 'cliente' ? 'Comunicação' : 'Histórico e comunicação'}</h2>
                  <button className={`status status-${activeRequest.status} status-pill`} type="button">
                    {statusLabels[activeRequest.status]}
                  </button>
                </div>
              </div>
              <div className="message-compose">
                <textarea value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} placeholder="Escreva uma mensagem para a operação, motorista ou paciente" />
                <button className="cta" type="button" onClick={handleSendMessage}>
                  Enviar mensagem
                </button>
                {session.role === 'cliente' ? (
                  <button className="cta ghost" type="button" onClick={handleConfirmRead}>
                    Confirmar agenda recebida
                  </button>
                ) : null}
                {session.role === 'operador' || session.role === 'gerente' || session.role === 'administrador' ? (
                  <button className="cta ghost" type="button" onClick={handleResetClientPin}>
                    Resetar PIN do paciente
                  </button>
                ) : null}
              </div>

              <div className="messages-stack">
                {activeRequest.messages.length ? (
                  activeRequest.messages.map((message) => (
                    <article className={`message-item ${message.internal ? 'internal' : 'external'}`} key={message.id}>
                      {session.role === 'cliente' ? null : (
                        <div className="message-head">
                          <strong>{message.author}</strong>
                          <span>{message.at}</span>
                        </div>
                      )}
                      <p>{message.body}</p>
                    </article>
                  ))
                ) : (
                  <div className="empty-state compact">
                    <div className="empty-icon"></div>
                    <strong>Sem mensagens</strong>
                    <p>Quando houver comunicação, ela aparecerá aqui.</p>
                  </div>
                )}
              </div>

              {session.role === 'cliente' ? null : (
                <div className="audit-stack">
                  {activeRequest.audit.filter((item) => !item.label.includes('.')).length ? (
                    activeRequest.audit
                      .filter((item) => !item.label.includes('.'))
                      .map((item) => (
                      <div className="audit-item" key={item.id}>
                        <strong>{item.label}</strong>
                        {item.details ? <small>{item.details}</small> : null}
                        {item.actor ? <span>{item.actor}</span> : null}
                        <span>{item.at}</span>
                      </div>
                      ))
                  ) : (
                    <div className="empty-state compact">
                      <div className="empty-icon"></div>
                      <strong>Sem auditoria</strong>
                      <p>As mudanças relevantes serão registradas aqui.</p>
                    </div>
                  )}
                </div>
              )}
            </article>
          </section>
        ) : null}



        {canViewUsers ? (
          <section className="glass-card" id="usuarios">
            <div className="section-head">
              <p className="eyebrow">{session.role === 'gerente' ? 'Equipe' : 'Governança'}</p>
              <h2>{session.role === 'gerente' ? 'Operadores' : 'Usuários'}</h2>
            </div>
            {session.role === 'administrador' ? (
              <form className="admin-create-form" onSubmit={handleCreateUser}>
                <input placeholder="Nome" value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} />
                <input placeholder="CPF" value={userForm.document} onChange={(event) => setUserForm({ ...userForm, document: formatDocument(event.target.value) })} />
                <select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value as AccessRole })}>
                  <option value="cliente">paciente</option>
                  <option value="operador">operador</option>
                  <option value="gerente">gerente</option>
                  <option value="motorista">motorista</option>
                  <option value="administrador">administrador</option>
                </select>
                <button className="cta" type="submit">
                  Criar usuário (PIN inicial 0000)
                </button>
              </form>
            ) : null}
            {session.role === 'administrador' ? (
              <div className="filter-row">
                <select value={userRoleFilter} onChange={(event) => setUserRoleFilter(event.target.value as AccessRole | 'todos')}>
                  <option value="todos">Todos os perfis</option>
                  <option value="cliente">Pacientes</option>
                  <option value="operador">Operadores</option>
                  <option value="gerente">Gerentes</option>
                  <option value="motorista">Motoristas</option>
                  <option value="administrador">Administradores</option>
                </select>
              </div>
            ) : null}
            {users.length ? (
              <div className="admin-table">
                <div className="admin-row admin-row-head">
                  <span>Usuário</span>
                  <span>Perfil</span>
                  <span>CPF</span>
                  <span>Status do PIN</span>
                  <span>Ação</span>
                </div>
                <div className="admin-table-body">
                  {users
                    .filter((user) => (userRoleFilter === 'todos' ? true : user.role === userRoleFilter))
                    .map((user) => (
                    <div className="admin-row" key={user.id}>
                      <div className="admin-user">
                        <span className="admin-avatar">{getInitials(user.name)}</span>
                        <strong>{user.name}</strong>
                      </div>
                      <span>{roleLabels[user.role as AccessRole] ?? user.role}</span>
                      <span>{formatDocument(user.document)}</span>
                      <span>{user.pinMustChange ? 'PIN inicial pendente' : 'PIN alterado'}</span>
                      <span>
                        {canResetUser(user) ? (
                          <button className="cta ghost" type="button" onClick={() => handleResetUserPin(user)}>
                            Resetar PIN
                          </button>
                        ) : (
                          '-'
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon"></div>
                <strong>Nenhum usuário cadastrado</strong>
                <p>Cadastre o primeiro operador, gerente, motorista ou paciente.</p>
              </div>
            )}
          </section>
        ) : null}
        {clientModalOpen && activeClientId ? (
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
        ) : null}
        {toasts.length ? (
          <div className="toast-stack">
            {toasts.map((toast) => (
              <div key={toast.id} className={`toast toast-${toast.type}`}>
                <strong>{toast.type === 'error' ? 'Erro' : 'Sucesso'}</strong>
                <span>{toast.message}</span>
              </div>
            ))}
          </div>
        ) : null}
      </main>
    </div>
  );
}

function filteredRequests(requests: TripRequest[], session: SessionUser | null, filterText = '') {
  const normalizedFilter = filterText.trim().toLowerCase();

  const base = requests.filter((request) => {
    if (!session) return true;
    if (session.role === 'cliente') return normalizeDocument(request.document) === normalizeDocument(session.document);
    if (session.role === 'motorista') return request.driver.toLowerCase() === session.name.toLowerCase();
    return true;
  });

  if (!normalizedFilter) return base;

  return base.filter((request) =>
    [request.protocol, request.clientName, request.destination, request.driver, request.vehicle]
      .join(' ')
      .toLowerCase()
      .includes(normalizedFilter)
  );
}

export default App;
