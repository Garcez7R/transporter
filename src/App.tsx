import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { demoUsers } from './data';
import { listClients } from './lib/api';
import { formatCep, formatDocument, normalizeCep, normalizeDocument } from './lib/persistence';
import type { AccessRole, RequestStatus } from './types';
import { useClients } from './hooks/useClients';
import { useRequests } from './hooks/useRequests';
import { useSession } from './hooks/useSession';
import { useUsers } from './hooks/useUsers';
import { useNotifications } from './hooks/useNotifications';
import { ClientModal } from './components/ClientModal';
import { HeaderSidebar } from './components/HeaderSidebar';
import { LoginForm } from './components/LoginForm';
import { NotificationBanner, ToastStack } from './components/NotificationBanner';
import { RequestDetails } from './components/RequestDetails';
import { UserTable } from './components/UserTable';
import { AdvancedFilters } from './components/AdvancedFilters';
import { Dashboard } from './components/Dashboard';
import { GPSTracking } from './components/GPSTracking';
import { Settings } from './components/Settings';
import { MonitoringDashboard } from './components/MonitoringDashboard';
import { BulkOperations } from './components/BulkOperations';
import { ErrorBoundary, LoadingOverlay } from './components/ErrorBoundary';
import { useOffline } from './hooks/useOffline';
import { parseAddress } from './lib/utils';

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
  const sessionHook = useSession();
  const {
    session,
    banner,
    toasts,
    loading,
    themeMode,
    patientFontLarge,
    loginDocument,
    loginPin,
    loginError,
    pinDraft,
    pinConfirm,
    setLoginDocument,
    setLoginPin,
    setPatientFontLarge,
    setThemeMode,
    setPinDraft,
    setPinConfirm,
    handleLogin,
    handleChangePin,
    handleLogout,
    showBanner,
    pushToast
  } = sessionHook;

  const requestsHook = useRequests(session, showBanner, pushToast);
  const clientsHook = useClients(session, showBanner, pushToast);
  const usersHook = useUsers(session, showBanner, pushToast);
  const notifications = useNotifications();
  const offline = useOffline();

  const NotificationContainer = () => (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: 'var(--surface-elevated)',
          color: 'var(--text)',
          border: '1px solid var(--line)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-float)'
        }
      }}
    />
  );

  const {
    requests,
    visibleRequests,
    activeRequest,
    activeRequestId,
    setActiveRequestId,
    requestFilter,
    setRequestFilter,
    // Advanced filters
    advancedFilters,
    setAdvancedFilters,
    availableDrivers,
    availableVehicles,
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
    handleCreateRequest,
    handleDeleteRequest,
    handleSendMessage,
    handleConfirmRead,
    handleResetClientPin,
    handleSaveTrip,
    applyManagerAddress,
    patchRequest,
    refreshRequests,
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
  } = requestsHook;

  const {
    clients,
    clientFilter,
    setClientFilter,
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
  } = clientsHook;

  const { users, userRoleFilter, setUserRoleFilter, userForm, setUserForm, handleCreateUser, handleResetUserPin } = usersHook;

  const [activeNav, setActiveNav] = useState('visao');
  const [operatorView, setOperatorView] = useState<'dashboard' | 'novo' | 'recentes' | 'pacientes' | 'gps' | 'monitoramento' | 'configuracoes'>('novo');
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [requestSort, setRequestSort] = useState<'recent' | 'status' | 'destination'>('recent');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  const sortedRequests = useMemo(() => {
    const sorted = [...visibleRequests];
    if (requestSort === 'status') {
      return sorted.sort((a, b) => statusLabels[a.status].localeCompare(statusLabels[b.status]));
    }
    if (requestSort === 'destination') {
      return sorted.sort((a, b) => a.destination.localeCompare(b.destination));
    }
    return sorted.sort((a, b) => new Date(b.departureAt).getTime() - new Date(a.departureAt).getTime());
  }, [visibleRequests, requestSort]);

  const selectedAll = sortedRequests.length > 0 && selectedRequestIds.length === sortedRequests.length;
  const statusTotals = useMemo(() => ({
    hoje: pendingToday,
    emRota: inRoute,
    pendentes: pendingDispatch + pendingPinChange,
    confirmados: sortedRequests.filter((request) => ['agendada', 'concluida'].includes(request.status)).length
  }), [pendingToday, inRoute, pendingDispatch, pendingPinChange, sortedRequests]);

  const patientView = !session || session.role === 'cliente';
  const isPatientSession = session?.role === 'cliente';
  const canManagePatients = session ? ['gerente', 'administrador'].includes(session.role) : false;
  const canEditTrip = session ? ['operador', 'gerente', 'administrador'].includes(session.role) : false;
  const canViewUsers = session ? ['administrador', 'gerente'].includes(session.role) : false;

  const dashboardTitle = session ? `${roleLabels[session.role]} em operação` : 'Portal de acesso';

  const internalNavItems = useMemo(() => {
    if (!session || session.role === 'cliente') return [];

    if (session.role === 'operador') {
      return [
        { id: 'solicitacoes', label: 'Solicitações' },
        { id: 'pacientes', label: 'Pacientes' }
      ];
    }

    if (session.role === 'gerente') {
      return [
        { id: 'distribuicao', label: 'Distribuição' },
        { id: 'pacientes', label: 'Pacientes' },
        { id: 'detalhes', label: 'Detalhes' }
      ];
    }

    if (session.role === 'motorista') {
      return [
        { id: 'agenda', label: 'Agenda' },
        { id: 'detalhes', label: 'Detalhes' }
      ];
    }

    return [
      { id: 'viagens', label: 'Viagens' },
      { id: 'pacientes', label: 'Pacientes' },
      { id: 'detalhes', label: 'Detalhes' },
      { id: 'usuarios', label: 'Usuários' }
    ];
  }, [session?.role, operatorView]);

  useEffect(() => {
    if (!session || internalNavItems.length === 0) return;

    if (session.role === 'operador') {
      if (activeNav !== 'solicitacoes' && activeNav !== 'pacientes') {
        setActiveNav('solicitacoes');
        setOperatorView('novo');
      }
      return;
    }

    const firstNav = internalNavItems[0];
    if (!firstNav) return;
    if (!internalNavItems.some((item) => item.id === activeNav)) {
      setActiveNav(firstNav.id);
    }
  }, [activeNav, internalNavItems, session]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  function handleNavItemClick(item: { id: string; label: string }) {
    setActiveNav(item.id);

    if (session?.role === 'operador') {
      if (item.id === 'pacientes') {
        setOperatorView('pacientes');
      } else if (item.id === 'solicitacoes') {
        setOperatorView('novo');
      }
    }
  }

  async function handleInstallApp() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      setDeferredPrompt(null);
      showBanner('success', 'Transporter está pronto para instalação.');
    } else {
      showBanner('error', 'Instalação cancelada. Você pode instalar mais tarde.');
    }
  }

  function toggleSelectedRequest(id: string) {
    setSelectedRequestIds((current) =>
      current.includes(id) ? current.filter((selected) => selected !== id) : [...current, id]
    );
  }

  function handleToggleSelectAll() {
    if (selectedAll) {
      setSelectedRequestIds([]);
      return;
    }
    setSelectedRequestIds(sortedRequests.map((request) => request.id));
  }

  async function handleBatchDelete() {
    if (!selectedRequestIds.length) return;
    if (!window.confirm(`Excluir ${selectedRequestIds.length} solicitações selecionadas?`)) return;

    for (const requestId of selectedRequestIds) {
      await handleDeleteRequest(requestId);
    }
    setSelectedRequestIds([]);
    if (session?.token) {
      await refreshRequests(session.token);
    }
  }

  async function handleBatchStatusUpdate(status: RequestStatus) {
    if (!selectedRequestIds.length) return;

    for (const requestId of selectedRequestIds) {
      await patchRequest(requestId, { status });
    }

    setSelectedRequestIds([]);
    if (session?.token) {
      await refreshRequests(session.token);
    }
    pushToast('success', `Status atualizado para ${statusLabels[status]} em ${selectedRequestIds.length} solicitações.`);
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

  async function handleInlinePatientSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.token) return;

    try {
      if (!clientForm.cep.trim() || !clientForm.street.trim() || !clientForm.number.trim() || !clientForm.neighborhood.trim() || !clientForm.city.trim()) {
        showBanner('error', 'CEP, rua, número, bairro e cidade são obrigatórios.');
        return;
      }
      await clientsHook.handleCreateClient(event);
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
        <LoginForm
          loginDocument={loginDocument}
          loginPin={loginPin}
          loginError={loginError}
          themeMode={themeMode}
          patientFontLarge={patientFontLarge}
          demoUsers={demoUsers}
          roleLabels={roleLabels}
          handleLogin={handleLogin}
          setLoginDocument={(value) => setLoginDocument(formatDocument(value))}
          setLoginPin={setLoginPin}
          toggleTheme={() => setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'))}
          toggleFontSize={() => setPatientFontLarge((prev) => !prev)}
          dashboardTitle={dashboardTitle}
          roleDescription={roleDescriptions.cliente}
        />
        <ToastStack toasts={toasts} />
        <NotificationContainer />
      </div>
    );
  }

  const requestEmptyText = requestFilter.trim()
    ? 'Nenhuma solicitação corresponde ao filtro aplicado.'
    : session.role === 'motorista'
    ? 'Nenhuma viagem atribuída até agora.'
    : session.role === 'cliente'
    ? 'Nenhuma viagem registrada para este CPF.'
    : 'Nenhuma solicitação registrada no momento.';

  return (
    <ErrorBoundary>
      <LoadingOverlay isVisible={loading} message="Carregando aplicação...">
        <div className={`app-shell dashboard-shell ${isPatientSession ? 'patient-view' : ''} ${patientView && patientFontLarge ? 'patient-font-large' : ''} ${!isPatientSession ? 'saas-app-shell internal-shell' : ''}`}>
      {!isPatientSession ? (
        <HeaderSidebar
          session={session}
          roleLabels={roleLabels}
          internalNavItems={internalNavItems}
          activeNav={activeNav}
          onNavItemClick={handleNavItemClick}
          visibleRequestsCount={visibleRequests.length}
          pendingToday={pendingToday}
          unreadMessages={unreadMessages}
          pendingDispatch={pendingDispatch}
          inRoute={inRoute}
          pendingConfirmations={pendingConfirmations}
          pendingPinChange={pendingPinChange}
        />
      ) : null}

      <main className="content-panel">
        {isPatientSession ? (
          <header className="topbar topbar-v2 patient-topbar">
            <div></div>
            <div className="topbar-actions">
              <button className="cta ghost" type="button" onClick={() => setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'))}>
                {themeMode === 'dark' ? 'Modo claro' : 'Modo escuro'}
              </button>
              <button className="cta ghost font-toggle" type="button" onClick={() => setPatientFontLarge((prev) => !prev)}>
                {patientFontLarge ? 'Fonte normal' : 'Fonte maior'}
              </button>
              {deferredPrompt && !isAppInstalled ? (
                <button className="cta ghost" type="button" onClick={handleInstallApp}>
                  Instalar app
                </button>
              ) : null}
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
                <button className="cta ghost" type="button" onClick={() => setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'))}>
                  {themeMode === 'dark' ? 'Modo claro' : 'Modo escuro'}
                </button>
                {deferredPrompt && !isAppInstalled ? (
                  <button className="cta ghost" type="button" onClick={handleInstallApp}>
                    Instalar app
                  </button>
                ) : null}
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

        {session.mustChangePin && (
          <section className="glass-card alert-card">
            <div className="section-head">
              <p className="eyebrow">Primeiro acesso</p>
              <h2>Troque seu PIN inicial</h2>
            </div>
            <form className="pin-form" onSubmit={handleChangePin}>
              <label>
                <span>Novo PIN</span>
                <input value={pinDraft} onChange={(event) => setPinDraft(event.target.value)} type="password" inputMode="numeric" placeholder="Crie um PIN novo" />
              </label>
              <label>
                <span>Confirmar PIN</span>
                <input value={pinConfirm} onChange={(event) => setPinConfirm(event.target.value)} type="password" inputMode="numeric" placeholder="Repita o PIN" />
              </label>
              <button className="cta" type="submit">
                Salvar novo PIN
              </button>
            </form>
          </section>
        )}

        <NotificationBanner banner={banner} />
        {!offline.isOnline && (
          <div className="offline-banner glass-card">
            <div className="offline-icon">📶</div>
            <div className="offline-content">
              <strong>Modo Offline</strong>
              <small>Algumas funcionalidades podem não estar disponíveis</small>
            </div>
            <div className="offline-status">
              {offline.lastOnline && (
                <small>Última conexão: {offline.lastOnline.toLocaleTimeString('pt-BR')}</small>
              )}
            </div>
          </div>
        )}

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
                    onClick={() => setOperatorView('novo')}
                  >
                    + Nova solicitação
                  </button>
                  <button
                    className={`cta ghost ${operatorView === 'recentes' ? 'active' : ''}`}
                    type="button"
                    onClick={() => setOperatorView('recentes')}
                  >
                    Solicitações recentes
                  </button>
                </div>
              </div>
            </div>


            {operatorView === 'novo' ? (
              <div className="operator-grid">
                <form className="request-form" onSubmit={handleCreateRequest}>
                  <div className="input-action">
                    <input placeholder="CPF" value={requestForm.document} onChange={(event) => setRequestForm({ ...requestForm, document: formatDocument(event.target.value) })} />
                    <button className="cta ghost" type="button" onClick={handleLookupPatient}>
                      Buscar CPF
                    </button>
                  </div>
                  <input placeholder="Nome do paciente" value={requestForm.clientName} onChange={(event) => setRequestForm({ ...requestForm, clientName: event.target.value })} />
                  <input placeholder="Telefone" value={requestForm.phone} onChange={(event) => setRequestForm({ ...requestForm, phone: event.target.value })} />
                  <input placeholder="Cidade de destino" value={requestForm.destination} onChange={(event) => setRequestForm({ ...requestForm, destination: event.target.value })} />
                  <input placeholder="Hospital / Clínica / Posto" value={requestForm.destinationFacility} onChange={(event) => setRequestForm({ ...requestForm, destinationFacility: event.target.value })} />
                  <div className="input-action">
                    <input placeholder="CEP" value={requestForm.cep} onChange={(event) => setRequestForm({ ...requestForm, cep: formatCep(event.target.value) })} onBlur={(event) => handleLookupCep(event.target.value, (data) => setRequestForm((current) => ({ ...current, street: data.street || current.street, neighborhood: data.neighborhood || current.neighborhood, city: data.city || current.city })))} />
                    <button className="cta ghost" type="button" onClick={() => handleLookupCep(requestForm.cep, (data) => setRequestForm((current) => ({ ...current, street: data.street || current.street, neighborhood: data.neighborhood || current.neighborhood, city: data.city || current.city })))}>
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
                    <select value={requestCompanion} onChange={(event) => setRequestCompanion(event.target.value as 'nao' | 'sim')}>
                      <option value="nao">não</option>
                      <option value="sim">sim</option>
                    </select>
                  </label>
                  {requestCompanion === 'sim' ? (
                    <>
                      <input placeholder="Nome do acompanhante" value={requestCompanionName} onChange={(event) => setRequestCompanionName(event.target.value)} />
                      <input placeholder="CPF do acompanhante" value={requestCompanionCpf} onChange={(event) => setRequestCompanionCpf(formatDocument(event.target.value))} />
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
                        <input placeholder="CEP" value={clientForm.cep} onChange={(event) => setClientForm({ ...clientForm, cep: formatCep(event.target.value) })} onBlur={(event) => handleLookupCep(event.target.value, (data) => setClientForm((current) => ({ ...current, street: data.street || current.street, neighborhood: data.neighborhood || current.neighborhood, city: data.city || current.city })))} />
                        <button className="cta ghost" type="button" onClick={() => handleLookupCep(clientForm.cep, (data) => setClientForm((current) => ({ ...current, street: data.street || current.street, neighborhood: data.neighborhood || current.neighborhood, city: data.city || current.city })))}>
                          Buscar CEP
                        </button>
                      </div>
                      <input placeholder="Rua" value={clientForm.street} onChange={(event) => setClientForm({ ...clientForm, street: event.target.value })} />
                      <input placeholder="Número" value={clientForm.number} onChange={(event) => setClientForm({ ...clientForm, number: event.target.value })} />
                      <input placeholder="Bairro" value={clientForm.neighborhood} onChange={(event) => setClientForm({ ...clientForm, neighborhood: event.target.value })} />
                      <input placeholder="Cidade" value={clientForm.city} onChange={(event) => setClientForm({ ...clientForm, city: event.target.value })} />
                      <div className="form-actions">
                        <button className="cta ghost" type="button" onClick={() => setShowInlinePatient(false)}>
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
                <div className="table-toolbar">
                  <AdvancedFilters
                    onFiltersChange={setAdvancedFilters}
                    availableDrivers={availableDrivers}
                    availableVehicles={availableVehicles}
                  />
                  <div className="table-filters">
                    <input
                      type="search"
                      placeholder="Buscar por paciente, protocolo ou destino..."
                      value={requestFilter}
                      onChange={(event) => setRequestFilter(event.target.value)}
                      aria-label="Filtrar solicitações"
                    />
                    <select
                      value={requestSort}
                      onChange={(event) => setRequestSort(event.target.value as 'recent' | 'status' | 'destination')}
                      aria-label="Ordenar solicitações"
                    >
                      <option value="recent">Mais recentes</option>
                      <option value="status">Por status</option>
                      <option value="destination">Por destino</option>
                    </select>
                  </div>

                  {selectedRequestIds.length > 0 && (
                    <BulkOperations
                      selectedRequests={selectedRequestIds}
                      requests={sortedRequests}
                      onBulkUpdate={(ids, status) => {
                        // Set selected requests and then update status
                        setSelectedRequestIds(ids);
                        handleBatchStatusUpdate(status as RequestStatus);
                      }}
                      onBulkDelete={handleBatchDelete}
                      onExport={(format) => {
                        // Implement export functionality
                        console.log('Exporting in format:', format);
                        showBanner('success', `Exportando em formato ${format.toUpperCase()}...`);
                      }}
                      onImport={(file) => {
                        // Implement import functionality
                        console.log('Importing file:', file);
                        showBanner('success', `Importando arquivo ${file.name}...`);
                      }}
                    />
                  )}
                </div>

                <div className="admin-table operator-admin-table">
                  <div className="admin-row admin-row-head operator-row-head">
                    <label className="table-select">
                      <input
                        type="checkbox"
                        checked={selectedAll}
                        onChange={handleToggleSelectAll}
                        aria-label="Selecionar todas as solicitações"
                      />
                    </label>
                    <span>Protocolo</span>
                    <span>Paciente</span>
                    <span>Saída</span>
                    <span>Status</span>
                    <span>Ações</span>
                  </div>
                  <div className="admin-table-body operator-scroll">
                    {sortedRequests.length ? (
                      sortedRequests.map((request) => (
                        <div className={`admin-row operator-row ${selectedRequestIds.includes(request.id) ? 'request-selected' : ''}`} key={request.id}>
                          <label className="table-select">
                            <input
                              type="checkbox"
                              checked={selectedRequestIds.includes(request.id)}
                              onChange={() => toggleSelectedRequest(request.id)}
                              aria-label={`Selecionar solicitação ${request.protocol}`}
                            />
                          </label>
                          <strong>{request.protocol}</strong>
                          <div className="admin-cell">
                            <strong>{request.clientName}</strong>
                            <small>{request.destinationFacility || request.destination}</small>
                            <small>{formatAddressDisplay(request.boardingPoint, request.boardingCep ?? request.clientCep)}</small>
                          </div>
                          <span>{formatSchedule(request.departureAt)}</span>
                          <span className={`status status-${request.status}`}>{statusLabels[request.status]}</span>
                          <div className="table-actions">
                            <button
                              className="cta ghost"
                              onClick={() => { setActiveRequestId(request.id); setActiveNav('detalhes'); }}
                              aria-label={`Editar solicitação ${request.protocol}`}
                            >
                              Editar
                            </button>
                            <button
                              className="cta ghost danger"
                              onClick={() => { if (window.confirm('Deseja excluir esta solicitação?')) { handleDeleteRequest(request.id); } }}
                              aria-label={`Excluir solicitação ${request.protocol}`}
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">
                        <div className="empty-icon"></div>
                        <strong>Nenhuma solicitação encontrada</strong>
                        <p>{requestFilter ? 'Tente ajustar os filtros de busca.' : 'As solicitações aparecerão aqui quando forem criadas.'}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : operatorView === 'monitoramento' ? (
              <MonitoringDashboard
                userRole={session.role}
                requests={requests}
                users={users}
                clients={clients}
              />
            ) : operatorView === 'configuracoes' ? (
              <Settings
                userRole={session.role}
                onExportData={(format) => {
                  console.log('Exporting data in format:', format);
                  showBanner('success', `Exportando dados em ${format.toUpperCase()}...`);
                }}
                onImportData={(file) => {
                  console.log('Importing data from file:', file);
                  showBanner('success', `Importando dados de ${file.name}...`);
                }}
                onClearCache={() => {
                  localStorage.clear();
                  showBanner('success', 'Cache limpo com sucesso!');
                }}
                onResetSettings={() => {
                  if (window.confirm('Deseja realmente resetar todas as configurações?')) {
                    showBanner('success', 'Configurações resetadas!');
                  }
                }}
              />
            ) : (
              <>
                <div className="filter-row">
                  <input placeholder="Buscar por nome ou CPF" value={clientsHook.operatorClientFilter} onChange={(event) => {
                    setActiveNav('solicitacoes');
                    setClientFilter(event.target.value);
                    if (!session?.token) return;
                    if (!event.target.value || event.target.value.length >= 3) {
                      refreshClients(session.token, event.target.value).catch(() => undefined);
                    }
                  }} />
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
                <input placeholder="Buscar por nome, CPF ou telefone" value={clientFilter} onChange={(event) => {
                  setClientFilter(event.target.value);
                  if (!session?.token) return;
                  if (!event.target.value || event.target.value.length >= 3) {
                    refreshClients(session.token, event.target.value).catch(() => undefined);
                  }
                }} />
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
                      <div className={`admin-row ${activeClientId === client.id ? 'request-selected' : ''}`} key={client.id} onClick={() => {
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
                      }}>
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
                  <input placeholder="CEP" value={clientForm.cep} onChange={(event) => setClientForm({ ...clientForm, cep: formatCep(event.target.value) })} onBlur={(event) => handleLookupCep(event.target.value, (data) => setClientForm((current) => ({ ...current, street: data.street || current.street, neighborhood: data.neighborhood || current.neighborhood, city: data.city || current.city })))} />
                  <button className="cta ghost" type="button" onClick={() => handleLookupCep(clientForm.cep, (data) => setClientForm((current) => ({ ...current, street: data.street || current.street, neighborhood: data.neighborhood || current.neighborhood, city: data.city || current.city })))}>
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
              <p className="eyebrow">Centro de Controle Operacional</p>
              <div className="section-toolbar">
                <h2>Distribuição de Viagens</h2>
                <div className="toolbar-actions">
                  <button className="cta ghost" type="button" onClick={() => setAdvancedFilters({ ...advancedFilters, statuses: ['aguardando_distribuicao'] })}>
                    Pendentes ({visibleRequests.filter(r => r.status === 'aguardando_distribuicao').length})
                  </button>
                  <button className="cta ghost" type="button" onClick={() => setAdvancedFilters({ ...advancedFilters, statuses: ['agendada'] })}>
                    Agendadas ({visibleRequests.filter(r => r.status === 'agendada').length})
                  </button>
                  <button className="cta ghost" type="button" onClick={() => setAdvancedFilters({ ...advancedFilters, statuses: [] })}>
                    Todas ({visibleRequests.length})
                  </button>
                </div>
              </div>
            </div>

            {/* Dashboard Overview */}
            <div className="manager-dashboard">
              <div className="dashboard-metrics">
                <div className="metric-card">
                  <div className="metric-icon">🚗</div>
                  <div className="metric-content">
                    <strong>{visibleRequests.filter(r => r.status === 'aguardando_distribuicao').length}</strong>
                    <span>Aguardando motorista</span>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon">📅</div>
                  <div className="metric-content">
                    <strong>{visibleRequests.filter(r => r.status === 'agendada').length}</strong>
                    <span>Agendadas hoje</span>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon">🏃</div>
                  <div className="metric-content">
                    <strong>{visibleRequests.filter(r => r.status === 'em_rota').length}</strong>
                    <span>Em andamento</span>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon">✅</div>
                  <div className="metric-content">
                    <strong>{visibleRequests.filter(r => r.status === 'concluida').length}</strong>
                    <span>Concluídas hoje</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced Filters */}
            <div className="manager-filters">
              <AdvancedFilters
                onFiltersChange={setAdvancedFilters}
                availableDrivers={availableDrivers}
                availableVehicles={availableVehicles}
              />
            </div>

            {/* Requests List */}
            <div className="manager-requests-list">
              {visibleRequests.length ? (
                <div className="requests-table">
                  <div className="table-header">
                    <div className="table-row">
                      <span>Prioridade</span>
                      <span>Protocolo</span>
                      <span>Paciente</span>
                      <span>Horário</span>
                      <span>Destino</span>
                      <span>Motorista</span>
                      <span>Veículo</span>
                      <span>Status</span>
                      <span>Ações</span>
                    </div>
                  </div>
                  <div className="table-body">
                    {visibleRequests.map((request) => {
                      const isUrgent = new Date(request.departureAt).getTime() - Date.now() < 2 * 60 * 60 * 1000; // 2 hours
                      const hasConflict = availableDrivers.includes(request.driver) && availableVehicles.includes(request.vehicle);
                      return (
                        <div className={`table-row ${request.id === activeRequestId ? 'selected' : ''} ${isUrgent ? 'urgent' : ''}`} key={request.id} onClick={() => setActiveRequestId(request.id)}>
                          <div className="priority-indicator">
                            {isUrgent && <span className="urgent-badge">URGENTE</span>}
                            {request.status === 'aguardando_distribuicao' && <span className="pending-badge">PENDENTE</span>}
                          </div>
                          <strong>{request.protocol}</strong>
                          <div className="patient-info">
                            <strong>{request.clientName}</strong>
                            <small>{request.document}</small>
                          </div>
                          <span>{formatSchedule(request.departureAt)}</span>
                          <div className="destination-info">
                            <strong>{request.destinationFacility || request.destination}</strong>
                            <small>{request.destination}</small>
                          </div>
                          <span className={request.driver ? 'assigned' : 'unassigned'}>{request.driver || 'Não atribuído'}</span>
                          <span className={request.vehicle ? 'assigned' : 'unassigned'}>{request.vehicle || 'Não atribuído'}</span>
                          <span className={`status status-${request.status}`}>{statusLabels[request.status]}</span>
                          <div className="quick-actions">
                            <button className="action-btn" onClick={(e) => { e.stopPropagation(); setActiveRequestId(request.id); }} title="Editar distribuição">
                              ✏️
                            </button>
                            <button className="action-btn" onClick={(e) => { e.stopPropagation(); setActiveRequestId(request.id); }} title="Ver detalhes">
                              👁️
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <strong>Nenhuma solicitação encontrada</strong>
                  <p>Ajuste os filtros ou aguarde novas solicitações do operador.</p>
                </div>
              )}
            </div>

            {/* Assignment Panel */}
            {activeRequest && (
              <div className="assignment-modal">
                <div className="modal-header">
                  <div className="modal-title">
                    <h3>Configurar Viagem</h3>
                    <p>{activeRequest.protocol} - {activeRequest.clientName}</p>
                  </div>
                  <button className="close-btn" onClick={() => setActiveRequestId(null)}>✕</button>
                </div>

                <form className="assignment-form" onSubmit={handleSaveTrip}>
                  <div className="form-sections">
                    {/* Patient & Trip Info */}
                    <div className="form-section">
                      <h4>Informações da Viagem</h4>
                      <div className="info-grid">
                        <div className="info-item">
                          <label>Paciente</label>
                          <span>{activeRequest.clientName}</span>
                        </div>
                        <div className="info-item">
                          <label>CPF</label>
                          <span>{formatDocument(activeRequest.document)}</span>
                        </div>
                        <div className="info-item">
                          <label>Telefone</label>
                          <span>{activeRequest.phoneVisible ? activeRequest.phone : 'Oculto'}</span>
                        </div>
                        <div className="info-item">
                          <label>Destino</label>
                          <span>{activeRequest.destinationFacility || activeRequest.destination}</span>
                        </div>
                      </div>
                    </div>

                    {/* Address Section */}
                    <div className="form-section">
                      <h4>Endereço de Embarque</h4>
                      <div className="address-grid">
                        <label>
                          <span>CEP</span>
                          <div className="input-action">
                            <input value={managerCep} onChange={(event) => setManagerCep(formatCep(event.target.value))} />
                            <button className="cta ghost" type="button" onClick={() => handleLookupCep(managerCep, (data) => { setManagerStreet(data.street || managerStreet); setManagerNeighborhood(data.neighborhood || managerNeighborhood); setManagerCity(data.city || managerCity); })}>
                              🔍 Buscar
                            </button>
                          </div>
                        </label>
                        <label>
                          <span>Rua</span>
                          <input value={managerStreet} onChange={(event) => setManagerStreet(event.target.value)} />
                        </label>
                        <label>
                          <span>Número</span>
                          <input value={managerNumber} onChange={(event) => setManagerNumber(event.target.value)} />
                        </label>
                        <label>
                          <span>Bairro</span>
                          <input value={managerNeighborhood} onChange={(event) => setManagerNeighborhood(event.target.value)} />
                        </label>
                        <label>
                          <span>Cidade</span>
                          <input value={managerCity} onChange={(event) => setManagerCity(event.target.value)} />
                        </label>
                      </div>
                    </div>

                    {/* Assignment Section */}
                    <div className="form-section">
                      <h4>Atribuição Operacional</h4>
                      <div className="assignment-grid">
                        <label>
                          <span>Motorista</span>
                          <input
                            list="drivers-list"
                            value={tripForm.driver}
                            onChange={(event) => setTripForm({ ...tripForm, driver: event.target.value })}
                            placeholder="Selecione ou digite o nome"
                            className={tripForm.driver ? 'filled' : ''}
                          />
                          <datalist id="drivers-list">
                            {availableDrivers.map((driver) => (
                              <option key={driver} value={driver} />
                            ))}
                          </datalist>
                        </label>
                        <label>
                          <span>Veículo</span>
                          <input
                            list="vehicles-list"
                            value={tripForm.vehicle}
                            onChange={(event) => setTripForm({ ...tripForm, vehicle: event.target.value })}
                            placeholder="Selecione ou digite a placa/modelo"
                            className={tripForm.vehicle ? 'filled' : ''}
                          />
                          <datalist id="vehicles-list">
                            {availableVehicles.map((vehicle) => (
                              <option key={vehicle} value={vehicle} />
                            ))}
                          </datalist>
                        </label>
                        <label>
                          <span>Status Atual</span>
                          <select value={tripForm.status} onChange={(event) => setTripForm({ ...tripForm, status: event.target.value as RequestStatus })}>
                            <option value="aguardando_distribuicao">Aguardando distribuição</option>
                            <option value="agendada">Agendada</option>
                            <option value="em_rota">Em rota</option>
                            <option value="concluida">Concluída</option>
                            <option value="cancelada">Cancelada</option>
                          </select>
                        </label>
                        <label>
                          <span>Telefone Visível</span>
                          <select value={tripForm.phoneVisible ? 'sim' : 'nao'} onChange={(event) => setTripForm({ ...tripForm, phoneVisible: event.target.value === 'sim' })}>
                            <option value="sim">Sim - Motorista pode ligar</option>
                            <option value="nao">Não - Manter oculto</option>
                          </select>
                        </label>
                      </div>
                    </div>

                    {/* Schedule Section */}
                    <div className="form-section">
                      <h4>Horários</h4>
                      <div className="schedule-grid">
                        <label>
                          <span>Data e Hora da Viagem</span>
                          <div className="input-group">
                            <input type="date" value={tripDate} onChange={(event) => setTripDate(event.target.value)} />
                            <input type="time" value={tripTime} onChange={(event) => setTripTime(formatTime(event.target.value))} />
                          </div>
                        </label>
                        <label>
                          <span>Data e Hora da Consulta</span>
                          <div className="input-group">
                            <input type="date" value={tripConsultDate} onChange={(event) => setTripConsultDate(event.target.value)} />
                            <input type="time" value={tripConsultTime} onChange={(event) => setTripConsultTime(formatTime(event.target.value))} />
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Notes Section */}
                    <div className="form-section">
                      <h4>Observações</h4>
                      <label className="full-width">
                        <textarea
                          value={tripForm.notes}
                          onChange={(event) => setTripForm({ ...tripForm, notes: event.target.value })}
                          placeholder="Adicione observações importantes para o motorista..."
                          rows={3}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="form-actions">
                    <button className="cta" type="submit">
                      💾 Salvar Alterações
                    </button>
                    {activeRequest.status === 'aguardando_distribuicao' && tripForm.driver && tripForm.vehicle && (
                      <button className="cta success" type="button" onClick={async () => {
                        await patchRequest(activeRequest.id, { status: 'agendada', driver: tripForm.driver, vehicle: tripForm.vehicle });
                        showBanner('success', 'Viagem distribuída e agendada com sucesso!');
                        setActiveRequestId(null);
                      }}>
                        🚀 Distribuir & Agendar
                      </button>
                    )}
                    {activeRequest.status === 'agendada' && (
                      <button className="cta warning" type="button" onClick={async () => {
                        await patchRequest(activeRequest.id, { status: 'em_rota' });
                        showBanner('success', 'Viagem iniciada - motorista notificado!');
                        setActiveRequestId(null);
                      }}>
                        ▶️ Iniciar Rota
                      </button>
                    )}
                    {activeRequest.status === 'em_rota' && (
                      <button className="cta success" type="button" onClick={async () => {
                        await patchRequest(activeRequest.id, { status: 'concluida' });
                        showBanner('success', 'Viagem concluída com sucesso!');
                        setActiveRequestId(null);
                      }}>
                        ✅ Marcar Concluída
                      </button>
                    )}
                    <button className="cta ghost" type="button" onClick={() => setActiveRequestId(null)}>
                      ❌ Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}
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
                        <small>{request.destinationFacility || request.destination} · {formatAddressDisplay(request.boardingPoint, request.boardingCep ?? request.clientCep)} · {formatSchedule(request.departureAt)}</small>
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
                  <p>
                    <strong>Paciente:</strong> {activeRequest.clientName}
                  </p>
                  <p>
                    <strong>CPF:</strong> {formatDocument(activeRequest.document)}
                  </p>
                  <p>
                    <strong>Telefone:</strong> {activeRequest.phoneVisible ? activeRequest.phone : 'oculto'}
                  </p>
                  <p>
                    <strong>Endereço:</strong> {activeRequest.clientAddress || 'não informado'}
                  </p>
                  <p>
                    <strong>CEP:</strong> {activeRequest.clientCep || 'não informado'}
                  </p>
                  <p>
                    <strong>Embarque:</strong> {formatAddressDisplay(activeRequest.boardingPoint, activeRequest.boardingCep ?? activeRequest.clientCep)}
                  </p>
                  <p>
                    <strong>Destino:</strong> {activeRequest.destination}
                  </p>
                  <p>
                    <strong>Hospital / Clínica / Posto:</strong> {activeRequest.destinationFacility || 'Não informado'}
                  </p>
                  <p>
                    <strong>Acompanhantes / carga:</strong> {activeRequest.companions}
                  </p>
                  <a className="cta" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(buildMapQuery(activeRequest) || activeRequest.boardingPoint)}`} target="_blank" rel="noreferrer">
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
                      <p>{request.clientName} · {request.destination}</p>
                      <small>{request.destinationFacility || request.destination} · Embarque: {formatAddressDisplay(request.boardingPoint, request.boardingCep ?? request.clientCep)} · Saída: {formatSchedule(request.departureAt)}</small>
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
          <RequestDetails
            activeRequest={activeRequest}
            session={session}
            canEditTrip={canEditTrip}
            tripForm={tripForm}
            setTripForm={setTripForm}
            tripCompanion={tripCompanion}
            setTripCompanion={setTripCompanion}
            tripCompanionName={tripCompanionName}
            setTripCompanionName={setTripCompanionName}
            tripCompanionCpf={tripCompanionCpf}
            setTripCompanionCpf={setTripCompanionCpf}
            tripDate={tripDate}
            setTripDate={setTripDate}
            tripTime={tripTime}
            setTripTime={setTripTime}
            tripConsultDate={tripConsultDate}
            setTripConsultDate={setTripConsultDate}
            tripConsultTime={tripConsultTime}
            setTripConsultTime={setTripConsultTime}
            messageDraft={messageDraft}
            setMessageDraft={setMessageDraft}
            handleSaveTrip={handleSaveTrip}
            handleSendMessage={handleSendMessage}
            handleConfirmRead={handleConfirmRead}
            handleResetClientPin={handleResetClientPin}
            statusLabels={statusLabels}
            formatTime={(value) => {
              const digits = value.replace(/\D/g, '').slice(0, 4);
              if (digits.length <= 2) return digits;
              return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
            }}
            formatAddressDisplay={formatAddressDisplay}
            buildMapQuery={buildMapQuery}
          />
        ) : null}

        {canViewUsers ? (
          <UserTable
            session={session}
            users={users}
            userRoleFilter={userRoleFilter}
            setUserRoleFilter={setUserRoleFilter}
            userForm={userForm}
            setUserForm={setUserForm}
            handleCreateUser={handleCreateUser}
            handleResetUserPin={handleResetUserPin}
            canViewUsers={canViewUsers}
            roleLabels={roleLabels}
          />
        ) : null}

        <ClientModal
          activeClientId={activeClientId}
          clientForm={clientForm}
          setClientForm={setClientForm}
          clientModalOpen={clientModalOpen}
          handleModalUpdateClient={handleModalUpdateClient}
          handleDeleteClient={handleDeleteClient}
          setClientModalOpen={(value) => {
            if (!value) {
              setClientModalOpen(false);
            }
          }}
          handleLookupCep={handleLookupCep}
          formatCep={formatCep}
          formatDocument={formatDocument}
        />

        <ToastStack toasts={toasts} />
      </main>
    </div>
      </LoadingOverlay>
    </ErrorBoundary>
  );
}

export default App;

function formatTime(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
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
